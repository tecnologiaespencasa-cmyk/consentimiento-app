export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/lib/prisma";
import { uploadToSharePoint } from "@/lib/uploadToSharePoint";

import path from "path";
import fs from "fs/promises";

import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { Buffer } from "buffer";

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
 */
type TemplateCfg = {
  templatePublicPath: string;
  page1: {
    dia: { x: number; y: number };
    mes: { x: number; y: number };
    anio: { x: number; y: number };

    // FO-HCR-13 tiene HORA; FT-HCR-21 NO.
    hora?: { x: number; y: number };

    // FT-HCR-21 tiene SERVICIO y CAMA.
    servicio?: { x: number; y: number };
    cama?: { x: number; y: number };

    pacientePrimerApellido: { x: number; y: number };
    pacienteSegundoApellido: { x: number; y: number };
    pacienteNombres: { x: number; y: number };
    pacienteDocumento: { x: number; y: number };
    pacienteEdad: { x: number; y: number };
    pacienteTelefono: { x: number; y: number };

    // FT-HCR-21 tiene DOMICILIO.
    pacienteDomicilio?: { x: number; y: number };

    espPrimerApellido: { x: number; y: number };
    espSegundoApellido: { x: number; y: number };
    espNombres: { x: number; y: number };

    yoPacienteNombre: { x: number; y: number };
    yoPacienteDocumento: { x: number; y: number };
  };
  page2: {
    firmaPaciente: { x: number; y: number; w: number; h: number };
    cedulaPaciente: { x: number; y: number };
    firmaEspecialista: { x: number; y: number; w: number; h: number };

    noConsentimiento?: {
      firmaPaciente: { x: number; y: number; w: number; h: number };
      cedulaPaciente: { x: number; y: number };
      firmaEspecialista: { x: number; y: number; w: number; h: number };
    };
  };
};

