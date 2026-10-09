import "server-only";

import path from "path";
import fs from "fs/promises";
import { Buffer } from "buffer";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import type { PDFFont, PDFImage, PDFPage, RGB } from "pdf-lib";

import { APP_TIMEZONE, getBogotaDateKey } from "./bogotaDate";
import {
  CAMARAS_CUIDADOR,
  DECISIONES_CUIDADOR,
  DECLARACIONES_DATOS_CUIDADOR,
  ETIQUETAS_CUIDADOR,
  FIRMAS_CUIDADOR,
  OTORGANTES_CUIDADOR,
  PIE_CUIDADOR,
  RAZONES_NO_FIRMA_CUIDADOR,
  SECCIONES_CUIDADOR,
  SI_NO_CUIDADOR,
  TIPOS_DOCUMENTO_CUIDADOR,
  TITULO_CUIDADOR,
  TURNOS_CUIDADOR,
  calcularEdadCuidador,
  formatearDocumentoCuidador,
  formatearFechaCuidador,
  validarFechaInicioCuidador,
  validarFechaNacimientoCuidador,
} from "./consentimientoCuidador";
import type { CamposCuidador, DatosCuidador, SeccionCuidador } from "./consentimientoCuidador";
import { REGLAS, normalizarCampo, reglaDocumento, validarCampo } from "./validacionCampos";
import type { ReglaCampo } from "./validacionCampos";

/**
 * Consentimiento del cuidador (Auxiliar de Enfermeria por Turnos): validacion
 * de lo que envia el formulario y armado del PDF firmado.
 *
 * A diferencia de los formatos FO-HCR, este PDF no se estampa sobre una
 * plantilla con coordenadas fijas: se arma desde cero y el contenido fluye de
 * una hoja a la siguiente. Asi las firmas caen siempre dentro de su recuadro,
 * sin importar cuanto texto se haya diligenciado.
 */

// ===========================
// Validacion de entrada
// ===========================

export type FirmasCuidador = {
  /** Null cuando firma el representante y el paciente no puede hacerlo. */
  paciente: Uint8Array | null;
  /** Null cuando el consentimiento lo otorga el propio paciente. */
  representante: Uint8Array | null;
  profesional: Uint8Array;
};

export type ResultadoCuidador =
  | { ok: true; datos: DatosCuidador; firmas: FirmasCuidador }
  | { ok: false; error: string };

class DatoInvalido extends Error {}

const PNG_MAGIC = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const MAX_FIRMA_BYTES = 2 * 1024 * 1024;
const PREFIJO_PNG = "data:image/png;base64,";

/** Lee un campo de texto y lo revisa contra su regla (la misma que usa el formulario). */
function leerTexto(
  formData: FormData,
  campo: string,
  etiqueta: string,
  regla: ReglaCampo,
  opcional = false
): string {
  const valor = normalizarCampo(String(formData.get(campo) ?? ""));
  if (!valor) {
    if (opcional) return "";
    throw new DatoInvalido(`Falta: ${etiqueta}`);
  }

  const error = validarCampo(regla, valor);
  if (error) throw new DatoInvalido(`${etiqueta}: ${error}`);
  return valor;
}

function leerOpcion<T extends string>(
  formData: FormData,
  campo: string,
  etiqueta: string,
  opciones: readonly { value: T }[]
): T {
  const valor = String(formData.get(campo) ?? "");
  const opcion = opciones.find((o) => o.value === valor);
  if (!opcion) throw new DatoInvalido(`Selecciona una opción en: ${etiqueta}`);
  return opcion.value;
}

function leerOpciones<T extends string>(
  formData: FormData,
  campo: string,
  opciones: readonly { value: T }[]
): T[] {
  const recibidas = formData.getAll(campo).map(String);
  return opciones.map((o) => o.value).filter((value) => recibidas.includes(value));
}

function leerFecha(
  formData: FormData,
  campo: string,
  etiqueta: string,
  validar: (fecha: string) => string
): string {
  const valor = String(formData.get(campo) ?? "").trim();
  if (!valor) throw new DatoInvalido(`Falta: ${etiqueta}`);

  const error = validar(valor);
  if (error) throw new DatoInvalido(`${etiqueta}: ${error}`);
  return valor;
}

/** Numero de documento segun su tipo. Los puntos y espacios de miles se descartan. */
function leerDocumento(formData: FormData, campo: string, etiqueta: string, tipo: string): string {
  const valor = String(formData.get(campo) ?? "").replace(/[\s.,]/g, "");
  if (!valor) throw new DatoInvalido(`Falta: ${etiqueta}`);

  const error = validarCampo(reglaDocumento(tipo), valor);
  if (error) throw new DatoInvalido(`${etiqueta}: ${error}`);
  return valor;
}

