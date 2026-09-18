import { useEffect, useState, type CSSProperties, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../lib/auth'
import Drawer from '../../components/Drawer'
import ClientForm from './ClientForm'
import ExcelImportExport from './ExcelImportExport'
import { CLIENT_TYPES, type Client, type ClientInput } from './types'

export default function ClientsPage() {
  const { profile, isAdmin } = useAuth()
  const canWrite = isAdmin || profile?.crm_role === 'Sales'

  const [clients, setClients] = useState<Client[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showDeleted, setShowDeleted] = useState(false)
  const [search, setSearch] = useState('')
  const [editing, setEditing] = useState<Client | null | 'new'>(null)
  const [unlinkedCount, setUnlinkedCount] = useState(0)
  const [groupByType, setGroupByType] = useState(false)

  async function loadUnlinkedCount() {
    const [audits, opps] = await Promise.all([
      supabase.from('audits').select('id', { count: 'exact', head: true }).is('client_id', null).not('customer', 'is', null).is('deleted_at', null),
      supabase.from('opportunities').select('id', { count: 'exact', head: true }).is('client_id', null).not('customer', 'is', null).is('deleted_at', null),
    ])
    setUnlinkedCount((audits.count ?? 0) + (opps.count ?? 0))
  }

  async function load() {
    setLoading(true)
    setError(null)
    let query = supabase.from('clients').select('*').order('name')
    query = showDeleted ? query.not('deleted_at', 'is', null) : query.is('deleted_at', null)
    const { data, error } = await query
    if (error) setError(error.message)
    else setClients((data ?? []) as Client[])
    setLoading(false)
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showDeleted])

  useEffect(() => {
    if (isAdmin) loadUnlinkedCount()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin])

  async function handleSave(input: ClientInput) {
    if (editing && editing !== 'new') {
      const { error } = await supabase.from('clients').update(input).eq('id', editing.id)
      if (error) throw error
    } else {
      const { error } = await supabase.from('clients').insert(input)
      if (error) throw error
    }
    setEditing(null)
    await load()
  }

  async function softDelete(client: Client) {
    if (!confirm(`Delete "${client.name}"? This can be restored later.`)) return
    const { data: userData } = await supabase.auth.getUser()
    const { error } = await supabase
      .from('clients')
      .update({ deleted_at: new Date().toISOString(), deleted_by: userData.user?.id ?? null })
      .eq('id', client.id)
    if (error) setError(error.message)
    else await load()
  }

  async function restore(client: Client) {
    const { error } = await supabase
      .from('clients')
      .update({ deleted_at: null, deleted_by: null })
      .eq('id', client.id)
    if (error) setError(error.message)
    else await load()
  }

  const filtered = clients.filter((c) => c.name.toLowerCase().includes(search.toLowerCase()))

  const grouped = groupByType
    ? Array.from(
        filtered
          .reduce((map, c) => {
            const key = c.type ?? 'Unspecified'
            if (!map.has(key)) map.set(key, [])
            map.get(key)!.push(c)
            return map
          }, new Map<string, Client[]>())
          .entries(),
      ).sort((a, b) => {
        const order = [...CLIENT_TYPES]
        const ai = order.indexOf(a[0] as (typeof order)[number])
        const bi = order.indexOf(b[0] as (typeof order)[number])
        return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi)
      })
    : null

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h1>Clients</h1>
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
            + New Client
          </button>
        )}
      </div>

      <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem', alignItems: 'center' }}>
        <input
          placeholder="Search by name…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ padding: '0.5rem', border: '1px solid var(--border)', borderRadius: 6, width: 260 }}
        />
        <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--muted)' }}>
          <input type="checkbox" checked={showDeleted} onChange={(e) => setShowDeleted(e.target.checked)} />
          Show deleted
        </label>
      </div>

      {isAdmin && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
          <ExcelImportExport onImported={load} />
          <Link to="/admin/omni-clients" style={{ color: 'var(--green)', fontSize: '9pt', fontWeight: 500 }}>
            Import clients from OMNI →
          </Link>
        </div>
      )}

      {isAdmin && unlinkedCount > 0 && (
        <div
          style={{
            background: '#fff7e6',
            border: '1px solid var(--warn)',
            borderRadius: 10,
            padding: '0.75rem',
            marginBottom: '1rem',
            color: 'var(--warn)',
            fontSize: '9pt',
          }}
        >
          {unlinkedCount} audit/opportunity record{unlinkedCount === 1 ? '' : 's'} couldn't be auto-linked to a
          client.{' '}
          <Link to="/admin/unlinked" style={{ color: 'var(--warn)', fontWeight: 600 }}>
            Review unlinked records →
          </Link>
        </div>
      )}

      {error && <div style={{ color: 'var(--danger)', marginBottom: '1rem' }}>{error}</div>}

      {!loading && filtered.length > 0 && (
        <div className="group-toggle-row">
          <button
            onClick={() => setGroupByType(false)}
            style={{
              ...toggleBtn,
              background: !groupByType ? 'var(--green)' : 'var(--surface)',
              color: !groupByType ? '#fff' : 'var(--ink)',
              borderColor: !groupByType ? 'var(--green)' : 'var(--border)',
            }}
          >
            No grouping
          </button>
          <button
            onClick={() => setGroupByType(true)}
            style={{
              ...toggleBtn,
              background: groupByType ? 'var(--green)' : 'var(--surface)',
              color: groupByType ? '#fff' : 'var(--ink)',
              borderColor: groupByType ? 'var(--green)' : 'var(--border)',
            }}
          >
            Group by type
          </button>
        </div>
      )}

      {loading ? (
        <p style={{ color: 'var(--muted)' }}>Loading…</p>
      ) : filtered.length === 0 ? (
        <p style={{ color: 'var(--muted)' }}>
          {showDeleted ? 'No deleted clients.' : 'No clients yet. Add the first one above.'}
        </p>
      ) : grouped ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {grouped.map(([type, rows]) => (
            <details key={type} open style={{ border: '1px solid var(--border)', borderRadius: 10, background: 'var(--surface)' }}>
              <summary className="disclosure" style={{ cursor: 'pointer', padding: '0.7rem 0.9rem', fontWeight: 600 }}>
                <span className="chevron">▶</span>
                {type} <span style={{ fontWeight: 400, color: 'var(--muted)', fontSize: '9pt' }}>({rows.length})</span>
              </summary>
              <div className="table-scroll">
                <ClientsTable rows={rows} canWrite={canWrite} showDeleted={showDeleted} onRestore={restore} onDelete={softDelete} />
              </div>
            </details>
          ))}
        </div>
      ) : (
        <div className="table-scroll">
          <ClientsTable rows={filtered} canWrite={canWrite} showDeleted={showDeleted} onRestore={restore} onDelete={softDelete} />
        </div>
      )}

      {editing && (
        <Drawer title={editing === 'new' ? 'New Client' : 'Edit Client'} onClose={() => setEditing(null)}>
          <ClientForm
            initial={editing === 'new' ? null : editing}
            onSave={handleSave}
            onCancel={() => setEditing(null)}
          />
        </Drawer>
      )}
    </div>
  )
}

