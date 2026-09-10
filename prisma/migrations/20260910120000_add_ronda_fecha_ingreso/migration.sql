-- Fecha de ingreso del paciente a la IPS. Se captura al registrar el reporte de
-- ronda intramural, junto con la IPS y el diagnostico.
ALTER TABLE "RondaIntramural" ADD COLUMN "fechaIngreso" DATE;

-- Backfill de lo ya registrado: no existe el dato historico, asi que usamos la
-- fecha de creacion del reporte (en horario de Bogota) como mejor aproximacion.
UPDATE "RondaIntramural"
  SET "fechaIngreso" = ("createdAt" AT TIME ZONE 'America/Bogota')::date
  WHERE "fechaIngreso" IS NULL;

ALTER TABLE "RondaIntramural" ALTER COLUMN "fechaIngreso" SET NOT NULL;
