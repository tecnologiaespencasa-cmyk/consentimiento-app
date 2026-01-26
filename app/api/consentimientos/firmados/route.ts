export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/lib/prisma";
import { uploadToSharePoint } from "@/lib/uploadToSharePoint";

import path from "path";
import fs from "fs/promises";

import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { Buffer } from "buffer"
/**
 * Helpers
 */
function dataUrlToUint8Array(dataUrl: string) {
  const idx = dataUrl.indexOf("base64,");
  if (idx === -1) throw new Error("Firma inválida (base64 no encontrado)");
  const b64 = dataUrl.slice(idx + "base64,".length);
  const bin = Buffer.from(b64, "base64");
  return new Uint8Array(bin);
}

/**
 * Coordenadas por formato (en puntos PDF)
 * (0,0) está abajo-izquierda; subir = aumentar Y.
 *
 * FO-HCR-13:
 * - Página 1: fecha, tabla paciente, tabla especialista, línea "Yo, ____" + documento
 * - Página 2: firma paciente + cédula + firma especialista
 */
const TEMPLATE_MAP: Record<
  string,
  {
    templatePublicPath: string;
    page1: {
      dia: { x: number; y: number };
      mes: { x: number; y: number };
      anio: { x: number; y: number };
      hora: { x: number; y: number };

      pacientePrimerApellido: { x: number; y: number };
      pacienteSegundoApellido: { x: number; y: number };
      pacienteNombres: { x: number; y: number };
      pacienteDocumento: { x: number; y: number };
      pacienteEdad: { x: number; y: number };
      pacienteTelefono: { x: number; y: number };

      espPrimerApellido: { x: number; y: number };
      espSegundoApellido: { x: number; y: number };
      espNombres: { x: number; y: number };

      // NUEVO: línea "Yo, ____ con numero de documento..."
      yoPacienteNombre: { x: number; y: number };
      yoPacienteDocumento: { x: number; y: number };
    };
    page2: {
      firmaPaciente: { x: number; y: number; w: number; h: number };
      cedulaPaciente: { x: number; y: number };
      firmaEspecialista: { x: number; y: number; w: number; h: number };
    };
  }
