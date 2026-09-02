import { useState, type CSSProperties, type FormEvent, type ReactNode } from 'react'
import { useAuth } from '../../lib/auth'
import { ACTIVITY_STATUSES, ACTIVITY_TYPES, type Activity, type ActivityInput } from './types'

export default function ActivityForm({
  initial,
  clients,
  contacts,
  opportunities,
  users,
  defaultClientId,
  onSave,
  onCancel,
}: {
  initial: Activity | null
  clients: { id: string; name: string }[]
  contacts: { id: string; name: string; client_id: string | null }[]
  opportunities: { id: string; title: string | null; client_id: string | null }[]
  users: { id: string; name: string | null; email: string | null }[]
  defaultClientId: string | null
  onSave: (input: ActivityInput) => Promise<void>
  onCancel: () => void
}) {
  const { session } = useAuth()

  const [clientId, setClientId] = useState(initial?.client_id ?? defaultClientId ?? '')
  const [contactId, setContactId] = useState(initial?.contact_id ?? '')
  const [opportunityId, setOpportunityId] = useState(initial?.opportunity_id ?? '')
  const [type, setType] = useState<Activity['type']>(initial?.type ?? 'Task')
  const [dueDate, setDueDate] = useState(initial?.due_date ?? '')
  const [assignedTo, setAssignedTo] = useState(initial?.assigned_to ?? session?.user.id ?? '')
  const [status, setStatus] = useState<Activity['status']>(initial?.status ?? 'Open')
  const [notes, setNotes] = useState(initial?.notes ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const relevantContacts = contacts.filter((c) => !clientId || c.client_id === clientId)
  const relevantOpportunities = opportunities.filter((o) => !clientId || o.client_id === clientId)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    try {
      await onSave({
        client_id: clientId || null,
        contact_id: contactId || null,
        opportunity_id: opportunityId || null,
        type,
        due_date: dueDate || null,
        assigned_to: assignedTo || null,
        status,
        notes: notes.trim(),
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save activity')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <Field label="Type">
        <select value={type} onChange={(e) => setType(e.target.value as Activity['type'])} style={inputStyle}>
          {ACTIVITY_TYPES.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
      </Field>

      <Field label="Client (optional)">
        <select value={clientId} onChange={(e) => setClientId(e.target.value)} style={inputStyle}>
          <option value="">—</option>
          {clients.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </Field>

      <Field label="Contact (optional)">
        <select value={contactId} onChange={(e) => setContactId(e.target.value)} style={inputStyle}>
          <option value="">—</option>
          {relevantContacts.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </Field>

      <Field label="Opportunity (optional)">
        <select value={opportunityId} onChange={(e) => setOpportunityId(e.target.value)} style={inputStyle}>
          <option value="">—</option>
          {relevantOpportunities.map((o) => (
            <option key={o.id} value={o.id}>
              {o.title || '(untitled)'}
            </option>
          ))}
        </select>
      </Field>

      <div style={{ display: 'flex', gap: '0.75rem' }}>
        <Field label="Due date">
          <input type="date" value={dueDate ?? ''} onChange={(e) => setDueDate(e.target.value)} style={inputStyle} />
        </Field>
        <Field label="Status">
          <select value={status} onChange={(e) => setStatus(e.target.value as Activity['status'])} style={inputStyle}>
            {ACTIVITY_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <Field label="Assigned to">
        <select value={assignedTo ?? ''} onChange={(e) => setAssignedTo(e.target.value)} style={inputStyle}>
          <option value="">—</option>
          {users.map((u) => (
            <option key={u.id} value={u.id}>
              {u.name || u.email || u.id}
            </option>
          ))}
        </select>
      </Field>

      <Field label="Notes">
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          style={{ ...inputStyle, resize: 'vertical' }}
        />
      </Field>

      {error && <div style={{ color: 'var(--danger)', marginBottom: '1rem' }}>{error}</div>}

      <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1.5rem' }}>
        <button
          type="submit"
          disabled={saving}
          style={{
            flex: 1,
            padding: '0.6rem',
            background: 'var(--green)',
            color: '#fff',
            border: 'none',
            borderRadius: 8,
            fontWeight: 600,
          }}
        >
          {saving ? 'Saving…' : 'Save'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          style={{
            padding: '0.6rem 1rem',
            borderRadius: 8,
            border: '1px solid var(--border)',
            background: 'var(--surface)',
          }}
        >
          Cancel
        </button>
      </div>
    </form>
  )
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label style={{ display: 'block', marginBottom: '0.9rem', flex: 1 }}>
      <div style={{ marginBottom: '0.3rem', fontWeight: 500 }}>{label}</div>
      {children}
    </label>
  )
}

const inputStyle: CSSProperties = {
  display: 'block',
  width: '100%',
  padding: '0.5rem',
  border: '1px solid var(--border)',
  borderRadius: 6,
}
