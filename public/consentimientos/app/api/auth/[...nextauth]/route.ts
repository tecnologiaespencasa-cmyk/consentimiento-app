import type { NextAuthOptions } from "next-auth";
import NextAuth from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import * as bcrypt from "bcrypt";
import { prisma } from "@/lib/prisma";

export const authOptions: NextAuthOptions = {
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = (user as any).id;
        token.username = (user as any).username;
        token.rol = (user as any).rol;

        token.nombres = (user as any).nombres;
        token.primerApellido = (user as any).primerApellido;
        token.segundoApellido = (user as any).segundoApellido ?? null;
        token.email = (user as any).email ?? null;
        token.telefono = (user as any).telefono ?? null;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.username = token.username as string;
        session.user.rol = token.rol as any;

        session.user.nombres = token.nombres as string;
        session.user.primerApellido = token.primerApellido as string;
        session.user.segundoApellido = (token.segundoApellido as string | null) ?? null;
        session.user.email = (token.email as string | null) ?? null;
        session.user.telefono = (token.telefono as string | null) ?? null;
      }
      return session;
    },
  },

  providers: [
    CredentialsProvider({
      name: "Credenciales",
      credentials: {
        username: { label: "Usuario", type: "text" },
        password: { label: "Contraseña", type: "password" },
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
        } as any;
      },
    }),
  ],

  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
};

const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };
