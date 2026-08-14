-- ============================================================================
-- public.bridge_get_paciente_heridas: devolver tambien paciente_ref.
--
-- Unico cambio respecto a la version anterior: el objeto de salida incluye
-- paciente_ref. Se mantiene intacto todo lo demas -- validacion del request_id,
-- validacion del formato de documento_hmac, consumo del nonce anti-replay,
-- SECURITY DEFINER, search_path vacio y los mismos GRANT.
--
-- Sigue sin devolver documento_hmac ni nombre_hmac. El descifrado de
-- nombre_encrypted continua ocurriendo solo en la Edge Function.
-- ============================================================================
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
    v_paciente_ref     uuid;
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
            return jsonb_build_object('replay', true, 'nombre_encrypted', null, 'paciente_ref', null);
    end;

    select p.nombre_encrypted, p.paciente_ref
      into v_nombre_encrypted, v_paciente_ref
      from bridge.pacientes_heridas p
     where p.documento_hmac = p_documento_hmac;

    return jsonb_build_object(
        'replay', false,
        'nombre_encrypted', v_nombre_encrypted,
        'paciente_ref', v_paciente_ref
    );
end;
$function$;

REVOKE ALL ON FUNCTION public.bridge_get_paciente_heridas(text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.bridge_get_paciente_heridas(text, text) FROM anon;
REVOKE ALL ON FUNCTION public.bridge_get_paciente_heridas(text, text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.bridge_get_paciente_heridas(text, text) TO service_role;
