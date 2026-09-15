import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../lib/auth'
import type { OmniAgingRecord, OmniAgingResponse } from './types'

function fmt(n: number, currency: string) {
  return n.toLocaleString('en-ZA', { style: 'currency', currency, maximumFractionDigits: 0 })
}

export default function AgingPage() {
  const { profile, isAdmin } = useAuth()
  const canWrite = isAdmin || profile?.crm_role === 'Sales'

  const [records, setRecords] = useState<OmniAgingRecord[]>([])
  const [clients, setClients] = useState<{ id: string; name: string; omni_code: string | null }[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [linking, setLinking] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState<string | null>(null)

  async function load() {
    setLoading(true)
    setError(null)
    const [clientsRes, agingRes] = await Promise.all([
      supabase.from('clients').select('id, name, omni_code').is('deleted_at', null).order('name'),
      supabase.functions.invoke('omni-aging'),
    ])
    setClients(clientsRes.data ?? [])
    if (agingRes.error) setError(agingRes.error.message)
    else if ((agingRes.data as { error?: string })?.error) setError((agingRes.data as { error: string }).error)
    else setRecords(((agingRes.data as OmniAgingResponse)?.customer_ageing ?? []))
    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [])

  const clientByOmniCode = useMemo(() => {
    const map = new Map<string, { id: string; name: string }>()
    for (const c of clients) if (c.omni_code) map.set(c.omni_code, c)
    return map
  }, [clients])

  const sorted = useMemo(
    () => [...records].sort((a, b) => b.outstanding_balance - a.outstanding_balance),
    [records],
  )

  const byCurrency = useMemo(() => {
    const map = new Map<string, number>()
    for (const r of records) map.set(r.currency, (map.get(r.currency) ?? 0) + r.outstanding_balance)
    return Array.from(map.entries())
  }, [records])

  async function linkClient(record: OmniAgingRecord) {
    const clientId = linking[record.customer_account]
    if (!clientId) return
    setSaving(record.customer_account)
    const { error } = await supabase.from('clients').update({ omni_code: record.customer_account }).eq('id', clientId)
    if (error) setError(error.message)
    else {
      const client = clients.find((c) => c.id === clientId)
      if (client) setClients((cs) => cs.map((c) => (c.id === clientId ? { ...c, omni_code: record.customer_account } : c)))
    }
    setSaving(null)
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h1>Client Aging</h1>
        <button onClick={load} disabled={loading} style={secondaryBtn}>
          {loading ? 'Refreshing…' : 'Refresh'}
        </button>
      </div>
      <p style={{ color: 'var(--muted)' }}>
        Live from OMNI — pulled fresh each time you open or refresh this page, not stored in the CRM.
      </p>

      {error && (
        <div style={{ color: 'var(--danger)', background: '#fdeaea', border: '1px solid var(--danger)', borderRadius: 8, padding: '0.75rem', marginBottom: '1rem' }}>
          Couldn't load aging data: {error}
        </div>
      )}

      {!loading && !error && byCurrency.length > 0 && (
        <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.25rem', flexWrap: 'wrap' }}>
          {byCurrency.map(([currency, total]) => (
            <div key={currency} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '0.75rem 1rem' }}>
              <div style={{ fontSize: '8pt', color: 'var(--muted)' }}>Total outstanding ({currency})</div>
              <div style={{ fontSize: '13pt', fontWeight: 700, color: 'var(--green-dark)' }}>{fmt(total, currency)}</div>
            </div>
          ))}
        </div>
      )}

      {loading ? (
        <p style={{ color: 'var(--muted)' }}>Loading…</p>
      ) : sorted.length === 0 && !error ? (
        <p style={{ color: 'var(--muted)' }}>No aging records returned.</p>
      ) : (
        <div className="table-scroll">
          <table style={{ width: '100%', borderCollapse: 'collapse', background: 'var(--surface)' }}>
            <thead>
              <tr style={{ textAlign: 'left', borderBottom: '2px solid var(--border)' }}>
                <Th>Client</Th>
                <Th>Account</Th>
                <Th>Current</Th>
                <Th>30d</Th>
                <Th>60d</Th>
                <Th>90d</Th>
                <Th>120d+</Th>
                <Th>Outstanding</Th>
                <Th>Credit limit</Th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((r) => {
                const client = clientByOmniCode.get(r.customer_account)
                return (
                  <tr key={r.customer_account} style={{ borderBottom: '1px solid var(--border)' }}>
                    <Td>
                      {client ? (
                        <Link to={`/clients/${client.id}`} style={{ color: 'var(--green)', fontWeight: 600 }}>
                          {client.name}
                        </Link>
                      ) : (
                        <div>
                          <div>{r.customer_name}</div>
                          {canWrite && (
                            <div style={{ display: 'flex', gap: '0.3rem', marginTop: '0.25rem' }}>
                              <select
                                value={linking[r.customer_account] ?? ''}
                                onChange={(e) => setLinking((s) => ({ ...s, [r.customer_account]: e.target.value }))}
                                style={{ ...selectStyle, fontSize: '8pt' }}
                              >
                                <option value="">Link to client…</option>
                                {clients.map((c) => (
                                  <option key={c.id} value={c.id}>
                                    {c.name}
                                  </option>
                                ))}
                              </select>
                              <button
                                onClick={() => linkClient(r)}
                                disabled={!linking[r.customer_account] || saving === r.customer_account}
                                style={{ ...secondaryBtn, padding: '0.2rem 0.5rem', fontSize: '8pt' }}
                              >
                                Link
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </Td>
                    <Td>{r.customer_account}</Td>
                    <Td>{fmt(r.current, r.currency)}</Td>
                    <Td>{fmt(r['30_days'], r.currency)}</Td>
                    <Td>{fmt(r['60_days'], r.currency)}</Td>
                    <Td style={r['90_days'] > 0 ? { color: 'var(--warn)', fontWeight: 600 } : undefined}>
                      {fmt(r['90_days'], r.currency)}
                    </Td>
                    <Td style={r['120_days_and_over'] > 0 ? { color: 'var(--danger)', fontWeight: 600 } : undefined}>
                      {fmt(r['120_days_and_over'], r.currency)}
                    </Td>
                    <Td style={{ fontWeight: 600 }}>{fmt(r.outstanding_balance, r.currency)}</Td>
                    <Td>{r.credit_limit ? fmt(r.credit_limit, r.currency) : '—'}</Td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function Th({ children }: { children?: ReactNode }) {
  return <th style={{ padding: '0.6rem', fontSize: '9pt', color: 'var(--muted)' }}>{children}</th>
}

function Td({ children, style }: { children?: ReactNode; style?: CSSProperties }) {
  return (
    <td style={{ padding: '0.6rem', fontSize: '9pt', whiteSpace: 'nowrap', ...style }}>{children}</td>
  )
}

const secondaryBtn: CSSProperties = {
  padding: '0.5rem 0.8rem',
  borderRadius: 8,
  border: '1px solid var(--border)',
  background: 'var(--surface)',
  fontWeight: 500,
}

const selectStyle: CSSProperties = {
  padding: '0.3rem',
  border: '1px solid var(--border)',
  borderRadius: 6,
}
