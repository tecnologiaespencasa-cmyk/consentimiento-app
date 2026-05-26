CREATE TYPE "ResponsableGestion" AS ENUM ('ADMISIONES', 'ANALISTA_ASISTENCIAL', 'CLINICA_HERIDAS');

ALTER TABLE "Novedad"
ADD COLUMN "responsableGestion" "ResponsableGestion";
