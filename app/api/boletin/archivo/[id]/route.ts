import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/lib/prisma";
import { getGraphToken } from "@/lib/graphAuth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function safeFileName(name?: string | null) {
  const base = (name || "archivo").toString().trim();
  return base.replace(/[^\w.\-() ]+/g, "_");
}

export async function GET(
  req: Request,
  ctx: { params: Promise<{ id: string }> } // 👈 params como Promise
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { id } = await ctx.params; // 👈 aquí se “desenvuelve” params
  const driveItemId = decodeURIComponent(id || "").trim();

  if (!driveItemId) {
    return NextResponse.json({ error: "Archivo inválido" }, { status: 400 });
  }

  const rol = (session.user as any).rol;

  // Seguridad: si NO es admin, solo permitir archivos asociados a boletín publicado
  if (rol !== "ADMINISTRATIVO") {
    const existe = await prisma.boletin.findFirst({
      where: { publicado: true, adjuntoDriveItemId: driveItemId },
      select: { id: true },
    });

    if (!existe) {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }
  }

  const meta = await prisma.boletin.findFirst({
    where: { adjuntoDriveItemId: driveItemId },
    select: { adjuntoNombre: true, adjuntoMimeType: true },
    orderBy: { updatedAt: "desc" },
  });

  const siteId = process.env.SHAREPOINT_SITE_ID;
  if (!siteId) {
    return NextResponse.json({ error: "Falta env SHAREPOINT_SITE_ID" }, { status: 500 });
  }

  const token = await getGraphToken();

  const downloadUrl = `https://graph.microsoft.com/v1.0/sites/${siteId}/drive/items/${driveItemId}/content`;

  const res = await fetch(downloadUrl, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });

  if (!res.ok) {
    const t = await res.text().catch(() => "");
    return NextResponse.json(
      { error: `Error descargando archivo: ${res.status}`, detail: t },
      { status: 500 }
    );
  }

  const contentType =
    res.headers.get("content-type") ||
    meta?.adjuntoMimeType ||
    "application/octet-stream";

  const fileName = safeFileName(meta?.adjuntoNombre) || "archivo";
  const bytes = await res.arrayBuffer();

  return new NextResponse(bytes, {
    status: 200,
    headers: {
      "Content-Type": contentType,
      "Content-Disposition": `inline; filename="${fileName}"`,
      "Cache-Control": "no-store",
    },
  });
}