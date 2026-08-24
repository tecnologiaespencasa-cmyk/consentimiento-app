/**
 * Catalogos clinicos de la Clinica de Heridas.
 *
 * Es la unica definicion de las opciones validas: la usan el formulario (para
 * pintar los desplegables) y el endpoint (para validar lo que llega). Al estar
 * en un solo sitio no pueden desincronizarse, y el servidor nunca confia en
 * que el navegador haya respetado la lista.
 *
 * Las opciones se guardan tal cual en Neon, en columnas de texto. No son enums
 * de PostgreSQL a proposito: asi ampliar o corregir un catalogo es editar este
 * archivo, sin migracion de base de datos. La integridad la garantiza la
 * validacion del servidor.
 */

export const ORIGEN = [
  "QUIRÚRGICA",
  "LESIÓN POR PRESIÓN (LPP)",
  "VASCULAR – VENOSA",
  "VASCULAR – ARTERIAL",
  "VASCULAR – MIXTA",
  "PIE DIABÉTICO",
  "FÍSTULA",
  "ABSCESO",
  "OSTEOMIELITIS",
  "QUEMADURA",
  "DERMATITIS",
  "OSTOMÍA / ESTOMA",
  "DISPOSITIVO VASCULAR (PICC)",
  "TRAUMÁTICA / NO ESPECIFICADA",
] as const;

export const UBICACION = [
  "CABEZA / CUELLO",
  "TÓRAX",
  "ABDOMEN",
  "ESPALDA / SACRO / GLÚTEOS",
  "MIEMBRO SUPERIOR IZQUIERDO",
  "MIEMBRO SUPERIOR DERECHO",
  "MANO IZQUIERDA",
  "MANO DERECHA",
  "MIEMBRO INFERIOR IZQUIERDO",
  "MIEMBRO INFERIOR DERECHO",
  "PIE / TALÓN IZQUIERDO",
  "PIE / TALÓN DERECHO",
  "GENITAL",
] as const;

export const FONDO = ["LIMPIO", "CONTAMINADO / COLONIZADO", "INFECTADO", "SUCIO"] as const;

export const LECHO = ["VIABLE", "PÁLIDO", "CIANÓTICO", "ISQUÉMICO"] as const;

export const TEJIDO = [
  "GRANULACIÓN",
  "EPITELIZACIÓN",
  "ESFACELO",
  "NECROSIS SECA",
  "NECROSIS HÚMEDA",
] as const;

export const CAVITACION_TUNELIZACION = [
  "NO PRESENTA",
  "CAVITACIÓN",
  "TUNELIZACIÓN",
  "CAVITACIÓN Y TUNELIZACIÓN",
] as const;

export const PIEL_PERILESIONAL = [
  "SANA / ÍNTEGRA",
  "ERITEMATOSA",
  "DESCAMATIVA",
  "MACERADA",
  "INDURADA",
  "CON HEMATOMA",
] as const;

export const EXUDADO_CANTIDAD = ["NULO", "ESCASO", "MODERADO", "ABUNDANTE"] as const;

export const EXUDADO_CARACTERISTICAS = [
  "SEROSO",
  "SEROHEMÁTICO",
  "SEROPURULENTO",
  "PURULENTO",
  "HEMÁTICO",
] as const;

/** Catalogo de cada campo de texto del seguimiento, indexado por su clave. */
export const CATALOGOS = {
  origen: ORIGEN,
  ubicacion: UBICACION,
  fondo: FONDO,
  lecho: LECHO,
  tejido: TEJIDO,
  cavitacionTunelizacion: CAVITACION_TUNELIZACION,
  pielPerilesional: PIEL_PERILESIONAL,
  exudadoCantidad: EXUDADO_CANTIDAD,
  exudadoCaracteristicas: EXUDADO_CARACTERISTICAS,
} as const;

export type CampoCatalogo = keyof typeof CATALOGOS;

export const CAMPOS_CATALOGO = Object.keys(CATALOGOS) as CampoCatalogo[];

/**
 * Comprueba que un valor pertenece al catalogo del campo.
 *
 * La comparacion es exacta contra la opcion almacenada: el formulario solo
 * puede enviar valores de la lista, y cualquier otra cosa se rechaza.
 */
export function esOpcionValida(campo: CampoCatalogo, valor: unknown): boolean {
  if (typeof valor !== "string") return false;
  return (CATALOGOS[campo] as readonly string[]).includes(valor);
}
