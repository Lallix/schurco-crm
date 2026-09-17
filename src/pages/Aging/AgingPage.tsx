import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../lib/auth'
import { fetchOmniAging } from '../../lib/omniAging'
import type { OmniAgingRecord } from './types'

function fmt(n: number, currency: string) {
  return n.toLocaleString('en-ZA', { style: 'currency', currency, maximumFractionDigits: 0 })
}

type SortField = 'name' | 'outstanding' | 'credit_limit'

export default function AgingPage() {
  const { profile, isAdmin } = useAuth()
  const canWrite = isAdmin || profile?.crm_role === 'Sales'

  const [records, setRecords] = useState<OmniAgingRecord[]>([])
  const [clients, setClients] = useState<{ id: string; name: string; omni_code: string | null }[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lastFetched, setLastFetched] = useState<Date | null>(null)
  const [linking, setLinking] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState<string | null>(null)
  const [currencyFilter, setCurrencyFilter] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [sortField, setSortField] = useState<SortField>('outstanding')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')

  async function load(force = false, isRetry = false) {
    setLoading(true)
    if (!isRetry) setError(null)
    const [clientsRes, agingRes] = await Promise.all([
      supabase.from('clients').select('id, name, omni_code').is('deleted_at', null).order('name'),
      fetchOmniAging(force),
    ])

    if (!isRetry && clientsRes.status === 401) {
      const { error: refreshError } = await supabase.auth.refreshSession()
      if (!refreshError) {
        await load(force, true)
        return
      }
    }

    setClients(clientsRes.data ?? [])
    setRecords(agingRes.records)
    setError(agingRes.error)
    setLastFetched(agingRes.fetchedAt)
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

  function clientNameFor(r: OmniAgingRecord) {
    return clientByOmniCode.get(r.customer_account)?.name ?? r.customer_name
  }

  function toggleSort(field: SortField) {
    if (field === sortField) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortField(field)
      setSortDir(field === 'name' ? 'asc' : 'desc')
    }
  }

  const sorted = useMemo(() => {
    let filtered = currencyFilter ? records.filter((r) => r.currency === currencyFilter) : records
    const term = search.trim().toLowerCase()
    if (term) {
      filtered = filtered.filter(
        (r) => clientNameFor(r).toLowerCase().includes(term) || r.customer_account.toLowerCase().includes(term)
      )
    }
    const dir = sortDir === 'asc' ? 1 : -1
    return [...filtered].sort((a, b) => {
      if (sortField === 'name') return clientNameFor(a).localeCompare(clientNameFor(b)) * dir
      if (sortField === 'credit_limit') return ((a.credit_limit ?? 0) - (b.credit_limit ?? 0)) * dir
      return (a.outstanding_balance - b.outstanding_balance) * dir
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [records, currencyFilter, search, sortField, sortDir, clientByOmniCode])

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
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.75rem' }}>
        <h1>Client Aging</h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          {lastFetched && (
            <span style={{ fontSize: '8pt', color: 'var(--muted)' }}>
              Last fetched: {lastFetched.toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
          <button onClick={() => load(true)} disabled={loading} style={secondaryBtn}>
            {loading ? 'Refreshing…' : 'Refresh'}
          </button>
        </div>
      </div>
      <p style={{ color: 'var(--muted)' }}>
        Live, read-only view from OMNI. Kept from your last fetch this session — select Refresh for the latest, or
        reload the page. Not stored in the CRM.
      </p>

      {error && (
        <div style={{ color: 'var(--danger)', background: '#fdeaea', border: '1px solid var(--danger)', borderRadius: 8, padding: '0.75rem', marginBottom: '1rem' }}>
          Couldn't load aging data: {error}
        </div>
      )}

      {!loading && !error && byCurrency.length > 0 && (
        <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.25rem', flexWrap: 'wrap', alignItems: 'stretch' }}>
          {byCurrency.map(([currency, total]) => {
            const active = currencyFilter === currency
            return (
              <button
                key={currency}
                onClick={() => setCurrencyFilter(active ? null : currency)}
                title={active ? `Showing ${currency} only — click to clear` : `Show only ${currency} accounts`}
                style={{
                  textAlign: 'left',
                  background: active ? 'var(--green)' : 'var(--surface)',
                  border: `1px solid ${active ? 'var(--green)' : 'var(--border)'}`,
                  borderRadius: 10,
                  padding: '0.75rem 1rem',
                  cursor: 'pointer',
                }}
              >
                <div style={{ fontSize: '8pt', color: active ? 'rgba(255,255,255,0.85)' : 'var(--muted)' }}>
                  Total outstanding ({currency})
                </div>
                <div style={{ fontSize: '13pt', fontWeight: 700, color: active ? '#fff' : 'var(--green-dark)' }}>
                  {fmt(total, currency)}
                </div>
              </button>
            )
          })}
          {currencyFilter && (
            <button onClick={() => setCurrencyFilter(null)} style={{ ...secondaryBtn, alignSelf: 'center' }}>
              Show all currencies
            </button>
          )}
        </div>
      )}

      {!loading && !error && records.length > 0 && (
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by client name or account…"
          style={{ ...selectStyle, width: '100%', maxWidth: 340, marginBottom: '1rem', padding: '0.55rem 0.7rem' }}
        />
      )}

      {loading ? (
        <p style={{ color: 'var(--muted)' }}>Loading…</p>
      ) : sorted.length === 0 && !error ? (
        <p style={{ color: 'var(--muted)' }}>
          {search.trim()
            ? 'No accounts match your search.'
            : currencyFilter
              ? `No ${currencyFilter} accounts.`
              : 'No aging records returned.'}
        </p>
      ) : (
        <div className="table-scroll">
          <table style={{ width: '100%', borderCollapse: 'collapse', background: 'var(--surface)' }}>
            <thead>
              <tr style={{ textAlign: 'left', borderBottom: '2px solid var(--border)' }}>
                <Th sortField="name" activeField={sortField} dir={sortDir} onSort={toggleSort}>
                  Client
                </Th>
                <Th>Account</Th>
                <Th>Current</Th>
                <Th>30d</Th>
                <Th>60d</Th>
                <Th>90d</Th>
                <Th>120d+</Th>
                <Th sortField="outstanding" activeField={sortField} dir={sortDir} onSort={toggleSort}>
                  Outstanding
                </Th>
                <Th sortField="credit_limit" activeField={sortField} dir={sortDir} onSort={toggleSort}>
                  Credit limit
                </Th>
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

function Th({
  children,
  sortField,
  activeField,
  dir,
  onSort,
}: {
  children?: ReactNode
  sortField?: SortField
  activeField?: SortField
  dir?: 'asc' | 'desc'
  onSort?: (field: SortField) => void
}) {
  const active = sortField != null && sortField === activeField
  return (
    <th
      onClick={sortField ? () => onSort?.(sortField) : undefined}
      style={{
        padding: '0.6rem',
        fontSize: '9pt',
        color: active ? 'var(--green-dark)' : 'var(--muted)',
        cursor: sortField ? 'pointer' : undefined,
        userSelect: sortField ? 'none' : undefined,
        whiteSpace: 'nowrap',
      }}
    >
      {children}
      {sortField && <span style={{ marginLeft: '0.25rem', opacity: active ? 1 : 0.35 }}>{active && dir === 'asc' ? '▲' : '▼'}</span>}
    </th>
  )
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
