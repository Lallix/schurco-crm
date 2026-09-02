import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { MapContainer, Marker, Popup, TileLayer } from 'react-leaflet'
import { formatZAR } from '../../lib/format'

interface MapClient {
  id: string
  name: string
  type: string | null
  location: { lat: number; lng: number }
  oppCount: number
  oppValue: number
  topColor: string
}

function markerIcon(color: string) {
  return L.divIcon({
    className: '',
    html: `<div style="width:14px;height:14px;border-radius:50%;background:${color};border:2px solid white;box-shadow:0 0 4px rgba(0,0,0,0.4)"></div>`,
    iconSize: [14, 14],
    iconAnchor: [7, 7],
  })
}

export default function PipelineMap({ clients }: { clients: MapClient[] }) {
  if (clients.length === 0) {
    return (
      <p style={{ color: 'var(--muted)' }}>
        No clients with a location set yet. Add coordinates on a client's Address to see them here.
      </p>
    )
  }

  const center: [number, number] = [-26.5, 28.0]

  return (
    <div style={{ height: 380, borderRadius: 10, overflow: 'hidden', border: '1px solid var(--border)' }}>
      <MapContainer center={center} zoom={6} style={{ height: '100%', width: '100%' }}>
        <TileLayer
          attribution='&copy; OpenStreetMap contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {clients.map((c) => (
          <Marker key={c.id} position={[c.location.lat, c.location.lng]} icon={markerIcon(c.topColor)}>
            <Popup>
              <strong>{c.name}</strong>
              <br />
              {c.type ?? 'Client'}
              <br />
              {c.oppCount} opportunit{c.oppCount === 1 ? 'y' : 'ies'} · {formatZAR(c.oppValue)}
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  )
}
