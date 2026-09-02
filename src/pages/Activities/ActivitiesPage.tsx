import { useEffect, useState, type CSSProperties, type ReactNode } from 'react'
import { useSearchParams } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../lib/auth'
import Drawer from '../../components/Drawer'
import ActivityForm from './ActivityForm'
import type { Activity, ActivityInput } from './types'

export default function ActivitiesPage() {
  const { profile, isAdmin, session } = useAuth()
  const canCreate = isAdmin || profile?.crm_role === 'Sales' || profile?.crm_role === 'Finance'

  const [searchParams, setSearchParams] = useSearchParams()
  const clientFilter = searchParams.get('client') ?? ''
  const opportunityFilter = searchParams.get('opportunity') ?? ''

  const [scope, setScope] = useState<'mine' | 'all'>(clientFilter || opportunityFilter ? 'all' : 'mine')
  const [statusFilter, setStatusFilter] = useState<'Open' | 'Done' | 'All'>('Open')

  const [activities, setActivities] = useState<Activity[]>([])
  const [clients, setClients] = useState<{ id: string; name: string }[]>([])
  const [contacts, setContacts] = useState<{ id: string; name: string; client_id: string | null }[]>([])
  const [opportunities, setOpportunities] = useState<{ id: string; title: string | null; client_id: string | null }[]>([])
  const [users, setUsers] = useState<{ id: string; name: string | null; email: string | null }[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [editing, setEditing] = useState<Activity | null | 'new'>(null)

  useEffect(() => {
    supabase.from('clients').select('id, name').is('deleted_at', null).order('name').then(({ data }) => setClients(data ?? []))
    supabase
      .from('contacts')
      .select('id, name, client_id')
      .is('deleted_at', null)
      .then(({ data }) => setContacts(data ?? []))
    supabase
      .from('opportunities')
      .select('id, title, client_id')
      .is('deleted_at', null)
      .then(({ data }) => setOpportunities(data ?? []))
    supabase
      .from('profiles')
      .select('id, name, email')
      .then(({ data }) => setUsers(data ?? []))
  }, [])

  async function load() {
    setLoading(true)
    setError(null)
    let query = supabase
      .from('activities')
      .select('*, client:clients(id, name), contact:contacts(id, name), opportunity:opportunities(id, title)')
      .is('deleted_at', null)
      .order('due_date', { ascending: true, nullsFirst: false })

    if (scope === 'mine') query = query.eq('assigned_to', session?.user.id)
    if (clientFilter) query = query.eq('client_id', clientFilter)
    if (opportunityFilter) query = query.eq('opportunity_id', opportunityFilter)
    if (statusFilter !== 'All') query = query.eq('status', statusFilter)

    const { data, error } = await query
    if (error) setError(error.message)
    else setActivities((data ?? []) as unknown as Activity[])
    setLoading(false)
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scope, statusFilter, clientFilter, opportunityFilter, session?.user.id])

  function canEdit(a: Activity) {
    return isAdmin || a.created_by === session?.user.id || a.assigned_to === session?.user.id
  }

  async function handleSave(input: ActivityInput) {
    if (editing && editing !== 'new') {
      const { error } = await supabase.from('activities').update(input).eq('id', editing.id)
      if (error) throw error
    } else {
      const { error } = await supabase.from('activities').insert({ ...input, created_by: session?.user.id })
      if (error) throw error
    }
    setEditing(null)
    await load()
  }

  async function toggleDone(a: Activity) {
    const { error } = await supabase
      .from('activities')
      .update({ status: a.status === 'Open' ? 'Done' : 'Open' })
      .eq('id', a.id)
    if (error) setError(error.message)
    else await load()
  }

  const clearLinkFilter = () => setSearchParams({}, { replace: true })

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h1>Activities</h1>
        {canCreate && (
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
            + New Activity
          </button>
        )}
      </div>

      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <Toggle active={scope === 'mine'} onClick={() => setScope('mine')}>
          My tasks
        </Toggle>
        <Toggle active={scope === 'all'} onClick={() => setScope('all')}>
          All activity
        </Toggle>

        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)} style={selectStyle}>
          <option value="Open">Open</option>
          <option value="Done">Done</option>
          <option value="All">All statuses</option>
        </select>

        {(clientFilter || opportunityFilter) && (
          <span
            style={{
              background: 'var(--green-light)',
              color: 'var(--green-dark)',
              padding: '0.2rem 0.6rem',
              borderRadius: 999,
              fontSize: '9pt',
            }}
          >
            {clientFilter ? clients.find((c) => c.id === clientFilter)?.name : opportunities.find((o) => o.id === opportunityFilter)?.title}
            <button onClick={clearLinkFilter} style={{ border: 'none', background: 'none', color: 'inherit', marginLeft: '0.4rem', cursor: 'pointer' }}>
              ×
            </button>
          </span>
        )}
      </div>

      {error && <div style={{ color: 'var(--danger)', marginBottom: '1rem' }}>{error}</div>}

      {loading ? (
        <p style={{ color: 'var(--muted)' }}>Loading…</p>
      ) : activities.length === 0 ? (
        <p style={{ color: 'var(--muted)' }}>Nothing here.</p>
      ) : (
        <div>
          {activities.map((a) => (
            <div
              key={a.id}
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: '0.75rem',
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                borderRadius: 10,
                padding: '0.75rem',
                marginBottom: '0.5rem',
                opacity: a.status === 'Done' ? 0.6 : 1,
              }}
            >
              <input
                type="checkbox"
                checked={a.status === 'Done'}
                disabled={!canEdit(a)}
                onChange={() => toggleDone(a)}
                style={{ marginTop: '0.2rem' }}
              />
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                  <span
                    style={{
                      fontSize: '8pt',
                      background: 'var(--green-light)',
                      color: 'var(--green-dark)',
                      padding: '0.1rem 0.4rem',
                      borderRadius: 999,
                    }}
                  >
                    {a.type}
                  </span>
                  <strong style={{ textDecoration: a.status === 'Done' ? 'line-through' : 'none' }}>
                    {a.client?.name || a.opportunity?.title || a.contact?.name || 'Unlinked'}
                  </strong>
                  {a.due_date && <span style={{ fontSize: '9pt', color: 'var(--muted)' }}>Due {a.due_date}</span>}
                </div>
                {a.notes && <p style={{ margin: '0.35rem 0 0', fontSize: '9pt' }}>{a.notes}</p>}
                <div style={{ fontSize: '8pt', color: 'var(--muted)', marginTop: '0.3rem' }}>
                  Assigned to {users.find((u) => u.id === a.assigned_to)?.name ?? '—'}
                </div>
              </div>
              {canEdit(a) && (
                <button onClick={() => setEditing(a)} style={{ ...linkBtn }}>
                  Edit
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {editing && (
        <Drawer title={editing === 'new' ? 'New Activity' : 'Edit Activity'} onClose={() => setEditing(null)}>
          <ActivityForm
            initial={editing === 'new' ? null : editing}
            clients={clients}
            contacts={contacts}
            opportunities={opportunities}
            users={users}
            defaultClientId={clientFilter || null}
            onSave={handleSave}
            onCancel={() => setEditing(null)}
          />
        </Drawer>
      )}
    </div>
  )
}

function Toggle({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '0.45rem 0.9rem',
        borderRadius: 8,
        border: '1px solid var(--border)',
        background: active ? 'var(--green)' : 'var(--surface)',
        color: active ? '#fff' : 'var(--ink)',
        fontWeight: 500,
      }}
    >
      {children}
    </button>
  )
}

const selectStyle: CSSProperties = {
  padding: '0.5rem',
  border: '1px solid var(--border)',
  borderRadius: 6,
}

const linkBtn: CSSProperties = {
  background: 'none',
  border: 'none',
  color: 'var(--green)',
  cursor: 'pointer',
  fontWeight: 500,
}
