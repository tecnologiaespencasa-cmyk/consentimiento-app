-- Correccion del backfill de 20260910120000_add_ronda_fecha_ingreso.
--
-- "createdAt" se almacena como timestamp naive cuyos valores estan en UTC. Hay
-- que interpretarlo como UTC ANTES de convertirlo a la fecha calendario de
-- Bogota. La version anterior lo tomaba como si ya estuviera en hora Bogota y,
-- por eso, adelantaba un dia a los reportes creados despues de las 19:00.
--
-- Es seguro recalcular todas las filas: la captura manual de "fechaIngreso" se
-- habilita en este mismo despliegue, asi que hoy todos los valores provienen
-- del backfill.
UPDATE "RondaIntramural"
  SET "fechaIngreso" = (("createdAt" AT TIME ZONE 'UTC') AT TIME ZONE 'America/Bogota')::date;
