/**
 * Pruebas de autorizacion del modulo Clinica de Heridas contra el portal en
 * ejecucion.
 *
 *   npm run build && npm run start        (en otra terminal)
 *   node scripts/clinica-heridas/portal-role-tests.mjs
 *
 * Acuña cookies de sesion NextAuth firmadas con NEXTAUTH_SECRET para simular
 * usuarios con y sin el rol CLINICA_HERIDAS, sin crear usuarios en la base de
 * datos. El identificador de usuario es sintetico: las consultas de solo
 * lectura funcionan y la insercion de auditoria falla en silencio (esta
 * envuelta en try/catch por diseño), asi que la prueba no deja rastro.
 *
 * El limite de peticiones se comprueba solo si se pasa el id de un usuario
 * real, porque el contador se apoya en la tabla de auditoria:
 *
 *   node scripts/clinica-heridas/portal-role-tests.mjs --usuario-id <uuid>
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

const argUsuario = process.argv.indexOf("--usuario-id");
const USUARIO_REAL = argUsuario !== -1 ? process.argv[argUsuario + 1] : null;

async function cookieDeSesion(rol, id = randomUUID()) {
  const token = await encode({
    secret: SECRET,
    token: {
      id,
      username: "prueba.seguridad",
      rol,
      nombres: "Prueba",
      primerApellido: "Seguridad",
      segundoApellido: null,
      email: null,
      telefono: null,
      cedula: "0",
      profesion: "OTRO",
    },
    maxAge: 60 * 60,
  });
  return `next-auth.session-token=${token}`;
}

async function pedir(ruta, { cookie, method = "POST", body, seguirRedireccion = false } = {}) {
  const headers = { "content-type": "application/json" };
  if (cookie) headers.cookie = cookie;
  const res = await fetch(`${BASE}${ruta}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
    redirect: seguirRedireccion ? "follow" : "manual",
  });
  const texto = await res.text();
  let json = null;
  try {
    json = JSON.parse(texto);
  } catch {
    /* html */
  }
  return { status: res.status, json, texto, location: res.headers.get("location") };
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

console.log(`\nPruebas de autorizacion contra ${BASE}\n`);

const conRol = await cookieDeSesion("CLINICA_HERIDAS");
const sinRol = await cookieDeSesion("ESPECIALISTA");
const administrativo = await cookieDeSesion("ADMINISTRATIVO");
const tecnico = await cookieDeSesion("TECNICO");
const farmacia = await cookieDeSesion("FARMACIA");

// --- Acceso al modulo --------------------------------------------------------
console.log("Acceso al modulo");

{
  const r = await pedir("/clinica-heridas", { method: "GET" });
  comprobar(
    "usuario no autenticado es redirigido al login",
    r.status >= 300 && r.status < 400 && (r.location ?? "").includes("/login"),
    `status ${r.status} location ${r.location}`,
  );
}
{
  const r = await pedir("/clinica-heridas", { method: "GET", cookie: sinRol });
  comprobar(
    "usuario sin el rol no puede abrir /clinica-heridas",
    r.status >= 300 && r.status < 400 && !(r.location ?? "").includes("/clinica-heridas"),
    `status ${r.status} location ${r.location}`,
  );
}
{
  const r = await pedir("/clinica-heridas", { method: "GET", cookie: administrativo });
  comprobar("un administrativo abre el modulo", r.status === 200, `status ${r.status}`);
}
{
  const r = await pedir("/clinica-heridas", { method: "GET", cookie: tecnico });
  comprobar("un tecnico abre el modulo", r.status === 200, `status ${r.status}`);
}
{
  const r = await pedir("/clinica-heridas", { method: "GET", cookie: farmacia });
  comprobar(
    "un usuario de farmacia no entra",
    r.status >= 300 && r.status < 400,
    `status ${r.status} location ${r.location}`,
  );
}
{
  const r = await pedir("/clinica-heridas", { method: "GET", cookie: conRol });
  comprobar("usuario con el rol abre el modulo", r.status === 200, `status ${r.status}`);
  comprobar(
    "la pagina servida no contiene material criptografico",
    !/nombre_encrypted|documento_hmac|BRIDGE_/.test(r.texto),
  );
}

// --- Endpoint de busqueda ----------------------------------------------------
console.log("\nEndpoint de busqueda");

