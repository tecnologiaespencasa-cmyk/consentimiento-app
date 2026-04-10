ALTER TYPE "Zona" RENAME TO "Zona_old";

CREATE TYPE "Zona" AS ENUM (
  'NORTE',
  'SUR',
  'OCCIDENTE',
  'ORIENTE',
  'ORIENTE_ANTIOQUENO'
);

ALTER TABLE "Novedad"
ADD COLUMN "zona" "Zona";

-- Mapeo de zonas historicas a la nueva clasificacion de una sola zona.
UPDATE "Novedad"
SET "zona" = CASE
  WHEN "zonas" @> ARRAY['CENTRO_OCCIDENTAL'::"Zona_old"] THEN 'ORIENTE_ANTIOQUENO'::"Zona"
  WHEN "zonas" @> ARRAY['NORORIENTAL'::"Zona_old"] THEN 'ORIENTE'::"Zona"
  WHEN "zonas" @> ARRAY['NOROCCIDENTAL'::"Zona_old"] THEN 'NORTE'::"Zona"
  WHEN "zonas" @> ARRAY['CENTRO_ORIENTAL'::"Zona_old"] THEN 'SUR'::"Zona"
  WHEN "zonas" @> ARRAY['SURORIENTAL'::"Zona_old"] THEN 'OCCIDENTE'::"Zona"
  WHEN "zonas" @> ARRAY['SUROCCIDENTAL'::"Zona_old"] THEN 'OCCIDENTE'::"Zona"
  ELSE NULL
END;

ALTER TABLE "Novedad"
DROP COLUMN "zonas";

DROP TYPE "Zona_old";
