import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import { uploadToSharePointWithInfo } from "@/lib/uploadToSharePoint";

const MAX_SIZE_MB = 15;

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const rol = (session.user as any).rol;
  if (rol !== "ADMINISTRATIVO") {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  try {
    const form = await req.formData();
    const file = form.get("file");

    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: "Archivo requerido" }, { status: 400 });
    }

    const isPdf = file.type === "application/pdf";
    const isImg = file.type.startsWith("image/");

    if (!isPdf && !isImg) {
      return NextResponse.json({ error: "Solo se permite imagen o PDF" }, { status: 400 });
    }

    const sizeMb = file.size / (1024 * 1024);
    if (sizeMb > MAX_SIZE_MB) {
      return NextResponse.json(
        { error: `El archivo supera el tamaño máximo (${MAX_SIZE_MB}MB)` },
        { status: 400 }
      );
    }

    const cedula = (session.user as any).cedula || "ADMIN";
    // Subimos con prefijo para distinguirlo
    const boletinesFolder = process.env.SHAREPOINT_BOLETINES_FOLDER || "Boletines";
    const result = await uploadToSharePointWithInfo(
      file,
      `BOLETIN_${cedula}`,
      { folder: boletinesFolder }
    );


    const tipoAdjunto = isPdf ? "PDF" : "IMAGE";

    return NextResponse.json({
      ok: true,
      driveItemId: result.id,
      fileName: result.name,
      mimeType: result.mimeType || file.type || null,
      tipoAdjunto,
      webUrl: result.webUrl,
    });
  } catch (e: any) {
    console.error("Error subiendo adjunto de boletín:", e);
    return NextResponse.json({ error: e?.message || "Error subiendo archivo" }, { status: 500 });
  }
}
