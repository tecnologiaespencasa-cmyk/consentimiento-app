import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import { prisma } from "@/lib/prisma";

const ROLES_EXPORTACION = ["ADMINISTRATIVO", "TECNICO"];

function csvEscape(value: unknown) {
  const raw = value == null ? "" : String(value);
  return `"${raw.replace(/"/g, '""')}"`;
}

function fecha(value: Date) {
  return new Intl.DateTimeFormat("es-CO", {
    timeZone: "America/Bogota",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(value);
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
    "ID reporte", "Fecha de registro", "Fecha de última actualización", "Nombre del paciente", "Tipo de identificación", "Número de identificación", "IPS", "Código CIE-10", "Diagnóstico descriptivo", "Ingreso efectivo", "Otros",
    "Medicamento 1", "Medicamento 2", "Medicamento 3", "Medicamento 4", "Medicamento 5", "Medicamento 6",
    "ID usuario reporta", "Usuario reporta", "Nombres usuario reporta", "Primer apellido usuario reporta", "Segundo apellido usuario reporta", "Rol usuario reporta", "Correo usuario reporta", "Teléfono usuario reporta", "Cédula usuario reporta", "Profesión usuario reporta",
  ];

  const rows = rondas.map((ronda) => {
    const medicamentos = Array.from({ length: 6 }, (_, index) => ronda.medicamentos[index]?.nombre ?? "");
    return [
      ronda.id, fecha(ronda.createdAt), fecha(ronda.updatedAt), ronda.pacienteNombre, ronda.pacienteTipoDoc, ronda.pacienteDocumento, ronda.ips, ronda.cie10Codigo, ronda.diagnosticoDescriptivo,
      ronda.ingresoEfectivo === null ? "SIN GESTIÓN" : ronda.ingresoEfectivo ? "SÍ" : "NO", ronda.otros ?? "", ...medicamentos,
      ronda.usuario.id, ronda.usuario.username, ronda.usuario.nombres, ronda.usuario.primerApellido, ronda.usuario.segundoApellido ?? "", ronda.usuario.rol, ronda.usuario.email ?? "", ronda.usuario.telefono ?? "", ronda.usuario.cedula, ronda.usuario.profesion,
    ];
  });

  const csv = [columns.map(csvEscape).join(";"), ...rows.map((row) => row.map(csvEscape).join(";"))].join("\n");
  const stamp = new Date().toISOString().slice(0, 10);
  return new Response(`\uFEFF${csv}`, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="rondas_intramurales_${stamp}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
