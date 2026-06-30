import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import * as bcrypt from "bcrypt";
import { prisma } from "@/lib/prisma";
import { loginSchema } from "@/lib/validation";
import {
  evaluateLoginThrottle,
  getClientIp,
  recordLoginAttempt,
  verifyRecaptcha,
} from "@/lib/loginSecurity";

// Hash "señuelo" para igualar el tiempo de respuesta cuando el usuario no
// existe y mitigar la enumeracion de usuarios por temporizacion.
const DUMMY_HASH = "$2b$10$CwTycUXWue0Thq9StjUM0uJ8DvElsfAd1J3aD7sZ9Qz1pVqkr2pK";

export const authOptions: NextAuthOptions = {
  jwt: {
    maxAge: 60 * 60,
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.username = user.username;
        token.rol = user.rol;
        token.nombres = user.nombres;
        token.primerApellido = user.primerApellido;
        token.segundoApellido = user.segundoApellido;
        token.email = user.email;
        token.telefono = user.telefono;
        token.cedula = user.cedula;
        token.profesion = user.profesion;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id;
        session.user.username = token.username;
        session.user.rol = token.rol;
        session.user.nombres = token.nombres;
        session.user.primerApellido = token.primerApellido;
        session.user.segundoApellido = token.segundoApellido;
        session.user.email = token.email;
        session.user.telefono = token.telefono;
        session.user.cedula = token.cedula;
        session.user.profesion = token.profesion;
      }
      return session;
    },
  },
  providers: [
    CredentialsProvider({
      name: "Credenciales",
      credentials: {
        username: { label: "Usuario", type: "text" },
        password: { label: "Contrasena", type: "password" },
        captchaToken: { label: "captcha", type: "text" },
      },
      async authorize(credentials, req) {
        // 1. Validacion/saneamiento de entrada (tipo, longitud, formato).
        const parsed = loginSchema.safeParse(credentials ?? {});
        if (!parsed.success) return null;
        const { username, password, captchaToken } = parsed.data;

        const ip = getClientIp(req?.headers);
        const userAgent =
          (req?.headers?.["user-agent"] as string | undefined) ?? null;

        // 2. Bloqueo temporal progresivo (anti fuerza bruta).
        //    Si esta bloqueado se rechaza ANTES de verificar credenciales y
        //    SIN registrar un nuevo intento, para que el bloqueo expire solo
        //    y no pueda usarse como DoS contra la cuenta.
        const throttle = await evaluateLoginThrottle({ username, ip });
        if (throttle.blocked) return null;

        // 3. CAPTCHA tras N fallos consecutivos.
        if (throttle.captchaRequired) {
          const captchaOk = await verifyRecaptcha(captchaToken, ip);
          if (!captchaOk) return null;
        }

        // 4. Verificacion de credenciales (con compare señuelo si no existe).
        const user = await prisma.user.findUnique({ where: { username } });
        const passwordOk = user
          ? await bcrypt.compare(password, user.passwordHash)
          : await bcrypt.compare(password, DUMMY_HASH).then(() => false);

        const success = Boolean(user && user.activo && passwordOk);

        // 5. Auditoria del intento (timestamp, IP, usuario intentado, UA).
        await recordLoginAttempt({ username, ip, userAgent, success });

        // 6. Mensaje generico: no se revela si el usuario existe o si la
        //    contraseña es incorrecta (siempre null -> "credenciales invalidas").
        if (!success || !user) return null;

        return {
          id: user.id,
          username: user.username,
          rol: user.rol,
          nombres: user.nombres,
          primerApellido: user.primerApellido,
          segundoApellido: user.segundoApellido,
          email: user.email,
          telefono: user.telefono,
          cedula: user.cedula,
          profesion: user.profesion,
        };
      },
    }),
  ],
  session: {
    strategy: "jwt",
    maxAge: 60 * 60,
    updateAge: 15 * 60,
  },
  pages: { signIn: "/login" },
};
