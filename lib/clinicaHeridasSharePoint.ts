import "server-only";

import { getGraphToken } from "@/lib/graphAuth";

/**
 * Almacenamiento de las fotos de la Clinica de Heridas en SharePoint.
 *
 * ESTRUCTURA DE CARPETAS (dentro de la biblioteca Documentos):
 *
 *   ClinicaDeHeridas/
 *     <NOMBRE DEL PACIENTE> - <DOCUMENTO>/
 *       Seguimiento 1/
 *         Plano general seguimiento 1.jpg
 *         Medida vertical seguimiento 1.jpg
 *         Medida horizontal seguimiento 1.jpg
 *         Lateral seguimiento 1.jpg
 *       Seguimiento 2/
 *         ...
 *
 * PRIVACIDAD: el nombre y el documento del paciente solo se usan aqui, en
 * memoria, para componer el nombre de la carpeta la primera vez que se crea.
 * A partir de ese momento el portal trabaja con el driveItemId de la carpeta,
 * que es un identificador opaco de Graph y es lo unico que se guarda en Neon.
 *
 * Las fotos NUNCA se guardan en Neon: de cada una se persiste solo su
 * driveItemId, su nombre y su tipo MIME.
 */

const GRAPH = "https://graph.microsoft.com/v1.0";

export type TipoFoto = "PLANO_GENERAL" | "MEDIDA_VERTICAL" | "MEDIDA_HORIZONTAL" | "LATERAL";

/** Etiqueta con la que se nombra cada archivo dentro de la carpeta. */
export const ETIQUETA_FOTO: Record<TipoFoto, string> = {
  PLANO_GENERAL: "Plano general",
  MEDIDA_VERTICAL: "Medida vertical",
  MEDIDA_HORIZONTAL: "Medida horizontal",
  LATERAL: "Lateral",
};

export const TIPOS_FOTO = Object.keys(ETIQUETA_FOTO) as TipoFoto[];

function carpetaRaiz(): string {
  return (process.env.SHAREPOINT_CLINICA_HERIDAS_FOLDER || "ClinicaDeHeridas").replace(
    /^\/+|\/+$/g,
    "",
  );
}

function siteId(): string {
  const id = process.env.SHAREPOINT_SITE_ID;
  if (!id) throw new Error("falta_configuracion_sharepoint");
  return id;
}

/**
 * SharePoint no admite " * : < > ? / \ | en nombres de elemento, ni nombres
 * que empiecen o terminen en espacio o punto.
 */
export function nombreSeguroSharePoint(valor: string): string {
  return valor
    .replace(/[\\/:*?"<>|#%{}~]/g, " ")
    .replace(/\s+/g, " ")
    .replace(/^[\s.]+|[\s.]+$/g, "")
    .slice(0, 120);
}

async function graph(
  ruta: string,
  init: RequestInit & { token: string },
): Promise<Response> {
  const { token, ...resto } = init;
  return fetch(`${GRAPH}${ruta}`, {
    ...resto,
    headers: {
      ...(resto.headers ?? {}),
      Authorization: `Bearer ${token}`,
    },
    cache: "no-store",
  });
}

/** Busca una carpeta hija por nombre. Devuelve su id o null. */
async function buscarHija(token: string, padreId: string, nombre: string): Promise<string | null> {
  const respuesta = await graph(
    `/sites/${siteId()}/drive/items/${padreId}/children?$select=id,name,folder&$top=999`,
    { token, method: "GET" },
  );
  if (!respuesta.ok) return null;
  const datos = (await respuesta.json()) as { value?: Array<{ id: string; name: string }> };
  const hija = datos.value?.find((item) => item.name?.toLowerCase() === nombre.toLowerCase());
  return hija?.id ?? null;
}

/** Crea la carpeta hija si no existe y devuelve su id (idempotente). */
async function asegurarHija(token: string, padreId: string, nombre: string): Promise<string> {
  const existente = await buscarHija(token, padreId, nombre);
  if (existente) return existente;

  const respuesta = await graph(`/sites/${siteId()}/drive/items/${padreId}/children`, {
    token,
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: nombre,
      folder: {},
      "@microsoft.graph.conflictBehavior": "fail",
    }),
  });

  if (respuesta.status === 409) {
    // Otra peticion la creo entre medias: se reutiliza.
    const id = await buscarHija(token, padreId, nombre);
    if (id) return id;
  }

  if (!respuesta.ok) {
    throw new Error(`sharepoint_crear_carpeta:${respuesta.status}`);
  }

  const datos = (await respuesta.json()) as { id?: string };
  if (!datos.id) throw new Error("sharepoint_crear_carpeta:sin_id");
  return datos.id;
}

