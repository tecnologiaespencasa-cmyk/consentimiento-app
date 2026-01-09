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

    const username = formData.get("username") as string
    const nombre = formData.get("nombre") as string
    const password = formData.get("password") as string
    const rol = formData.get("rol") as any

    const passwordHash = await bcrypt.hash(password, 10)

    await prisma.user.create({
        data: {
            username,
            nombre,
            passwordHash,
            rol
        }
    })

    return NextResponse.json({ ok: true })
}