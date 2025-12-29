import { getGraphToken } from "./graphAuth";

export async function uploadToSharePoint(
  file: File,
  cedula: string
): Promise<string> {
  const token = await getGraphToken();

  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  const fileName = `${cedula}_${Date.now()}_${file.name}`;

  const uploadUrl = `https://graph.microsoft.com/v1.0/sites/${process.env.SHAREPOINT_SITE_ID}/drive/root:/${process.env.SHAREPOINT_LIBRARY}/${fileName}:/content`;

  const response = await fetch(uploadUrl, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/octet-stream",
    },
    body: buffer,
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Error subiendo archivo: ${error}`);
  }

  const data = await response.json();
  return data.webUrl;
}