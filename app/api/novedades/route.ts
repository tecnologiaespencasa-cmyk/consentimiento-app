import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import { prisma } from "@/lib/prisma";
import { sendGraphMail } from "@/lib/sendGraphMail";
import { sendTeamsWebhook } from "@/lib/sendTeamsWebhook";
import { uploadToSharePointWithInfo } from "@/lib/uploadToSharePoint";
import { notificarNovedadesFarmaciaSinGestion } from "@/lib/notificarNovedadesFarmaciaSinGestion";
import {
  Prisma,
  Zona,
  CategoriaNovedad,
  TipoDocumento,
  TipoNovedadPaciente,
  TipoNovedadRuta,
  TipoNovedadFarmacia,
} from "@prisma/client";

const DESTINO_NOTIFICACION_AUXILIAR = "admisiones@especialistasencasa.com";
const DESTINO_NOTIFICACION_OTRAS_PROFESIONES = "analistaasistencial@especialistasencasa.com";
const DESTINO_NOTIFICACION_LLAMADA_URGENTE_ANALISTA = "analistaasistencia@especialistasencasa.com";
const DESTINO_NOTIFICACION_LLAMADA_URGENTE_DIRECCION = "direccionasistencial@especialistasencasa.com";
const DESTINO_NOTIFICACION_CLINICA_HERIDAS = "clinicadeheridas@especialistasencasa.com";
const DESCRIPCION_LLAMADA_URGENTE = "Necesito una llamada urgente de apoyo.";

const ZONAS_VALIDAS: Zona[] = [
  "NORTE",
  "SUR",
  "OCCIDENTE",
  "ORIENTE",
  "ORIENTE_ANTIOQUENO",
];

const ZONAS_LABEL: Record<Zona, string> = {
  NORTE: "Norte",
  SUR: "Sur",
  OCCIDENTE: "Occidente",
  ORIENTE: "Oriente",
  ORIENTE_ANTIOQUENO: "Oriente Antioqueño",
};

const CATEGORIA_FARMACIA: CategoriaNovedad = "PROCESO_FARMACEUTICO";
const CATEGORIA_LLAMADA_URGENTE: CategoriaNovedad = "LLAMADA_URGENTE";
const CATEGORIAS_VALIDAS: CategoriaNovedad[] = ["PACIENTE", "RUTA", CATEGORIA_FARMACIA, CATEGORIA_LLAMADA_URGENTE];
const ROLES_CON_ACCESO_FARMACIA = ["FARMACIA", "TECNICO", "ADMINISTRATIVO"];

const TIPOS_DOCUMENTO_VALIDOS: TipoDocumento[] = [
  "CC",
  "TI",
  "CE",
  "PA",
  "PPT",
  "RC",
  "NUIP",
];

const TIPOS_PACIENTE_VALIDOS: TipoNovedadPaciente[] = [
  "ERCA",
  "DATOS_ERRADOS",
  "AGENDAMIENTO",
  "FALLECIMIENTO",
  "HOSPITALIZACION",
  "ALTA_TARDIA",
  "RETRASO_INICIO_TRATAMIENTO",
  "PROBABLE_REACCION_ALERGICA",
  "DOBLE_PRESTADOR",
  "RELACIONAMIENTO",
  "IMPOSIBILIDAD_CONTACTAR_PACIENTE",
  "IMPOSIBILIDAD_INGRESAR_DOMICILIO",
  "OTRA",
];

const TIPOS_PACIENTE_CON_FOTO_OBLIGATORIA: TipoNovedadPaciente[] = [
  "IMPOSIBILIDAD_INGRESAR_DOMICILIO",
  "PROBABLE_REACCION_ALERGICA",
];

const TIPOS_RUTA_VALIDOS: TipoNovedadRuta[] = [
  "INCAPACIDAD",
  "ACCIDENTE",
  "CIERRE_VIAL",
  "NO_REALIZO_RUTA",
];

const TIPOS_FARMACIA_VALIDOS: TipoNovedadFarmacia[] = [
  "ERROR_KARDEX",
  "ERROR_REQUISICION",
  "ERROR_AUTORIZACION",
  "ERROR_AUXILIAR_ASIGNADO",
  "ERROR_FORMULA",
  "ERROR_TODOS_LOS_DOCUMENTOS",
];

function nombreCompleto(u: any) {
  return `${u?.nombres ?? ""} ${u?.primerApellido ?? ""} ${u?.segundoApellido ?? ""}`
    .replace(/\s+/g, " ")
    .trim();
}

function safeStr(v: any) {
  return (v ?? "").toString().trim();
}

function toBool(v: unknown) {
  if (typeof v === "boolean") return v;
  const normalized = safeStr(v).toLowerCase();
  return normalized === "true" || normalized === "1" || normalized === "si" || normalized === "on";
}

function escapeHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function etiquetaCategoria(categoria: CategoriaNovedad) {
  if (categoria === "PACIENTE") return "Paciente";
  if (categoria === "RUTA") return "Ruta";
  if (categoria === CATEGORIA_LLAMADA_URGENTE) return "Llamada urgente";
  return "Proceso farmaceutico";
}

