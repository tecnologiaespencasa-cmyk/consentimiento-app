-- ============================================================================
-- ClinicaHeridas: identificar al paciente por referencia opaca, no por nombre.
--
-- ANTES  pacienteNombre TEXT   -> dos homonimos eran indistinguibles y el
--                                 nombre real quedaba almacenado en Neon.
-- AHORA  pacienteRef    TEXT   -> UUID opaco emitido por el Bridge, estable
--                                 durante toda la vida del paciente.
--
-- Con la referencia ya no hace falta persistir el nombre: Neon deja de
-- contener cualquier dato personal del paciente. El nombre se muestra en
-- pantalla durante la sesion, obtenido del Bridge en cada busqueda.
-- ============================================================================

-- Guarda: esta migracion elimina una columna. Solo puede ejecutarse mientras la
-- tabla este vacia (el modulo aun no ha entrado en produccion). Si alguna vez
-- hubiera registros, se detiene para que se migren los datos antes.
DO $$
BEGIN
  IF (SELECT count(*) FROM "ClinicaHeridas") > 0 THEN
    RAISE EXCEPTION 'ClinicaHeridas contiene registros: migrar pacienteNombre a pacienteRef antes de eliminar la columna';
  END IF;
END $$;

ALTER TABLE "ClinicaHeridas" ADD COLUMN "pacienteRef" TEXT NOT NULL;

ALTER TABLE "ClinicaHeridas" DROP COLUMN "pacienteNombre";

-- El historico clinico se consulta por paciente.
CREATE INDEX IF NOT EXISTS "ClinicaHeridas_pacienteRef_createdAt_idx"
  ON "ClinicaHeridas"("pacienteRef", "createdAt");
