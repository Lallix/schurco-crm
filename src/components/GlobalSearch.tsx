import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

interface ClientHit {
  kind: 'client'
  id: string
  label: string
  sub: string
}
interface ContactHit {
  kind: 'contact'
  id: string
  label: string
  sub: string
  clientId: string | null
}
interface OppHit {
  kind: 'opportunity'
  id: string
  label: string
  sub: string
  clientId: string | null
}
type Hit = ClientHit | ContactHit | OppHit

// Supabase's untyped client infers an embedded to-one relation as an
// array; normalize either shape to the first (only) related row's name.
function firstClientName(client: { name: string }[] | { name: string } | null | undefined): string | undefined {
  if (!client) return undefined
  return Array.isArray(client) ? client[0]?.name : client.name
}

export default function GlobalSearch() {
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [hits, setHits] = useState<Hit[]>([])
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const boxRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [])

  useEffect(() => {
    const q = query.trim()
    if (q.length < 2) {
      setHits([])
      setLoading(false)
      return
    }
    setLoading(true)
    const timer = setTimeout(async () => {
      const [clientsRes, contactsRes, oppsRes] = await Promise.all([
        supabase.from('clients').select('id, name, type').is('deleted_at', null).ilike('name', `%${q}%`).limit(5),
        supabase
          .from('contacts')
          .select('id, name, client_id, client:clients(name)')
          .is('deleted_at', null)
          .ilike('name', `%${q}%`)
          .limit(5),
        supabase
          .from('opportunities')
          .select('id, title, client_id, client:clients(name)')
          .is('deleted_at', null)
          .ilike('title', `%${q}%`)
          .limit(5),
      ])

      const results: Hit[] = [
        ...(clientsRes.data ?? []).map((c): ClientHit => ({ kind: 'client', id: c.id, label: c.name, sub: c.type ?? 'Client' })),
        ...(contactsRes.data ?? []).map(
          (c): ContactHit => ({
            kind: 'contact',
            id: c.id,
            label: c.name,
            sub: firstClientName(c.client) ?? 'No client',
            clientId: c.client_id,
          }),
        ),
        ...(oppsRes.data ?? []).map(
          (o): OppHit => ({
            kind: 'opportunity',
            id: o.id,
            label: o.title || '(untitled)',
            sub: firstClientName(o.client) ?? 'No client',
            clientId: o.client_id,
          }),
        ),
      ]
      setHits(results)
      setLoading(false)
    }, 300)
    return () => clearTimeout(timer)
  }, [query])

  function go(hit: Hit) {
    setQuery('')
    setOpen(false)
    if (hit.kind === 'client') navigate(`/clients/${hit.id}`)
    else if (hit.clientId) navigate(`/clients/${hit.clientId}`)
    else if (hit.kind === 'contact') navigate('/contacts')
    else navigate('/opportunities')
  }

  return (
    <div ref={boxRef} className="search-box" style={{ position: 'relative', flex: '1 1 200px', maxWidth: 320 }}>
      <input
        value={query}
        onChange={(e) => {
          setQuery(e.target.value)
          setOpen(true)
        }}
        onFocus={() => setOpen(true)}
        placeholder="Search clients, contacts, deals…"
        style={inputStyle}
        aria-label="Global search"
      />
      {open && query.trim().length >= 2 && (
        <div style={dropdownStyle}>
          {loading ? (
            <div style={emptyStyle}>Searching…</div>
          ) : hits.length === 0 ? (
            <div style={emptyStyle}>No matches.</div>
          ) : (
            hits.map((hit) => (
              <button key={`${hit.kind}-${hit.id}`} onClick={() => go(hit)} style={itemStyle}>
                <span style={kindBadgeStyle(hit.kind)}>{KIND_LABEL[hit.kind]}</span>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {hit.label}
                  </div>
                  <div style={{ fontSize: '8pt', color: 'var(--muted)' }}>{hit.sub}</div>
                </span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  )
}

const KIND_LABEL: Record<Hit['kind'], string> = {
  client: 'Client',
  contact: 'Contact',
  opportunity: 'Deal',
}

function kindBadgeStyle(kind: Hit['kind']): CSSProperties {
  const colored = kind === 'client'
  return {
    fontSize: '7.5pt',
    textTransform: 'uppercase',
    letterSpacing: '0.03em',
    color: colored ? 'var(--green-dark)' : 'var(--muted)',
    background: colored ? 'var(--green-light)' : 'var(--bg)',
    padding: '0.1rem 0.35rem',
    borderRadius: 999,
    flex: 'none',
  }
}

const inputStyle: CSSProperties = {
  width: '100%',
  padding: '0.45rem 0.7rem',
  border: '1px solid var(--border)',
  borderRadius: 8,
  fontSize: '9pt',
}

const dropdownStyle: CSSProperties = {
  position: 'absolute',
  top: 'calc(100% + 4px)',
  left: 0,
  right: 0,
  background: 'var(--surface)',
  border: '1px solid var(--border)',
  borderRadius: 8,
  boxShadow: '0 4px 16px rgba(20,35,26,0.12)',
  zIndex: 40,
  maxHeight: 320,
  overflowY: 'auto',
}

const itemStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '0.5rem',
  width: '100%',
  padding: '0.5rem 0.7rem',
  border: 'none',
  borderBottom: '1px solid var(--border)',
  background: 'none',
  textAlign: 'left',
  cursor: 'pointer',
  fontSize: '9pt',
  color: 'var(--ink)',
}

const emptyStyle: CSSProperties = {
  padding: '0.7rem',
  fontSize: '9pt',
  color: 'var(--muted)',
}
