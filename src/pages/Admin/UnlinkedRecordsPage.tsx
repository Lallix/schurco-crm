import { useEffect, useState, type CSSProperties, type ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../lib/auth'

interface UnlinkedGroup {
  customerName: string
  auditIds: string[]
  opportunityIds: string[]
}

export default function UnlinkedRecordsPage() {
  const { isAdmin } = useAuth()
  const [groups, setGroups] = useState<UnlinkedGroup[]>([])
  const [clients, setClients] = useState<{ id: string; name: string }[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [linkTo, setLinkTo] = useState<Record<string, string>>({})

  function normalize(s: string) {
    return s.trim().toLowerCase().replace(/\s+/g, ' ')
  }

  async function load() {
    setLoading(true)
    setError(null)
    const [auditsRes, oppsRes, clientsRes] = await Promise.all([
      supabase
        .from('audits')
        .select('id, customer')
        .is('client_id', null)
        .not('customer', 'is', null)
        .is('deleted_at', null),
      supabase
        .from('opportunities')
        .select('id, customer')
        .is('client_id', null)
        .not('customer', 'is', null)
        .is('deleted_at', null),
      supabase.from('clients').select('id, name').is('deleted_at', null).order('name'),
    ])

    if (auditsRes.error) setError(auditsRes.error.message)
    if (oppsRes.error) setError(oppsRes.error.message)
    setClients(clientsRes.data ?? [])

    const map = new Map<string, UnlinkedGroup>()
    for (const a of auditsRes.data ?? []) {
      if (!a.customer?.trim()) continue
      const key = normalize(a.customer)
      const g = map.get(key) ?? { customerName: a.customer.trim(), auditIds: [] as string[], opportunityIds: [] as string[] }
      g.auditIds.push(a.id)
      map.set(key, g)
    }
    for (const o of oppsRes.data ?? []) {
      if (!o.customer?.trim()) continue
      const key = normalize(o.customer)
      const g = map.get(key) ?? { customerName: o.customer.trim(), opportunityIds: [] as string[], auditIds: [] as string[] }
      g.opportunityIds.push(o.id)
      map.set(key, g)
    }

    setGroups(Array.from(map.values()).sort((a, b) => a.customerName.localeCompare(b.customerName)))
    setLoading(false)
  }

  useEffect(() => {
    if (isAdmin) load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin])

  if (!isAdmin) return <Navigate to="/" replace />

  async function linkToExisting(group: UnlinkedGroup, clientId: string) {
    if (!clientId) return
    setBusy(group.customerName)
    setError(null)
    const [r1, r2] = await Promise.all([
      group.auditIds.length
        ? supabase.from('audits').update({ client_id: clientId }).in('id', group.auditIds)
        : Promise.resolve({ error: null }),
      group.opportunityIds.length
        ? supabase.from('opportunities').update({ client_id: clientId }).in('id', group.opportunityIds)
        : Promise.resolve({ error: null }),
    ])
    if (r1.error || r2.error) setError((r1.error ?? r2.error)!.message)
    setBusy(null)
    await load()
  }

  async function createAndLink(group: UnlinkedGroup) {
    setBusy(group.customerName)
    setError(null)
    // The database's own link_existing_records_to_client trigger does the
    // linking as soon as this insert commits — no manual update needed here.
    const { error } = await supabase.from('clients').insert({ name: group.customerName, type: 'Customer' })
    if (error) setError(error.message)
    setBusy(null)
    await load()
  }

  return (
    <div>
      <h1>Unlinked Records</h1>
      <p style={{ color: 'var(--muted)' }}>
        Audits and opportunities whose customer name didn't exactly match an existing client, so they weren't
        auto-linked. Link each one to the right client — or create a new client from the name if there isn't one
        yet — so it shows up on that client's page.
      </p>

      {error && <div style={{ color: 'var(--danger)', marginBottom: '1rem' }}>{error}</div>}

      {loading ? (
        <p style={{ color: 'var(--muted)' }}>Loading…</p>
      ) : groups.length === 0 ? (
        <p style={{ color: 'var(--muted)' }}>Nothing unlinked right now — everything matched a client.</p>
      ) : (
        <div className="table-scroll">
        <table style={{ width: '100%', borderCollapse: 'collapse', background: 'var(--surface)' }}>
          <thead>
            <tr style={{ textAlign: 'left', borderBottom: '2px solid var(--border)' }}>
              <Th>Customer name (as entered)</Th>
              <Th>Records</Th>
              <Th>Link to existing client</Th>
              <Th></Th>
            </tr>
          </thead>
          <tbody>
            {groups.map((g) => (
              <tr key={g.customerName} style={{ borderBottom: '1px solid var(--border)' }}>
                <Td>
                  <strong>{g.customerName}</strong>
                </Td>
                <Td>
                  {g.auditIds.length > 0 && `${g.auditIds.length} audit${g.auditIds.length === 1 ? '' : 's'}`}
                  {g.auditIds.length > 0 && g.opportunityIds.length > 0 && ', '}
                  {g.opportunityIds.length > 0 &&
                    `${g.opportunityIds.length} opportunit${g.opportunityIds.length === 1 ? 'y' : 'ies'}`}
                </Td>
                <Td>
                  <select
                    value={linkTo[g.customerName] ?? ''}
                    onChange={(e) => setLinkTo((s) => ({ ...s, [g.customerName]: e.target.value }))}
                    style={selectStyle}
                  >
                    <option value="">Select a client…</option>
                    {clients.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>{' '}
                  <button
                    disabled={!linkTo[g.customerName] || busy === g.customerName}
                    onClick={() => linkToExisting(g, linkTo[g.customerName])}
                    style={secondaryBtn}
                  >
                    Link
                  </button>
                </Td>
                <Td>
                  <button
                    disabled={busy === g.customerName}
                    onClick={() => createAndLink(g)}
                    style={{ ...secondaryBtn, color: 'var(--green-dark)' }}
                  >
                    + Create client "{g.customerName}"
                  </button>
                </Td>
              </tr>
            ))}
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

function Td({ children }: { children?: ReactNode }) {
  return <td style={{ padding: '0.6rem' }}>{children}</td>
}

const selectStyle: CSSProperties = {
  padding: '0.4rem',
  border: '1px solid var(--border)',
  borderRadius: 6,
}

const secondaryBtn: CSSProperties = {
  padding: '0.4rem 0.7rem',
  borderRadius: 6,
  border: '1px solid var(--border)',
  background: 'var(--surface)',
  fontWeight: 500,
  fontSize: '9pt',
  cursor: 'pointer',
}
