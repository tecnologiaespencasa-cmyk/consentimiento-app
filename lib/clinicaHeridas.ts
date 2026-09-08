import "server-only";

import { createHmac, randomUUID } from "node:crypto";
import { prisma } from "@/lib/prisma";

/**
 * Cliente server-side del Bridge de pacientes (Supabase) para el modulo
 * Clinica de Heridas, y politica de rate limiting de las busquedas.
 *
 * ARQUITECTURA
 *   Portal (este archivo) --HTTPS firmado--> Edge Function --> Supabase
 *
 * El portal NO se conecta al sistema productor, NO conoce la base del puente y
 * NO puede descifrar nada: solo posee BRIDGE_QUERY_API_SECRET, que sirve para
 * autenticar y firmar la peticion HTTP. BRIDGE_HMAC_SECRET (documento_hmac) y
 * BRIDGE_ENCRYPTION_KEY (nombre_encrypted) viven exclusivamente en Supabase.
 *
 * PRIVACIDAD
 *   - El documento solo existe en memoria durante la llamada.
 *   - Nunca se persiste, ni se escribe en logs, ni viaja por URL.
 *   - `import "server-only"` hace que el build falle si alguien importa este
 *     modulo desde un componente cliente.
 */

const TIMESTAMP_TOLERANCE_SECONDS = 300; // misma ventana que el Bridge
const REQUEST_TIMEOUT_MS = 10_000;

// --- Rate limiting -----------------------------------------------------------
//
// Este despliegue no tiene Redis (mismo caso que el login), asi que el estado
// vive en PostgreSQL sobre la tabla de auditoria tecnica ClinicaHeridasConsulta.
// La busqueda por documento permite enumerar pacientes, asi que los limites son
// deliberadamente estrictos.
const RATE_USER_WINDOW_MS = 60 * 1000;
const RATE_USER_MAX_PER_MINUTE = 10;
const RATE_USER_HOUR_WINDOW_MS = 60 * 60 * 1000;
const RATE_USER_MAX_PER_HOUR = 120;
const RATE_IP_WINDOW_MS = 60 * 1000;
const RATE_IP_MAX_PER_MINUTE = 30;

export type BusquedaPaciente =
  | { estado: "encontrado"; nombre: string; pacienteRef: string }
  | { estado: "no_encontrado" }
  | { estado: "documento_invalido" }
  | { estado: "error" };

/**
 * Referencia opaca del paciente emitida por el Bridge: un UUID aleatorio que
 * NO se deriva del documento. Es el unico identificador de paciente que el
 * portal puede persistir.
 */
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function esPacienteRefValido(valor: unknown): valor is string {
  return typeof valor === "string" && UUID_REGEX.test(valor);
}

export type RateLimitDecision = {
  permitido: boolean;
  retryAfterSeconds: number;
};

/**
 * Validacion de forma del documento ANTES de salir del portal: alfanumerico,
 * con separadores de uso comun. No reimplementa la normalizacion canonica (esa
 * es responsabilidad exclusiva de la Edge Function), solo evita gastar una
 * llamada al Bridge con basura.
 */
export function documentoTieneFormatoValido(documento: string): boolean {
  if (typeof documento !== "string") return false;
  const limpio = documento.trim();
  if (limpio.length === 0 || limpio.length > 30) return false;
  if (!/^[A-Za-z0-9.\-\s]+$/.test(limpio)) return false;
  // Debe quedar al menos un alfanumerico y como maximo 20 (formato de cedula).
  const alfanumericos = limpio.replace(/[^A-Za-z0-9]/g, "");
  return alfanumericos.length >= 4 && alfanumericos.length <= 20;
}

/** Enmascara el documento para la interfaz: solo los ultimos 3 caracteres. */
export function enmascararDocumento(documento: string): string {
  const limpio = documento.replace(/[^A-Za-z0-9]/g, "");
  if (limpio.length <= 3) return "*".repeat(limpio.length);
  return "*".repeat(limpio.length - 3) + limpio.slice(-3);
}

