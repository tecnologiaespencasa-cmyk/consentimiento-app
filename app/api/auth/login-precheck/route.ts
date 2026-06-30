import { NextResponse } from "next/server";
import { z } from "zod";
import { evaluateLoginThrottle, getClientIp } from "@/lib/loginSecurity";

/**
 * Endpoint ASESOR (no autoritativo) para la UI del login: indica si debe
 * mostrarse el CAPTCHA o si el acceso esta temporalmente bloqueado, de modo
 * que el formulario pueda dar feedback claro.
 *
 * El enforcement real vive en `authorize` (lib/authOptions.ts); este endpoint
 * solo mejora la experiencia y nunca verifica credenciales.
 */

const schema = z.object({
  username: z
    .string()
    .trim()
    .toLowerCase()
    .min(1)
    .max(50)
    .regex(/^[a-z0-9._-]+$/)
    .optional()
    .or(z.literal("")),
});

export async function POST(req: Request) {
  const ip = getClientIp(req.headers);

  let username = "";
  try {
    const body = await req.json();
    const parsed = schema.safeParse(body ?? {});
    if (parsed.success && parsed.data.username) username = parsed.data.username;
  } catch {
    // cuerpo invalido -> se evalua solo por IP
  }

  const decision = await evaluateLoginThrottle({ username, ip });

  return NextResponse.json({
    captchaRequired: decision.captchaRequired,
    blocked: decision.blocked,
    retryAfterSeconds: decision.retryAfterSeconds,
  });
}
