import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import { prisma } from "@/lib/prisma";
import { TipoDocumentoRonda } from "@prisma/client";
import { IPS_OPCIONES } from "@/app/rondas/opciones";

const ROLES_RONDA = ["MEDICO_RONDA", "TECNICO", "ADMINISTRATIVO"];
const TIPOS_DOCUMENTO = ["CC", "RC", "PA", "CE", "TI", "PE", "PPT"] as const;
const NOMBRE_REGEX = /^[A-Za-zÀ-ÖØ-öø-ÿÑñ ]+$/;
const CIE10_REGEX = /^[A-Z][0-9]{3}$/;
const FECHA_REGEX = /^\d{4}-\d{2}-\d{2}$/;

function texto(value: unknown, max: number) {
  return typeof value === "string" ? value.trim().slice(0, max).toUpperCase() : "";
}

function tieneAcceso(rol: unknown) {
  return ROLES_RONDA.includes(String(rol));
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  if (!tieneAcceso(session.user.rol)) return NextResponse.json({ error: "No tienes acceso a Rondas" }, { status: 403 });

  try {
    const body = await req.json();
    const pacienteNombre = texto(body?.pacienteNombre, 180).replace(/\s+/g, " ");
    const pacienteTipoDoc = texto(body?.pacienteTipoDoc, 3);
    const pacienteDocumento = texto(body?.pacienteDocumento, 30);
    const ips = texto(body?.ips, 150);
    const fechaIngresoRaw = typeof body?.fechaIngreso === "string" ? body.fechaIngreso.trim() : "";
    const cie10Codigo = texto(body?.cie10Codigo, 4).toUpperCase();
    const otros = texto(body?.otros, 2000) || null;
    const medicamentos = Array.isArray(body?.medicamentos) ? body.medicamentos : [];

    if (!pacienteNombre || !NOMBRE_REGEX.test(pacienteNombre)) {
      return NextResponse.json({ error: "El nombre del paciente solo admite letras, espacios y tildes." }, { status: 400 });
    }
    if (!TIPOS_DOCUMENTO.includes(pacienteTipoDoc as typeof TIPOS_DOCUMENTO[number])) {
      return NextResponse.json({ error: "Tipo de identificación inválido." }, { status: 400 });
    }
    const documentoValido = ["PA", "CE"].includes(pacienteTipoDoc)
      ? /^[A-Za-z0-9]+$/.test(pacienteDocumento)
      : /^[0-9]+$/.test(pacienteDocumento);
    if (!documentoValido) return NextResponse.json({ error: "El número de identificación no tiene un formato válido." }, { status: 400 });
    if (!(IPS_OPCIONES as readonly string[]).includes(ips)) return NextResponse.json({ error: "Selecciona una IPS de la lista." }, { status: 400 });
    if (!FECHA_REGEX.test(fechaIngresoRaw)) return NextResponse.json({ error: "La fecha de ingreso no es válida." }, { status: 400 });
    const fechaIngreso = new Date(`${fechaIngresoRaw}T00:00:00.000Z`);
    if (Number.isNaN(fechaIngreso.getTime())) return NextResponse.json({ error: "La fecha de ingreso no es válida." }, { status: 400 });
    const hoyBogota = new Date(`${new Date().toLocaleDateString("en-CA", { timeZone: "America/Bogota" })}T00:00:00.000Z`);
    if (fechaIngreso.getTime() > hoyBogota.getTime()) return NextResponse.json({ error: "La fecha de ingreso no puede ser futura." }, { status: 400 });
    if (!CIE10_REGEX.test(cie10Codigo)) return NextResponse.json({ error: "El CIE-10 debe tener una letra seguida de tres números." }, { status: 400 });
    if (!Array.isArray(medicamentos) || medicamentos.length > 6) {
      return NextResponse.json({ error: "Puedes registrar hasta seis medicamentos." }, { status: 400 });
    }

    const cie10 = await prisma.cie10Catalogo.findUnique({ where: { codigo: cie10Codigo } });
    if (!cie10) return NextResponse.json({ error: "El código CIE-10 no existe en el catálogo." }, { status: 400 });

    const nombresMedicamentos = medicamentos.map((m: unknown) => texto((m as Record<string, unknown>)?.nombre, 250));
    if (nombresMedicamentos.some((nombre: string) => !nombre)) return NextResponse.json({ error: "Selecciona un medicamento válido en cada fila." }, { status: 400 });
    if (nombresMedicamentos.length) {
      const catalogo = await prisma.medicamentoCatalogo.findMany({ select: { nombre: true } });
      const nombresCatalogo = new Set(catalogo.map((medicamento) => medicamento.nombre.toUpperCase()));
      if (nombresMedicamentos.some((nombre) => !nombresCatalogo.has(nombre))) return NextResponse.json({ error: "Uno o más medicamentos no pertenecen al catálogo." }, { status: 400 });
    }

    const detalles = nombresMedicamentos.map((nombre, index) => ({ nombre, orden: index + 1 }));

    const ronda = await prisma.rondaIntramural.create({
      data: {
        pacienteNombre,
        pacienteTipoDoc: pacienteTipoDoc as TipoDocumentoRonda,
        pacienteDocumento,
        ips,
        fechaIngreso,
        cie10Codigo,
        diagnosticoDescriptivo: cie10.descripcion,
        otros,
        usuarioId: session.user.id,
        medicamentos: { create: detalles },
      },
    });
    return NextResponse.json({ ok: true, id: ronda.id }, { status: 201 });
  } catch (error) {
    console.error("Error creando ronda intramural:", error);
    return NextResponse.json({ error: "No fue posible registrar la ronda." }, { status: 500 });
  }
}
