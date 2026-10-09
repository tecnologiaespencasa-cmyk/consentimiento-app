/**
 * Reglas de validacion de los campos de los consentimientos (todos los formatos).
 *
 * Es la unica definicion de lo que admite cada campo: el formulario la aplica
 * mientras se escribe y los endpoints al guardar, asi el servidor nunca confia
 * en que el navegador haya validado.
 *
 * Todo lo que una regla admite se puede imprimir con las fuentes estandar del
 * PDF (juego WinAnsi). Por eso las letras son las latinas con tildes y no
 * "cualquier letra": un caracter fuera de ese juego hace fallar el armado del
 * PDF. Si se amplia una regla hay que conservar esa garantia.
 */

export type ReglaCampo = {
  /** Caracteres admitidos, como clase de expresion regular. */
  permitidos: string;
  min: number;
  max: number;
  /** Solo digitos: teclado numerico y se descarta cualquier otra tecla. */
  numerico?: boolean;
  /** Largos exactos validos, cuando no sirve cualquiera entre min y max. */
  largos?: readonly number[];
  /** Valor numerico mas alto admitido (edad). */
  valorMax?: number;
  /** Debe traer letras: evita campos llenos solo de numeros o signos. */
  conLetras?: boolean;
  /** Minimo de palabras (nombres y apellidos en un solo campo). */
  palabras?: number;
  /** Lo que se le dice al usuario cuando el valor no cumple. */
  ayuda: string;
};

// Letras latinas, con tildes, dieresis y eñe.
const LETRAS = "A-Za-z\\u00C0-\\u00D6\\u00D8-\\u00F6\\u00F8-\\u00FF";

// Todo lo que imprime el PDF: ASCII visible, Latin-1 y los signos tipograficos de
// WinAnsi (comillas curvas, rayas, puntos suspensivos, euro...).
const IMPRIMIBLES =
  "\\x20-\\x7E\\u00A1-\\u00FF\\u20AC\\u201A\\u0192\\u201E\\u2026\\u2020\\u2021\\u02C6\\u2030\\u0160\\u2039\\u0152" +
  "\\u017D\\u2018\\u2019\\u201C\\u201D\\u2022\\u2013\\u2014\\u02DC\\u2122\\u0161\\u203A\\u0153\\u017E\\u0178";

/** Texto libre de varias lineas: cualquier caracter imprimible, con algo de letras. */
const textoLibre = (max: number): ReglaCampo => ({
  permitidos: `${IMPRIMIBLES}\\n\\r`,
  min: 3,
  max,
  conLetras: true,
  ayuda: "Escribe un texto con letras, sin emojis ni símbolos especiales",
});

const documentoNumerico = (min: number, max: number): ReglaCampo => ({
  permitidos: "0-9",
  numerico: true,
  min,
  max,
  ayuda: `Solo números, entre ${min} y ${max} dígitos`,
});

const documentoAlfanumerico = (min: number, max: number): ReglaCampo => ({
  permitidos: "A-Za-z0-9",
  min,
  max,
  ayuda: `Solo letras y números, entre ${min} y ${max} caracteres, sin espacios ni signos`,
});

export const EDAD_MAXIMA = 120;