{
  const r = await pedir("/api/clinica-heridas/buscar-paciente", { body: { documento: "123456789" } });
  comprobar("peticion sin autenticacion rechazada (401)", r.status === 401, `status ${r.status}`);
}
{
  const r = await pedir("/api/clinica-heridas/buscar-paciente", {
    cookie: sinRol,
    body: { documento: "123456789" },
  });
  comprobar("usuario sin el rol rechazado (403)", r.status === 403, `status ${r.status}`);
}
{
  const r = await pedir("/api/clinica-heridas/buscar-paciente", {
    cookie: farmacia,
    body: { documento: "123456789" },
  });
  comprobar("usuario de farmacia rechazado (403)", r.status === 403, `status ${r.status}`);
}
{
  const r = await pedir("/api/clinica-heridas/buscar-paciente", { cookie: conRol, method: "GET" });
  comprobar("GET rechazado (405): el documento nunca viaja por URL", r.status === 405, `status ${r.status}`);
}
{
  const r = await pedir("/api/clinica-heridas/buscar-paciente", { cookie: conRol, body: { documento: "" } });
  comprobar("documento vacio rechazado (400)", r.status === 400, `status ${r.status}`);
}
{
  const r = await pedir("/api/clinica-heridas/buscar-paciente", { cookie: conRol, body: {} });
  comprobar("cuerpo sin documento rechazado (400)", r.status === 400, `status ${r.status}`);
}
{
  const r = await pedir("/api/clinica-heridas/buscar-paciente", {
    cookie: conRol,
    body: { documento: "abc$%&/()=" },
  });
  comprobar("documento con caracteres invalidos rechazado (400)", r.status === 400, `status ${r.status}`);
}
{
  const r = await pedir("/api/clinica-heridas/buscar-paciente", {
    cookie: conRol,
    body: { documento: "12" },
  });
  comprobar("documento demasiado corto rechazado (400)", r.status === 400, `status ${r.status}`);
}

// Formatos validos que deben llegar al puente (paciente inexistente -> false).
for (const [etiqueta, documento] of [
  ["con espacios", " 1 234 567 890 "],
  ["con puntos", "1.234.567.890"],
  ["con guiones", "1-234-567-890"],
]) {
  const r = await pedir("/api/clinica-heridas/buscar-paciente", { cookie: conRol, body: { documento } });
  comprobar(
    `documento ${etiqueta} aceptado y resuelto por el puente`,
    r.status === 200 && r.json?.encontrado === false,
    `status ${r.status} ${r.texto.slice(0, 120)}`,
  );
}

{
  const r = await pedir("/api/clinica-heridas/buscar-paciente", {
    cookie: conRol,
    body: { documento: "99999999999999999999" },
  });
  comprobar(
    "paciente inexistente responde encontrado=false sin datos",
    r.status === 200 && r.json?.encontrado === false && r.json?.paciente === undefined,
    r.texto.slice(0, 120),
  );
  comprobar(
    "la respuesta no filtra HMAC, sobre cifrado ni secretos",
    !/documento_hmac|nombre_hmac|nombre_encrypted|BRIDGE_|service_role/.test(r.texto) &&
      !/v1\.[A-Za-z0-9_-]{16}\./.test(r.texto),
  );
  comprobar(
    "pacienteRef no llega antes de encontrar un paciente",
    !/pacienteRef/i.test(r.texto),
    r.texto.slice(0, 120),
  );
}
{
  const res = await fetch(`${BASE}/api/clinica-heridas/buscar-paciente`, {
    method: "POST",
    headers: { "content-type": "application/json", cookie: conRol },
    body: JSON.stringify({ documento: "99999999999999999999" }),
  });
  await res.text();
  comprobar(
    "la respuesta de busqueda declara Cache-Control: no-store",
    (res.headers.get("cache-control") ?? "").includes("no-store"),
    res.headers.get("cache-control") ?? "(sin cabecera)",
  );
}

// --- Endpoint de guardado ----------------------------------------------------
console.log("\nEndpoint de guardado");

const REF_PRUEBA_A = "11111111-1111-4111-8111-111111111111";
const REF_PRUEBA_B = "22222222-2222-4222-8222-222222222222";

