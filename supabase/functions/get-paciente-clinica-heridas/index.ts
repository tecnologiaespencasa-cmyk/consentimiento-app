/**
 * Edge Function: get-paciente-clinica-heridas
 *
 * Unica puerta de entrada de LECTURA del puente. La invoca el portal
 * administrativo (Next.js, server-side) por HTTPS con autenticacion bearer +
 * firma HMAC de la peticion. Es independiente de `sync-pacientes-heridas`,
 * que sigue siendo la unica puerta de escritura y no se toca.
 *
 * Secretos requeridos (Supabase > Edge Functions > Secrets):
 *   BRIDGE_QUERY_API_SECRET  autenticacion y firma de la peticion de consulta
 *                            (DISTINTO de BRIDGE_API_SECRET, que es de escritura)
 *   BRIDGE_HMAC_SECRET       derivacion de documento_hmac
 *   BRIDGE_ENCRYPTION_KEY    clave AES-256 que descifra nombre_encrypted
 * SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY los inyecta la plataforma.
 *
 * BRIDGE_HMAC_SECRET y BRIDGE_ENCRYPTION_KEY no salen nunca de aqui: el portal
 * no las conoce, no las necesita y no puede descifrar nada por su cuenta.
 *
 * La funcion se despliega con verify_jwt = false: no usamos JWT de Supabase,
 * la autenticacion propia (bearer + firma + timestamp + nonce) es la barrera.
 */

import { handleRequest, type LookupResult } from "./handler.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const BRIDGE_QUERY_API_SECRET = Deno.env.get("BRIDGE_QUERY_API_SECRET") ?? "";
const BRIDGE_HMAC_SECRET = Deno.env.get("BRIDGE_HMAC_SECRET") ?? "";
const BRIDGE_ENCRYPTION_KEY = Deno.env.get("BRIDGE_ENCRYPTION_KEY") ?? "";

/**
 * Busca la fila llamando por RPC a public.bridge_get_paciente_heridas con la
 * service_role key. La tabla bridge.pacientes_heridas sigue sin conceder
 * permisos a ningun rol de PostgREST: el unico acceso es esta funcion
 * SECURITY DEFINER, que ademas consume el nonce anti-replay.
 *
 * Devuelve el sobre cifrado y paciente_ref (UUID aleatorio de la fila, generado
 * por la base de datos y estable durante toda la vida del paciente).
 */
async function lookup(requestId: string, documentoHmac: string): Promise<LookupResult> {
  const response = await fetch(
    `${SUPABASE_URL}/rest/v1/rpc/bridge_get_paciente_heridas`,
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        apikey: SERVICE_ROLE_KEY,
        authorization: `Bearer ${SERVICE_ROLE_KEY}`,
      },
      body: JSON.stringify({
        p_request_id: requestId,
        p_documento_hmac: documentoHmac,
      }),
    },
  );

  if (!response.ok) {
    // El cuerpo de error de PostgREST no contiene datos personales (la funcion
    // solo recibe HMAC), pero se recorta por prudencia.
    const detalle = (await response.text()).slice(0, 200);
    throw new Error(`rpc_failed:${response.status}:${detalle}`);
  }

  const data = await response.json() as {
    replay: boolean;
    nombre_encrypted: string | null;
    paciente_ref: string | null;
  };

  if (data.replay) return { replay: true };
  return {
    replay: false,
    nombreEncrypted: data.nombre_encrypted ?? null,
    pacienteRef: data.paciente_ref ?? null,
  };
}

Deno.serve(async (request: Request) => {
  if (
    !BRIDGE_QUERY_API_SECRET || !BRIDGE_HMAC_SECRET || !BRIDGE_ENCRYPTION_KEY ||
    !SUPABASE_URL || !SERVICE_ROLE_KEY
  ) {
    console.error(JSON.stringify({ evt: "missing_configuration" }));
    return new Response(
      JSON.stringify({
        success: false,
        error: "not_configured",
        message: "Faltan secretos en la Edge Function.",
      }),
      { status: 500, headers: { "content-type": "application/json; charset=utf-8" } },
    );
  }

  try {
    return await handleRequest(request, {
      queryApiSecret: BRIDGE_QUERY_API_SECRET,
      hmacSecret: BRIDGE_HMAC_SECRET,
      encryptionKey: BRIDGE_ENCRYPTION_KEY,
      lookup,
      log: (entry) => console.log(JSON.stringify(entry)),
    });
  } catch (error) {
    const mensaje = error instanceof Error ? error.message : "error_desconocido";
    console.error(JSON.stringify({ evt: "unhandled_error", detail: mensaje.slice(0, 200) }));
    return new Response(
      JSON.stringify({
        success: false,
        error: "internal_error",
        message: "No fue posible completar la consulta.",
      }),
      { status: 500, headers: { "content-type": "application/json; charset=utf-8" } },
    );
  }
});
