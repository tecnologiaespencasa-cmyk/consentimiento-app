import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/app/api/auth/[...nextauth]/route"
import { prisma } from "@/lib/prisma"
import bcrypt from "bcrypt"

export async function POST(req: Request) {
  const session = await getServerSession(authOptions)

  if (!session || session.user.rol !== "ADMINISTRATIVO") {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  }

  const formData = await req.formData()

  const username = (formData.get("username") as string).toLowerCase()
  const nombres = (formData.get("nombres") as string) || ""
  const primerApellido = (formData.get("primerApellido") as string) || ""
  const segundoApellido = (formData.get("segundoApellido") as string) || ""
  const email = (formData.get("email") as string) || ""
  const telefono = (formData.get("telefono") as string) || ""
  const password = formData.get("password") as string
  const rol = formData.get("rol") as any

  if (!username || !nombres || !primerApellido || !password || !rol) {
    return NextResponse.json({ error: "Faltan campos obligatorios" }, { status: 400 })
  }

  const passwordHash = await bcrypt.hash(password, 10)

  await prisma.user.create({
    data: {
      username,
      nombres,
      primerApellido,
      segundoApellido: segundoApellido || null,
      email: email || null,
      telefono: telefono || null,
      passwordHash,
      rol
    }
  })

  return NextResponse.json({ ok: true })
}