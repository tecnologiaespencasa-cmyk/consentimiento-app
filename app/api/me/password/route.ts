import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/authOptions"
import { prisma } from "@/lib/prisma"
import bcrypt from "bcrypt"

export async function PATCH(req: Request) {
  const session = await getServerSession(authOptions)

  if (!session?.user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  }

  const body = await req.json().catch(() => null)
  const currentPassword = (body?.currentPassword ?? "").toString().trim()
  const newPassword = (body?.newPassword ?? "").toString().trim()

  if (!currentPassword) {
    return NextResponse.json({ error: "La contraseña actual es obligatoria" }, { status: 400 })
  }

  if (!newPassword || newPassword.length < 6) {
    return NextResponse.json(
      { error: "La nueva contraseña debe tener minimo 6 caracteres" },
      { status: 400 }
    )
  }

  if (currentPassword === newPassword) {
    return NextResponse.json(
      { error: "La nueva contraseña debe ser diferente a la actual" },
      { status: 400 }
    )
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, passwordHash: true },
  })

  if (!user) {
    return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 })
  }

  const ok = await bcrypt.compare(currentPassword, user.passwordHash)
  if (!ok) {
    return NextResponse.json({ error: "La contraseña actual no coincide" }, { status: 400 })
  }

  const passwordHash = await bcrypt.hash(newPassword, 10)

  await prisma.user.update({
    where: { id: session.user.id },
    data: { passwordHash },
  })

  return NextResponse.json({ ok: true })
}
