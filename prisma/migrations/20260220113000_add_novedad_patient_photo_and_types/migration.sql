-- AlterEnum
ALTER TYPE "TipoNovedadPaciente" ADD VALUE IF NOT EXISTS 'IMPOSIBILIDAD_CONTACTAR_PACIENTE';
ALTER TYPE "TipoNovedadPaciente" ADD VALUE IF NOT EXISTS 'IMPOSIBILIDAD_INGRESAR_DOMICILIO';

-- AlterTable
ALTER TABLE "Novedad"
ADD COLUMN "fotoIngresoDomicilioUrl" TEXT,
ADD COLUMN "fotoIngresoDomicilioDriveItemId" TEXT,
ADD COLUMN "fotoIngresoDomicilioNombre" TEXT,
ADD COLUMN "fotoIngresoDomicilioMimeType" TEXT;
