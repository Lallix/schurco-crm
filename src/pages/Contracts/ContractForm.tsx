import { useState, type CSSProperties, type FormEvent, type ReactNode } from 'react'
import { CONTRACT_STATUSES, type Contract, type ContractInput } from './types'

export default function ContractForm({
  initial,
  clients,
  opportunities,
  defaultClientId,
  onSave,
  onCancel,
}: {
  initial: Contract | null
  clients: { id: string; name: string }[]
  opportunities: { id: string; title: string | null; client_id: string | null }[]
  defaultClientId: string | null
  onSave: (input: ContractInput, file: File | null) => Promise<void>
  onCancel: () => void
}) {
  const [clientId, setClientId] = useState(initial?.client_id ?? defaultClientId ?? '')
  const [opportunityId, setOpportunityId] = useState(initial?.opportunity_id ?? '')
  const [contractType, setContractType] = useState(initial?.contract_type ?? '')
  const [status, setStatus] = useState<Contract['status']>(initial?.status ?? 'Draft')
  const [startDate, setStartDate] = useState(initial?.start_date ?? '')
  const [endDate, setEndDate] = useState(initial?.end_date ?? '')
  const [noticePeriod, setNoticePeriod] = useState(initial?.termination_notice_period ?? '')
  const [hasTfc, setHasTfc] = useState(initial?.has_termination_for_convenience_clause ?? false)
  const [tfcNotes, setTfcNotes] = useState(initial?.termination_clause_notes ?? '')
  const [file, setFile] = useState<File | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const relevantOpportunities = opportunities.filter((o) => !clientId || o.client_id === clientId)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    try {
      await onSave(
        {
          client_id: clientId,
          opportunity_id: opportunityId || null,
          contract_type: contractType.trim(),
          status: status ?? 'Draft',
          start_date: startDate || null,
          end_date: endDate || null,
          termination_notice_period: noticePeriod.trim(),
          has_termination_for_convenience_clause: hasTfc,
          termination_clause_notes: tfcNotes.trim(),
        },
        file,
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save contract')
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

      <Field label="Linked opportunity (optional)">
        <select value={opportunityId} onChange={(e) => setOpportunityId(e.target.value)} style={inputStyle}>
          <option value="">—</option>
          {relevantOpportunities.map((o) => (
            <option key={o.id} value={o.id}>
              {o.title || '(untitled)'}
            </option>
          ))}
        </select>
      </Field>

      <Field label="Contract type">
        <input
          value={contractType}
          onChange={(e) => setContractType(e.target.value)}
          placeholder="e.g. NEC3 Option A, NEC4 Supply"
          style={inputStyle}
        />
      </Field>

      <Field label="Status">
        <select value={status ?? 'Draft'} onChange={(e) => setStatus(e.target.value as Contract['status'])} style={inputStyle}>
          {CONTRACT_STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </Field>

      <div style={{ display: 'flex', gap: '0.75rem' }}>
        <Field label="Start date">
          <input type="date" value={startDate ?? ''} onChange={(e) => setStartDate(e.target.value)} style={inputStyle} />
        </Field>
        <Field label="End date">
          <input type="date" value={endDate ?? ''} onChange={(e) => setEndDate(e.target.value)} style={inputStyle} />
        </Field>
      </div>

      <Field label="Termination notice period">
        <input
          value={noticePeriod}
          onChange={(e) => setNoticePeriod(e.target.value)}
          placeholder="e.g. 30 days written notice"
          style={inputStyle}
        />
      </Field>

      <div
        style={{
          background: 'var(--green-light)',
          border: '1px solid var(--green)',
          borderRadius: 8,
          padding: '0.75rem',
          marginBottom: '0.9rem',
        }}
      >
        <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 600 }}>
          <input type="checkbox" checked={hasTfc} onChange={(e) => setHasTfc(e.target.checked)} />
          Termination-for-convenience clause present
        </label>
        <textarea
          value={tfcNotes}
          onChange={(e) => setTfcNotes(e.target.value)}
          rows={2}
          placeholder="Notes on the termination-for-convenience clause…"
          style={{ ...inputStyle, resize: 'vertical', marginTop: '0.5rem' }}
        />
      </div>

      <Field label={initial?.document_path ? 'Replace document' : 'Document'}>
        <input type="file" onChange={(e) => setFile(e.target.files?.[0] ?? null)} style={inputStyle} />
        {initial?.document_path && !file && (
          <div style={{ fontSize: '8pt', color: 'var(--muted)', marginTop: '0.25rem' }}>
            A document is already attached. Choose a file to replace it.
          </div>
        )}
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
