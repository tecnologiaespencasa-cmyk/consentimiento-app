import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/lib/prisma";

function nombreCompleto(u: any) {
  return `${u?.nombres ?? ""} ${u?.primerApellido ?? ""} ${u?.segundoApellido ?? ""}`
    .replace(/\s+/g, " ")
    .trim();
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { rol } = session.user as any;
  if (!(rol === "ADMINISTRATIVO" || rol === "TECNICO")) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const { id } = await params;
  try {
    const body = await req.json();
    const { estado, prioridad, asignadoA, notasInternas } = body ?? {};
    const esAdmin = rol === "ADMINISTRATIVO";
    const usuarioActual = session.user as any;
    const nombreUsuarioActual = nombreCompleto(usuarioActual) || usuarioActual?.username || "";

    const novedadActual = await prisma.novedad.findUnique({
      where: { id },
      select: { id: true, asignadoA: true },
    });
    if (!novedadActual) {
      return NextResponse.json({ error: "Novedad no encontrada" }, { status: 404 });
    }

    const asignadoActual = String(novedadActual.asignadoA || "").trim() || null;
    const asignadoNuevo = typeof asignadoA !== "undefined"
      ? String(asignadoA || "").trim() || null
      : undefined;
    const asignadoFinal = typeof asignadoNuevo === "undefined" ? asignadoActual : asignadoNuevo;

    if (!esAdmin) {
      if (!asignadoFinal) {
        return NextResponse.json(
          { error: "Debes tomar la novedad antes de guardar cambios" },
          { status: 400 }
        );
      }

      // Solo administrativo puede cambiar/desasignar una novedad ya tomada.
      if (asignadoActual && typeof asignadoNuevo !== "undefined" && asignadoNuevo !== asignadoActual) {
        return NextResponse.json(
          { error: "Solo el rol administrativo puede cambiar o desasignar la novedad" },
          { status: 403 }
        );
      }

      // Si no estaba asignada, técnico debe tomarla a su nombre.
      if (!asignadoActual) {
        if (typeof asignadoNuevo === "undefined") {
          return NextResponse.json(
            { error: "Debes usar 'Tomar novedad' antes de guardar cambios" },
            { status: 400 }
          );
        }

        if (asignadoNuevo !== nombreUsuarioActual) {
          return NextResponse.json(
            { error: "Solo puedes tomar la novedad a tu propio nombre" },
            { status: 403 }
          );
        }
      }
    }

    const data: any = {};
    if (estado) data.estado = estado;
    if (prioridad) data.prioridad = prioridad;
    if (typeof asignadoA !== "undefined") data.asignadoA = asignadoNuevo;
    if (typeof notasInternas !== "undefined") data.notasInternas = String(notasInternas || "").trim() || null;

    const updated = await prisma.novedad.update({ where: { id }, data });
    return NextResponse.json({ ok: true, novedad: updated });
  } catch (error) {
    console.error("Error actualizando novedad:", error);
    return NextResponse.json({ error: "Error actualizando la novedad" }, { status: 500 });
  }
}
