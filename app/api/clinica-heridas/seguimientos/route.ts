import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { Prisma } from "@prisma/client";
import { authOptions } from "@/lib/authOptions";
import { prisma } from "@/lib/prisma";
import { tieneAccesoClinicaHeridas } from "@/lib/roles";
import { esPacienteRefValido } from "@/lib/clinicaHeridas";
import { CAMPOS_CATALOGO, esOpcionValida } from "@/lib/clinicaHeridasCatalogos";
import {
  asegurarCarpetaPaciente,
  asegurarCarpetaSeguimiento,
  sharePointConfigurado,
} from "@/lib/clinicaHeridasSharePoint";

/**
 * Alta de un seguimiento de la Clinica de Heridas.
 *
 * Cada seguimiento es una fila independiente numerada dentro del paciente. Al
 * crearlo se preparan tambien sus carpetas en SharePoint, de modo que las
 * fotos que se suban despues tengan donde ir.
 *
 * PRIVACIDAD: `pacienteNombre` y `documento` solo se usan -- en memoria y una
 * sola vez -- para nombrar la carpeta del paciente en SharePoint. No se
 * escriben en Neon ni en los logs. A partir del segundo seguimiento ya no hacen
 * falta, porque la carpeta se localiza por su driveItemId.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MEDIDA_MAXIMA_CM = 200;

const CAMPOS_MEDIDA = ["diametroVerticalCm", "diametroHorizontalCm", "profundidadCm"] as const;

const ETIQUETAS: Record<string, string> = {
  origen: "Origen",
  ubicacion: "Ubicacion",
  fondo: "Fondo",
  lecho: "Lecho",
  tejido: "Tejido",
  cavitacionTunelizacion: "Cavitacion / tunelizacion",
  pielPerilesional: "Piel perilesional",
  exudadoCantidad: "Cantidad de exudado",
  exudadoCaracteristicas: "Caracteristicas del exudado",
  diametroVerticalCm: "Diametro vertical",
  diametroHorizontalCm: "Diametro horizontal",
  profundidadCm: "Profundidad",
};

function medida(value: unknown): number | null {
  const numero = typeof value === "number" ? value : Number(String(value ?? "").replace(",", "."));
  if (!Number.isFinite(numero)) return null;
  if (numero < 0 || numero > MEDIDA_MAXIMA_CM) return null;
  return Math.round(numero * 10) / 10;
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  if (!tieneAccesoClinicaHeridas(session.user.rol)) {
    return NextResponse.json({ error: "No tienes acceso a Clinica de Heridas" }, { status: 403 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Solicitud invalida." }, { status: 400 });
  }

  const pacienteRef = typeof body?.pacienteRef === "string" ? body.pacienteRef.trim() : "";
  if (!esPacienteRefValido(pacienteRef)) {
    return NextResponse.json(
      { error: "Primero debes buscar y confirmar el paciente." },
      { status: 400 },
    );
  }

  // Cada campo clinico debe traer una opcion EXACTA de su catalogo. El servidor
  // no confia en que el navegador haya usado el desplegable: texto libre,
  // valores inventados o variantes con otra grafia se rechazan aqui.
  const valoresTexto: Record<string, string> = {};
  for (const campo of CAMPOS_CATALOGO) {
    const valor = typeof body?.[campo] === "string" ? body[campo].trim() : "";
    if (!valor) {
      return NextResponse.json(
        { error: `El campo ${ETIQUETAS[campo]} es obligatorio.` },
        { status: 400 },
      );
    }
    if (!esOpcionValida(campo, valor)) {
      return NextResponse.json(
        { error: `El valor de ${ETIQUETAS[campo]} no es una opcion valida.` },
        { status: 400 },
      );
    }
    valoresTexto[campo] = valor;
  }

  const valoresMedida: Record<string, number> = {};
  for (const campo of CAMPOS_MEDIDA) {
    const valor = medida(body?.[campo]);
    if (valor === null) {
      return NextResponse.json(
        { error: `${ETIQUETAS[campo]} debe ser un numero entre 0 y ${MEDIDA_MAXIMA_CM} cm.` },
        { status: 400 },
      );
    }
    valoresMedida[campo] = valor;
  }

  // Datos que solo sirven para nombrar la carpeta de SharePoint.
  const pacienteNombre =
    typeof body?.pacienteNombre === "string" ? body.pacienteNombre.trim().slice(0, 150) : "";
  const documento =
    typeof body?.documento === "string" ? body.documento.trim().slice(0, 30) : "";

  try {
    const paciente = await prisma.clinicaHeridasPaciente.upsert({
      where: { pacienteRef },
      update: {},
      create: { pacienteRef },
      select: { pacienteRef: true, carpetaDriveItemId: true },
    });

    const ultimo = await prisma.clinicaHeridas.findFirst({
      where: { pacienteRef },
      orderBy: { numero: "desc" },
      select: { numero: true },
    });
    const numero = (ultimo?.numero ?? 0) + 1;

    // Carpetas de SharePoint. Si el almacenamiento falla, el seguimiento se
    // guarda igualmente sin carpeta y las fotos se podran subir mas tarde: no
    // se pierde la valoracion clinica por un problema de infraestructura.
    let carpetaPacienteId = paciente.carpetaDriveItemId ?? null;
    let carpetaSeguimientoId: string | null = null;

    // Sin nombre y documento no se puede nombrar la carpeta del paciente. En
    // ese caso NO se aborta: el seguimiento se guarda sin carpeta y esta se
    // crea al subir la primera foto, que vuelve a traer esos datos.
    const puedeCrearCarpetaPaciente = Boolean(pacienteNombre && documento);

    if (sharePointConfigurado() && (carpetaPacienteId || puedeCrearCarpetaPaciente)) {
      try {
        if (!carpetaPacienteId) {
          carpetaPacienteId = await asegurarCarpetaPaciente({ pacienteNombre, documento });
          await prisma.clinicaHeridasPaciente.update({
            where: { pacienteRef },
            data: { carpetaDriveItemId: carpetaPacienteId },
          });
        }
        carpetaSeguimientoId = await asegurarCarpetaSeguimiento(carpetaPacienteId, numero);
      } catch (error) {
        // Un fallo de almacenamiento no puede costar la valoracion clinica.
        console.error("clinica-heridas: no se pudieron preparar las carpetas", {
          motivo: error instanceof Error ? error.message.slice(0, 60) : "desconocido",
        });
      }
    }

    const seguimiento = await prisma.clinicaHeridas.create({
      data: {
        numero,
        pacienteRef,
        origen: valoresTexto.origen,
        ubicacion: valoresTexto.ubicacion,
        fondo: valoresTexto.fondo,
        lecho: valoresTexto.lecho,
        tejido: valoresTexto.tejido,
        cavitacionTunelizacion: valoresTexto.cavitacionTunelizacion,
        pielPerilesional: valoresTexto.pielPerilesional,
        exudadoCantidad: valoresTexto.exudadoCantidad,
        exudadoCaracteristicas: valoresTexto.exudadoCaracteristicas,
        diametroVerticalCm: valoresMedida.diametroVerticalCm,
        diametroHorizontalCm: valoresMedida.diametroHorizontalCm,
        profundidadCm: valoresMedida.profundidadCm,
        carpetaDriveItemId: carpetaSeguimientoId,
        usuarioId: session.user.id,
      },
      select: { id: true, numero: true, carpetaDriveItemId: true },
    });

    return NextResponse.json(
      {
        ok: true,
        seguimiento: {
          id: seguimiento.id,
          numero: seguimiento.numero,
          almacenamientoListo: Boolean(seguimiento.carpetaDriveItemId),
        },
      },
      { status: 201 },
    );
  } catch (error) {
    // Dos altas simultaneas del mismo paciente chocarian en (pacienteRef, numero).
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json(
        { error: "Otro seguimiento se registro al mismo tiempo. Vuelve a intentarlo." },
        { status: 409 },
      );
    }
    console.error("clinica-heridas: error creando seguimiento", {
      motivo: error instanceof Error ? error.name : "desconocido",
    });
    return NextResponse.json(
      { error: "No fue posible guardar el seguimiento. Intente nuevamente." },
      { status: 500 },
    );
  }
}
