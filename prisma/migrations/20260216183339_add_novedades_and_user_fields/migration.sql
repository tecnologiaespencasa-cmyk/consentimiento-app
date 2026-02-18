/*
  Warnings:

  - Added the required column `cedula` to the `User` table without a default value. This is not possible if the table is not empty.
  - Added the required column `profesion` to the `User` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "Profesion" AS ENUM ('AUXILIAR_ENFERMERIA', 'ENFERMERIA', 'MEDICO', 'ESPECIALISTA');

-- CreateEnum
CREATE TYPE "Zona" AS ENUM ('NORORIENTAL', 'NOROCCIDENTAL', 'CENTRO_ORIENTAL', 'CENTRO_OCCIDENTAL', 'SURORIENTAL', 'SUROCCIDENTAL');

-- CreateEnum
CREATE TYPE "CategoriaNovedad" AS ENUM ('PACIENTE', 'RUTA');

-- CreateEnum
CREATE TYPE "TipoDocumento" AS ENUM ('CC', 'TI', 'CE', 'PA', 'PPT', 'NIT', 'RC', 'NUIP');

-- CreateEnum
CREATE TYPE "TipoNovedadPaciente" AS ENUM ('ERCA', 'DATOS_ERRADOS', 'AGENDAMIENTO', 'FALLECIMIENTO', 'HOSPITALIZACION', 'DOBLE_PRESTADOR', 'RELACIONAMIENTO');

-- CreateEnum
CREATE TYPE "TipoNovedadRuta" AS ENUM ('INCAPACIDAD', 'ACCIDENTE', 'CIERRE_VIAL', 'NO_REALIZO_RUTA');

-- CreateEnum
CREATE TYPE "EstadoNovedad" AS ENUM ('PENDIENTE', 'EN_PROCESO', 'RESUELTA');

-- CreateEnum
CREATE TYPE "Prioridad" AS ENUM ('BAJA', 'MEDIA', 'ALTA');

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "cedula" TEXT NOT NULL,
ADD COLUMN     "profesion" "Profesion" NOT NULL;

-- CreateTable
CREATE TABLE "Novedad" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "prestadorNombre" TEXT NOT NULL,
    "prestadorCedula" TEXT NOT NULL,
    "prestadorProfesion" "Profesion" NOT NULL,
    "prestadorTelefono" TEXT,
    "zonas" "Zona"[],
    "categoria" "CategoriaNovedad" NOT NULL,
    "pacienteNombre" TEXT,
    "pacienteTipoDoc" "TipoDocumento",
    "tipoPaciente" "TipoNovedadPaciente",
    "tipoRuta" "TipoNovedadRuta",
    "descripcion" TEXT NOT NULL,
    "estado" "EstadoNovedad" NOT NULL DEFAULT 'PENDIENTE',
    "prioridad" "Prioridad" NOT NULL DEFAULT 'MEDIA',
    "asignadoA" TEXT,
    "notasInternas" TEXT,
    "usuarioId" TEXT NOT NULL,

    CONSTRAINT "Novedad_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "Novedad" ADD CONSTRAINT "Novedad_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
