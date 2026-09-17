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

async function nominatimSearch(query: string, countryCodes?: string): Promise<GeocodeResult | null> {
  const params = new URLSearchParams({ format: 'json', limit: '1', q: query })
  if (countryCodes) params.set('countrycodes', countryCodes)
  const res = await fetch(`https://nominatim.openstreetmap.org/search?${params.toString()}`, {
    headers: { Accept: 'application/json' },
  })
  if (!res.ok) throw new Error(`Lookup failed (${res.status})`)
  const results = (await res.json()) as { lat: string; lon: string; display_name: string }[]
  if (results.length === 0) return null
  return { lat: parseFloat(results[0].lat), lng: parseFloat(results[0].lon), displayName: results[0].display_name }
}

// Tries the full address first, then — if that finds nothing — retries
// with just its last few comma-separated segments (typically
// suburb/city/postcode). OSM rarely indexes a specific business or office
// park name, so a full "Constantia Office Park, Vlakhaas Ave,
// Weltevredenpark, Roodepoort, 1709" can fail to geocode even though the
// "Weltevredenpark, Roodepoort, 1709" tail on its own succeeds.
export async function geocodeAddress(query: string, countryCodes?: string): Promise<GeocodeResult | null> {
  const full = await nominatimSearch(query, countryCodes)
  if (full) return full

  const segments = query
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
  if (segments.length <= 2) return null

  await new Promise((resolve) => setTimeout(resolve, 1100)) // Nominatim's usage policy caps this at ~1 req/sec
  const tailCount = segments.length > 3 ? 3 : 2
  const tail = segments.slice(-tailCount).join(', ')
  return nominatimSearch(tail, countryCodes)
}
