import { FunctionsHttpError } from '@supabase/supabase-js'
import { supabase } from './supabase'
import type { OmniAgingRecord, OmniAgingResponse } from '../pages/Aging/types'

export interface FetchOmniAgingResult {
  records: OmniAgingRecord[]
  error: string | null
  fetchedAt: Date
}

// Module-level cache — persists across route changes within the same tab
// (navigating away from Client Aging and back reuses it) and is only
// cleared by a hard reload, since that re-initializes this module.
let cached: FetchOmniAgingResult | null = null

// Live, read-only proxy to OMNI's Customer Ageing report via the
// omni-aging Edge Function. Pass force:true (from an explicit "Refresh"
// click) to bypass the cache and hit OMNI again; a failed fetch is never
// cached, so the next call — cached or not — retries rather than getting
// stuck on a stale error.
//
// Silently refreshes and retries once on a 401 (an expired access token —
// a tab left open past its session lifetime) before surfacing an error.
export async function fetchOmniAging(force = false): Promise<FetchOmniAgingResult> {
  if (!force && cached) return cached
  const result = await fetchOnce(false)
  if (!result.error) cached = result
  return result
}

async function fetchOnce(isRetry: boolean): Promise<FetchOmniAgingResult> {
  const { data, error } = await supabase.functions.invoke('omni-aging')

  if (!isRetry && error instanceof FunctionsHttpError && error.context?.status === 401) {
    const { error: refreshError } = await supabase.auth.refreshSession()
    if (!refreshError) return fetchOnce(true)
  }

  if (error) return { records: [], error: error.message, fetchedAt: new Date() }

  const body = data as (OmniAgingResponse & { error?: string }) | null
  if (body?.error) return { records: [], error: body.error, fetchedAt: new Date() }

  return { records: body?.customer_ageing ?? [], error: null, fetchedAt: new Date() }
}
