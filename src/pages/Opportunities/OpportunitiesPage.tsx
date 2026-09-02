import { useEffect, useState, type DragEvent } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../lib/auth'
import Drawer from '../../components/Drawer'
import OpportunityCard from './OpportunityCard'
import OpportunityForm from './OpportunityForm'
import StageManager from './StageManager'
import type { Opportunity, OpportunityInput, PipelineStage } from './types'

export default function OpportunitiesPage() {
  const { profile, isAdmin, session } = useAuth()
  const canCreate = isAdmin || profile?.crm_role === 'Sales'

  const [stages, setStages] = useState<PipelineStage[]>([])
  const [opportunities, setOpportunities] = useState<Opportunity[]>([])
  const [clients, setClients] = useState<{ id: string; name: string }[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [editing, setEditing] = useState<Opportunity | null | 'new'>(null)
  const [newStage, setNewStage] = useState<string | null>(null)
  const [managingStages, setManagingStages] = useState(false)
  const [dragOverStage, setDragOverStage] = useState<string | null>(null)

  async function loadStages() {
    const { data } = await supabase
      .from('pipeline_stages')
      .select('*')
      .is('deleted_at', null)
      .order('sort_order')
    setStages((data ?? []) as PipelineStage[])
  }

  async function loadOpportunities() {
    setLoading(true)
    setError(null)
    const { data, error } = await supabase
      .from('opportunities')
      .select('*, client:clients(id, name), audit:audits(id, site, customer)')
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
    if (error) setError(error.message)
    else setOpportunities((data ?? []) as unknown as Opportunity[])
    setLoading(false)
  }

  useEffect(() => {
    loadStages()
    loadOpportunities()
    supabase
      .from('clients')
      .select('id, name')
      .is('deleted_at', null)
      .order('name')
      .then(({ data }) => setClients(data ?? []))
  }, [])

  function canEdit(opp: Opportunity) {
    return isAdmin || opp.user_id === session?.user.id
  }

  async function handleSave(input: OpportunityInput) {
    const clientName = clients.find((c) => c.id === input.client_id)?.name ?? null
    if (editing && editing !== 'new') {
      const { error } = await supabase
        .from('opportunities')
        .update({ ...input, customer: clientName })
        .eq('id', editing.id)
      if (error) throw error
    } else {
      const { error } = await supabase.from('opportunities').insert({
        id: crypto.randomUUID(),
        user_id: session?.user.id,
        ...input,
        customer: clientName,
      })
      if (error) throw error
    }
    setEditing(null)
    await loadOpportunities()
  }

  async function moveStage(oppId: string, stage: string) {
    const { error } = await supabase.from('opportunities').update({ stage }).eq('id', oppId)
    if (error) setError(error.message)
    else await loadOpportunities()
  }

  function handleDrop(e: DragEvent<HTMLDivElement>, stageName: string) {
    e.preventDefault()
    setDragOverStage(null)
    const oppId = e.dataTransfer.getData('text/plain')
    if (oppId) moveStage(oppId, stageName)
  }

  const otherStageOpps = opportunities.filter((o) => !stages.some((s) => s.name === o.stage))

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h1>Opportunities</h1>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          {isAdmin && (
            <button onClick={() => setManagingStages(true)} style={secondaryBtn}>
              Manage stages
            </button>
          )}
          {canCreate && (
            <button
              onClick={() => {
                setNewStage(null)
                setEditing('new')
              }}
              style={{
                padding: '0.5rem 1rem',
                background: 'var(--green)',
                color: '#fff',
                border: 'none',
                borderRadius: 8,
                fontWeight: 600,
              }}
            >
              + New Opportunity
            </button>
          )}
        </div>
      </div>

      {error && <div style={{ color: 'var(--danger)', marginBottom: '1rem' }}>{error}</div>}

      {loading ? (
        <p style={{ color: 'var(--muted)' }}>Loading…</p>
      ) : (
        <div style={{ display: 'flex', gap: '1rem', overflowX: 'auto', paddingBottom: '1rem' }}>
          {stages.map((stage) => {
            const stageOpps = opportunities.filter((o) => o.stage === stage.name)
            const stageValue = stageOpps.reduce((sum, o) => sum + (Number(o.value) || 0), 0)
            return (
              <div
                key={stage.id}
                onDragOver={(e) => {
                  e.preventDefault()
                  setDragOverStage(stage.name)
                }}
                onDragLeave={() => setDragOverStage(null)}
                onDrop={(e) => handleDrop(e, stage.name)}
                style={{
                  minWidth: 260,
                  width: 260,
                  background: dragOverStage === stage.name ? 'var(--green-light)' : 'var(--bg)',
                  border: '1px solid var(--border)',
                  borderRadius: 10,
                  padding: '0.75rem',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.75rem' }}>
                  <span style={{ width: 10, height: 10, borderRadius: '50%', background: stage.color }} />
                  <strong>{stage.name}</strong>
                  <span style={{ color: 'var(--muted)', fontSize: '9pt' }}>({stageOpps.length})</span>
                </div>
                <div style={{ fontSize: '8pt', color: 'var(--muted)', marginBottom: '0.5rem' }}>
                  {stageValue.toLocaleString('en-ZA', { style: 'currency', currency: 'ZAR', maximumFractionDigits: 0 })}
                </div>
                {stageOpps.map((opp) => (
                  <OpportunityCard
                    key={opp.id}
                    opportunity={opp}
                    draggable={canEdit(opp)}
                    onDragStart={(e) => e.dataTransfer.setData('text/plain', opp.id)}
                    onClick={() => {
                      if (canEdit(opp)) setEditing(opp)
                    }}
                  />
                ))}
                {canCreate && (
                  <button
                    onClick={() => {
                      setNewStage(stage.name)
                      setEditing('new')
                    }}
                    style={{ ...secondaryBtn, width: '100%', marginTop: '0.25rem' }}
                  >
                    + Add
                  </button>
                )}
              </div>
            )
          })}

          {otherStageOpps.length > 0 && (
            <div style={{ minWidth: 260, width: 260, border: '1px dashed var(--border)', borderRadius: 10, padding: '0.75rem' }}>
              <strong>Other / unmapped stage</strong>
              <p style={{ fontSize: '8pt', color: 'var(--muted)' }}>
                Stage text doesn't match a configured column.
              </p>
              {otherStageOpps.map((opp) => (
                <OpportunityCard
                  key={opp.id}
                  opportunity={opp}
                  draggable={false}
                  onDragStart={() => {}}
                  onClick={() => {
                    if (canEdit(opp)) setEditing(opp)
                  }}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {editing && (
        <Drawer title={editing === 'new' ? 'New Opportunity' : 'Edit Opportunity'} onClose={() => setEditing(null)}>
          <OpportunityForm
            initial={editing === 'new' ? null : editing}
            clients={clients}
            stages={stages}
            defaultClientId={null}
            defaultStage={newStage}
            onSave={handleSave}
            onCancel={() => setEditing(null)}
          />
        </Drawer>
      )}

      {managingStages && (
        <Drawer title="Manage Pipeline Stages" onClose={() => setManagingStages(false)}>
          <StageManager stages={stages} onChanged={loadStages} />
        </Drawer>
      )}
    </div>
  )
}

const secondaryBtn = {
  padding: '0.5rem 0.8rem',
  borderRadius: 8,
  border: '1px solid var(--border)',
  background: 'var(--surface)',
  fontWeight: 500,
} as const
