-- Rol del modulo Clinica de Heridas.
ALTER TYPE "Rol" ADD VALUE IF NOT EXISTS 'CLINICA_HERIDAS';

-- Registro clinico de la herida.
-- El documento del paciente NO se persiste: solo el nombre devuelto por el
-- Bridge, que es lo minimo necesario para identificar el registro.
CREATE TABLE IF NOT EXISTS "ClinicaHeridas" (
  "id" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "pacienteNombre" TEXT NOT NULL,
  "origen" TEXT NOT NULL,
  "ubicacion" TEXT NOT NULL,
  "diametroVerticalCm" DOUBLE PRECISION NOT NULL,
  "diametroHorizontalCm" DOUBLE PRECISION NOT NULL,
  "profundidadCm" DOUBLE PRECISION NOT NULL,
  "fondo" TEXT NOT NULL,
  "lecho" TEXT NOT NULL,
  "tejido" TEXT NOT NULL,
  "exudado" TEXT NOT NULL,
  "usuarioId" TEXT NOT NULL,
  CONSTRAINT "ClinicaHeridas_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "ClinicaHeridas_usuarioId_createdAt_idx" ON "ClinicaHeridas"("usuarioId", "createdAt");
CREATE INDEX IF NOT EXISTS "ClinicaHeridas_createdAt_idx" ON "ClinicaHeridas"("createdAt");

ALTER TABLE "ClinicaHeridas"
  ADD CONSTRAINT "ClinicaHeridas_usuarioId_fkey"
  FOREIGN KEY ("usuarioId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Auditoria tecnica + soporte del rate limiting de las busquedas contra el
-- Bridge (mismo patron que "LoginAttempt": el estado vive en PostgreSQL porque
-- este despliegue no tiene Redis).
-- Nunca contiene documento, nombre, HMAC ni payload.
CREATE TABLE IF NOT EXISTS "ClinicaHeridasConsulta" (
  "id" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "usuarioId" TEXT NOT NULL,
  "ip" TEXT NOT NULL,
  "requestId" TEXT NOT NULL,
  "ok" BOOLEAN NOT NULL DEFAULT false,
  "status" INTEGER NOT NULL,
  "durationMs" INTEGER NOT NULL,
  CONSTRAINT "ClinicaHeridasConsulta_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "ClinicaHeridasConsulta_usuarioId_createdAt_idx" ON "ClinicaHeridasConsulta"("usuarioId", "createdAt");
CREATE INDEX IF NOT EXISTS "ClinicaHeridasConsulta_ip_createdAt_idx" ON "ClinicaHeridasConsulta"("ip", "createdAt");

ALTER TABLE "ClinicaHeridasConsulta"
  ADD CONSTRAINT "ClinicaHeridasConsulta_usuarioId_fkey"
  FOREIGN KEY ("usuarioId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
