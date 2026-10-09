import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/authOptions"
import { prisma } from "@/lib/prisma"
import { uploadToSharePoint } from "@/lib/uploadToSharePoint"
import { getBogotaDateKey } from "@/lib/bogotaDate"
import { REGLAS, normalizarCampo, validarCampo, validarFechaHoraAdjunto } from "@/lib/validacionCampos"

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

    let where: { usuarioId?: string } = {}

    if (mine || rol === "ESPECIALISTA" || rol === "MEDICO_RONDA" || rol === "FARMACIA" || rol === "CLINICA_HERIDAS") {
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

    if (session.user.rol === "FARMACIA") {
        return NextResponse.json({ error: "No autorizado" }, { status: 403 })
    }

    try {
        const formData = await req.formData()

        const cedula = normalizarCampo(String(formData.get("cedula") ?? ""))
        const fechaHora = String(formData.get("fechaHora") ?? "").trim()
        const archivo = formData.get("archivo")

        if (!cedula || !fechaHora || !archivo || typeof archivo === "string" || archivo.size === 0) {
            return NextResponse.json(
                { error: "Datos incompletos" },
                { status: 400 }
            )
        }

        // Mismas reglas que aplica el formulario: la cédula va en el nombre del
        // archivo de SharePoint, así que no puede traer signos.
        const errorCedula = validarCampo(REGLAS.documento, cedula)
        if (errorCedula) {
            return NextResponse.json(
                { error: `Cédula del paciente: ${errorCedula}` },
                { status: 400 }
            )
        }

        const errorFecha = validarFechaHoraAdjunto(fechaHora, getBogotaDateKey(new Date()))
        if (errorFecha) {
            return NextResponse.json(
                { error: `Fecha y hora: ${errorFecha}` },
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
