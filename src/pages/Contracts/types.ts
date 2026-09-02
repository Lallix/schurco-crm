export const CONTRACT_STATUSES = ['Draft', 'Active', 'Under Review', 'Terminated', 'Expired'] as const
export type ContractStatus = (typeof CONTRACT_STATUSES)[number]

export interface Contract {
  id: string
  client_id: string
  opportunity_id: string | null
  contract_type: string | null
  status: ContractStatus | null
  start_date: string | null
  end_date: string | null
  termination_notice_period: string | null
  has_termination_for_convenience_clause: boolean
  termination_clause_notes: string | null
  document_path: string | null
  created_at: string
  updated_at: string
  deleted_at: string | null
  deleted_by: string | null
  client?: { id: string; name: string } | null
}

export interface ContractInput {
  client_id: string
  opportunity_id: string | null
  contract_type: string
  status: ContractStatus
  start_date: string | null
  end_date: string | null
  termination_notice_period: string
  has_termination_for_convenience_clause: boolean
  termination_clause_notes: string
}
