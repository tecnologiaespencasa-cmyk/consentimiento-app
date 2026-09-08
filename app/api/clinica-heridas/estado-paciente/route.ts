import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import { tieneAccesoClinicaHeridas } from "@/lib/roles";
import {
  consultarEstadoIngreso,
  documentoTieneFormatoValido,
  getClientIp,
  mensajeBloqueoIngreso,
  nuevoRequestId,
  registrarConsulta,
  validacionIngresoActiva,
} from "@/lib/clinicaHeridas";

/**
 * Estado del ingreso del paciente al programa de clinica de heridas.
 *
 * Se consulta al abrir el formulario de seguimiento, para no dejar que el
 * profesional lo llene entero y falle al guardar. La comprobacion decisiva
 * vuelve a hacerse en el alta, porque el alta del paciente puede ocurrir
 * mientras se llena el formulario.
 *
 * Solo POST: el documento nunca puede viajar en la URL.
 */

export const dynamic = "force-dynamic";

function sinCache(response: NextResponse) {
  response.headers.set("Cache-Control", "no-store, no-cache, must-revalidate");
  return response;
}

export async function POST(req: Request) {
  const iniciado = Date.now();

  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return sinCache(NextResponse.json({ error: "No autorizado" }, { status: 401 }));
  }
  if (!tieneAccesoClinicaHeridas(session.user.rol)) {
    return sinCache(
      NextResponse.json({ error: "No tienes acceso a Clinica de Heridas" }, { status: 403 }),
    );
  }

  let documento = "";
  try {
    const body = await req.json();
    documento = typeof body?.documento === "string" ? body.documento.trim() : "";
  } catch {
    return sinCache(NextResponse.json({ error: "Solicitud invalida." }, { status: 400 }));
  }

  if (!documentoTieneFormatoValido(documento)) {
    return sinCache(
      NextResponse.json({ error: "El documento no tiene un formato valido." }, { status: 400 }),
    );
  }

  // Mientras el puente no publique los ingresos, no hay nada que validar y el
  // modulo sigue funcionando como antes.
  if (!validacionIngresoActiva()) {
    return sinCache(
      NextResponse.json({ validacionActiva: false, puedeRegistrar: true }, { status: 200 }),
    );
  }

  const ip = getClientIp(req.headers);
  const requestId = nuevoRequestId();
  const estado = await consultarEstadoIngreso(documento, requestId);
  const puedeRegistrar = estado.estado === "activo";

  await registrarConsulta({
    usuarioId: session.user.id,
    ip,
    requestId,
    ok: estado.estado !== "error",
    status: estado.estado === "error" ? 502 : 200,
    durationMs: Date.now() - iniciado,
  });

  return sinCache(
    NextResponse.json(
      {
        validacionActiva: true,
        puedeRegistrar,
        ingresoActual: estado.estado === "activo" ? estado.ingresoActual : null,
        motivo: puedeRegistrar ? null : mensajeBloqueoIngreso(estado.estado),
      },
      // Un fallo del puente se devuelve como 502 para que el cliente sepa que
      // conviene reintentar, no que el paciente este dado de alta.
      { status: estado.estado === "error" ? 502 : 200 },
    ),
  );
}
