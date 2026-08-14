/**
 * Comprobaciones estaticas de seguridad del modulo Clinica de Heridas.
 *
 *   node scripts/clinica-heridas/security-checks.mjs
 *
 * Verifica sobre el codigo fuente (y sobre el bundle de cliente si existe .next)
 * las invariantes que no pueden romperse:
 *
 *   - ningun secreto del puente usa el prefijo NEXT_PUBLIC_
 *   - ningun componente cliente importa el cliente del puente ni lee secretos
 *   - el documento no se persiste en Neon ni se guarda en el navegador
 *   - el portal no hace ninguna llamada al sistema productor
 *   - los secretos no aparecen en el bundle servido al navegador
 */

import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join, relative, sep } from "node:path";

const RAIZ = process.cwd();

let pasadas = 0;
let fallidas = 0;

function comprobar(nombre, condicion, detalle = "") {
  if (condicion) {
    pasadas++;
    console.log(`  OK    ${nombre}`);
  } else {
    fallidas++;
    console.log(`  FALLA ${nombre}${detalle ? `\n          -> ${detalle}` : ""}`);
  }
}

function listarArchivos(dir, extensiones, omitir = []) {
  const salida = [];
  if (!existsSync(dir)) return salida;
  for (const entrada of readdirSync(dir)) {
    const ruta = join(dir, entrada);
    if (omitir.some((o) => ruta.includes(o))) continue;
    const info = statSync(ruta);
    if (info.isDirectory()) salida.push(...listarArchivos(ruta, extensiones, omitir));
    else if (extensiones.some((e) => entrada.endsWith(e))) salida.push(ruta);
  }
  return salida;
}

const fuentes = [
  ...listarArchivos(join(RAIZ, "app"), [".ts", ".tsx"]),
  ...listarArchivos(join(RAIZ, "lib"), [".ts"]),
  ...listarArchivos(join(RAIZ, "scripts"), [".mjs"]),
  join(RAIZ, "middleware.ts"),
].filter((f) => existsSync(f));

const contenidos = new Map(fuentes.map((f) => [f, readFileSync(f, "utf8")]));

/** Un archivo es componente cliente si lleva la directiva "use client". */
function esComponenteCliente(texto) {
  return /^\s*["']use client["']/m.test(texto.slice(0, 400));
}

/**
 * Quita comentarios. Los comentarios que EXPLICAN una garantia mencionan por
 * fuerza las palabras que se estan buscando ("no se guarda en localStorage"),
 * asi que analizarlos produciria falsos positivos.
 */
function sinComentarios(texto) {
  return texto
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/(^|[^:])\/\/[^\n]*/g, "$1 ");
}

/**
 * Deja solo codigo ejecutable: sin comentarios y con los literales de cadena
 * vaciados. Lo que importa es que no se USE un valor sensible, no que su
 * nombre aparezca en un mensaje de texto.
 */
