import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import { prisma } from "@/lib/prisma";

const ROLES_EXPORTACION = ["ADMINISTRATIVO", "TECNICO"];

// Los campos de texto libre (otros, observaciones, diagnóstico) pueden traer saltos de línea:
// dentro del CSV parten el registro en varias filas y Excel pierde la alineación de columnas.
function csvEscape(value: unknown) {
  const raw = value == null ? "" : String(value);
  const plano = raw.replace(/\r\n|[\r\n]/g, " ").replace(/[ \t]+/g, " ").trim();
  return `"${plano.replace(/"/g, '""')}"`;
}

const formatoFecha = new Intl.DateTimeFormat("es-CO", {
  timeZone: "America/Bogota",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: false,
});

// dd/MM/yyyy HH:mm:ss sin coma, para que Excel lo reconozca como fecha y permita filtrar y ordenar.
function fecha(value: Date) {
  const partes = formatoFecha.formatToParts(value).reduce<Record<string, string>>((acc, parte) => {
    if (parte.type !== "literal") acc[parte.type] = parte.value;
    return acc;
  }, {});
  const hora = partes.hour === "24" ? "00" : partes.hour;
  return `${partes.day}/${partes.month}/${partes.year} ${hora}:${partes.minute}:${partes.second}`;
}

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return Response.json({ error: "No autorizado" }, { status: 401 });
  if (!ROLES_EXPORTACION.includes(session.user.rol)) return Response.json({ error: "No autorizado" }, { status: 403 });

  const rondas = await prisma.rondaIntramural.findMany({
    include: {
      medicamentos: { orderBy: { orden: "asc" } },
      usuario: { select: { id: true, username: true, nombres: true, primerApellido: true, segundoApellido: true, rol: true, email: true, telefono: true, cedula: true, profesion: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  const columns = [
    "ID reporte", "Fecha de registro", "Fecha de última actualización", "Nombre del paciente", "Tipo de identificación", "Número de identificación", "IPS", "Código CIE-10", "Diagnóstico descriptivo", "Ingreso efectivo", "Causa de no ingreso", "Observación de no ingreso", "Otros",
    "Medicamento 1", "Medicamento 2", "Medicamento 3", "Medicamento 4", "Medicamento 5", "Medicamento 6",
    "ID usuario reporta", "Usuario reporta", "Nombres usuario reporta", "Primer apellido usuario reporta", "Segundo apellido usuario reporta", "Rol usuario reporta", "Correo usuario reporta", "Teléfono usuario reporta", "Cédula usuario reporta", "Profesión usuario reporta",
  ];

  const rows = rondas.map((ronda) => {
    const medicamentos = Array.from({ length: 6 }, (_, index) => ronda.medicamentos[index]?.nombre ?? "");
    return [
      ronda.id, fecha(ronda.createdAt), fecha(ronda.updatedAt), ronda.pacienteNombre, ronda.pacienteTipoDoc, ronda.pacienteDocumento, ronda.ips, ronda.cie10Codigo, ronda.diagnosticoDescriptivo,
      ronda.ingresoEfectivo === null ? "SIN GESTIÓN" : ronda.ingresoEfectivo ? "SÍ" : "NO", ronda.causaNoIngreso ?? "", ronda.observacionNoIngreso ?? "", ronda.otros ?? "", ...medicamentos,
      ronda.usuario.id, ronda.usuario.username, ronda.usuario.nombres, ronda.usuario.primerApellido, ronda.usuario.segundoApellido ?? "", ronda.usuario.rol, ronda.usuario.email ?? "", ronda.usuario.telefono ?? "", ronda.usuario.cedula, ronda.usuario.profesion,
    ];
  });

  const csv = [columns.map(csvEscape).join(";"), ...rows.map((row) => row.map(csvEscape).join(";"))].join("\r\n");
  const stamp = new Date().toISOString().slice(0, 10);
  return new Response(`\uFEFF${csv}`, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="rondas_intramurales_${stamp}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
