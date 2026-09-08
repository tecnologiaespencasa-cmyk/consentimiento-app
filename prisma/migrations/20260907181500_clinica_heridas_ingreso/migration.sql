-- Numero de ingreso al programa sobre el que se registro el seguimiento.
--
-- Un paciente puede recibir el alta y reingresar a clinica de heridas. Sin este
-- dato los seguimientos del segundo ingreso quedarian mezclados con los del
-- primero, porque todos cuelgan del mismo pacienteRef.
--
-- El valor lo entrega la Edge Function estado-paciente-heridas como
-- `currentAdmission`. El portal NO lo calcula: la unica fuente de verdad del
-- numero de ingreso es el censo de la intranet.
--
-- El default 1 es correcto para lo ya registrado: a la fecha ningun paciente
-- tiene mas de un ingreso en el censo, asi que todos los seguimientos
-- existentes pertenecen al ingreso 1. No hace falta backfill.
ALTER TABLE "ClinicaHeridas"
  ADD COLUMN IF NOT EXISTS "ingreso" SMALLINT NOT NULL DEFAULT 1;

COMMENT ON COLUMN "ClinicaHeridas"."ingreso" IS
  'Numero de ingreso al programa sobre el que se registro este seguimiento. Lo entrega la Edge Function estado-paciente-heridas como currentAdmission.';

CREATE INDEX IF NOT EXISTS "ClinicaHeridas_pacienteRef_ingreso_numero_idx"
  ON "ClinicaHeridas"("pacienteRef", "ingreso", "numero");
