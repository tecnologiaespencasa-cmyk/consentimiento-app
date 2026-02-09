import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/app/api/auth/[...nextauth]/route"

export async function GET() {
  const session = await getServerSession(authOptions)

  if (!session?.user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  }

  const u = session.user as any

  const nombres = (u.nombres ?? "").toString().trim()
  const primerApellido = (u.primerApellido ?? "").toString().trim()
  const segundoApellido = (u.segundoApellido ?? "").toString().trim()

  const primerNombre = nombres.split(/\s+/)[0] || ""
  const nombre = `${primerNombre} ${primerApellido}`.replace(/\s+/g, " ").trim()

  const nombreCompleto = `${nombres} ${primerApellido} ${segundoApellido}`
    .replace(/\s+/g, " ")
    .trim()

  return NextResponse.json({
    id: u.id,
    username: u.username,
    rol: u.rol,

    nombres: u.nombres ?? "",
    primerApellido: u.primerApellido ?? "",
    segundoApellido: u.segundoApellido ?? null,
    email: u.email ?? null,
    telefono: u.telefono ?? null,

    // Compatibilidad / UI
    nombre,          // <-- Nombre + Primer Apellido (lo que pides)
    nombreCompleto,  // <-- Nombre(s) + apellidos
  })
}