const TEMPLATE_MAP: Record<string, TemplateCfg> = {
  "FO-HCR-13": {
    templatePublicPath: "consentimientos/FO-HCR-13.pdf",
    page1: {
      dia: { x: 120, y: 880 },
      mes: { x: 200, y: 880 },
      anio: { x: 270, y: 880 },
      hora: { x: 335, y: 880 },

      pacientePrimerApellido: { x: 90, y: 857.0 },
      pacienteSegundoApellido: { x: 170, y: 857.0 },
      pacienteNombres: { x: 276, y: 857.0 },
      pacienteDocumento: { x: 375, y: 857.0 },
      pacienteEdad: { x: 465, y: 857.0 },
      pacienteTelefono: { x: 513, y: 857.0 },

      espPrimerApellido: { x: 220, y: 800 },
      espSegundoApellido: { x: 350, y: 800 },
      espNombres: { x: 490, y: 800 },

      yoPacienteNombre: { x: 60, y: 749 },
      yoPacienteDocumento: { x: 350, y: 749 },
    },
    page2: {
      firmaPaciente: { x: 195, y: 670, w: 190, h: 55 },
      cedulaPaciente: { x: 445, y: 690 },
      firmaEspecialista: { x: 390, y: 630, w: 190, h: 55 },
      noConsentimiento: {
        firmaPaciente: { x: 195, y: 510, w: 190, h: 55 },
        cedulaPaciente: { x: 445, y: 535 },
        firmaEspecialista: { x: 390, y: 465, w: 190, h: 55 },
      },
    },
  },

  /**
   * ✅ FT-HCR-21 (Retiro de Catéter PICC en Domicilio)
   * - OJO: en el PDF impreso aparece "FT-HCR-21"
   * - En este formato NO hay HORA; hay SERVICIO y CAMA
   */
  "FT-HCR-21": {
    templatePublicPath: "consentimientos/FO-HCR-21.pdf",
    page1: {
      // Fecha de diligenciamiento
      dia: { x: 140, y: 697 },
      mes: { x: 220, y: 697 },
      anio: { x: 290, y: 697 },

      // En vez de hora:
      servicio: { x: 450, y: 697 },
      cama: { x: 545, y: 697 },

      // Tabla paciente (fila de datos)
      pacientePrimerApellido: { x: 105, y: 639.5 },
      pacienteSegundoApellido: { x: 170, y: 639.5 },
      pacienteNombres: { x: 260, y: 639.5 },
      pacienteEdad: { x: 325, y: 639.5 },
      pacienteDocumento: { x: 370, y: 639.5 },
      pacienteDomicilio: { x: 440, y: 639.5 },
      pacienteTelefono: { x: 520, y: 639.5 },

      // Tabla personal de salud (fila de datos)
      espPrimerApellido: { x: 215, y: 599.5 },
      espSegundoApellido: { x: 360, y: 599.5 },
      espNombres: { x: 515, y: 599.5 },

      // Línea "Yo, ____ con numero de documento..."
      yoPacienteNombre: { x: 45, y: 564.5 },
      yoPacienteDocumento: { x: 280, y: 564.5 },
    },
    page2: {
      // ACEPTA
      firmaPaciente: { x: 160, y: 592, w: 190, h: 50 },
      cedulaPaciente: { x: 390, y: 607 },
      firmaEspecialista: { x: 370, y: 567, w: 210, h: 45 },

      // NO ACEPTA (abajo)
      noConsentimiento: {
        firmaPaciente: { x: 160, y: 452, w: 190, h: 45 },
        cedulaPaciente: { x: 260, y: 464.5 },
        firmaEspecialista: { x: 160, y: 422, w: 190, h: 45 },
      },
    },
  },

  /**
   * ✅ Alias por si tu frontend todavía manda "FO-HCR-21"
   */
  "FO-HCR-21": {
    templatePublicPath: "consentimientos/FO-HCR-21.pdf",
    page1: {
      dia: { x: 161, y: 688 },
      mes: { x: 245, y: 688 },
      anio: { x: 317, y: 688 },
      servicio: { x: 449, y: 688 },
      cama: { x: 559, y: 688 },

      pacientePrimerApellido: { x: 82, y: 663 },
      pacienteSegundoApellido: { x: 140, y: 663 },
      pacienteNombres: { x: 215, y: 663 },
      pacienteEdad: { x: 328, y: 663 },
      pacienteDocumento: { x: 361, y: 663 },
      pacienteDomicilio: { x: 436, y: 663 },
      pacienteTelefono: { x: 501, y: 663 },

      espPrimerApellido: { x: 200, y: 617 },
      espSegundoApellido: { x: 336, y: 617 },
      espNombres: { x: 447, y: 617 },

      yoPacienteNombre: { x: 52, y: 565 },
      yoPacienteDocumento: { x: 344, y: 565 },
    },
    page2: {
      firmaPaciente: { x: 182, y: 602, w: 190, h: 50 },
      cedulaPaciente: { x: 430, y: 625 },
      firmaEspecialista: { x: 396, y: 565, w: 210, h: 45 },
      noConsentimiento: {
        firmaPaciente: { x: 190, y: 465, w: 190, h: 45 },
        cedulaPaciente: { x: 415, y: 482 },
        firmaEspecialista: { x: 406, y: 418, w: 190, h: 45 },
      },
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

    // Solo aplica para FT/FO-HCR-21 (si lo mandas desde el frontend)
    const pacienteDomicilio = String(formData.get("pacienteDomicilio") || "");
    const servicio = String(formData.get("servicio") || "");
    const cama = String(formData.get("cama") || "");

    const firmaPacientePngBase64 = String(formData.get("firmaPacientePngBase64") || "");
    const firmaEspecialistaPngBase64 = String(formData.get("firmaEspecialistaPngBase64") || "");

    // Estado de aceptación
    const aceptadoRaw = String(formData.get("aceptado") || "true");
    const aceptado = aceptadoRaw === "true";

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

    // Especialista desde sesión
    const espNombres = (session.user.nombres ?? "").toString().trim();
    const espPrimerApellido = (session.user.primerApellido ?? "").toString().trim();
    const espSegundoApellido = (session.user.segundoApellido ?? "").toString().trim();

    // Para "Yo, ____"
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

    // Hora solo si existe
    if (templateCfg.page1.hora) {
      p1.drawText(hora, {
        x: templateCfg.page1.hora.x,
        y: templateCfg.page1.hora.y,
        size: fontSize,
        font,
        color: rgb(0, 0, 0),
      });
    }

    // Servicio/Cama solo si existen en la plantilla
    if (templateCfg.page1.servicio && servicio) {
      p1.drawText(servicio, {
        x: templateCfg.page1.servicio.x,
        y: templateCfg.page1.servicio.y,
        size: fontSize,
        font,
        color: rgb(0, 0, 0),
      });
    }
    if (templateCfg.page1.cama && cama) {
      p1.drawText(cama, {
        x: templateCfg.page1.cama.x,
        y: templateCfg.page1.cama.y,
        size: fontSize,
        font,
        color: rgb(0, 0, 0),
      });
    }

    // Paciente (tabla)
    p1.drawText(pacientePrimerApellido, { x: templateCfg.page1.pacientePrimerApellido.x, y: templateCfg.page1.pacientePrimerApellido.y, size: fontSize, font });
    p1.drawText(pacienteSegundoApellido, { x: templateCfg.page1.pacienteSegundoApellido.x, y: templateCfg.page1.pacienteSegundoApellido.y, size: fontSize, font });
    p1.drawText(pacienteNombres, { x: templateCfg.page1.pacienteNombres.x, y: templateCfg.page1.pacienteNombres.y, size: fontSize, font });
    p1.drawText(String(pacienteEdad), { x: templateCfg.page1.pacienteEdad.x, y: templateCfg.page1.pacienteEdad.y, size: fontSize, font });
    p1.drawText(cedula, { x: templateCfg.page1.pacienteDocumento.x, y: templateCfg.page1.pacienteDocumento.y, size: fontSize, font });
    p1.drawText(pacienteTelefono, { x: templateCfg.page1.pacienteTelefono.x, y: templateCfg.page1.pacienteTelefono.y, size: fontSize, font });

    // Domicilio si la plantilla lo tiene
    if (templateCfg.page1.pacienteDomicilio && pacienteDomicilio) {
      p1.drawText(pacienteDomicilio, {
        x: templateCfg.page1.pacienteDomicilio.x,
        y: templateCfg.page1.pacienteDomicilio.y,
        size: fontSize,
        font,
      });
    }

    // Especialista (tabla)
    p1.drawText(espPrimerApellido, { x: templateCfg.page1.espPrimerApellido.x, y: templateCfg.page1.espPrimerApellido.y, size: fontSize, font });
    p1.drawText(espSegundoApellido, { x: templateCfg.page1.espSegundoApellido.x, y: templateCfg.page1.espSegundoApellido.y, size: fontSize, font });
    p1.drawText(espNombres, { x: templateCfg.page1.espNombres.x, y: templateCfg.page1.espNombres.y, size: fontSize, font });

    // "Yo, ____" + documento
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

    // ===== Page 2 (LÓGICA ACEPTACIÓN) =====
    const p2 = pages[1] ?? pages[0];

    const firmaPacienteBytes = dataUrlToUint8Array(firmaPacientePngBase64);
    const firmaEspecialistaBytes = dataUrlToUint8Array(firmaEspecialistaPngBase64);

    const firmaPacienteImg = await pdfDoc.embedPng(firmaPacienteBytes);
    const firmaEspecialistaImg = await pdfDoc.embedPng(firmaEspecialistaBytes);

    if (aceptado) {
      // ACEPTA
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
    } else {
      // NO ACEPTA
      if (templateCfg.page2.noConsentimiento) {
        p2.drawImage(firmaPacienteImg, {
          x: templateCfg.page2.noConsentimiento.firmaPaciente.x,
          y: templateCfg.page2.noConsentimiento.firmaPaciente.y,
          width: templateCfg.page2.noConsentimiento.firmaPaciente.w,
          height: templateCfg.page2.noConsentimiento.firmaPaciente.h,
        });

        p2.drawText(cedula, {
          x: templateCfg.page2.noConsentimiento.cedulaPaciente.x,
          y: templateCfg.page2.noConsentimiento.cedulaPaciente.y,
          size: fontSize,
          font,
          color: rgb(0, 0, 0),
        });

        p2.drawImage(firmaEspecialistaImg, {
          x: templateCfg.page2.noConsentimiento.firmaEspecialista.x,
          y: templateCfg.page2.noConsentimiento.firmaEspecialista.y,
          width: templateCfg.page2.noConsentimiento.firmaEspecialista.w,
          height: templateCfg.page2.noConsentimiento.firmaEspecialista.h,
        });
      } else {
        // fallback
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
      }
    }

    const finalPdfBytes = await pdfDoc.save();

    const estadoTexto = aceptado ? "aceptado" : "rechazado";
    const fileName = `${formatoId}-${cedula}-${now.toISOString().slice(0, 10)}-${estadoTexto}.pdf`;

    const archivoUrl = await uploadToSharePoint(
      {
        bytes: finalPdfBytes,
        fileName,
        contentType: "application/pdf",
      },
      cedula
    );

    await prisma.consentimiento.create({
      data: {
        cedula,
        fechaHora: now,
        archivoUrl,
        usuarioId: session.user.id,
        aceptado,
      },
    });

    return NextResponse.json({
      ok: true,
      archivoUrl,
      aceptado,
      mensaje: aceptado ? "Consentimiento aceptado" : "Consentimiento rechazado",
    });
  } catch (error) {
    console.error("Error guardando consentimiento firmado:", error);
    return NextResponse.json({ error: "Error guardando consentimiento firmado" }, { status: 500 });
  }
}