function leerFirma(formData: FormData, campo: string): Uint8Array | null {
  const dataUrl = String(formData.get(campo) ?? "");
  if (!dataUrl) return null;
  if (!dataUrl.startsWith(PREFIJO_PNG)) throw new DatoInvalido("Firma inválida");

  const bytes = new Uint8Array(Buffer.from(dataUrl.slice(PREFIJO_PNG.length), "base64"));
  const esPng = PNG_MAGIC.every((b, i) => bytes[i] === b);
  if (!esPng || bytes.byteLength > MAX_FIRMA_BYTES) throw new DatoInvalido("Firma inválida");
  return bytes;
}

/**
 * Valida y normaliza el formulario del consentimiento del cuidador. `hoy` es la
 * fecha de Bogota (YYYY-MM-DD) contra la que se revisan las fechas.
 */
export function parseDatosCuidador(formData: FormData, hoy: string): ResultadoCuidador {
  const E = ETIQUETAS_CUIDADOR;
  const R = REGLAS;

  try {
    const pacienteTipoDocumento = leerOpcion(formData, "pacienteTipoDocumento", E.tipoDocumento, TIPOS_DOCUMENTO_CUIDADOR);
    const otorgante = leerOpcion(formData, "otorgante", "quién otorga el consentimiento", OTORGANTES_CUIDADOR);
    const otorgaTercero = otorgante !== "PACIENTE";
    const camaras = leerOpcion(formData, "camaras", "cámaras de videovigilancia en el domicilio", SI_NO_CUIDADOR);
    const decision = leerOpcion(formData, "decisionCuidador", "la decisión sobre el servicio", DECISIONES_CUIDADOR);

    const repTipoDocumento = otorgaTercero
      ? leerOpcion(formData, "repTipoDocumento", `${E.repId} de quien otorga`, TIPOS_DOCUMENTO_CUIDADOR)
      : "";
    const razonesNoFirma = otorgaTercero ? leerOpciones(formData, "razonesNoFirma", RAZONES_NO_FIRMA_CUIDADOR) : [];

    const firmaPaciente = leerFirma(formData, "firmaPacientePngBase64");
    const firmaRepresentante = otorgaTercero ? leerFirma(formData, "firmaRepresentantePngBase64") : null;
    const firmaProfesional = leerFirma(formData, "firmaEspecialistaPngBase64");

    if (!firmaProfesional) throw new DatoInvalido("Falta la firma del profesional que brinda la información");
    if (!otorgaTercero && !firmaPaciente) throw new DatoInvalido("Falta la firma del paciente");
    if (otorgaTercero && !firmaRepresentante) {
      throw new DatoInvalido("Falta la firma del representante, apoyo o responsable autorizado");
    }
    if (otorgaTercero && !firmaPaciente && razonesNoFirma.length === 0) {
      throw new DatoInvalido("Indica la razón por la cual el paciente no firma directamente");
    }

    const datos: DatosCuidador = {
      pacienteNombre: leerTexto(formData, "pacienteNombre", `${E.pacienteNombre} del paciente`, R.nombreCompleto),
      pacienteTipoDocumento,
      pacienteTipoDocumentoOtro:
        pacienteTipoDocumento === "OTRO"
          ? leerTexto(formData, "pacienteTipoDocumentoOtro", "otro tipo de documento del paciente", R.tipoDocumentoOtro)
          : "",
      cedula: leerDocumento(formData, "cedula", `${E.numeroDocumento} del paciente`, pacienteTipoDocumento),
      pacienteFechaNacimiento: leerFecha(formData, "pacienteFechaNacimiento", E.fechaNacimiento, (fecha) =>
        validarFechaNacimientoCuidador(fecha, hoy)
      ),
      direccionServicio: leerTexto(formData, "direccionServicio", E.direccionServicio, R.direccion),
      municipio: leerTexto(formData, "municipio", E.municipio, R.municipio),
      pacienteTelefono: leerTexto(formData, "pacienteTelefono", E.telefonoContacto, R.telefono),
      diagnostico: leerTexto(formData, "diagnostico", E.diagnostico, R.diagnostico),

      otorgante,
      otorganteOtro:
        otorgante === "OTRA_PERSONA"
          ? leerTexto(formData, "otorganteOtro", "otra persona legalmente facultada", R.aclaracion)
          : "",
      repNombre: otorgaTercero ? leerTexto(formData, "repNombre", `${E.repNombre} de quien otorga`, R.nombreCompleto) : "",
      repTipoDocumento,
      repTipoDocumentoOtro:
        repTipoDocumento === "OTRO"
          ? leerTexto(formData, "repTipoDocumentoOtro", "otro tipo de documento de quien otorga", R.tipoDocumentoOtro)
          : "",
      repDocumento: otorgaTercero
        ? leerDocumento(formData, "repDocumento", `${E.repId} de quien otorga`, repTipoDocumento)
        : "",
      repParentesco: otorgaTercero ? leerTexto(formData, "repParentesco", E.repParentesco, R.parentesco) : "",
      repTelefono: otorgaTercero
        ? leerTexto(formData, "repTelefono", `${E.repTelefono} de quien otorga`, R.telefono)
        : "",
      razonesNoFirma,
      razonNoFirmaOtra: razonesNoFirma.includes("OTRA")
        ? leerTexto(formData, "razonNoFirmaOtra", "otra razón por la cual el paciente no firma", R.aclaracion)
        : "",

      turno: leerOpcion(formData, "turno", "la modalidad del turno", TURNOS_CUIDADOR),
      horarioProgramado: leerTexto(formData, "horarioProgramado", E.horarioProgramado, R.horario),
      fechaInicioServicio: leerFecha(formData, "fechaInicioServicio", E.fechaInicio, (fecha) =>
        validarFechaInicioCuidador(fecha, hoy)
      ),

      declaracionesDatos: leerOpciones(formData, "declaracionesDatos", DECLARACIONES_DATOS_CUIDADOR),
      autorizaRegistroClinico: leerOpcion(formData, "autorizaRegistroClinico", "16.1 Registro con finalidad clínica", SI_NO_CUIDADOR),
      camaras,
      camarasUbicacion:
        camaras === "SI" ? leerTexto(formData, "camarasUbicacion", "la ubicación de las cámaras", R.textoMedio) : "",
      preguntasRespuestas: leerTexto(formData, "preguntasRespuestas", E.preguntas, R.textoLargo, true),

      decision,
      observacionesAceptacion:
        decision === "ACEPTO_CON_OBSERVACIONES"
          ? leerTexto(formData, "observacionesAceptacion", "las observaciones o limitaciones", R.textoLargo)
          : "",
      motivoNegativa:
        decision === "NO_ACEPTO"
          ? leerTexto(formData, "motivoNegativa", "el motivo de la negativa o desistimiento", R.textoLargo)
          : "",

      profesionalCargo: leerTexto(formData, "profesionalCargo", "el cargo del profesional", R.cargo),
      profesionalRegistro: leerTexto(formData, "profesionalRegistro", FIRMAS_CUIDADOR.registroProfesional, R.registroProfesional, true),
    };

    return {
      ok: true,
      datos,
      firmas: { paciente: firmaPaciente, representante: firmaRepresentante, profesional: firmaProfesional },
    };
  } catch (error) {
    if (error instanceof DatoInvalido) return { ok: false, error: error.message };
    throw error;
  }
}

