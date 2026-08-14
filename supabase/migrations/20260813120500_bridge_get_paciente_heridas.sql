-- ============================================================================
-- Lectura controlada del puente para el portal administrativo (fase 2).
--
-- NO toca bridge.pacientes_heridas ni la funcion de escritura
-- public.bridge_sync_pacientes_heridas: solo agrega objetos nuevos.
--
-- La tabla sigue con RLS activo y CERO politicas, y sin GRANT a anon /
-- authenticated / service_role. El unico acceso posible sigue siendo a traves
-- de funciones SECURITY DEFINER propiedad de postgres, como la de escritura.
-- ============================================================================

-- Nonces de las peticiones de consulta. Independientes de los de escritura
-- (bridge.sync_request_nonces) para que un requestId de sincronizacion no
-- pueda invalidar una consulta ni al reves.
CREATE TABLE IF NOT EXISTS bridge.query_request_nonces (
  request_id  text        PRIMARY KEY,
  recibido_en timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE bridge.query_request_nonces ENABLE ROW LEVEL SECURITY;

-- ----------------------------------------------------------------------------
-- public.bridge_get_paciente_heridas
--
-- 1. Valida el request_id.
-- 2. Consume el nonce (proteccion contra replay): si el request_id ya se uso,
--    devuelve {"replay": true} sin tocar la tabla de pacientes.
-- 3. Busca por documento_hmac y devuelve UNICAMENTE nombre_encrypted.
--
-- No devuelve documento_hmac ni nombre_hmac. El descifrado ocurre en la Edge
-- Function, que es la unica que tiene BRIDGE_ENCRYPTION_KEY.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.bridge_get_paciente_heridas(
  p_request_id     text,
  p_documento_hmac text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
declare
    v_nombre_encrypted text;
begin
    if p_request_id is null or length(p_request_id) = 0 or length(p_request_id) > 64 then
        raise exception 'request_id_invalido' using errcode = '22023';
    end if;

    if p_documento_hmac is null or p_documento_hmac !~ '^[0-9a-f]{64}$' then
        raise exception 'documento_hmac_invalido' using errcode = '22023';
    end if;

    delete from bridge.query_request_nonces where recibido_en < now() - interval '1 hour';

    begin
        insert into bridge.query_request_nonces (request_id) values (p_request_id);
    exception
        when unique_violation then
            return jsonb_build_object('replay', true, 'nombre_encrypted', null);
    end;

    select p.nombre_encrypted
      into v_nombre_encrypted
      from bridge.pacientes_heridas p
     where p.documento_hmac = p_documento_hmac;

    return jsonb_build_object(
        'replay', false,
        'nombre_encrypted', v_nombre_encrypted
    );
end;
$function$;

-- Mismos permisos que la funcion de escritura: nadie mas puede ejecutarla.
REVOKE ALL ON FUNCTION public.bridge_get_paciente_heridas(text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.bridge_get_paciente_heridas(text, text) FROM anon;
REVOKE ALL ON FUNCTION public.bridge_get_paciente_heridas(text, text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.bridge_get_paciente_heridas(text, text) TO service_role;
