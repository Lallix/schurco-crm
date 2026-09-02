import { useRef, useState } from 'react'
import type { ImportSummary } from '../../lib/excel'

export default function ExcelImportExport({ onImported }: { onImported: () => void }) {
  const fileInput = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState<'export' | 'import' | null>(null)
  const [summary, setSummary] = useState<ImportSummary | null>(null)
  const [exportError, setExportError] = useState<string | null>(null)

  async function handleExport() {
    setBusy('export')
    setExportError(null)
    try {
      const { exportClientsAndContacts } = await import('../../lib/excel')
      await exportClientsAndContacts()
    } catch (err) {
      setExportError(err instanceof Error ? err.message : 'Export failed')
    } finally {
      setBusy(null)
    }
  }

  async function handleFileChosen(file: File) {
    setBusy('import')
    setSummary(null)
    try {
      const { importClientsAndContacts } = await import('../../lib/excel')
      const result = await importClientsAndContacts(file)
      setSummary(result)
      onImported()
    } finally {
      setBusy(null)
      if (fileInput.current) fileInput.current.value = ''
    }
  }

  return (
    <div>
      <div style={{ display: 'flex', gap: '0.5rem' }}>
        <button onClick={handleExport} disabled={busy !== null} style={secondaryBtn}>
          {busy === 'export' ? 'Exporting…' : 'Export to Excel'}
        </button>
        <button onClick={() => fileInput.current?.click()} disabled={busy !== null} style={secondaryBtn}>
          {busy === 'import' ? 'Importing…' : 'Import from Excel'}
        </button>
        <input
          ref={fileInput}
          type="file"
          accept=".xlsx"
          hidden
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) handleFileChosen(file)
          }}
        />
      </div>

      {exportError && <div style={{ color: 'var(--danger)', marginTop: '0.5rem' }}>{exportError}</div>}

      {summary && (
        <div
          style={{
            marginTop: '0.75rem',
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 10,
            padding: '0.75rem',
            fontSize: '9pt',
            maxWidth: 480,
          }}
        >
          <strong>Import finished</strong>
          <div style={{ marginTop: '0.4rem', color: 'var(--muted)' }}>
            Clients: {summary.clientsCreated} created, {summary.clientsUpdated} updated
            <br />
            Contacts: {summary.contactsCreated} created, {summary.contactsUpdated} updated
          </div>
          {summary.contactsSkipped.length > 0 && (
            <div style={{ marginTop: '0.4rem', color: 'var(--warn)' }}>
              {summary.contactsSkipped.length} contact(s) skipped — client name not found:
              <ul style={{ margin: '0.2rem 0 0', paddingLeft: '1.1rem' }}>
                {summary.contactsSkipped.map((s, i) => (
                  <li key={i}>{s}</li>
                ))}
              </ul>
            </div>
          )}
          {summary.errors.length > 0 && (
            <div style={{ marginTop: '0.4rem', color: 'var(--danger)' }}>
              <ul style={{ margin: '0.2rem 0 0', paddingLeft: '1.1rem' }}>
                {summary.errors.map((e, i) => (
                  <li key={i}>{e}</li>
                ))}
              </ul>
            </div>
          )}
          <button onClick={() => setSummary(null)} style={{ ...secondaryBtn, marginTop: '0.6rem' }}>
            Dismiss
          </button>
        </div>
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
