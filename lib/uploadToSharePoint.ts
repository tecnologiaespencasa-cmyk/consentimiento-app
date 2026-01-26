import { getGraphToken } from "./graphAuth"
import { Buffer } from "buffer"

type UploadBytesInput = {
  bytes: Uint8Array | Buffer
  fileName: string
  contentType?: string
}

export async function uploadToSharePoint(
  fileOrBytes: File | UploadBytesInput,
  cedula: string
): Promise<string> {
  const token = await getGraphToken()

  let buffer: Buffer
  let finalFileName: string
  let contentType = "application/octet-stream"

  // ✅ Caso 1: te mandan File (compatibilidad por si aún hay pantallas antiguas)
  if (typeof (fileOrBytes as File)?.arrayBuffer === "function") {
    const file = fileOrBytes as File
    const arrayBuffer = await file.arrayBuffer()
    buffer = Buffer.from(arrayBuffer)
    finalFileName = `${cedula}_${Date.now()}_${file.name}`
    contentType = file.type || contentType
  } else {
    // ✅ Caso 2: te mandan bytes (lo recomendado para Vercel)
    const input = fileOrBytes as UploadBytesInput
    const b = input.bytes
    buffer = Buffer.isBuffer(b) ? b : Buffer.from(b)
    finalFileName = `${cedula}_${Date.now()}_${input.fileName}`
    contentType = input.contentType || contentType
  }

  const uploadUrl = `https://graph.microsoft.com/v1.0/sites/${process.env.SHAREPOINT_SITE_ID}/drive/root:/${process.env.SHAREPOINT_LIBRARY}/${finalFileName}:/content`

  const response = await fetch(uploadUrl, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": contentType,
    },
    body: buffer,
  })

  if (!response.ok) {
    const error = await response.text().catch(() => "")
    throw new Error(`Error subiendo archivo: ${error}`)
  }

  const data = await response.json()
  return data.webUrl
}