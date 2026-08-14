/**
 * Logica pura de la Edge Function get-paciente-clinica-heridas.
 *
 * Esta separada de index.ts (que solo resuelve variables de entorno y hace el
 * RPC contra PostgREST) para poder ejecutarla en pruebas sin Deno ni Docker.
 *
 * REGLAS DE LOGGING: aqui NUNCA se escribe documento, nombre, documento_hmac,
 * nombre_hmac, nombre_encrypted, payload ni secretos. Solo metadatos tecnicos.
 */

import {
  computeRequestSignature,
  hmacHex,
  importHmacKey,
  normalizeDocument,
  timingSafeEqual,
} from "./normalize.ts";
import { decryptName, importEncryptionKey } from "./crypto.ts";

const DEFAULT_MAX_BODY_BYTES = 4096; // la peticion es un unico documento
const DEFAULT_TIMESTAMP_TOLERANCE_SECONDS = 300; // +/- 5 minutos
const REQUEST_ID_PATTERN = /^[A-Za-z0-9-]{8,64}$/;
const MAX_DOCUMENT_INPUT = 64;

/** Patron de UUID: valida la referencia opaca antes de devolverla. */
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Lo que devuelve la busqueda en la base: el sobre cifrado y la referencia
 * opaca del paciente. Nunca documento_hmac ni nombre_hmac.
 */
export type LookupResult = { replay: true } | {
  replay: false;
  nombreEncrypted: string | null;
  pacienteRef: string | null;
};

export type HandlerDeps = {
  /** BRIDGE_QUERY_API_SECRET: autentica y firma la peticion del portal. */
  queryApiSecret: string;
  /** BRIDGE_HMAC_SECRET: deriva documento_hmac. Nunca sale de Supabase. */
  hmacSecret: string;
  /** BRIDGE_ENCRYPTION_KEY: descifra nombre_encrypted. Nunca sale de Supabase. */
  encryptionKey: string;
  /** Consume el nonce del requestId y busca la fila por documento_hmac. */
  lookup: (requestId: string, documentoHmac: string) => Promise<LookupResult>;
  log?: (entry: Record<string, unknown>) => void;
  now?: () => number;
  maxBodyBytes?: number;
  timestampToleranceSeconds?: number;
};

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}

function fail(status: number, error: string, message: string): Response {
  return jsonResponse(status, { success: false, error, message });
}