export const REGLAS = {
  // Nombres y apellidos en un solo campo
  nombreCompleto: {
    permitidos: `${LETRAS} .'-`,
    min: 5,
    max: 100,
    conLetras: true,
    palabras: 2,
    ayuda: "Escribe nombres y apellidos, solo con letras",
  },
  apellido: { permitidos: `${LETRAS} .'-`, min: 2, max: 40, conLetras: true, ayuda: "Solo letras" },
  nombres: { permitidos: `${LETRAS} .'-`, min: 2, max: 60, conLetras: true, ayuda: "Solo letras" },
  // Numero de documento cuando el formato no pide el tipo. Va en el nombre del
  // archivo de SharePoint: nunca admite signos.
  documento: documentoAlfanumerico(4, 20),
  edad: {
    permitidos: "0-9",
    numerico: true,
    min: 1,
    max: 3,
    valorMax: EDAD_MAXIMA,
    ayuda: `Solo números, de 0 a ${EDAD_MAXIMA}`,
  },
  // Plan de numeracion de Colombia: celulares y fijos nacionales tienen 10 digitos.
  telefono: {
    permitidos: "0-9",
    numerico: true,
    min: 7,
    max: 10,
    largos: [7, 10],
    ayuda: "Solo números: 10 dígitos (o 7 si es un fijo local)",
  },
  municipio: { permitidos: `${LETRAS} .'-`, min: 3, max: 60, conLetras: true, ayuda: "Solo letras" },
  direccion: {
    permitidos: `${LETRAS}0-9 #.,°º/()-`,
    min: 5,
    max: 150,
    conLetras: true,
    ayuda: "Solo letras, números y los signos # - . , / ( )",
  },
  diagnostico: {
    permitidos: `${LETRAS}0-9 .,;:()/+%-`,
    min: 3,
    max: 300,
    conLetras: true,
    ayuda: "Solo letras, números y signos de puntuación",
  },
  // En el formato de enfermeria el diagnostico se imprime en un solo renglon.
  diagnosticoRenglon: {
    permitidos: `${LETRAS}0-9 .,;:()/+%-`,
    min: 3,
    max: 90,
    conLetras: true,
    ayuda: "Solo letras, números y signos de puntuación",
  },
  parentesco: { permitidos: `${LETRAS} .()/-`, min: 3, max: 60, conLetras: true, ayuda: "Solo letras" },
  horario: {
    permitidos: `${LETRAS}0-9 :.,/-`,
    min: 3,
    max: 80,
    ayuda: "Solo letras, números y los signos : . , / -",
  },
  tipoDocumentoOtro: { permitidos: `${LETRAS} .-`, min: 2, max: 40, conLetras: true, ayuda: "Solo letras" },
  // Aclaraciones cortas: "otra persona", "otra razon", "otro procedimiento"
  aclaracion: {
    permitidos: `${LETRAS}0-9 .,()/-`,
    min: 3,
    max: 80,
    conLetras: true,
    ayuda: "Solo letras, números y signos de puntuación",
  },
  cargo: { permitidos: `${LETRAS} .,()/-`, min: 3, max: 80, conLetras: true, ayuda: "Solo letras" },
  registroProfesional: {
    permitidos: `${LETRAS}0-9 .-`,
    min: 3,
    max: 30,
    ayuda: "Solo letras, números, puntos y guiones",
  },
  textoMedio: textoLibre(300),
  // Riesgos y observaciones del alta voluntaria: el formato tiene 7 renglones para cada uno.
  textoRecuadro: textoLibre(500),
  textoLargo: textoLibre(1500),
} satisfies Record<string, ReglaCampo>;

const REGLAS_DOCUMENTO: Record<string, ReglaCampo> = {
  CC: documentoNumerico(4, 10),
  TI: documentoNumerico(10, 11),
  RC: documentoNumerico(6, 11),
  CE: documentoNumerico(4, 10),
  PA: documentoAlfanumerico(5, 15),
  OTRO: REGLAS.documento,
};

/** Regla del numero de documento segun su tipo. Sin tipo (o desconocido) aplica la mas amplia. */
export function reglaDocumento(tipo: string): ReglaCampo {
  return REGLAS_DOCUMENTO[tipo] ?? REGLAS.documento;
}

/**
 * Deja el texto como se va a guardar: tildes en un solo caracter (los teclados
 * moviles a veces las mandan separadas), espacios normales y sin invisibles.
 */
export function normalizarCampo(valor: string): string {
  return valor
    .normalize("NFC")
    .replace(/[​-‍﻿]/g, "")
    .replace(/[\t  -   　]/g, " ")
    .trim();
}

/** Caracteres del valor que la regla no admite, sin repetir. */
export function caracteresNoPermitidos(regla: ReglaCampo, valor: string): string[] {
  return [...new Set(normalizarCampo(valor).match(new RegExp(`[^${regla.permitidos}]`, "gu")) ?? [])];
}

