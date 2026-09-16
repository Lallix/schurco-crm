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
}

// Live, read-only proxy to OMNI's Outstanding Sales Orders report via the
// omni-orders Edge Function — nothing is ever cached or written back.
// Shared by every page that shows order data (Orders page, client detail
// panel, dashboard widget) so there's one place that knows the response
// shape and one place to fix if it ever changes.
//
// Silently refreshes and retries once on a 401 (an expired access token —
// the same failure mode seen on the Client Aging page when a tab sits idle
// past its token's lifetime) before surfacing an error to the caller.
export async function fetchOmniOrders(): Promise<FetchOmniOrdersResult> {
  return fetchOnce(false)
}

async function fetchOnce(isRetry: boolean): Promise<FetchOmniOrdersResult> {
  const { data, error } = await supabase.functions.invoke('omni-orders')

  if (!isRetry && error instanceof FunctionsHttpError && error.context?.status === 401) {
    const { error: refreshError } = await supabase.auth.refreshSession()
    if (!refreshError) return fetchOnce(true)
  }

  if (error) return { orders: [], error: error.message }

  const body = data as (OmniOrdersResponse & { error?: string }) | null
  if (body?.error) return { orders: [], error: body.error }

  return { orders: body?.api___outstanding_sales_orders ?? [], error: null }
}
