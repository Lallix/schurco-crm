import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import { fetchOmniOrders, type OmniOrderRecord } from '../../lib/omniOrders'

function fmtMoney(n: number, currency: string) {
  try {
    return n.toLocaleString('en-ZA', { style: 'currency', currency, maximumFractionDigits: 0 })
  } catch {
    return `${currency} ${n.toLocaleString('en-ZA', { maximumFractionDigits: 0 })}`
  }
}

type GroupMode = 'rep' | 'category'

interface BarDatum {
  label: string
  value: number
  currency: string
}

// One bar per (group, currency) combo — a rep/category label only grows a
// "(USD)" suffix if they actually have orders in more than one currency,
// so the common single-currency case stays a clean, unlabeled bar.
function groupOrders(orders: OmniOrderRecord[], mode: GroupMode): BarDatum[] {
  const byKey = new Map<string, Map<string, number>>()
  for (const o of orders) {
    const key = (mode === 'rep' ? o.sales_rep_name : o.line_sales_category) || 'Unassigned'
    if (!byKey.has(key)) byKey.set(key, new Map())
    const byCurrency = byKey.get(key)!
    byCurrency.set(o.currency_code, (byCurrency.get(o.currency_code) ?? 0) + (Number(o.value_excl_after_discount) || 0))
  }
  const rows: BarDatum[] = []
  for (const [key, byCurrency] of byKey) {
    const multi = byCurrency.size > 1
    for (const [currency, value] of byCurrency) {
      rows.push({ label: multi ? `${key} (${currency})` : key, value, currency })
    }
  }
  return rows.sort((a, b) => b.value - a.value)
}

export default function OpenOrdersWidget() {
  const [orders, setOrders] = useState<OmniOrderRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [groupMode, setGroupMode] = useState<GroupMode>('rep')

  useEffect(() => {
    let cancelled = false
    fetchOmniOrders().then(({ orders: data, error: err }) => {
      if (cancelled) return
      setOrders(data)
      setError(err)
      setLoading(false)
    })
    return () => {
      cancelled = true
    }
  }, [])

  const totalValue = useMemo(() => {
    const map = new Map<string, number>()
    for (const o of orders) map.set(o.currency_code, (map.get(o.currency_code) ?? 0) + (Number(o.value_excl_after_discount) || 0))
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1])
  }, [orders])

  const activeCustomers = useMemo(() => new Set(orders.map((o) => o.customer_account)).size, [orders])

  const bars = useMemo(() => groupOrders(orders, groupMode), [orders, groupMode])
  const maxValue = bars[0]?.value ?? 0

  return (
    <div style={{ marginBottom: '1.5rem' }}>
      <h3 style={{ marginBottom: '0.75rem' }}>Open Sales Orders</h3>

      {error ? (
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '1rem', color: 'var(--muted)', fontSize: '9pt' }}>
          Open orders are unavailable right now — OMNI couldn't be reached. ({error})
        </div>
      ) : loading ? (
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '1rem', color: 'var(--muted)', fontSize: '9pt' }}>
          Loading open orders…
        </div>
      ) : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '0.75rem', marginBottom: '0.9rem' }}>
            <Kpi label="Total open orders" value={String(orders.length)} />
            <Kpi
              label="Outstanding value"
              value={totalValue.length === 0 ? '—' : totalValue.map(([cur, val]) => fmtMoney(val, cur)).join(' · ')}
            />
            <Kpi label="Active customers" value={String(activeCustomers)} />
          </div>

          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '1rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.6rem' }}>
              <strong style={{ fontSize: '10pt' }}>Outstanding value by {groupMode === 'rep' ? 'sales rep' : 'category'}</strong>
              <div style={{ display: 'flex', gap: '0.3rem' }}>
                {(['rep', 'category'] as GroupMode[]).map((m) => (
                  <button
                    key={m}
                    onClick={() => setGroupMode(m)}
                    style={{
                      ...toggleBtn,
                      background: groupMode === m ? 'var(--green)' : 'var(--surface)',
                      color: groupMode === m ? '#fff' : 'var(--ink)',
                      borderColor: groupMode === m ? 'var(--green)' : 'var(--border)',
                    }}
                  >
                    {m === 'rep' ? 'By rep' : 'By category'}
                  </button>
                ))}
              </div>
            </div>
            {bars.length === 0 ? (
              <p style={{ color: 'var(--muted)', margin: 0 }}>No open orders.</p>
            ) : (
              bars.map((b) => <OrderBarRow key={b.label} label={b.label} value={b.value} currency={b.currency} max={maxValue} />)
            )}
          </div>
        </>
      )}
    </div>
  )
}

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '0.9rem' }}>
      <div style={{ fontSize: '8pt', color: 'var(--muted)', marginBottom: '0.3rem' }}>{label}</div>
      <div style={{ fontSize: '14pt', fontWeight: 700, color: 'var(--green-dark)' }}>{value}</div>
    </div>
  )
}

function OrderBarRow({ label, value, currency, max }: { label: string; value: number; currency: string; max: number }) {
  const pct = max > 0 ? Math.max((value / max) * 100, 4) : 0
  return (
    <div style={{ marginBottom: '0.6rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9pt', marginBottom: '0.2rem' }}>
        <span>{label}</span>
        <span style={{ fontWeight: 600 }}>{fmtMoney(value, currency)}</span>
      </div>
      <div style={{ background: 'var(--bg)', borderRadius: 999, height: 6 }}>
        <div style={{ width: `${pct}%`, background: 'var(--green)', height: 6, borderRadius: 999 }} />
      </div>
    </div>
  )
}

const toggleBtn: CSSProperties = {
  padding: '0.3rem 0.6rem',
  borderRadius: 6,
  border: '1px solid var(--border)',
  fontSize: '8pt',
  fontWeight: 500,
}