export function getClientIp(headers: Headers): string {
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  return headers.get("x-real-ip") || "unknown";
}

/**
 * Evalua el rate limiting antes de tocar el Bridge. Cuenta sobre la auditoria
 * tecnica, que no contiene ningun dato personal.
 */
export async function evaluarRateLimit(params: {
  usuarioId: string;
  ip: string;
}): Promise<RateLimitDecision> {
  const ahora = Date.now();
  const desdeMinutoUsuario = new Date(ahora - RATE_USER_WINDOW_MS);
  const desdeHoraUsuario = new Date(ahora - RATE_USER_HOUR_WINDOW_MS);
  const desdeMinutoIp = new Date(ahora - RATE_IP_WINDOW_MS);

  const [porMinutoUsuario, porHoraUsuario, porMinutoIp] = await Promise.all([
    prisma.clinicaHeridasConsulta.count({
      where: { usuarioId: params.usuarioId, createdAt: { gte: desdeMinutoUsuario } },
    }),
    prisma.clinicaHeridasConsulta.count({
      where: { usuarioId: params.usuarioId, createdAt: { gte: desdeHoraUsuario } },
    }),
    params.ip && params.ip !== "unknown"
      ? prisma.clinicaHeridasConsulta.count({
          where: { ip: params.ip, createdAt: { gte: desdeMinutoIp } },
        })
      : Promise.resolve(0),
  ]);

  if (porMinutoUsuario >= RATE_USER_MAX_PER_MINUTE) {
    return { permitido: false, retryAfterSeconds: 60 };
  }
  if (porMinutoIp >= RATE_IP_MAX_PER_MINUTE) {
    return { permitido: false, retryAfterSeconds: 60 };
  }
  if (porHoraUsuario >= RATE_USER_MAX_PER_HOUR) {
    return { permitido: false, retryAfterSeconds: 900 };
  }
  return { permitido: true, retryAfterSeconds: 0 };
}

/**
 * Auditoria tecnica de la consulta. Registra QUIEN consulto y COMO termino,
 * nunca QUE consulto: sin documento, sin nombre, sin HMAC, sin payload.
 */
export async function registrarConsulta(params: {
  usuarioId: string;
  ip: string;
  requestId: string;
  ok: boolean;
  status: number;
  durationMs: number;
}): Promise<void> {
  try {
    await prisma.clinicaHeridasConsulta.create({
      data: {
        usuarioId: params.usuarioId,
        ip: params.ip.slice(0, 100),
        requestId: params.requestId.slice(0, 64),
        ok: params.ok,
        status: params.status,
        durationMs: Math.max(0, Math.round(params.durationMs)),
      },
    });
  } catch (error) {
    // La auditoria nunca debe romper el flujo de la busqueda.
    console.error("clinica-heridas: no se pudo registrar la consulta", {
      motivo: error instanceof Error ? error.name : "desconocido",
    });
  }
}

/**
 * Estado del ingreso del paciente al programa de clinica de heridas.
 *
 * Un paciente puede recibir el alta y reingresar. Solo se admiten seguimientos
 * mientras haya un ingreso abierto, y cada seguimiento queda atado al numero de
 * ingreso vigente para que las atenciones no se mezclen.
 */
export type EstadoIngreso =
  | { estado: "activo"; ingresoActual: number }
  | { estado: "sin_ingreso_activo" }
  | { estado: "no_esta_en_censo" }
  | { estado: "error" };

/**
 * La validacion de ingreso depende de piezas que viven en el puente (la tabla
 * `bridge.ingresos_heridas` y la Edge Function `estado-paciente-heridas`) y de
 * que la intranet ya este publicando los ingresos.
 *
 * Mientras eso no este desplegado, la bandera queda apagada y el modulo se
 * comporta como hasta ahora. Encenderla antes de tiempo bloquearia TODOS los
 * seguimientos, porque la regla ante un fallo del puente es cerrar la puerta.
 */
