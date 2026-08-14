-- ============================================================================
-- Clinica de Heridas: seguimientos multiples por paciente y fotos en SharePoint.
--
--   - ClinicaHeridas pasa de ser "una valoracion suelta" a ser "el seguimiento
--     numero N de un paciente".
--   - ClinicaHeridasPaciente guarda el identificador opaco de la carpeta del
--     paciente en SharePoint.
--   - ClinicaHeridasFoto guarda SOLO la referencia (driveItemId) de cada foto.
--     El binario nunca entra a Neon.
--   - El campo `exudado` se desdobla en cantidad y caracteristicas.
-- ============================================================================

-- Guarda: esta migracion elimina y añade columnas obligatorias. Solo puede
-- ejecutarse mientras la tabla este vacia (el modulo aun no esta en
-- produccion). Si hubiera registros, se detiene para migrarlos antes.
DO $$
BEGIN
  IF (SELECT count(*) FROM "ClinicaHeridas") > 0 THEN
    RAISE EXCEPTION 'ClinicaHeridas contiene registros: migrar exudado y numero de seguimiento antes de alterar la tabla';
  END IF;
END $$;

CREATE TYPE "TipoFotoHerida" AS ENUM ('PLANO_GENERAL', 'MEDIDA_VERTICAL', 'MEDIDA_HORIZONTAL', 'LATERAL');

CREATE TABLE IF NOT EXISTS "ClinicaHeridasPaciente" (
  "id" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "pacienteRef" TEXT NOT NULL,
  "carpetaDriveItemId" TEXT,
  CONSTRAINT "ClinicaHeridasPaciente_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "ClinicaHeridasPaciente_pacienteRef_key"
  ON "ClinicaHeridasPaciente"("pacienteRef");

-- Seguimiento: consecutivo, exudado desdoblado y carpeta propia.
ALTER TABLE "ClinicaHeridas" DROP COLUMN "exudado";
ALTER TABLE "ClinicaHeridas" ADD COLUMN "numero" INTEGER NOT NULL;
ALTER TABLE "ClinicaHeridas" ADD COLUMN "exudadoCantidad" TEXT NOT NULL;
ALTER TABLE "ClinicaHeridas" ADD COLUMN "exudadoCaracteristicas" TEXT NOT NULL;
ALTER TABLE "ClinicaHeridas" ADD COLUMN "carpetaDriveItemId" TEXT;

-- Dos seguimientos del mismo paciente no pueden compartir numero.
CREATE UNIQUE INDEX IF NOT EXISTS "ClinicaHeridas_pacienteRef_numero_key"
  ON "ClinicaHeridas"("pacienteRef", "numero");

ALTER TABLE "ClinicaHeridas"
  ADD CONSTRAINT "ClinicaHeridas_pacienteRef_fkey"
  FOREIGN KEY ("pacienteRef") REFERENCES "ClinicaHeridasPaciente"("pacienteRef")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- Referencias de fotos. Nunca binarios.
CREATE TABLE IF NOT EXISTS "ClinicaHeridasFoto" (
  "id" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "seguimientoId" TEXT NOT NULL,
  "tipo" "TipoFotoHerida" NOT NULL,
  "driveItemId" TEXT NOT NULL,
  "nombre" TEXT NOT NULL,
  "mimeType" TEXT,
  CONSTRAINT "ClinicaHeridasFoto_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "ClinicaHeridasFoto_seguimientoId_tipo_key"
  ON "ClinicaHeridasFoto"("seguimientoId", "tipo");
CREATE INDEX IF NOT EXISTS "ClinicaHeridasFoto_seguimientoId_idx"
  ON "ClinicaHeridasFoto"("seguimientoId");

ALTER TABLE "ClinicaHeridasFoto"
  ADD CONSTRAINT "ClinicaHeridasFoto_seguimientoId_fkey"
  FOREIGN KEY ("seguimientoId") REFERENCES "ClinicaHeridas"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
