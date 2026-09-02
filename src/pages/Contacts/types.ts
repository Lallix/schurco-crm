export const CONTACT_ROLES = [
  'Plant Engineer',
  'Head of Engineering',
  'Maintenance Foreman',
  'Store Manager',
  'Procurement Manager',
  'Plant Manager',
  'Production Manager',
  'Other',
] as const
export type ContactRole = (typeof CONTACT_ROLES)[number]

export interface Contact {
  id: string
  client_id: string | null
  name: string
  role: ContactRole | null
  email: string | null
  phone: string | null
  notes: string | null
  created_at: string
  updated_at: string
  deleted_at: string | null
  deleted_by: string | null
  client?: { id: string; name: string } | null
}

export type ContactInput = Pick<Contact, 'client_id' | 'name' | 'role' | 'email' | 'phone' | 'notes'>
