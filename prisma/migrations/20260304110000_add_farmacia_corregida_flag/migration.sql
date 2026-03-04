-- AlterTable
ALTER TABLE "Novedad"
ADD COLUMN "farmaciaCorregida" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "farmaciaCorregidaAt" TIMESTAMP(3);