/** Lo que queda del valor al escribir: en campos numericos, solo digitos hasta el maximo. */
export function limpiarCampo(regla: ReglaCampo, valor: string): string {
  return regla.numerico ? valor.replace(/\D/g, "").slice(0, regla.max) : valor;
}

/**
 * Revisa un valor contra su regla. Devuelve el mensaje para el usuario, o ""
 * si es valido. Un valor vacio siempre pasa: si el campo es obligatorio lo
 * decide quien llama.
 */
export function validarCampo(regla: ReglaCampo, valor: string): string {
  const texto = normalizarCampo(valor);
  if (!texto) return "";

  const noPermitidos = caracteresNoPermitidos(regla, texto);
  if (noPermitidos.length > 0) {
    const lista = noPermitidos.slice(0, 5).map((c) => (c.trim() ? c : "espacios"));
    return `${regla.ayuda}. No se permite: ${lista.join(" ")}`;
  }

  const largoValido = regla.largos
    ? regla.largos.includes(texto.length)
    : texto.length >= regla.min && texto.length <= regla.max;
  if (!largoValido) {
    if (regla.largos || regla.numerico) return regla.ayuda;
    return texto.length < regla.min
      ? `Muy corto: escribe al menos ${regla.min} caracteres`
      : `Muy largo: máximo ${regla.max} caracteres`;
  }

  if (regla.valorMax !== undefined && Number(texto) > regla.valorMax) return regla.ayuda;
  if (regla.conLetras && !/[A-Za-zÀ-ÿ]/.test(texto)) return regla.ayuda;
  if (regla.palabras && texto.split(/\s+/).length < regla.palabras) return regla.ayuda;
  return "";
}

// ===========================
// Fechas (YYYY-MM-DD)
// ===========================

/** True si es YYYY-MM-DD y existe en el calendario (descarta 2026-02-31). */
export function esFechaReal(fecha: string): boolean {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(fecha);
  if (!m) return false;
  const real = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  return real.toISOString().slice(0, 10) === fecha;
}

/** Corre una fecha esa cantidad de años (el 29 de febrero pasa a 28 si hace falta). */
export function moverAnios(fecha: string, anios: number): string {
  const [anio, mes, dia] = fecha.split("-");
  const destino = `${String(Number(anio) + anios).padStart(4, "0")}-${mes}`;
  return esFechaReal(`${destino}-${dia}`) ? `${destino}-${dia}` : `${destino}-28`;
}

// Un consentimiento adjunto puede ser de hace años, pero no de hace siglos ni del futuro.
const ANIOS_ATRAS_ADJUNTO = 10;

/** Fechas admitidas para un consentimiento ya diligenciado que se adjunta. `hoy` en YYYY-MM-DD. */
export function rangoFechaAdjunto(hoy: string) {
  return { min: moverAnios(hoy, -ANIOS_ATRAS_ADJUNTO), max: hoy };
}

/**
 * Mensaje de error de la fecha y hora de un consentimiento adjunto
 * (YYYY-MM-DDTHH:mm, como la entrega el navegador), o "" si es valida.
 */
export function validarFechaHoraAdjunto(fechaHora: string, hoy: string): string {
  const m = /^(\d{4}-\d{2}-\d{2})T([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/.exec(fechaHora);
  if (!m || !esFechaReal(m[1])) return "Fecha y hora inválidas";

  const { min, max } = rangoFechaAdjunto(hoy);
  if (m[1] > max) return "La fecha no puede ser posterior a hoy";
  if (m[1] < min) return `Revisa el año: la fecha no puede tener más de ${ANIOS_ATRAS_ADJUNTO} años`;
  return "";
}

// ===========================
// Firmas
// ===========================

// Un PNG en base64 siempre empieza asi (sus 8 bytes de cabecera).
const PREFIJO_FIRMA_PNG = "data:image/png;base64,iVBORw0KGgo";
const MAX_FIRMA_CARACTERES = 3_000_000;

/** True si el valor es una imagen PNG en data URL, como la que produce el recuadro de firma. */
export function esFirmaPng(dataUrl: string): boolean {
  return dataUrl.startsWith(PREFIJO_FIRMA_PNG) && dataUrl.length <= MAX_FIRMA_CARACTERES;
}
