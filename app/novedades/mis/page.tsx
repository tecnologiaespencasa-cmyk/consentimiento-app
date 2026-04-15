import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import Link from "next/link";
import { FaArrowLeft, FaListAlt, FaClock, FaCheckCircle } from "react-icons/fa";
import FarmaciaCorregidaToggle from "./FarmaciaCorregidaToggle";

const TIPOS_FARMACIA_LABEL: Record<string, string> = {
  ERROR_KARDEX: "Error en kardex",
  ERROR_REQUISICION: "Error en requisicion",
  ERROR_AUTORIZACION: "Error en autorizacion",
  ERROR_AUXILIAR_ASIGNADO: "Error en auxiliar asignado",
  ERROR_FORMULA: "Error en la formula",
  ERROR_TODOS_LOS_DOCUMENTOS: "Error en todos los documentos",
};

const ZONAS_LABEL: Record<string, string> = {
  NORTE: "Norte",
  SUR: "Sur",
  OCCIDENTE: "Occidente",
  ORIENTE: "Oriente",
  ORIENTE_ANTIOQUENO: "Oriente Antioqueño",
};

function normalizarTextoEnum(value: string) {
  return value
    .toLowerCase()
    .split("_")
    .map((p) => (p ? p[0].toUpperCase() + p.slice(1) : ""))
    .join(" ");
}

function etiquetaZona(zona: string) {
  return ZONAS_LABEL[zona] ?? normalizarTextoEnum(zona);
}

function etiquetaTipoNovedad(n: {
  categoria: string;
  tipoPaciente?: string | null;
  tipoRuta?: string | null;
  tipoFarmacia?: string | null;
}) {
  if (n.categoria === "LLAMADA_URGENTE") {
    return "Llamada urgente";
  }

  if (n.categoria === "PACIENTE") {
    return n.tipoPaciente ? normalizarTextoEnum(n.tipoPaciente) : "Sin tipo";
  }

  if (n.categoria === "RUTA") {
    return n.tipoRuta ? normalizarTextoEnum(n.tipoRuta) : "Sin tipo";
  }

  if (!n.tipoFarmacia) return "Sin tipo";
  return TIPOS_FARMACIA_LABEL[n.tipoFarmacia] ?? normalizarTextoEnum(n.tipoFarmacia);
}

function etiquetaZonaTexto(zona: string | null | undefined) {
  if (!zona) return "No aplica";
  return etiquetaZona(zona);
}

function badgeEstado(estado: string) {
  const map: Record<string, { cls: string; icon: any; label: string }> = {
    PENDIENTE: { cls: "bg-yellow-50 text-yellow-800 border-yellow-200", icon: FaClock, label: "Pendiente" },
    RESUELTA: { cls: "bg-green-50 text-green-800 border-green-200", icon: FaCheckCircle, label: "Resuelta" },
  };
  return map[estado] ?? { cls: "bg-gray-50 text-gray-700 border-gray-200", icon: FaClock, label: estado };
}