function soloCodigo(texto) {
  return sinComentarios(texto)
    .replace(/"(?:[^"\\]|\\.)*"/g, '""')
    .replace(/'(?:[^'\\]|\\.)*'/g, "''")
    .replace(/`(?:[^`\\]|\\.)*`/g, "``");
}

const clientes = fuentes.filter((f) => esComponenteCliente(contenidos.get(f)));
const rel = (f) => relative(RAIZ, f).split(sep).join("/");

console.log("\nComprobaciones estaticas del modulo Clinica de Heridas\n");

// --- 1. Secretos fuera del navegador ----------------------------------------
console.log("Secretos");

const SECRETOS = [
  "BRIDGE_QUERY_API_SECRET",
  "BRIDGE_HMAC_SECRET",
  "BRIDGE_ENCRYPTION_KEY",
  "BRIDGE_API_SECRET",
  "SUPABASE_SERVICE_ROLE_KEY",
  "service_role",
];

{
  const infractores = [];
  for (const [f, texto] of contenidos) {
    for (const secreto of SECRETOS) {
      if (texto.includes(`NEXT_PUBLIC_${secreto}`)) infractores.push(`${rel(f)}: ${secreto}`);
    }
    if (/NEXT_PUBLIC_[A-Z_]*(BRIDGE|SUPABASE)/.test(texto)) infractores.push(`${rel(f)}: prefijo NEXT_PUBLIC_ sobre variable del puente`);
  }
  comprobar("ningun secreto del puente usa el prefijo NEXT_PUBLIC_", infractores.length === 0, infractores.join("\n          -> "));
}

{
  // Los componentes cliente no pueden leer process.env de secretos ni importar
  // el cliente del puente.
  const infractores = [];
  for (const f of clientes) {
    const texto = contenidos.get(f);
    for (const secreto of SECRETOS) {
      if (texto.includes(secreto)) infractores.push(`${rel(f)}: menciona ${secreto}`);
    }
    if (/from\s+["']@\/lib\/clinicaHeridas["']/.test(texto)) {
      infractores.push(`${rel(f)}: importa @/lib/clinicaHeridas`);
    }
    if (/from\s+["']@\/lib\/prisma["']/.test(texto)) {
      infractores.push(`${rel(f)}: importa @/lib/prisma`);
    }
  }
  comprobar("ningun componente cliente toca secretos, el cliente del puente ni Prisma", infractores.length === 0, infractores.join("\n          -> "));
}

{
  const clienteBridge = join(RAIZ, "lib", "clinicaHeridas.ts");
  const texto = existsSync(clienteBridge) ? readFileSync(clienteBridge, "utf8") : "";
  comprobar(
    'lib/clinicaHeridas.ts declara import "server-only" (falla el build si se importa desde el navegador)',
    /import\s+["']server-only["']/.test(texto),
  );
}

{
  // El portal no debe conocer las claves criptograficas del puente ni intentar
  // descifrar nada por su cuenta.
  const infractores = [];
  for (const [f, texto] of contenidos) {
    if (rel(f).startsWith("supabase/")) continue;
    if (rel(f).startsWith("scripts/")) continue;
    if (/BRIDGE_HMAC_SECRET|BRIDGE_ENCRYPTION_KEY/.test(texto)) {
      // Solo se admite mencionarlos en comentarios que expliquen que NO estan aqui.
      const lineas = texto.split(/\r?\n/).filter((l) => /BRIDGE_HMAC_SECRET|BRIDGE_ENCRYPTION_KEY/.test(l));
      const enCodigo = lineas.filter((l) => !/^\s*(\*|\/\/|\/\*)/.test(l));
      if (enCodigo.length > 0) infractores.push(`${rel(f)}: ${enCodigo[0].trim().slice(0, 80)}`);
    }
    if (/nombre_encrypted|documento_hmac|nombre_hmac/.test(texto)) {
      const lineas = texto.split(/\r?\n/).filter((l) => /nombre_encrypted|documento_hmac|nombre_hmac/.test(l));
      const enCodigo = lineas.filter((l) => !/^\s*(\*|\/\/|\/\*)/.test(l));
      if (enCodigo.length > 0) infractores.push(`${rel(f)}: ${enCodigo[0].trim().slice(0, 80)}`);
    }
  }
  comprobar("el portal no usa BRIDGE_HMAC_SECRET, BRIDGE_ENCRYPTION_KEY ni columnas cifradas", infractores.length === 0, infractores.join("\n          -> "));
}

// --- 2. El documento no se persiste -----------------------------------------
console.log("\nProteccion del documento");

{
  const schema = readFileSync(join(RAIZ, "prisma", "schema.prisma"), "utf8");
  const modelo = sinComentarios(schema.match(/model ClinicaHeridas \{[\s\S]*?\n\}/)?.[0] ?? "");
  comprobar("el modelo ClinicaHeridas existe en el esquema", modelo.length > 0);
  comprobar(
    "el modelo ClinicaHeridas no tiene ningun campo de documento",
    modelo.length > 0 && !/documento/i.test(modelo),
    modelo.split(/\r?\n/).filter((l) => /documento/i.test(l)).join(" | "),
  );
  comprobar(
    "el modelo ClinicaHeridas no almacena el nombre del paciente",
    modelo.length > 0 && !/pacienteNombre|nombre/i.test(modelo),
    modelo.split(/\r?\n/).filter((l) => /nombre/i.test(l)).join(" | "),
  );
  comprobar(
    "el modelo ClinicaHeridas identifica al paciente por pacienteRef",
    /pacienteRef\s+String/.test(modelo) && /@@index\(\[pacienteRef, createdAt\]\)/.test(modelo),
  );
  comprobar(
    "los seguimientos son independientes y numerados por paciente",
    /numero\s+Int/.test(modelo) && /@@unique\(\[pacienteRef, numero\]\)/.test(modelo),
  );
  comprobar(
    "el exudado se guarda desdoblado en cantidad y caracteristicas",
    /exudadoCantidad\s+String/.test(modelo) && /exudadoCaracteristicas\s+String/.test(modelo),
  );

  // Las fotos: solo referencias, jamas binarios.
  const modeloFoto = sinComentarios(schema.match(/model ClinicaHeridasFoto \{[\s\S]*?\n\}/)?.[0] ?? "");
  comprobar("existe el modelo de fotos ClinicaHeridasFoto", modeloFoto.length > 0);
  comprobar(
    "el modelo de fotos guarda solo la referencia (driveItemId), nunca el binario",
    modeloFoto.length > 0 &&
      /driveItemId\s+String/.test(modeloFoto) &&
      !/Bytes|base64|contenido|binario|blob/i.test(modeloFoto),
    modeloFoto.split(/\r?\n/).filter((l) => /Bytes|base64|blob/i.test(l)).join(" | "),
  );
  comprobar(
    "ningun modelo del esquema declara columnas binarias",
    !/\bBytes\b/.test(sinComentarios(schema)),
    sinComentarios(schema).split(/\r?\n/).filter((l) => /\bBytes\b/.test(l)).join(" | "),
  );

  const modeloPaciente = sinComentarios(
    schema.match(/model ClinicaHeridasPaciente \{[\s\S]*?\n\}/)?.[0] ?? "",
  );
  comprobar(
    "el paciente solo guarda referencias opacas (pacienteRef y carpeta)",
    modeloPaciente.length > 0 && !/documento|nombre/i.test(modeloPaciente),
    modeloPaciente.split(/\r?\n/).filter((l) => /documento|nombre/i.test(l)).join(" | "),
  );
  const auditoria = sinComentarios(schema.match(/model ClinicaHeridasConsulta \{[\s\S]*?\n\}/)?.[0] ?? "");
  comprobar(
    "la auditoria de consultas no guarda documento ni nombre",
    auditoria.length > 0 && !/documento|nombre/i.test(auditoria),
    auditoria.split(/\r?\n/).filter((l) => /documento|nombre/i.test(l)).join(" | "),
  );
}

{
  const seguimientos = join(RAIZ, "app", "api", "clinica-heridas", "seguimientos", "route.ts");
  const codigo = soloCodigo(readFileSync(seguimientos, "utf8"));
  comprobar(
    "el endpoint de seguimientos exige un pacienteRef con formato UUID",
    /esPacienteRefValido\(pacienteRef\)/.test(codigo) && /pacienteRef,/.test(codigo),
  );
  // El nombre y el documento se aceptan solo para nombrar la carpeta de
  // SharePoint: lo que no puede ocurrir es que lleguen al `data` de Prisma.
  const bloqueCreate = codigo.match(/prisma\.clinicaHeridas\.create\(\{[\s\S]*?\n    \}\)/)?.[0] ?? "";
  comprobar(
    "el create de Prisma no escribe documento ni nombre del paciente",
    bloqueCreate.length > 0 && !/documento|pacienteNombre/i.test(bloqueCreate),
    bloqueCreate.split(/\r?\n/).filter((l) => /documento|nombre/i.test(l)).join(" | "),
  );
}

{
  const infractores = [];
  for (const f of listarArchivos(join(RAIZ, "app", "clinica-heridas"), [".tsx", ".ts"])) {
    const bruto = readFileSync(f, "utf8");
    const codigo = soloCodigo(bruto);
    if (/localStorage|sessionStorage|document\.cookie/.test(codigo)) infractores.push(`${rel(f)}: almacenamiento en navegador`);
    if (/method:\s*["']GET["'][\s\S]{0,200}documento/.test(sinComentarios(bruto))) infractores.push(`${rel(f)}: documento por GET`);
    if (/buscar-paciente\?[^"'`]*documento/.test(sinComentarios(bruto))) infractores.push(`${rel(f)}: documento en query string`);
  }
  comprobar("la interfaz no guarda el documento ni lo envia por URL/GET", infractores.length === 0, infractores.join("\n          -> "));
}

