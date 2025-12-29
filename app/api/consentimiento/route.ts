import { NextResponse } from "next/server";
import { prisma } from "../../../lib/prisma";
import { uploadToSharePoint } from "../../../lib/uploadToSharePoint";

export async function POST(request: Request) {
  try {
    console.log("API consentimiento llamado");

    const formData = await request.formData();

    const cedula = formData.get("cedula") as string;
    const especialista = formData.get("especialista") as string;
    const fechaHora = formData.get("fechaHora") as string;
    const archivo = formData.get("archivo") as File;

    if (!archivo) {
      return NextResponse.json(
        { error: "Archivo requerido" },
        { status: 400 }
      );
    }

    // 1️⃣ Subir archivo a SharePoint
    const archivoUrl = await uploadToSharePoint(archivo, cedula);

    // 2️⃣ Guardar en base de datos
    await prisma.consentimiento.create({
      data: {
        cedula,
        especialista,
        fechaHora: new Date(fechaHora),
        archivoUrl,
      },
    });

    console.log("Registro completo guardado");

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("ERROR API:", error);
    return NextResponse.json(
      { error: "Error guardando consentimiento" },
      { status: 500 }
    );
  }
}
