-- AlterEnum
ALTER TYPE "CategoriaNovedad" ADD VALUE IF NOT EXISTS 'TERAPIAS_AMBULATORIAS';

-- AlterEnum
ALTER TYPE "ResponsableGestion" ADD VALUE IF NOT EXISTS 'DIRECCION_ASISTENCIAL';

-- CreateEnum
CREATE TYPE "TipoNovedadTerapiaAmbulatoria" AS ENUM (
  'PACIENTE_TERAPIA_AMBULATORIA',
  'VALIDACION_PERTINENCIA_TERAPIAS',
  'CONSIDERACION_INGRESO_PROGRAMA_CRONICO',
  'PROBABLE_AGUDIZACION',
  'SOLICITUD_EXTENSION_TERAPIAS',
  'CAMBIO_FRECUENCIA_TERAPIAS',
  'VISITA_FALLIDA'
);

-- AlterTable
ALTER TABLE "Novedad"
ADD COLUMN "tipoTerapiaAmbulatoria" "TipoNovedadTerapiaAmbulatoria",
ADD COLUMN "adjuntoTerapiaAmbulatoriaUrl" TEXT,
ADD COLUMN "adjuntoTerapiaAmbulatoriaDriveItemId" TEXT,
ADD COLUMN "adjuntoTerapiaAmbulatoriaNombre" TEXT,
ADD COLUMN "adjuntoTerapiaAmbulatoriaMimeType" TEXT;
