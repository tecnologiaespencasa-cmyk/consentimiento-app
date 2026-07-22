import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import { prisma } from "@/lib/prisma";
import { FrecuenciaRonda, MedidaRonda, TipoDocumentoRonda, ViaAdministracionRonda } from "@prisma/client";

const ROLES_RONDA = ["MEDICO_RONDA", "TECNICO", "ADMINISTRATIVO"];
const TIPOS_DOCUMENTO = ["CC", "RC", "PA", "CE", "TI", "PE", "PPT"] as const;
const MEDIDAS = ["MILIGRAMOS", "GRAMOS", "UNIDADES", "GOTAS", "MILILITROS"] as const;
const VIAS = ["INTRAVENOSA", "INTRAMUSCULAR", "SUBCUTANEA", "NEBULIZADA", "ORAL"] as const;
const FRECUENCIAS = ["INFUSION_CONTINUA", "CADA_4_HORAS", "CADA_6_HORAS", "CADA_8_HORAS", "CADA_12_HORAS", "CADA_24_HORAS", "CADA_48_HORAS", "CADA_72_HORAS", "NO_APLICA"] as const;
const NOMBRE_REGEX = /^[A-Za-zÀ-ÖØ-öø-ÿÑñ ]+$/;
const CIE10_REGEX = /^[A-Z][0-9]{3}$/;

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
    const eps = texto(body?.eps, 150);
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
    if (!eps) return NextResponse.json({ error: "La EPS es obligatoria." }, { status: 400 });
    if (!CIE10_REGEX.test(cie10Codigo)) return NextResponse.json({ error: "El CIE-10 debe tener una letra seguida de tres números." }, { status: 400 });
    if (!Array.isArray(medicamentos) || medicamentos.length < 1 || medicamentos.length > 6) {
      return NextResponse.json({ error: "Registra entre uno y seis medicamentos." }, { status: 400 });
    }

    const cie10 = await prisma.cie10Catalogo.findUnique({ where: { codigo: cie10Codigo } });
    if (!cie10) return NextResponse.json({ error: "El código CIE-10 no existe en el catálogo." }, { status: 400 });

    const nombresMedicamentos = medicamentos.map((m: unknown) => texto((m as Record<string, unknown>)?.nombre, 250));
    if (nombresMedicamentos.some((nombre: string) => !nombre)) return NextResponse.json({ error: "Selecciona un medicamento válido en cada fila." }, { status: 400 });
    const catalogo = await prisma.medicamentoCatalogo.findMany({ select: { nombre: true } });
    const nombresCatalogo = new Set(catalogo.map((medicamento) => medicamento.nombre.toUpperCase()));
    if (nombresMedicamentos.some((nombre) => !nombresCatalogo.has(nombre))) return NextResponse.json({ error: "Uno o más medicamentos no pertenecen al catálogo." }, { status: 400 });

    const detalles = medicamentos.map((medicamento: Record<string, unknown>, index: number) => {
      const dosis = texto(medicamento.dosis, 80);
      const medida = texto(medicamento.medida, 30);
      const viaAdministracion = texto(medicamento.viaAdministracion, 30);
      const frecuencia = texto(medicamento.frecuencia, 30);
      const dias = Number(medicamento.dias);
      if (!dosis || !MEDIDAS.includes(medida as typeof MEDIDAS[number]) || !VIAS.includes(viaAdministracion as typeof VIAS[number]) || !FRECUENCIAS.includes(frecuencia as typeof FRECUENCIAS[number]) || !Number.isInteger(dias) || dias < 1 || dias > 3650) {
        throw new Error(`Medicamento ${index + 1} inválido.`);
      }
      return { nombre: nombresMedicamentos[index], dosis, medida: medida as MedidaRonda, viaAdministracion: viaAdministracion as ViaAdministracionRonda, frecuencia: frecuencia as FrecuenciaRonda, dias, orden: index + 1 };
    });

    const ronda = await prisma.rondaIntramural.create({
      data: {
        pacienteNombre,
        pacienteTipoDoc: pacienteTipoDoc as TipoDocumentoRonda,
        pacienteDocumento,
        eps,
        cie10Codigo,
        diagnosticoDescriptivo: cie10.descripcion,
        otros,
        usuarioId: session.user.id,
        medicamentos: { create: detalles },
      },
    });
    return NextResponse.json({ ok: true, id: ronda.id }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("Medicamento")) return NextResponse.json({ error: error.message }, { status: 400 });
    console.error("Error creando ronda intramural:", error);
    return NextResponse.json({ error: "No fue posible registrar la ronda." }, { status: 500 });
  }
}
