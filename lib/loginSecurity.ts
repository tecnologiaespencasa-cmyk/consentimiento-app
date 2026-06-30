import { prisma } from "@/lib/prisma";

/**
 * Proteccion contra fuerza bruta / credential stuffing en el login.
 *
 * No hay Redis disponible en este despliegue (solo PostgreSQL/Neon), por lo que
 * el estado de los intentos y el bloqueo temporal progresivo se calculan a
 * partir de la tabla de auditoria `LoginAttempt`.
 *
 * Politica:
 *  - Ventana deslizante de 15 min para contar fallos.
 *  - Por usuario: 5 fallos -> bloqueo 3 min; 10 fallos -> bloqueo 15 min.
 *  - Por IP (mas laxa, para no dejar fuera oficinas tras NAT compartido):
 *    15 fallos -> 3 min; 30 fallos -> 15 min.
 *  - CAPTCHA exigido tras 5 fallos del usuario o 10 fallos de la IP.
 *  - El bloqueo es SIEMPRE temporal (nunca permanente) para que no pueda
 *    usarse como vector de denegacion de servicio contra cuentas legitimas.
 */

const WINDOW_MS = 15 * 60 * 1000;

const USER_CAPTCHA_THRESHOLD = 5;
const USER_TIER1_THRESHOLD = 5;
const USER_TIER1_LOCK_SECONDS = 3 * 60;
const USER_TIER2_THRESHOLD = 10;
const USER_TIER2_LOCK_SECONDS = 15 * 60;

const IP_CAPTCHA_THRESHOLD = 10;
const IP_TIER1_THRESHOLD = 15;
const IP_TIER1_LOCK_SECONDS = 3 * 60;
const IP_TIER2_THRESHOLD = 30;
const IP_TIER2_LOCK_SECONDS = 15 * 60;

export type ThrottleDecision = {
  blocked: boolean;
  retryAfterSeconds: number;
  captchaRequired: boolean;
};

type AttemptRow = { success: boolean; createdAt: Date };

/**
 * Extrae la IP real del cliente a partir de las cabeceras del proxy.
 * Acepta un objeto plano de cabeceras (NextAuth `authorize`) o un `Headers`.
 */
export function getClientIp(
  headers: Record<string, string | string[] | undefined> | Headers | undefined
): string {
  const get = (name: string): string | undefined => {
    if (!headers) return undefined;
    if (typeof (headers as Headers).get === "function") {
      return (headers as Headers).get(name) ?? undefined;
    }
    const raw = (headers as Record<string, string | string[] | undefined>)[name];
    return Array.isArray(raw) ? raw[0] : raw;
  };

  const forwarded = get("x-forwarded-for");
  if (forwarded) {
    // Toma la primera IP de la cadena "client, proxy1, proxy2".
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }

  return get("x-real-ip") || "unknown";
}

/**
 * Cuenta fallos dentro de la ventana, reiniciando el conteo tras el ultimo
 * login exitoso. Devuelve tambien el timestamp del fallo mas reciente.
 */
function summarize(attempts: AttemptRow[]): { failures: number; lastFailAt: Date | null } {
  // attempts vienen ordenados por createdAt descendente.
  let failures = 0;
  let lastFailAt: Date | null = null;
  for (const a of attempts) {
    if (a.success) break; // un exito reciente reinicia el contador
    failures += 1;
    if (!lastFailAt) lastFailAt = a.createdAt;
  }
  return { failures, lastFailAt };
}

function lockRemainingSeconds(
  failures: number,
  lastFailAt: Date | null,
  tier1Count: number,
  tier1Lock: number,
  tier2Count: number,
  tier2Lock: number
): number {
  if (!lastFailAt) return 0;
  let lockSeconds = 0;
  if (failures >= tier2Count) lockSeconds = tier2Lock;
  else if (failures >= tier1Count) lockSeconds = tier1Lock;
  if (lockSeconds === 0) return 0;

  const elapsed = (Date.now() - lastFailAt.getTime()) / 1000;
  const remaining = Math.ceil(lockSeconds - elapsed);
  return remaining > 0 ? remaining : 0;
}

export async function evaluateLoginThrottle(params: {
  username: string;
  ip: string;
}): Promise<ThrottleDecision> {
  const windowStart = new Date(Date.now() - WINDOW_MS);

  const [userAttempts, ipAttempts] = await Promise.all([
    params.username
      ? prisma.loginAttempt.findMany({
          where: { username: params.username, createdAt: { gte: windowStart } },
          orderBy: { createdAt: "desc" },
          select: { success: true, createdAt: true },
        })
      : Promise.resolve([] as AttemptRow[]),
    params.ip && params.ip !== "unknown"
      ? prisma.loginAttempt.findMany({
          where: { ip: params.ip, createdAt: { gte: windowStart } },
          orderBy: { createdAt: "desc" },
          select: { success: true, createdAt: true },
        })
      : Promise.resolve([] as AttemptRow[]),
  ]);

  const userState = summarize(userAttempts);
  const ipState = summarize(ipAttempts);

  const userLock = lockRemainingSeconds(
    userState.failures,
    userState.lastFailAt,
    USER_TIER1_THRESHOLD,
    USER_TIER1_LOCK_SECONDS,
    USER_TIER2_THRESHOLD,
    USER_TIER2_LOCK_SECONDS
  );
  const ipLock = lockRemainingSeconds(
    ipState.failures,
    ipState.lastFailAt,
    IP_TIER1_THRESHOLD,
    IP_TIER1_LOCK_SECONDS,
    IP_TIER2_THRESHOLD,
    IP_TIER2_LOCK_SECONDS
  );

  const retryAfterSeconds = Math.max(userLock, ipLock);

  const captchaRequired =
    isCaptchaConfigured() &&
    (userState.failures >= USER_CAPTCHA_THRESHOLD ||
      ipState.failures >= IP_CAPTCHA_THRESHOLD);

  return {
    blocked: retryAfterSeconds > 0,
    retryAfterSeconds,
    captchaRequired,
  };
}

export async function recordLoginAttempt(params: {
  username: string;
  ip: string;
  userAgent?: string | null;
  success: boolean;
}): Promise<void> {
  try {
    await prisma.loginAttempt.create({
      data: {
        username: params.username.slice(0, 200),
        ip: params.ip.slice(0, 100),
        userAgent: params.userAgent ? params.userAgent.slice(0, 400) : null,
        success: params.success,
      },
    });
  } catch (err) {
    // La auditoria nunca debe romper el flujo de login.
    console.error("No se pudo registrar el intento de login:", err);
  }
}

export function isCaptchaConfigured(): boolean {
  return Boolean(process.env.RECAPTCHA_SECRET_KEY);
}

/**
 * Verifica el token de reCAPTCHA contra Google. Si la verificacion no esta
 * configurada (sin secret), se considera superada para no bloquear el acceso.
 */
export async function verifyRecaptcha(
  token: string | undefined,
  ip: string
): Promise<boolean> {
  const secret = process.env.RECAPTCHA_SECRET_KEY;
  if (!secret) return true; // feature deshabilitada
  if (!token) return false;

  try {
    const body = new URLSearchParams({ secret, response: token });
    if (ip && ip !== "unknown") body.set("remoteip", ip);

    const res = await fetch("https://www.google.com/recaptcha/api/siteverify", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });
    const data = (await res.json()) as { success?: boolean };
    return data.success === true;
  } catch (err) {
    console.error("Error verificando reCAPTCHA:", err);
    return false;
  }
}
