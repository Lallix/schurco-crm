import type { DragEvent } from 'react'
import { formatZAR } from '../../lib/format'
import type { Opportunity } from './types'

function formatValue(value: string | null) {
  const n = value ? Number(value) : NaN
  if (Number.isNaN(n)) return value || '—'
  return formatZAR(n)
}

export default function OpportunityCard({
  opportunity,
  draggable,
  onDragStart,
  onClick,
}: {
  opportunity: Opportunity
  draggable: boolean
  onDragStart: (e: DragEvent<HTMLDivElement>) => void
  onClick: () => void
}) {
  const clientName = opportunity.client?.name ?? opportunity.customer ?? 'Unknown client'

  return (
    <div
      draggable={draggable}
      onDragStart={onDragStart}
      onClick={onClick}
      title={draggable ? 'Drag to change stage, click to edit' : 'Click to view'}
      style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 10,
        padding: '0.75rem',
        marginBottom: '0.6rem',
        cursor: draggable ? 'grab' : 'pointer',
        boxShadow: '0 1px 3px rgba(20,35,26,0.06)',
      }}
    >
      <div style={{ fontWeight: 600, marginBottom: '0.2rem' }}>{opportunity.title || '(untitled)'}</div>
      <div style={{ fontSize: '9pt', color: 'var(--muted)', marginBottom: '0.4rem' }}>{clientName}</div>
      {opportunity.audit && (
        <div
          style={{
            fontSize: '8pt',
            color: 'var(--green-dark)',
            background: 'var(--green-light)',
            display: 'inline-block',
            padding: '0.1rem 0.4rem',
            borderRadius: 999,
            marginBottom: '0.4rem',
          }}
        >
          From audit: {opportunity.audit.site || opportunity.audit.customer}
        </div>
      )}
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9pt' }}>
        <span style={{ fontWeight: 600, color: 'var(--green-dark)' }}>{formatValue(opportunity.value)}</span>
        <span style={{ color: 'var(--muted)' }}>{opportunity.owner || '—'}</span>
      </div>
      {opportunity.close_date && (
        <div style={{ fontSize: '8pt', color: 'var(--muted)', marginTop: '0.25rem' }}>
          Close: {opportunity.close_date}
        </div>
      )}
      {opportunity.loss_reason && (
        <div style={{ fontSize: '8pt', color: 'var(--danger)', marginTop: '0.25rem' }}>
          Lost: {opportunity.loss_reason.name}
        </div>
      )}
    </div>
  )
}
