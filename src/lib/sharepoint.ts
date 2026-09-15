import { supabase } from './supabase'

// Graph's own limits are much higher, but a generous cap here keeps a
// mis-click (a whole scanned folder, a video) from tying up the browser
// tab base64-encoding a huge file before failing anyway.
const MAX_CONTRACT_BYTES = 20 * 1024 * 1024

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve((reader.result as string).split(',')[1] ?? '')
    reader.onerror = () => reject(reader.error ?? new Error('Could not read file'))
    reader.readAsDataURL(file)
  })
}

// Uploads a contract document to the shared SharePoint site, into
// "Schurco Contracts/{client name}/{file name}" — the same Graph app
// registration the Site Audit App uses for its own photo/Excel sync.
// Returns the document's SharePoint webUrl to store on the contract row.
export async function uploadContractDocument(clientName: string, file: File): Promise<string> {
  if (file.size > MAX_CONTRACT_BYTES) {
    throw new Error(`File is too large (${(file.size / 1024 / 1024).toFixed(1)}MB) — the limit is 20MB.`)
  }

  const file_base64 = await fileToBase64(file)
  const { data, error } = await supabase.functions.invoke('sharepoint-upload', {
    body: {
      mode: 'contract',
      client_name: clientName,
      file_name: file.name,
      file_base64,
      content_type: file.type || 'application/octet-stream',
    },
  })
  if (error) throw error
  if (!data?.success) throw new Error(data?.error || 'Upload to SharePoint failed')
  return data.url as string
}
