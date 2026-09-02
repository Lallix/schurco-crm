import { useEffect, useState, type CSSProperties, type ReactNode } from 'react'
import { useSearchParams } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../lib/auth'
import Drawer from '../../components/Drawer'
import ContactForm from './ContactForm'
import type { Contact, ContactInput } from './types'

export default function ContactsPage() {
  const { profile, isAdmin } = useAuth()
  const canWrite = isAdmin || profile?.crm_role === 'Sales'

  const [searchParams, setSearchParams] = useSearchParams()
  const clientFilter = searchParams.get('client') ?? ''

  const [contacts, setContacts] = useState<Contact[]>([])
  const [clients, setClients] = useState<{ id: string; name: string }[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showDeleted, setShowDeleted] = useState(false)
  const [search, setSearch] = useState('')
  const [editing, setEditing] = useState<Contact | null | 'new'>(null)

  useEffect(() => {
    supabase
      .from('clients')
      .select('id, name')
      .is('deleted_at', null)
      .order('name')
      .then(({ data }) => setClients(data ?? []))
  }, [])

  async function load() {
    setLoading(true)
    setError(null)
    let query = supabase.from('contacts').select('*, client:clients(id, name)').order('name')
    query = showDeleted ? query.not('deleted_at', 'is', null) : query.is('deleted_at', null)
    if (clientFilter) query = query.eq('client_id', clientFilter)
    const { data, error } = await query
    if (error) setError(error.message)
    else setContacts((data ?? []) as unknown as Contact[])
    setLoading(false)
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showDeleted, clientFilter])

  async function handleSave(input: ContactInput) {
    if (editing && editing !== 'new') {
      const { error } = await supabase.from('contacts').update(input).eq('id', editing.id)
      if (error) throw error
    } else {
      const { error } = await supabase.from('contacts').insert(input)
      if (error) throw error
    }
    setEditing(null)
    await load()
  }

  async function softDelete(contact: Contact) {
    if (!confirm(`Delete "${contact.name}"? This can be restored later.`)) return
    const { data: userData } = await supabase.auth.getUser()
    const { error } = await supabase
      .from('contacts')
      .update({ deleted_at: new Date().toISOString(), deleted_by: userData.user?.id ?? null })
      .eq('id', contact.id)
    if (error) setError(error.message)
    else await load()
  }

  async function restore(contact: Contact) {
    const { error } = await supabase
      .from('contacts')
      .update({ deleted_at: null, deleted_by: null })
      .eq('id', contact.id)
    if (error) setError(error.message)
    else await load()
  }

  const filtered = contacts.filter((c) => c.name.toLowerCase().includes(search.toLowerCase()))
  const filteredClientName = clients.find((c) => c.id === clientFilter)?.name

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h1>Contacts</h1>
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
            + New Contact
          </button>
        )}
      </div>

      <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
        <input
          placeholder="Search by name…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ padding: '0.5rem', border: '1px solid var(--border)', borderRadius: 6, width: 220 }}
        />
        <select
          value={clientFilter}
          onChange={(e) =>
            setSearchParams(e.target.value ? { client: e.target.value } : {}, { replace: true })
          }
          style={{ padding: '0.5rem', border: '1px solid var(--border)', borderRadius: 6 }}
        >
          <option value="">All clients</option>
          {clients.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        {filteredClientName && (
          <span
            style={{
              background: 'var(--green-light)',
              color: 'var(--green-dark)',
              padding: '0.2rem 0.6rem',
              borderRadius: 999,
              fontSize: '9pt',
            }}
          >
            {filteredClientName}
            <button
              onClick={() => setSearchParams({}, { replace: true })}
              style={{ border: 'none', background: 'none', color: 'inherit', marginLeft: '0.4rem', cursor: 'pointer' }}
            >
              ×
            </button>
          </span>
        )}
        <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--muted)' }}>
          <input type="checkbox" checked={showDeleted} onChange={(e) => setShowDeleted(e.target.checked)} />
          Show deleted
        </label>
      </div>

      {error && <div style={{ color: 'var(--danger)', marginBottom: '1rem' }}>{error}</div>}

      {loading ? (
        <p style={{ color: 'var(--muted)' }}>Loading…</p>
      ) : filtered.length === 0 ? (
        <p style={{ color: 'var(--muted)' }}>
          {showDeleted ? 'No deleted contacts.' : 'No contacts yet.'}
        </p>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse', background: 'var(--surface)' }}>
          <thead>
            <tr style={{ textAlign: 'left', borderBottom: '2px solid var(--border)' }}>
              <Th>Name</Th>
              <Th>Client</Th>
              <Th>Role</Th>
              <Th>Email</Th>
              <Th>Phone</Th>
              <Th></Th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((c) => (
              <tr key={c.id} style={{ borderBottom: '1px solid var(--border)' }}>
                <Td>
                  {canWrite ? (
                    <button
                      onClick={() => setEditing(c)}
                      style={{ background: 'none', border: 'none', color: 'var(--green)', fontWeight: 600, padding: 0 }}
                    >
                      {c.name}
                    </button>
                  ) : (
                    c.name
                  )}
                </Td>
                <Td>{c.client?.name ?? '—'}</Td>
                <Td>{c.role ?? '—'}</Td>
                <Td>{c.email ?? '—'}</Td>
                <Td>{c.phone ?? '—'}</Td>
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
        <Drawer title={editing === 'new' ? 'New Contact' : 'Edit Contact'} onClose={() => setEditing(null)}>
          <ContactForm
            initial={editing === 'new' ? null : editing}
            clients={clients}
            defaultClientId={clientFilter || null}
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
