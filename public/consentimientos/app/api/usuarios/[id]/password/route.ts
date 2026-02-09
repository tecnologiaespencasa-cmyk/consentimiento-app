export const runtime = "nodejs"

import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/app/api/auth/[...nextauth]/route"
import { prisma } from "@/lib/prisma"
import bcrypt from "bcrypt"

function extractUserId(req: Request) {
  // req.url suele ser: http://localhost:3000/api/usuarios/<id>/password
  const url = req.url || ""
  const match = url.match(/\/api\/usuarios\/([^/]+)\/password/i)
  return match?.[1] ?? ""
}

export async function PATCH(req: Request) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user || session.user.rol !== "ADMINISTRATIVO") {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 })
    }

    const id = extractUserId(req)

    // ✅ Debug útil (lo verás en consola)
    console.log("[PATCH /api/usuarios/:id/password] url =", req.url)
    console.log("[PATCH /api/usuarios/:id/password] extracted id =", id)

    if (!id) {
      return NextResponse.json(
        { error: "No se pudo obtener el id del usuario desde la URL" },
        { status: 400 }
      )
    }

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