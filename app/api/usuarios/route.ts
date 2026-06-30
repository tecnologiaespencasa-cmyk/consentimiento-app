import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/authOptions"
import { prisma } from "@/lib/prisma"
import bcrypt from "bcrypt"
import { createUserSchema } from "@/lib/validation"

export async function POST(req: Request) {
  const session = await getServerSession(authOptions)

  if (!session || session.user.rol !== "ADMINISTRATIVO") {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  }

  const formData = await req.formData()

  // Validacion/saneamiento de entrada (tipo, longitud, formato, enums).
  const parsed = createUserSchema.safeParse({
    username: formData.get("username") ?? "",
    nombres: formData.get("nombres") ?? "",
    primerApellido: formData.get("primerApellido") ?? "",
    segundoApellido: formData.get("segundoApellido") ?? "",
    email: formData.get("email") ?? "",
    telefono: formData.get("telefono") ?? "",
    cedula: formData.get("cedula") ?? "",
    profesion: formData.get("profesion") ?? "",
    password: formData.get("password") ?? "",
    rol: formData.get("rol") ?? "",
  })

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Datos invalidos" },
      { status: 400 }
    )
  }

  const data = parsed.data
  const passwordHash = await bcrypt.hash(data.password, 12)

  try {
    await prisma.user.create({
      data: {
        username: data.username,
        cedula: data.cedula,
        nombres: data.nombres,
        primerApellido: data.primerApellido,
        segundoApellido: data.segundoApellido || null,
        email: data.email || null,
        telefono: data.telefono || null,
        passwordHash,
        profesion: data.profesion,
        rol: data.rol,
      },
    })
  } catch (err: unknown) {
    // Violacion de unicidad (username/email ya existen).
    if (typeof err === "object" && err !== null && "code" in err && (err as { code?: string }).code === "P2002") {
      return NextResponse.json(
        { error: "El usuario o el correo ya existen" },
        { status: 409 }
      )
    }
    throw err
  }

  return NextResponse.json({ ok: true })
}