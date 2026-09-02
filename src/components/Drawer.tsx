import type { ReactNode } from 'react'

export default function Drawer({
  title,
  onClose,
  children,
}: {
  title: string
  onClose: () => void
  children: ReactNode
}) {
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(20,35,26,0.35)',
        display: 'flex',
        justifyContent: 'flex-end',
        zIndex: 50,
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 420,
          maxWidth: '100%',
          height: '100%',
          background: 'var(--surface)',
          padding: '1.5rem',
          overflowY: 'auto',
          boxShadow: '-4px 0 16px rgba(20,35,26,0.12)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ margin: 0 }}>{title}</h2>
          <button
            onClick={onClose}
            style={{ border: 'none', background: 'none', fontSize: '14pt', color: 'var(--muted)' }}
            aria-label="Close"
          >
            ×
          </button>
        </div>
        <div style={{ marginTop: '1.25rem' }}>{children}</div>
      </div>
    </div>
  )
}
