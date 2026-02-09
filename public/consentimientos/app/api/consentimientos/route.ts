import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/app/api/auth/[...nextauth]/route"
import { prisma } from "@/lib/prisma"
import { uploadToSharePoint } from "@/lib/uploadToSharePoint"

// =======================
// GET – listar consentimientos
// =======================
export async function GET(req: Request) {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
        return NextResponse.json({ error: "No autorizado" }, { status: 401 })
    }

    const { rol, id } = session.user
    const { searchParams } = new URL(req.url)
    const mine = searchParams.get("mine") === "true"

    let where: any = {}

    if (mine || rol === "ESPECIALISTA") {
        where = { usuarioId: id }
    }

    const consentimientos = await prisma.consentimiento.findMany({
        where,
        orderBy: { createdAt: "desc" }
    })

    return NextResponse.json(consentimientos)
}

// =======================
// POST – crear consentimiento
// =======================
export async function POST(req: Request) {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
        return NextResponse.json({ error: "No autorizado" }, { status: 401 })
    }

    try {
        const formData = await req.formData()

        const cedula = formData.get("cedula") as string
        const fechaHora = formData.get("fechaHora") as string
        const archivo = formData.get("archivo") as File

        if (!cedula || !fechaHora || !archivo) {
            return NextResponse.json(
                { error: "Datos incompletos" },
                { status: 400 }
            )
        }

        // 1️⃣ Subir a SharePoint
        const archivoUrl = await uploadToSharePoint(archivo, cedula)

        // 2️⃣ Guardar en Neon con usuarioId
        await prisma.consentimiento.create({
            data: {
                cedula,
                fechaHora: new Date(fechaHora),
                archivoUrl,
                usuarioId: session.user.id
            }
        })

        return NextResponse.json({ ok: true })
    } catch (error) {
        console.error("Error guardando consentimiento:", error)
        return NextResponse.json(
            { error: "Error guardando consentimiento" },
            { status: 500 }
        )
    }
}