-- ============================================================================
-- Identificador opaco y estable por paciente: bridge.pacientes_heridas.paciente_ref
--
-- MOTIVO
--   El portal no puede persistir el documento (dato sensible) ni identificar a
--   un paciente por su nombre (dos homonimos serian indistinguibles en el
--   historico clinico). paciente_ref resuelve ambas cosas: es una referencia
--   opaca que el portal SI puede guardar en Neon.
--
-- PROPIEDADES
--   - UUID v4 aleatorio (gen_random_uuid, nativo en PostgreSQL 13+).
--   - NO se deriva del documento: no usa documento_hmac, ni BRIDGE_HMAC_SECRET,
--     ni BRIDGE_ENCRYPTION_KEY, ni ningun otro dato de la fila. Es entropia
--     pura del generador de la base de datos, luego no es reversible ni
--     correlacionable con el documento.
--   - NOT NULL y UNIQUE.
--
-- ESTABILIDAD
--   El valor se fija UNA sola vez, en el INSERT, mediante el DEFAULT de la
--   columna. public.bridge_sync_pacientes_heridas inserta columnas explicitas
--   (documento_hmac, nombre_hmac, nombre_encrypted) y su ON CONFLICT DO UPDATE
--   solo reescribe nombre_hmac y nombre_encrypted: nunca menciona paciente_ref.
--   Por eso un upsert posterior del mismo documento -- cambie o no el nombre --
--   conserva el paciente_ref original, y la funcion de sincronizacion NO
--   necesita ninguna modificacion.
--
-- NO se tocan documento_hmac, nombre_hmac, nombre_encrypted, el cifrado
-- AES-256-GCM, el AAD, los nonces anti-replay ni las politicas RLS.
-- ============================================================================

-- 1. Columna nueva, inicialmente permisiva para poder rellenar las filas ya
--    existentes sin bloquear la escritura del sistema productor.
ALTER TABLE bridge.pacientes_heridas
  ADD COLUMN IF NOT EXISTS paciente_ref uuid;

-- 2. Backfill: cada fila existente recibe su propio UUID aleatorio.
--    gen_random_uuid() es VOLATILE, de modo que se evalua una vez POR FILA y
--    no puede producir colisiones entre pacientes.
UPDATE bridge.pacientes_heridas
   SET paciente_ref = gen_random_uuid()
 WHERE paciente_ref IS NULL;

-- 3. A partir de aqui la columna es obligatoria y se autogenera en cada alta.
ALTER TABLE bridge.pacientes_heridas
  ALTER COLUMN paciente_ref SET DEFAULT gen_random_uuid();

ALTER TABLE bridge.pacientes_heridas
  ALTER COLUMN paciente_ref SET NOT NULL;

-- 4. Unicidad: garantiza que dos pacientes distintos nunca compartan referencia
--    y permite al portal relacionar registros clinicos sin ambiguedad.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'pacientes_heridas_paciente_ref_key'
       AND connamespace = 'bridge'::regnamespace
  ) THEN
    ALTER TABLE bridge.pacientes_heridas
      ADD CONSTRAINT pacientes_heridas_paciente_ref_key UNIQUE (paciente_ref);
  END IF;
END $$;
