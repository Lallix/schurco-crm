// Proxies OMNI's Customer Ageing report.
//
// The report URL carries a username/password in its query string — a
// real credential that must never reach the browser or this repo. It's
// read here from the OMNI_URL Edge Function secret (set via the Supabase
// dashboard, not committed anywhere), and only this server-side fetch
// ever sees it. This also sidesteps browser mixed-content blocking,
// since OMNI is plain HTTP and the CRM is served over HTTPS — a
// same-origin HTTPS call to this function is all the browser ever makes.
//
// Any signed-in CRM user can view aging data (matches the app's access
// decision), so this only checks that the caller has a real session —
// no admin/role gate, unlike invite-user and deactivate-user.
import { createClient } from 'jsr:@supabase/supabase-js@2'

Deno.serve(async (req: Request) => {
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

  const omniUrl = Deno.env.get('OMNI_URL')
  if (!omniUrl) {
    return json({ error: 'OMNI_URL is not configured on this project' }, 500)
  }

  try {
    const res = await fetch(omniUrl)
    if (!res.ok) {
      return json({ error: `OMNI returned status ${res.status}` }, 502)
    }
    const data = await res.json()
    return json(data)
  } catch {
    return json({ error: 'Could not reach OMNI' }, 502)
  }
})

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}
