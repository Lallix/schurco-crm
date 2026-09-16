// Proxies OMNI's Outstanding Sales Orders report.
//
// Same pattern as omni-aging: the report URL carries real credentials in
// its query string, so it's read here from the OMNI_ORDERS_URL Edge
// Function secret (set via the Supabase dashboard, never committed) and
// only this server-side fetch ever sees it. Also sidesteps browser
// mixed-content blocking, since OMNI is plain HTTP and the CRM is HTTPS.
//
// Any signed-in CRM user can view orders (read-only — nothing here is
// ever written back to OMNI), so this only checks for a real session,
// same as omni-aging.
import { createClient } from 'jsr:@supabase/supabase-js@2'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
}

const FETCH_TIMEOUT_MS = 10_000

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS })
  }
  const authHeader = req.headers.get('Authorization')
  if (!authHeader) {
    return json({ error: 'Missing authorization' }, 401)
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!
  const callerClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  })
  const { data: userData, error: userError } = await callerClient.auth.getUser()
  if (userError || !userData?.user) {
    return json({ error: 'Invalid session' }, 401)
  }

  const omniOrdersUrl = Deno.env.get('OMNI_ORDERS_URL')
  if (!omniOrdersUrl) {
    return json({ error: 'OMNI_ORDERS_URL is not configured on this project' }, 500)
  }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)

  try {
    const res = await fetch(omniOrdersUrl, { signal: controller.signal })
    if (!res.ok) {
      // Deliberately generic — never echo the upstream response body here,
      // since a misconfigured URL/auth error from OMNI could reflect its
      // own query string back in the error page.
      return json({ error: `OMNI returned status ${res.status}` }, 502)
    }
    const data = await res.json()
    return json(data)
  } catch (e) {
    if (e instanceof DOMException && e.name === 'AbortError') {
      return json({ error: 'OMNI did not respond in time' }, 504)
    }
    // Never interpolate the caught error into the response or a log line —
    // it can carry the fetch URL (and therefore the OMNI credentials).
    return json({ error: 'Could not reach OMNI' }, 502)
  } finally {
    clearTimeout(timeout)
  }
})

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
  })
}
