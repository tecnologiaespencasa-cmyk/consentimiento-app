import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import { prisma } from "@/lib/prisma";
import { tieneAccesoClinicaHeridas } from "@/lib/roles";
import {
  buscarPacienteEnBridge,
  documentoTieneFormatoValido,
  enmascararDocumento,
  evaluarRateLimit,
  getClientIp,
  nuevoRequestId,
  registrarConsulta,
} from "@/lib/clinicaHeridas";

/**
 * Busqueda de un paciente de Clinica de Heridas.
 *
 * Solo POST: el documento nunca puede viajar en la URL, ni quedar en el
 * historial del navegador, ni en los logs de acceso del proxy.
 *
 * El documento se recibe, se valida, se reenvia firmado al Bridge y se
 * descarta. No se persiste en Neon, no se escribe en logs y no se devuelve al
 * navegador salvo enmascarado por conveniencia de la interfaz.
 */

export const dynamic = "force-dynamic";

function sinCache(response: NextResponse) {
  response.headers.set("Cache-Control", "no-store, no-cache, must-revalidate");
  return response;
}

export async function POST(req: Request) {
  const iniciado = Date.now();

  // 1. Autenticacion -------------------------------------------------------
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return sinCache(NextResponse.json({ error: "No autorizado" }, { status: 401 }));
  }

  // 2. Autorizacion por rol (server-side, no basta con ocultar el menu) -----
  if (!tieneAccesoClinicaHeridas(session.user.rol)) {
    return sinCache(
      NextResponse.json({ error: "No tienes acceso a Clinica de Heridas" }, { status: 403 }),
    );
  }

  const ip = getClientIp(req.headers);
  const requestId = nuevoRequestId();

  // 3. Rate limiting (la busqueda por documento permite enumerar pacientes) -
  const limite = await evaluarRateLimit({ usuarioId: session.user.id, ip });
  if (!limite.permitido) {
    await registrarConsulta({
      usuarioId: session.user.id,
      ip,
      requestId,
      ok: false,
      status: 429,
      durationMs: Date.now() - iniciado,
    });
    const response = NextResponse.json(
      { error: "Has realizado demasiadas busquedas. Intenta de nuevo en unos minutos." },
      { status: 429 },
    );
    response.headers.set("Retry-After", String(limite.retryAfterSeconds));
    return sinCache(response);
  }

  // 4. Estructura y validacion del documento -------------------------------
  let documento = "";
  try {
    const body = await req.json();
    documento = typeof body?.documento === "string" ? body.documento.trim() : "";
  } catch {
    return sinCache(NextResponse.json({ error: "Solicitud invalida." }, { status: 400 }));
  }

  if (!documento) {
    return sinCache(
      NextResponse.json({ error: "Ingresa el documento del paciente." }, { status: 400 }),
    );
  }
  if (!documentoTieneFormatoValido(documento)) {
    return sinCache(
      NextResponse.json({ error: "El documento no tiene un formato valido." }, { status: 400 }),
    );
  }

  // 5. Consulta al Bridge ---------------------------------------------------
  const resultado = await buscarPacienteEnBridge(documento, requestId);
  const duracion = Date.now() - iniciado;

  const status =
    resultado.estado === "error" ? 502 : resultado.estado === "documento_invalido" ? 400 : 200;

  await registrarConsulta({
    usuarioId: session.user.id,
    ip,
    requestId,
    ok: status === 200,
    status,
    durationMs: duracion,
  });

  if (resultado.estado === "error") {
    return sinCache(
      NextResponse.json(
        { error: "No fue posible realizar la consulta. Intente nuevamente." },
        { status: 502 },
      ),
    );
  }

  if (resultado.estado === "documento_invalido") {
    return sinCache(
      NextResponse.json({ error: "El documento no tiene un formato valido." }, { status: 400 }),
    );
  }

  if (resultado.estado === "no_encontrado") {
    return sinCache(NextResponse.json({ encontrado: false }, { status: 200 }));
  }

  // Historico clinico del paciente, agrupado por su referencia opaca.
  const seguimientos = await prisma.clinicaHeridas.findMany({
    where: { pacienteRef: resultado.pacienteRef },
    orderBy: { numero: "asc" },
    select: {
      id: true,
      numero: true,
      createdAt: true,
      origen: true,
      ubicacion: true,
      diametroVerticalCm: true,
      diametroHorizontalCm: true,
      profundidadCm: true,
      fondo: true,
      lecho: true,
      tejido: true,
      cavitacionTunelizacion: true,
      pielPerilesional: true,
      exudadoCantidad: true,
      exudadoCaracteristicas: true,
      usuario: { select: { nombres: true, primerApellido: true } },
      fotos: { select: { id: true, tipo: true, nombre: true } },
    },
  });

  // Solo salen del servidor el nombre, la referencia opaca, el documento
  // enmascarado y el historico. `pacienteRef` es un UUID aleatorio del Bridge:
  // no se deriva del documento, por lo que exponerlo no permite reconstruirlo.
  return sinCache(
    NextResponse.json(
      {
        encontrado: true,
        paciente: {
          nombre: resultado.nombre,
          pacienteRef: resultado.pacienteRef,
          documentoMascarado: enmascararDocumento(documento),
        },
        seguimientos: seguimientos.map((seguimiento) => ({
          ...seguimiento,
          registradoPor: `${seguimiento.usuario.nombres} ${seguimiento.usuario.primerApellido}`.trim(),
          usuario: undefined,
        })),
      },
      { status: 200 },
    ),
  );
}