export default async function MisNovedadesPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");

  const u = session.user as any;
  const esRolFarmacia = u.rol === "FARMACIA";
  const where: any = { usuarioId: u.id };

  if (esRolFarmacia) {
    where.categoria = { in: ["PROCESO_FARMACEUTICO", "LLAMADA_URGENTE"] };
  } else if (u.rol === "ESPECIALISTA") {
    where.NOT = { categoria: "PROCESO_FARMACEUTICO" };
  }

  const novedades = await prisma.novedad.findMany({
    where,
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="min-h-screen bg-gradient-to-b from-red-50 to-white">
      <div className="container mx-auto px-4 py-6">
        <div className="flex items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-3">
            <Link
              href="/novedades"
              className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-white border border-gray-200 shadow-sm hover:bg-gray-50"
            >
              <FaArrowLeft /> Volver
            </Link>
            <h1 className="text-xl md:text-2xl font-extrabold text-gray-900 flex items-center gap-2">
              <FaListAlt className="text-blue-600" /> Mis novedades
            </h1>
          </div>
          <Link
            href="/novedades/registrar"
            className="inline-flex items-center justify-center px-4 py-2 rounded-xl bg-red-600 text-white font-bold hover:bg-red-700"
          >
            Registrar
          </Link>
        </div>

        <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-4">
          {novedades.length === 0 ? (
            <div className="p-8 text-center text-gray-600">
              Aun no has registrado novedades.
            </div>
          ) : (
            <div className="space-y-3">
              {novedades.map((n) => {
                const b = badgeEstado(n.estado);
                const Icon = b.icon;
                const categoriaLabel =
                  n.categoria === "PACIENTE"
                    ? "Paciente"
                    : n.categoria === "RUTA"
                    ? "Ruta"
                    : n.categoria === "LLAMADA_URGENTE"
                    ? "Llamada urgente"
                    : "Proceso farmaceutico";
                const tipoLabel = etiquetaTipoNovedad({
                  categoria: n.categoria,
                  tipoPaciente: n.tipoPaciente,
                  tipoRuta: n.tipoRuta,
                  tipoFarmacia: (n as { tipoFarmacia?: string | null }).tipoFarmacia,
                });
                return (
                  <div
                    key={n.id}
                    className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm hover:shadow-md transition-all"
                  >
                    <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap gap-2 text-xs text-gray-600">
                          <span className="inline-flex items-center rounded-full border border-gray-200 bg-gray-50 px-2.5 py-1">
                            Fecha: {new Date(n.createdAt).toLocaleString()}
                          </span>
                          <span className="inline-flex items-center rounded-full border border-gray-200 bg-gray-50 px-2.5 py-1">
                            ID: {n.id}
                          </span>
                        </div>

                        <div className="mt-2 flex flex-wrap gap-2">
                          <span className="inline-flex items-center rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-800">
                            Categoria: {categoriaLabel}
                          </span>
                          <span className="inline-flex items-center rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-800">
                            Tipo: {tipoLabel}
                          </span>
                        </div>

                        <div className="mt-3 rounded-xl border border-gray-200 bg-gray-50/60 p-3">
                          <p className="text-[11px] font-bold uppercase tracking-wide text-gray-500">Descripcion</p>
                          <p className="mt-1 text-sm text-gray-800 whitespace-pre-wrap">
                            {n.descripcion || "Sin descripcion"}
                          </p>
                        </div>

                        <div className="mt-3 rounded-xl border border-blue-200 bg-blue-50/50 p-3">
                          <p className="text-[11px] font-bold uppercase tracking-wide text-blue-700">
                            Respuesta al prestador de salud
                          </p>
                          <p className="mt-1 text-sm text-gray-800 whitespace-pre-wrap">
                            {(n as { respuestaPrestador?: string | null }).respuestaPrestador || "Aun no registran una respuesta para esta novedad."}
                          </p>
                        </div>

                        <div className="mt-3 flex flex-wrap gap-2 text-xs">
                          {!esRolFarmacia ? (
                            <span className="inline-flex items-center rounded-full border border-gray-200 bg-white px-3 py-1 text-gray-700">
                              Zona: {etiquetaZonaTexto((n as { zona?: string | null }).zona)}
                            </span>
                          ) : null}
                          <span className="inline-flex items-center rounded-full border border-gray-200 bg-white px-3 py-1 text-gray-700">
                            Asignado a: {n.asignadoA ? n.asignadoA : "Sin asignar"}
                          </span>
                        </div>

                        {esRolFarmacia ? (
                          <FarmaciaCorregidaToggle
                            novedadId={n.id}
                            initialValue={Boolean((n as any).farmaciaCorregida)}
                          />
                        ) : null}
                      </div>

                      <div className="flex items-center gap-2 shrink-0 lg:pt-1">
                        <span className={`inline-flex items-center gap-2 text-xs font-bold px-3 py-2 rounded-full border ${b.cls}`}>
                          <Icon /> {b.label}
                        </span>
                        <span className="inline-flex items-center text-xs font-bold px-3 py-2 rounded-full border bg-gray-50 text-gray-700 border-gray-200">
                          Prioridad: {n.prioridad}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

