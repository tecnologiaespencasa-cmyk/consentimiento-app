import { formatBogotaDateTime } from "@/lib/bogotaDate";
import { prisma } from "@/lib/prisma";
import { sendGraphMail } from "@/lib/sendGraphMail";

const DESTINO_REPORTE_TRATAMIENTOS = "gerencia@especialistasencasa.com";
const TIPO_PACIENTE_TRATAMIENTO = "PRORROGA_CAMBIO_ADICION_TRATAMIENTO";

function escapeHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function safeStr(v: unknown) {
  return (v ?? "").toString().trim();
}

function fmtFecha(value: Date) {
  return formatBogotaDateTime(value, "es-CO", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

export async function notificarReporteTratamientosPendientes() {
  const pendientes = await prisma.novedad.findMany({
    where: {
      categoria: "PACIENTE",
      tipoPaciente: TIPO_PACIENTE_TRATAMIENTO,
      estado: "PENDIENTE",
    },
    select: {
      id: true,
      createdAt: true,
      prestadorNombre: true,
      prestadorCedula: true,
      zona: true,
      pacienteNombre: true,
      pacienteTipoDoc: true,
      pacienteDocumento: true,
      medicamentoNombre1: true,
      medicamentoNombre2: true,
      medicamentoNombre3: true,
      descripcion: true,
      prioridad: true,
      asignadoA: true,
    },
    orderBy: { createdAt: "asc" },
  });

  const generadoEn = fmtFecha(new Date());
  const baseUrl = process.env.NEXTAUTH_URL || "";
  const linkAdmin = baseUrl ? `${baseUrl}/novedades/todas` : "/novedades/todas";
  const subject = `Reporte diario - tratamientos pendientes (${pendientes.length})`;

  const detalleTexto = pendientes.length
    ? pendientes
        .map((n, index) =>
          [
            `${index + 1}. Radicado: ${n.id}`,
            `   Fecha reporte: ${fmtFecha(n.createdAt)}`,
            `   Prestador: ${n.prestadorNombre} - CC ${n.prestadorCedula}`,
            `   Paciente: ${safeStr(n.pacienteNombre)} (${safeStr(n.pacienteTipoDoc)} ${safeStr(n.pacienteDocumento)})`,
            `   Medicamentos: ${[n.medicamentoNombre1, n.medicamentoNombre2, n.medicamentoNombre3].map(safeStr).filter(Boolean).join(" | ") || "No registrados"}`,
            `   Zona: ${safeStr(n.zona) || "No registrada"}`,
            `   Prioridad: ${n.prioridad}`,
            `   Asignado a: ${safeStr(n.asignadoA) || "Sin asignar"}`,
            `   Descripcion: ${safeStr(n.descripcion) || "Sin descripcion"}`,
          ].join("\n")
        )
        .join("\n\n")
    : "No hay novedades pendientes de prorroga, cambio o adicion de tratamiento.";

  const text = [
    "Cordial saludo,",
    "",
    `Reporte diario generado el ${generadoEn} (hora Colombia).`,
    "",
    `Total de novedades pendientes: ${pendientes.length}`,
    "",
    detalleTexto,
    "",
    `Panel de gestion: ${linkAdmin}`,
    "",
    "Este es un correo automatico de Especialistas en casa.",
  ].join("\n");

  const filasHtml = pendientes.length
    ? pendientes
        .map((n) => {
          const pacienteIdentificacion = `${safeStr(n.pacienteTipoDoc)} ${safeStr(n.pacienteDocumento)}`.trim();
          const medicamentos = [n.medicamentoNombre1, n.medicamentoNombre2, n.medicamentoNombre3]
            .map(safeStr)
            .filter(Boolean)
            .join("<br>");

          return `
            <tr>
              <td style="padding:10px; border-bottom:1px solid #e5e7eb; vertical-align:top;"><strong>${escapeHtml(n.id)}</strong><br><span style="color:#64748b;">${escapeHtml(fmtFecha(n.createdAt))}</span></td>
              <td style="padding:10px; border-bottom:1px solid #e5e7eb; vertical-align:top;">${escapeHtml(safeStr(n.prestadorNombre))}<br><span style="color:#64748b;">CC ${escapeHtml(safeStr(n.prestadorCedula))}</span></td>
              <td style="padding:10px; border-bottom:1px solid #e5e7eb; vertical-align:top;">${escapeHtml(safeStr(n.pacienteNombre))}<br><span style="color:#64748b;">${escapeHtml(pacienteIdentificacion)}</span></td>
              <td style="padding:10px; border-bottom:1px solid #e5e7eb; vertical-align:top;">${medicamentos || "No registrados"}</td>
              <td style="padding:10px; border-bottom:1px solid #e5e7eb; vertical-align:top;">${escapeHtml(safeStr(n.zona) || "No registrada")}</td>
              <td style="padding:10px; border-bottom:1px solid #e5e7eb; vertical-align:top;">${escapeHtml(n.prioridad)}<br><span style="color:#64748b;">${escapeHtml(safeStr(n.asignadoA) || "Sin asignar")}</span></td>
            </tr>
          `;
        })
        .join("")
    : `
      <tr>
        <td colspan="6" style="padding:18px; text-align:center; color:#047857; background:#ecfdf5; border:1px solid #a7f3d0;">
          No hay novedades pendientes de prorroga, cambio o adicion de tratamiento.
        </td>
      </tr>
    `;

  const html = `
    <div style="font-family: Arial, sans-serif; color:#1f2937; line-height:1.5;">
      <h2 style="margin:0 0 8px 0; color:#0f172a;">Reporte diario de tratamientos pendientes</h2>
      <p style="margin:0 0 14px 0;">Generado el <strong>${escapeHtml(generadoEn)}</strong> (hora Colombia).</p>
      <div style="display:inline-block; padding:10px 14px; margin-bottom:18px; border-radius:10px; background:#eff6ff; color:#1d4ed8; font-weight:700;">
        Total pendientes: ${pendientes.length}
      </div>
      <table cellpadding="0" cellspacing="0" style="width:100%; border-collapse:collapse; border:1px solid #e5e7eb;">
        <thead>
          <tr style="background:#f8fafc; color:#334155;">
            <th align="left" style="padding:10px; border-bottom:1px solid #e5e7eb;">Radicado</th>
            <th align="left" style="padding:10px; border-bottom:1px solid #e5e7eb;">Prestador</th>
            <th align="left" style="padding:10px; border-bottom:1px solid #e5e7eb;">Paciente</th>
            <th align="left" style="padding:10px; border-bottom:1px solid #e5e7eb;">Medicamentos</th>
            <th align="left" style="padding:10px; border-bottom:1px solid #e5e7eb;">Zona</th>
            <th align="left" style="padding:10px; border-bottom:1px solid #e5e7eb;">Gestion</th>
          </tr>
        </thead>
        <tbody>${filasHtml}</tbody>
      </table>
      <p style="margin-top:18px;">Panel de gestion: <a href="${escapeHtml(linkAdmin)}" style="color:#1d4ed8;">${escapeHtml(linkAdmin)}</a></p>
      <p style="margin-top:18px; color:#64748b;">Este es un correo automatico de Especialistas en casa.</p>
    </div>
  `.trim();

  await sendGraphMail({
    to: DESTINO_REPORTE_TRATAMIENTOS,
    subject,
    text,
    html,
  });

  return { pendientes: pendientes.length };
}
