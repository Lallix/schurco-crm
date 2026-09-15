// Admin-only: suspends or restores a teammate's login.
//
// Login is shared with the Site Audit App, so this affects both apps —
// the CRM's UI warns about that before calling this. Same pattern as
// invite-user: the caller's session proves who they are, this function
// independently checks they're an Admin, and only then uses the service
// role key (never exposed client-side) to ban/unban via the Admin API.
import { createClient } from 'jsr:@supabase/supabase-js@2'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS })
  }
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

  let body: { userId?: string; deactivate?: boolean }
  try {
    body = await req.json()
  } catch {
    return json({ error: 'Invalid request body' }, 400)
  }

  const { userId, deactivate } = body
  if (!userId || typeof deactivate !== 'boolean') {
    return json({ error: 'userId and deactivate are required' }, 400)
  }
  if (userId === userData.user.id) {
    return json({ error: "You can't deactivate your own account" }, 400)
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey)

  const { error: banError } = await adminClient.auth.admin.updateUserById(userId, {
    ban_duration: deactivate ? '87600h' : 'none',
  })
  if (banError) {
    return json({ error: banError.message }, 400)
  }

  const { error: updateError } = await adminClient
    .from('profiles')
    .update({ deactivated_at: deactivate ? new Date().toISOString() : null })
    .eq('id', userId)
  if (updateError) {
    return json({ error: updateError.message }, 400)
  }

  return json({ ok: true })
})

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
  })
}
