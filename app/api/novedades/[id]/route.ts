import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/lib/prisma";

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

    const data: any = {};
    if (estado) data.estado = estado;
    if (prioridad) data.prioridad = prioridad;
    if (typeof asignadoA !== "undefined") data.asignadoA = String(asignadoA || "").trim() || null;
    if (typeof notasInternas !== "undefined") data.notasInternas = String(notasInternas || "").trim() || null;

    const updated = await prisma.novedad.update({ where: { id }, data });
    return NextResponse.json({ ok: true, novedad: updated });
  } catch (error) {
    console.error("Error actualizando novedad:", error);
    return NextResponse.json({ error: "Error actualizando la novedad" }, { status: 500 });
  }
}
