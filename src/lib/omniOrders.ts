import { FunctionsHttpError } from '@supabase/supabase-js'
import { supabase } from './supabase'

export interface OmniOrderRecord {
  reference: string
  customer_name: string
  customer_account: string
  document_date: string | null
  due_date: string | null
  prom_yyyy_mm_dd: string | null
  sales_rep_name: string | null
  line_sales_category: string | null
  ordered_qty: number
  outstanding_qty_to_deliver: number
  currency_code: string
  value_excl_after_discount: number
  processed_by: string | null
}

interface OmniOrdersResponse {
  api___outstanding_sales_orders: OmniOrderRecord[]
}

export interface FetchOmniOrdersResult {
  orders: OmniOrderRecord[]
  error: string | null
  fetchedAt: Date
}

// Module-level cache — persists across route changes within the same tab
// (navigating to another page and back reuses it) and is only cleared by
// a hard reload, since that re-initializes this module. Shared by every
// page that shows order data (Orders page, client detail panel, dashboard
// widget), so opening any one of them warms the cache for the others too.
let cached: FetchOmniOrdersResult | null = null

// Synchronously reads the current cache without triggering a fetch — lets
// a page initialize its state from warm data on mount, so it never has to
// blank itself to a loading screen just because it remounted.
export function peekOmniOrders(): FetchOmniOrdersResult | null {
  return cached
}

// Live, read-only proxy to OMNI's Outstanding Sales Orders report via the
// omni-orders Edge Function — nothing is ever written back. Pass
// force:true (from an explicit "Refresh" click) to bypass the cache and
// hit OMNI again; a failed fetch is never cached, so the next call — cached
// or not — retries rather than getting stuck on a stale error.
//
// Silently refreshes and retries once on a 401 (an expired access token —
// the same failure mode seen on the Client Aging page when a tab sits idle
// past its token's lifetime) before surfacing an error to the caller.
export async function fetchOmniOrders(force = false): Promise<FetchOmniOrdersResult> {
  if (!force && cached) return cached
  const result = await fetchOnce(false)
  if (!result.error) cached = result
  return result
}

async function fetchOnce(isRetry: boolean): Promise<FetchOmniOrdersResult> {
  const { data, error } = await supabase.functions.invoke('omni-orders')

  if (!isRetry && error instanceof FunctionsHttpError && error.context?.status === 401) {
    const { error: refreshError } = await supabase.auth.refreshSession()
    if (!refreshError) return fetchOnce(true)
  }

  if (error) return { orders: [], error: error.message, fetchedAt: new Date() }

  const body = data as (OmniOrdersResponse & { error?: string }) | null
  if (body?.error) return { orders: [], error: body.error, fetchedAt: new Date() }

  return { orders: body?.api___outstanding_sales_orders ?? [], error: null, fetchedAt: new Date() }
}
