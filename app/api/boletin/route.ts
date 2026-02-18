import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/lib/prisma";

function sanitizeHtmlBasic(input: string): string {
  // Sanitizado mínimo para evitar scripts/event handlers.
  // (Solo admins editan, pero igual evitamos cosas peligrosas.)
  return String(input ?? "")
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, "")
    .replace(/<iframe[\s\S]*?>[\s\S]*?<\/iframe>/gi, "")
    .replace(/on\w+\s*=\s*"[^"]*"/gi, "")
    .replace(/on\w+\s*=\s*'[^']*'/gi, "")
    .replace(/javascript:/gi, "");
}

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const boletin = await prisma.boletin.findFirst({
    where: { publicado: true },
    orderBy: { updatedAt: "desc" },
    include: {
      autor: {
        select: {
          nombres: true,
          primerApellido: true,
          segundoApellido: true,
          username: true,
        },
      },
    },
  });

  return NextResponse.json(boletin);
}

export async function PUT(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const rol = (session.user as any).rol;
  if (rol !== "ADMINISTRATIVO") {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));

  const titulo = String(body?.titulo ?? "").trim();
  if (!titulo) {
    return NextResponse.json({ error: "El título es obligatorio" }, { status: 400 });
  }

  const contenidoHtmlRaw = body?.contenidoHtml ? String(body.contenidoHtml) : null;
  const contenidoHtml = contenidoHtmlRaw ? sanitizeHtmlBasic(contenidoHtmlRaw).trim() : null;

  const adjuntoTipo = body?.adjuntoTipo ?? null; // "IMAGE" | "PDF" | null
  const adjuntoDriveItemId = body?.adjuntoDriveItemId ? String(body.adjuntoDriveItemId).trim() : null;
  const adjuntoNombre = body?.adjuntoNombre ? String(body.adjuntoNombre).trim() : null;
  const adjuntoMimeType = body?.adjuntoMimeType ? String(body.adjuntoMimeType).trim() : null;

  // Si hay tipo, debe haber driveItemId
  if (adjuntoTipo && !adjuntoDriveItemId) {
    return NextResponse.json({ error: "Adjunto inválido: falta el identificador del archivo" }, { status: 400 });
  }

  // Creamos una nueva versión (historial)
  const nuevo = await prisma.boletin.create({
    data: {
      titulo,
      contenidoHtml,
      adjuntoTipo,
      adjuntoDriveItemId,
      adjuntoNombre,
      adjuntoMimeType,
      publicado: true,
      autorId: (session.user as any).id,
    },
    select: { id: true },
  });

  return NextResponse.json({ ok: true, id: nuevo.id });
}
