import { useEffect, useState, type CSSProperties, type ReactNode } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../lib/auth'
import { formatZAR } from '../../lib/format'
import Drawer from '../../components/Drawer'
import ClientForm from './ClientForm'
import type { Client, ClientInput } from './types'
import ContactForm from '../Contacts/ContactForm'
import type { Contact, ContactInput } from '../Contacts/types'
import OpportunityForm from '../Opportunities/OpportunityForm'
import type { Opportunity, OpportunityInput, PipelineStage } from '../Opportunities/types'
import ContractForm from '../Contracts/ContractForm'
import type { Contract, ContractInput } from '../Contracts/types'
import ActivityForm from '../Activities/ActivityForm'
import type { Activity, ActivityInput } from '../Activities/types'

interface AuditRow {
  id: string
  site: string | null
  region: string | null
  country: string | null
  date: string | null
  status: string | null
  pumpCount: number
}

export default function ClientDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { profile, isAdmin, session } = useAuth()
  const canWriteClient = isAdmin || profile?.crm_role === 'Sales'
  const canWriteContract = isAdmin || profile?.crm_role === 'Finance'
  const canLogActivity = isAdmin || ['Sales', 'Finance'].includes(profile?.crm_role ?? '')

  const [client, setClient] = useState<Client | null>(null)
  const [contacts, setContacts] = useState<Contact[]>([])
  const [opportunities, setOpportunities] = useState<Opportunity[]>([])
  const [contracts, setContracts] = useState<Contract[]>([])
  const [activities, setActivities] = useState<Activity[]>([])
  const [audits, setAudits] = useState<AuditRow[]>([])
  const [stages, setStages] = useState<PipelineStage[]>([])
  const [users, setUsers] = useState<{ id: string; name: string | null; email: string | null }[]>([])

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [editingClient, setEditingClient] = useState(false)
  const [editingContact, setEditingContact] = useState<Contact | null | 'new'>(null)
  const [editingOpp, setEditingOpp] = useState<Opportunity | null | 'new'>(null)
  const [editingContract, setEditingContract] = useState<Contract | null | 'new'>(null)
  const [editingActivity, setEditingActivity] = useState<Activity | null | 'new'>(null)

  async function load() {
    if (!id) return
    setLoading(true)
    setError(null)

    const [clientRes, contactsRes, oppsRes, contractsRes, activitiesRes, auditsRes, stagesRes, usersRes] =
      await Promise.all([
        supabase.from('clients').select('*').eq('id', id).single(),
        supabase.from('contacts').select('*').eq('client_id', id).is('deleted_at', null).order('name'),
        supabase
          .from('opportunities')
          .select('*, audit:audits(id, site, customer)')
          .eq('client_id', id)
          .is('deleted_at', null)
          .order('created_at', { ascending: false }),
        supabase
          .from('contracts')
          .select('*')
          .eq('client_id', id)
          .is('deleted_at', null)
          .order('end_date'),
        supabase
          .from('activities')
          .select('*, contact:contacts(id, name), opportunity:opportunities(id, title)')
          .eq('client_id', id)
          .is('deleted_at', null)
          .order('due_date', { ascending: true, nullsFirst: false }),
        supabase
          .from('audits')
          .select('id, site, region, country, date, status')
          .eq('client_id', id)
          .is('deleted_at', null)
          .order('date', { ascending: false }),
        supabase.from('pipeline_stages').select('*').is('deleted_at', null).order('sort_order'),
        supabase.from('profiles').select('id, name, email'),
      ])

    if (clientRes.error) {
      setError(clientRes.error.message)
      setLoading(false)
      return
    }
    setClient(clientRes.data as Client)
    setContacts((contactsRes.data ?? []) as Contact[])
    setOpportunities((oppsRes.data ?? []) as unknown as Opportunity[])
    setContracts((contractsRes.data ?? []) as Contract[])
    setActivities((activitiesRes.data ?? []) as unknown as Activity[])
    setStages((stagesRes.data ?? []) as PipelineStage[])
    setUsers(usersRes.data ?? [])

    const auditRows = (auditsRes.data ?? []) as Omit<AuditRow, 'pumpCount'>[]
    if (auditRows.length > 0) {
      const { data: pumps } = await supabase
        .from('pumps')
        .select('audit_id')
        .in(
          'audit_id',
          auditRows.map((a) => a.id),
        )
        .is('deleted_at', null)
      const counts = new Map<string, number>()
      for (const p of pumps ?? []) counts.set(p.audit_id, (counts.get(p.audit_id) ?? 0) + 1)
      setAudits(auditRows.map((a) => ({ ...a, pumpCount: counts.get(a.id) ?? 0 })))
    } else {
      setAudits([])
    }

    setLoading(false)
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  const clientOption = client ? [{ id: client.id, name: client.name }] : []

  async function saveClient(input: ClientInput) {
    if (!id) return
    const { error } = await supabase.from('clients').update(input).eq('id', id)
    if (error) throw error
    setEditingClient(false)
    await load()
  }

  async function softDeleteClient() {
    if (!id || !client) return
    if (!confirm(`Delete "${client.name}"? This can be restored later from the Clients list.`)) return
    const { data: userData } = await supabase.auth.getUser()
    const { error } = await supabase
      .from('clients')
      .update({ deleted_at: new Date().toISOString(), deleted_by: userData.user?.id ?? null })
      .eq('id', id)
    if (error) setError(error.message)
    else navigate('/clients')
  }

  async function saveContact(input: ContactInput) {
    if (editingContact && editingContact !== 'new') {
      const { error } = await supabase.from('contacts').update(input).eq('id', editingContact.id)
      if (error) throw error
    } else {
      const { error } = await supabase.from('contacts').insert(input)
      if (error) throw error
    }
    setEditingContact(null)
    await load()
  }

  async function saveOpportunity(input: OpportunityInput) {
    if (editingOpp && editingOpp !== 'new') {
      const { error } = await supabase
        .from('opportunities')
        .update({ ...input, customer: client?.name })
        .eq('id', editingOpp.id)
      if (error) throw error
    } else {
      const { error } = await supabase.from('opportunities').insert({
        id: crypto.randomUUID(),
        user_id: session?.user.id,
        ...input,
        customer: client?.name,
      })
      if (error) throw error
    }
    setEditingOpp(null)
    await load()
  }

  async function saveContract(input: ContractInput, file: File | null) {
    let contractId = editingContract !== 'new' ? editingContract?.id : undefined
    if (editingContract === 'new') {
      const { data, error } = await supabase.from('contracts').insert(input).select('id').single()
      if (error) throw error
      contractId = data.id
    } else if (editingContract) {
      const { error } = await supabase.from('contracts').update(input).eq('id', editingContract.id)
      if (error) throw error
    }
    if (file && contractId) {
      if (editingContract !== 'new' && editingContract?.document_path) {
        await supabase.storage.from('contracts').remove([editingContract.document_path])
      }
      const path = `${contractId}/${file.name}`
      const { error: uploadError } = await supabase.storage.from('contracts').upload(path, file, { upsert: true })
      if (uploadError) throw uploadError
      await supabase.from('contracts').update({ document_path: path }).eq('id', contractId)
    }
    setEditingContract(null)
    await load()
  }

  async function saveActivity(input: ActivityInput) {
    if (editingActivity && editingActivity !== 'new') {
      const { error } = await supabase.from('activities').update(input).eq('id', editingActivity.id)
      if (error) throw error
    } else {
      const { error } = await supabase.from('activities').insert({ ...input, created_by: session?.user.id })
      if (error) throw error
    }
    setEditingActivity(null)
    await load()
  }

  if (loading) return <p style={{ color: 'var(--muted)' }}>Loading…</p>
  if (error || !client) {
    return (
      <div>
        <Link to="/clients" style={{ color: 'var(--green)' }}>
          ← Back to Clients
        </Link>
        <p style={{ color: 'var(--danger)', marginTop: '1rem' }}>{error ?? 'Client not found.'}</p>
      </div>
    )
  }

  return (
    <div>
      <Link to="/clients" style={{ color: 'var(--green)', fontSize: '9pt' }}>
        ← Back to Clients
      </Link>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginTop: '0.5rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <h1 style={{ marginBottom: 0 }}>{client.name}</h1>
            {client.type && (
              <span
                style={{
                  background: 'var(--green-light)',
                  color: 'var(--green-dark)',
                  padding: '0.15rem 0.6rem',
                  borderRadius: 999,
                  fontSize: '9pt',
                }}
              >
                {client.type}
              </span>
            )}
          </div>
          <p style={{ color: 'var(--muted)', margin: '0.4rem 0 0', fontSize: '9pt' }}>
            {[client.region, client.country].filter(Boolean).join(' · ') || 'No region/country set'}
          </p>
          {client.address && (
            <p style={{ color: 'var(--muted)', margin: '0.2rem 0 0', fontSize: '9pt', whiteSpace: 'pre-line' }}>
              {client.address}
            </p>
          )}
          {client.updated_by && (
            <p style={{ color: 'var(--muted)', margin: '0.4rem 0 0', fontSize: '8pt' }}>
              Last edited by {users.find((u) => u.id === client.updated_by)?.name ?? 'someone'} on{' '}
              {new Date(client.updated_at).toLocaleString()}
            </p>
          )}
        </div>
        {canWriteClient && (
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button onClick={() => setEditingClient(true)} style={secondaryBtn}>
              Edit
            </button>
            <button onClick={softDeleteClient} style={{ ...secondaryBtn, color: 'var(--danger)' }}>
              Delete
            </button>
          </div>
        )}
      </div>

      <div className="two-col-grid" style={{ marginTop: '1.5rem' }}>
        <Panel
          title="Contacts"
          action={canWriteClient ? () => setEditingContact('new') : undefined}
        >
          {contacts.length === 0 ? (
            <Empty />
          ) : (
            contacts.map((c) => (
              <Row key={c.id} onClick={canWriteClient ? () => setEditingContact(c) : undefined}>
                <strong>{c.name}</strong>
                <span style={{ color: 'var(--muted)' }}>{c.role ?? '—'}</span>
                <span style={{ color: 'var(--muted)', fontSize: '8pt' }}>{c.email ?? c.phone ?? ''}</span>
              </Row>
            ))
          )}
        </Panel>

        <Panel
          title="Opportunities"
          action={canWriteClient ? () => setEditingOpp('new') : undefined}
        >
          {opportunities.length === 0 ? (
            <Empty />
          ) : (
            opportunities.map((o) => (
              <Row key={o.id} onClick={() => setEditingOpp(o)}>
                <strong>{o.title || '(untitled)'}</strong>
                <span
                  style={{
                    background: 'var(--green-light)',
                    color: 'var(--green-dark)',
                    padding: '0.1rem 0.4rem',
                    borderRadius: 999,
                    fontSize: '8pt',
                  }}
                >
                  {o.stage}
                </span>
                <span style={{ color: 'var(--muted)', fontSize: '8pt' }}>
                  {formatZAR(Number(o.value) || 0)}
                  {o.audit && ` · from audit at ${o.audit.site ?? 'site'}`}
                </span>
              </Row>
            ))
          )}
        </Panel>

        <Panel
          title="Contracts"
          action={canWriteContract ? () => setEditingContract('new') : undefined}
        >
          {contracts.length === 0 ? (
            <Empty />
          ) : (
            contracts.map((c) => (
              <Row key={c.id} onClick={canWriteContract ? () => setEditingContract(c) : undefined}>
                <strong>{c.contract_type || 'Contract'}</strong>
                <span style={{ color: 'var(--muted)' }}>{c.status}</span>
                <span style={{ color: 'var(--muted)', fontSize: '8pt' }}>
                  {c.end_date ? `Ends ${c.end_date}` : 'No end date'}
                  {c.has_termination_for_convenience_clause && (
                    <span style={{ color: 'var(--danger)', fontWeight: 600 }}> · for-convenience clause</span>
                  )}
                </span>
              </Row>
            ))
          )}
        </Panel>

        <Panel
          title="Activities"
          action={canLogActivity ? () => setEditingActivity('new') : undefined}
        >
          {activities.length === 0 ? (
            <Empty />
          ) : (
            activities.map((a) => (
              <Row key={a.id} onClick={() => setEditingActivity(a)}>
                <strong style={{ textDecoration: a.status === 'Done' ? 'line-through' : 'none' }}>{a.type}</strong>
                <span style={{ color: 'var(--muted)' }}>{a.due_date ?? 'no due date'}</span>
                <span style={{ color: 'var(--muted)', fontSize: '8pt' }}>{a.notes}</span>
              </Row>
            ))
          )}
        </Panel>
      </div>

      <div style={{ marginTop: '1.25rem' }}>
        <Panel title="Site audits">
          <p style={{ fontSize: '8pt', color: 'var(--muted)', marginTop: 0 }}>
            Captured through the Site Audit App — read-only here.
          </p>
          {audits.length === 0 ? (
            <Empty text="No linked site audits yet." />
          ) : (
            audits.map((a) => (
              <Row key={a.id}>
                <strong>{a.site || 'Unnamed site'}</strong>
                <span style={{ color: 'var(--muted)' }}>{a.date ?? '—'}</span>
                <span style={{ color: 'var(--muted)', fontSize: '8pt' }}>
                  {[a.region, a.country].filter(Boolean).join(', ')} · {a.pumpCount} pump
                  {a.pumpCount === 1 ? '' : 's'} · {a.status}
                </span>
              </Row>
            ))
          )}
        </Panel>
      </div>

      {editingClient && (
        <Drawer title="Edit Client" onClose={() => setEditingClient(false)}>
          <ClientForm initial={client} onSave={saveClient} onCancel={() => setEditingClient(false)} />
        </Drawer>
      )}

      {editingContact && (
        <Drawer title={editingContact === 'new' ? 'New Contact' : 'Edit Contact'} onClose={() => setEditingContact(null)}>
          <ContactForm
            initial={editingContact === 'new' ? null : editingContact}
            clients={clientOption}
            defaultClientId={client.id}
            onSave={saveContact}
            onCancel={() => setEditingContact(null)}
          />
        </Drawer>
      )}

      {editingOpp && (
        <Drawer title={editingOpp === 'new' ? 'New Opportunity' : 'Edit Opportunity'} onClose={() => setEditingOpp(null)}>
          <OpportunityForm
            initial={editingOpp === 'new' ? null : editingOpp}
            clients={clientOption}
            stages={stages}
            defaultClientId={client.id}
            defaultStage={null}
            onSave={saveOpportunity}
            onCancel={() => setEditingOpp(null)}
          />
        </Drawer>
      )}

      {editingContract && (
        <Drawer title={editingContract === 'new' ? 'New Contract' : 'Edit Contract'} onClose={() => setEditingContract(null)}>
          <ContractForm
            initial={editingContract === 'new' ? null : editingContract}
            clients={clientOption}
            opportunities={opportunities.map((o) => ({ id: o.id, title: o.title, client_id: o.client_id }))}
            defaultClientId={client.id}
            onSave={saveContract}
            onCancel={() => setEditingContract(null)}
          />
        </Drawer>
      )}

      {editingActivity && (
        <Drawer title={editingActivity === 'new' ? 'New Activity' : 'Edit Activity'} onClose={() => setEditingActivity(null)}>
          <ActivityForm
            initial={editingActivity === 'new' ? null : editingActivity}
            clients={clientOption}
            contacts={contacts.map((c) => ({ id: c.id, name: c.name, client_id: client.id }))}
            opportunities={opportunities.map((o) => ({ id: o.id, title: o.title, client_id: o.client_id }))}
            users={users}
            defaultClientId={client.id}
            onSave={saveActivity}
            onCancel={() => setEditingActivity(null)}
          />
        </Drawer>
      )}
    </div>
  )
}

function Panel({ title, action, children }: { title: string; action?: () => void; children: ReactNode }) {
  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '1rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.6rem' }}>
        <h3 style={{ margin: 0, fontSize: '12pt' }}>{title}</h3>
        {action && (
          <button onClick={action} style={{ ...secondaryBtn, padding: '0.3rem 0.6rem', fontSize: '8pt' }}>
            + Add
          </button>
        )}
      </div>
      {children}
    </div>
  )
}

function Row({ children, onClick }: { children: ReactNode; onClick?: () => void }) {
  return (
    <div
      onClick={onClick}
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '0.1rem',
        padding: '0.5rem 0',
        borderBottom: '1px solid var(--border)',
        cursor: onClick ? 'pointer' : 'default',
        fontSize: '9pt',
      }}
    >
      {children}
    </div>
  )
}

function Empty({ text = 'Nothing yet.' }: { text?: string }) {
  return <p style={{ color: 'var(--muted)', margin: 0, fontSize: '9pt' }}>{text}</p>
}

const secondaryBtn: CSSProperties = {
  padding: '0.4rem 0.8rem',
  borderRadius: 8,
  border: '1px solid var(--border)',
  background: 'var(--surface)',
  fontWeight: 500,
  cursor: 'pointer',
}
