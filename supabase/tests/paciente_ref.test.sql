-- ============================================================================
-- Pruebas de paciente_ref sobre el puente real.
--
-- Se ejecutan contra public.bridge_sync_pacientes_heridas, que es donde vive el
-- ON CONFLICT que debe preservar la referencia. Usan un documento_hmac
-- sintetico (no corresponde a ninguna persona: son 64 caracteres hex de
-- prueba) y un sobre nombre_encrypted con formato valido pero sin contenido
-- real. En ningun momento se necesitan BRIDGE_HMAC_SECRET ni
-- BRIDGE_ENCRYPTION_KEY.
--
-- La fila de prueba se elimina al final: no deja residuo.
-- ============================================================================
DO $$
DECLARE
    doc_a       text := repeat('a1', 32);   -- 64 hex sinteticos, paciente A
    doc_b       text := repeat('b2', 32);   -- 64 hex sinteticos, paciente B
    sobre_1     text := 'v1.AAAAAAAAAAAAAAAA.AAAAAAAAAAAAAAAAAAAAAAAA';
    sobre_2     text := 'v1.BBBBBBBBBBBBBBBB.BBBBBBBBBBBBBBBBBBBBBBBB';
    nombre_1    text := repeat('c3', 32);
    nombre_2    text := repeat('d4', 32);
    ref_alta    uuid;
    ref_reenvio uuid;
    ref_renombre uuid;
    ref_b       uuid;
    resultado   jsonb;
BEGIN
    -- Limpieza defensiva por si una ejecucion anterior quedo a medias.
    DELETE FROM bridge.pacientes_heridas WHERE documento_hmac IN (doc_a, doc_b);

    -- 1. Paciente nuevo recibe paciente_ref -----------------------------------
    resultado := public.bridge_sync_pacientes_heridas(
        'test-ref-alta-' || gen_random_uuid()::text,
        jsonb_build_array(jsonb_build_object('d', doc_a, 'n', nombre_1, 'e', sobre_1))
    );
    SELECT paciente_ref INTO ref_alta FROM bridge.pacientes_heridas WHERE documento_hmac = doc_a;

    IF ref_alta IS NULL THEN
        RAISE EXCEPTION 'FALLA 1: el paciente nuevo no recibio paciente_ref';
    END IF;
    RAISE NOTICE 'OK 1: paciente nuevo recibe paciente_ref';

    -- 2. Es un UUID v4 valido --------------------------------------------------
    IF ref_alta::text !~ '^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' THEN
        RAISE EXCEPTION 'FALLA 2: paciente_ref no es un UUID v4: %', ref_alta;
    END IF;
    RAISE NOTICE 'OK 2: paciente_ref es UUID v4 valido';

    -- 4. Reenviar el mismo paciente conserva el paciente_ref --------------------
    resultado := public.bridge_sync_pacientes_heridas(
        'test-ref-reenvio-' || gen_random_uuid()::text,
        jsonb_build_array(jsonb_build_object('d', doc_a, 'n', nombre_1, 'e', sobre_1))
    );
    SELECT paciente_ref INTO ref_reenvio FROM bridge.pacientes_heridas WHERE documento_hmac = doc_a;

    IF ref_reenvio IS DISTINCT FROM ref_alta THEN
        RAISE EXCEPTION 'FALLA 4: el reenvio cambio paciente_ref (% -> %)', ref_alta, ref_reenvio;
    END IF;
    RAISE NOTICE 'OK 4: reenviar el mismo paciente conserva paciente_ref';

    -- 5. Cambiar el nombre conserva el paciente_ref ----------------------------
    resultado := public.bridge_sync_pacientes_heridas(
        'test-ref-renombre-' || gen_random_uuid()::text,
        jsonb_build_array(jsonb_build_object('d', doc_a, 'n', nombre_2, 'e', sobre_2))
    );
    SELECT paciente_ref, nombre_hmac INTO ref_renombre, nombre_1
      FROM bridge.pacientes_heridas WHERE documento_hmac = doc_a;

    IF nombre_1 IS DISTINCT FROM nombre_2 THEN
        RAISE EXCEPTION 'FALLA 5: el nombre no se actualizo, la prueba no es concluyente';
    END IF;
    IF ref_renombre IS DISTINCT FROM ref_alta THEN
        RAISE EXCEPTION 'FALLA 5: cambiar el nombre cambio paciente_ref (% -> %)', ref_alta, ref_renombre;
    END IF;
    RAISE NOTICE 'OK 5: cambiar el nombre conserva paciente_ref';

    -- 6. Dos pacientes diferentes tienen paciente_ref diferentes ---------------
    resultado := public.bridge_sync_pacientes_heridas(
        'test-ref-otro-' || gen_random_uuid()::text,
        jsonb_build_array(jsonb_build_object('d', doc_b, 'n', nombre_2, 'e', sobre_2))
    );
    SELECT paciente_ref INTO ref_b FROM bridge.pacientes_heridas WHERE documento_hmac = doc_b;

    IF ref_b IS NOT DISTINCT FROM ref_alta THEN
        RAISE EXCEPTION 'FALLA 6: dos pacientes comparten paciente_ref';
    END IF;
    RAISE NOTICE 'OK 6: dos pacientes distintos (mismo nombre) tienen paciente_ref distintos';

    -- 11. No derivable del documento ------------------------------------------
    --     Dos pacientes con nombre identico obtienen referencias distintas, y la
    --     referencia no contiene ningun fragmento del documento_hmac.
    IF position(substring(doc_a from 1 for 8) in replace(ref_alta::text, '-', '')) > 0 THEN
        RAISE EXCEPTION 'FALLA 11: paciente_ref contiene fragmentos del documento_hmac';
    END IF;
    RAISE NOTICE 'OK 11: paciente_ref no contiene informacion derivada del documento';

    -- Limpieza: se borran solo las filas sinteticas creadas por esta prueba.
    DELETE FROM bridge.pacientes_heridas WHERE documento_hmac IN (doc_a, doc_b);
    RAISE NOTICE 'Filas de prueba eliminadas';
END $$;

-- 3. Unicidad global sobre los datos reales del puente.
DO $$
DECLARE
    total    integer;
    distintos integer;
    validos  integer;
BEGIN
    SELECT count(*), count(DISTINCT paciente_ref),
           count(*) FILTER (WHERE paciente_ref::text ~ '^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$')
      INTO total, distintos, validos
      FROM bridge.pacientes_heridas;

    IF total <> distintos THEN
        RAISE EXCEPTION 'FALLA 3: hay paciente_ref repetidos (% filas, % distintos)', total, distintos;
    END IF;
    IF total <> validos THEN
        RAISE EXCEPTION 'FALLA 3: hay paciente_ref que no son UUID v4 (% de %)', validos, total;
    END IF;
    RAISE NOTICE 'OK 3: los % paciente_ref del puente son unicos y UUID v4 validos', total;
END $$;
