import { useState, type CSSProperties, type FormEvent, type ReactNode } from 'react'
import { supabase } from '../../lib/supabase'
import type { CrmRole } from '../../lib/auth'
import type { JobTitle } from './types'

const CRM_ROLES: Exclude<CrmRole, null>[] = ['Admin', 'Sales', 'Finance', 'Viewer']

export default function AddTeamMemberForm({
  jobTitles,
  onDone,
  onCancel,
}: {
  jobTitles: JobTitle[]
  onDone: () => Promise<void>
  onCancel: () => void
}) {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [crmRole, setCrmRole] = useState('')
  const [jobTitleId, setJobTitleId] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    try {
      const { data: inviteData, error: inviteError } = await supabase.functions.invoke('invite-user', {
        body: { email: email.trim(), name: name.trim() },
      })
      if (inviteError) throw new Error(inviteError.message)
      if (inviteData?.error) throw new Error(inviteData.error)

      const newId = inviteData.id as string

      const { data: hq } = await supabase.from('organisations').select('id').eq('type', 'schurco').limit(1).single()

      const { error: updateError } = await supabase
        .from('profiles')
        .update({
          crm_role: crmRole || null,
          job_title_id: jobTitleId || null,
          org_id: hq?.id ?? null,
        })
        .eq('id', newId)
      if (updateError) throw updateError

      await onDone()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add team member')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <p style={{ color: 'var(--muted)', fontSize: '9pt', marginTop: 0 }}>
        Sends an email invite — they'll set their own password and land in the CRM ready to go. No Microsoft 365
        account needed.
      </p>

      <Field label="Name">
        <input required value={name} onChange={(e) => setName(e.target.value)} style={inputStyle} />
      </Field>

      <Field label="Email">
        <input
          required
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          style={inputStyle}
        />
      </Field>

      <Field label="CRM role (optional, can set later)">
        <select value={crmRole} onChange={(e) => setCrmRole(e.target.value)} style={inputStyle}>
          <option value="">— Unassigned —</option>
          {CRM_ROLES.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>
      </Field>

      <Field label="Job title (optional)">
        <select value={jobTitleId} onChange={(e) => setJobTitleId(e.target.value)} style={inputStyle}>
          <option value="">—</option>
          {jobTitles.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
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
          {saving ? 'Sending invite…' : 'Send invite'}
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