// ===========================
// PDF
// ===========================

// Hoja carta, en puntos. (0,0) esta abajo-izquierda; subir = aumentar Y.
const PAGE_W = 612;
const PAGE_H = 792;
const MARGEN_X = 54;
const ANCHO = PAGE_W - MARGEN_X * 2;
const Y_INICIO = PAGE_H - 82; // debajo del encabezado
const Y_FIN = 66; // encima del pie de pagina
const GAP_COL = 12;

const TAM = 10;
const LH = 13.8;
const ALTO_CAJA_FIRMA = 56;

const NEGRO = rgb(0.1, 0.1, 0.12);
const GRIS = rgb(0.38, 0.41, 0.46);
const LINEA = rgb(0.78, 0.8, 0.84);
const ROJO = rgb(0.72, 0.05, 0.11);

const NO_APLICA = "No aplica";

const horaBogotaFormatter = new Intl.DateTimeFormat("en-GB", {
  timeZone: APP_TIMEZONE,
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

/**
 * Las fuentes estandar del PDF solo cubren WinAnsi: un emoji o una tilde
 * "combinada" (frecuente en teclados moviles) hace fallar el dibujo del texto.
 * Se normaliza y lo que no tenga glifo se reemplaza por "?".
 */
function crearSaneador(font: PDFFont) {
  const soportados = new Set(font.getCharacterSet());
  return (texto: string) =>
    Array.from(
      texto
        .normalize("NFC")
        .replace(/[​-‍﻿]/g, "")
        .replace(/\p{M}/gu, "")
        .replace(/\s/g, " ")
    )
      .map((ch) => (soportados.has(ch.codePointAt(0) ?? 0) ? ch : "?"))
      .join("");
}

function partirEnLineas(font: PDFFont, texto: string, size: number, maxWidth: number): string[] {
  const lineas: string[] = [];
  let linea = "";

  for (let palabra of texto.split(" ").filter(Boolean)) {
    // Una palabra mas ancha que el renglon se corta por caracteres.
    while (font.widthOfTextAtSize(palabra, size) > maxWidth && palabra.length > 1) {
      let corte = palabra.length - 1;
      while (corte > 1 && font.widthOfTextAtSize(palabra.slice(0, corte), size) > maxWidth) corte--;
      if (linea) lineas.push(linea);
      lineas.push(palabra.slice(0, corte));
      linea = "";
      palabra = palabra.slice(corte);
    }

    const prueba = linea ? `${linea} ${palabra}` : palabra;
    if (font.widthOfTextAtSize(prueba, size) <= maxWidth) {
      linea = prueba;
    } else {
      lineas.push(linea);
      linea = palabra;
    }
  }

  if (linea) lineas.push(linea);
  return lineas;
}

type Casilla = { label: string; marcado: boolean };
type Celda = { etiqueta: string; valor: string; peso?: number };
/** `nota` es lo que se lee dentro del recuadro cuando no hay firma. */
type CeldaFirma = { firma: PDFImage | null; nota: string };
type EstiloTexto = {
  size?: number;
  negrita?: boolean;
  color?: RGB;
  x?: number;
  ancho?: number;
  interlineado?: number;
  centrado?: boolean;
};

/** Casillas de un catalogo, marcando las elegidas y agregando el texto de "Otro:". */
function marcar<T extends string>(
  opciones: readonly { value: T; label: string }[],
  seleccion: readonly string[],
  detalle: Partial<Record<T, string>> = {}
): Casilla[] {
  return opciones.map((o) => {
    const marcado = seleccion.includes(o.value);
    const extra = marcado ? detalle[o.value] : undefined;
    return { label: extra ? `${o.label} ${extra}` : o.label, marcado };
  });
}

export async function buildConsentimientoCuidadorPdf(input: {
  datos: DatosCuidador;
  firmas: FirmasCuidador;
  profesionalNombre: string;
  now: Date;
}): Promise<Uint8Array> {
  const { datos: d, firmas } = input;
  const E = ETIQUETAS_CUIDADOR;
  const F = FIRMAS_CUIDADOR;

  const pdfDoc = await PDFDocument.create();
  pdfDoc.setTitle(TITULO_CUIDADOR);
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const limpiar = crearSaneador(font);

  const firmaPaciente = firmas.paciente ? await pdfDoc.embedPng(firmas.paciente) : null;
  const firmaRepresentante = firmas.representante ? await pdfDoc.embedPng(firmas.representante) : null;
  const firmaProfesional = await pdfDoc.embedPng(firmas.profesional);

  // La fecha y la hora las pone el sistema, en hora de Colombia.
  const hoy = getBogotaDateKey(input.now);
  const fecha = formatearFechaCuidador(hoy);
  const hora = horaBogotaFormatter.format(input.now);

  const otorgaTercero = d.otorgante !== "PACIENTE";
  const docPaciente = formatearDocumentoCuidador(d.pacienteTipoDocumento, d.pacienteTipoDocumentoOtro, d.cedula);
  const docRepresentante = formatearDocumentoCuidador(d.repTipoDocumento, d.repTipoDocumentoOtro, d.repDocumento);

  let page = pdfDoc.addPage([PAGE_W, PAGE_H]);
  let y = Y_INICIO;

  const nuevaPagina = () => {
    page = pdfDoc.addPage([PAGE_W, PAGE_H]);
    y = Y_INICIO;
  };

  // Mientras se mide un bloque (ver mantenerJuntos) solo avanza `y`: no se
  // pinta nada ni se pasa de hoja.
  let midiendo = false;

  const drawText: PDFPage["drawText"] = (texto, opciones) => {
    if (!midiendo) page.drawText(texto, opciones);
  };
  const drawLine: PDFPage["drawLine"] = (opciones) => {
    if (!midiendo) page.drawLine(opciones);
  };
  const drawRectangle: PDFPage["drawRectangle"] = (opciones) => {
    if (!midiendo) page.drawRectangle(opciones);
  };
  const drawImage: PDFPage["drawImage"] = (imagen, opciones) => {
    if (!midiendo) page.drawImage(imagen, opciones);
  };

  /**
   * Pasa a la hoja siguiente si no cabe un elemento de ese alto. Desde el
   * inicio de una hoja no se salta: lo que no cabe ahi no cabe en ninguna.
   */
  const asegurar = (alto: number) => {
    if (!midiendo && y < Y_INICIO && y - alto < Y_FIN) nuevaPagina();
  };

  /**
   * Evita que un bloque quede partido entre dos hojas: primero lo recorre sin
   * pintar para saber cuanto mide y, si no cabe en lo que resta de la hoja
   * actual, lo pasa completo a la siguiente.
   */
  const mantenerJuntos = (dibujar: () => void) => {
    if (midiendo) {
      dibujar();
      return;
    }

    const yInicial = y;
    midiendo = true;
    dibujar();
    midiendo = false;
    const alto = yInicial - y;
    y = yInicial;

    asegurar(alto);
    dibujar();
  };

  const lineasDe = (texto: string, f: PDFFont, size: number, ancho: number) =>
    partirEnLineas(f, limpiar(texto), size, ancho);

  const escribir = (texto: string, estilo: EstiloTexto = {}) => {
    const size = estilo.size ?? TAM;
    const f = estilo.negrita ? bold : font;
    const x = estilo.x ?? MARGEN_X;
    const ancho = estilo.ancho ?? PAGE_W - MARGEN_X - x;
    const lh = estilo.interlineado ?? size * 1.38;

    for (const linea of lineasDe(texto, f, size, ancho)) {
      asegurar(lh);
      const dx = estilo.centrado ? (ancho - f.widthOfTextAtSize(linea, size)) / 2 : 0;
      drawText(linea, { x: x + dx, y: y - size, size, font: f, color: estilo.color ?? NEGRO });
      y -= lh;
    }
  };

  const tituloSeccion = (texto: string) => {
    y -= 6;
    asegurar(22 + LH * 2); // el titulo no queda solo al final de la hoja
    escribir(texto, { negrita: true, size: 10.5, color: ROJO });
    drawLine({
      start: { x: MARGEN_X, y: y - 1 },
      end: { x: PAGE_W - MARGEN_X, y: y - 1 },
      thickness: 0.6,
      color: LINEA,
    });
    y -= 8;
  };

  const parrafo = (texto: string) => {
    // Un parrafo que anuncia una lista ("...podrá incluir:") no se separa de ella.
    if (texto.trim().endsWith(":")) asegurar(LH * (lineasDe(texto, font, TAM, ANCHO).length + 2));
    escribir(texto, { interlineado: LH });
    y -= 5;
  };

  const lista = (items: readonly string[]) => {
    const sangria = 16;
    for (const item of items) {
      lineasDe(item, font, TAM, ANCHO - sangria).forEach((linea, i) => {
        asegurar(LH);
        if (i === 0) drawText("•", { x: MARGEN_X + 5, y: y - TAM, size: TAM, font, color: NEGRO });
        drawText(linea, { x: MARGEN_X + sangria, y: y - TAM, size: TAM, font, color: NEGRO });
        y -= LH;
      });
      y -= 1.5;
    }
    y -= 4;
  };

  /** Campos diligenciados, uno junto al otro: rotulo pequeno, valor y linea. */
  const filaCampos = (celdas: (Celda | null)[]) => {
    const pesoTotal = celdas.reduce((suma, c) => suma + (c?.peso ?? 1), 0);
    const anchoUtil = ANCHO - GAP_COL * (celdas.length - 1);
    const columnas = celdas.map((c) => {
      const ancho = (anchoUtil * (c?.peso ?? 1)) / pesoTotal;
      return { celda: c, ancho, lineas: c ? lineasDe(c.valor || "-", font, TAM, ancho - 2) : [] };
    });

    const maxLineas = Math.max(1, ...columnas.map((c) => c.lineas.length));
    const alto = 11 + maxLineas * LH + 7;
    asegurar(alto);

    let x = MARGEN_X;
    for (const { celda, ancho, lineas } of columnas) {
      if (celda) {
        drawText(limpiar(celda.etiqueta), { x, y: y - 7.5, size: 7.5, font: bold, color: GRIS });
        lineas.forEach((linea, i) => {
          drawText(linea, { x, y: y - 11 - TAM - i * LH, size: TAM, font, color: NEGRO });
        });
        const yLinea = y - 11 - maxLineas * LH - 2;
        drawLine({ start: { x, y: yLinea }, end: { x: x + ancho, y: yLinea }, thickness: 0.5, color: LINEA });
      }
      x += ancho + GAP_COL;
    }
    y -= alto;
  };

  const dibujarCasilla = (x: number, yBase: number, marcado: boolean) => {
    const lado = 8.5;
    drawRectangle({ x, y: yBase - 1, width: lado, height: lado, borderWidth: 0.9, borderColor: NEGRO });
    if (!marcado) return;
    const a = { x: x + 1.7, y: yBase + 0.7 };
    const b = { x: x + lado - 1.7, y: yBase + lado - 2.7 };
    drawLine({ start: a, end: b, thickness: 1.4, color: NEGRO });
    drawLine({ start: { x: a.x, y: b.y }, end: { x: b.x, y: a.y }, thickness: 1.4, color: NEGRO });
  };

  /** Casillas del documento: se imprimen todas y la elegida queda marcada con X. */
  const casillas = (items: Casilla[], columnas: number) => {
    const anchoCelda = (ANCHO - GAP_COL * (columnas - 1)) / columnas;
    for (let i = 0; i < items.length; i += columnas) {
      const fila = items.slice(i, i + columnas).map((item) => ({
        ...item,
        lineas: lineasDe(item.label, item.marcado ? bold : font, TAM, anchoCelda - 15),
      }));
      const alto = Math.max(...fila.map((item) => item.lineas.length)) * LH + 3;
      asegurar(alto);

      fila.forEach((item, col) => {
        const x = MARGEN_X + col * (anchoCelda + GAP_COL);
        dibujarCasilla(x, y - TAM, item.marcado);
        item.lineas.forEach((linea, j) => {
          drawText(linea, {
            x: x + 15,
            y: y - TAM - j * LH,
            size: TAM,
            font: item.marcado ? bold : font,
            color: NEGRO,
          });
        });
      });
      y -= alto;
    }
    y -= 4;
  };

  /** Rotulo en negrita y, debajo, el texto libre que escribio el usuario. */
  const textoLibre = (etiqueta: string, valor: string) => {
    asegurar(LH * 2);
    escribir(etiqueta, { negrita: true, interlineado: LH });
    for (const renglon of valor.split(/\r?\n/).filter((r) => r.trim())) {
      escribir(renglon, { x: MARGEN_X + 10, interlineado: LH });
    }
    y -= 5;
  };

  const filaTitulos = (titulos: string[]) => {
    const anchoCelda = (ANCHO - GAP_COL * (titulos.length - 1)) / titulos.length;
    const columnas = titulos.map((t) => lineasDe(t, bold, TAM, anchoCelda));
    const alto = Math.max(...columnas.map((l) => l.length)) * LH + 2;
    asegurar(alto);
    columnas.forEach((lineas, col) => {
      const x = MARGEN_X + col * (anchoCelda + GAP_COL);
      lineas.forEach((linea, i) => {
        drawText(linea, { x, y: y - TAM - i * LH, size: TAM, font: bold, color: NEGRO });
      });
    });
    y -= alto;
  };

  /**
   * Recuadros de firma, siempre a dos columnas. La imagen se ajusta dentro del
   * recuadro conservando su proporcion, asi que no depende del tamano de la
   * pantalla en la que se firmo.
   */
  const filaFirmas = (celdas: (CeldaFirma | null)[]) => {
    const anchoCelda = (ANCHO - GAP_COL) / 2;
    asegurar(ALTO_CAJA_FIRMA + 24);
    const yCaja = y - ALTO_CAJA_FIRMA;

    celdas.forEach((celda, col) => {
      if (!celda) return;
      const x = MARGEN_X + col * (anchoCelda + GAP_COL);
      drawRectangle({
        x,
        y: yCaja,
        width: anchoCelda,
        height: ALTO_CAJA_FIRMA,
        borderWidth: 0.7,
        borderColor: LINEA,
      });

      if (celda.firma) {
        const escala = Math.min((anchoCelda - 14) / celda.firma.width, (ALTO_CAJA_FIRMA - 8) / celda.firma.height);
        const w = celda.firma.width * escala;
        const h = celda.firma.height * escala;
        drawImage(celda.firma, {
          x: x + (anchoCelda - w) / 2,
          y: yCaja + (ALTO_CAJA_FIRMA - h) / 2,
          width: w,
          height: h,
        });
      } else {
        const nota = limpiar(celda.nota);
        drawText(nota, {
          x: x + (anchoCelda - font.widthOfTextAtSize(nota, 8.5)) / 2,
          y: yCaja + ALTO_CAJA_FIRMA / 2 - 3,
          size: 8.5,
          font,
          color: GRIS,
        });
      }

      drawText("Firma", { x, y: yCaja - 11, size: 7.5, font: bold, color: GRIS });
      if (!celda.firma) return;
      // La fecha y la hora de la firma las pone el sistema.
      const momento = `Fecha: ${fecha}    Hora: ${hora}`;
      drawText(momento, {
        x: x + anchoCelda - font.widthOfTextAtSize(momento, 8.5),
        y: yCaja - 11,
        size: 8.5,
        font,
        color: NEGRO,
      });
    });
    y = yCaja - 24;
  };

  const camposDe = (grupo: CamposCuidador) => {
    switch (grupo) {
      case "paciente":
        filaCampos([{ etiqueta: E.pacienteNombre, valor: d.pacienteNombre }]);
        escribir(`${E.tipoDocumento}:`, { negrita: true, size: 7.5, color: GRIS });
        y -= 3;
        casillas(marcar(TIPOS_DOCUMENTO_CUIDADOR, [d.pacienteTipoDocumento], { OTRO: d.pacienteTipoDocumentoOtro }), 3);
        filaCampos([
          { etiqueta: E.numeroDocumento, valor: d.cedula },
          { etiqueta: E.fechaNacimiento, valor: formatearFechaCuidador(d.pacienteFechaNacimiento) },
          { etiqueta: E.edad, valor: calcularEdadCuidador(d.pacienteFechaNacimiento, hoy) },
        ]);
        filaCampos([{ etiqueta: E.direccionServicio, valor: d.direccionServicio }]);
        filaCampos([
          { etiqueta: E.municipio, valor: d.municipio },
          { etiqueta: E.telefonoContacto, valor: d.pacienteTelefono },
        ]);
        filaCampos([{ etiqueta: E.diagnostico, valor: d.diagnostico }]);
        break;

      case "otorgante":
        casillas(marcar(OTORGANTES_CUIDADOR, [d.otorgante], { OTRA_PERSONA: d.otorganteOtro }), 1);
        // Si otorga el paciente, sus datos se repiten aqui sin volver a pedirlos.
        filaCampos([
          { etiqueta: E.repNombre, valor: otorgaTercero ? d.repNombre : d.pacienteNombre },
          { etiqueta: E.repId, valor: otorgaTercero ? docRepresentante : docPaciente },
        ]);
        filaCampos([
          { etiqueta: E.repParentesco, valor: otorgaTercero ? d.repParentesco : `${NO_APLICA} (es el paciente)` },
          { etiqueta: E.repTelefono, valor: otorgaTercero ? d.repTelefono : d.pacienteTelefono },
        ]);
        y -= 3;
        asegurar(LH * 3);
        escribir(E.razonNoFirma, { interlineado: LH });
        y -= 3;
        casillas(marcar(RAZONES_NO_FIRMA_CUIDADOR, d.razonesNoFirma, { OTRA: d.razonNoFirmaOtra }), 2);
        break;

      case "servicio":
        casillas(marcar(TURNOS_CUIDADOR, [d.turno]), 4);
        filaCampos([
          { etiqueta: E.horarioProgramado, valor: d.horarioProgramado },
          { etiqueta: E.fechaInicio, valor: formatearFechaCuidador(d.fechaInicioServicio) },
        ]);
        break;

      case "declaracionesDatos":
        casillas(marcar(DECLARACIONES_DATOS_CUIDADOR, d.declaracionesDatos), 1);
        break;

      case "registroClinico":
        casillas(marcar(SI_NO_CUIDADOR, [d.autorizaRegistroClinico]), 4);
        break;

      case "camaras":
        casillas(marcar(CAMARAS_CUIDADOR, [d.camaras]), 1);
        textoLibre(E.camarasUbicacion, d.camaras === "SI" ? d.camarasUbicacion : `${NO_APLICA}.`);
        break;

      case "preguntas":
        textoLibre(E.preguntas, d.preguntasRespuestas || "No se registraron.");
        break;

      case "aceptacion":
        casillas(marcar(DECISIONES_CUIDADOR, [d.decision]), 1);
        if (d.decision === "ACEPTO_CON_OBSERVACIONES") {
          for (const renglon of d.observacionesAceptacion.split(/\r?\n/).filter((r) => r.trim())) {
            escribir(renglon, { x: MARGEN_X + 15, interlineado: LH });
          }
          y -= 5;
        }
        break;

      case "motivoNegativa":
        textoLibre(E.motivoNegativa, d.decision === "NO_ACEPTO" ? d.motivoNegativa : `${NO_APLICA}.`);
        break;
    }
  };

  // ===== Titulo =====
  escribir(TITULO_CUIDADOR, {
    negrita: true,
    size: 12,
    interlineado: 16,
    centrado: true,
    x: MARGEN_X + 30,
    ancho: ANCHO - 60,
  });
  y -= 8;

  const dibujarSeccion = (seccion: SeccionCuidador) => {
    tituloSeccion(seccion.titulo);
    for (const bloque of seccion.bloques) {
      if (bloque.tipo === "parrafo") parrafo(bloque.texto);
      else if (bloque.tipo === "lista") lista(bloque.items);
      else if (bloque.tipo === "campos") camposDe(bloque.campos);
      else {
        y -= 2;
        asegurar(LH * 3);
        escribir(bloque.texto, { negrita: true, interlineado: LH });
        y -= 4;
      }
    }
  };

  const dibujarFirmas = () => {
    // Paciente y representante, lado a lado.
    mantenerJuntos(() => {
      tituloSeccion(F.titulo);
      filaTitulos([F.paciente, F.representante]);
      filaCampos([
        { etiqueta: F.nombre, valor: d.pacienteNombre },
        { etiqueta: F.nombre, valor: otorgaTercero ? d.repNombre : NO_APLICA },
      ]);
      filaCampos([
        { etiqueta: F.documento, valor: docPaciente },
        { etiqueta: F.documento, valor: otorgaTercero ? docRepresentante : NO_APLICA },
      ]);
      filaCampos([null, { etiqueta: F.parentesco, valor: otorgaTercero ? d.repParentesco : NO_APLICA }]);
      y -= 4;
      filaFirmas([
        { firma: firmaPaciente, nota: "Sin firma del paciente (ver numeral 2)" },
        { firma: firmaRepresentante, nota: NO_APLICA },
      ]);
    });

    mantenerJuntos(() => {
      y -= 4;
      filaTitulos([F.profesional]);
      filaCampos([
        { etiqueta: F.nombre, valor: input.profesionalNombre, peso: 1.25 },
        { etiqueta: F.cargo, valor: d.profesionalCargo },
        { etiqueta: F.registroProfesional, valor: d.profesionalRegistro || NO_APLICA, peso: 1.35 },
      ]);
      y -= 2;
      escribir(F.declaracionProfesional, { size: 9, interlineado: 12.5 });
      y -= 6;
      filaFirmas([{ firma: firmaProfesional, nota: "" }, null]);
    });
  };

  // ===== Numerales =====
  SECCIONES_CUIDADOR.filter((seccion) => !seccion.conFirmas).forEach(dibujarSeccion);

  // ===== Declaracion final y firmas: en la misma hoja siempre que quepan =====
  mantenerJuntos(() => {
    SECCIONES_CUIDADOR.filter((seccion) => seccion.conFirmas).forEach(dibujarSeccion);
    dibujarFirmas();
  });

  // ===== Encabezado y pie de cada hoja =====
  let logo: PDFImage | null = null;
  try {
    logo = await pdfDoc.embedPng(await fs.readFile(path.join(process.cwd(), "public", "login", "logo.png")));
  } catch {
    logo = null;
  }

  const paginas = pdfDoc.getPages();
  const encabezado = [
    "Consentimiento informado · Auxiliar de Enfermería por Turnos",
    limpiar(`Paciente: ${docPaciente} · Diligenciado: ${fecha} ${hora}`),
  ];

  paginas.forEach((p, i) => {
    const derecha = (texto: string, yTexto: number, f: PDFFont) => {
      p.drawText(texto, {
        x: PAGE_W - MARGEN_X - f.widthOfTextAtSize(texto, 7.5),
        y: yTexto,
        size: 7.5,
        font: f,
        color: GRIS,
      });
    };

    if (logo) {
      const altoLogo = 34;
      const anchoLogo = (logo.width / logo.height) * altoLogo;
      p.drawImage(logo, { x: MARGEN_X, y: PAGE_H - 22 - altoLogo, width: anchoLogo, height: altoLogo });
    } else {
      p.drawText("Especialistas en Casa", { x: MARGEN_X, y: PAGE_H - 46, size: 14, font: bold, color: ROJO });
    }
    derecha(encabezado[0], PAGE_H - 38, bold);
    derecha(encabezado[1], PAGE_H - 49, font);
    p.drawLine({
      start: { x: MARGEN_X, y: PAGE_H - 64 },
      end: { x: PAGE_W - MARGEN_X, y: PAGE_H - 64 },
      thickness: 0.6,
      color: LINEA,
    });

    p.drawLine({
      start: { x: MARGEN_X, y: 52 },
      end: { x: PAGE_W - MARGEN_X, y: 52 },
      thickness: 0.6,
      color: LINEA,
    });
    PIE_CUIDADOR.forEach((linea, j) => {
      p.drawText(linea, {
        x: (PAGE_W - font.widthOfTextAtSize(linea, 7.5)) / 2,
        y: 40 - j * 10,
        size: 7.5,
        font,
        color: GRIS,
      });
    });
    derecha(`Página ${i + 1} de ${paginas.length}`, 40, font);
  });

  return pdfDoc.save();
}
