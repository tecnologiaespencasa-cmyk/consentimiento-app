/**
 * Fuente unica de verdad de los roles con acceso al modulo Clinica de Heridas.
 *
 * Se centraliza aqui para que la guarda del middleware, la de la pagina server
 * component y la de cada API route no puedan divergir.
 */

/**
 * Roles autorizados a ver y usar el modulo Clinica de Heridas.
 *
 * CLINICA_HERIDAS es el perfil asistencial del modulo; ADMINISTRATIVO y TECNICO
 * lo acompañan porque ya administran el resto del portal.
 */
export const ROLES_CLINICA_HERIDAS = ["CLINICA_HERIDAS", "ADMINISTRATIVO", "TECNICO"] as const;

/**
 * Roles que comparten los accesos del perfil Especialista (consentimientos
 * propios, novedades propias, terapias ambulatorias). CLINICA_HERIDAS los
 * hereda ademas de su modulo propio.
 */
export const ROLES_TIPO_ESPECIALISTA = ["ESPECIALISTA", "MEDICO_RONDA", "CLINICA_HERIDAS"] as const;

export function tieneAccesoClinicaHeridas(rol: unknown): boolean {
  return ROLES_CLINICA_HERIDAS.includes(String(rol) as (typeof ROLES_CLINICA_HERIDAS)[number]);
}

export function esPerfilTipoEspecialista(rol: unknown): boolean {
  return ROLES_TIPO_ESPECIALISTA.includes(String(rol) as (typeof ROLES_TIPO_ESPECIALISTA)[number]);
}
