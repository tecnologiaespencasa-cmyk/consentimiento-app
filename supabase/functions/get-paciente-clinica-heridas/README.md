# Clínica de Heridas — integración con el Bridge

Módulo del Portal Administrativo que consulta pacientes de Clínica de Heridas.

## Arquitectura

```
SISTEMA PRODUCTOR EXTERNO
        |  HTTPS PUSH (fuera de este repositorio)
        v
SUPABASE BRIDGE  (bridge.pacientes_heridas)
        ^
        |  RPC SECURITY DEFINER
   Edge Function  get-paciente-clinica-heridas
        ^
        |  HTTPS + bearer + firma HMAC + timestamp + nonce
   Next.js server  (lib/clinicaHeridas.ts)
        ^
        |  POST /api/clinica-heridas/buscar-paciente
   Navegador
```

El Portal **nunca** habla con el sistema productor, ni con la base de datos del
puente. Su único punto de integración es la Edge Function.

## Secretos

| Secreto | Dónde vive | Para qué |
|---|---|---|
| `BRIDGE_QUERY_API_SECRET` | Supabase **y** Portal | autentica y firma la petición HTTP de consulta |
| `BRIDGE_API_SECRET` | Supabase **y** sistema productor | escritura (`sync-pacientes-heridas`), no se toca |
| `BRIDGE_HMAC_SECRET` | **solo** Supabase | deriva `documento_hmac` |
| `BRIDGE_ENCRYPTION_KEY` | **solo** Supabase | descifra `nombre_encrypted` (AES-256-GCM) |

El Portal solo necesita `SUPABASE_PROJECT_URL` y `BRIDGE_QUERY_API_SECRET`,
ambos server-side. Ningún secreto usa el prefijo `NEXT_PUBLIC_`.

## Contrato

`POST /functions/v1/get-paciente-clinica-heridas`

Cabeceras:

```
authorization:        Bearer <BRIDGE_QUERY_API_SECRET>
content-type:         application/json
x-bridge-timestamp:   <epoch en segundos>
x-bridge-request-id:  <uuid>
x-bridge-signature:   HMAC-SHA256(BRIDGE_QUERY_API_SECRET, "<ts>.<requestId>.<rawBody>") en hex minúscula
```

Cuerpo:

```json
{ "requestId": "<uuid>", "timestamp": 1786640000, "document": "123456789" }
```

Respuestas:

```json
{ "found": true, "patient": { "name": "Nombre Apellido", "patientRef": "uuid" } }
{ "found": false }
```

Ventana temporal: ±5 minutos. Cada `requestId` es de un solo uso
(`bridge.query_request_nonces`, purgado tras 1 hora).

## `paciente_ref`

Columna `uuid NOT NULL UNIQUE DEFAULT gen_random_uuid()` en
`bridge.pacientes_heridas`. Es el **único identificador de paciente que el
Portal puede persistir**: no se deriva del documento, no usa
`BRIDGE_HMAC_SECRET` ni `BRIDGE_ENCRYPTION_KEY`, y no es reversible.

Su estabilidad no requiere ningún cambio en `sync-pacientes-heridas`: el
`INSERT` de `public.bridge_sync_pacientes_heridas` enumera columnas explícitas
y su `ON CONFLICT DO UPDATE` solo reescribe `nombre_hmac` y `nombre_encrypted`,
así que nunca toca `paciente_ref`. Un upsert posterior del mismo documento
—cambie o no el nombre— conserva la referencia original.

Pruebas SQL en `supabase/tests/paciente_ref.test.sql` (usan datos sintéticos y
se limpian solas).

## Despliegue

La función está desplegada con `verify_jwt = false`: la autenticación propia
(bearer + firma + timestamp + nonce) es la barrera. El SQL de soporte está en
`supabase/migrations/20260813120500_bridge_get_paciente_heridas.sql` y solo
**añade** objetos: no modifica `bridge.pacientes_heridas` ni la función de
escritura.

## Pruebas

```bash
npm run test:clinica-heridas          # comprobaciones estáticas del repositorio
npm run test:clinica-heridas:bridge   # seguridad de la Edge Function (en vivo)
npm run test:clinica-heridas:portal   # autorización del Portal (requiere npm start)
```

Para verificar el camino "paciente encontrado" y el descifrado del nombre hace
falta el documento de un paciente que exista en el puente:

```bash
node scripts/clinica-heridas/bridge-selftest.mjs --document <documento real>
```

Ese valor no se imprime ni se almacena.
