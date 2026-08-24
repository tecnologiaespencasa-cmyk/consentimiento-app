-- Dos campos clinicos nuevos del seguimiento, parametrizados como listas de
-- unica seleccion (ver lib/clinicaHeridasCatalogos.ts).
--
-- Se crean NULLABLE a proposito: ya existen seguimientos registrados antes de
-- que estos campos existieran, y no procede inventarles un valor clinico. La
-- API los exige en todo seguimiento nuevo; los historicos se muestran como
-- "sin registrar".
ALTER TABLE "ClinicaHeridas" ADD COLUMN IF NOT EXISTS "cavitacionTunelizacion" TEXT;
ALTER TABLE "ClinicaHeridas" ADD COLUMN IF NOT EXISTS "pielPerilesional" TEXT;
