export const runtime = "nodejs"

import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/authOptions"
import { prisma } from "@/lib/prisma"

export async function PATCH(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user || session.user.rol !== "ADMINISTRATIVO") {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 })
    }

    const { id } = await context.params
    if (!id) {
      return NextResponse.json({ error: "Id de usuario invalido" }, { status: 400 })
    }

    if (id === session.user.id) {
      return NextResponse.json(
        { error: "No puedes modificar tu propio estado" },
        { status: 400 }
      )
    }

    const body = await req.json().catch(() => null)
    const activo = body?.activo

    if (typeof activo !== "boolean") {
      return NextResponse.json(
        { error: "El campo 'activo' es obligatorio y debe ser booleano" },
        { status: 400 }
      )
    }

    const existente = await prisma.user.findUnique({
      where: { id },
      select: { id: true },
    })

    if (!existente) {
      return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 })
    }

    await prisma.user.update({
      where: { id },
      data: { activo },
    })

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error("ERROR PATCH ESTADO USUARIO:", error)
    return NextResponse.json(
      { error: "Error actualizando usuario" },
      { status: 500 }
    )
  }
}
