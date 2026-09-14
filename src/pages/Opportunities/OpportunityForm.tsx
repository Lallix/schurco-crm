import { useState, type CSSProperties, type FormEvent, type ReactNode } from 'react'
import { CONTACT_ROLES } from '../Contacts/types'
import type { LossReason, Opportunity, OpportunityInput, PipelineStage } from './types'

export default function OpportunityForm({
  initial,
  clients,
  stages,
  lossReasons,
  defaultClientId,
  defaultStage,
  onSave,
  onCancel,
}: {
  initial: Opportunity | null
  clients: { id: string; name: string }[]
  stages: PipelineStage[]
  lossReasons: LossReason[]
  defaultClientId: string | null
  defaultStage: string | null
  onSave: (input: OpportunityInput) => Promise<void>
  onCancel: () => void
}) {
  const [clientId, setClientId] = useState(initial?.client_id ?? defaultClientId ?? '')
  const [title, setTitle] = useState(initial?.title ?? '')
  const [value, setValue] = useState(initial?.value ?? '')
  const [stage, setStage] = useState(initial?.stage ?? defaultStage ?? stages[0]?.name ?? '')
  const [owner, setOwner] = useState(initial?.owner ?? '')
  const [closeDate, setCloseDate] = useState(initial?.close_date ?? '')
  const [contactName, setContactName] = useState(initial?.contact_name ?? '')
  const [contactRole, setContactRole] = useState(initial?.contact_role ?? '')
  const [notes, setNotes] = useState(initial?.notes ?? '')
  const [lossReasonId, setLossReasonId] = useState(initial?.loss_reason_id ?? '')
  const [lossNotes, setLossNotes] = useState(initial?.loss_notes ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isLostStage = stages.find((s) => s.name === stage)?.is_lost ?? false

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    try {
      await onSave({
        client_id: clientId || null,
        title: title.trim(),
        value: value.trim(),
        stage,
        owner: owner.trim(),
        close_date: closeDate || null,
        contact_name: contactName.trim(),
        contact_role: contactRole,
        notes: notes.trim(),
        loss_reason_id: isLostStage ? lossReasonId || null : null,
        loss_notes: isLostStage ? lossNotes.trim() : '',
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save opportunity')
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

      <Field label="Title">
        <input required value={title} onChange={(e) => setTitle(e.target.value)} style={inputStyle} />
      </Field>

      <Field label="Stage">
        <select value={stage} onChange={(e) => setStage(e.target.value)} style={inputStyle}>
          {stages.map((s) => (
            <option key={s.id} value={s.name}>
              {s.name}
            </option>
          ))}
        </select>
      </Field>

      {isLostStage && (
        <div
          style={{
            background: '#fdeaea',
            border: '1px solid var(--danger)',
            borderRadius: 8,
            padding: '0.75rem',
            marginBottom: '0.9rem',
          }}
        >
          <Field label="Loss reason">
            <select value={lossReasonId} onChange={(e) => setLossReasonId(e.target.value)} style={inputStyle}>
              <option value="">— Select a reason —</option>
              {lossReasons.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Notes (optional)">
            <textarea
              value={lossNotes}
              onChange={(e) => setLossNotes(e.target.value)}
              rows={2}
              placeholder="Any extra detail on why this was lost…"
              style={{ ...inputStyle, resize: 'vertical' }}
            />
          </Field>
        </div>
      )}

      <Field label="Value (ZAR)">
        <input value={value} onChange={(e) => setValue(e.target.value)} inputMode="decimal" style={inputStyle} />
      </Field>

      <Field label="Owner">
        <input value={owner} onChange={(e) => setOwner(e.target.value)} style={inputStyle} />
      </Field>

      <Field label="Expected close date">
        <input
          type="date"
          value={closeDate ?? ''}
          onChange={(e) => setCloseDate(e.target.value)}
          style={inputStyle}
        />
      </Field>

      <Field label="Contact name">
        <input value={contactName} onChange={(e) => setContactName(e.target.value)} style={inputStyle} />
      </Field>

      <Field label="Contact role">
        <select value={contactRole ?? ''} onChange={(e) => setContactRole(e.target.value)} style={inputStyle}>
          <option value="">—</option>
          {CONTACT_ROLES.map((r) => (
            <option key={r} value={r}>
              {r}
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
