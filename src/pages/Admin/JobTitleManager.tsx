import { useState, type CSSProperties } from 'react'
import { supabase } from '../../lib/supabase'
import type { JobTitle } from './types'

export default function JobTitleManager({
  titles,
  onChanged,
}: {
  titles: JobTitle[]
  onChanged: () => Promise<void>
}) {
  const [newName, setNewName] = useState('')
  const [error, setError] = useState<string | null>(null)

  async function addTitle() {
    const name = newName.trim()
    if (!name) return
    const nextOrder = (titles.at(-1)?.sort_order ?? 0) + 1
    const { error } = await supabase.from('job_titles').insert({ name, sort_order: nextOrder })
    if (error) setError(error.message)
    else {
      setNewName('')
      await onChanged()
    }
  }

  async function rename(title: JobTitle, name: string) {
    if (!name.trim() || name === title.name) return
    const { error } = await supabase.from('job_titles').update({ name: name.trim() }).eq('id', title.id)
    if (error) setError(error.message)
    else await onChanged()
  }

  async function move(title: JobTitle, direction: -1 | 1) {
    const idx = titles.findIndex((t) => t.id === title.id)
    const swapWith = titles[idx + direction]
    if (!swapWith) return
    const { error: e1 } = await supabase
      .from('job_titles')
      .update({ sort_order: swapWith.sort_order })
      .eq('id', title.id)
    const { error: e2 } = await supabase
      .from('job_titles')
      .update({ sort_order: title.sort_order })
      .eq('id', swapWith.id)
    if (e1 || e2) setError((e1 ?? e2)!.message)
    else await onChanged()
  }

  async function remove(title: JobTitle) {
    if (!confirm(`Remove "${title.name}"? Anyone currently holding it keeps it on their profile, it just won't be selectable for new assignments.`))
      return
    const { data: userData } = await supabase.auth.getUser()
    const { error } = await supabase
      .from('job_titles')
      .update({ deleted_at: new Date().toISOString(), deleted_by: userData.user?.id ?? null })
      .eq('id', title.id)
    if (error) setError(error.message)
    else await onChanged()
  }

  return (
    <div>
      {error && <div style={{ color: 'var(--danger)', marginBottom: '1rem' }}>{error}</div>}
      {titles.map((t, i) => (
        <div
          key={t.id}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            padding: '0.5rem 0',
            borderBottom: '1px solid var(--border)',
          }}
        >
          <input
            defaultValue={t.name}
            onBlur={(e) => rename(t, e.target.value)}
            style={{ ...inputStyle, flex: 1 }}
          />
          <button onClick={() => move(t, -1)} disabled={i === 0} style={iconBtn}>
            ↑
          </button>
          <button onClick={() => move(t, 1)} disabled={i === titles.length - 1} style={iconBtn}>
            ↓
          </button>
          <button onClick={() => remove(t)} style={{ ...iconBtn, color: 'var(--danger)' }}>
            ×
          </button>
        </div>
      ))}

      <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
        <input
          placeholder="New job title…"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          style={{ ...inputStyle, flex: 1 }}
        />
        <button
          onClick={addTitle}
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
