// app/api/consentimientos/firmados/route.ts
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
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
 * (Opcional) Modo debug: dibuja una rejilla de coordenadas por página
 * Activa desde frontend con: formData.append("debugGrid","true")
 */
function drawDebugGrid(page: any, font: any) {
  const { width, height } = page.getSize();
  const step = 50;

  for (let x = 0; x <= width; x += step) {
    page.drawText(String(x), { x: x + 2, y: height - 12, size: 8, font, color: rgb(0, 0, 0) });
  }
  for (let y = 0; y <= height; y += step) {
    page.drawText(String(y), { x: 2, y: y + 2, size: 8, font, color: rgb(0, 0, 0) });
  }
}

function wrapText(font: any, text: string, fontSize: number, maxWidth: number) {
  const words = text.replace(/\s+/g, " ").trim().split(" ");
  const lines: string[] = [];
  let line = "";

  for (const w of words) {
    const test = line ? `${line} ${w}` : w;
    const width = font.widthOfTextAtSize(test, fontSize);
    if (width <= maxWidth) {
      line = test;
    } else {
      if (line) lines.push(line);
      line = w;
    }
  }
  if (line) lines.push(line);
  return lines;
}

function drawWrappedLines(page: any, font: any, text: string, cfg: { x: number; y: number; maxWidth: number; maxLines: number; lineHeight: number; size?: number }) {
  const size = cfg.size ?? 10;
  const lines = wrapText(font, text, size, cfg.maxWidth).slice(0, cfg.maxLines);

  for (let i = 0; i < lines.length; i++) {
    page.drawText(lines[i], {
      x: cfg.x,
      y: cfg.y - i * cfg.lineHeight,
      size,
      font,
      color: rgb(0, 0, 0),
    });
  }
}


/**
 * Coordenadas por formato (en puntos PDF)
 * (0,0) está abajo-izquierda; subir = aumentar Y.
 */
