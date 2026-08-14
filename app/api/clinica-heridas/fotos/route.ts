import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import { prisma } from "@/lib/prisma";
import { tieneAccesoClinicaHeridas } from "@/lib/roles";
import {
  asegurarCarpetaPaciente,
  asegurarCarpetaSeguimiento,
  sharePointConfigurado,
  subirFotoSeguimiento,
  TIPOS_FOTO,
  type TipoFoto,
} from "@/lib/clinicaHeridasSharePoint";

/**
 * Subida de una foto de la herida.
 *
 * El binario viaja a SharePoint y NUNCA se guarda en Neon: de la respuesta de
 * Graph solo se persiste el driveItemId (opaco), el nombre del archivo y su
 * tipo MIME, que es lo minimo para volver a abrirla desde el portal.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_MB = 15;
const TIPOS_MIME_PERMITIDOS = ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"];

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  if (!tieneAccesoClinicaHeridas(session.user.rol)) {
    return NextResponse.json({ error: "No tienes acceso a Clinica de Heridas" }, { status: 403 });
  }
  if (!sharePointConfigurado()) {
    return NextResponse.json(
      { error: "El almacenamiento de fotos no esta configurado." },
      { status: 503 },
    );
  }

  try {
    const form = await req.formData();
    const seguimientoId = String(form.get("seguimientoId") ?? "").trim();
    const tipo = String(form.get("tipo") ?? "").trim() as TipoFoto;
    const archivo = form.get("archivo");

    if (!seguimientoId) {
      return NextResponse.json({ error: "Seguimiento invalido." }, { status: 400 });
    }
    if (!TIPOS_FOTO.includes(tipo)) {
      return NextResponse.json({ error: "Tipo de foto invalido." }, { status: 400 });
    }
    if (!(archivo instanceof File) || archivo.size === 0) {
      return NextResponse.json({ error: "Selecciona una imagen." }, { status: 400 });
    }
    if (!TIPOS_MIME_PERMITIDOS.includes(archivo.type)) {
      return NextResponse.json(
        { error: "Solo se permiten imagenes JPG, PNG, WEBP o HEIC." },
        { status: 400 },
      );
    }
    if (archivo.size / (1024 * 1024) > MAX_MB) {
      return NextResponse.json(
        { error: `La imagen supera el tamaño maximo (${MAX_MB} MB).` },
        { status: 400 },
      );
    }

    const seguimiento = await prisma.clinicaHeridas.findUnique({
      where: { id: seguimientoId },
      select: {
        id: true,
        numero: true,
        carpetaDriveItemId: true,
        pacienteRef: true,
        paciente: { select: { carpetaDriveItemId: true } },
      },
    });
    if (!seguimiento) {
      return NextResponse.json({ error: "Seguimiento no encontrado." }, { status: 404 });
    }

    // Si el alta no pudo preparar las carpetas (por ejemplo, una caida puntual
    // de Graph), se reintenta aqui con los datos que ya estan en la base.
    let carpetaSeguimientoId = seguimiento.carpetaDriveItemId;
    if (!carpetaSeguimientoId) {
      const carpetaPacienteId = seguimiento.paciente.carpetaDriveItemId;
      if (!carpetaPacienteId) {
        const pacienteNombre = String(form.get("pacienteNombre") ?? "").trim();
        const documento = String(form.get("documento") ?? "").trim();
        if (!pacienteNombre || !documento) {
          return NextResponse.json(
            { error: "Vuelve a buscar el paciente para preparar el almacenamiento." },
            { status: 409 },
          );
        }
        const nuevaCarpetaPaciente = await asegurarCarpetaPaciente({ pacienteNombre, documento });
        await prisma.clinicaHeridasPaciente.update({
          where: { pacienteRef: seguimiento.pacienteRef },
          data: { carpetaDriveItemId: nuevaCarpetaPaciente },
        });
        carpetaSeguimientoId = await asegurarCarpetaSeguimiento(
          nuevaCarpetaPaciente,
          seguimiento.numero,
        );
      } else {
        carpetaSeguimientoId = await asegurarCarpetaSeguimiento(
          carpetaPacienteId,
          seguimiento.numero,
        );
      }
      await prisma.clinicaHeridas.update({
        where: { id: seguimiento.id },
        data: { carpetaDriveItemId: carpetaSeguimientoId },
      });
    }

    const subida = await subirFotoSeguimiento({
      carpetaSeguimientoId,
      tipo,
      numero: seguimiento.numero,
      archivo,
    });

    // Solo la referencia entra a Neon.
    const foto = await prisma.clinicaHeridasFoto.upsert({
      where: { seguimientoId_tipo: { seguimientoId: seguimiento.id, tipo } },
      update: {
        driveItemId: subida.driveItemId,
        nombre: subida.nombre,
        mimeType: subida.mimeType,
      },
      create: {
        seguimientoId: seguimiento.id,
        tipo,
        driveItemId: subida.driveItemId,
        nombre: subida.nombre,
        mimeType: subida.mimeType,
      },
      select: { id: true, tipo: true, nombre: true },
    });

    return NextResponse.json({ ok: true, foto }, { status: 201 });
  } catch (error) {
    console.error("clinica-heridas: error subiendo foto", {
      motivo: error instanceof Error ? error.message.slice(0, 60) : "desconocido",
    });
    return NextResponse.json(
      { error: "No fue posible guardar la imagen. Intente nuevamente." },
      { status: 500 },
    );
  }
}