{
  // El documento no puede aparecer en ninguna llamada de logging, en ningun
  // archivo del modulo.
  const modulos = [
    join(RAIZ, "lib", "clinicaHeridas.ts"),
    join(RAIZ, "lib", "clinicaHeridasSharePoint.ts"),
    ...listarArchivos(join(RAIZ, "app", "api", "clinica-heridas"), [".ts"]),
  ];
  const infractores = [];
  for (const f of modulos) {
    // Se vacian los literales de cadena: el mensaje de un log puede describir
    // lo que fallo; lo prohibido es pasar el VALOR sensible como argumento.
    const codigo = soloCodigo(readFileSync(f, "utf8"));
    for (const linea of codigo.split(/\r?\n/)) {
      if (!/console\.(log|error|warn|info)/.test(linea)) continue;
      if (/documento|nombre|paciente|rawBody|payload|secret|firma/i.test(linea)) {
        infractores.push(`${rel(f)}: ${linea.trim().slice(0, 90)}`);
      }
    }
  }
  comprobar("ninguna llamada a console registra documento, nombre, payload ni secretos", infractores.length === 0, infractores.join("\n          -> "));
}

// --- 3. Aislamiento respecto al sistema productor ---------------------------
console.log("\nAislamiento del sistema productor");

{
  const PROHIBIDO = [
    /postgres:\/\//i,
    /\.postgres\.database\.azure\.com/i,
    /Server=.*Database=.*Password=/i,
    /nexa/i,
    /intranet/i,
  ];
  const infractores = [];
  for (const [f, texto] of contenidos) {
    if (rel(f).startsWith("supabase/")) continue;
    // Este mismo verificador contiene los patrones prohibidos por definicion.
    if (rel(f) === "scripts/clinica-heridas/security-checks.mjs") continue;
    // Se conservan los literales de cadena (ahi viviria una cadena de conexion)
    // pero se descartan los comentarios que documenten la frontera.
    const codigo = sinComentarios(texto);
    for (const patron of PROHIBIDO) {
      if (patron.test(codigo)) infractores.push(`${rel(f)}: coincide ${patron}`);
    }
  }
  comprobar("el portal no referencia el sistema productor ni cadenas de conexion externas", infractores.length === 0, infractores.join("\n          -> "));
}

