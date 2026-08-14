import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import { prisma } from "@/lib/prisma";

const ROLES_GESTION_RONDA = ["ADMINISTRATIVO", "TECNICO"];
const CAUSAS_NO_INGRESO = ["Cambio en el estado clínico", "⁠No aceptación de atención domiciliaria por el paciente", "Cambio de desición por parte del médico tratante", "Alta de la IPS sin atención domiciliaria", "⁠Otra"];

function texto(value: unknown, max: number) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const body = await req.json().catch(() => null);
  const { id } = await params;

  try {
    if (typeof body?.ingresoEfectivo === "boolean") {
      if (!ROLES_GESTION_RONDA.includes(session.user.rol)) return NextResponse.json({ error: "No autorizado" }, { status: 403 });
      const ronda = await prisma.rondaIntramural.update({
        where: { id },
        data: {
          ingresoEfectivo: body.ingresoEfectivo,
          ...(body.ingresoEfectivo ? { causaNoIngreso: null, observacionNoIngreso: null } : {}),
        },
        select: { id: true, ingresoEfectivo: true, causaNoIngreso: true, observacionNoIngreso: true },
      });
      return NextResponse.json({ ok: true, ronda });
    }

    if (body?.ingresoEfectivo !== undefined) {
      return NextResponse.json({ error: "Selecciona Sí o No para el ingreso efectivo." }, { status: 400 });
    }

    const rondaPropia = await prisma.rondaIntramural.findFirst({
      where: { id, usuarioId: session.user.id },
      select: { ingresoEfectivo: true },
    });
    if (!rondaPropia) return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    if (rondaPropia.ingresoEfectivo !== false) {
      return NextResponse.json({ error: "Solo puedes registrar la causa cuando el ingreso efectivo está en No." }, { status: 400 });
    }

    const causaNoIngreso = texto(body?.causaNoIngreso, 30).toUpperCase();
    const observacionNoIngreso = texto(body?.observacionNoIngreso, 99);
    if (causaNoIngreso && !CAUSAS_NO_INGRESO.includes(causaNoIngreso)) {
      return NextResponse.json({ error: "Selecciona una causa de la lista." }, { status: 400 });
    }
    const ronda = await prisma.rondaIntramural.update({
      where: { id },
      data: { causaNoIngreso: causaNoIngreso || null, observacionNoIngreso: observacionNoIngreso || null },
      select: { id: true, ingresoEfectivo: true, causaNoIngreso: true, observacionNoIngreso: true },
    });
    return NextResponse.json({ ok: true, ronda });
  } catch (error) {
    console.error("Error actualizando ingreso efectivo:", error);
    return NextResponse.json({ error: "No fue posible guardar la gestión." }, { status: 500 });
  }
}
