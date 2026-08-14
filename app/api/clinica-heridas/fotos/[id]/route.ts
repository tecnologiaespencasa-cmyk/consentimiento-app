import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import { prisma } from "@/lib/prisma";
import { tieneAccesoClinicaHeridas } from "@/lib/roles";
import { descargarFoto } from "@/lib/clinicaHeridasSharePoint";

/**
 * Sirve una foto de la herida desde SharePoint.
 *
 * El portal referencia siempre este endpoint y nunca la URL directa de
 * SharePoint: asi la foto queda detras de la sesion y del rol, y la ruta de
 * SharePoint -- que contiene el nombre y el documento del paciente -- no se
 * expone al navegador.
 *
 * El identificador de la URL es el id de la fila en Neon, no el driveItemId,
 * para no filtrar identificadores del almacenamiento.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function nombreSeguro(nombre?: string | null) {
  return (nombre || "foto").replace(/[^\w.\-() ]+/g, "_");
}

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  if (!tieneAccesoClinicaHeridas(session.user.rol)) {
    return NextResponse.json({ error: "No tienes acceso a Clinica de Heridas" }, { status: 403 });
  }

  const { id } = await ctx.params;
  const fotoId = decodeURIComponent(id || "").trim();
  if (!fotoId) {
    return NextResponse.json({ error: "Imagen invalida." }, { status: 400 });
  }

  const foto = await prisma.clinicaHeridasFoto.findUnique({
    where: { id: fotoId },
    select: { driveItemId: true, nombre: true, mimeType: true },
  });
  if (!foto) {
    return NextResponse.json({ error: "Imagen no encontrada." }, { status: 404 });
  }

  try {
    const respuesta = await descargarFoto(foto.driveItemId);
    if (!respuesta.ok) {
      console.error("clinica-heridas: fallo descargando foto", { status: respuesta.status });
      return NextResponse.json(
        { error: "No fue posible abrir la imagen. Intente nuevamente." },
        { status: 502 },
      );
    }

    const bytes = await respuesta.arrayBuffer();
    return new NextResponse(bytes, {
      status: 200,
      headers: {
        "Content-Type":
          respuesta.headers.get("content-type") || foto.mimeType || "application/octet-stream",
        "Content-Disposition": `inline; filename="${nombreSeguro(foto.nombre)}"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    console.error("clinica-heridas: error abriendo foto", {
      motivo: error instanceof Error ? error.name : "desconocido",
    });
    return NextResponse.json(
      { error: "No fue posible abrir la imagen. Intente nuevamente." },
      { status: 500 },
    );
  }
}
