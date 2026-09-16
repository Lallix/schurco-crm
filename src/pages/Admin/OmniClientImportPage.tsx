import { useEffect, useState, type CSSProperties, type ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../lib/auth'
import { fetchOmniOrders } from '../../lib/omniOrders'
import type { OmniAgingResponse } from '../Aging/types'

interface Candidate {
  code: string
  name: string
}

interface ExistingClient {
  id: string
  name: string
  omni_code: string | null
}

function normalize(s: string) {
  return s.trim().toLowerCase().replace(/\s+/g, ' ')
}

async function fetchAgingCustomers(): Promise<{ pairs: Candidate[]; error: string | null }> {
  const { data, error } = await supabase.functions.invoke('omni-aging')
  if (error) return { pairs: [], error: error.message }
  const body = data as (OmniAgingResponse & { error?: string }) | null
  if (body?.error) return { pairs: [], error: body.error }
  const pairs = (body?.customer_ageing ?? []).map((r) => ({ code: r.customer_account, name: r.customer_name }))
  return { pairs, error: null }
}

export default function OmniClientImportPage() {
  const { isAdmin } = useAuth()

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)

  const [newClients, setNewClients] = useState<Candidate[]>([])
  const [matches, setMatches] = useState<{ candidate: Candidate; client: ExistingClient }[]>([])
  const [alreadyLinkedCount, setAlreadyLinkedCount] = useState(0)

  async function load() {
    setLoading(true)
    setError(null)

    const [agingRes, ordersRes, clientsRes] = await Promise.all([
      fetchAgingCustomers(),
      fetchOmniOrders(),
      supabase.from('clients').select('id, name, omni_code').is('deleted_at', null),
    ])

    const errs = [agingRes.error, ordersRes.error, clientsRes.error].filter(Boolean)
    if (errs.length) setError(errs.join(' · '))

    // Union candidates from both OMNI reports, by account code.
    const candidateMap = new Map<string, Candidate>()
    for (const p of agingRes.pairs) {
      if (p.code && !candidateMap.has(p.code)) candidateMap.set(p.code, p)
    }
    for (const o of ordersRes.orders) {
      if (o.customer_account && !candidateMap.has(o.customer_account)) {
        candidateMap.set(o.customer_account, { code: o.customer_account, name: o.customer_name })
      }
    }

    const clients = (clientsRes.data ?? []) as ExistingClient[]
    const linkedCodes = new Set(clients.filter((c) => c.omni_code).map((c) => c.omni_code as string))
    const unlinkedByName = new Map(clients.filter((c) => !c.omni_code).map((c) => [normalize(c.name), c]))

    const freshNew: Candidate[] = []
    const freshMatches: { candidate: Candidate; client: ExistingClient }[] = []
    let linkedCount = 0

    for (const cand of candidateMap.values()) {
      if (linkedCodes.has(cand.code)) {
        linkedCount += 1
        continue
      }
      const match = unlinkedByName.get(normalize(cand.name))
      if (match) freshMatches.push({ candidate: cand, client: match })
      else freshNew.push(cand)
    }

    freshNew.sort((a, b) => a.name.localeCompare(b.name))
    freshMatches.sort((a, b) => a.candidate.name.localeCompare(b.candidate.name))

    setNewClients(freshNew)
    setMatches(freshMatches)
    setAlreadyLinkedCount(linkedCount)
    setLoading(false)
  }

  useEffect(() => {
    if (isAdmin) load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin])

  if (!isAdmin) return <Navigate to="/" replace />

  async function createClient(cand: Candidate) {
    setBusy(cand.code)
    setError(null)
    const { error } = await supabase.from('clients').insert({ name: cand.name, type: 'Customer', omni_code: cand.code })
    if (error) setError(error.message)
    setBusy(null)
    await load()
  }

  async function createAllNew() {
    setBusy('__all__')
    setError(null)
    const { error } = await supabase
      .from('clients')
      .insert(newClients.map((c) => ({ name: c.name, type: 'Customer', omni_code: c.code })))
    if (error) setError(error.message)
    setBusy(null)
    await load()
  }

  async function linkClient(candidate: Candidate, client: ExistingClient) {
    setBusy(candidate.code)
    setError(null)
    const { error } = await supabase.from('clients').update({ omni_code: candidate.code }).eq('id', client.id)
    if (error) setError(error.message)
    setBusy(null)
    await load()
  }

  return (
    <div>
      <h1>Import Clients from OMNI</h1>
      <p style={{ color: 'var(--muted)', maxWidth: '60ch' }}>
        Every customer account seen in the live Aging and Orders data, matched against your existing clients by
        account code and then by exact name. Nothing happens automatically — review each row and action it
        yourself.
      </p>

      {error && <div style={{ color: 'var(--danger)', marginBottom: '1rem' }}>{error}</div>}

      {loading ? (
        <p style={{ color: 'var(--muted)' }}>Loading from OMNI…</p>
      ) : (
        <>
          <p style={{ color: 'var(--muted)', fontSize: '9pt' }}>
            {alreadyLinkedCount} account{alreadyLinkedCount === 1 ? '' : 's'} already linked to a client — nothing
            to do there.
          </p>

          <Section
            title="Exact name match — unlinked client found"
            subtitle="An existing client's name matches this OMNI account exactly. Link them instead of creating a duplicate."
          >
            {matches.length === 0 ? (
              <p style={{ color: 'var(--muted)' }}>None.</p>
            ) : (
              <div className="table-scroll">
                <table style={{ width: '100%', borderCollapse: 'collapse', background: 'var(--surface)' }}>
                  <thead>
                    <tr style={{ textAlign: 'left', borderBottom: '2px solid var(--border)' }}>
                      <Th>OMNI account</Th>
                      <Th>OMNI name</Th>
                      <Th>Matched client</Th>
                      <Th></Th>
                    </tr>
                  </thead>
                  <tbody>
                    {matches.map(({ candidate, client }) => (
                      <tr key={candidate.code} style={{ borderBottom: '1px solid var(--border)' }}>
                        <Td>{candidate.code}</Td>
                        <Td>{candidate.name}</Td>
                        <Td>{client.name}</Td>
                        <Td>
                          <button
                            disabled={busy === candidate.code}
                            onClick={() => linkClient(candidate, client)}
                            style={{ ...secondaryBtn, color: 'var(--green-dark)' }}
                          >
                            Link
                          </button>
                        </Td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Section>

          <Section
            title="New clients"
            subtitle="No existing client matches this OMNI account at all. Create one, linked from the start."
            action={
              newClients.length > 0 && (
                <button disabled={busy === '__all__'} onClick={createAllNew} style={{ ...secondaryBtn, color: 'var(--green-dark)' }}>
                  Create all {newClients.length}
                </button>
              )
            }
          >
            {newClients.length === 0 ? (
              <p style={{ color: 'var(--muted)' }}>None.</p>
            ) : (
              <div className="table-scroll">
                <table style={{ width: '100%', borderCollapse: 'collapse', background: 'var(--surface)' }}>
                  <thead>
                    <tr style={{ textAlign: 'left', borderBottom: '2px solid var(--border)' }}>
                      <Th>OMNI account</Th>
                      <Th>OMNI name</Th>
                      <Th></Th>
                    </tr>
                  </thead>
                  <tbody>
                    {newClients.map((cand) => (
                      <tr key={cand.code} style={{ borderBottom: '1px solid var(--border)' }}>
                        <Td>{cand.code}</Td>
                        <Td>{cand.name}</Td>
                        <Td>
                          <button disabled={busy === cand.code} onClick={() => createClient(cand)} style={secondaryBtn}>
                            + Create client
                          </button>
                        </Td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Section>
        </>
      )}
    </div>
  )
}

function Section({ title, subtitle, action, children }: { title: string; subtitle: string; action?: ReactNode; children: ReactNode }) {
  return (
    <div style={{ marginTop: '1.5rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '0.3rem', flexWrap: 'wrap', gap: '0.5rem' }}>
        <h3 style={{ margin: 0 }}>{title}</h3>
        {action}
      </div>
      <p style={{ color: 'var(--muted)', fontSize: '8.5pt', margin: '0 0 0.6rem' }}>{subtitle}</p>
      {children}
    </div>
  )
}

function Th({ children }: { children?: ReactNode }) {
  return <th style={{ padding: '0.6rem', fontSize: '9pt', color: 'var(--muted)' }}>{children}</th>
}

function Td({ children }: { children?: ReactNode }) {
  return <td style={{ padding: '0.6rem', fontSize: '9pt' }}>{children}</td>
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
