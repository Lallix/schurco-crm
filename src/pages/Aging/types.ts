export interface OmniAgingRecord {
  currency: string
  customer_account: string
  customer_name: string
  unallocated_credits: number | null
  outstanding_balance: number
  current: number
  '30_days': number
  '60_days': number
  '90_days': number
  '120_days_and_over': number
  local_balance: number
  credit_limit: number
}

export interface OmniAgingResponse {
  customer_ageing: OmniAgingRecord[]
}
