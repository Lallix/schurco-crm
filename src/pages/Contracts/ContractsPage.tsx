import { useEffect, useState, type CSSProperties, type ReactNode } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../lib/auth'
import { daysUntil, RENEWAL_WINDOW_DAYS } from '../../lib/contracts'
import Drawer from '../../components/Drawer'
import ContractForm from './ContractForm'
import type { Contract, ContractInput } from './types'

export default function ContractsPage() {
  const { profile, isAdmin } = useAuth()
  const canWrite = isAdmin || profile?.crm_role === 'Finance'

  const [contracts, setContracts] = useState<Contract[]>([])
  const [clients, setClients] = useState<{ id: string; name: string }[]>([])
  const [opportunities, setOpportunities] = useState<{ id: string; title: string | null; client_id: string | null }[]>([])
  const [users, setUsers] = useState<{ id: string; name: string | null }[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showDeleted, setShowDeleted] = useState(false)
  const [editing, setEditing] = useState<Contract | null | 'new'>(null)

  async function load() {
    setLoading(true)
    setError(null)
    let query = supabase.from('contracts').select('*, client:clients(id, name)').order('end_date')
    query = showDeleted ? query.not('deleted_at', 'is', null) : query.is('deleted_at', null)
    const { data, error } = await query
    if (error) setError(error.message)
    else setContracts((data ?? []) as unknown as Contract[])
    setLoading(false)
  }

  useEffect(() => {
    load()
    supabase
      .from('clients')
      .select('id, name')
      .is('deleted_at', null)
      .order('name')
      .then(({ data }) => setClients(data ?? []))
    supabase
      .from('opportunities')
      .select('id, title, client_id')
      .is('deleted_at', null)
      .then(({ data }) => setOpportunities(data ?? []))
    supabase
      .from('profiles')
      .select('id, name')
      .then(({ data }) => setUsers(data ?? []))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showDeleted])

  async function handleSave(input: ContractInput, file: File | null) {
    let contractId = editing !== 'new' ? editing?.id : undefined

    if (editing === 'new') {
      const { data, error } = await supabase.from('contracts').insert(input).select('id').single()
      if (error) throw error
      contractId = data.id
    } else if (editing) {
      const { error } = await supabase.from('contracts').update(input).eq('id', editing.id)
      if (error) throw error
    }

    if (file && contractId) {
      if (editing !== 'new' && editing?.document_path) {
        await supabase.storage.from('contracts').remove([editing.document_path])
      }
      const path = `${contractId}/${file.name}`
      const { error: uploadError } = await supabase.storage.from('contracts').upload(path, file, { upsert: true })
      if (uploadError) throw uploadError
      const { error: pathError } = await supabase.from('contracts').update({ document_path: path }).eq('id', contractId)
      if (pathError) throw pathError
    }

    setEditing(null)
    await load()
  }

  async function download(contract: Contract) {
    if (!contract.document_path) return
    const { data, error } = await supabase.storage
      .from('contracts')
      .createSignedUrl(contract.document_path, 60)
    if (error) setError(error.message)
    else if (data) window.open(data.signedUrl, '_blank')
  }

  async function softDelete(contract: Contract) {
    if (!confirm('Delete this contract? This can be restored later.')) return
    const { data: userData } = await supabase.auth.getUser()
    const { error } = await supabase
      .from('contracts')
      .update({ deleted_at: new Date().toISOString(), deleted_by: userData.user?.id ?? null })
      .eq('id', contract.id)
    if (error) setError(error.message)
    else await load()
  }

  async function restore(contract: Contract) {
    const { error } = await supabase.from('contracts').update({ deleted_at: null, deleted_by: null }).eq('id', contract.id)
    if (error) setError(error.message)
    else await load()
  }

  const renewals = contracts
    .filter((c) => c.end_date && c.status !== 'Terminated' && daysUntil(c.end_date) <= RENEWAL_WINDOW_DAYS)
    .sort((a, b) => (a.end_date! < b.end_date! ? -1 : 1))

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h1>Contracts</h1>
        {canWrite && !showDeleted && (
          <button
            onClick={() => setEditing('new')}
            style={{
              padding: '0.5rem 1rem',
              background: 'var(--green)',
              color: '#fff',
              border: 'none',
              borderRadius: 8,
              fontWeight: 600,
            }}
          >
            + New Contract
          </button>
        )}
      </div>

      {!showDeleted && renewals.length > 0 && (
        <div
          style={{
            background: '#fff7e6',
            border: '1px solid var(--warn)',
            borderRadius: 10,
            padding: '0.9rem',
            marginBottom: '1.25rem',
          }}
        >
          <strong style={{ color: 'var(--warn)' }}>
            Expiring within {RENEWAL_WINDOW_DAYS} days ({renewals.length})
          </strong>
          <ul style={{ margin: '0.5rem 0 0', paddingLeft: '1.1rem' }}>
            {renewals.map((c) => {
              const days = daysUntil(c.end_date!)
              return (
                <li key={c.id} style={{ marginBottom: '0.2rem' }}>
                  <button onClick={() => setEditing(c)} style={{ background: 'none', border: 'none', padding: 0, color: 'inherit', fontWeight: 600, cursor: 'pointer' }}>
                    {c.client?.name ?? 'Unknown client'}
                  </button>{' '}
                  — {c.contract_type || 'contract'} {days < 0 ? `expired ${-days}d ago` : `expires in ${days}d`}
                  {c.has_termination_for_convenience_clause && (
                    <span style={{ marginLeft: '0.4rem', fontSize: '8pt', color: 'var(--danger)' }}>
                      · has termination-for-convenience clause
                    </span>
                  )}
                </li>
              )
            })}
          </ul>
        </div>
      )}

      <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem', alignItems: 'center' }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--muted)' }}>
          <input type="checkbox" checked={showDeleted} onChange={(e) => setShowDeleted(e.target.checked)} />
          Show deleted
        </label>
      </div>

      {error && <div style={{ color: 'var(--danger)', marginBottom: '1rem' }}>{error}</div>}

      {loading ? (
        <p style={{ color: 'var(--muted)' }}>Loading…</p>
      ) : contracts.length === 0 ? (
        <p style={{ color: 'var(--muted)' }}>{showDeleted ? 'No deleted contracts.' : 'No contracts yet.'}</p>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse', background: 'var(--surface)' }}>
          <thead>
            <tr style={{ textAlign: 'left', borderBottom: '2px solid var(--border)' }}>
              <Th>Client</Th>
              <Th>Type</Th>
              <Th>Status</Th>
              <Th>End date</Th>
              <Th>Termination</Th>
              <Th>Document</Th>
              <Th></Th>
            </tr>
          </thead>
          <tbody>
            {contracts.map((c) => (
              <tr key={c.id} style={{ borderBottom: '1px solid var(--border)' }}>
                <Td>
                  {canWrite ? (
                    <button onClick={() => setEditing(c)} style={{ background: 'none', border: 'none', color: 'var(--green)', fontWeight: 600, padding: 0 }}>
                      {c.client?.name ?? '—'}
                    </button>
                  ) : (
                    c.client?.name ?? '—'
                  )}
                  {c.updated_by && (
                    <div style={{ fontSize: '7.5pt', color: 'var(--muted)', marginTop: '0.15rem' }}>
                      Edited by {users.find((u) => u.id === c.updated_by)?.name ?? 'someone'}
                    </div>
                  )}
                </Td>
                <Td>{c.contract_type || '—'}</Td>
                <Td>
                  <span
                    style={{
                      background: 'var(--green-light)',
                      color: 'var(--green-dark)',
                      padding: '0.15rem 0.5rem',
                      borderRadius: 999,
                      fontSize: '9pt',
                    }}
                  >
                    {c.status}
                  </span>
                </Td>
                <Td>{c.end_date ?? '—'}</Td>
                <Td>
                  {c.has_termination_for_convenience_clause ? (
                    <span style={{ color: 'var(--danger)', fontWeight: 600, fontSize: '9pt' }}>For-convenience</span>
                  ) : (
                    '—'
                  )}
                </Td>
                <Td>
                  {c.document_path ? (
                    <button onClick={() => download(c)} style={linkBtn}>
                      Download
                    </button>
                  ) : (
                    '—'
                  )}
                </Td>
                <Td>
                  {canWrite &&
                    (showDeleted ? (
                      <button onClick={() => restore(c)} style={linkBtn}>
                        Restore
                      </button>
                    ) : (
                      <button onClick={() => softDelete(c)} style={{ ...linkBtn, color: 'var(--danger)' }}>
                        Delete
                      </button>
                    ))}
                </Td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {editing && (
        <Drawer title={editing === 'new' ? 'New Contract' : 'Edit Contract'} onClose={() => setEditing(null)}>
          <ContractForm
            initial={editing === 'new' ? null : editing}
            clients={clients}
            opportunities={opportunities}
            defaultClientId={null}
            onSave={handleSave}
            onCancel={() => setEditing(null)}
          />
        </Drawer>
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

const linkBtn: CSSProperties = {
  background: 'none',
  border: 'none',
  color: 'var(--green)',
  cursor: 'pointer',
  fontWeight: 500,
}
