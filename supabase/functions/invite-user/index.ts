// Admin-only: invites a new team member by email.
//
// Creating a login requires Supabase's Admin API, which needs the service
// role key — a secret that must never reach the browser. So this runs
// server-side: the caller's own session proves who they are, this function
// independently checks they're an Admin, and only then uses the service
// role key (injected by the Supabase platform, never stored in this repo)
// to send the invite. The invited person sets their own password via the
// email link — this app never sees or handles it.
import { createClient } from 'jsr:@supabase/supabase-js@2'

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405)
  }

  const authHeader = req.headers.get('Authorization')
  if (!authHeader) {
    return json({ error: 'Missing authorization' }, 401)
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

  // Scoped to the caller's own JWT — used only to verify who's asking.
  const callerClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  })

  const { data: userData, error: userError } = await callerClient.auth.getUser()
  if (userError || !userData?.user) {
    return json({ error: 'Invalid session' }, 401)
  }

  const { data: callerProfile, error: profileError } = await callerClient
    .from('profiles')
    .select('is_admin, crm_role')
    .eq('id', userData.user.id)
    .single()

  const isAdmin = !profileError && (callerProfile?.is_admin === true || callerProfile?.crm_role === 'Admin')
  if (!isAdmin) {
    return json({ error: 'Admin access required' }, 403)
  }

  let body: { email?: string; name?: string }
  try {
    body = await req.json()
  } catch {
    return json({ error: 'Invalid request body' }, 400)
  }

  const email = body.email?.trim().toLowerCase()
  const name = body.name?.trim()
  if (!email || !name) {
    return json({ error: 'email and name are required' }, 400)
  }

  // Only this call uses the service role key — never returned, never logged.
  const adminClient = createClient(supabaseUrl, serviceRoleKey)

  const { data: inviteData, error: inviteError } = await adminClient.auth.admin.inviteUserByEmail(email, {
    data: { name },
  })

  if (inviteError) {
    return json({ error: inviteError.message }, 400)
  }

  return json({ id: inviteData.user.id })
})

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}
