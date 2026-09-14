export const CLIENT_TYPES = ['Customer', 'Distributor', 'Prospect', 'Contractor', 'Supplier'] as const
export type ClientType = (typeof CLIENT_TYPES)[number]

export interface Client {
  id: string
  name: string
  type: ClientType | null
  country: string | null
  region: string | null
  address: string | null
  location: { lat: number; lng: number } | null
  created_at: string
  updated_at: string
  updated_by: string | null
  deleted_at: string | null
  deleted_by: string | null
}

export type ClientInput = Pick<Client, 'name' | 'type' | 'country' | 'region' | 'address'>
