import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import { prisma } from "@/lib/prisma";
import { sendGraphMail } from "@/lib/sendGraphMail";
import { notificarNovedadesFarmaciaSinGestion } from "@/lib/notificarNovedadesFarmaciaSinGestion";

const ESTADOS_GESTION_VALIDOS = new Set(["PENDIENTE", "RESUELTA"]);
const RESPONSABLES_GESTION_VALIDOS = new Set(["ADMISIONES", "ANALISTA_ASISTENCIAL", "CLINICA_HERIDAS"]);

const TIPOS_PACIENTE_LABEL: Record<string, string> = {
  CATETER_PICC: "Catéter PICC",
  DATOS_ERRADOS: "Datos errados de ubicación",
  ACTUALIZACION_DATOS: "Actualización de datos",
  INICIO_TRATAMIENTO_PRIORITARIO: "Inicio de tratamiento prioritario",
  PRORROGA_CAMBIO_ADICION_TRATAMIENTO: "Prórroga, cambio o adición de tratamiento",
};

function nombreCompleto(u: any) {
  return `${u?.nombres ?? ""} ${u?.primerApellido ?? ""} ${u?.segundoApellido ?? ""}`
    .replace(/\s+/g, " ")
    .trim();
}

function safeStr(v: any) {
  return (v ?? "").toString().trim();
}

function escapeHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function etiquetaTipoPaciente(tipo: string | null) {
  return tipo ? TIPOS_PACIENTE_LABEL[tipo] ?? tipo : null;
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const usuarioActual = session.user as any;
  const rol = String(usuarioActual?.rol || "");
  const usuarioId = String(usuarioActual?.id || "");

  const { id } = await params;
  try {
    const body = await req.json();
    const tieneCampoFarmaciaCorregida = Object.prototype.hasOwnProperty.call(body ?? {}, "farmaciaCorregida");

    if (rol === "FARMACIA") {
      if (!tieneCampoFarmaciaCorregida) {
        return NextResponse.json(
          { error: "Debe indicar el campo farmaciaCorregida para actualizar la novedad" },
          { status: 400 }
        );
      }

      if (typeof body?.farmaciaCorregida !== "boolean") {
        return NextResponse.json(
          { error: "El campo farmaciaCorregida debe ser verdadero o falso" },
          { status: 400 }
        );
      }

      const novedadFarmacia = await prisma.novedad.findUnique({
        where: { id },
        select: {
          id: true,
          categoria: true,
          usuarioId: true,
        },
      });

      if (!novedadFarmacia) {
        return NextResponse.json({ error: "Novedad no encontrada" }, { status: 404 });
      }

      if (novedadFarmacia.categoria !== "PROCESO_FARMACEUTICO" || novedadFarmacia.usuarioId !== usuarioId) {
        return NextResponse.json(
          { error: "Solo puedes marcar tus propias novedades de proceso farmaceutico" },
          { status: 403 }
        );
      }

      const farmaciaCorregida = Boolean(body.farmaciaCorregida);
      const updated = await prisma.novedad.update({
        where: { id },
        data: {
          farmaciaCorregida,
          farmaciaCorregidaAt: farmaciaCorregida ? new Date() : null,
        } as any,
      });

      return NextResponse.json({ ok: true, novedad: updated });
    }

    if (!(rol === "ADMINISTRATIVO" || rol === "TECNICO")) {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    if (tieneCampoFarmaciaCorregida || Object.prototype.hasOwnProperty.call(body ?? {}, "farmaciaCorregidaAt")) {
      return NextResponse.json(
        { error: "El campo de novedad corregida solo puede actualizarlo el rol farmacia desde Mis novedades" },
        { status: 403 }
      );
    }

    const { estado, prioridad, asignadoA, notasInternas, respuestaPrestador, responsableGestion } = body ?? {};
    const esAdmin = rol === "ADMINISTRATIVO";
    const nombreUsuarioActual = nombreCompleto(usuarioActual) || usuarioActual?.username || "";

    const novedadActual = await prisma.novedad.findUnique({
      where: { id },
      select: {
        id: true,
        estado: true,
        asignadoA: true,
        prestadorNombre: true,
        categoria: true,
        tipoPaciente: true,
        tipoRuta: true,
        tipoFarmacia: true,
        usuario: {
          select: {
            email: true,
          },
        },
      },
    });
    if (!novedadActual) {
      return NextResponse.json({ error: "Novedad no encontrada" }, { status: 404 });
    }

    const asignadoActual = String(novedadActual.asignadoA || "").trim() || null;
    const asignadoNuevo = typeof asignadoA !== "undefined"
      ? String(asignadoA || "").trim() || null
      : undefined;
    const asignadoFinal = typeof asignadoNuevo === "undefined" ? asignadoActual : asignadoNuevo;
    const estadoNormalizado =
      typeof estado !== "undefined" ? String(estado || "").trim().toUpperCase() : undefined;
    const responsableGestionNormalizado =
      typeof responsableGestion !== "undefined"
        ? String(responsableGestion || "").trim().toUpperCase()
        : undefined;

    if (typeof estadoNormalizado !== "undefined" && !ESTADOS_GESTION_VALIDOS.has(estadoNormalizado)) {
      return NextResponse.json(
        { error: "El estado solo puede ser PENDIENTE o RESUELTA" },
        { status: 400 }
      );
    }

    if (
      typeof responsableGestionNormalizado !== "undefined" &&
      responsableGestionNormalizado !== "" &&
      !RESPONSABLES_GESTION_VALIDOS.has(responsableGestionNormalizado)
    ) {
      return NextResponse.json(
        { error: "El responsable debe ser ADMISIONES, ANALISTA_ASISTENCIAL o CLINICA_HERIDAS" },
        { status: 400 }
      );
    }

    if (!esAdmin) {
      if (!asignadoFinal) {
        return NextResponse.json(
          { error: "Debes tomar la novedad antes de guardar cambios" },
          { status: 400 }
        );
      }

      // Solo administrativo puede cambiar/desasignar una novedad ya tomada.
      if (asignadoActual && typeof asignadoNuevo !== "undefined" && asignadoNuevo !== asignadoActual) {
        return NextResponse.json(
          { error: "Solo el rol administrativo puede cambiar o desasignar la novedad" },
          { status: 403 }
        );
      }

      // Si no estaba asignada, técnico debe tomarla a su nombre.
      if (!asignadoActual) {
        if (typeof asignadoNuevo === "undefined") {
          return NextResponse.json(
            { error: "Debes usar 'Tomar novedad' antes de guardar cambios" },
            { status: 400 }
          );
        }

        if (asignadoNuevo !== nombreUsuarioActual) {
          return NextResponse.json(
            { error: "Solo puedes tomar la novedad a tu propio nombre" },
            { status: 403 }
          );
        }
      }
    }

    const data: any = {};
    if (typeof estadoNormalizado !== "undefined") data.estado = estadoNormalizado;
    if (prioridad) data.prioridad = prioridad;
    if (typeof asignadoA !== "undefined") data.asignadoA = asignadoNuevo;
    if (typeof responsableGestionNormalizado !== "undefined") {
      data.responsableGestion = responsableGestionNormalizado || null;
    }
    if (typeof notasInternas !== "undefined") data.notasInternas = String(notasInternas || "").trim() || null;
    if (typeof respuestaPrestador !== "undefined") {
      data.respuestaPrestador = String(respuestaPrestador || "").trim() || null;
    }

    const updated = await prisma.novedad.update({ where: { id }, data });

    // Confirmacion al prestador cuando la novedad pasa a estado RESUELTA.
    const estadoPrevio = novedadActual.estado;
    const estadoFinal = updated.estado;
    const seCerroAhora = estadoPrevio !== "RESUELTA" && estadoFinal === "RESUELTA";
    if (seCerroAhora) {
      const emailPrestador = safeStr(novedadActual.usuario?.email);
      if (emailPrestador) {
        const prestadorNombre = safeStr(novedadActual.prestadorNombre) || "prestador";
        const respuestaPrestadorFinal = safeStr(data.respuestaPrestador) || "Sin respuesta registrada.";
        const tipoNovedad =
          novedadActual.categoria === "PACIENTE"
            ? etiquetaTipoPaciente(novedadActual.tipoPaciente)
            : novedadActual.categoria === "RUTA"
            ? novedadActual.tipoRuta
            : novedadActual.tipoFarmacia;

        const text = [
          `Hola ${prestadorNombre},`,
          ``,
          `Te confirmamos que tu novedad ya fue gestionada y cerrada.`,
          ``,
          `Numero de radicado: ${updated.id}`,
          `Estado final: RESUELTA`,
          tipoNovedad ? `Tipo: ${tipoNovedad}` : null,
          `Respuesta al prestador de salud: ${respuestaPrestadorFinal}`,
          ``,
          `Gracias.`,
        ]
          .filter(Boolean)
          .join("\n");

        const html = `
          <div style="font-family: Arial, sans-serif; line-height: 1.5; max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 16px; box-shadow: 0 5px 20px rgba(0,20,50,0.1); overflow: hidden;">
            <div style="background: linear-gradient(135deg, #e80214 0%, #e80214 100%); padding: 25px 30px; text-align: center;">
              <div style="display:inline-block; background-color:white; border-radius:50px; padding:12px 25px; box-shadow:0 4px 12px rgba(0,0,0,0.1);">
                <span style="font-size:24px; font-weight:700; color:#0a4b7a;">Especialistas</span>
                <span style="font-size:24px; font-weight:300; color:#1a7faa;"> En Casa</span>
                <div style="font-size:14px; font-weight:500; color:#3a3a3a; letter-spacing:1px; margin-top:2px;">SALUD DOMICILIARIA</div>
              </div>
            </div>
            <div style="padding: 30px 30px 25px 30px;">
              <p style="margin:0 0 20px 0; font-size:18px; color:#1e2b3c;">
                Hola <strong style="color:#0a4b7a;">${escapeHtml(prestadorNombre)}</strong>,
              </p>
              <table cellpadding="0" cellspacing="0" border="0" style="margin-bottom:25px;">
                <tr>
                  <td style="background:#e6f7e6; border-radius:40px; padding:15px 25px;">
                    <span style="font-size:18px; font-weight:600; color:#2e7d32;">Tu novedad ha sido cerrada correctamente</span>
                  </td>
                </tr>
              </table>
              <p style="margin:0 0 15px 0; font-size:16px; color:#2c3e50;">
                Tu novedad fue gestionada por el equipo encargado y ya se encuentra en estado <strong>RESUELTA</strong>.
              </p>
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f6fbff; border-left:5px solid #1a7faa; border-radius:12px; margin:20px 0;">
                <tr>
                  <td style="padding:16px 18px;">
                    <span style="font-size:15px; color:#0a4b7a; font-weight:600;">Respuesta al prestador de salud</span>
                    <div style="font-size:15px; color:#2c3e50; margin-top:6px; white-space:pre-wrap;">${escapeHtml(respuestaPrestadorFinal)}</div>
                  </td>
                </tr>
              </table>
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f0f8ff; border-left:5px solid #e80214; border-radius:12px; margin:25px 0;">
                <tr>
                  <td style="padding:18px 20px;">
                    <span style="font-size:16px; color:#0a4b7a; font-weight:600;">Numero de radicado:</span>
                    <div style="font-size:24px; font-weight:700; color:#0a4b7a; letter-spacing:1px; margin-top:5px;">${escapeHtml(String(updated.id))}</div>
                  </td>
                </tr>
              </table>
              <p style="margin:20px 0 10px 0; font-size:16px; color:#2c3e50;">
                Gracias por confiar en <strong>Especialistas En Casa</strong>.
              </p>
            </div>
            <div style="background:#f0f5fa; padding:15px 30px; text-align:center; border-top:1px solid #d0ddee;">
              <p style="margin:0; font-size:12px; color:#6b7a8a;">
                Este es un mensaje automatico, por favor no responder.<br>
                &copy; ${new Date().getFullYear()} Especialistas En Casa
              </p>
            </div>
          </div>
        `.trim();

        try {
          await sendGraphMail({
            to: emailPrestador,
            subject: "Confirmacion: tu novedad fue cerrada",
            text,
            html,
          });
        } catch (mailErr) {
          console.error("No se pudo enviar correo de cierre al prestador:", mailErr);
        }
      } else {
        console.warn("Prestador sin email registrado: no se envia confirmacion de cierre. novedadId=", updated.id);
      }
    }

    try {
      await notificarNovedadesFarmaciaSinGestion();
    } catch (error) {
      console.error("No se pudo procesar alerta de novedades farmacia sin gestionar:", error);
    }

    return NextResponse.json({ ok: true, novedad: updated });
  } catch (error) {
    console.error("Error actualizando novedad:", error);
    return NextResponse.json({ error: "Error actualizando la novedad" }, { status: 500 });
  }
}
