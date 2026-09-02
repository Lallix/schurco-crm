import { useState, type CSSProperties, type FormEvent, type ReactNode } from 'react'
import { CLIENT_TYPES, type Client, type ClientInput } from './types'

export default function ClientForm({
  initial,
  onSave,
  onCancel,
}: {
  initial: Client | null
  onSave: (input: ClientInput) => Promise<void>
  onCancel: () => void
}) {
  const [name, setName] = useState(initial?.name ?? '')
  const [type, setType] = useState<Client['type']>(initial?.type ?? 'Customer')
  const [country, setCountry] = useState(initial?.country ?? '')
  const [region, setRegion] = useState(initial?.region ?? '')
  const [address, setAddress] = useState(initial?.address ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    try {
      await onSave({
        name: name.trim(),
        type,
        country: country.trim() || null,
        region: region.trim() || null,
        address: address.trim() || null,
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save client')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <Field label="Name">
        <input required value={name} onChange={(e) => setName(e.target.value)} style={inputStyle} />
      </Field>

      <Field label="Type">
        <select
          value={type ?? ''}
          onChange={(e) => setType(e.target.value as Client['type'])}
          style={inputStyle}
        >
          {CLIENT_TYPES.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
      </Field>

      <Field label="Country">
        <input value={country} onChange={(e) => setCountry(e.target.value)} style={inputStyle} />
      </Field>

      <Field label="Region">
        <input value={region} onChange={(e) => setRegion(e.target.value)} style={inputStyle} />
      </Field>

      <Field label="Head office address">
        <textarea
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          rows={3}
          placeholder="Company HQ — individual site addresses are captured per audit in the Site Audit App"
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
