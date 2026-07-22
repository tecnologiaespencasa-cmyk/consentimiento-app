import { z } from "zod";

/**
 * Esquemas de validacion/saneamiento de entrada (zod) para los endpoints
 * sensibles de autenticacion y gestion de usuarios.
 */

const ROLES = ["ESPECIALISTA", "MEDICO_RONDA", "ADMINISTRATIVO", "TECNICO", "FARMACIA"] as const;
const PROFESIONES = [
  "AUXILIAR_ENFERMERIA",
  "ENFERMERIA",
  "MEDICO",
  "FISIOTERAPIA",
  "FONOAUDIOLOGIA",
  "NUTRICION",
  "OTRO",
] as const;

// Credenciales de login: limita tipo, longitud y formato del usuario.
export const loginSchema = z.object({
  username: z
    .string()
    .trim()
    .toLowerCase()
    .min(3, "Usuario invalido")
    .max(50, "Usuario invalido")
    .regex(/^[\p{L}\p{N}._-]+$/u, "Usuario invalido"),
  password: z.string().min(1).max(200),
  captchaToken: z.string().max(5000).optional(),
});

export const createUserSchema = z.object({
  username: z
    .string()
    .trim()
    .toLowerCase()
    .min(3, "El usuario debe tener entre 3 y 50 caracteres")
    .max(50, "El usuario debe tener entre 3 y 50 caracteres")
    .regex(/^[\p{L}\p{N}._-]+$/u, "El usuario solo admite letras, numeros y . _ -"),
  password: z
    .string()
    .min(8, "La contraseña debe tener minimo 8 caracteres")
    .max(200, "La contraseña es demasiado larga"),
  nombres: z.string().trim().min(1, "Los nombres son obligatorios").max(100),
  primerApellido: z.string().trim().min(1, "El primer apellido es obligatorio").max(100),
  segundoApellido: z.string().trim().max(100).optional().or(z.literal("")),
  email: z.string().trim().toLowerCase().email("Correo invalido").max(150).optional().or(z.literal("")),
  telefono: z
    .string()
    .trim()
    .max(30)
    .regex(/^[0-9+()\-\s]*$/, "Telefono invalido")
    .optional()
    .or(z.literal("")),
  cedula: z
    .string()
    .trim()
    .min(4, "Cedula invalida")
    .max(20, "Cedula invalida")
    .regex(/^[0-9]+$/, "La cedula solo admite numeros"),
  profesion: z.enum(PROFESIONES, { message: "Profesion invalida" }),
  rol: z.enum(ROLES, { message: "Rol invalido" }),
});

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().trim().min(1, "La contraseña actual es obligatoria").max(200),
    newPassword: z
      .string()
      .trim()
      .min(6, "La nueva contraseña debe tener minimo 6 caracteres")
      .max(200, "La nueva contraseña es demasiado larga"),
  })
  .refine((d) => d.currentPassword !== d.newPassword, {
    message: "La nueva contraseña debe ser diferente a la actual",
    path: ["newPassword"],
  });

export type LoginInput = z.infer<typeof loginSchema>;
export type CreateUserInput = z.infer<typeof createUserSchema>;