export function validacionIngresoActiva(): boolean {
  return process.env.BRIDGE_VALIDACION_INGRESO === "true";
}

/**
 * Secreto con el que se firma la consulta de estado.
 *
 * Por defecto se usa el secreto de LECTURA. La funcion de estado solo lee, y
 * darle al portal el secreto de escritura le permitiria tambien sincronizar
 * pacientes, que es justo la separacion que el puente busca mantener. Si el
 * equipo del puente decidiera exigir otro secreto, basta configurarlo sin tocar
 * codigo.
 */
function secretoEstado(): string {
  return process.env.BRIDGE_ESTADO_API_SECRET || process.env.BRIDGE_QUERY_API_SECRET || "";
}

/**
 * Pregunta al puente si el paciente tiene un ingreso abierto y cual es.
 *
 * Falla CERRADO: cualquier error de red, de firma o de formato devuelve
 * "error", y quien llama debe bloquear. Un puente caido no puede abrir la
 * puerta a registrar sobre un paciente que ya recibio el alta.
 *
 * @param documento documento tal cual lo escribio el usuario. Solo se usa para
 *                  construir el cuerpo; la funcion normaliza y calcula el HMAC
 *                  dentro de Supabase.
 */
export async function consultarEstadoIngreso(
  documento: string,
  requestId: string,
): Promise<EstadoIngreso> {
  const baseUrl = (process.env.SUPABASE_PROJECT_URL ?? "").replace(/\/+$/, "");
  const secret = secretoEstado();

  if (!baseUrl || !secret) {
    console.error("clinica-heridas: consulta de ingreso sin configurar", { requestId });
    return { estado: "error" };
  }

  const timestamp = Math.floor(Date.now() / 1000);
  // El cuerpo se serializa UNA sola vez y se firma esa misma cadena: volver a
  // serializar podria reordenar claves y la firma dejaria de coincidir.
  const rawBody = JSON.stringify({ requestId, timestamp, document: documento });
  const firma = createHmac("sha256", secret)
    .update(`${timestamp}.${requestId}.${rawBody}`)
    .digest("hex");

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const respuesta = await fetch(`${baseUrl}/functions/v1/estado-paciente-heridas`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${secret}`,
        "x-bridge-timestamp": String(timestamp),
        "x-bridge-request-id": requestId,
        "x-bridge-signature": firma,
      },
      body: rawBody,
      signal: controller.signal,
      cache: "no-store",
    });

    if (!respuesta.ok) {
      console.error("clinica-heridas: respuesta no OK al consultar el ingreso", {
        requestId,
        status: respuesta.status,
      });
      return { estado: "error" };
    }

    const datos = (await respuesta.json()) as {
      found?: boolean;
      canRegister?: boolean;
      currentAdmission?: unknown;
    };

    if (datos.found !== true) return { estado: "no_esta_en_censo" };
    if (datos.canRegister !== true) return { estado: "sin_ingreso_activo" };

    // Un ingreso activo debe traer su numero. Sin el no se puede etiquetar el
    // seguimiento, y etiquetarlo mal es peor que no registrarlo.
    const ingresoActual = datos.currentAdmission;
    if (typeof ingresoActual !== "number" || !Number.isInteger(ingresoActual) || ingresoActual < 1) {
      console.error("clinica-heridas: ingreso activo sin numero valido", { requestId });
      return { estado: "error" };
    }

    return { estado: "activo", ingresoActual };
  } catch (error) {
    console.error("clinica-heridas: fallo consultando el ingreso", {
      requestId,
      motivo: error instanceof Error ? error.name : "desconocido",
    });
    return { estado: "error" };
  } finally {
    clearTimeout(timeout);
  }
}

/** Mensaje que ve el usuario para cada motivo de bloqueo. */
export function mensajeBloqueoIngreso(estado: EstadoIngreso["estado"]): string {
  switch (estado) {
    case "sin_ingreso_activo":
      return "Este paciente no tiene un ingreso activo en clinica de heridas.";
    case "no_esta_en_censo":
      return "Este paciente no esta en el censo de clinica de heridas.";
    default:
      return "No fue posible verificar el ingreso del paciente. Intente nuevamente.";
  }
}

/** Comprueba que las variables de entorno del Bridge estan configuradas. */
export function bridgeConfigurado(): boolean {
  return Boolean(process.env.SUPABASE_PROJECT_URL && process.env.BRIDGE_QUERY_API_SECRET);
}

/**
 * Consulta el Bridge. Devuelve como maximo el nombre del paciente.
 *
 * @param documento documento tal cual lo escribio el usuario. Solo se usa para
 *                  construir el cuerpo de la peticion; no se registra en ningun
 *                  sitio ni se devuelve.
 */
export async function buscarPacienteEnBridge(
  documento: string,
  requestId: string,
): Promise<BusquedaPaciente> {
  const baseUrl = (process.env.SUPABASE_PROJECT_URL ?? "").replace(/\/+$/, "");
  const secret = process.env.BRIDGE_QUERY_API_SECRET ?? "";

  if (!baseUrl || !secret) {
    console.error("clinica-heridas: bridge sin configurar", { requestId });
    return { estado: "error" };
  }

  const timestamp = Math.floor(Date.now() / 1000);
  const rawBody = JSON.stringify({ requestId, timestamp, document: documento });
  const firma = createHmac("sha256", secret)
    .update(`${timestamp}.${requestId}.${rawBody}`)
    .digest("hex");

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const respuesta = await fetch(`${baseUrl}/functions/v1/get-paciente-clinica-heridas`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${secret}`,
        "x-bridge-timestamp": String(timestamp),
        "x-bridge-request-id": requestId,
        "x-bridge-signature": firma,
      },
      body: rawBody,
      signal: controller.signal,
      cache: "no-store",
    });

    if (respuesta.status === 422 || respuesta.status === 400) {
      return { estado: "documento_invalido" };
    }
    if (!respuesta.ok) {
      // Se registra solo el codigo: el cuerpo del Bridge no se propaga.
      console.error("clinica-heridas: respuesta no OK del bridge", {
        requestId,
        status: respuesta.status,
      });
      return { estado: "error" };
    }

    const datos = (await respuesta.json()) as {
      found?: boolean;
      patient?: { name?: unknown; patientRef?: unknown };
    };

    if (datos.found !== true) return { estado: "no_encontrado" };

    const nombre = typeof datos.patient?.name === "string" ? datos.patient.name.trim() : "";
    const pacienteRef = datos.patient?.patientRef;

    // Un paciente encontrado debe traer siempre las dos piezas. Si falta
    // alguna, la respuesta del puente no es utilizable.
    if (!nombre || !esPacienteRefValido(pacienteRef)) {
      console.error("clinica-heridas: respuesta del bridge incompleta", { requestId });
      return { estado: "error" };
    }
    return { estado: "encontrado", nombre, pacienteRef };
  } catch (error) {
    console.error("clinica-heridas: fallo llamando al bridge", {
      requestId,
      motivo: error instanceof Error ? error.name : "desconocido",
    });
    return { estado: "error" };
  } finally {
    clearTimeout(timeout);
  }
}

export function nuevoRequestId(): string {
  return randomUUID();
}

/** Umbrales expuestos para las pruebas y la documentacion del modulo. */
export const LIMITES_BUSQUEDA = {
  usuarioPorMinuto: RATE_USER_MAX_PER_MINUTE,
  usuarioPorHora: RATE_USER_MAX_PER_HOUR,
  ipPorMinuto: RATE_IP_MAX_PER_MINUTE,
  ventanaFirmaSegundos: TIMESTAMP_TOLERANCE_SECONDS,
} as const;