// Los campos clinicos estan parametrizados: solo se aceptan opciones exactas
// del catalogo compartido (lib/clinicaHeridasCatalogos.ts).
const registroValido = {
  pacienteRef: REF_PRUEBA_A,
  origen: "QUIRÚRGICA",
  ubicacion: "PIE / TALÓN DERECHO",
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

{
  const r = await pedir("/api/clinica-heridas/seguimientos", { body: registroValido });
  comprobar("guardado sin autenticacion rechazado (401)", r.status === 401, `status ${r.status}`);
}
{
  const r = await pedir("/api/clinica-heridas/seguimientos", { cookie: sinRol, body: registroValido });
  comprobar("guardado sin el rol rechazado (403)", r.status === 403, `status ${r.status}`);
}
{
  const r = await pedir("/api/clinica-heridas/seguimientos", { cookie: farmacia, body: registroValido });
  comprobar("guardado por un usuario de farmacia rechazado (403)", r.status === 403, `status ${r.status}`);
}
{
  const r = await pedir("/api/clinica-heridas/seguimientos", {
    cookie: conRol,
    body: { ...registroValido, origen: "" },
  });
  comprobar("campo obligatorio vacio rechazado (400)", r.status === 400, `status ${r.status}`);
}
{
  const r = await pedir("/api/clinica-heridas/seguimientos", {
    cookie: conRol,
    body: { ...registroValido, profundidadCm: 9999 },
  });
  comprobar("medida fuera de rango rechazada (400)", r.status === 400, `status ${r.status}`);
}
{
  const r = await pedir("/api/clinica-heridas/seguimientos", {
    cookie: conRol,
    body: { ...registroValido, diametroVerticalCm: "no-numerico" },
  });
  comprobar("medida no numerica rechazada (400)", r.status === 400, `status ${r.status}`);
}
{
  const r = await pedir("/api/clinica-heridas/seguimientos", {
    cookie: conRol,
    body: { ...registroValido, pacienteRef: "" },
  });
  comprobar("guardado sin paciente confirmado rechazado (400)", r.status === 400, `status ${r.status}`);
}
{
  const r = await pedir("/api/clinica-heridas/seguimientos", {
    cookie: conRol,
    body: { ...registroValido, pacienteRef: "no-es-un-uuid" },
  });
  comprobar("pacienteRef con formato invalido rechazado (400)", r.status === 400, `status ${r.status}`);
}
{
  const r = await pedir("/api/clinica-heridas/seguimientos", {
    cookie: conRol,
    body: { ...registroValido, origen: "LO QUE SEA" },
  });
  comprobar("opcion fuera del catalogo rechazada (400)", r.status === 400, `status ${r.status}`);
}
{
  // Misma opcion con otra grafia: el catalogo es exacto, no aproximado.
  const r = await pedir("/api/clinica-heridas/seguimientos", {
    cookie: conRol,
    body: { ...registroValido, origen: "QUIRURGICA" },
  });
  comprobar("opcion sin tilde rechazada (400)", r.status === 400, `status ${r.status}`);
}
{
  const r = await pedir("/api/clinica-heridas/seguimientos", {
    cookie: conRol,
    body: { ...registroValido, exudadoCantidad: "MUCHISIMO" },
  });
  comprobar("cantidad de exudado fuera del catalogo rechazada (400)", r.status === 400, `status ${r.status}`);
}
{
  const { pielPerilesional, ...sinPiel } = registroValido;
  void pielPerilesional;
  const r = await pedir("/api/clinica-heridas/seguimientos", { cookie: conRol, body: sinPiel });
  comprobar("piel perilesional ausente rechazada (400)", r.status === 400, `status ${r.status}`);
}
{
  const { cavitacionTunelizacion, ...sinCavitacion } = registroValido;
  void cavitacionTunelizacion;
  const r = await pedir("/api/clinica-heridas/seguimientos", { cookie: conRol, body: sinCavitacion });
  comprobar("cavitacion / tunelizacion ausente rechazada (400)", r.status === 400, `status ${r.status}`);
}
{
  const r = await pedir("/api/clinica-heridas/seguimientos", {
    cookie: conRol,
    body: { ...registroValido, pielPerilesional: "IRRITADA" },
  });
  comprobar("piel perilesional fuera del catalogo rechazada (400)", r.status === 400, `status ${r.status}`);
}
{
  // El documento se acepta para nombrar la carpeta de SharePoint, pero no
  // puede volver al cliente ni quedar en Neon (se verifica en la BD abajo).
  //
  // Se envia SIN pacienteNombre a proposito: hacen falta los dos para crear la
  // carpeta, asi que la prueba no deja carpetas ficticias en SharePoint.
  const r = await pedir("/api/clinica-heridas/seguimientos", {
    cookie: conRol,
    body: { ...registroValido, documento: "1234567890" },
  });
  comprobar(
    "el documento usado para SharePoint no se refleja en la respuesta",
    !/1234567890/.test(r.texto),
    `status ${r.status} ${r.texto.slice(0, 120)}`,
  );
}
{
  const r = await pedir("/api/clinica-heridas/fotos", { cookie: sinRol, body: {} });
  comprobar("subida de fotos sin el rol rechazada (403)", r.status === 403, `status ${r.status}`);
}
{
  const r = await pedir("/api/clinica-heridas/fotos", { body: {} });
  comprobar("subida de fotos sin autenticacion rechazada (401)", r.status === 401, `status ${r.status}`);
}
{
  const r = await pedir("/api/clinica-heridas/fotos/inexistente", { method: "GET", cookie: sinRol });
  comprobar("abrir una foto sin el rol rechazado (403)", r.status === 403, `status ${r.status}`);
}
{
  const r = await pedir("/api/clinica-heridas/fotos/inexistente", { method: "GET" });
  comprobar("abrir una foto sin autenticacion rechazado (401)", r.status === 401, `status ${r.status}`);
}

// --- Historico por pacienteRef y limite de peticiones -------------------------
//
// Ambas comprobaciones necesitan escribir en Neon, y la clave foranea exige un
// usuario existente. Se ejecutan solo si se pasa --usuario-id, y al terminar
// borran exactamente las filas que crearon.
console.log("\nHistorico por pacienteRef");

if (!USUARIO_REAL) {
  omitir(
    "varios registros clinicos se agrupan por pacienteRef",
    "escribe en Neon; ejecuta con --usuario-id <uuid de un usuario real>",
  );
  omitir("el nombre del paciente no llega a Neon", "requiere --usuario-id");
} else {
  const cookie = await cookieDeSesion("CLINICA_HERIDAS", USUARIO_REAL);
  const { PrismaClient } = await import("@prisma/client");
  const prisma = new PrismaClient();

  try {
    // Paciente A: dos valoraciones en momentos distintos.
    const a1 = await pedir("/api/clinica-heridas/seguimientos", {
      cookie,
      body: { ...registroValido, pacienteRef: REF_PRUEBA_A, diametroVerticalCm: 2, profundidadCm: 1 },
    });
    const a2 = await pedir("/api/clinica-heridas/seguimientos", {
      cookie,
      body: { ...registroValido, pacienteRef: REF_PRUEBA_A, diametroVerticalCm: 2.5, profundidadCm: 1.2 },
    });
    // Paciente B: homonimo, referencia distinta.
    const b1 = await pedir("/api/clinica-heridas/seguimientos", {
      cookie,
      body: { ...registroValido, pacienteRef: REF_PRUEBA_B, diametroVerticalCm: 3, profundidadCm: 2 },
    });

    comprobar(
      "se guardan tres valoraciones (dos del paciente A, una del B)",
      a1.status === 201 && a2.status === 201 && b1.status === 201,
      `${a1.status}/${a2.status}/${b1.status}`,
    );

    const deA = await prisma.clinicaHeridas.findMany({
      where: { pacienteRef: REF_PRUEBA_A },
      orderBy: { numero: "asc" },
      select: { pacienteRef: true, numero: true, diametroVerticalCm: true, profundidadCm: true },
    });
    const deB = await prisma.clinicaHeridas.findMany({
      where: { pacienteRef: REF_PRUEBA_B },
      select: { pacienteRef: true, numero: true, diametroVerticalCm: true },
    });

    comprobar(
      "el historico del paciente A agrupa sus dos seguimientos",
      deA.length === 2 && deA[0].diametroVerticalCm === 2 && deA[1].diametroVerticalCm === 2.5,
      JSON.stringify(deA),
    );
    comprobar(
      "los seguimientos del paciente A se numeran 1 y 2",
      deA.length === 2 && deA[0].numero === 1 && deA[1].numero === 2,
      JSON.stringify(deA.map((s) => s.numero)),
    );
    comprobar(
      "cada seguimiento guarda sus propias medidas de forma independiente",
      deA.length === 2 && deA[0].profundidadCm === 1 && deA[1].profundidadCm === 1.2,
      JSON.stringify(deA.map((s) => s.profundidadCm)),
    );
    comprobar(
      "el paciente B queda separado y su numeracion arranca en 1",
      deB.length === 1 && deB[0].diametroVerticalCm === 3 && deB[0].numero === 1,
      JSON.stringify(deB),
    );

    // El nombre real no puede existir en Neon: ni siquiera hay columna.
    const columnas = await prisma.$queryRawUnsafe(
      `select column_name from information_schema.columns where table_name = 'ClinicaHeridas'`,
    );
    const nombresColumnas = columnas.map((c) => c.column_name);
    comprobar(
      "la tabla ClinicaHeridas no tiene columna de nombre ni de documento",
      !nombresColumnas.some((c) => /nombre|documento/i.test(c)),
      nombresColumnas.join(", "),
    );
    comprobar(
      "la tabla ClinicaHeridas identifica al paciente solo por pacienteRef",
      nombresColumnas.includes("pacienteRef"),
      nombresColumnas.join(", "),
    );

    // Las fotos: ninguna columna puede almacenar binarios.
    const columnasFoto = await prisma.$queryRawUnsafe(
      `select column_name, data_type from information_schema.columns where table_name = 'ClinicaHeridasFoto'`,
    );
    comprobar(
      "la tabla de fotos no tiene ninguna columna binaria",
      !columnasFoto.some((c) => /bytea|blob|binary/i.test(c.data_type)),
      columnasFoto.map((c) => `${c.column_name}:${c.data_type}`).join(", "),
    );
    comprobar(
      "la tabla de fotos guarda la referencia de SharePoint",
      columnasFoto.some((c) => c.column_name === "driveItemId"),
      columnasFoto.map((c) => c.column_name).join(", "),
    );

    // Ninguna tabla del modulo puede tener columnas binarias.
    const binarias = await prisma.$queryRawUnsafe(
      `select table_name, column_name from information_schema.columns
        where table_name like 'ClinicaHeridas%' and data_type in ('bytea')`,
    );
    comprobar(
      "ninguna tabla del modulo almacena binarios en Neon",
      binarias.length === 0,
      JSON.stringify(binarias),
    );

    // Limpieza: se borran unicamente las filas creadas por esta prueba.
    const borradas = await prisma.clinicaHeridas.deleteMany({
      where: { pacienteRef: { in: [REF_PRUEBA_A, REF_PRUEBA_B] } },
    });
    await prisma.clinicaHeridasPaciente.deleteMany({
      where: { pacienteRef: { in: [REF_PRUEBA_A, REF_PRUEBA_B] } },
    });
    const quedanSeguimientos = await prisma.clinicaHeridas.count({
      where: { pacienteRef: { in: [REF_PRUEBA_A, REF_PRUEBA_B] } },
    });
    comprobar(
      "las filas de prueba se eliminan al terminar",
      borradas.count === 3 && quedanSeguimientos === 0,
      `borradas ${borradas.count}, quedan ${quedanSeguimientos}`,
    );

    // --- Limite de peticiones -------------------------------------------------
    console.log("\nLimite de peticiones");
    let ultimo = null;
    for (let i = 0; i < 13; i++) {
      ultimo = await pedir("/api/clinica-heridas/buscar-paciente", {
        cookie,
        body: { documento: "99999999999999999999" },
      });
      if (ultimo.status === 429) break;
    }
    comprobar("el limite de busquedas devuelve 429", ultimo?.status === 429, `ultimo status ${ultimo?.status}`);

    await prisma.clinicaHeridasConsulta.deleteMany({
      where: { usuarioId: USUARIO_REAL, createdAt: { gte: new Date(Date.now() - 60 * 60 * 1000) } },
    });
    const restantes = await prisma.clinicaHeridasConsulta.count({ where: { usuarioId: USUARIO_REAL } });
    comprobar("la auditoria de prueba se limpia al terminar", restantes === 0, `quedan ${restantes}`);
  } finally {
    await prisma.$disconnect();
  }
}

console.log(`\nResultado: ${pasadas} correctas, ${fallidas} fallidas, ${omitidas} omitidas\n`);
process.exit(fallidas === 0 ? 0 : 1);
