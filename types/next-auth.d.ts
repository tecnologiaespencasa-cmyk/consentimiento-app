import NextAuth from "next-auth"

declare module "next-auth" {
  interface Session {
    user: {
      id: string
      username: string
      nombre: string
      rol: "ADMINISTRATIVO" | "TECNICO" | "ESPECIALISTA"
    }
  }

  interface User {
    id: string
    username: string
    nombre: string
    rol: "ADMINISTRATIVO" | "TECNICO" | "ESPECIALISTA"
  }
}