{
  const cliente = readFileSync(join(RAIZ, "lib", "clinicaHeridas.ts"), "utf8");
  const urls = [...cliente.matchAll(/fetch\(\s*`?([^`,)]*)/g)].map((m) => m[1]);
  comprobar(
    "la unica llamada saliente del modulo apunta a la Edge Function del puente",
    urls.length === 1 && urls[0].includes("functions/v1/get-paciente-clinica-heridas"),
    urls.join(" | "),
  );
  comprobar(
    "el modulo no reutiliza la funcion de escritura sync-pacientes-heridas",
    !cliente.includes("sync-pacientes-heridas"),
  );
}

// --- 4. Guardas de rol -------------------------------------------------------
console.log("\nGuardas del rol CLINICA_HERIDAS");

{
  const middleware = readFileSync(join(RAIZ, "middleware.ts"), "utf8");
  comprobar(
    "el middleware bloquea /clinica-heridas sin el rol",
    /clinica-heridas/.test(middleware) && /tieneAccesoClinicaHeridas/.test(middleware),
  );
}

{
  const pagina = readFileSync(join(RAIZ, "app", "clinica-heridas", "page.tsx"), "utf8");
  comprobar(
    "la pagina valida sesion y rol server-side",
    /getServerSession/.test(pagina) && /tieneAccesoClinicaHeridas/.test(pagina) && /redirect/.test(pagina),
  );
}

{
  // Todos los endpoints del modulo, incluido el que sirve las fotos.
  const endpoints = listarArchivos(join(RAIZ, "app", "api", "clinica-heridas"), [".ts"]);
  const infractores = [];
  for (const f of endpoints) {
    const texto = readFileSync(f, "utf8");
    if (!/getServerSession/.test(texto)) infractores.push(`${rel(f)}: sin getServerSession`);
    if (!/tieneAccesoClinicaHeridas/.test(texto)) infractores.push(`${rel(f)}: sin validacion de rol`);
    if (!/status:\s*401/.test(texto)) infractores.push(`${rel(f)}: sin respuesta 401`);
    if (!/status:\s*403/.test(texto)) infractores.push(`${rel(f)}: sin respuesta 403`);
  }
  comprobar(
    `los ${endpoints.length} endpoints del modulo validan sesion y rol`,
    infractores.length === 0,
    infractores.join("\n          -> "),
  );

  // Solo el endpoint que sirve una foto puede exponer GET.
  const conGet = endpoints
    .filter((f) => /export async function GET/.test(readFileSync(f, "utf8")))
    .map(rel);
  comprobar(
    "el unico GET del modulo es el que sirve una foto",
    conGet.length === 1 && conGet[0].includes("fotos/[id]"),
    conGet.join(" | "),
  );
}

