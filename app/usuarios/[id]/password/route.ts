export const runtime = "nodejs"

import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/app/api/auth/[...nextauth]/route"
import { prisma } from "@/lib/prisma"
import bcrypt from "bcrypt"

export async function PATCH(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)

    // ✅ Solo ADMIN puede cambiar contraseñas
    if (!session?.user || session.user.rol !== "ADMINISTRATIVO") {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 })
    }

    const { id } = await context.params
    const body = await req.json().catch(() => null)

    const newPassword = (body?.newPassword ?? "").toString().trim()

    if (!newPassword || newPassword.length < 6) {
      return NextResponse.json(
        { error: "La contraseña debe tener mínimo 6 caracteres" },
        { status: 400 }
      )
    }

    const passwordHash = await bcrypt.hash(newPassword, 10)

    await prisma.user.update({
      where: { id },
      data: { passwordHash },
    })

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error("ERROR PATCH PASSWORD USUARIO:", error)
    return NextResponse.json(
      { error: "Error actualizando contraseña" },
      { status: 500 }
    )
  }
}