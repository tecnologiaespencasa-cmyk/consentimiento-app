-- Normaliza datos existentes: cualquier estado no resuelto pasa a PENDIENTE.
UPDATE "Novedad"
SET "estado" = 'PENDIENTE'
WHERE "estado"::text <> 'RESUELTA';

-- Reemplaza el enum de estado para dejar solo PENDIENTE y RESUELTA.
CREATE TYPE "EstadoNovedad_new" AS ENUM ('PENDIENTE', 'RESUELTA');

ALTER TABLE "Novedad"
ALTER COLUMN "estado" DROP DEFAULT;

ALTER TABLE "Novedad"
ALTER COLUMN "estado" TYPE "EstadoNovedad_new"
USING ("estado"::text::"EstadoNovedad_new");

ALTER TYPE "EstadoNovedad" RENAME TO "EstadoNovedad_old";
ALTER TYPE "EstadoNovedad_new" RENAME TO "EstadoNovedad";
DROP TYPE "EstadoNovedad_old";

ALTER TABLE "Novedad"
ALTER COLUMN "estado" SET DEFAULT 'PENDIENTE';