function etiquetaCategoriaConIcono(categoria: CategoriaNovedad) {
  if (categoria === "PACIENTE") return "Categoria: Paciente";
  if (categoria === "RUTA") return "Categoria: Ruta";
  if (categoria === CATEGORIA_LLAMADA_URGENTE) return "Categoria: Llamada urgente";
  return "Categoria: Proceso farmaceutico";
}

function etiquetaZona(zona: Zona) {
  return ZONAS_LABEL[zona] ?? zona;
}

function etiquetaZonaTexto(zona: Zona | null | undefined) {
  if (!zona) return "No aplica";
  return etiquetaZona(zona);
}

function resolverCanalNotificacion(
  profesion: string,
  categoria: CategoriaNovedad,
  esClinicaHeridas: boolean,
  rolReporta: string
) {
  const esRolFarmacia = String(rolReporta || "").toUpperCase() === "FARMACIA";
  const esAuxiliarEnfermeria = profesion === "AUXILIAR_ENFERMERIA";
  const teamsCanalFarmacia = [
    { url: process.env.TEAMS_WEBHOOK_URL_FARMACIA, label: "TEAMS_WEBHOOK_URL_FARMACIA" },
  ];

  if (categoria === CATEGORIA_LLAMADA_URGENTE) {
    return {
      destinosCorreo: [
        DESTINO_NOTIFICACION_AUXILIAR,
        DESTINO_NOTIFICACION_LLAMADA_URGENTE_ANALISTA,
        DESTINO_NOTIFICACION_LLAMADA_URGENTE_DIRECCION,
      ],
      teamsCanales: esRolFarmacia
        ? teamsCanalFarmacia
        : [
            { url: process.env.TEAMS_WEBHOOK_URL, label: "TEAMS_WEBHOOK_URL" },
            { url: process.env.TEAMS_WEBHOOK_URL_OTRAS_PROFESIONES, label: "TEAMS_WEBHOOK_URL_OTRAS_PROFESIONES" },
          ],
      responsableLabel: "Admisiones y analista asistencial",
    };
  }

  if (categoria === CATEGORIA_FARMACIA) {
    return {
      destinosCorreo: [
        DESTINO_NOTIFICACION_AUXILIAR,
        DESTINO_NOTIFICACION_OTRAS_PROFESIONES,
        DESTINO_NOTIFICACION_LLAMADA_URGENTE_DIRECCION,
      ],
      teamsCanales: esRolFarmacia
        ? teamsCanalFarmacia
        : [
            {
              url: esAuxiliarEnfermeria
                ? process.env.TEAMS_WEBHOOK_URL
                : process.env.TEAMS_WEBHOOK_URL_OTRAS_PROFESIONES,
              label: esAuxiliarEnfermeria
                ? "TEAMS_WEBHOOK_URL"
                : "TEAMS_WEBHOOK_URL_OTRAS_PROFESIONES",
            },
          ],
      responsableLabel: "Admisiones, analista asistencial y direccion asistencial",
    };
  }

  if (esClinicaHeridas) {
    return {
      destinosCorreo: [DESTINO_NOTIFICACION_CLINICA_HERIDAS],
      teamsCanales: esRolFarmacia
        ? teamsCanalFarmacia
        : [
            { url: process.env.TEAMS_WEBHOOK_URL_CLINICA_HERIDAS, label: "TEAMS_WEBHOOK_URL_CLINICA_HERIDAS" },
          ],
      responsableLabel: "Clinica de heridas",
    };
  }

  return {
    destinosCorreo: [
      esAuxiliarEnfermeria
        ? DESTINO_NOTIFICACION_AUXILIAR
        : DESTINO_NOTIFICACION_OTRAS_PROFESIONES,
    ],
    teamsCanales: esRolFarmacia
      ? teamsCanalFarmacia
      : [
          {
            url: esAuxiliarEnfermeria
              ? process.env.TEAMS_WEBHOOK_URL
              : process.env.TEAMS_WEBHOOK_URL_OTRAS_PROFESIONES,
            label: esAuxiliarEnfermeria
              ? "TEAMS_WEBHOOK_URL"
              : "TEAMS_WEBHOOK_URL_OTRAS_PROFESIONES",
          },
        ],
    responsableLabel: esAuxiliarEnfermeria ? "Admisiones" : "Analista asistencial",
  };
}

