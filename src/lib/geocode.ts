// Free geocoding via OpenStreetMap's Nominatim — no API key, matches the
// OSM tiles already used for the map elsewhere in the app. Usage policy
// caps this at ~1 request/second and asks for a real Referer, which the
// browser already sends — fine for one-off "look up this address" clicks,
// not for bulk geocoding (that's why Excel import/export still uses plain
// lat/lng columns rather than calling this per row).
export interface GeocodeResult {
  lat: number
  lng: number
  displayName: string
}

export async function geocodeAddress(query: string): Promise<GeocodeResult | null> {
  const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(query)}`
  const res = await fetch(url, { headers: { Accept: 'application/json' } })
  if (!res.ok) throw new Error(`Lookup failed (${res.status})`)
  const results = (await res.json()) as { lat: string; lon: string; display_name: string }[]
  if (results.length === 0) return null
  return { lat: parseFloat(results[0].lat), lng: parseFloat(results[0].lon), displayName: results[0].display_name }
}
