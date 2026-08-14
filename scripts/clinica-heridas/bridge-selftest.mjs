/**
 * Pruebas de seguridad de la Edge Function `get-paciente-clinica-heridas`.
 *
 * Ejecuta contra el Bridge real las mismas comprobaciones que se le exigen al
 * endpoint: autenticacion, firma, ventana temporal, replay, validacion del
 * documento y forma de la respuesta.
 *
 *   node scripts/clinica-heridas/bridge-selftest.mjs
 *   node scripts/clinica-heridas/bridge-selftest.mjs --document 1.234.567-8
 *
 * El parametro opcional --document permite verificar ademas el camino
 * "paciente encontrado" y la normalizacion (espacios, puntos, guiones) con un
 * documento real. Ese valor NO se imprime ni se guarda en ningun sitio.
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
const SECRET = process.env.BRIDGE_QUERY_API_SECRET ?? "";
const URL_FUNCION = `${BASE}/functions/v1/get-paciente-clinica-heridas`;

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

/**
 * @param {object} opciones
 * @returns {Promise<{status:number, body:any, raw:string}>}
 */
async function llamar({
  document = "0000000000",
  method = "POST",
  contentType = "application/json",
  bearer = SECRET,
  timestamp = Math.floor(Date.now() / 1000),
  requestId = randomUUID(),
  bodyRequestId = undefined,
  firmaInvalida = false,
  omitirCabeceras = false,
} = {}) {
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
    headers["x-bridge-signature"] = firmaInvalida
      ? "0".repeat(64)
      : firmar(timestamp, requestId, rawBody);
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
    console.log(`  OK   ${nombre}`);
  } else {
    fallidas++;
    console.log(`  FALLA ${nombre}${detalle ? ` -> ${detalle}` : ""}`);
  }
}

function omitir(nombre, motivo) {
  omitidas++;
  console.log(`  --   ${nombre} (omitida: ${motivo})`);
}

/** Ninguna respuesta puede contener material criptografico. */
function sinFugaCriptografica(raw) {
  const prohibido = [
    "documento_hmac",
    "nombre_hmac",
    "nombre_encrypted",
    "BRIDGE_",
    "service_role",
    "eyJ", // prefijo tipico de un JWT
  ];
  const sospechoso = prohibido.find((p) => raw.includes(p));
  // Un sobre AES-GCM v1.<nonce>.<ct> tampoco debe aparecer nunca.
  const sobre = /v1\.[A-Za-z0-9_-]{16}\./.test(raw);
  return { limpio: !sospechoso && !sobre, sospechoso: sospechoso ?? (sobre ? "sobre_aes" : "") };
}

console.log(`\nPruebas de seguridad contra ${URL_FUNCION}\n`);

// --- Autenticacion ----------------------------------------------------------
console.log("Autenticacion y firma");

{
  const r = await llamar({ omitirCabeceras: true });
  comprobar("peticion sin autenticacion rechazada (401)", r.status === 401, `status ${r.status}`);
}
{
  const r = await llamar({ bearer: "secreto-incorrecto-de-prueba" });
  comprobar("bearer invalido rechazado (401)", r.status === 401, `status ${r.status}`);
  comprobar(
    "el error de autenticacion no revela detalles internos",
    sinFugaCriptografica(r.raw).limpio && !/postgres|supabase\.co|stack/i.test(r.raw),
    r.raw.slice(0, 120),
  );
}
{
  const r = await llamar({ firmaInvalida: true });
  comprobar("firma invalida rechazada (401)", r.status === 401, `status ${r.status}`);
}
{
  const r = await llamar({ timestamp: Math.floor(Date.now() / 1000) - 3600 });
  comprobar("timestamp expirado rechazado (401)", r.status === 401, `status ${r.status}`);
}
{
  const r = await llamar({ timestamp: Math.floor(Date.now() / 1000) + 3600 });
  comprobar("timestamp futuro rechazado (401)", r.status === 401, `status ${r.status}`);
}
{
  const requestId = randomUUID();
  const primera = await llamar({ requestId });
  const segunda = await llamar({ requestId });
  comprobar("primera peticion con requestId nuevo aceptada", primera.status === 200, `status ${primera.status}`);
  comprobar("replay del mismo requestId rechazado (409)", segunda.status === 409, `status ${segunda.status}`);
}
{
  const r = await llamar({ bodyRequestId: randomUUID() });
  comprobar("requestId de cuerpo y cabecera distintos rechazado (400)", r.status === 400, `status ${r.status}`);
}
{
  const r = await llamar({ method: "GET" });
  comprobar("GET rechazado (405): el documento nunca viaja por URL", r.status === 405, `status ${r.status}`);
}
{
  const r = await llamar({ contentType: "text/plain" });
  comprobar("content-type no JSON rechazado (415)", r.status === 415, `status ${r.status}`);
}

