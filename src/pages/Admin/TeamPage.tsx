import { useEffect, useState, type CSSProperties, type ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../lib/auth'
import type { CrmRole } from '../../lib/auth'
import Drawer from '../../components/Drawer'
import AddTeamMemberForm from './AddTeamMemberForm'

const CRM_ROLES: Exclude<CrmRole, null>[] = ['Admin', 'Sales', 'Finance', 'Viewer']

interface TeamMember {
  id: string
  name: string | null
  email: string | null
  role: string | null
  is_admin: boolean
  crm_role: CrmRole
  deactivated_at: string | null
}

export default function TeamPage() {
  const { isAdmin, session } = useAuth()
  const [members, setMembers] = useState<TeamMember[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)

  async function load() {
    setLoading(true)
    setError(null)
    const { data, error } = await supabase
      .from('profiles')
      .select('id, name, email, role, is_admin, crm_role, deactivated_at')
      .order('name')
    if (error) setError(error.message)
    else setMembers((data ?? []) as TeamMember[])
    setLoading(false)
  }

  useEffect(() => {
    if (isAdmin) load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin])

  if (!isAdmin) return <Navigate to="/" replace />

  async function setCrmRole(id: string, role: string) {
    const { error } = await supabase
      .from('profiles')
      .update({ crm_role: role || null })
      .eq('id', id)
    if (error) setError(error.message)
    else await load()
  }

  async function toggleActive(member: TeamMember) {
    const deactivate = !member.deactivated_at
    const verb = deactivate ? 'Deactivate' : 'Reactivate'
    const warning = deactivate
      ? `${verb} ${member.name || member.email}? This blocks their login to BOTH the CRM and the Site Audit App — they share one account.`
      : `${verb} ${member.name || member.email}? This restores their login to both apps.`
    if (!confirm(warning)) return

    setBusyId(member.id)
    setError(null)
    const { data, error } = await supabase.functions.invoke('deactivate-user', {
      body: { userId: member.id, deactivate },
    })
    if (error) setError(error.message)
    else if (data?.error) setError(data.error)
    setBusyId(null)
    await load()
  }

  const unassigned = members.filter((m) => !m.is_admin && !m.crm_role).length

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1>Team</h1>
        <button
          onClick={() => setAdding(true)}
          style={{
            padding: '0.5rem 1rem',
            background: 'var(--green)',
            color: '#fff',
            border: 'none',
            borderRadius: 8,
            fontWeight: 600,
          }}
        >
          + Add Team Member
        </button>
      </div>

      <p style={{ color: 'var(--muted)' }}>
        Assign each person's CRM role. It's separate from the Site Audit App's admin flag (shown read-only
        below) — changing it here only affects what someone can do inside the CRM. Role is set in the Site Audit
        App's own admin page when a person is created there and shown here read-only.
      </p>

      {unassigned > 0 && (
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
          {unassigned} {unassigned === 1 ? 'person has' : 'people have'} no CRM role yet — they can view most
          screens but can't create or edit anything until assigned.
        </div>
      )}

      {error && <div style={{ color: 'var(--danger)', marginBottom: '1rem' }}>{error}</div>}

      {loading ? (
        <p style={{ color: 'var(--muted)' }}>Loading…</p>
      ) : (
        <div className="table-scroll">
          <table style={{ width: '100%', borderCollapse: 'collapse', background: 'var(--surface)' }}>
            <thead>
              <tr style={{ textAlign: 'left', borderBottom: '2px solid var(--border)' }}>
                <Th>Name</Th>
                <Th>Email</Th>
                <Th>Role</Th>
                <Th>Audit app admin</Th>
                <Th>CRM role</Th>
                <Th>Status</Th>
                <Th></Th>
              </tr>
            </thead>
            <tbody>
              {members.map((m) => (
                <tr
                  key={m.id}
                  style={{ borderBottom: '1px solid var(--border)', opacity: m.deactivated_at ? 0.55 : 1 }}
                >
                  <Td>{m.name || '—'}</Td>
                  <Td>{m.email || '—'}</Td>
                  <Td>{m.role || '—'}</Td>
                  <Td>
                    {m.is_admin ? (
                      <span
                        style={{
                          background: 'var(--green-light)',
                          color: 'var(--green-dark)',
                          padding: '0.15rem 0.5rem',
                          borderRadius: 999,
                          fontSize: '9pt',
                        }}
                      >
                        Admin
                      </span>
                    ) : (
                      '—'
                    )}
                  </Td>
                  <Td>
                    <select
                      value={m.crm_role ?? ''}
                      onChange={(e) => setCrmRole(m.id, e.target.value)}
                      disabled={m.is_admin}
                      title={m.is_admin ? 'Already has full access via the Audit app admin flag' : undefined}
                      style={selectStyle}
                    >
                      <option value="">— Unassigned —</option>
                      {CRM_ROLES.map((r) => (
                        <option key={r} value={r}>
                          {r}
                        </option>
                      ))}
                    </select>
                  </Td>
                  <Td>
                    <span
                      style={{
                        background: m.deactivated_at ? '#fdeaea' : 'var(--green-light)',
                        color: m.deactivated_at ? 'var(--danger)' : 'var(--green-dark)',
                        padding: '0.15rem 0.5rem',
                        borderRadius: 999,
                        fontSize: '9pt',
                      }}
                    >
                      {m.deactivated_at ? 'Deactivated' : 'Active'}
                    </span>
                  </Td>
                  <Td>
                    {m.id !== session?.user.id && (
                      <button
                        onClick={() => toggleActive(m)}
                        disabled={m.is_admin || busyId === m.id}
                        title={m.is_admin ? "Admins can't be deactivated from here" : undefined}
                        style={{ ...secondaryBtn, color: m.deactivated_at ? 'var(--green-dark)' : 'var(--danger)' }}
                      >
                        {m.deactivated_at ? 'Reactivate' : 'Deactivate'}
                      </button>
                    )}
                  </Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {adding && (
        <Drawer title="Add Team Member" onClose={() => setAdding(false)}>
          <AddTeamMemberForm
            onDone={async () => {
              setAdding(false)
              await load()
            }}
            onCancel={() => setAdding(false)}
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

const selectStyle: CSSProperties = {
  padding: '0.4rem',
  border: '1px solid var(--border)',
  borderRadius: 6,
}

const secondaryBtn: CSSProperties = {
  padding: '0.5rem 0.8rem',
  borderRadius: 8,
  border: '1px solid var(--border)',
  background: 'var(--surface)',
  fontWeight: 500,
}
