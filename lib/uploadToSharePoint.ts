import { getGraphToken } from "./graphAuth"

type UploadBytesInput = {
  bytes: Uint8Array | ArrayBuffer
  fileName: string
  contentType?: string
}

function toUint8Array(bytes: Uint8Array | ArrayBuffer) {
  return bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes)
}

export async function uploadToSharePoint(
  fileOrBytes: File | UploadBytesInput,
  cedula: string
): Promise<string> {
  const token = await getGraphToken()

  let bodyBytes: Uint8Array
  let finalFileName: string
  let contentType = "application/octet-stream"

  // ✅ Caso 1: llega File (compatibilidad)
  if (typeof (fileOrBytes as File)?.arrayBuffer === "function") {
    const file = fileOrBytes as File
    const ab = await file.arrayBuffer()
    bodyBytes = new Uint8Array(ab)

    // Si no quieres que cambie el nombre, puedes usar solo file.name
    finalFileName = `${cedula}_${Date.now()}_${file.name}`
    contentType = file.type || contentType
  } else {
    // ✅ Caso 2: llega bytes (recomendado)
    const input = fileOrBytes as UploadBytesInput
    bodyBytes = toUint8Array(input.bytes)
    finalFileName = `${cedula}_${Date.now()}_${input.fileName}`
    contentType = input.contentType || contentType
  }

  // ⚠️ Ajusta estos envs a los que ya usas en tu proyecto
  const siteId = process.env.SHAREPOINT_SITE_ID!
  const library = process.env.SHAREPOINT_LIBRARY! // ej: "Consentimientos"
  // library puede ser ruta completa dentro del drive/root

  const uploadUrl = `https://graph.microsoft.com/v1.0/sites/${siteId}/drive/root:/${library}/${finalFileName}:/content`

  const response = await fetch(uploadUrl, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": contentType,
    },
    body: bodyBytes, // ✅ Uint8Array es BodyInit
  })

  if (!response.ok) {
    const error = await response.text().catch(() => "")
    throw new Error(`Error subiendo archivo: ${response.status} ${error}`)
  }

  const data: any = await response.json()
  return data.webUrl || ""
}
