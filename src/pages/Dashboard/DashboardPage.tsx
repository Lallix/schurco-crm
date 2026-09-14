import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { formatZAR } from '../../lib/format'
import { daysUntil, RENEWAL_WINDOW_DAYS } from '../../lib/contracts'
import PipelineMap from './PipelineMap'
import type { PipelineStage } from '../Opportunities/types'
import type { Contract } from '../Contracts/types'

interface ClientRow {
  id: string
  name: string
  type: string | null
  region: string | null
  location: { lat: number; lng: number } | null
}

interface OppRow {
  id: string
  client_id: string | null
  title: string | null
  value: string | null
  stage: string | null
  owner: string | null
  loss_reason_id: string | null
}

export default function DashboardPage() {
  const [stages, setStages] = useState<PipelineStage[]>([])
  const [opportunities, setOpportunities] = useState<OppRow[]>([])
  const [clients, setClients] = useState<ClientRow[]>([])
  const [contracts, setContracts] = useState<Contract[]>([])
  const [lossReasons, setLossReasons] = useState<{ id: string; name: string }[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [stageFilter, setStageFilter] = useState('')
  const [repFilter, setRepFilter] = useState('')

  useEffect(() => {
    async function load() {
      setLoading(true)
      setError(null)
      const [stagesRes, oppsRes, clientsRes, contractsRes, lossReasonsRes] = await Promise.all([
        supabase.from('pipeline_stages').select('*').is('deleted_at', null).order('sort_order'),
        supabase
          .from('opportunities')
          .select('id, client_id, title, value, stage, owner, loss_reason_id')
          .is('deleted_at', null),
        supabase.from('clients').select('id, name, type, region, location').is('deleted_at', null),
        supabase.from('contracts').select('*, client:clients(id, name)').is('deleted_at', null),
        supabase.from('loss_reasons').select('id, name').is('deleted_at', null).order('sort_order'),
      ])
      const firstError = [stagesRes.error, oppsRes.error, clientsRes.error, contractsRes.error].find(Boolean)
      if (firstError) setError(firstError.message)
      setStages((stagesRes.data ?? []) as PipelineStage[])
      setOpportunities((oppsRes.data ?? []) as OppRow[])
      setClients((clientsRes.data ?? []) as ClientRow[])
      setContracts((contractsRes.data ?? []) as unknown as Contract[])
      setLossReasons(lossReasonsRes.data ?? [])
      setLoading(false)
    }
    load()
  }, [])

  // Tier 1: stage, tier 2: rep — stacks on top, same pattern as the Audit app's admin dashboard
  const filteredOpps = useMemo(() => {
    let opps = opportunities
    if (stageFilter) opps = opps.filter((o) => o.stage === stageFilter)
    if (repFilter) opps = opps.filter((o) => o.owner === repFilter)
    return opps
  }, [opportunities, stageFilter, repFilter])

  const reps = useMemo(
    () => Array.from(new Set(opportunities.map((o) => o.owner).filter(Boolean))).sort() as string[],
    [opportunities],
  )

  const wonStageNames = useMemo(() => new Set(stages.filter((s) => s.is_won).map((s) => s.name)), [stages])
  const lostStageNames = useMemo(() => new Set(stages.filter((s) => s.is_lost).map((s) => s.name)), [stages])

  const kpis = useMemo(() => {
    const wonOpps = filteredOpps.filter((o) => wonStageNames.has(o.stage ?? ''))
    const lostOpps = filteredOpps.filter((o) => lostStageNames.has(o.stage ?? ''))
    const openOpps = filteredOpps.filter((o) => !wonStageNames.has(o.stage ?? '') && !lostStageNames.has(o.stage ?? ''))
    const openValue = openOpps.reduce((sum, o) => sum + (Number(o.value) || 0), 0)
    const wonValue = wonOpps.reduce((sum, o) => sum + (Number(o.value) || 0), 0)
    const lostValue = lostOpps.reduce((sum, o) => sum + (Number(o.value) || 0), 0)
    const closedCount = wonOpps.length + lostOpps.length
    const winRate = closedCount ? (wonOpps.length / closedCount) * 100 : 0
    return { count: filteredOpps.length, openValue, wonValue, lostValue, winRate }
  }, [filteredOpps, wonStageNames, lostStageNames])

  const byLossReason = useMemo(() => {
    const lostOpps = filteredOpps.filter((o) => lostStageNames.has(o.stage ?? ''))
    const map = new Map<string, { count: number; value: number }>()
    for (const o of lostOpps) {
      const key = lossReasons.find((r) => r.id === o.loss_reason_id)?.name ?? 'No reason given'
      const entry = map.get(key) ?? { count: 0, value: 0 }
      entry.count += 1
      entry.value += Number(o.value) || 0
      map.set(key, entry)
    }
    return Array.from(map.entries()).sort((a, b) => b[1].value - a[1].value)
  }, [filteredOpps, lostStageNames, lossReasons])

  const byRep = useMemo(() => {
    const map = new Map<string, { count: number; value: number }>()
    for (const o of filteredOpps) {
      const key = o.owner || 'Unassigned'
      const entry = map.get(key) ?? { count: 0, value: 0 }
      entry.count += 1
      entry.value += Number(o.value) || 0
      map.set(key, entry)
    }
    return Array.from(map.entries()).sort((a, b) => b[1].value - a[1].value)
  }, [filteredOpps])

  const clientById = useMemo(() => new Map(clients.map((c) => [c.id, c])), [clients])

  const byRegion = useMemo(() => {
    const map = new Map<string, { count: number; value: number }>()
    for (const o of filteredOpps) {
      const key = (o.client_id && clientById.get(o.client_id)?.region) || 'Unknown'
      const entry = map.get(key) ?? { count: 0, value: 0 }
      entry.count += 1
      entry.value += Number(o.value) || 0
      map.set(key, entry)
    }
    return Array.from(map.entries()).sort((a, b) => b[1].value - a[1].value)
  }, [filteredOpps, clientById])

  const mapClients = useMemo(() => {
    const stageColor = new Map(stages.map((s) => [s.name, s.color]))
    const relevantClientIds = new Set(filteredOpps.map((o) => o.client_id).filter(Boolean))
    const source = stageFilter || repFilter ? clients.filter((c) => relevantClientIds.has(c.id)) : clients
    return source
      .filter((c): c is ClientRow & { location: { lat: number; lng: number } } => !!c.location)
      .map((c) => {
        const oppsForClient = filteredOpps.filter((o) => o.client_id === c.id)
        const value = oppsForClient.reduce((sum, o) => sum + (Number(o.value) || 0), 0)
        const topStage = oppsForClient[0]?.stage
        return {
          id: c.id,
          name: c.name,
          type: c.type,
          location: c.location,
          oppCount: oppsForClient.length,
          oppValue: value,
          topColor: (topStage && stageColor.get(topStage)) || '#5b6b62',
        }
      })
  }, [clients, filteredOpps, stages, stageFilter, repFilter])

  const renewals = contracts
    .filter((c) => c.end_date && c.status !== 'Terminated' && daysUntil(c.end_date) <= RENEWAL_WINDOW_DAYS)
    .sort((a, b) => (a.end_date! < b.end_date! ? -1 : 1))

  if (loading) return <p style={{ color: 'var(--muted)' }}>Loading…</p>

  return (
    <div>
      <h1>Dashboard</h1>

      {error && <div style={{ color: 'var(--danger)', marginBottom: '1rem' }}>{error}</div>}

      <div style={{ display: 'flex', gap: '0.75rem', margin: '1rem 0 1.25rem', alignItems: 'center', flexWrap: 'wrap' }}>
        <select value={stageFilter} onChange={(e) => setStageFilter(e.target.value)} style={selectStyle}>
          <option value="">All stages</option>
          {stages.map((s) => (
            <option key={s.id} value={s.name}>
              {s.name}
            </option>
          ))}
        </select>
        <select value={repFilter} onChange={(e) => setRepFilter(e.target.value)} style={selectStyle}>
          <option value="">All reps</option>
          {reps.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>
        {(stageFilter || repFilter) && (
          <button
            onClick={() => {
              setStageFilter('')
              setRepFilter('')
            }}
            style={{ ...selectStyle, cursor: 'pointer' }}
          >
            Clear filters
          </button>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '0.75rem', marginBottom: '1.5rem' }}>
        <Kpi label="Open pipeline value" value={formatZAR(kpis.openValue)} />
        <Kpi label="Won value" value={formatZAR(kpis.wonValue)} />
        <Kpi label="Lost value" value={formatZAR(kpis.lostValue)} />
        <Kpi label="Win rate" value={`${kpis.winRate.toFixed(0)}%`} />
        <Kpi label="Deals in view" value={String(kpis.count)} />
      </div>

      <div className="two-col-grid" style={{ marginBottom: '1.5rem' }}>
        <Panel title="Deals by rep">
          {byRep.length === 0 ? (
            <Empty />
          ) : (
            byRep.map(([rep, s]) => <BarRow key={rep} label={rep} count={s.count} value={s.value} max={byRep[0][1].value} />)
          )}
        </Panel>
        <Panel title="Deals by region">
          {byRegion.length === 0 ? (
            <Empty />
          ) : (
            byRegion.map(([region, s]) => (
              <BarRow key={region} label={region} count={s.count} value={s.value} max={byRegion[0][1].value} />
            ))
          )}
        </Panel>
      </div>

      <div style={{ marginBottom: '1.5rem' }}>
        <Panel title="Lost reasons">
          {byLossReason.length === 0 ? (
            <Empty text="No lost deals in view." />
          ) : (
            byLossReason.map(([reason, s]) => (
              <BarRow key={reason} label={reason} count={s.count} value={s.value} max={byLossReason[0][1].value} />
            ))
          )}
        </Panel>
      </div>

      <Panel title="Client map">
        <PipelineMap clients={mapClients} />
      </Panel>

      <div style={{ marginTop: '1.5rem' }}>
        <Panel title={`Contracts expiring within ${RENEWAL_WINDOW_DAYS} days`}>
          {renewals.length === 0 ? (
            <Empty text="Nothing expiring soon." />
          ) : (
            <ul style={{ margin: 0, paddingLeft: '1.1rem' }}>
              {renewals.map((c) => {
                const days = daysUntil(c.end_date!)
                return (
                  <li key={c.id} style={{ marginBottom: '0.3rem' }}>
                    <Link to="/contracts" style={{ fontWeight: 600, color: 'var(--green)' }}>
                      {c.client?.name ?? 'Unknown client'}
                    </Link>{' '}
                    — {c.contract_type || 'contract'} {days < 0 ? `expired ${-days}d ago` : `expires in ${days}d`}
                    {c.has_termination_for_convenience_clause && (
                      <span style={{ marginLeft: '0.4rem', fontSize: '8pt', color: 'var(--danger)' }}>
                        · termination-for-convenience clause
                      </span>
                    )}
                  </li>
                )
              })}
            </ul>
          )}
        </Panel>
      </div>
    </div>
  )
}

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '0.9rem' }}>
      <div style={{ fontSize: '8pt', color: 'var(--muted)', marginBottom: '0.3rem' }}>{label}</div>
      <div style={{ fontSize: '14pt', fontWeight: 700, color: 'var(--green-dark)' }}>{value}</div>
    </div>
  )
}

function Panel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '1rem' }}>
      <h3 style={{ marginTop: 0 }}>{title}</h3>
      {children}
    </div>
  )
}

function BarRow({ label, count, value, max }: { label: string; count: number; value: number; max: number }) {
  const pct = max > 0 ? Math.max((value / max) * 100, 4) : 0
  return (
    <div style={{ marginBottom: '0.6rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9pt', marginBottom: '0.2rem' }}>
        <span>
          {label} <span style={{ color: 'var(--muted)' }}>({count})</span>
        </span>
        <span style={{ fontWeight: 600 }}>{formatZAR(value)}</span>
      </div>
      <div style={{ background: 'var(--bg)', borderRadius: 999, height: 6 }}>
        <div style={{ width: `${pct}%`, background: 'var(--green)', height: 6, borderRadius: 999 }} />
      </div>
    </div>
  )
}

function Empty({ text = 'No data yet.' }: { text?: string }) {
  return <p style={{ color: 'var(--muted)', margin: 0 }}>{text}</p>
}

const selectStyle: CSSProperties = {
  padding: '0.5rem',
  border: '1px solid var(--border)',
  borderRadius: 6,
}
