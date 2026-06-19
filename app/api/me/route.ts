import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/authOptions"
import { Prisma } from "@prisma/client"
import { prisma } from "@/lib/prisma"

type MeResponse = {
  id: string
  username: string
  rol: string
  nombres: string
  primerApellido: string
  segundoApellido: string | null
  email: string | null
  telefono: string | null
  cedula: string
  profesion: string
  fotoCarnet: string | null
  nombre: string
  nombreCompleto: string
}

function toMeResponse(user: {
  id: string
  username: string
  rol: string
  nombres: string
  primerApellido: string
  segundoApellido: string | null
  email: string | null
  telefono: string | null
  cedula: string
  profesion: string
  fotoCarnet: string | null
}): MeResponse {
  const nombres = (user.nombres ?? "").trim()
  const primerApellido = (user.primerApellido ?? "").trim()
  const segundoApellido = (user.segundoApellido ?? "").trim()

  const primerNombre = nombres.split(/\s+/)[0] || ""
  const nombre = `${primerNombre} ${primerApellido}`.replace(/\s+/g, " ").trim()

  const nombreCompleto = `${nombres} ${primerApellido} ${segundoApellido}`
    .replace(/\s+/g, " ")
    .trim()

  return {
    id: user.id,
    username: user.username,
    rol: user.rol,
    nombres: user.nombres ?? "",
    primerApellido: user.primerApellido ?? "",
    segundoApellido: user.segundoApellido ?? null,
    email: user.email ?? null,
    telefono: user.telefono ?? null,
    cedula: user.cedula ?? "",
    profesion: user.profesion,
    fotoCarnet: user.fotoCarnet ?? null,
    nombre,
    nombreCompleto,
  }
}

export async function GET() {
  const session = await getServerSession(authOptions)

  if (!session?.user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      username: true,
      rol: true,
      nombres: true,
      primerApellido: true,
      segundoApellido: true,
      email: true,
      telefono: true,
      cedula: true,
      profesion: true,
      fotoCarnet: true,
    },
  })

  if (!user) {
    return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 })
  }

  return NextResponse.json(toMeResponse(user))
}

export async function PATCH(req: Request) {
  const session = await getServerSession(authOptions)

  if (!session?.user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  }

  const body = await req.json().catch(() => null)

  const emailRaw = typeof body?.email === "string" ? body.email.trim() : ""
  const telefonoRaw = typeof body?.telefono === "string" ? body.telefono.trim() : ""

  const email = emailRaw ? emailRaw.toLowerCase() : null
  const telefono = telefonoRaw ? telefonoRaw : null

  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "Correo invalido" }, { status: 400 })
  }

  if (telefono && telefono.length > 30) {
    return NextResponse.json({ error: "Telefono invalido" }, { status: 400 })
  }

  try {
    const updated = await prisma.user.update({
      where: { id: session.user.id },
      data: {
        email,
        telefono,
      },
      select: {
        id: true,
        username: true,
        rol: true,
        nombres: true,
        primerApellido: true,
        segundoApellido: true,
        email: true,
        telefono: true,
        cedula: true,
        profesion: true,
        fotoCarnet: true,
      },
    })

    return NextResponse.json({ ok: true, user: toMeResponse(updated) })
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json({ error: "El correo ya esta en uso" }, { status: 409 })
    }
    console.error("Error actualizando perfil:", error)
    return NextResponse.json({ error: "Error actualizando perfil" }, { status: 500 })
  }
}
