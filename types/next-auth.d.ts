import NextAuth, { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      username: string;
      rol: "ADMINISTRATIVO" | "TECNICO" | "ESPECIALISTA";

      nombres: string;
      primerApellido: string;
      segundoApellido: string | null;
      email: string | null;
      telefono: string | null;
    } & DefaultSession["user"];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    username: string;
    rol: "ADMINISTRATIVO" | "TECNICO" | "ESPECIALISTA";

    nombres: string;
    primerApellido: string;
    segundoApellido: string | null;
    email: string | null;
    telefono: string | null;
  }
}