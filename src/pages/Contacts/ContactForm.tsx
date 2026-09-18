import { useState, type CSSProperties, type FormEvent, type ReactNode } from 'react'
import { CONTACT_ROLES, type Contact, type ContactInput } from './types'

const KNOWN_ROLES: readonly string[] = CONTACT_ROLES

function isKnownRole(role: string) {
  return role !== 'Other' && KNOWN_ROLES.includes(role)
}

export default function ContactForm({
  initial,
  clients,
  defaultClientId,
  onSave,
  onCancel,
}: {
  initial: Contact | null
  clients: { id: string; name: string }[]
  defaultClientId: string | null
  onSave: (input: ContactInput) => Promise<void>
  onCancel: () => void
}) {
  const [clientId, setClientId] = useState(initial?.client_id ?? defaultClientId ?? '')
  const [name, setName] = useState(initial?.name ?? '')
  const [role, setRole] = useState<string>(() => {
    if (!initial?.role) return ''
    return isKnownRole(initial.role) ? initial.role : 'Other'
  })
  const [customRole, setCustomRole] = useState<string>(() =>
    initial?.role && !isKnownRole(initial.role) ? initial.role : '',
  )
  const [email, setEmail] = useState(initial?.email ?? '')
  const [phone, setPhone] = useState(initial?.phone ?? '')
  const [notes, setNotes] = useState(initial?.notes ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    try {
      await onSave({
        client_id: clientId || null,
        name: name.trim(),
        role: role === 'Other' ? customRole.trim() || 'Other' : role || null,
        email: email.trim() || null,
        phone: phone.trim() || null,
        notes: notes.trim() || null,
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save contact')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <Field label="Client">
        <select required value={clientId} onChange={(e) => setClientId(e.target.value)} style={inputStyle}>
          <option value="" disabled>
            Select a client…
          </option>
          {clients.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </Field>

      <Field label="Name">
        <input required value={name} onChange={(e) => setName(e.target.value)} style={inputStyle} />
      </Field>

      <Field label="Role">
        <select value={role} onChange={(e) => setRole(e.target.value)} style={inputStyle}>
          <option value="">—</option>
          {CONTACT_ROLES.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>
      </Field>

      {role === 'Other' && (
        <Field label="Specify role">
          <input
            value={customRole}
            onChange={(e) => setCustomRole(e.target.value)}
            placeholder="e.g. Diesel Mechanic"
            style={inputStyle}
          />
        </Field>
      )}

      <Field label="Email">
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} style={inputStyle} />
      </Field>

      <Field label="Phone">
        <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} style={inputStyle} />
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
    <label style={{ display: 'block', marginBottom: '0.9rem' }}>
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