export async function handleRequest(
  request: Request,
  deps: HandlerDeps,
): Promise<Response> {
  const log = deps.log ?? (() => {});
  const now = deps.now ?? (() => Math.floor(Date.now() / 1000));
  const maxBodyBytes = deps.maxBodyBytes ?? DEFAULT_MAX_BODY_BYTES;
  const tolerance = deps.timestampToleranceSeconds ?? DEFAULT_TIMESTAMP_TOLERANCE_SECONDS;
  const startedAt = Date.now();

  // 1. Metodo -------------------------------------------------------------
  // Solo POST: el documento nunca puede viajar en una URL ni quedar en logs
  // de acceso, historial o cabeceras Referer.
  if (request.method !== "POST") {
    return fail(405, "method_not_allowed", "Solo se acepta POST.");
  }

  // 2. Content-Type -------------------------------------------------------
  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().includes("application/json")) {
    return fail(415, "unsupported_media_type", "Content-Type debe ser application/json.");
  }

  // 3. Cabeceras obligatorias --------------------------------------------
  const authorization = request.headers.get("authorization") ?? "";
  const timestampHeader = request.headers.get("x-bridge-timestamp") ?? "";
  const requestIdHeader = request.headers.get("x-bridge-request-id") ?? "";
  const signatureHeader = (request.headers.get("x-bridge-signature") ?? "").toLowerCase();

  if (!authorization || !timestampHeader || !requestIdHeader || !signatureHeader) {
    return fail(401, "missing_headers", "Faltan cabeceras de autenticacion o firma.");
  }
  if (!REQUEST_ID_PATTERN.test(requestIdHeader)) {
    return fail(400, "invalid_request_id", "X-Bridge-Request-Id no tiene un formato valido.");
  }

  // 4. Autenticacion (bearer con comparacion en tiempo constante) --------
  //    Secreto propio de consulta: NO se reutiliza BRIDGE_API_SECRET (escritura)
  //    ni BRIDGE_HMAC_SECRET / BRIDGE_ENCRYPTION_KEY (criptografia de datos).
  const bearer = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
  if (!bearer || !(await timingSafeEqual(bearer, deps.queryApiSecret))) {
    log({ evt: "auth_failed", requestId: requestIdHeader });
    return fail(401, "unauthorized", "Credenciales invalidas.");
  }

  // 5. Timestamp (anti-replay por ventana) --------------------------------
  const timestamp = Number(timestampHeader);
  if (!Number.isInteger(timestamp)) {
    return fail(400, "invalid_timestamp", "X-Bridge-Timestamp debe ser epoch en segundos.");
  }
  const skew = Math.abs(now() - timestamp);
  if (skew > tolerance) {
    log({ evt: "timestamp_rejected", requestId: requestIdHeader, skew });
    return fail(401, "timestamp_out_of_window", "El timestamp esta fuera de la ventana permitida.");
  }

  // 6. Cuerpo y firma -----------------------------------------------------
  const rawBody = await request.text();
  if (new TextEncoder().encode(rawBody).length > maxBodyBytes) {
    return fail(413, "payload_too_large", "El cuerpo de la peticion excede el maximo permitido.");
  }
  const apiKey = await importHmacKey(deps.queryApiSecret);
  const expectedSignature = await computeRequestSignature(
    apiKey,
    timestampHeader,
    requestIdHeader,
    rawBody,
  );
  if (!(await timingSafeEqual(signatureHeader, expectedSignature))) {
    log({ evt: "signature_rejected", requestId: requestIdHeader });
    return fail(401, "invalid_signature", "La firma de la peticion no es valida.");
  }

  // 7. Estructura del payload --------------------------------------------
  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return fail(400, "invalid_json", "El cuerpo no es JSON valido.");
  }
  if (typeof payload !== "object" || payload === null) {
    return fail(400, "invalid_payload", "El cuerpo debe ser un objeto JSON.");
  }
  if (payload.requestId !== requestIdHeader) {
    return fail(400, "request_id_mismatch", "requestId del cuerpo y de la cabecera no coinciden.");
  }
  if (payload.timestamp !== timestamp) {
    return fail(400, "timestamp_mismatch", "timestamp del cuerpo y de la cabecera no coinciden.");
  }
  if (typeof payload.document !== "string") {
    return fail(400, "invalid_payload", "document debe ser una cadena.");
  }
  if (payload.document.length > MAX_DOCUMENT_INPUT) {
    return fail(422, "invalid_document", "El documento excede la longitud maxima.");
  }

  // 8. Normalizacion + HMAC ----------------------------------------------
  //    El documento real solo existe en memoria durante esta peticion: lo que
  //    viaja a la base es exclusivamente su HMAC, que no es reversible.
  const documento = normalizeDocument(payload.document);
  if (documento.length === 0) {
    return fail(422, "empty_document", "El documento esta vacio o no es valido.");
  }

  const hmacKey = await importHmacKey(deps.hmacSecret);
  const documentoHmac = await hmacHex(hmacKey, documento);

  // 9. Lectura (consume el nonce del requestId en la misma operacion) -----
  const resultado = await deps.lookup(requestIdHeader, documentoHmac);
  const elapsedMs = Date.now() - startedAt;

  if (resultado.replay) {
    log({ evt: "replay_rejected", requestId: requestIdHeader, elapsedMs });
    return fail(409, "replay_detected", "El requestId ya fue procesado.");
  }

  // Sin fila no hay nada que devolver: ni nombre ni referencia. La respuesta de
  // "no encontrado" es deliberadamente un objeto de una sola clave.
  if (!resultado.nombreEncrypted || !resultado.pacienteRef) {
    log({ evt: "query_ok", requestId: requestIdHeader, found: false, elapsedMs });
    return jsonResponse(200, { found: false });
  }

  // La referencia se valida antes de salir: si la fila estuviera corrupta se
  // trata como error interno en vez de propagar un valor inesperado.
  if (!UUID_PATTERN.test(resultado.pacienteRef)) {
    log({ evt: "invalid_patient_ref", requestId: requestIdHeader, elapsedMs });
    return fail(500, "internal_error", "No fue posible completar la consulta.");
  }

  // 10. Descifrado --------------------------------------------------------
  //     El AAD es el documento_hmac de la propia fila: si el sobre no
  //     pertenece a este paciente, AES-GCM falla al verificar el tag.
  let nombre: string;
  try {
    const encryptionKey = await importEncryptionKey(deps.encryptionKey);
    nombre = await decryptName(encryptionKey, resultado.nombreEncrypted, documentoHmac);
  } catch {
    // No se filtra el motivo criptografico exacto hacia el cliente.
    log({ evt: "decrypt_failed", requestId: requestIdHeader, elapsedMs });
    return fail(500, "internal_error", "No fue posible completar la consulta.");
  }

  log({ evt: "query_ok", requestId: requestIdHeader, found: true, elapsedMs });

  // Se devuelven exclusivamente el nombre y la referencia opaca. Nunca
  // documento_hmac, nombre_hmac, nombre_encrypted, el documento real, claves ni
  // detalles internos.
  //
  // patientRef es un UUID aleatorio generado por la base de datos: no se deriva
  // del documento, asi que exponerlo no permite recuperarlo ni correlacionarlo.
  return jsonResponse(200, {
    found: true,
    patient: { name: nombre, patientRef: resultado.pacienteRef },
  });
}
