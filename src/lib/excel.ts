import ExcelJS from 'exceljs'
import { supabase } from './supabase'

function normalizeName(s: string) {
  return s.trim().toLowerCase().replace(/\s+/g, ' ')
}

function cellText(v: unknown): string {
  if (v == null) return ''
  if (typeof v === 'object' && 'text' in (v as Record<string, unknown>)) {
    return String((v as { text: unknown }).text ?? '')
  }
  return String(v)
}

export async function exportClientsAndContacts() {
  const [{ data: clients, error: clientsErr }, { data: contacts, error: contactsErr }] = await Promise.all([
    supabase.from('clients').select('*').is('deleted_at', null).order('name'),
    supabase.from('contacts').select('*, client:clients(name)').is('deleted_at', null).order('name'),
  ])
  if (clientsErr) throw clientsErr
  if (contactsErr) throw contactsErr

  const wb = new ExcelJS.Workbook()

  const clientsSheet = wb.addWorksheet('Clients')
  clientsSheet.columns = [
    { header: 'Name', key: 'name', width: 30 },
    { header: 'Type', key: 'type', width: 14 },
    { header: 'Country', key: 'country', width: 16 },
    { header: 'Region', key: 'region', width: 16 },
    { header: 'Address', key: 'address', width: 34 },
    { header: 'Latitude', key: 'lat', width: 12 },
    { header: 'Longitude', key: 'lng', width: 12 },
  ]
  for (const c of clients ?? []) {
    clientsSheet.addRow({
      name: c.name,
      type: c.type ?? '',
      country: c.country ?? '',
      region: c.region ?? '',
      address: c.address ?? '',
      lat: c.location?.lat ?? '',
      lng: c.location?.lng ?? '',
    })
  }

  const contactsSheet = wb.addWorksheet('Contacts')
  contactsSheet.columns = [
    { header: 'Client Name', key: 'client', width: 30 },
    { header: 'Name', key: 'name', width: 24 },
    { header: 'Role', key: 'role', width: 20 },
    { header: 'Email', key: 'email', width: 28 },
    { header: 'Phone', key: 'phone', width: 18 },
    { header: 'Notes', key: 'notes', width: 34 },
  ]
  for (const c of contacts ?? []) {
    contactsSheet.addRow({
      client: c.client?.name ?? '',
      name: c.name,
      role: c.role ?? '',
      email: c.email ?? '',
      phone: c.phone ?? '',
      notes: c.notes ?? '',
    })
  }

  const buffer = await wb.xlsx.writeBuffer()
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `schurco-crm-clients-${new Date().toISOString().slice(0, 10)}.xlsx`
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

export interface ImportSummary {
  clientsCreated: number
  clientsUpdated: number
  contactsCreated: number
  contactsUpdated: number
  contactsSkipped: string[]
  errors: string[]
}

export async function importClientsAndContacts(file: File): Promise<ImportSummary> {
  const summary: ImportSummary = {
    clientsCreated: 0,
    clientsUpdated: 0,
    contactsCreated: 0,
    contactsUpdated: 0,
    contactsSkipped: [],
    errors: [],
  }

  const wb = new ExcelJS.Workbook()
  await wb.xlsx.load(await file.arrayBuffer())

  const clientsSheet = wb.getWorksheet('Clients')
  const contactsSheet = wb.getWorksheet('Contacts')
  if (!clientsSheet && !contactsSheet) {
    summary.errors.push('No "Clients" or "Contacts" sheet found in this file. Use the exported template as a starting point.')
    return summary
  }

  const { data: existingClients, error: exErr } = await supabase
    .from('clients')
    .select('id, name')
    .is('deleted_at', null)
  if (exErr) {
    summary.errors.push(exErr.message)
    return summary
  }
  const clientByName = new Map((existingClients ?? []).map((c) => [normalizeName(c.name), c.id]))

  if (clientsSheet) {
    const rows: { name: string; type: string; country: string; region: string; address: string; lat: string; lng: string }[] = []
    clientsSheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return
      const v = row.values as unknown[]
      const name = cellText(v[1]).trim()
      if (!name) return
      rows.push({
        name,
        type: cellText(v[2]).trim(),
        country: cellText(v[3]).trim(),
        region: cellText(v[4]).trim(),
        address: cellText(v[5]).trim(),
        lat: cellText(v[6]).trim(),
        lng: cellText(v[7]).trim(),
      })
    })

    for (const r of rows) {
      const key = normalizeName(r.name)
      const payload: Record<string, unknown> = {
        name: r.name,
        type: r.type || null,
        country: r.country || null,
        region: r.region || null,
        address: r.address || null,
      }
      const latNum = parseFloat(r.lat)
      const lngNum = parseFloat(r.lng)
      if (!Number.isNaN(latNum) && !Number.isNaN(lngNum)) payload.location = { lat: latNum, lng: lngNum }

      const existingId = clientByName.get(key)
      if (existingId) {
        const { error } = await supabase.from('clients').update(payload).eq('id', existingId)
        if (error) summary.errors.push(`Client "${r.name}": ${error.message}`)
        else summary.clientsUpdated++
      } else {
        const { data, error } = await supabase.from('clients').insert(payload).select('id').single()
        if (error) {
          summary.errors.push(`Client "${r.name}": ${error.message}`)
          continue
        }
        clientByName.set(key, data.id)
        summary.clientsCreated++
      }
    }
  }

  if (contactsSheet) {
    const { data: existingContacts } = await supabase
      .from('contacts')
      .select('id, name, client_id')
      .is('deleted_at', null)
    const contactKey = (clientId: string, name: string) => `${clientId}::${normalizeName(name)}`
    const contactByKey = new Map((existingContacts ?? []).map((c) => [contactKey(c.client_id ?? '', c.name), c.id]))

    const rows: { client: string; name: string; role: string; email: string; phone: string; notes: string }[] = []
    contactsSheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return
      const v = row.values as unknown[]
      const name = cellText(v[2]).trim()
      if (!name) return
      rows.push({
        client: cellText(v[1]).trim(),
        name,
        role: cellText(v[3]).trim(),
        email: cellText(v[4]).trim(),
        phone: cellText(v[5]).trim(),
        notes: cellText(v[6]).trim(),
      })
    })

    for (const r of rows) {
      const clientId = clientByName.get(normalizeName(r.client))
      if (!clientId) {
        summary.contactsSkipped.push(`${r.name} (${r.client || 'no client given'})`)
        continue
      }
      const payload = {
        client_id: clientId,
        name: r.name,
        role: r.role || null,
        email: r.email || null,
        phone: r.phone || null,
        notes: r.notes || null,
      }
      const existingId = contactByKey.get(contactKey(clientId, r.name))
      if (existingId) {
        const { error } = await supabase.from('contacts').update(payload).eq('id', existingId)
        if (error) summary.errors.push(`Contact "${r.name}": ${error.message}`)
        else summary.contactsUpdated++
      } else {
        const { error } = await supabase.from('contacts').insert(payload)
        if (error) summary.errors.push(`Contact "${r.name}": ${error.message}`)
        else summary.contactsCreated++
      }
    }
  }

  return summary
}
