import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/authOptions"
import { prisma } from "@/lib/prisma"

const MAX_FOTO_BYTES = 260 * 1024

function isValidPhotoDataUrl(value: string) {
  return /^data:image\/(jpeg|jpg|webp);base64,[A-Za-z0-9+/=]+$/.test(value)
}

export async function PATCH(req: Request) {
  const session = await getServerSession(authOptions)

  if (!session?.user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  }

  const body = await req.json().catch(() => null)
  const fotoCarnet = typeof body?.fotoCarnet === "string" ? body.fotoCarnet.trim() : null

  if (fotoCarnet && !isValidPhotoDataUrl(fotoCarnet)) {
    return NextResponse.json({ error: "Formato de foto invalido" }, { status: 400 })
  }

  if (fotoCarnet && Buffer.byteLength(fotoCarnet, "utf8") > MAX_FOTO_BYTES) {
    return NextResponse.json({ error: "La foto supera el tamano permitido" }, { status: 413 })
  }

  try {
    const updated = await prisma.user.update({
      where: { id: session.user.id },
      data: { fotoCarnet },
      select: { fotoCarnet: true },
    })

    return NextResponse.json({ ok: true, fotoCarnet: updated.fotoCarnet })
  } catch (error) {
    console.error("Error actualizando foto de carnet:", error)
    return NextResponse.json({ error: "Error actualizando foto de carnet" }, { status: 500 })
  }
}
