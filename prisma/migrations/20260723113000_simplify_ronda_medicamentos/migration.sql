ALTER TABLE "RondaMedicamento"
  DROP COLUMN "dosis",
  DROP COLUMN "medida",
  DROP COLUMN "viaAdministracion",
  DROP COLUMN "frecuencia",
  DROP COLUMN "dias";

DROP TYPE "MedidaRonda";
DROP TYPE "ViaAdministracionRonda";
DROP TYPE "FrecuenciaRonda";
