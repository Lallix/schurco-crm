export const ACTIVITY_TYPES = ['Call', 'Email', 'Site Visit', 'Task', 'Note'] as const
export type ActivityType = (typeof ACTIVITY_TYPES)[number]

export const ACTIVITY_STATUSES = ['Open', 'Done'] as const
export type ActivityStatus = (typeof ACTIVITY_STATUSES)[number]

export interface Activity {
  id: string
  client_id: string | null
  contact_id: string | null
  opportunity_id: string | null
  type: ActivityType
  due_date: string | null
  assigned_to: string | null
  status: ActivityStatus
  notes: string | null
  created_by: string | null
  created_at: string
  updated_at: string
  deleted_at: string | null
  client?: { id: string; name: string } | null
  contact?: { id: string; name: string } | null
  opportunity?: { id: string; title: string | null } | null
  assignee?: { id: string; name: string | null; email: string | null } | null
}

export interface ActivityInput {
  client_id: string | null
  contact_id: string | null
  opportunity_id: string | null
  type: ActivityType
  due_date: string | null
  assigned_to: string | null
  status: ActivityStatus
  notes: string
}