type TemplateCfg = {
  templatePublicPath: string;
  /**
   * Índices de página (0-based) dentro del PDF.
   * Por defecto:
   * - infoPageIndex = 0 (donde va fecha/paciente/especialista)
   * - signaturePageIndex = 1 (donde van firmas)
   */
  infoPageIndex?: number;
  signaturePageIndex?: number;
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

    // Nota: no todos los formatos tienen esta línea en la primera hoja.
    yoPacienteNombre?: { x: number; y: number };
    yoPacienteDocumento?: { x: number; y: number };

    // FO-HCR-01 agrega diagnóstico en página 1.
    diagnostico?: { x: number; y: number };
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

  /**
   * Opcional: marcar con una "X" el procedimiento seleccionado.
   * Clave = valor que llega desde el frontend.
   */
  procedimientos?: Record<string, { pageIndex: number; x: number; y: number }>;

  /**
   * Opcional: si el "Yo, ____" está en la página de firmas (ej. FO-HCR-01).
   */
  yoEnPaginaFirmas?: {
    yoPacienteNombre: { x: number; y: number };
    yoPacienteDocumento: { x: number; y: number };
  };

  // ===========================
  // FO-HCR-18 (Terapias) - NUEVO
  // ===========================

  // X por tipo de terapia (página 1)
  terapiasMarks?: Record<string, { pageIndex: number; x: number; y: number }>;

  // X por procedimientos múltiples (keys tipo "fisica.evaluacion", etc.)
  procedimientosMulti?: Record<string, { pageIndex: number; x: number; y: number }>;

  // Otro procedimiento por terapia: check + texto
  otrosProcedimientos?: Record<
    string,
    {
      pageIndex: number;
      check: { x: number; y: number };
      text: { x: number; y: number; size?: number; maxWidth?: number };
    }
  >;

  // Entendimiento 1/3/5
  entendimientoPos?: { pageIndex: number; x: number; y: number; size?: number };

  // ===========================
  // FO-HCR-11 (Alta voluntaria)
  // ===========================
  calidadAltaVoluntariaMarks?: {
    pacienteSI: { pageIndex: number; x: number; y: number };
    pacienteNO: { pageIndex: number; x: number; y: number };
    responsableSI: { pageIndex: number; x: number; y: number };
    responsableNO: { pageIndex: number; x: number; y: number };
  };

  riesgosAltaBox?: { pageIndex: number; x: number; y: number; maxWidth: number; maxLines: number; lineHeight: number; size?: number };
  observacionesBox?: { pageIndex: number; x: number; y: number; maxWidth: number; maxLines: number; lineHeight: number; size?: number };


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

  // ✅ FT-HCR-21 (Retiro de Catéter PICC en Domicilio)

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

  /**
   * ✅ FO-HCR-01 (Consentimiento Informado Procedimientos de Enfermería)
   * - 3 hojas (firmas en la hoja 3)
   * - Requiere diagnóstico y procedimiento; el procedimiento marca una "X" en la tabla.
   */
  "FO-HCR-01": {
    templatePublicPath: "consentimientos/FO-HCR-01.pdf",
    infoPageIndex: 0,
    signaturePageIndex: 2,
    page1: {
      // Fecha de diligenciamiento
      dia: { x: 217, y: 688 },
      mes: { x: 291, y: 688 },
      anio: { x: 360, y: 688 },

      // Paciente (fila de datos)
      pacientePrimerApellido: { x: 132, y: 667 },
      pacienteSegundoApellido: { x: 217, y: 667 },
      pacienteNombres: { x: 295, y: 667 },
      pacienteEdad: { x: 386, y: 667 },
      pacienteDocumento: { x: 416, y: 667 },
      pacienteTelefono: { x: 490, y: 667 },

      // Personal de salud (fila de datos)
      espPrimerApellido: { x: 197, y: 630 },
      espSegundoApellido: { x: 328, y: 630 },
      espNombres: { x: 453, y: 630 },

      // FO-HCR-01: diagnóstico en hoja 1
      diagnostico: { x: 90, y: 552 },
    },
    procedimientos: {
      "Cateterismo Venoso Periférico": { pageIndex: 0, x: 564, y: 426 },
      "Paso de sonda vesical Nasogástrica y/o orogástrica": { pageIndex: 0, x: 564, y: 282 },
      Curaciones: { pageIndex: 0, x: 564, y: 136 },
      "Administración y aplicación de medicamentos": { pageIndex: 1, x: 564, y: 496 },
      "Retiro de puntos": { pageIndex: 1, x: 564, y: 338 },
      "Toma de un electrocardiograma (EKG": { pageIndex: 1, x: 564, y: 190 },
      "Retiro de Catéter PICC en Domicilio": { pageIndex: 1, x: 564, y: 92 },
    },
    page2: {
      // ACEPTA (hoja 3)
      firmaPaciente: { x: 180, y: 326, w: 205, h: 38 },
      cedulaPaciente: { x: 438, y: 342 },
      firmaEspecialista: { x: 398, y: 287, w: 205, h: 38 },
      // NO ACEPTA (hoja 3)
      noConsentimiento: {
        firmaPaciente: { x: 177, y: 196, w: 230, h: 42 },
        cedulaPaciente: { x: 438, y: 216 },
        firmaEspecialista: { x: 391, y: 149, w: 230, h: 42 },
      },
    },
  },

  /**
   * ✅ FO-HCR-18 (CONSENTIMIENTO INTEGRADO PARA TERAPIAS) — 5 hojas
   * NOTA: estas coordenadas son BASE (ajústalas con debugGrid=true).
   * - infoPageIndex = 0 (página 1)
   * - signaturePageIndex = 4 (página 5)
   */
  "FO-HCR-18": {
    templatePublicPath: "consentimientos/FO-HCR-18.pdf",
    infoPageIndex: 0,
    signaturePageIndex: 4,

    // PÁGINA 1 (landscape)
    page1: {
      // Fecha diligenciamiento
      dia: { x: 206, y: 507 },
      mes: { x: 275, y: 507 },
      anio: { x: 345, y: 507 },

      // Tabla paciente
      pacientePrimerApellido: { x: 107, y: 486 },
      pacienteSegundoApellido: { x: 206, y: 486 },
      pacienteNombres: { x: 317, y: 486 },
      pacienteEdad: { x: 467, y: 486 },
      pacienteDocumento: { x: 536, y: 486 },
      pacienteTelefono: { x: 650, y: 486 },

      // Tabla personal de salud
      espPrimerApellido: { x: 213, y: 450 },
      espSegundoApellido: { x: 401, y: 450 },
      espNombres: { x: 580, y: 450 },

      // Línea Yo, ____ con documento ___
      yoPacienteNombre: { x: 65, y: 403 },
      yoPacienteDocumento: { x: 380, y: 403 },
    },

    // PÁGINA 5 (firmas)
    page2: {
      // ACEPTA
      firmaPaciente: { x: 215, y: 410, w: 260, h: 55 },
      cedulaPaciente: { x: 565, y: 440 },
      firmaEspecialista: { x: 535, y: 370, w: 210, h: 55 },

      // NO ACEPTA
      noConsentimiento: {
        firmaPaciente: { x: 216, y: 230, w: 260, h: 55 },
        cedulaPaciente: { x: 563, y: 247 },
        firmaEspecialista: { x: 502, y: 165, w: 260, h: 55 },
      },
    },

    // X en selección de terapia (página 1)
    terapiasMarks: {
      fisica: { pageIndex: 0, x: 273, y: 392 },
      fonoaudiologia: { pageIndex: 0, x: 449, y: 392 },
      respiratoria: { pageIndex: 0, x: 559, y: 392 },
      ocupacional: { pageIndex: 0, x: 671, y: 392 },
    },

    // X en procedimientos múltiples (BASE: AJUSTAR)
    procedimientosMulti: {
      // Fisioterapia (págs 1–2)
      "fisica.Evaluacion": { pageIndex: 0, x: 703, y: 143 },
      "fisica.Medios_fisicos": { pageIndex: 0, x: 703, y: 117 },
      "fisica.Ejercicios_cardiovasculares": { pageIndex: 0, x: 703, y: 91 },

      "fisica.Propiocepcion": { pageIndex: 1, x: 703, y: 498 },
      "fisica.Fuerza": { pageIndex: 1, x: 703, y: 477 },
      "fisica.Equilibrio": { pageIndex: 1, x: 703, y: 459 },
      "fisica.Flexibilidad": { pageIndex: 1, x: 703, y: 443 },

      // Fonoaudiología (pág 2)
      "fonoaudiologia.Evaluacion": { pageIndex: 1, x: 703, y: 347 },
      "fonoaudiologia.Trastornos_comunicacion": { pageIndex: 1, x: 703, y: 307 },
      "fonoaudiologia.Trastornos_habla": { pageIndex: 1, x: 703, y: 275 },
      "fonoaudiologia.Dificultades_lenguaje": { pageIndex: 1, x: 703, y: 251 },
      "fonoaudiologia.Problemas_voz": { pageIndex: 1, x: 703, y: 226 },
      "fonoaudiologia.Trastornos_deglucion": { pageIndex: 1, x: 703, y: 201 },

      // Respiratoria (págs 2–3)
      "respiratoria.Aspiracion_secreciones": { pageIndex: 1, x: 703, y: 110 },
      "respiratoria.Nebulizacion_inhalatoria": { pageIndex: 2, x: 703, y: 477 },
      "respiratoria.Higiene_bronquial": { pageIndex: 2, x: 703, y: 406 },
      "respiratoria.Rehabilitacion_pulmonar": { pageIndex: 2, x: 703, y: 354 },
      "respiratoria.Cuidados_traqueostomia": { pageIndex: 2, x: 703, y: 310 },
      "respiratoria.Manejo_traqueostomia": { pageIndex: 2, x: 703, y: 250 },
      "respiratoria.Educacion_apoyo": { pageIndex: 2, x: 703, y: 180 },

      // Ocupacional (pág 4)
      "ocupacional.Evaluacion": { pageIndex: 3, x: 703, y: 486 },
      "ocupacional.Motricidad_fina": { pageIndex: 3, x: 703, y: 454 },
      "ocupacional.motricidad_gruesa": { pageIndex: 3, x: 703, y: 422 },
      "ocupacional.AVD": { pageIndex: 3, x: 703, y: 386 },
      "ocupacional.Sensoriales": { pageIndex: 3, x: 703, y: 353 },
      "ocupacional.Rehabilitacion_funcional": { pageIndex: 3, x: 703, y: 329 },
    },

    // Otro procedimiento (check + texto) (BASE: AJUSTAR)
    otrosProcedimientos: {
      fisica: { pageIndex: 1, check: { x: 703, y: 425 }, text: { x: 150, y: 423, size: 9, maxWidth: 640 } },
      //fonoaudiologia: { pageIndex: 1, check: { x: 703, y: 150 }, text: { x: 150, y: 150, size: 9, maxWidth: 640 } },
      respiratoria: { pageIndex: 2, check: { x: 703, y: 141 }, text: { x: 150, y: 141, size: 9, maxWidth: 640 } },
      ocupacional: { pageIndex: 3, check: { x: 703, y: 299 }, text: { x: 150, y: 299, size: 9, maxWidth: 640 } },
    },

    // Entendimiento (pág 4: “Coloque aquí su calificación en:”)
    entendimientoPos: { pageIndex: 3, x: 210, y: 201, size: 12 },
  },

  // ✅ FT-HCR-22 (Atención domiciliaria)

  "FO-HCR-22": {
    templatePublicPath: "consentimientos/FO-HCR-22.pdf",
    page1: {
      // Fecha de diligenciamiento
      dia: { x: 170, y: 694 },
      mes: { x: 225, y: 694 },
      anio: { x: 282, y: 694 },

      // Tabla paciente (fila de datos)
      pacientePrimerApellido: { x: 120, y: 667 },
      pacienteSegundoApellido: { x: 202, y: 667 },
      pacienteNombres: { x: 281, y: 667 },
      pacienteEdad: { x: 392, y: 667 },
      pacienteDocumento: { x: 425, y: 667 },
      pacienteTelefono: { x: 503, y: 667 },

      // Tabla personal de salud (fila de datos)
      espPrimerApellido: { x: 190, y: 629 },
      espSegundoApellido: { x: 326, y: 629 },
      espNombres: { x: 452, y: 629 },

      // Línea "Yo, ____ con numero de documento..."
      yoPacienteNombre: { x: 52, y: 575 },
      yoPacienteDocumento: { x: 380, y: 575 },
    },
    page2: {
      // ACEPTA
      firmaPaciente: { x: 170, y: 630, w: 190, h: 50 },
      cedulaPaciente: { x: 433, y: 643 },
      firmaEspecialista: { x: 380, y: 587, w: 210, h: 45 },

      // NO ACEPTA (abajo)
      noConsentimiento: {
        firmaPaciente: { x: 170, y: 494, w: 190, h: 45 },
        cedulaPaciente: { x: 429, y: 513 },
        firmaEspecialista: { x: 405, y: 446, w: 190, h: 45 },
      },
    },
  },

  // ✅ FT-HCR-20 (Retiro y cambio de trasqueostomia)

  "FO-HCR-20": {
    templatePublicPath: "consentimientos/FO-HCR-20.pdf",
    page1: {
      // Fecha de diligenciamiento
      dia: { x: 156, y: 688 },
      mes: { x: 214, y: 688 },
      anio: { x: 270, y: 688 },

      // Tabla paciente (fila de datos)
      pacientePrimerApellido: { x: 89, y: 660 },
      pacienteSegundoApellido: { x: 178, y: 660 },
      pacienteNombres: { x: 264, y: 660 },
      pacienteEdad: { x: 377, y: 660 },
      pacienteDocumento: { x: 414, y: 660 },
      pacienteTelefono: { x: 497, y: 660 },

      // Tabla personal de salud (fila de datos)
      espPrimerApellido: { x: 183, y: 624 },
      espSegundoApellido: { x: 318, y: 624 },
      espNombres: { x: 455, y: 624 },

      // Línea "Yo, ____ con numero de documento..."
      yoPacienteNombre: { x: 52, y: 566 },
      yoPacienteDocumento: { x: 380, y: 566 },
    },
    page2: {
      // ACEPTA
      firmaPaciente: { x: 170, y: 640, w: 190, h: 50 },
      cedulaPaciente: { x: 433, y: 657 },
      firmaEspecialista: { x: 380, y: 597, w: 210, h: 45 },

      // NO ACEPTA (abajo)
      noConsentimiento: {
        firmaPaciente: { x: 170, y: 509, w: 190, h: 45 },
        cedulaPaciente: { x: 429, y: 523 },
        firmaEspecialista: { x: 395, y: 459, w: 190, h: 45 },
      },
    },
  },

  // ✅ FT-HCR-19 (Paro cardiaco)

  "FO-HCR-19": {
    templatePublicPath: "consentimientos/FO-HCR-19.pdf",
    page1: {
      // Fecha de diligenciamiento
      dia: { x: 160, y: 688 },
      mes: { x: 214, y: 688 },
      anio: { x: 270, y: 688 },

      // Tabla paciente (fila de datos)
      pacientePrimerApellido: { x: 118, y: 660 },
      pacienteSegundoApellido: { x: 196, y: 660 },
      pacienteNombres: { x: 276, y: 660 },
      pacienteEdad: { x: 382, y: 660 },
      pacienteDocumento: { x: 415, y: 660 },
      pacienteTelefono: { x: 500, y: 660 },

      // Tabla personal de salud (fila de datos)
      espPrimerApellido: { x: 183, y: 624 },
      espSegundoApellido: { x: 318, y: 624 },
      espNombres: { x: 455, y: 624 },

      // Línea "Yo, ____ con numero de documento..."
      yoPacienteNombre: { x: 52, y: 566 },
      yoPacienteDocumento: { x: 380, y: 566 },
    },
    page2: {
      // ACEPTA
      firmaPaciente: { x: 170, y: 630, w: 190, h: 50 },
      cedulaPaciente: { x: 433, y: 647 },
      firmaEspecialista: { x: 380, y: 593, w: 210, h: 45 },

      // NO ACEPTA (abajo)
      noConsentimiento: {
        firmaPaciente: { x: 170, y: 490, w: 190, h: 45 },
        cedulaPaciente: { x: 429, y: 513 },
        firmaEspecialista: { x: 395, y: 449, w: 190, h: 45 },
      },
    },
  },


  // ✅ FT-HCR-06 (Psicología)

  "FO-HCR-06": {
    templatePublicPath: "consentimientos/FO-HCR-06.pdf",
    page1: {
      // Fecha de diligenciamiento
      dia: { x: 162, y: 688 },
      mes: { x: 213, y: 688 },
      anio: { x: 282, y: 688 },

      // Tabla paciente (fila de datos)
      pacientePrimerApellido: { x: 89, y: 665 },
      pacienteSegundoApellido: { x: 180, y: 665 },
      pacienteNombres: { x: 276, y: 665 },
      pacienteEdad: { x: 385, y: 665 },
      pacienteDocumento: { x: 422, y: 665 },
      pacienteTelefono: { x: 500, y: 665 },

      // Tabla personal de salud (fila de datos)
      espPrimerApellido: { x: 183, y: 624 },
      espSegundoApellido: { x: 318, y: 624 },
      espNombres: { x: 455, y: 624 },

      // Línea "Yo, ____ con numero de documento..."
      yoPacienteNombre: { x: 50, y: 583 },
      yoPacienteDocumento: { x: 345, y: 583 },
    },
    page2: {
      // ACEPTA
      firmaPaciente: { x: 186, y: 648, w: 190, h: 50 },
      cedulaPaciente: { x: 412, y: 668 },
      firmaEspecialista: { x: 385, y: 610, w: 210, h: 45 },

      // NO ACEPTA (abajo)
      noConsentimiento: {
        firmaPaciente: { x: 184, y: 517, w: 190, h: 45 },
        cedulaPaciente: { x: 406, y: 536 },
        firmaEspecialista: { x: 390, y: 468, w: 190, h: 45 },
      },
    },
  },

  // ✅ FT-HCR-011 (Alta voluntaria)

  "FO-HCR-11": {
    templatePublicPath: "consentimientos/FO-HCR-11.pdf",
    infoPageIndex: 0,
    signaturePageIndex: 0, // es 1 sola página

    page1: {
      dia: { x: 120, y: 881 },
      mes: { x: 193, y: 881 },
      anio: { x: 265, y: 881 },

      pacientePrimerApellido: { x: 88, y: 857 },
      pacienteSegundoApellido: { x: 169, y: 857 },
      pacienteNombres: { x: 254, y: 857 },
      pacienteDocumento: { x: 379, y: 857 },
      pacienteEdad: { x: 465, y: 857 },
      pacienteTelefono: { x: 516, y: 857 },

      espPrimerApellido: { x: 200, y: 806 },
      espSegundoApellido: { x: 328, y: 806 },
      espNombres: { x: 456, y: 806 },

      yoPacienteNombre: { x: 73, y: 752 },
      yoPacienteDocumento: { x: 97, y: 739 },
    },

    page2: {
      // Firma paciente (línea izquierda)
      firmaPaciente: { x: 80, y: 225, w: 240, h: 45 },
      cedulaPaciente: { x: 352, y: 239 }, // “Documento del paciente”
      // Firma personal salud (línea derecha inferior)
      firmaEspecialista: { x: 326, y: 153, w: 240, h: 45 },
    },

    // CALIDAD (X sobre los guiones)
    calidadAltaVoluntariaMarks: {
      pacienteSI: { pageIndex: 0, x: 179, y: 593 },
      pacienteNO: { pageIndex: 0, x: 223, y: 593 },
      responsableSI: { pageIndex: 0, x: 480, y: 565 },
      responsableNO: { pageIndex: 0, x: 524, y: 565 },
    },

    // Caja de riesgos (arriba de “Observaciones”)
    riesgosAltaBox: { pageIndex: 0, x: 45, y: 517, maxWidth: 520, maxLines: 7, lineHeight: 16, size: 10 },

    // Caja de observaciones
    observacionesBox: { pageIndex: 0, x: 45, y: 390, maxWidth: 520, maxLines: 7, lineHeight: 16, size: 10 },
  },

  // ✅ FT-HCR-07 (Nutrición)

  "FO-HCR-07": {
    templatePublicPath: "consentimientos/FO-HCR-07.pdf",
    page1: {
      // Fecha de diligenciamiento
      dia: { x: 160, y: 688 },
      mes: { x: 213, y: 688 },
      anio: { x: 282, y: 688 },

      // Tabla paciente (fila de datos)
      pacientePrimerApellido: { x: 110, y: 665 },
      pacienteSegundoApellido: { x: 188, y: 665 },
      pacienteNombres: { x: 268, y: 665 },
      pacienteEdad: { x: 382, y: 665 },
      pacienteDocumento: { x: 416, y: 665 },
      pacienteTelefono: { x: 497, y: 665 },

      // Tabla personal de salud (fila de datos)
      espPrimerApellido: { x: 184, y: 630 },
      espSegundoApellido: { x: 318, y: 630 },
      espNombres: { x: 448, y: 630 },

      // Línea "Yo, ____ con numero de documento..."
      yoPacienteNombre: { x: 54, y: 583 },
      yoPacienteDocumento: { x: 380, y: 583 },
    },
    page2: {
      // ACEPTA
      firmaPaciente: { x: 183, y: 425, w: 190, h: 50 },
      cedulaPaciente: { x: 416, y: 440 },
      firmaEspecialista: { x: 380, y: 383, w: 210, h: 45 },

      // NO ACEPTA (abajo)
      noConsentimiento: {
        firmaPaciente: { x: 184, y: 292, w: 190, h: 45 },
        cedulaPaciente: { x: 405, y: 308 },
        firmaEspecialista: { x: 390, y: 244, w: 190, h: 45 },
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

    // Campos especiales (FO-HCR-01)
    const diagnostico = String(formData.get("diagnostico") || "").trim();
    const procedimiento = String(formData.get("procedimiento") || "").trim();

    // Campos especiales (FO-HCR-18)
    const terapiasJson = String(formData.get("terapiasJson") || "");
    const procedimientosJson = String(formData.get("procedimientosJson") || "");
    const otrosJson = String(formData.get("otrosJson") || "");
    const entendimientoRaw = String(formData.get("entendimiento") || "");

    // Campos especiales (FO-HCR-11)
    const calidadPaciente11 = String(formData.get("calidadPaciente11") || "");
    const calidadResponsable11 = String(formData.get("calidadResponsable11") || "");
    const riesgosAlta11 = String(formData.get("riesgosAlta11") || "").trim();
    const observaciones11 = String(formData.get("observaciones11") || "").trim();


    // Debug
    const debugGrid = String(formData.get("debugGrid") || "") === "true";

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

    if (formatoId === "FO-HCR-01") {
      if (!diagnostico || !procedimiento) {
        return NextResponse.json({ error: "Faltan diagnóstico o procedimiento" }, { status: 400 });
      }
    }

    if (formatoId === "FO-HCR-18") {
      if (!terapiasJson || !procedimientosJson || !otrosJson || !entendimientoRaw) {
        return NextResponse.json({ error: "Faltan campos FO-HCR-18 (terapias/procedimientos/otros/entendimiento)" }, { status: 400 });
      }
    }

    if (formatoId === "FO-HCR-11") {
      if (!calidadPaciente11 || !calidadResponsable11 || !riesgosAlta11 || !observaciones11) {
        return NextResponse.json({ error: "Faltan campos FO-HCR-11 (calidad / riesgos / observaciones)" }, { status: 400 });
      }
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

    // ===== Page 1 (info) =====
    const infoIdx = templateCfg.infoPageIndex ?? 0;
    const sigIdx = templateCfg.signaturePageIndex ?? 1;

    const p1 = pages[infoIdx] ?? pages[0];

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

    // "Yo, ____" + documento (si está en la hoja 1)
    if (templateCfg.page1.yoPacienteNombre && templateCfg.page1.yoPacienteDocumento) {
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
    }

    // Diagnóstico (si aplica)
    if (templateCfg.page1.diagnostico && diagnostico) {
      p1.drawText(diagnostico, {
        x: templateCfg.page1.diagnostico.x,
        y: templateCfg.page1.diagnostico.y,
        size: fontSize,
        font,
        color: rgb(0, 0, 0),
      });
    }

    // Marcar procedimiento con X (si aplica)
    if (templateCfg.procedimientos && procedimiento && templateCfg.procedimientos[procedimiento]) {
      const mark = templateCfg.procedimientos[procedimiento];
      const page = pages[mark.pageIndex] ?? pages[0];
      page.drawText("X", {
        x: mark.x,
        y: mark.y,
        size: 12,
        font,
        color: rgb(0, 0, 0),
      });
    }

    // ===========================
    // FO-HCR-18: terapias / procedimientos / otros / entendimiento
    // ===========================
    if (formatoId === "FO-HCR-18") {
      let terapias: Record<string, boolean> = {};
      let procedimientosMulti: Record<string, Record<string, boolean>> = {};
      let otros: Record<string, { activo: boolean; descripcion: string }> = {};
      const entendimiento = Number(entendimientoRaw || "0");

      try {
        terapias = terapiasJson ? JSON.parse(terapiasJson) : {};
        procedimientosMulti = procedimientosJson ? JSON.parse(procedimientosJson) : {};
        otros = otrosJson ? JSON.parse(otrosJson) : {};
      } catch {
        return NextResponse.json({ error: "JSON inválido en campos FO-HCR-18" }, { status: 400 });
      }

      // 1) Marcar terapias con X
      if (templateCfg.terapiasMarks) {
        for (const [k, v] of Object.entries(terapias)) {
          if (!v) continue;
          const m = templateCfg.terapiasMarks[k];
          if (!m) continue;
          const page = pages[m.pageIndex] ?? pages[0];
          page.drawText("X", { x: m.x, y: m.y, size: 12, font, color: rgb(0, 0, 0) });
        }
      }

      // 2) Marcar procedimientos múltiples con X
      if (templateCfg.procedimientosMulti) {
        for (const [terapiaKey, procs] of Object.entries(procedimientosMulti)) {
          for (const [procKey, checked] of Object.entries(procs || {})) {
            if (!checked) continue;
            const mapKey = `${terapiaKey}.${procKey}`;
            const m = templateCfg.procedimientosMulti[mapKey];
            if (!m) continue;
            const page = pages[m.pageIndex] ?? pages[0];
            page.drawText("X", { x: m.x, y: m.y, size: 12, font, color: rgb(0, 0, 0) });
          }
        }
      }

      // 3) Otro procedimiento (X + texto)
      if (templateCfg.otrosProcedimientos) {
        for (const [terapiaKey, info] of Object.entries(otros)) {
          if (!info?.activo) continue;
          const m = templateCfg.otrosProcedimientos[terapiaKey];
          if (!m) continue;

          const page = pages[m.pageIndex] ?? pages[0];
          page.drawText("X", { x: m.check.x, y: m.check.y, size: 12, font, color: rgb(0, 0, 0) });

          const text = String(info.descripcion || "").trim();
          if (text) {
            page.drawText(text, {
              x: m.text.x,
              y: m.text.y,
              size: m.text.size ?? 9,
              font,
              color: rgb(0, 0, 0),
              maxWidth: m.text.maxWidth ?? 600,
            });
          }
        }
      }

      // 4) Entendimiento (1/3/5) -> se imprime como número en el campo
      if (templateCfg.entendimientoPos && (entendimiento === 1 || entendimiento === 3 || entendimiento === 5)) {
        const m = templateCfg.entendimientoPos;
        const page = pages[m.pageIndex] ?? pages[0];
        page.drawText(String(entendimiento), {
          x: m.x,
          y: m.y,
          size: m.size ?? 12,
          font,
          color: rgb(0, 0, 0),
        });
      }
    }

    // FO-HCR-11: calidad + riesgos + observaciones

    if (formatoId === "FO-HCR-11") {
      // 1) Marcar calidad con X
      if (templateCfg.calidadAltaVoluntariaMarks) {
        const m = templateCfg.calidadAltaVoluntariaMarks;
        const page = pages[0];

        const markPaciente = calidadPaciente11 === "SI" ? m.pacienteSI : m.pacienteNO;
        const markResponsable = calidadResponsable11 === "SI" ? m.responsableSI : m.responsableNO;

        page.drawText("X", { x: markPaciente.x, y: markPaciente.y, size: 12, font, color: rgb(0, 0, 0) });
        page.drawText("X", { x: markResponsable.x, y: markResponsable.y, size: 12, font, color: rgb(0, 0, 0) });
      }

      // 2) Texto riesgos
      if (templateCfg.riesgosAltaBox) {
        const page = pages[templateCfg.riesgosAltaBox.pageIndex] ?? pages[0];
        drawWrappedLines(page, font, riesgosAlta11, templateCfg.riesgosAltaBox);
      }

      // 3) Texto observaciones
      if (templateCfg.observacionesBox) {
        const page = pages[templateCfg.observacionesBox.pageIndex] ?? pages[0];
        drawWrappedLines(page, font, observaciones11, templateCfg.observacionesBox);
      }
    }



    // ===== Página de firmas (LÓGICA ACEPTACIÓN) =====
    const p2 = pages[sigIdx] ?? pages[1] ?? pages[0];

    // "Yo, ____" en la hoja de firmas (si aplica)
    if (templateCfg.yoEnPaginaFirmas) {
      p2.drawText(pacienteNombreCompleto, {
        x: templateCfg.yoEnPaginaFirmas.yoPacienteNombre.x,
        y: templateCfg.yoEnPaginaFirmas.yoPacienteNombre.y,
        size: fontSize,
        font,
        color: rgb(0, 0, 0),
      });

      p2.drawText(cedula, {
        x: templateCfg.yoEnPaginaFirmas.yoPacienteDocumento.x,
        y: templateCfg.yoEnPaginaFirmas.yoPacienteDocumento.y,
        size: fontSize,
        font,
        color: rgb(0, 0, 0),
      });
    }

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

    // Debug grid (si se pidió)
    if (debugGrid) {
      for (const pg of pages) drawDebugGrid(pg, font);
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