/** Carpeta ClinicaDeHeridas, en la raiz de la biblioteca Documentos. */
async function asegurarCarpetaRaiz(token: string): Promise<string> {
  const nombre = carpetaRaiz();
  const respuesta = await graph(
    `/sites/${siteId()}/drive/root:/${encodeURIComponent(nombre)}?$select=id`,
    { token, method: "GET" },
  );
  if (respuesta.ok) {
    const datos = (await respuesta.json()) as { id?: string };
    if (datos.id) return datos.id;
  }

  const raiz = await graph(`/sites/${siteId()}/drive/root?$select=id`, { token, method: "GET" });
  if (!raiz.ok) throw new Error(`sharepoint_raiz:${raiz.status}`);
  const datosRaiz = (await raiz.json()) as { id?: string };
  if (!datosRaiz.id) throw new Error("sharepoint_raiz:sin_id");

  return asegurarHija(token, datosRaiz.id, nombre);
}

/**
 * Carpeta del paciente: "<NOMBRE> - <DOCUMENTO>".
 *
 * Es la unica funcion que necesita el nombre y el documento reales, y solo la
 * primera vez: despues el llamador guarda el driveItemId devuelto.
 */
export async function asegurarCarpetaPaciente(params: {
  pacienteNombre: string;
  documento: string;
}): Promise<string> {
  const token = await getGraphToken();
  const raizId = await asegurarCarpetaRaiz(token);

  const nombre = nombreSeguroSharePoint(
    `${params.pacienteNombre.trim()} - ${params.documento.replace(/[^A-Za-z0-9]/g, "")}`,
  );
  if (!nombre) throw new Error("sharepoint_nombre_carpeta_invalido");

  return asegurarHija(token, raizId, nombre);
}

/** Carpeta "Seguimiento N" dentro de la carpeta del paciente. */
export async function asegurarCarpetaSeguimiento(
  carpetaPacienteId: string,
  numero: number,
): Promise<string> {
  const token = await getGraphToken();
  return asegurarHija(token, carpetaPacienteId, `Seguimiento ${numero}`);
}

export type FotoSubida = {
  driveItemId: string;
  nombre: string;
  mimeType: string | null;
};

/**
 * Sube una foto a la carpeta del seguimiento con el nombre del campo, por
 * ejemplo "Medida horizontal seguimiento 2.jpg".
 *
 * Si ya existia una foto de ese mismo tipo se reemplaza, de modo que un
 * seguimiento nunca acumula duplicados del mismo plano.
 */
export async function subirFotoSeguimiento(params: {
  carpetaSeguimientoId: string;
  tipo: TipoFoto;
  numero: number;
  archivo: File;
}): Promise<FotoSubida> {
  const token = await getGraphToken();

  const extension = (params.archivo.name.split(".").pop() || "jpg")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")
    .slice(0, 5);
  const nombreArchivo = nombreSeguroSharePoint(
    `${ETIQUETA_FOTO[params.tipo]} seguimiento ${params.numero}`,
  );
  const nombreFinal = `${nombreArchivo}.${extension || "jpg"}`;

  const bytes = await params.archivo.arrayBuffer();

  const respuesta = await graph(
    `/sites/${siteId()}/drive/items/${params.carpetaSeguimientoId}:/${encodeURIComponent(
      nombreFinal,
    )}:/content?@microsoft.graph.conflictBehavior=replace`,
    {
      token,
      method: "PUT",
      headers: { "Content-Type": params.archivo.type || "application/octet-stream" },
      body: bytes,
    },
  );

  if (!respuesta.ok) {
    throw new Error(`sharepoint_subir_foto:${respuesta.status}`);
  }

  const datos = (await respuesta.json()) as {
    id?: string;
    name?: string;
    file?: { mimeType?: string | null };
  };
  if (!datos.id) throw new Error("sharepoint_subir_foto:sin_id");

  return {
    driveItemId: datos.id,
    nombre: datos.name || nombreFinal,
    mimeType: datos.file?.mimeType ?? params.archivo.type ?? null,
  };
}

/** Descarga el contenido de una foto para servirla desde el portal. */
export async function descargarFoto(driveItemId: string): Promise<Response> {
  const token = await getGraphToken();
  return graph(`/sites/${siteId()}/drive/items/${driveItemId}/content`, {
    token,
    method: "GET",
  });
}

export function sharePointConfigurado(): boolean {
  return Boolean(
    process.env.SHAREPOINT_SITE_ID &&
      process.env.AZURE_CLIENT_ID &&
      process.env.AZURE_CLIENT_SECRET &&
      process.env.AZURE_TENANT_ID,
  );
}
