import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
  try {
    const formData = await request.formData();

    const cedula = formData.get("cedula") as string;
    const especialista = formData.get("especialista") as string;
    const archivoUrl = formData.get("archivoUrl") as string;

    if (!cedula || !especialista || !archivoUrl) {
      return NextResponse.json(
        { error: "Datos incompletos" },
        { status: 400 }
      );
    }

    await prisma.consentimiento.create({
      data: {
        cedula: cedula,
        especialista: especialista,
        fechaHora: new Date(),
        archivoUrl: archivoUrl,
      },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Error guardando consentimiento:", error);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}