import { useState, type ReactNode } from 'react'
import { fetchOmniOrders, type OmniOrderRecord } from '../../lib/omniOrders'

function fmtMoney(n: number, currency: string) {
  try {
    return n.toLocaleString('en-ZA', { style: 'currency', currency, maximumFractionDigits: 0 })
  } catch {
    return `${currency} ${n.toLocaleString('en-ZA', { maximumFractionDigits: 0 })}`
  }
}

function fmtQty(n: number) {
  return n.toLocaleString('en-ZA', { maximumFractionDigits: 2 })
}

// Collapsible, lazy-loaded panel for the Client detail page — only calls
// OMNI once the user actually expands it, so visiting a client's page
// doesn't fire an extra live OMNI fetch every time. Read-only throughout;
// nothing here is ever written back to OMNI.
export default function OutstandingOrdersPanel({ omniCode }: { omniCode: string | null }) {
  const [loaded, setLoaded] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [orders, setOrders] = useState<OmniOrderRecord[]>([])

  async function loadOnce() {
    if (loaded || loading || !omniCode) return
    setLoading(true)
    const { orders: all, error: err } = await fetchOmniOrders()
    setOrders(all.filter((o) => o.customer_account === omniCode))
    setError(err)
    setLoading(false)
    setLoaded(true)
  }

  const byCurrency = new Map<string, number>()
  let qty = 0
  for (const o of orders) {
    byCurrency.set(o.currency_code, (byCurrency.get(o.currency_code) ?? 0) + (Number(o.value_excl_after_discount) || 0))
    qty += Number(o.outstanding_qty_to_deliver) || 0
  }

  return (
    <details
      onToggle={(e) => {
        if ((e.currentTarget as HTMLDetailsElement).open) loadOnce()
      }}
      style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10 }}
    >
      <summary className="disclosure" style={{ cursor: 'pointer', padding: '1rem', fontSize: '12pt', fontWeight: 600 }}>
        <span className="chevron">▶</span>
        Outstanding Orders
        {loaded && !error && orders.length > 0 && (
          <span style={{ fontWeight: 400, color: 'var(--muted)', fontSize: '9pt' }}> ({orders.length})</span>
        )}
      </summary>
      <div style={{ padding: '0 1rem 1rem' }}>
        <p style={{ fontSize: '8pt', color: 'var(--muted)', marginTop: 0 }}>
          Live from OMNI — read-only, not stored in the CRM.
          {omniCode && ` Linked account: ${omniCode}.`}
        </p>

        {!omniCode ? (
          <p style={{ fontSize: '9pt', color: 'var(--muted)', margin: 0 }}>
            No OMNI account code linked — edit the client record to add one.
          </p>
        ) : loading ? (
          <p style={{ fontSize: '9pt', color: 'var(--muted)', margin: 0 }}>Loading…</p>
        ) : error ? (
          <p style={{ fontSize: '9pt', color: 'var(--muted)', margin: 0 }}>
            Couldn't load outstanding orders right now — OMNI may be unavailable. Try again shortly.
          </p>
        ) : orders.length === 0 ? (
          <p style={{ fontSize: '9pt', color: 'var(--muted)', margin: 0 }}>No outstanding orders for this client.</p>
        ) : (
          <div className="table-scroll">
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ textAlign: 'left', borderBottom: '2px solid var(--border)' }}>
                  <Th>Order No.</Th>
                  <Th>Category</Th>
                  <Th>Sales Rep</Th>
                  <Th>Order Date</Th>
                  <Th>Due Date</Th>
                  <Th>Promised Date</Th>
                  <Th align="right">Outstanding Qty</Th>
                  <Th>Currency</Th>
                  <Th align="right">Value (excl.)</Th>
                </tr>
              </thead>
              <tbody>
                {orders.map((o) => (
                  <tr key={o.reference} style={{ borderBottom: '1px solid var(--border)' }}>
                    <Td>{o.reference}</Td>
                    <Td>{o.line_sales_category || '—'}</Td>
                    <Td>{o.sales_rep_name || '—'}</Td>
                    <Td>{o.document_date ?? '—'}</Td>
                    <Td>{o.due_date ?? '—'}</Td>
                    <Td>{o.prom_yyyy_mm_dd ?? '—'}</Td>
                    <Td align="right">{fmtQty(o.outstanding_qty_to_deliver)}</Td>
                    <Td>{o.currency_code}</Td>
                    <Td align="right">{fmtMoney(o.value_excl_after_discount, o.currency_code)}</Td>
                  </tr>
                ))}
                <tr>
                  <td
                    colSpan={6}
                    style={{
                      padding: '0.5rem 0.6rem',
                      fontWeight: 700,
                      borderTop: '2px solid var(--border)',
                      background: 'var(--green-light)',
                      color: 'var(--green-dark)',
                      fontSize: '8.5pt',
                    }}
                  >
                    Subtotal
                  </td>
                  <td
                    style={{
                      padding: '0.5rem 0.6rem',
                      fontWeight: 700,
                      textAlign: 'right',
                      borderTop: '2px solid var(--border)',
                      background: 'var(--green-light)',
                      color: 'var(--green-dark)',
                      fontSize: '8.5pt',
                    }}
                  >
                    {fmtQty(qty)}
                  </td>
                  <td style={{ borderTop: '2px solid var(--border)', background: 'var(--green-light)' }} />
                  <td
                    style={{
                      padding: '0.5rem 0.6rem',
                      fontWeight: 700,
                      textAlign: 'right',
                      borderTop: '2px solid var(--border)',
                      background: 'var(--green-light)',
                      color: 'var(--green-dark)',
                      fontSize: '8.5pt',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {Array.from(byCurrency.entries())
                      .map(([cur, val]) => fmtMoney(val, cur))
                      .join(' · ')}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </div>
    </details>
  )
}

function Th({ children, align }: { children?: ReactNode; align?: 'left' | 'right' }) {
  return (
    <th style={{ padding: '0.5rem 0.6rem', fontSize: '8.5pt', color: 'var(--muted)', whiteSpace: 'nowrap', textAlign: align ?? 'left' }}>
      {children}
    </th>
  )
}

function Td({ children, align }: { children?: ReactNode; align?: 'left' | 'right' }) {
  return (
    <td style={{ padding: '0.5rem 0.6rem', fontSize: '8.5pt', whiteSpace: 'nowrap', textAlign: align ?? 'left' }}>{children}</td>
  )
}
