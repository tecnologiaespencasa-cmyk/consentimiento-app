/*
  Warnings:

  - The values [ESPECIALISTA] on the enum `Profesion` will be removed. If these variants are still used in the database, this will fail.
  - The values [NIT] on the enum `TipoDocumento` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "Profesion_new" AS ENUM ('AUXILIAR_ENFERMERIA', 'ENFERMERIA', 'MEDICO', 'FISIOTERAPIA', 'FONOAUDIOLOGIA', 'NUTRICION', 'OTRO');
ALTER TABLE "User" ALTER COLUMN "profesion" TYPE "Profesion_new" USING ("profesion"::text::"Profesion_new");
ALTER TABLE "Novedad" ALTER COLUMN "prestadorProfesion" TYPE "Profesion_new" USING ("prestadorProfesion"::text::"Profesion_new");
ALTER TYPE "Profesion" RENAME TO "Profesion_old";
ALTER TYPE "Profesion_new" RENAME TO "Profesion";
DROP TYPE "Profesion_old";
COMMIT;

-- AlterEnum
BEGIN;
CREATE TYPE "TipoDocumento_new" AS ENUM ('CC', 'TI', 'CE', 'PA', 'PPT', 'RC', 'NUIP');
ALTER TABLE "Novedad" ALTER COLUMN "pacienteTipoDoc" TYPE "TipoDocumento_new" USING ("pacienteTipoDoc"::text::"TipoDocumento_new");
ALTER TYPE "TipoDocumento" RENAME TO "TipoDocumento_old";
ALTER TYPE "TipoDocumento_new" RENAME TO "TipoDocumento";
DROP TYPE "TipoDocumento_old";
COMMIT;
