export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import { notificarNovedadesFarmaciaSinGestion } from "@/lib/notificarNovedadesFarmaciaSinGestion";

function tieneTokenCronValido(req: Request) {
  const secret = (process.env.CRON_SECRET || "").trim();
  if (!secret) return false;

  const authHeader = (req.headers.get("authorization") || "").trim();
  return authHeader === `Bearer ${secret}`;
}

async function tieneSesionGestora() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return false;

  const rol = String((session.user as { rol?: string }).rol || "");
  return rol === "ADMINISTRATIVO" || rol === "TECNICO";
}

async function ejecutar(req: Request) {
  const autorizadoPorCron = tieneTokenCronValido(req);
  const autorizadoPorSesion = autorizadoPorCron ? false : await tieneSesionGestora();

  if (!autorizadoPorCron && !autorizadoPorSesion) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  try {
    const resultado = await notificarNovedadesFarmaciaSinGestion();
    return NextResponse.json({
      ok: true,
      ...resultado,
      ejecutadoEn: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Error ejecutando job de alertas farmacia:", error);
    return NextResponse.json({ error: "Error ejecutando job" }, { status: 500 });
  }
}

export async function GET(req: Request) {
  return ejecutar(req);
}

export async function POST(req: Request) {
  return ejecutar(req);
}