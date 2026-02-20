import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/authOptions"
import { prisma } from "@/lib/prisma"
import { sanitizeBoletinHtml } from "@/lib/sanitizeBoletinHtml"

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: "No autorizado" }, { status: 401 })

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
  })

  return NextResponse.json(boletin)
}

export async function PUT(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: "No autorizado" }, { status: 401 })

  const rol = session.user.rol
  if (rol !== "ADMINISTRATIVO") {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 })
  }

  const body = await req.json().catch(() => ({}))

  const titulo = String(body?.titulo ?? "").trim()
  if (!titulo) {
    return NextResponse.json({ error: "El titulo es obligatorio" }, { status: 400 })
  }

  const contenidoHtmlRaw = body?.contenidoHtml ? String(body.contenidoHtml) : null
  const contenidoHtml = contenidoHtmlRaw ? sanitizeBoletinHtml(contenidoHtmlRaw) : null

  const adjuntoTipo = body?.adjuntoTipo ?? null // "IMAGE" | "PDF" | null
  const adjuntoDriveItemId = body?.adjuntoDriveItemId ? String(body.adjuntoDriveItemId).trim() : null
  const adjuntoNombre = body?.adjuntoNombre ? String(body.adjuntoNombre).trim() : null
  const adjuntoMimeType = body?.adjuntoMimeType ? String(body.adjuntoMimeType).trim() : null

  if (adjuntoTipo && !adjuntoDriveItemId) {
    return NextResponse.json({ error: "Adjunto invalido: falta el identificador del archivo" }, { status: 400 })
  }

  const nuevo = await prisma.boletin.create({
    data: {
      titulo,
      contenidoHtml,
      adjuntoTipo,
      adjuntoDriveItemId,
      adjuntoNombre,
      adjuntoMimeType,
      publicado: true,
      autorId: session.user.id,
    },
    select: { id: true },
  })

  return NextResponse.json({ ok: true, id: nuevo.id })
}
