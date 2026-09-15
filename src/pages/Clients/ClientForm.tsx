import { useState, type CSSProperties, type FormEvent, type ReactNode } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { MapContainer, Marker, TileLayer } from 'react-leaflet'
import { geocodeAddress } from '../../lib/geocode'
import { CLIENT_TYPES, type Client, type ClientInput } from './types'

const PIN_ICON = L.divIcon({
  className: '',
  html: `<div style="width:16px;height:16px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);background:#218240;border:2px solid white;box-shadow:0 0 4px rgba(0,0,0,0.4)"></div>`,
  iconSize: [16, 16],
  iconAnchor: [8, 16],
})

export default function ClientForm({
  initial,
  onSave,
  onCancel,
}: {
  initial: Client | null
  onSave: (input: ClientInput) => Promise<void>
  onCancel: () => void
}) {
  const [name, setName] = useState(initial?.name ?? '')
  const [type, setType] = useState<Client['type']>(initial?.type ?? 'Customer')
  const [country, setCountry] = useState(initial?.country ?? '')
  const [region, setRegion] = useState(initial?.region ?? '')
  const [address, setAddress] = useState(initial?.address ?? '')
  const [location, setLocation] = useState(initial?.location ?? null)
  const [locating, setLocating] = useState(false)
  const [locateError, setLocateError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function findOnMap() {
    if (!address.trim() && !name.trim()) {
      setLocateError('Enter an address (or at least a name) first.')
      return
    }
    setLocating(true)
    setLocateError(null)
    try {
      const query = [address, region, country].filter(Boolean).join(', ') || name
      const result = await geocodeAddress(query)
      if (!result) setLocateError('No match found — try a more specific address, or drop the pin manually below.')
      else setLocation({ lat: result.lat, lng: result.lng })
    } catch (err) {
      setLocateError(err instanceof Error ? err.message : 'Lookup failed')
    } finally {
      setLocating(false)
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    try {
      await onSave({
        name: name.trim(),
        type,
        country: country.trim() || null,
        region: region.trim() || null,
        address: address.trim() || null,
        location,
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save client')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <Field label="Name">
        <input required value={name} onChange={(e) => setName(e.target.value)} style={inputStyle} />
      </Field>

      <Field label="Type">
        <select
          value={type ?? ''}
          onChange={(e) => setType(e.target.value as Client['type'])}
          style={inputStyle}
        >
          {CLIENT_TYPES.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
      </Field>

      <Field label="Country">
        <input value={country} onChange={(e) => setCountry(e.target.value)} style={inputStyle} />
      </Field>

      <Field label="Region">
        <input value={region} onChange={(e) => setRegion(e.target.value)} style={inputStyle} />
      </Field>

      <Field label="Head office address">
        <textarea
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          rows={3}
          placeholder="Company HQ — individual site addresses are captured per audit in the Site Audit App"
          style={{ ...inputStyle, resize: 'vertical' }}
        />
      </Field>

      <div style={{ marginBottom: '0.9rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
          <span style={{ fontWeight: 500 }}>Map location</span>
          <button type="button" onClick={findOnMap} disabled={locating} style={secondaryBtn}>
            {locating ? 'Looking up…' : 'Find on map'}
          </button>
        </div>

        {locateError && <div style={{ color: 'var(--danger)', fontSize: '9pt', marginBottom: '0.4rem' }}>{locateError}</div>}

        {location ? (
          <>
            <div style={{ height: 220, borderRadius: 8, overflow: 'hidden', border: '1px solid var(--border)' }}>
              <MapContainer center={[location.lat, location.lng]} zoom={14} style={{ height: '100%', width: '100%' }}>
                <TileLayer attribution="&copy; OpenStreetMap contributors" url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                <DraggablePin position={location} onMove={setLocation} />
              </MapContainer>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.3rem' }}>
              <span style={{ fontSize: '8pt', color: 'var(--muted)' }}>
                Drag the pin to fine-tune · {location.lat.toFixed(5)}, {location.lng.toFixed(5)}
              </span>
              <button type="button" onClick={() => setLocation(null)} style={{ ...linkBtn }}>
                Clear
              </button>
            </div>
          </>
        ) : (
          <p style={{ fontSize: '9pt', color: 'var(--muted)', margin: 0 }}>
            No location set. Click "Find on map" to look up the address above, then drag the pin to fine-tune.
          </p>
        )}
      </div>

      {error && <div style={{ color: 'var(--danger)', marginBottom: '1rem' }}>{error}</div>}

      <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1.5rem' }}>
        <button
          type="submit"
          disabled={saving}
          style={{
            flex: 1,
            padding: '0.6rem',
            background: 'var(--green)',
            color: '#fff',
            border: 'none',
            borderRadius: 8,
            fontWeight: 600,
          }}
        >
          {saving ? 'Saving…' : 'Save'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          style={{
            padding: '0.6rem 1rem',
            borderRadius: 8,
            border: '1px solid var(--border)',
            background: 'var(--surface)',
          }}
        >
          Cancel
        </button>
      </div>
    </form>
  )
}

function DraggablePin({
  position,
  onMove,
}: {
  position: { lat: number; lng: number }
  onMove: (pos: { lat: number; lng: number }) => void
}) {
  return (
    <Marker
      position={[position.lat, position.lng]}
      icon={PIN_ICON}
      draggable
      eventHandlers={{
        dragend: (e) => {
          const marker = e.target as L.Marker
          const pos = marker.getLatLng()
          onMove({ lat: pos.lat, lng: pos.lng })
        },
      }}
    />
  )
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label style={{ display: 'block', marginBottom: '0.9rem' }}>
      <div style={{ marginBottom: '0.3rem', fontWeight: 500 }}>{label}</div>
      {children}
    </label>
  )
}

const inputStyle: CSSProperties = {
  display: 'block',
  width: '100%',
  padding: '0.5rem',
  border: '1px solid var(--border)',
  borderRadius: 6,
}

const secondaryBtn: CSSProperties = {
  padding: '0.35rem 0.7rem',
  borderRadius: 6,
  border: '1px solid var(--border)',
  background: 'var(--surface)',
  fontSize: '9pt',
  fontWeight: 500,
}

const linkBtn: CSSProperties = {
  background: 'none',
  border: 'none',
  color: 'var(--green)',
  cursor: 'pointer',
  fontSize: '8pt',
  fontWeight: 500,
  padding: 0,
}
