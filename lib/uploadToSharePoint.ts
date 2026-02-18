import { getGraphToken } from "./graphAuth";

type UploadBytesInput = {
  bytes: Uint8Array | ArrayBuffer;
  fileName: string;
  contentType?: string;
};

function toArrayBufferStrict(bytes: Uint8Array | ArrayBuffer): ArrayBuffer {
  if (bytes instanceof ArrayBuffer) return bytes.slice(0);
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return copy.buffer;
}

export type SharePointUploadResult = {
  webUrl: string;
  id: string;
  name: string;
  mimeType: string | null;
};

export async function uploadToSharePoint(
  fileOrBytes: File | UploadBytesInput,
  cedula: string
): Promise<string> {
  const result = await uploadToSharePointWithInfo(fileOrBytes, cedula);
  return result.webUrl || "";
}

// ✅ NUEVO: options con folder
export async function uploadToSharePointWithInfo(
  fileOrBytes: File | UploadBytesInput,
  cedula: string,
  options?: { folder?: string } // <-- NUEVO
): Promise<SharePointUploadResult> {
  const token = await getGraphToken();

  let bodyArrayBuffer: ArrayBuffer;
  let finalFileName: string;
  let contentType = "application/octet-stream";

  if (typeof (fileOrBytes as File)?.arrayBuffer === "function") {
    const file = fileOrBytes as File;
    const ab = await file.arrayBuffer();
    bodyArrayBuffer = toArrayBufferStrict(ab);

    const safeName = (file.name || "archivo")
      .replace(/\s+/g, "_")
      .replace(/[^a-zA-Z0-9._-]/g, "_");
    finalFileName = `${cedula}_${Date.now()}_${safeName}`;
    contentType = file.type || contentType;
  } else {
    const input = fileOrBytes as UploadBytesInput;
    bodyArrayBuffer = toArrayBufferStrict(input.bytes);

    const safeName = (input.fileName || "archivo")
      .replace(/\s+/g, "_")
      .replace(/[^a-zA-Z0-9._-]/g, "_");
    finalFileName = `${cedula}_${Date.now()}_${safeName}`;
    contentType = input.contentType || contentType;
  }

  const siteId = process.env.SHAREPOINT_SITE_ID!;
  const defaultFolder = process.env.SHAREPOINT_LIBRARY!; // tu carpeta de consentimientos
  const folder = (options?.folder || defaultFolder).replace(/^\/+|\/+$/g, "");

  // ✅ Aquí es donde se decide la carpeta destino
  const uploadPath = folder ? `${folder}/${finalFileName}` : finalFileName;

  const uploadUrl = `https://graph.microsoft.com/v1.0/sites/${siteId}/drive/root:/${uploadPath}:/content`;

  const response = await fetch(uploadUrl, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": contentType,
    },
    body: bodyArrayBuffer as any,
  });

  if (!response.ok) {
    const error = await response.text().catch(() => "");
    throw new Error(`Error subiendo archivo: ${response.status} ${error}`);
  }

  const data: any = await response.json();
  const mimeType: string | null = data?.file?.mimeType ?? null;

  return {
    webUrl: data.webUrl || "",
    id: data.id || "",
    name: data.name || finalFileName,
    mimeType,
  };
}