function formatDateForRadicado(date: Date) {
  const parts = new Intl.DateTimeFormat("es-CO", {
    timeZone: "America/Bogota",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).formatToParts(date);

  const day = parts.find((p) => p.type === "day")?.value ?? "01";
  const month = parts.find((p) => p.type === "month")?.value ?? "01";
  const year = parts.find((p) => p.type === "year")?.value ?? "1970";

  return `${day}${month}${year}`;
}

function buildGoogleMapsLink(latitud: number, longitud: number) {
  const query = encodeURIComponent(`${latitud},${longitud}`);
  return `https://www.google.com/maps/search/?api=1&query=${query}`;
}

async function buildNovedadRadicado(cedula: string) {
  const fecha = formatDateForRadicado(new Date());
  const cedulaLimpia = safeStr(cedula).replace(/\D/g, "") || "0";
  const prefix = `${fecha}-`;

  const idsDelDia = await prisma.novedad.findMany({
    where: { id: { startsWith: prefix } },
    select: { id: true },
  });

  let maxConsecutivo = 0;

  for (const { id } of idsDelDia) {
    const partes = id.split("-");
    const consecutivo = Number(partes[2]);

    if (Number.isInteger(consecutivo) && consecutivo > maxConsecutivo) {
      maxConsecutivo = consecutivo;
    }
  }

  return `${fecha}-${cedulaLimpia}-${maxConsecutivo + 1}`;
}

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  try {
    await notificarNovedadesFarmaciaSinGestion();
  } catch (error) {
    console.error("No se pudo procesar alerta de novedades farmacia sin gestionar:", error);
  }

  const { searchParams } = new URL(req.url);
  const mine = searchParams.get("mine") === "true";
  const all = searchParams.get("all") === "true";

  const { rol, id } = session.user as any;

  // Por defecto: propias
  let where: any = { usuarioId: id };

  if (all) {
    if (!(rol === "ADMINISTRATIVO" || rol === "TECNICO")) {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }
    where = {};
  }

  if (mine) where = { usuarioId: id };

  if (rol === "FARMACIA") {
    where = { ...where, categoria: { in: [CATEGORIA_FARMACIA, CATEGORIA_LLAMADA_URGENTE] } };
  } else if (rol === "ESPECIALISTA") {
    where = { ...where, NOT: { categoria: CATEGORIA_FARMACIA } };
  }

  const novedades = await prisma.novedad.findMany({
    where,
    include: {
      usuario: {
        select: {
          username: true,
          nombres: true,
          primerApellido: true,
          segundoApellido: true,
          rol: true,
          email: true,
          telefono: true,
          cedula: true,
          profesion: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(novedades);
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const u = session.user as any;

  try {
    const contentType = req.headers.get("content-type") || "";

    let telefono = "";
    let rawZona = "";
    let zona: Zona | null = null;
    let categoria = "";
    let pacienteNombre = "";
    let pacienteTipoDoc = "";
    let pacienteDocumento = "";
    let tipoPaciente = "";
    let tipoRuta = "";
    let tipoFarmacia = "";
    let descripcion = "";
    let esClinicaHeridas = false;
    let ubicacionLatitudRaw = "";
    let ubicacionLongitudRaw = "";
    let fotoIngresoDomicilio: File | null = null;
    let fotoRutaEvidencia: File | null = null;

    if (contentType.includes("multipart/form-data")) {
      const formData = await req.formData();
      telefono = safeStr(formData.get("telefono"));
      rawZona = safeStr(formData.get("zona"));
      categoria = safeStr(formData.get("categoria"));
      pacienteNombre = safeStr(formData.get("pacienteNombre"));
      pacienteTipoDoc = safeStr(formData.get("pacienteTipoDoc"));
      pacienteDocumento = safeStr(formData.get("pacienteDocumento"));
      tipoPaciente = safeStr(formData.get("tipoPaciente"));
      tipoRuta = safeStr(formData.get("tipoRuta"));
      tipoFarmacia = safeStr(formData.get("tipoFarmacia"));
      esClinicaHeridas = toBool(formData.get("esClinicaHeridas"));
      descripcion = safeStr(formData.get("descripcion"));
      ubicacionLatitudRaw = safeStr(formData.get("ubicacionLatitud"));
      ubicacionLongitudRaw = safeStr(formData.get("ubicacionLongitud"));
      const fotoRaw = formData.get("fotoIngresoDomicilio");
      fotoIngresoDomicilio = fotoRaw instanceof File && fotoRaw.size > 0 ? fotoRaw : null;
      const fotoRutaRaw = formData.get("fotoRutaEvidencia");
      fotoRutaEvidencia = fotoRutaRaw instanceof File && fotoRutaRaw.size > 0 ? fotoRutaRaw : null;
    } else {
      const body = await req.json();
      telefono = safeStr(body?.telefono);
      rawZona = safeStr(body?.zona);
      categoria = safeStr(body?.categoria);
      pacienteNombre = safeStr(body?.pacienteNombre);
      pacienteTipoDoc = safeStr(body?.pacienteTipoDoc);
      pacienteDocumento = safeStr(body?.pacienteDocumento);
      tipoPaciente = safeStr(body?.tipoPaciente);
      tipoRuta = safeStr(body?.tipoRuta);
      tipoFarmacia = safeStr(body?.tipoFarmacia);
      esClinicaHeridas = toBool(body?.esClinicaHeridas);
      descripcion = safeStr(body?.descripcion);
      ubicacionLatitudRaw = safeStr(body?.ubicacionLatitud);
      ubicacionLongitudRaw = safeStr(body?.ubicacionLongitud);
    }

    if (!categoria || !CATEGORIAS_VALIDAS.includes(categoria as CategoriaNovedad)) {
      return NextResponse.json({ error: "Seleccione el tipo de novedad" }, { status: 400 });
    }
    const categoriaEnum = categoria as CategoriaNovedad;
    const esLlamadaUrgente = categoriaEnum === CATEGORIA_LLAMADA_URGENTE;
    const esClinicaHeridasAplicada = esLlamadaUrgente ? false : esClinicaHeridas;

    const puedeReportarProcesoFarmaceutico = ROLES_CON_ACCESO_FARMACIA.includes(String(u.rol));
    if (u.rol === "FARMACIA" && !(categoriaEnum === CATEGORIA_FARMACIA || esLlamadaUrgente)) {
      return NextResponse.json(
        { error: "El rol farmacia solo puede reportar novedades de proceso farmaceutico o llamada urgente" },
        { status: 403 }
      );
    }
    if (categoriaEnum === CATEGORIA_FARMACIA && !puedeReportarProcesoFarmaceutico) {
      return NextResponse.json(
        { error: "Solo los roles farmacia, tecnico o administrativo pueden reportar esta novedad" },
        { status: 403 }
      );
    }
    const requiereZona = categoriaEnum === "PACIENTE" || categoriaEnum === "RUTA";
    if (requiereZona && !rawZona) {
      return NextResponse.json({ error: "Seleccione una zona" }, { status: 400 });
    }
    if (requiereZona && rawZona && !ZONAS_VALIDAS.includes(rawZona as Zona)) {
      return NextResponse.json({ error: "La zona seleccionada no es valida" }, { status: 400 });
    }
    zona = rawZona ? (rawZona as Zona) : null;
    if (categoriaEnum === CATEGORIA_FARMACIA || esLlamadaUrgente) {
      zona = null;
    }
    if (esLlamadaUrgente) {
      descripcion = DESCRIPCION_LLAMADA_URGENTE;
    }
    if (!descripcion || !String(descripcion).trim()) {
      return NextResponse.json({ error: "La descripcion es obligatoria" }, { status: 400 });
    }

    const tieneLatitud = Boolean(ubicacionLatitudRaw);
    const tieneLongitud = Boolean(ubicacionLongitudRaw);
    if (tieneLatitud !== tieneLongitud) {
      return NextResponse.json({ error: "La ubicacion recibida es incompleta" }, { status: 400 });
    }

    const ubicacionLatitud = tieneLatitud ? Number(ubicacionLatitudRaw) : null;
    const ubicacionLongitud = tieneLongitud ? Number(ubicacionLongitudRaw) : null;

    if (
      (ubicacionLatitud !== null && !Number.isFinite(ubicacionLatitud)) ||
      (ubicacionLongitud !== null && !Number.isFinite(ubicacionLongitud))
    ) {
      return NextResponse.json({ error: "La ubicacion recibida no es valida" }, { status: 400 });
    }

    if (ubicacionLatitud !== null && (ubicacionLatitud < -90 || ubicacionLatitud > 90)) {
      return NextResponse.json({ error: "La latitud esta fuera de rango" }, { status: 400 });
    }

    if (ubicacionLongitud !== null && (ubicacionLongitud < -180 || ubicacionLongitud > 180)) {
      return NextResponse.json({ error: "La longitud esta fuera de rango" }, { status: 400 });
    }

    const pacienteTipoDocEnum = TIPOS_DOCUMENTO_VALIDOS.includes(pacienteTipoDoc as TipoDocumento)
      ? (pacienteTipoDoc as TipoDocumento)
      : null;

    const tipoPacienteEnum = TIPOS_PACIENTE_VALIDOS.includes(tipoPaciente as TipoNovedadPaciente)
      ? (tipoPaciente as TipoNovedadPaciente)
      : null;

    const tipoRutaEnum = TIPOS_RUTA_VALIDOS.includes(tipoRuta as TipoNovedadRuta)
      ? (tipoRuta as TipoNovedadRuta)
      : null;

    const tipoFarmaciaEnum = TIPOS_FARMACIA_VALIDOS.includes(tipoFarmacia as TipoNovedadFarmacia)
      ? (tipoFarmacia as TipoNovedadFarmacia)
      : null;

    if (categoriaEnum === "PACIENTE") {
      if (!pacienteNombre || !String(pacienteNombre).trim()) {
        return NextResponse.json({ error: "Nombre del paciente es obligatorio" }, { status: 400 });
      }
      if (!pacienteTipoDocEnum) {
        return NextResponse.json({ error: "Tipo de documento del paciente es obligatorio" }, { status: 400 });
      }
      if (!pacienteDocumento || !String(pacienteDocumento).trim()) {
        return NextResponse.json({ error: "Numero de documento del paciente es obligatorio" }, { status: 400 });
      }
      if (!tipoPacienteEnum) {
        return NextResponse.json({ error: "Tipo de novedad del paciente es obligatorio" }, { status: 400 });
      }
      const requiereFotoPaciente =
        tipoPacienteEnum ? TIPOS_PACIENTE_CON_FOTO_OBLIGATORIA.includes(tipoPacienteEnum) : false;
      if (requiereFotoPaciente && !fotoIngresoDomicilio) {
        return NextResponse.json({ error: "Debe adjuntar una foto para esta novedad" }, { status: 400 });
      }
    }

    if (categoriaEnum === "RUTA") {
      if (!tipoRutaEnum) {
        return NextResponse.json({ error: "Tipo de novedad en ruta es obligatorio" }, { status: 400 });
      }
      if ((tipoRutaEnum === "ACCIDENTE" || tipoRutaEnum === "CIERRE_VIAL") && !fotoRutaEvidencia) {
        return NextResponse.json({ error: "Debe adjuntar una foto para esta novedad de ruta" }, { status: 400 });
      }
    }

    if (categoriaEnum === CATEGORIA_FARMACIA) {
      if (!tipoFarmaciaEnum) {
        return NextResponse.json(
          { error: "Tipo de novedad de proceso farmaceutico es obligatorio" },
          { status: 400 }
        );
      }
    }

    // Snapshot del prestador
    const prestadorNombre = nombreCompleto(u) || u.username;
    const prestadorCedula = u.cedula;
    const prestadorProfesion = u.profesion;
    const prestadorTelefono = safeStr(telefono ?? u.telefono) || null;
    if (esLlamadaUrgente && !prestadorTelefono) {
      return NextResponse.json(
        { error: "Debes confirmar tu numero de celular para reportar una llamada urgente" },
        { status: 400 }
      );
    }

    const requiereFotoIngresoDomicilio =
      categoriaEnum === "PACIENTE" &&
      Boolean(tipoPacienteEnum && TIPOS_PACIENTE_CON_FOTO_OBLIGATORIA.includes(tipoPacienteEnum));
    const requiereFotoRutaEvidencia =
      categoriaEnum === "RUTA" && (tipoRutaEnum === "ACCIDENTE" || tipoRutaEnum === "CIERRE_VIAL");
    const prioridadPorDefecto = categoriaEnum === CATEGORIA_FARMACIA || esLlamadaUrgente ? "ALTA" : "MEDIA";

    let fotoSubida: Awaited<ReturnType<typeof uploadToSharePointWithInfo>> | null = null;
    if (requiereFotoIngresoDomicilio && fotoIngresoDomicilio) {
      if (!fotoIngresoDomicilio.type.startsWith("image/")) {
        return NextResponse.json({ error: "El archivo adjunto debe ser una imagen" }, { status: 400 });
      }

      const maxBytes = 10 * 1024 * 1024; // 10 MB
      if (fotoIngresoDomicilio.size > maxBytes) {
        return NextResponse.json({ error: "La foto no puede superar 10MB" }, { status: 400 });
      }

      fotoSubida = await uploadToSharePointWithInfo(
        fotoIngresoDomicilio,
        prestadorCedula,
        { folder: "FotosNovedades" }
      );
    }

    let fotoRutaSubida: Awaited<ReturnType<typeof uploadToSharePointWithInfo>> | null = null;
    if (requiereFotoRutaEvidencia && fotoRutaEvidencia) {
      if (!fotoRutaEvidencia.type.startsWith("image/")) {
        return NextResponse.json({ error: "El archivo adjunto debe ser una imagen" }, { status: 400 });
      }

      const maxBytes = 10 * 1024 * 1024; // 10 MB
      if (fotoRutaEvidencia.size > maxBytes) {
        return NextResponse.json({ error: "La foto no puede superar 10MB" }, { status: 400 });
      }

      fotoRutaSubida = await uploadToSharePointWithInfo(
        fotoRutaEvidencia,
        prestadorCedula,
        { folder: "FotosNovedades" }
      );
    }

    const fotoEvidenciaUrl = fotoSubida?.webUrl ?? fotoRutaSubida?.webUrl ?? null;
    const ubicacionGoogleMapsUrl =
      ubicacionLatitud !== null && ubicacionLongitud !== null
        ? buildGoogleMapsLink(ubicacionLatitud, ubicacionLongitud)
        : null;
    const categoriaLabel = etiquetaCategoria(categoriaEnum);
    const tipoNovedadSeleccionada =
      categoriaEnum === "PACIENTE"
        ? tipoPacienteEnum
        : categoriaEnum === "RUTA"
        ? tipoRutaEnum
        : categoriaEnum === CATEGORIA_FARMACIA
        ? tipoFarmaciaEnum
        : "LLAMADA_URGENTE";

    let novedad;

    for (let intento = 0; intento < 5; intento++) {
      const radicado = await buildNovedadRadicado(prestadorCedula);

      try {
        const dataNovedad: any = {
          id: radicado,
          prestadorNombre,
          prestadorCedula,
          prestadorProfesion,
          prestadorTelefono,
          zona,
          categoria: categoriaEnum,
          pacienteNombre: categoriaEnum === "PACIENTE" ? safeStr(pacienteNombre) : null,
          pacienteTipoDoc: categoriaEnum === "PACIENTE" ? pacienteTipoDocEnum : null,
          pacienteDocumento: categoriaEnum === "PACIENTE" ? safeStr(pacienteDocumento) : null,
          tipoPaciente: categoriaEnum === "PACIENTE" ? tipoPacienteEnum : null,
          fotoIngresoDomicilioUrl: categoriaEnum === "PACIENTE" ? fotoSubida?.webUrl ?? null : null,
          fotoIngresoDomicilioDriveItemId: categoriaEnum === "PACIENTE" ? fotoSubida?.id ?? null : null,
          fotoIngresoDomicilioNombre: categoriaEnum === "PACIENTE" ? fotoSubida?.name ?? null : null,
          fotoIngresoDomicilioMimeType: categoriaEnum === "PACIENTE" ? fotoSubida?.mimeType ?? null : null,
          fotoRutaEvidenciaUrl: categoriaEnum === "RUTA" ? fotoRutaSubida?.webUrl ?? null : null,
          fotoRutaEvidenciaDriveItemId: categoriaEnum === "RUTA" ? fotoRutaSubida?.id ?? null : null,
          fotoRutaEvidenciaNombre: categoriaEnum === "RUTA" ? fotoRutaSubida?.name ?? null : null,
          fotoRutaEvidenciaMimeType: categoriaEnum === "RUTA" ? fotoRutaSubida?.mimeType ?? null : null,
          tipoRuta: categoriaEnum === "RUTA" ? tipoRutaEnum : null,
          tipoFarmacia: categoriaEnum === CATEGORIA_FARMACIA ? tipoFarmaciaEnum : null,
          descripcion: safeStr(descripcion),
          esClinicaHeridas: esClinicaHeridasAplicada,
          prioridad: prioridadPorDefecto,
          ubicacionLatitud,
          ubicacionLongitud,
          usuarioId: u.id,
        };

        novedad = await prisma.novedad.create({
          data: dataNovedad,
        });

        break;
      } catch (err) {
        if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
          continue;
        }
        throw err;
      }
    }

    if (!novedad) {
      throw new Error("No fue posible generar un radicado unico para la novedad");
    }

    const baseUrl = process.env.NEXTAUTH_URL || "";
    const linkAdmin = baseUrl ? `${baseUrl}/novedades/todas` : "/novedades/todas";

    const { destinosCorreo, teamsCanales, responsableLabel } =
      resolverCanalNotificacion(prestadorProfesion, categoriaEnum, esClinicaHeridasAplicada, String(u.rol || ""));
    const zonaTexto = etiquetaZonaTexto(zona);
    const clinicaHeridasTexto = esLlamadaUrgente
      ? "No aplica (llamada urgente)"
      : esClinicaHeridasAplicada
      ? "Si"
      : "No";

    const canalesTeamsUnicos = Array.from(
      new Map(
        teamsCanales
          .map((c) => ({ ...c, url: safeStr(c.url) }))
          .filter((c) => Boolean(c.url))
          .map((c) => [c.url, c])
      ).values()
    );
    for (const canal of teamsCanales) {
      if (!safeStr(canal.url)) {
        console.warn(`${canal.label} no configurado: no se envia alerta a Teams`);
      }
    }
    for (const canal of canalesTeamsUnicos) {
      try {
        await sendTeamsWebhook(
          canal.url,
          "Nueva novedad registrada",
          [
            `Prestador: ${prestadorNombre} (${prestadorProfesion})`,
            `Categoria: ${categoriaLabel}`,
            `Responsable(s): ${responsableLabel}`,
            `Clinica de heridas: ${clinicaHeridasTexto}`,
            `Zona: ${zonaTexto}`,
            `ID: ${novedad.id}`,
            fotoEvidenciaUrl ? `Foto: ${fotoEvidenciaUrl}` : null,
            ubicacionGoogleMapsUrl ? `Ubicacion: ${ubicacionGoogleMapsUrl}` : null,
            ``,
            `Gestionar en: ${linkAdmin}`,
          ].filter(Boolean).join("\n")
        );
      } catch (e) {
        console.error("No se pudo notificar a Teams:", e);
      }
    }


    // Resumen para equipo (incluye lo necesario para gestion)
    const descripcionTrim = safeStr(descripcion);
    const descripcionCorta =
      descripcionTrim.slice(0, 220) + (descripcionTrim.length > 220 ? "..." : "");

    const resumenEquipo = [
      `Prestador: ${prestadorNombre} (${prestadorProfesion})`,
      `Cedula: ${prestadorCedula}`,
      prestadorTelefono ? `Telefono: ${prestadorTelefono}` : null,
      `Zona: ${zonaTexto}`,
      `Categoria: ${categoriaLabel}`,
      `Responsable(s): ${responsableLabel}`,
      `Clinica de heridas: ${clinicaHeridasTexto}`,
      categoriaEnum === "PACIENTE"
        ? `Paciente: ${safeStr(pacienteNombre)} (${pacienteTipoDoc} ${safeStr(pacienteDocumento)})`
        : null,
      tipoNovedadSeleccionada ? `Tipo: ${tipoNovedadSeleccionada}` : null,
      fotoEvidenciaUrl ? `Foto evidencia: ${fotoEvidenciaUrl}` : null,
      ubicacionGoogleMapsUrl ? `Ubicacion: ${ubicacionGoogleMapsUrl}` : null,
      `Descripcion: ${descripcionCorta}`,
      `ID: ${novedad.id}`,
    ]
      .filter(Boolean)
      .join("\n");

    // Confirmacion al prestador (sin detalles sensibles)
    const emailPrestador = safeStr(u?.email);
    const textoPrestador = [
      `Hola ${prestadorNombre},`,
      ``,
      `Tu novedad fue registrada correctamente y ya fue enviada al equipo encargado para su gestion.`,
      `En caso de requerir informacion adicional, se comunicaran contigo pronto.`,
      ``,
      `Numero de radicado: ${novedad.id}`,
      ``,
      `Gracias.`,
    ].join("\n");

    const htmlPrestador = `
      <div style="font-family: Arial, sans-serif; line-height: 1.5; max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 16px; box-shadow: 0 5px 20px rgba(0,20,50,0.1); overflow: hidden;">

  <!-- Cabecera con estilo de la empresa -->
  <div style="background: linear-gradient(135deg, #e80214 0%, #e80214 100%); padding: 25px 30px; text-align: center;">
    <div style="display:inline-block; background-color:white; border-radius:50px; padding:12px 25px; box-shadow:0 4px 12px rgba(0,0,0,0.1);">
      <span style="font-size:24px; font-weight:700; color:#0a4b7a;">Especialistas</span>
      <span style="font-size:24px; font-weight:300; color:#1a7faa;"> En Casa</span>
      <div style="font-size:14px; font-weight:500; color:#3a3a3a; letter-spacing:1px; margin-top:2px;">SALUD DOMICILIARIA</div>
    </div>
  </div>

  <!-- Contenido principal -->
  <div style="padding: 30px 30px 25px 30px;">

    <!-- Saludo personalizado -->
    <p style="margin:0 0 20px 0; font-size:18px; color:#1e2b3c;">
      Hola <strong style="color:#0a4b7a;">${escapeHtml(prestadorNombre)}</strong>.
    </p>

    <!-- Mensaje de confirmacion -->
    <table cellpadding="0" cellspacing="0" border="0" style="margin-bottom:25px;">
      <tr>
        <td style="background:#e6f7e6; border-radius:40px; padding:15px 25px;">
          <span style="font-size:28px; margin-right:10px;">[OK]</span>
          <span style="font-size:18px; font-weight:600; color:#2e7d32;">Tu novedad fue registrada correctamente.</span>
        </td>
      </tr>
    </table>

    <!-- Mensaje principal -->
    <p style="margin:0 0 15px 0; font-size:16px; color:#2c3e50;">
      Ya fue enviada al equipo encargado para su gestion. En caso de requerir informacion adicional, se comunicaran contigo pronto.
    </p>

    <!-- Tarjeta con numero de radicado -->
    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f0f8ff; border-left:5px solid #e80214; border-radius:12px; margin:25px 0;">
      <tr>
        <td style="padding:18px 20px;">
          <span style="font-size:16px; color:#0a4b7a; font-weight:600;">Numero de radicado:</span>
          <div style="font-size:24px; font-weight:700; color:#0a4b7a; letter-spacing:1px; margin-top:5px;">${escapeHtml(String(novedad.id))}</div>
          <div style="font-size:14px; color:#5a6f84; margin-top:5px;">Guarda este numero para cualquier consulta</div>
        </td>
      </tr>
    </table>

    <!-- Agradecimiento -->
    <p style="margin:20px 0 10px 0; font-size:16px; color:#2c3e50;">
      Gracias por confiar en <strong>Especialistas En Casa</strong>.
    </p>

    <!-- Firma -->
    <div style="margin-top:25px; padding-top:15px; border-top:1px solid #e0e9f0;">
      <p style="margin:0; font-size:14px; color:#5a6f84;">
        <strong style="color:#0a4b7a;">Especialistas En Casa</strong> - Salud Domiciliaria<br>
        <span style="font-size:14px;">Generamos experiencias extraordinarias en salud</span>
      </p>
    </div>

  </div>

  <!-- Footer sutil -->
  <div style="background:#f0f5fa; padding:15px 30px; text-align:center; border-top:1px solid #d0ddee;">
    <p style="margin:0; font-size:12px; color:#6b7a8a;">
      Este es un mensaje automatico, por favor no responder.<br>
      (c) ${new Date().getFullYear()} Especialistas En Casa
    </p>
  </div>

</div>
    `.trim();

    // ===========================
    // Envio de correos (con manejo de errores independiente)
    // ===========================
    // 1) Correo al equipo encargado
    const destinosCorreoUnicos = Array.from(new Set(destinosCorreo.map((d) => safeStr(d)).filter(Boolean)));
    try {
      await sendGraphMail({
        to: destinosCorreoUnicos,
        subject: `Nueva novedad registrada (portal) - ${categoriaLabel}`,
        text: `Se ha registrado una nueva novedad en el portal.

Categoria: ${categoriaLabel}

Resumen:
${resumenEquipo}

Para gestionarla, ingresa al portal administrativo:
${linkAdmin}`,
        html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="margin:0; padding:0; background-color:#f4f7fa; font-family: 'Segoe UI', Roboto, Arial, sans-serif;">
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f4f7fa; padding:30px 10px;">
          <tr>
            <td align="center">
              <table width="100%" style="max-width:600px; width:100%; background-color:#ffffff; border-radius:20px; box-shadow:0 5px 20px rgba(0,20,50,0.1); overflow:hidden;">

                <!-- Cabecera con logo -->
                <tr>
                  <td style="background: linear-gradient(135deg, #e80214 0%, #e80214 100%); padding: 30px 30px 20px 30px; text-align: center;">
                    <div style="display:inline-block; background-color:white; border-radius:60px; padding:15px 30px; box-shadow:0 4px 12px rgba(0,0,0,0.1);">
                      <span style="font-size:28px; font-weight:700; color:#0a4b7a;">Especialistas</span>
                      <span style="font-size:28px; font-weight:300; color:#1a7faa;"> En Casa</span>
                      <div style="font-size:16px; font-weight:500; color:#3a3a3a; letter-spacing:1px; margin-top:4px;">SALUD DOMICILIARIA</div>
                    </div>
                  </td>
                </tr>

                <!-- Titulo -->
                <tr>
                  <td style="padding: 30px 30px 10px 30px;">
                    <h2 style="margin:0; font-size:24px; color:#1e2b3c; font-weight:600;">Se registro una nueva novedad</h2>
                    <div style="height:4px; width:60px; background:#1a7faa; margin:15px 0 10px 0; border-radius:2px;"></div>
                  </td>
                </tr>

                <!-- Categoria -->
                <tr>
                  <td style="padding:0 30px 10px 30px;">
                    <table cellpadding="0" cellspacing="0" border="0">
                      <tr>
                        <td style="background:#e8f0fe; border-radius:30px; padding:8px 18px;">
                          <span style="font-size:16px; color:#0a4b7a;">${etiquetaCategoriaConIcono(categoriaEnum)}</span>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>

                <!-- Resumen -->
                <tr>
                  <td style="padding:10px 30px 5px 30px;">
                    <p style="margin:0 0 8px 0; font-size:16px; color:#3a4a5a; font-weight:500;">Resumen de la novedad:</p>
                  </td>
                </tr>
                <tr>
                  <td style="padding:0 30px 15px 30px;">
                    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f9fcff; border:1px solid #dde7f0; border-radius:16px;">
                      <tr>
                        <td style="padding:20px;">
                          <pre style="margin:0; font-family: 'Courier New', monospace; font-size:15px; color:#1e2b3c; white-space:pre-wrap; line-height:1.5;">${escapeHtml(resumenEquipo)}</pre>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>

                <!-- Boton de accion -->
                <tr>
                  <td style="padding:10px 30px 20px 30px;">
                    <p style="margin:0 0 15px 0; font-size:16px; color:#2c3e50;">
                      Para conocer mas detalles y gestionar esta novedad, ingresa al portal administrativo:
                    </p>
                    <table cellpadding="0" cellspacing="0" border="0">
                      <tr>
                        <td style="background:#0a4b7a; border-radius:50px; box-shadow:0 4px 8px #e80214;">
                          <a href="${escapeHtml(linkAdmin)}" style="display:inline-block; padding:14px 36px; font-size:16px; font-weight:600; color:#ffffff; text-decoration:none; border-radius:50px;">Ir al panel</a>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>

                <!-- Enlace de respaldo -->
                <tr>
                  <td style="padding:0 30px 15px 30px;">
                    <p style="margin:0; font-size:14px; color:#6b7a8a;">
                      Si el boton no funciona, copia este enlace:<br>
                      <a href="${escapeHtml(linkAdmin)}" style="color:#1a7faa; word-break:break-all;">${escapeHtml(linkAdmin)}</a>
                    </p>
                  </td>
                </tr>

                <!-- Footer -->
                <tr>
                  <td style="padding:25px 30px 20px 30px; background:#f0f5fa; border-top:1px solid #d0ddee;">
                    <p style="margin:0; font-size:13px; color:#5a6f84; text-align:center;">
                      Este es un mensaje automatico del sistema de novedades.<br>
                      (c) ${new Date().getFullYear()} Especialistas En Casa - Salud Domiciliaria
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
      </html>
    `.trim(),
      });
    } catch (mailErr) {
      console.error("No se pudo enviar correo al equipo:", mailErr);
    }

    // 2) Confirmacion al prestador (si tiene email)
    // Nota: puede ser gmail/hotmail/yahoo, Graph puede enviar a externos sin problema (si el tenant lo permite).
    if (emailPrestador) {
      try {
        await sendGraphMail({
          to: emailPrestador,
          subject: "Confirmacion: registramos tu novedad",
          text: textoPrestador,
          html: htmlPrestador,
        });
      } catch (mailErr) {
        // No bloqueamos la creacion: solo log.
        console.error("No se pudo enviar correo de confirmacion al prestador:", mailErr);
      }
    } else {
      console.warn("Prestador sin email registrado: no se envia confirmacion. usuarioId=", u?.id);
    }

    try {
      await notificarNovedadesFarmaciaSinGestion();
    } catch (error) {
      console.error("No se pudo procesar alerta de novedades farmacia sin gestionar:", error);
    }

    return NextResponse.json({ ok: true, id: novedad.id });
  } catch (error) {
    console.error("Error creando novedad:", error);
    return NextResponse.json({ error: "Error creando la novedad" }, { status: 500 });
  }
}