// --- Validacion del documento ----------------------------------------------
console.log("\nValidacion del documento");

{
  const r = await llamar({ document: "" });
  comprobar("documento vacio rechazado (422)", r.status === 422, `status ${r.status}`);
}
{
  const r = await llamar({ document: "   " });
  comprobar("documento en blanco rechazado (422)", r.status === 422, `status ${r.status}`);
}
{
  const r = await llamar({ document: "...---" });
  comprobar("documento sin alfanumericos rechazado (422)", r.status === 422, `status ${r.status}`);
}
{
  const r = await llamar({ document: "9".repeat(200) });
  comprobar("documento demasiado largo rechazado (422)", r.status === 422, `status ${r.status}`);
}

// --- Resultado de la busqueda ----------------------------------------------
console.log("\nResultado de la busqueda");

{
  const r = await llamar({ document: "00000000000000009999" });
  comprobar("paciente inexistente responde found=false", r.status === 200 && r.body?.found === false, `status ${r.status} body ${r.raw.slice(0, 120)}`);
  comprobar("la respuesta de no encontrado no filtra nada", sinFugaCriptografica(r.raw).limpio, r.raw.slice(0, 120));
  comprobar("la respuesta de no encontrado no incluye objeto patient", r.body?.patient === undefined);
  // Prueba 10: la referencia solo se emite al encontrar al paciente.
  comprobar(
    "patientRef no se emite antes de encontrar un paciente",
    !/patientRef/i.test(r.raw) && Object.keys(r.body ?? {}).join(",") === "found",
    r.raw.slice(0, 120),
  );
}

if (!DOCUMENTO) {
  omitir("paciente existente devuelve nombre y patientRef", "ejecuta con --document <documento real>");
  omitir("normalizacion con espacios/puntos/guiones", "ejecuta con --document <documento real>");
  omitir("el nombre conserva tildes y mayusculas", "ejecuta con --document <documento real>");
  omitir("patientRef es un UUID estable entre consultas", "ejecuta con --document <documento real>");
} else {
  const variantes = [
    DOCUMENTO,
    ` ${DOCUMENTO} `,
    DOCUMENTO.replace(/(\d{3})(?=\d)/g, "$1."),
    DOCUMENTO.replace(/(\d{3})(?=\d)/g, "$1-"),
  ];
  const nombres = [];
  const refs = [];
  for (const variante of variantes) {
    const r = await llamar({ document: variante });
    if (r.status === 200 && r.body?.found === true) {
      nombres.push(r.body.patient?.name ?? "");
      refs.push(r.body.patient?.patientRef ?? "");
    } else {
      nombres.push(null);
      refs.push(null);
    }
  }

  const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  comprobar("paciente existente devuelve found=true y nombre", typeof nombres[0] === "string" && nombres[0].length > 0);
  comprobar("paciente existente devuelve patientRef con formato UUID", typeof refs[0] === "string" && UUID.test(refs[0]));
  comprobar(
    "normalizacion: espacios, puntos y guiones dan el mismo nombre",
    nombres.every((n) => n === nombres[0]),
  );
  comprobar(
    "patientRef es estable entre consultas y variantes del documento",
    refs.every((r) => r === refs[0]),
    refs.join(" | "),
  );
  comprobar(
    "el nombre se devuelve tal cual (tildes y mayusculas del origen)",
    typeof nombres[0] === "string" && nombres[0] === nombres[0].normalize("NFC"),
  );
  comprobar(
    "patientRef no contiene fragmentos del documento",
    typeof refs[0] === "string" &&
      !refs[0].replace(/-/g, "").includes(DOCUMENTO.replace(/[^A-Za-z0-9]/g, "").slice(0, 6)),
  );

  const r = await llamar({ document: DOCUMENTO });
  comprobar("la respuesta encontrada solo contiene found y patient.{name,patientRef}", (() => {
    if (r.body?.found !== true) return false;
    const claves = Object.keys(r.body).sort().join(",");
    const clavesPaciente = Object.keys(r.body.patient ?? {}).sort().join(",");
    return claves === "found,patient" && clavesPaciente === "name,patientRef";
  })(), r.raw.slice(0, 160));
  comprobar("la respuesta encontrada no filtra material criptografico", sinFugaCriptografica(r.raw).limpio);
}

console.log(`\nResultado: ${pasadas} correctas, ${fallidas} fallidas, ${omitidas} omitidas\n`);
process.exit(fallidas === 0 ? 0 : 1);
