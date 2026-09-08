/**
 * Pruebas de la Edge Function `estado-paciente-heridas` (validacion de ingreso).
 *
 *   node scripts/clinica-heridas/bridge-ingreso-selftest.mjs
 *   node scripts/clinica-heridas/bridge-ingreso-selftest.mjs --document 1234567890
 *
 * Cubre la lista de comprobacion del documento de integracion: autenticacion,
 * firma, ventana temporal, documento fuera del censo y forma de la respuesta.
 *
 * El parametro opcional --document permite verificar ademas el camino "paciente
 * con ingreso activo" con un documento real. Ese valor NO se imprime ni se
 * guarda en ningun sitio.
 *
 * Lee SUPABASE_PROJECT_URL y BRIDGE_QUERY_API_SECRET de .env.local. Ningun
 * secreto se escribe en la salida.
 */

import { createHmac, randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";

function cargarEnv() {
  for (const archivo of [".env.local", ".env"]) {
    let contenido;
    try {
      contenido = readFileSync(archivo, "utf8");
    } catch {
      continue;
    }
    for (const linea of contenido.split(/\r?\n/)) {
      const limpia = linea.trim();
      if (!limpia || limpia.startsWith("#")) continue;
      const igual = limpia.indexOf("=");
      if (igual === -1) continue;
      const clave = limpia.slice(0, igual).trim();
      const valor = limpia.slice(igual + 1).trim().replace(/^["']|["']$/g, "");
      if (!(clave in process.env)) process.env[clave] = valor;
    }
  }
}

cargarEnv();

const BASE = (process.env.SUPABASE_PROJECT_URL ?? "").replace(/\/+$/, "");
const SECRET = process.env.BRIDGE_ESTADO_API_SECRET || process.env.BRIDGE_QUERY_API_SECRET || "";
const URL_FUNCION = `${BASE}/functions/v1/estado-paciente-heridas`;

if (!BASE || !SECRET) {
  console.error("Faltan SUPABASE_PROJECT_URL o BRIDGE_QUERY_API_SECRET en .env.local");
  process.exit(1);
}

const argDoc = process.argv.indexOf("--document");
const DOCUMENTO = argDoc !== -1 ? process.argv[argDoc + 1] : null;

function firmar(timestamp, requestId, rawBody) {
  return createHmac("sha256", SECRET)
    .update(`${timestamp}.${requestId}.${rawBody}`)
    .digest("hex");
}

async function llamar({
  document = "00000000000000009999",
  method = "POST",
  contentType = "application/json",
  bearer = SECRET,
  timestamp = Math.floor(Date.now() / 1000),
  requestId = randomUUID(),
  bodyRequestId = undefined,
  firmaInvalida = false,
  omitirCabeceras = false,
} = {}) {
  // El cuerpo se serializa UNA vez y se firma esa misma cadena.
  const rawBody = JSON.stringify({
    requestId: bodyRequestId ?? requestId,
    timestamp,
    document,
  });

  const headers = { "content-type": contentType };
  if (!omitirCabeceras) {
    headers.authorization = `Bearer ${bearer}`;
    headers["x-bridge-timestamp"] = String(timestamp);
    headers["x-bridge-request-id"] = requestId;
    headers["x-bridge-signature"] = firmaInvalida ? "0".repeat(64) : firmar(timestamp, requestId, rawBody);
  }

  const res = await fetch(URL_FUNCION, {
    method,
    headers,
    body: method === "GET" ? undefined : rawBody,
  });
  const raw = await res.text();
  let body = null;
  try {
    body = JSON.parse(raw);
  } catch {
    /* respuesta no JSON */
  }
  return { status: res.status, body, raw };
}

let pasadas = 0;
let fallidas = 0;
let omitidas = 0;

function comprobar(nombre, condicion, detalle = "") {
  if (condicion) {
    pasadas++;
    console.log(`  OK    ${nombre}`);
  } else {
    fallidas++;
    console.log(`  FALLA ${nombre}${detalle ? ` -> ${detalle}` : ""}`);
  }
}

function omitir(nombre, motivo) {
  omitidas++;
  console.log(`  --    ${nombre} (omitida: ${motivo})`);
}

/** Ninguna respuesta puede contener material criptografico. */
function sinFuga(raw) {
  return (
    !/documento_hmac|nombre_hmac|nombre_encrypted|BRIDGE_|service_role/.test(raw) &&
    !/v1\.[A-Za-z0-9_-]{16}\./.test(raw)
  );
}

console.log(`\nValidacion de ingreso contra ${URL_FUNCION}\n`);

console.log("Autenticacion y firma");

{
  const r = await llamar({ omitirCabeceras: true });
  comprobar("peticion sin autenticacion rechazada (401)", r.status === 401, `status ${r.status}`);
}
{
  const r = await llamar({ bearer: "secreto-incorrecto-de-prueba" });
  comprobar("bearer invalido rechazado (401)", r.status === 401, `status ${r.status}`);
}
{
  const r = await llamar({ firmaInvalida: true });
  comprobar(
    "firma mal calculada rechazada (401 invalid_signature)",
    r.status === 401 && /invalid_signature/.test(r.raw),
    `status ${r.status} ${r.raw.slice(0, 80)}`,
  );
}
{
  const r = await llamar({ timestamp: Math.floor(Date.now() / 1000) - 3600 });
  comprobar(
    "timestamp desfasado rechazado (401 timestamp_out_of_window)",
    r.status === 401 && /timestamp_out_of_window/.test(r.raw),
    `status ${r.status} ${r.raw.slice(0, 80)}`,
  );
}
{
  const r = await llamar({ timestamp: Math.floor(Date.now() / 1000) + 3600 });
  comprobar("timestamp futuro rechazado (401)", r.status === 401, `status ${r.status}`);
}
{
  const r = await llamar({ bodyRequestId: randomUUID() });
  comprobar("requestId de cuerpo y cabecera distintos rechazado (400)", r.status === 400, `status ${r.status}`);
}
{
  const r = await llamar({ method: "GET" });
  comprobar("GET rechazado: el documento nunca viaja por URL", r.status === 405, `status ${r.status}`);
}
{
  // A diferencia de la escritura, esta funcion NO consume nonce: reenviar la
  // misma peticion debe seguir respondiendo igual.
  const requestId = randomUUID();
  const timestamp = Math.floor(Date.now() / 1000);
  const primera = await llamar({ requestId, timestamp });
  const segunda = await llamar({ requestId, timestamp });
  comprobar(
    "reenviar la misma peticion no la rechaza (no consume nonce)",
    primera.status === 200 && segunda.status === 200,
    `${primera.status}/${segunda.status}`,
  );
}

console.log("\nReglas de decision");

{
  const r = await llamar({ document: "00000000000000009999" });
  comprobar(
    "documento fuera del censo responde found=false",
    r.status === 200 && r.body?.found === false,
    `status ${r.status} ${r.raw.slice(0, 120)}`,
  );
  comprobar(
    "y no autoriza a registrar",
    r.body?.canRegister !== true,
    r.raw.slice(0, 120),
  );
  comprobar("la respuesta no filtra material criptografico", sinFuga(r.raw), r.raw.slice(0, 120));
}

if (!DOCUMENTO) {
  omitir("paciente con ingreso activo devuelve canRegister y currentAdmission", "ejecuta con --document <documento real>");
  omitir("la lista de ingresos es coherente con currentAdmission", "requiere --document");
} else {
  const r = await llamar({ document: DOCUMENTO });
  comprobar(
    "paciente del censo responde found=true",
    r.status === 200 && r.body?.found === true,
    `status ${r.status} ${r.raw.slice(0, 160)}`,
  );
  comprobar(
    "trae canRegister y un currentAdmission entero",
    typeof r.body?.canRegister === "boolean" &&
      Number.isInteger(r.body?.currentAdmission) &&
      r.body.currentAdmission >= 1,
    JSON.stringify({ canRegister: r.body?.canRegister, currentAdmission: r.body?.currentAdmission }),
  );
  comprobar(
    "currentAdmission coincide con el ingreso activo de la lista",
    (() => {
      const lista = Array.isArray(r.body?.admissions) ? r.body.admissions : [];
      if (!lista.length) return false;
      const activo = lista.find((a) => a.state === "activo");
      return r.body.canRegister
        ? activo?.number === r.body.currentAdmission
        : !activo && r.body.currentAdmission === Math.max(...lista.map((a) => a.number));
    })(),
    JSON.stringify(r.body?.admissions),
  );
  comprobar("la respuesta del paciente real no filtra nada", sinFuga(r.raw));

  // La normalizacion ocurre dentro de la funcion: variantes del mismo documento
  // deben resolver al mismo paciente.
  const variantes = [
    ` ${DOCUMENTO} `,
    DOCUMENTO.replace(/(\d{3})(?=\d)/g, "$1."),
    DOCUMENTO.replace(/(\d{3})(?=\d)/g, "$1-"),
  ];
  const resultados = [];
  for (const v of variantes) {
    const rv = await llamar({ document: v });
    resultados.push(rv.body?.currentAdmission ?? null);
  }
  comprobar(
    "espacios, puntos y guiones resuelven al mismo ingreso",
    resultados.every((x) => x === r.body?.currentAdmission),
    JSON.stringify(resultados),
  );
}

console.log(`\nResultado: ${pasadas} correctas, ${fallidas} fallidas, ${omitidas} omitidas\n`);
process.exit(fallidas === 0 ? 0 : 1);
