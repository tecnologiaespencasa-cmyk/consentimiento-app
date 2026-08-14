/**
 * ============================================================================
 * DESCIFRADO AUTENTICADO DEL NOMBRE (AES-256-GCM)
 * ============================================================================
 *
 * Contraparte de lectura del cifrado que hace `sync-pacientes-heridas`. Aqui
 * solo se necesita descifrar: esta funcion nunca escribe en el puente.
 *
 * FORMATO DEL SOBRE (contrato con la funcion de escritura):
 *
 *     v1.<nonce>.<ciphertext>
 *
 *   v1          version del sobre
 *   nonce       12 bytes aleatorios, base64url sin relleno (16 caracteres)
 *   ciphertext  texto cifrado + tag de 16 bytes, base64url sin relleno
 *
 * AAD = documento_hmac de la fila. Un ciphertext solo descifra en la fila a la
 * que pertenece: quien tuviera acceso de escritura a la tabla no podria
 * intercambiar nombres entre pacientes sin que el descifrado falle.
 *
 * La clave (BRIDGE_ENCRYPTION_KEY) vive SOLO como secreto de la Edge Function:
 * no esta en el portal Next.js, ni en la tabla, ni en el repositorio, ni en
 * los logs.
 * ============================================================================
 */

const NONCE_BYTES = 12;
const KEY_BYTES = 32; // AES-256
export const ENVELOPE_PATTERN = /^v1\.[A-Za-z0-9_-]{16}\.[A-Za-z0-9_-]+$/;

const encoder = new TextEncoder();
const decoder = new TextDecoder();

function base64UrlDecode(value: string): Uint8Array {
  const relleno = value.replace(/-/g, "+").replace(/_/g, "/");
  const binario = atob(relleno + "=".repeat((4 - (relleno.length % 4)) % 4));
  const bytes = new Uint8Array(binario.length);
  for (let i = 0; i < binario.length; i++) bytes[i] = binario.charCodeAt(i);
  return bytes;
}

/** Acepta la clave en base64 (con o sin relleno) o en hexadecimal. */
function decodeKeyMaterial(secret: string): Uint8Array {
  const limpio = secret.trim();
  if (/^[0-9a-fA-F]{64}$/.test(limpio)) {
    const bytes = new Uint8Array(KEY_BYTES);
    for (let i = 0; i < KEY_BYTES; i++) {
      bytes[i] = parseInt(limpio.substr(i * 2, 2), 16);
    }
    return bytes;
  }
  return base64UrlDecode(limpio);
}

/**
 * Importa BRIDGE_ENCRYPTION_KEY. Falla si no son exactamente 32 bytes: una
 * clave corta degradaria el cifrado en silencio, asi que se cierra el paso.
 */
export async function importEncryptionKey(secret: string): Promise<CryptoKey> {
  const material = decodeKeyMaterial(secret);
  if (material.length !== KEY_BYTES) {
    throw new Error(`encryption_key_invalid_length:${material.length}`);
  }
  return await crypto.subtle.importKey("raw", material, { name: "AES-GCM" }, false, [
    "decrypt",
  ]);
}

/**
 * Descifra un sobre. Lanza si la version no se reconoce, si el sobre esta mal
 * formado, si la clave no es la correcta o si el AAD (documento_hmac) no
 * coincide: AES-GCM verifica el tag antes de devolver nada.
 */
export async function decryptName(
  key: CryptoKey,
  envelope: string,
  documentoHmacAad: string,
): Promise<string> {
  // Se valida el sobre completo antes de decodificar nada: asi una entrada
  // corrupta produce un error controlado y no una excepcion de base64.
  if (!ENVELOPE_PATTERN.test(envelope)) {
    throw new Error("envelope_invalid");
  }
  const partes = envelope.split(".");
  const nonce = base64UrlDecode(partes[1]);
  if (nonce.length !== NONCE_BYTES) {
    throw new Error("envelope_invalid_nonce");
  }
  const descifrado = await crypto.subtle.decrypt(
    {
      name: "AES-GCM",
      iv: nonce,
      tagLength: 128,
      additionalData: encoder.encode(documentoHmacAad),
    },
    key,
    base64UrlDecode(partes[2]),
  );
  return decoder.decode(descifrado);
}
