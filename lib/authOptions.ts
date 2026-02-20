import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import * as bcrypt from "bcrypt";
import { prisma } from "@/lib/prisma";

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
      },
      async authorize(credentials) {
        if (!credentials?.username || !credentials?.password) return null;

        const username = credentials.username.toLowerCase().trim();
        const user = await prisma.user.findUnique({ where: { username } });
        if (!user || !user.activo) return null;

        const ok = await bcrypt.compare(credentials.password, user.passwordHash);
        if (!ok) return null;

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
