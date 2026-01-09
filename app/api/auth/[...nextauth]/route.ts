import type { NextAuthOptions } from "next-auth"
import NextAuth from "next-auth"
import CredentialsProvider from "next-auth/providers/credentials"
import * as bcrypt from "bcrypt"
import { prisma } from "@/lib/prisma"

export const authOptions: NextAuthOptions = {
    callbacks: {
        async jwt({ token, user }) {
            if (user) {
                token.id = user.id
                token.username = user.username
                token.nombre = user.nombre
                token.rol = user.rol
            }
            return token
        },
        async session({ session, token }) {
            if (session.user) {
                session.user.id = token.id as string
                session.user.username = token.username as string
                session.user.nombre = token.nombre as string
                session.user.rol = token.rol as
                    | "ADMINISTRATIVO"
                    | "TECNICO"
                    | "ESPECIALISTA"
            }
            return session
        }
    },

    providers: [
        CredentialsProvider({
            name: "Credenciales",
            credentials: {
                username: { label: "Usuario", type: "text" },
                password: { label: "Contraseña", type: "password" }
            },
            async authorize(credentials) {
                if (!credentials?.username || !credentials?.password) {
                    return null
                }

                const user = await prisma.user.findUnique({
                    where: { username: credentials.username }
                })

                if (!user || !user.activo) return null

                const passwordValida = await bcrypt.compare(
                    credentials.password,
                    user.passwordHash
                )

                if (!passwordValida) return null

                return {
                    id: user.id,
                    username: user.username,
                    nombre: user.nombre,
                    rol: user.rol
                }
            }
        })
    ],

    session: {
        strategy: "jwt"
    },

    pages: {
        signIn: "/login"
    }
}

const handler = NextAuth(authOptions)

export { handler as GET, handler as POST }