> = {
  "FO-HCR-13": {
    templatePublicPath: "consentimientos/FO-HCR-13.pdf",

    page1: {
      dia: { x: 120, y: 880 },
      mes: { x: 200, y: 880 },
      anio: { x: 270, y: 880 },
      hora: { x: 335, y: 880 },

      /**
       * TABLA PACIENTE:
       */
      pacientePrimerApellido: { x: 90, y: 857.0 },
      pacienteSegundoApellido: { x: 170, y: 857.0 },
      pacienteNombres: { x: 276, y: 857.0 },
      pacienteDocumento: { x: 375, y: 857.0 },
      pacienteEdad: { x: 465, y: 857.0 },
      pacienteTelefono: { x: 513, y: 857.0 },

      /**
       * TABLA ESPECIALISTA:
       * Encabezados del especialista están alrededor de y~785; datos debajo (~765-770).
       */
      espPrimerApellido: { x: 220, y: 800 },
      espSegundoApellido: { x: 350, y: 800 },
      espNombres: { x: 490, y: 800 },

      /**
       * Línea: "Yo, ________, con numero de documento de identidad, ________"
       * Esa línea existe en la plantilla. :contentReference[oaicite:2]{index=2}
       */
      yoPacienteNombre: { x: 60, y: 748.5 },
      yoPacienteDocumento: { x: 350, y: 748.5 },
    },

    page2: {
      /**
       * Las firmas en tu PDF quedaron muy abajo. Subimos y corregimos X.
       * Si después de probar queda 1-2 cm corrido, ajusta Y en +-20.
       */
      firmaPaciente: { x: 195, y: 670, w: 190, h: 55 },
      cedulaPaciente: { x: 445, y: 690 },
      firmaEspecialista: { x: 390, y: 630, w: 190, h: 55 },
    },
  },

  // Puedes mantener los otros como placeholders, o llenarlos después.
  "FORM-2": {
    templatePublicPath: "consentimientos/FORM-2.pdf",
    page1: {
      dia: { x: 120, y: 882.93 },
      mes: { x: 205, y: 882.93 },
      anio: { x: 305, y: 882.93 },
      hora: { x: 430, y: 882.93 },

      pacientePrimerApellido: { x: 90, y: 817.0 },
      pacienteSegundoApellido: { x: 165, y: 817.0 },
      pacienteNombres: { x: 286, y: 817.0 },
      pacienteDocumento: { x: 380, y: 817.0 },
      pacienteEdad: { x: 465, y: 817.0 },
      pacienteTelefono: { x: 525, y: 817.0 },

      espPrimerApellido: { x: 210, y: 768.0 },
      espSegundoApellido: { x: 340, y: 768.0 },
      espNombres: { x: 490, y: 768.0 },

      yoPacienteNombre: { x: 70, y: 748.5 },
      yoPacienteDocumento: { x: 380, y: 748.5 },
    },
    page2: {
      firmaPaciente: { x: 240, y: 560, w: 190, h: 55 },
      cedulaPaciente: { x: 450, y: 585 },
      firmaEspecialista: { x: 410, y: 520, w: 190, h: 55 },
    },
  },

  "FORM-3": {
    templatePublicPath: "consentimientos/FORM-3.pdf",
    page1: {
      dia: { x: 120, y: 882.93 },
      mes: { x: 205, y: 882.93 },
      anio: { x: 305, y: 882.93 },
      hora: { x: 430, y: 882.93 },

      pacientePrimerApellido: { x: 90, y: 817.0 },
      pacienteSegundoApellido: { x: 165, y: 817.0 },
      pacienteNombres: { x: 286, y: 817.0 },
      pacienteDocumento: { x: 380, y: 817.0 },
      pacienteEdad: { x: 465, y: 817.0 },
      pacienteTelefono: { x: 525, y: 817.0 },

      espPrimerApellido: { x: 210, y: 768.0 },
      espSegundoApellido: { x: 340, y: 768.0 },
      espNombres: { x: 490, y: 768.0 },

      yoPacienteNombre: { x: 70, y: 748.5 },
      yoPacienteDocumento: { x: 380, y: 748.5 },
    },
    page2: {
      firmaPaciente: { x: 240, y: 560, w: 190, h: 55 },
      cedulaPaciente: { x: 450, y: 585 },
      firmaEspecialista: { x: 410, y: 520, w: 190, h: 55 },
    },
  },

  "FORM-4": {
    templatePublicPath: "consentimientos/FORM-4.pdf",
    page1: {
      dia: { x: 120, y: 882.93 },
      mes: { x: 205, y: 882.93 },
      anio: { x: 305, y: 882.93 },
      hora: { x: 430, y: 882.93 },

      pacientePrimerApellido: { x: 90, y: 817.0 },
      pacienteSegundoApellido: { x: 165, y: 817.0 },
      pacienteNombres: { x: 286, y: 817.0 },
      pacienteDocumento: { x: 380, y: 817.0 },
      pacienteEdad: { x: 465, y: 817.0 },
      pacienteTelefono: { x: 525, y: 817.0 },

      espPrimerApellido: { x: 210, y: 768.0 },
      espSegundoApellido: { x: 340, y: 768.0 },
      espNombres: { x: 490, y: 768.0 },

      yoPacienteNombre: { x: 70, y: 748.5 },
      yoPacienteDocumento: { x: 380, y: 748.5 },
    },
    page2: {
      firmaPaciente: { x: 240, y: 560, w: 190, h: 55 },
      cedulaPaciente: { x: 450, y: 585 },
      firmaEspecialista: { x: 410, y: 520, w: 190, h: 55 },
    },
  },

  "FORM-5": {
    templatePublicPath: "consentimientos/FORM-5.pdf",
    page1: {
      dia: { x: 120, y: 882.93 },
      mes: { x: 205, y: 882.93 },
      anio: { x: 305, y: 882.93 },
      hora: { x: 430, y: 882.93 },

      pacientePrimerApellido: { x: 90, y: 817.0 },
      pacienteSegundoApellido: { x: 165, y: 817.0 },
      pacienteNombres: { x: 286, y: 817.0 },
      pacienteDocumento: { x: 380, y: 817.0 },
      pacienteEdad: { x: 465, y: 817.0 },
      pacienteTelefono: { x: 525, y: 817.0 },

      espPrimerApellido: { x: 210, y: 768.0 },
      espSegundoApellido: { x: 340, y: 768.0 },
      espNombres: { x: 490, y: 768.0 },

      yoPacienteNombre: { x: 70, y: 748.5 },
      yoPacienteDocumento: { x: 380, y: 748.5 },
    },
    page2: {
      firmaPaciente: { x: 240, y: 560, w: 190, h: 55 },
      cedulaPaciente: { x: 450, y: 585 },
      firmaEspecialista: { x: 410, y: 520, w: 190, h: 55 },
    },
  },
};

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  try {
    const formData = await req.formData();

    const formatoId = String(formData.get("formatoId") || "");
    const cedula = String(formData.get("cedula") || "");

    const pacientePrimerApellido = String(formData.get("pacientePrimerApellido") || "");
    const pacienteSegundoApellido = String(formData.get("pacienteSegundoApellido") || "");
    const pacienteNombres = String(formData.get("pacienteNombres") || "");
    const pacienteEdad = String(formData.get("pacienteEdad") || "");
    const pacienteTelefono = String(formData.get("pacienteTelefono") || "");

    const firmaPacientePngBase64 = String(formData.get("firmaPacientePngBase64") || "");
    const firmaEspecialistaPngBase64 = String(formData.get("firmaEspecialistaPngBase64") || "");

    if (!TEMPLATE_MAP[formatoId]) {
      return NextResponse.json({ error: "Formato no soportado" }, { status: 400 });
    }

    if (
      !cedula ||
      !pacientePrimerApellido ||
      !pacienteSegundoApellido ||
      !pacienteNombres ||
      !pacienteEdad ||
      !pacienteTelefono ||
      !firmaPacientePngBase64 ||
      !firmaEspecialistaPngBase64
    ) {
      return NextResponse.json({ error: "Datos incompletos" }, { status: 400 });
    }

    const now = new Date();
    const dia = String(now.getDate()).padStart(2, "0");
    const mes = String(now.getMonth() + 1).padStart(2, "0");
    const anio = String(now.getFullYear());
    const hora = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;

    // Especialista desde sesión (ajústalo si en tu BD tienes apellidos separados)
    const espNombres = (session.user.nombres ?? "").toString().trim();
    const espPrimerApellido = (session.user.primerApellido ?? "").toString().trim();
    const espSegundoApellido = (session.user.segundoApellido ?? "").toString().trim();

    // NUEVO: para la frase "Yo, ____" usamos el nombre completo del paciente
    const pacienteNombreCompleto = `${pacientePrimerApellido} ${pacienteSegundoApellido} ${pacienteNombres}`.trim();

    const templateCfg = TEMPLATE_MAP[formatoId];
    const templatePath = path.join(process.cwd(), "public", templateCfg.templatePublicPath);
    const templateBytes = await fs.readFile(templatePath);

    const pdfDoc = await PDFDocument.load(templateBytes);
    const pages = pdfDoc.getPages();

    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const fontSize = 10;

    // ===== Page 1 =====
    const p1 = pages[0];

    p1.drawText(dia, { x: templateCfg.page1.dia.x, y: templateCfg.page1.dia.y, size: fontSize, font, color: rgb(0, 0, 0) });
    p1.drawText(mes, { x: templateCfg.page1.mes.x, y: templateCfg.page1.mes.y, size: fontSize, font, color: rgb(0, 0, 0) });
    p1.drawText(anio, { x: templateCfg.page1.anio.x, y: templateCfg.page1.anio.y, size: fontSize, font, color: rgb(0, 0, 0) });
    p1.drawText(hora, { x: templateCfg.page1.hora.x, y: templateCfg.page1.hora.y, size: fontSize, font, color: rgb(0, 0, 0) });

    // Paciente (tabla)
    p1.drawText(pacientePrimerApellido, { x: templateCfg.page1.pacientePrimerApellido.x, y: templateCfg.page1.pacientePrimerApellido.y, size: fontSize, font });
    p1.drawText(pacienteSegundoApellido, { x: templateCfg.page1.pacienteSegundoApellido.x, y: templateCfg.page1.pacienteSegundoApellido.y, size: fontSize, font });
    p1.drawText(pacienteNombres, { x: templateCfg.page1.pacienteNombres.x, y: templateCfg.page1.pacienteNombres.y, size: fontSize, font });
    p1.drawText(cedula, { x: templateCfg.page1.pacienteDocumento.x, y: templateCfg.page1.pacienteDocumento.y, size: fontSize, font });
    p1.drawText(String(pacienteEdad), { x: templateCfg.page1.pacienteEdad.x, y: templateCfg.page1.pacienteEdad.y, size: fontSize, font });
    p1.drawText(pacienteTelefono, { x: templateCfg.page1.pacienteTelefono.x, y: templateCfg.page1.pacienteTelefono.y, size: fontSize, font });

    // Especialista (tabla)
    p1.drawText(espPrimerApellido, { x: templateCfg.page1.espPrimerApellido.x, y: templateCfg.page1.espPrimerApellido.y, size: fontSize, font });
    p1.drawText(espSegundoApellido, { x: templateCfg.page1.espSegundoApellido.x, y: templateCfg.page1.espSegundoApellido.y, size: fontSize, font });
    p1.drawText(espNombres, { x: templateCfg.page1.espNombres.x, y: templateCfg.page1.espNombres.y, size: fontSize, font });

    // NUEVO: "Yo, ____" + documento
    // (Esta línea existe en el PDF y debe tomar datos del paciente) :contentReference[oaicite:3]{index=3}
    p1.drawText(pacienteNombreCompleto, {
      x: templateCfg.page1.yoPacienteNombre.x,
      y: templateCfg.page1.yoPacienteNombre.y,
      size: fontSize,
      font,
      color: rgb(0, 0, 0),
    });

    p1.drawText(cedula, {
      x: templateCfg.page1.yoPacienteDocumento.x,
      y: templateCfg.page1.yoPacienteDocumento.y,
      size: fontSize,
      font,
      color: rgb(0, 0, 0),
    });

    // ===== Page 2 =====
    const p2 = pages[1] ?? pages[0];

    const firmaPacienteBytes = dataUrlToUint8Array(firmaPacientePngBase64);
    const firmaEspecialistaBytes = dataUrlToUint8Array(firmaEspecialistaPngBase64);

    const firmaPacienteImg = await pdfDoc.embedPng(firmaPacienteBytes);
    const firmaEspecialistaImg = await pdfDoc.embedPng(firmaEspecialistaBytes);

    p2.drawImage(firmaPacienteImg, {
      x: templateCfg.page2.firmaPaciente.x,
      y: templateCfg.page2.firmaPaciente.y,
      width: templateCfg.page2.firmaPaciente.w,
      height: templateCfg.page2.firmaPaciente.h,
    });

    p2.drawText(cedula, {
      x: templateCfg.page2.cedulaPaciente.x,
      y: templateCfg.page2.cedulaPaciente.y,
      size: fontSize,
      font,
      color: rgb(0, 0, 0),
    });

    p2.drawImage(firmaEspecialistaImg, {
      x: templateCfg.page2.firmaEspecialista.x,
      y: templateCfg.page2.firmaEspecialista.y,
      width: templateCfg.page2.firmaEspecialista.w,
      height: templateCfg.page2.firmaEspecialista.h,
    });

    const finalPdfBytes = await pdfDoc.save();

    const fileName = `${formatoId}-${cedula}-${now.toISOString().slice(0, 10)}.pdf`;
    const archivoUrl = await uploadToSharePoint(
      {
        bytes: finalPdfBytes,
        fileName,
        contentType: "application/pdf",
      },
      cedula
    )

    await prisma.consentimiento.create({
      data: {
        cedula,
        fechaHora: now,
        archivoUrl,
        usuarioId: session.user.id,
      },
    });

    return NextResponse.json({ ok: true, archivoUrl });
  } catch (error) {
    console.error("Error guardando consentimiento firmado:", error);
    return NextResponse.json({ error: "Error guardando consentimiento firmado" }, { status: 500 });
  }
}