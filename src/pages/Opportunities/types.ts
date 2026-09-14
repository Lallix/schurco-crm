export interface PipelineStage {
  id: string
  name: string
  sort_order: number
  color: string
  is_won: boolean
  is_lost: boolean
  deleted_at: string | null
}

export interface LossReason {
  id: string
  name: string
  sort_order: number
  deleted_at: string | null
}

export interface Opportunity {
  id: string
  audit_id: string | null
  pump_id: string | null
  org_id: string | null
  user_id: string | null
  client_id: string | null
  title: string | null
  customer: string | null
  site: string | null
  value: string | null
  stage: string | null
  owner: string | null
  close_date: string | null
  contact_name: string | null
  contact_role: string | null
  notes: string | null
  loss_reason_id: string | null
  loss_notes: string | null
  created_at: string
  updated_at: string
  deleted_at: string | null
  client?: { id: string; name: string } | null
  audit?: { id: string; site: string | null; customer: string | null } | null
  loss_reason?: { id: string; name: string } | null
}

export interface OpportunityInput {
  client_id: string | null
  title: string
  value: string
  stage: string
  owner: string
  close_date: string | null
  contact_name: string
  contact_role: string
  notes: string
  loss_reason_id: string | null
  loss_notes: string
}
