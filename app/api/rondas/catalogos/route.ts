import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import { prisma } from "@/lib/prisma";

const ROLES_RONDA = ["MEDICO_RONDA", "TECNICO", "ADMINISTRATIVO"];

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  if (!ROLES_RONDA.includes(String(session.user.rol))) return NextResponse.json({ error: "No autorizado" }, { status: 403 });

  const codigo = new URL(req.url).searchParams.get("cie10")?.trim().toUpperCase();
  if (!codigo || !/^[A-Z][0-9]{3}$/.test(codigo)) return NextResponse.json({ descripcion: null });
  const cie10 = await prisma.cie10Catalogo.findUnique({ where: { codigo }, select: { descripcion: true } });
  return NextResponse.json({ descripcion: cie10?.descripcion ?? null });
}
