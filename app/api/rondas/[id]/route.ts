import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import { prisma } from "@/lib/prisma";

const ROLES_GESTION_RONDA = ["ADMINISTRATIVO", "TECNICO"];

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  if (!ROLES_GESTION_RONDA.includes(session.user.rol)) return NextResponse.json({ error: "No autorizado" }, { status: 403 });

  const body = await req.json().catch(() => null);
  if (typeof body?.ingresoEfectivo !== "boolean") {
    return NextResponse.json({ error: "Selecciona Sí o No para el ingreso efectivo." }, { status: 400 });
  }

  const { id } = await params;
  try {
    const ronda = await prisma.rondaIntramural.update({
      where: { id },
      data: { ingresoEfectivo: body.ingresoEfectivo },
      select: { id: true, ingresoEfectivo: true },
    });
    return NextResponse.json({ ok: true, ronda });
  } catch (error) {
    console.error("Error actualizando ingreso efectivo:", error);
    return NextResponse.json({ error: "No fue posible guardar la gestión." }, { status: 500 });
  }
}