function ClientsTable({
  rows,
  canWrite,
  showDeleted,
  onRestore,
  onDelete,
}: {
  rows: Client[]
  canWrite: boolean
  showDeleted: boolean
  onRestore: (c: Client) => void
  onDelete: (c: Client) => void
}) {
  return (
    <table style={{ width: '100%', borderCollapse: 'collapse', background: 'var(--surface)' }}>
      <thead>
        <tr style={{ textAlign: 'left', borderBottom: '2px solid var(--border)' }}>
          <Th>Name</Th>
          <Th>Type</Th>
          <Th>Region</Th>
          <Th>Country</Th>
          <Th></Th>
        </tr>
      </thead>
      <tbody>
        {rows.map((c) => (
          <tr key={c.id} style={{ borderBottom: '1px solid var(--border)' }}>
            <Td>
              <Link to={`/clients/${c.id}`} style={{ color: 'var(--green)', fontWeight: 600, textDecoration: 'none' }}>
                {c.name}
              </Link>
              {c.omni_code && (
                <span
                  title={`Linked to OMNI account ${c.omni_code}`}
                  style={{
                    marginLeft: '0.4rem',
                    fontSize: '7.5pt',
                    fontWeight: 700,
                    color: 'var(--green-dark)',
                    border: '1px solid var(--green)',
                    borderRadius: 999,
                    padding: '0.05rem 0.4rem',
                    verticalAlign: 'middle',
                  }}
                >
                  OMNI
                </span>
              )}
            </Td>
            <Td>
              {c.type && (
                <span
                  style={{
                    background: 'var(--green-light)',
                    color: 'var(--green-dark)',
                    padding: '0.15rem 0.5rem',
                    borderRadius: 999,
                    fontSize: '9pt',
                  }}
                >
                  {c.type}
                </span>
              )}
            </Td>
            <Td>{c.region ?? '—'}</Td>
            <Td>{c.country ?? '—'}</Td>
            <Td>
              {canWrite &&
                (showDeleted ? (
                  <button onClick={() => onRestore(c)} style={linkBtn}>
                    Restore
                  </button>
                ) : (
                  <button onClick={() => onDelete(c)} style={{ ...linkBtn, color: 'var(--danger)' }}>
                    Delete
                  </button>
                ))}
            </Td>
          </tr>
        ))}
      </tbody>
    </table>
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
  textDecoration: 'none',
}

const toggleBtn: CSSProperties = {
  padding: '0.5rem 0.8rem',
  borderRadius: 8,
  border: '1px solid var(--border)',
  fontWeight: 500,
}