// --- 4b. Fotos: solo SharePoint ---------------------------------------------
console.log("\nAlmacenamiento de fotos");

{
  const subida = soloCodigo(
    readFileSync(join(RAIZ, "app", "api", "clinica-heridas", "fotos", "route.ts"), "utf8"),
  );
  comprobar(
    "el endpoint de fotos sube el binario a SharePoint",
    /subirFotoSeguimiento/.test(subida),
  );
  comprobar(
    "el endpoint de fotos solo persiste driveItemId, nombre y mimeType",
    /driveItemId:/.test(subida) &&
      !/arrayBuffer|Buffer\.from|base64|bytes:/i.test(subida),
    subida.split(/\r?\n/).filter((l) => /arrayBuffer|Buffer|base64/i.test(l)).join(" | "),
  );

  const cliente = readFileSync(
    join(RAIZ, "app", "clinica-heridas", "ClinicaHeridasWorkspace.tsx"),
    "utf8",
  );
  comprobar(
    "la interfaz abre las fotos por el portal, no por la URL de SharePoint",
    /\/api\/clinica-heridas\/fotos\//.test(cliente) &&
      !/sharepoint\.com|graph\.microsoft\.com/i.test(cliente),
  );

  const sp = readFileSync(join(RAIZ, "lib", "clinicaHeridasSharePoint.ts"), "utf8");
  comprobar(
    'el modulo de SharePoint declara import "server-only"',
    /import\s+["']server-only["']/.test(sp),
  );
  comprobar(
    "las carpetas siguen la estructura ClinicaDeHeridas/paciente/Seguimiento N",
    /ClinicaDeHeridas/.test(sp) && /Seguimiento \$\{numero\}/.test(sp),
  );
}

{
  const buscar = readFileSync(join(RAIZ, "app", "api", "clinica-heridas", "buscar-paciente", "route.ts"), "utf8");
  comprobar("el endpoint de busqueda aplica rate limiting antes de consultar", /evaluarRateLimit/.test(buscar) && /429/.test(buscar));
}

// --- 5. Bundle servido al navegador -----------------------------------------
console.log("\nBundle de cliente");

const dirEstatico = join(RAIZ, ".next", "static");
if (!existsSync(dirEstatico)) {
  console.log("  --    .next/static no existe: ejecuta `npm run build` para incluir esta comprobacion");
} else {
  const archivos = listarArchivos(dirEstatico, [".js"]);
  const valoresSecretos = [];
  for (const archivo of [".env.local", ".env"]) {
    if (!existsSync(join(RAIZ, archivo))) continue;
    for (const linea of readFileSync(join(RAIZ, archivo), "utf8").split(/\r?\n/)) {
      const m = linea.match(/^\s*(BRIDGE_[A-Z_]+|SUPABASE_[A-Z_]+)\s*=\s*(.+)\s*$/);
      if (m && m[2].trim().length >= 16) valoresSecretos.push({ nombre: m[1], valor: m[2].trim().replace(/^["']|["']$/g, "") });
    }
  }

  const infractores = [];
  for (const archivo of archivos) {
    const texto = readFileSync(archivo, "utf8");
    for (const s of valoresSecretos) {
      if (texto.includes(s.valor)) infractores.push(`${rel(archivo)}: contiene el valor de ${s.nombre}`);
    }
    for (const nombre of ["BRIDGE_QUERY_API_SECRET", "BRIDGE_HMAC_SECRET", "BRIDGE_ENCRYPTION_KEY"]) {
      if (texto.includes(nombre)) infractores.push(`${rel(archivo)}: menciona ${nombre}`);
    }
  }
  comprobar(
    `ningun secreto aparece en los ${archivos.length} bundles servidos al navegador`,
    infractores.length === 0,
    infractores.join("\n          -> "),
  );
}

console.log(`\nResultado: ${pasadas} correctas, ${fallidas} fallidas\n`);
process.exit(fallidas === 0 ? 0 : 1);
