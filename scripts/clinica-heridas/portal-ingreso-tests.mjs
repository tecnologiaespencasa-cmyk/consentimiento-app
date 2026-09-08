/**
 * Pruebas del portal con la validacion de ingreso ENCENDIDA.
 *
 *   BRIDGE_VALIDACION_INGRESO=true npm run start   (en otra terminal)
 *   node scripts/clinica-heridas/portal-ingreso-tests.mjs
 *   node scripts/clinica-heridas/portal-ingreso-tests.mjs --document 1234567890
 *
 * `portal-role-tests.mjs` cubre el modo con la bandera apagada; esta cubre el
 * encendido, que es el que bloquea.
 *
 * Con --document se comprueba ademas el camino completo de un paciente con
 * ingreso activo. Ese valor NO se imprime ni se guarda.
 */

import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { encode } from "next-auth/jwt";

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

const BASE = process.env.PORTAL_URL ?? "http://localhost:3000";
const SECRET = process.env.NEXTAUTH_SECRET ?? "";
if (!SECRET) {
  console.error("Falta NEXTAUTH_SECRET en .env.local");
  process.exit(1);
}

const argDoc = process.argv.indexOf("--document");
const DOCUMENTO = argDoc !== -1 ? process.argv[argDoc + 1] : null;

// Documento sintetico: valido de forma, inexistente en el censo.
const FUERA_DEL_CENSO = "00000000000000009999";

const cookie = `next-auth.session-token=${await encode({
  secret: SECRET,
  token: {
    id: randomUUID(),
    username: "prueba.ingreso",
    rol: "CLINICA_HERIDAS",
    nombres: "Prueba",
    primerApellido: "Ingreso",
    segundoApellido: null,
    email: null,
    telefono: null,
    cedula: "0",
    profesion: "OTRO",
  },
  maxAge: 3600,
})}`;

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

async function pedir(ruta, body, { conSesion = true } = {}) {
  const headers = { "content-type": "application/json" };
  if (conSesion) headers.cookie = cookie;
  const res = await fetch(`${BASE}${ruta}`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
  const texto = await res.text();
  let json = null;
  try {
    json = JSON.parse(texto);
  } catch {
    /* html */
  }
  return { status: res.status, json, texto };
}

const registro = {
  pacienteRef: "44444444-4444-4444-8444-444444444444",
  origen: "QUIRÚRGICA",
  ubicacion: "ABDOMEN",
  fondo: "LIMPIO",
  lecho: "VIABLE",
  tejido: "GRANULACIÓN",
  cavitacionTunelizacion: "NO PRESENTA",
  pielPerilesional: "SANA / ÍNTEGRA",
  exudadoCantidad: "ESCASO",
  exudadoCaracteristicas: "SEROSO",
  diametroVerticalCm: 1,
  diametroHorizontalCm: 1,
  profundidadCm: 1,
};

console.log(`\nValidacion de ingreso encendida, contra ${BASE}\n`);

console.log("Consulta de estado");

{
  const r = await pedir("/api/clinica-heridas/estado-paciente", { documento: FUERA_DEL_CENSO }, { conSesion: false });
  comprobar("sin sesion se rechaza (401)", r.status === 401, `status ${r.status}`);
}
{
  const r = await pedir("/api/clinica-heridas/estado-paciente", { documento: "" });
  comprobar("documento invalido se rechaza antes de llamar al puente (400)", r.status === 400, `status ${r.status}`);
}
{
  const r = await pedir("/api/clinica-heridas/estado-paciente", { documento: FUERA_DEL_CENSO });
  comprobar("la validacion esta encendida en el servidor", r.json?.validacionActiva === true, JSON.stringify(r.json));
  comprobar("documento fuera del censo no autoriza", r.json?.puedeRegistrar === false, JSON.stringify(r.json));
  comprobar(
    "con un motivo legible para el usuario",
    typeof r.json?.motivo === "string" && r.json.motivo.length > 0,
    JSON.stringify(r.json),
  );
  comprobar(
    "sin filtrar detalles internos del puente",
    !/supabase|functions\/v1|hmac|secret|documento_hmac/i.test(r.texto),
    r.texto.slice(0, 120),
  );
}

console.log("\nBloqueo del guardado");

{
  const r = await pedir("/api/clinica-heridas/seguimientos", { ...registro, documento: FUERA_DEL_CENSO });
  comprobar(
    "paciente fuera del censo: el guardado queda bloqueado (409)",
    r.status === 409,
    `status ${r.status} ${r.texto.slice(0, 120)}`,
  );
  comprobar("y no se crea el seguimiento", r.json?.ok !== true);
}
{
  const r = await pedir("/api/clinica-heridas/seguimientos", registro);
  comprobar(
    "sin documento no se puede verificar el ingreso: bloqueado (409)",
    r.status === 409,
    `status ${r.status}`,
  );
}

console.log("\nPaciente con ingreso activo");

if (!DOCUMENTO) {
  omitir("un paciente activo autoriza y devuelve su numero de ingreso", "ejecuta con --document <documento real>");
  omitir("el estado coincide entre la busqueda y la consulta directa", "requiere --document");
} else {
  const r = await pedir("/api/clinica-heridas/estado-paciente", { documento: DOCUMENTO });
  comprobar(
    "un paciente activo autoriza a registrar",
    r.status === 200 && r.json?.puedeRegistrar === true,
    `status ${r.status} ${r.texto.slice(0, 160)}`,
  );
  comprobar(
    "y devuelve un numero de ingreso entero",
    Number.isInteger(r.json?.ingresoActual) && r.json.ingresoActual >= 1,
    JSON.stringify({ ingresoActual: r.json?.ingresoActual }),
  );

  const busqueda = await pedir("/api/clinica-heridas/buscar-paciente", { documento: DOCUMENTO });
  comprobar(
    "la busqueda devuelve el mismo estado de ingreso",
    busqueda.status === 200 &&
      busqueda.json?.ingreso?.puedeRegistrar === r.json?.puedeRegistrar &&
      busqueda.json?.ingreso?.ingresoActual === r.json?.ingresoActual,
    JSON.stringify(busqueda.json?.ingreso),
  );
  comprobar(
    "la busqueda no filtra el documento ni material criptografico",
    !/documento_hmac|nombre_hmac|nombre_encrypted|BRIDGE_/.test(busqueda.texto) &&
      !busqueda.texto.includes(DOCUMENTO),
  );
}

console.log(`\nResultado: ${pasadas} correctas, ${fallidas} fallidas, ${omitidas} omitidas\n`);
process.exit(fallidas === 0 ? 0 : 1);
