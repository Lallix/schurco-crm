import { useState, type CSSProperties } from 'react'
import { supabase } from '../../lib/supabase'
import type { PipelineStage } from './types'

export default function StageManager({
  stages,
  onChanged,
}: {
  stages: PipelineStage[]
  onChanged: () => Promise<void>
}) {
  const [newName, setNewName] = useState('')
  const [error, setError] = useState<string | null>(null)

  async function addStage() {
    const name = newName.trim()
    if (!name) return
    const nextOrder = (stages.at(-1)?.sort_order ?? 0) + 1
    const { error } = await supabase.from('pipeline_stages').insert({ name, sort_order: nextOrder })
    if (error) setError(error.message)
    else {
      setNewName('')
      await onChanged()
    }
  }

  async function rename(stage: PipelineStage, name: string) {
    if (!name.trim() || name === stage.name) return
    const { error } = await supabase.from('pipeline_stages').update({ name: name.trim() }).eq('id', stage.id)
    if (error) setError(error.message)
    else await onChanged()
  }

  async function recolor(stage: PipelineStage, color: string) {
    const { error } = await supabase.from('pipeline_stages').update({ color }).eq('id', stage.id)
    if (error) setError(error.message)
    else await onChanged()
  }

  async function toggleWon(stage: PipelineStage) {
    const { error } = await supabase
      .from('pipeline_stages')
      .update({ is_won: !stage.is_won, is_lost: stage.is_won ? stage.is_lost : false })
      .eq('id', stage.id)
    if (error) setError(error.message)
    else await onChanged()
  }

  async function toggleLost(stage: PipelineStage) {
    const { error } = await supabase
      .from('pipeline_stages')
      .update({ is_lost: !stage.is_lost, is_won: stage.is_lost ? stage.is_won : false })
      .eq('id', stage.id)
    if (error) setError(error.message)
    else await onChanged()
  }

  async function move(stage: PipelineStage, direction: -1 | 1) {
    const idx = stages.findIndex((s) => s.id === stage.id)
    const swapWith = stages[idx + direction]
    if (!swapWith) return
    const { error: e1 } = await supabase
      .from('pipeline_stages')
      .update({ sort_order: swapWith.sort_order })
      .eq('id', stage.id)
    const { error: e2 } = await supabase
      .from('pipeline_stages')
      .update({ sort_order: stage.sort_order })
      .eq('id', swapWith.id)
    if (e1 || e2) setError((e1 ?? e2)!.message)
    else await onChanged()
  }

  async function remove(stage: PipelineStage) {
    if (
      !confirm(
        `Remove stage "${stage.name}"? Opportunities already on it keep their stage text, but the column disappears from the board.`,
      )
    )
      return
    const { data: userData } = await supabase.auth.getUser()
    const { error } = await supabase
      .from('pipeline_stages')
      .update({ deleted_at: new Date().toISOString(), deleted_by: userData.user?.id ?? null })
      .eq('id', stage.id)
    if (error) setError(error.message)
    else await onChanged()
  }

  return (
    <div>
      {error && <div style={{ color: 'var(--danger)', marginBottom: '1rem' }}>{error}</div>}
      {stages.map((s, i) => (
        <div
          key={s.id}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            padding: '0.5rem 0',
            borderBottom: '1px solid var(--border)',
          }}
        >
          <input
            type="color"
            value={s.color}
            onChange={(e) => recolor(s, e.target.value)}
            style={{ width: 28, height: 28, border: 'none', padding: 0, background: 'none' }}
          />
          <input
            defaultValue={s.name}
            onBlur={(e) => rename(s, e.target.value)}
            style={{ ...inputStyle, flex: 1 }}
          />
          <label
            style={{ fontSize: '8pt', color: 'var(--muted)', display: 'flex', alignItems: 'center', gap: '0.2rem' }}
          >
            <input type="checkbox" checked={s.is_won} onChange={() => toggleWon(s)} />
            Won
          </label>
          <label
            style={{ fontSize: '8pt', color: 'var(--muted)', display: 'flex', alignItems: 'center', gap: '0.2rem' }}
          >
            <input type="checkbox" checked={s.is_lost} onChange={() => toggleLost(s)} />
            Lost
          </label>
          <button onClick={() => move(s, -1)} disabled={i === 0} style={iconBtn}>
            ↑
          </button>
          <button onClick={() => move(s, 1)} disabled={i === stages.length - 1} style={iconBtn}>
            ↓
          </button>
          <button onClick={() => remove(s)} style={{ ...iconBtn, color: 'var(--danger)' }}>
            ×
          </button>
        </div>
      ))}

      <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
        <input
          placeholder="New stage name…"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          style={{ ...inputStyle, flex: 1 }}
        />
        <button
          onClick={addStage}
          style={{
            padding: '0.5rem 1rem',
            background: 'var(--green)',
            color: '#fff',
            border: 'none',
            borderRadius: 8,
            fontWeight: 600,
          }}
        >
          Add
        </button>
      </div>
    </div>
  )
}

const inputStyle: CSSProperties = {
  padding: '0.4rem',
  border: '1px solid var(--border)',
  borderRadius: 6,
}

const iconBtn: CSSProperties = {
  border: '1px solid var(--border)',
  background: 'var(--surface)',
  borderRadius: 6,
  width: 26,
  height: 26,
  lineHeight: 1,
}
