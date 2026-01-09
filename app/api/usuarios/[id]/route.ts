import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/app/api/auth/[...nextauth]/route"
import { prisma } from "@/lib/prisma"

export async function PATCH(
    req: Request,
    context: { params: Promise<{ id: string }> }
) {
    try {
        const session = await getServerSession(authOptions)

        if (!session || session.user.rol !== "ADMINISTRATIVO") {
            return NextResponse.json(
                { error: "No autorizado" },
                { status: 401 }
            )
        }

        const { id } = await context.params

        // Evitar auto-desactivación
        if (id === session.user.id) {
            return NextResponse.json(
                { error: "No puedes desactivar tu propio usuario" },
                { status: 400 }
            )
        }

        const body = await req.json()

        await prisma.user.update({
            where: { id },
            data: { activo: body.activo }
        })

        return NextResponse.json({ ok: true })

    } catch (error) {
        console.error("ERROR PATCH USUARIO:", error)
        return NextResponse.json(
            { error: "Error actualizando usuario" },
            { status: 500 }
        )
    }
}