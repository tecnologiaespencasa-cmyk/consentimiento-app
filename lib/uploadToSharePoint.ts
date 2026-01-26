import { getGraphToken } from "./graphAuth"

type UploadBytesInput = {
  bytes: Uint8Array | ArrayBuffer
  fileName: string
  contentType?: string
}

function toArrayBufferStrict(bytes: Uint8Array | ArrayBuffer): ArrayBuffer {
  // ✅ Queremos un ArrayBuffer "real" y nuevo (no ArrayBufferLike)
  if (bytes instanceof ArrayBuffer) {
    // hacemos copia para evitar tipado ArrayBufferLike raro en algunos builds
    return bytes.slice(0)
  }

  // bytes es Uint8Array → copiamos a un nuevo Uint8Array para garantizar ArrayBuffer
  const copy = new Uint8Array(bytes.byteLength)
  copy.set(bytes)
  return copy.buffer
}

export async function uploadToSharePoint(
  fileOrBytes: File | UploadBytesInput,
  cedula: string
): Promise<string> {
  const token = await getGraphToken()

  let bodyArrayBuffer: ArrayBuffer
  let finalFileName: string
  let contentType = "application/octet-stream"

  // ✅ Caso 1: llega File (compatibilidad)
  if (typeof (fileOrBytes as File)?.arrayBuffer === "function") {
    const file = fileOrBytes as File
    const ab = await file.arrayBuffer()
    bodyArrayBuffer = toArrayBufferStrict(ab)

    finalFileName = `${cedula}_${Date.now()}_${file.name}`
    contentType = file.type || contentType
  } else {
    // ✅ Caso 2: llega bytes (recomendado)
    const input = fileOrBytes as UploadBytesInput
    bodyArrayBuffer = toArrayBufferStrict(input.bytes)

    finalFileName = `${cedula}_${Date.now()}_${input.fileName}`
    contentType = input.contentType || contentType
  }

  const siteId = process.env.SHAREPOINT_SITE_ID!
  const library = process.env.SHAREPOINT_LIBRARY!

  const uploadUrl = `https://graph.microsoft.com/v1.0/sites/${siteId}/drive/root:/${library}/${finalFileName}:/content`

  const response = await fetch(uploadUrl, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": contentType,
    },
    // ✅ ArrayBuffer compila en cualquier tipado de fetch
    body: bodyArrayBuffer as any,
  })

  if (!response.ok) {
    const error = await response.text().catch(() => "")
    throw new Error(`Error subiendo archivo: ${response.status} ${error}`)
  }

  const data: any = await response.json()
  return data.webUrl || ""
}