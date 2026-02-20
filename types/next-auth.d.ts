import { DefaultSession } from "next-auth";
import type { Profesion, Rol } from "@prisma/client";

declare module "next-auth" {
  interface User {
    id: string;
    username: string;
    rol: Rol;
    nombres: string;
    primerApellido: string;
    segundoApellido: string | null;
    email: string | null;
    telefono: string | null;
    cedula: string;
    profesion: Profesion;
  }
}

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      username: string;
      rol: Rol;

      nombres: string;
      primerApellido: string;
      segundoApellido: string | null;
      email: string | null;
      telefono: string | null;
      cedula: string;
      profesion: Profesion;
    } & DefaultSession["user"];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    username: string;
    rol: Rol;

    nombres: string;
    primerApellido: string;
    segundoApellido: string | null;
    email: string | null;
    telefono: string | null;
    cedula: string;
    profesion: Profesion;
  }
}
