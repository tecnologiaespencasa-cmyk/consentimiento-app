"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { toast } from "react-hot-toast";
import {
  FaArrowLeft,
  FaFilter,
  FaSearch,
  FaSync,
  FaExclamationTriangle,
  FaClock,
  FaSpinner,
  FaCheckCircle,
  FaUser,
  FaMapMarkedAlt,
  FaPen,
  FaTimes,
} from "react-icons/fa";

type Novedad = any;

const ZONAS = [
  "NORORIENTAL",
  "NOROCCIDENTAL",
  "CENTRO_ORIENTAL",
  "CENTRO_OCCIDENTAL",
  "SURORIENTAL",
  "SUROCCIDENTAL",
];

const ESTADOS = ["PENDIENTE", "EN_PROCESO", "RESUELTA"];
const PRIORIDADES = ["BAJA", "MEDIA", "ALTA"];

function fmtDate(d: any) {
  try {
    return new Date(d).toLocaleString();
  } catch {
    return "-";
  }
}

function nombreCompleto(u: any) {
  return `${u?.nombres ?? ""} ${u?.primerApellido ?? ""} ${u?.segundoApellido ?? ""}`
    .replace(/\s+/g, " ")
    .trim();
}

function estadoBadge(estado: string) {
  const map: Record<string, { cls: string; icon: any; label: string }> = {
    PENDIENTE: { cls: "bg-yellow-50 text-yellow-800 border-yellow-200", icon: FaClock, label: "Pendiente" },
    EN_PROCESO: { cls: "bg-blue-50 text-blue-800 border-blue-200", icon: FaSpinner, label: "En proceso" },
    RESUELTA: { cls: "bg-green-50 text-green-800 border-green-200", icon: FaCheckCircle, label: "Resuelta" },
  };
  return map[estado] ?? { cls: "bg-gray-50 text-gray-700 border-gray-200", icon: FaClock, label: estado };
}

export default function AdminNovedades({ initialNovedades }: { initialNovedades: Novedad[] }) {
  const [data, setData] = useState<Novedad[]>(initialNovedades ?? []);
  const [showFilters, setShowFilters] = useState(true);

  // filtros
  const [q, setQ] = useState("");
  const [categoria, setCategoria] = useState<"" | "PACIENTE" | "RUTA">("");
  const [estado, setEstado] = useState<string>("");
  const [prioridad, setPrioridad] = useState<string>("");
  const [zona, setZona] = useState<string>("");
  const [desde, setDesde] = useState<string>("");
  const [hasta, setHasta] = useState<string>("");

  // paginación
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 15;

  // modal edición
  const [edit, setEdit] = useState<Novedad | null>(null);
  const [editEstado, setEditEstado] = useState("PENDIENTE");
  const [editPrioridad, setEditPrioridad] = useState("MEDIA");
  const [editAsignadoA, setEditAsignadoA] = useState("");
  const [editNotas, setEditNotas] = useState("");
  const [saving, setSaving] = useState(false);

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    const d0 = desde ? new Date(desde + "T00:00:00").getTime() : null;
    const d1 = hasta ? new Date(hasta + "T23:59:59").getTime() : null;

    return (data ?? []).filter((n) => {
      if (categoria && n.categoria !== categoria) return false;
      if (estado && n.estado !== estado) return false;
      if (prioridad && n.prioridad !== prioridad) return false;
      if (zona && !(n.zonas ?? []).includes(zona)) return false;

      const ts = new Date(n.createdAt).getTime();
      if (d0 !== null && ts < d0) return false;
      if (d1 !== null && ts > d1) return false;

      if (!query) return true;

      const fields = [
        n.id,
        n.descripcion,
        n.categoria,
        n.tipoPaciente,
        n.tipoRuta,
        n.pacienteNombre,
        n.pacienteTipoDoc,
        n.prestadorNombre,
        n.prestadorCedula,
        n.usuario?.username,
        nombreCompleto(n.usuario),
        (n.zonas ?? []).join(" "),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return fields.includes(query);
    });
  }, [data, q, categoria, estado, prioridad, zona, desde, hasta]);

  const stats = useMemo(() => {
    const total = filtered.length;
    const p = filtered.filter((x) => x.estado === "PENDIENTE").length;
    const ep = filtered.filter((x) => x.estado === "EN_PROCESO").length;
    const r = filtered.filter((x) => x.estado === "RESUELTA").length;
    const altas = filtered.filter((x) => x.prioridad === "ALTA" && x.estado !== "RESUELTA").length;
    return { total, p, ep, r, altas };
  }, [filtered]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageData = useMemo(() => {
    const start = (safePage - 1) * PAGE_SIZE;
    return filtered.slice(start, start + PAGE_SIZE);
  }, [filtered, safePage]);

  async function refresh() {
    const t = toast.loading("Actualizando...");
    try {
      const res = await fetch("/api/novedades?all=true");
      if (!res.ok) throw new Error("No se pudo actualizar");
      const j = await res.json();
      setData(j);
      toast.success("Actualizado", { id: t });
    } catch (e: any) {
      toast.error(e?.message || "Error", { id: t });
    }
  }

  function openEdit(n: Novedad) {
    setEdit(n);
    setEditEstado(n.estado);
    setEditPrioridad(n.prioridad);
    setEditAsignadoA(n.asignadoA ?? "");
    setEditNotas(n.notasInternas ?? "");
  }

  async function saveEdit() {
    if (!edit) return;
    setSaving(true);
    const t = toast.loading("Guardando cambios...");
    try {
      const res = await fetch(`/api/novedades/${edit.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          estado: editEstado,
          prioridad: editPrioridad,
          asignadoA: editAsignadoA,
          notasInternas: editNotas,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error || "No se pudo guardar");
      }
      const updated = await res.json();

      setData((prev) => prev.map((x) => (x.id === edit.id ? { ...x, ...updated.novedad } : x)));
      toast.success("Actualizado", { id: t });
      setEdit(null);
    } catch (e: any) {
      toast.error(e?.message || "Error", { id: t });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-red-50 to-white">
      <div className="container mx-auto px-4 py-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-4">
          <div className="flex items-center gap-3">
            <Link
              href="/novedades"
              className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-white border border-gray-200 shadow-sm hover:bg-gray-50"
            >
              <FaArrowLeft /> Volver
            </Link>
            <h1 className="text-xl md:text-2xl font-extrabold text-gray-900 flex items-center gap-2">
              <FaExclamationTriangle className="text-red-600" /> Administración de novedades
            </h1>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowFilters((s) => !s)}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-gray-200 bg-white hover:bg-gray-50"
            >
              <FaFilter /> {showFilters ? "Ocultar" : "Mostrar"} filtros
            </button>
            <button
              onClick={refresh}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-red-600 text-white font-bold hover:bg-red-700"
            >
              <FaSync /> Actualizar
            </button>
          </div>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-3 mb-4">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
            <p className="text-xs text-gray-500">Total (filtrado)</p>
            <p className="text-2xl font-extrabold text-gray-900">{stats.total}</p>
          </div>
          <div className="bg-white rounded-2xl shadow-sm border border-yellow-100 p-4">
            <p className="text-xs text-gray-500">Pendientes</p>
            <p className="text-2xl font-extrabold text-yellow-700">{stats.p}</p>
          </div>
          <div className="bg-white rounded-2xl shadow-sm border border-blue-100 p-4">
            <p className="text-xs text-gray-500">En proceso</p>
            <p className="text-2xl font-extrabold text-blue-700">{stats.ep}</p>
          </div>
          <div className="bg-white rounded-2xl shadow-sm border border-green-100 p-4">
            <p className="text-xs text-gray-500">Resueltas</p>
            <p className="text-2xl font-extrabold text-green-700">{stats.r}</p>
          </div>
          <div className="bg-white rounded-2xl shadow-sm border border-red-100 p-4">
            <p className="text-xs text-gray-500">Urgentes (ALTA no resueltas)</p>
            <p className="text-2xl font-extrabold text-red-700">{stats.altas}</p>
          </div>
        </div>

        {/* Filtros */}
        {showFilters && (
          <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-4 mb-4">
            <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
              <div className="md:col-span-4">
                <label className="text-xs font-bold text-gray-600">Búsqueda</label>
                <div className="relative">
                  <input
                    value={q}
                    onChange={(e) => {
                      setQ(e.target.value);
                      setPage(1);
                    }}
                    placeholder="Prestador, cédula, paciente, descripción, zona, ID..."
                    className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-500"
                  />
                  <FaSearch className="absolute left-3 top-3 text-gray-400" />
                </div>
              </div>

              <div className="md:col-span-2">
                <label className="text-xs font-bold text-gray-600">Categoría</label>
                <select
                  value={categoria}
                  onChange={(e) => {
                    setCategoria(e.target.value as any);
                    setPage(1);
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-xl"
                >
                  <option value="">Todas</option>
                  <option value="PACIENTE">Paciente</option>
                  <option value="RUTA">Ruta</option>
                </select>
              </div>

              <div className="md:col-span-2">
                <label className="text-xs font-bold text-gray-600">Estado</label>
                <select
                  value={estado}
                  onChange={(e) => {
                    setEstado(e.target.value);
                    setPage(1);
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-xl"
                >
                  <option value="">Todos</option>
                  {ESTADOS.map((x) => (
                    <option key={x} value={x}>
                      {x}
                    </option>
                  ))}
                </select>
              </div>

              <div className="md:col-span-2">
                <label className="text-xs font-bold text-gray-600">Prioridad</label>
                <select
                  value={prioridad}
                  onChange={(e) => {
                    setPrioridad(e.target.value);
                    setPage(1);
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-xl"
                >
                  <option value="">Todas</option>
                  {PRIORIDADES.map((x) => (
                    <option key={x} value={x}>
                      {x}
                    </option>
                  ))}
                </select>
              </div>

              <div className="md:col-span-2">
                <label className="text-xs font-bold text-gray-600">Zona</label>
                <select
                  value={zona}
                  onChange={(e) => {
                    setZona(e.target.value);
                    setPage(1);
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-xl"
                >
                  <option value="">Todas</option>
                  {ZONAS.map((x) => (
                    <option key={x} value={x}>
                      {x}
                    </option>
                  ))}
                </select>
              </div>

              <div className="md:col-span-2">
                <label className="text-xs font-bold text-gray-600">Desde</label>
                <input
                  type="date"
                  value={desde}
                  onChange={(e) => {
                    setDesde(e.target.value);
                    setPage(1);
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-xl"
                />
              </div>

              <div className="md:col-span-2">
                <label className="text-xs font-bold text-gray-600">Hasta</label>
                <input
                  type="date"
                  value={hasta}
                  onChange={(e) => {
                    setHasta(e.target.value);
                    setPage(1);
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-xl"
                />
              </div>

              <div className="md:col-span-8 flex items-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setQ("");
                    setCategoria("");
                    setEstado("");
                    setPrioridad("");
                    setZona("");
                    setDesde("");
                    setHasta("");
                    setPage(1);
                  }}
                  className="px-4 py-2 rounded-xl border border-gray-200 bg-white hover:bg-gray-50"
                >
                  Limpiar
                </button>
                <div className="text-xs text-gray-500 flex items-center gap-2">
                  <FaMapMarkedAlt />
                  Tip: Asigna prioridad “ALTA” para priorizar gestión.
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tabla */}
        <div className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 text-sm text-gray-600 flex items-center justify-between">
            <div>
              Mostrando <span className="font-bold">{pageData.length}</span> de{" "}
              <span className="font-bold">{filtered.length}</span>
            </div>
            <div className="text-xs text-gray-500">Página {safePage}/{totalPages}</div>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50">
                <tr className="text-left text-gray-600">
                  <th className="px-4 py-3">Fecha</th>
                  <th className="px-4 py-3">Prestador</th>
                  <th className="px-4 py-3">Tipo</th>
                  <th className="px-4 py-3">Zonas</th>
                  <th className="px-4 py-3">Estado</th>
                  <th className="px-4 py-3">Prioridad</th>
                  <th className="px-4 py-3">Gestión</th>
                </tr>
              </thead>
              <tbody>
                {pageData.map((n) => {
                  const b = estadoBadge(n.estado);
                  const Icon = b.icon;
                  const tipo = n.categoria === "PACIENTE" ? n.tipoPaciente : n.tipoRuta;
                  const paciente = n.categoria === "PACIENTE" ? ` • ${n.pacienteNombre ?? ""}` : "";
                  return (
                    <tr key={n.id} className="border-t border-gray-100 hover:bg-gray-50">
                      <td className="px-4 py-3 whitespace-nowrap text-gray-700">{fmtDate(n.createdAt)}</td>
                      <td className="px-4 py-3">
                        <div className="font-bold text-gray-900 flex items-center gap-2">
                          <FaUser className="text-gray-400" />
                          <span className="truncate max-w-[240px]">{n.prestadorNombre}</span>
                        </div>
                        <div className="text-xs text-gray-500">
                          {n.prestadorProfesion} • CC {n.prestadorCedula}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-bold text-gray-900">
                          {n.categoria} • {tipo}
                        </div>
                        <div className="text-xs text-gray-500 truncate max-w-[320px]">{n.descripcion}</div>
                        {paciente ? <div className="text-xs text-gray-500">{paciente}</div> : null}
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-700">{(n.zonas ?? []).join(", ")}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-2 text-xs font-bold px-3 py-2 rounded-full border ${b.cls}`}>
                          <Icon /> {b.label}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center text-xs font-bold px-3 py-2 rounded-full border ${
                            n.prioridad === "ALTA"
                              ? "bg-red-50 text-red-800 border-red-200"
                              : n.prioridad === "MEDIA"
                              ? "bg-gray-50 text-gray-800 border-gray-200"
                              : "bg-green-50 text-green-800 border-green-200"
                          }`}
                        >
                          {n.prioridad}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => openEdit(n)}
                          className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-gray-200 bg-white hover:bg-gray-50"
                        >
                          <FaPen /> Editar
                        </button>
                      </td>
                    </tr>
                  );
                })}

                {pageData.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-4 py-10 text-center text-gray-600">
                      No hay resultados con los filtros actuales.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* paginación */}
          <div className="px-4 py-4 border-t border-gray-100 flex items-center justify-between">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={safePage <= 1}
              className={`px-3 py-2 rounded-xl border ${safePage <= 1 ? "bg-gray-100 text-gray-400" : "bg-white hover:bg-gray-50"}`}
            >
              Anterior
            </button>
            <div className="text-sm text-gray-600">Página {safePage} de {totalPages}</div>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={safePage >= totalPages}
              className={`px-3 py-2 rounded-xl border ${safePage >= totalPages ? "bg-gray-100 text-gray-400" : "bg-white hover:bg-gray-50"}`}
            >
              Siguiente
            </button>
          </div>
        </div>
      </div>

      {/* Modal */}
      {edit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={() => setEdit(null)} />
          <div className="relative bg-white rounded-2xl shadow-2xl border border-gray-100 w-[95vw] max-w-2xl p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-extrabold text-gray-900">Gestión de novedad</h2>
                <p className="text-xs text-gray-500">ID: {edit.id}</p>
                <p className="text-sm text-gray-700 mt-2">
                  <span className="font-bold">{edit.prestadorNombre}</span> • {edit.categoria} • {edit.categoria === "PACIENTE" ? edit.tipoPaciente : edit.tipoRuta}
                </p>
                <p className="text-sm text-gray-700 mt-1 line-clamp-50">{edit.descripcion}</p>
              </div>
              <button
                onClick={() => setEdit(null)}
                className="p-2 rounded-xl border border-gray-200 hover:bg-gray-50"
              >
                <FaTimes />
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-4">
              <div>
                <label className="text-xs font-bold text-gray-600">Estado</label>
                <select
                  value={editEstado}
                  onChange={(e) => setEditEstado(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-xl"
                  disabled={saving}
                >
                  {ESTADOS.map((x) => (
                    <option key={x} value={x}>
                      {x}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-gray-600">Prioridad</label>
                <select
                  value={editPrioridad}
                  onChange={(e) => setEditPrioridad(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-xl"
                  disabled={saving}
                >
                  {PRIORIDADES.map((x) => (
                    <option key={x} value={x}>
                      {x}
                    </option>
                  ))}
                </select>
              </div>

              <div className="md:col-span-2">
                <label className="text-xs font-bold text-gray-600">Asignado a (opcional)</label>
                <input
                  value={editAsignadoA}
                  onChange={(e) => setEditAsignadoA(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-xl"
                  placeholder="Nombre del responsable"
                  disabled={saving}
                />
              </div>

              <div className="md:col-span-2">
                <label className="text-xs font-bold text-gray-600">Notas internas (solo gestión)</label>
                <textarea
                  value={editNotas}
                  onChange={(e) => setEditNotas(e.target.value)}
                  rows={4}
                  className="w-full px-3 py-2 border border-gray-300 rounded-xl"
                  placeholder="Acciones realizadas, seguimiento, decisiones..."
                  disabled={saving}
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 mt-4">
              <button
                onClick={() => setEdit(null)}
                className="px-4 py-2 rounded-xl border border-gray-200 bg-white hover:bg-gray-50"
                disabled={saving}
              >
                Cancelar
              </button>
              <button
                onClick={saveEdit}
                className={`px-5 py-2 rounded-xl font-extrabold ${saving ? "bg-gray-200 text-gray-500" : "bg-red-600 text-white hover:bg-red-700"}`}
                disabled={saving}
              >
                Guardar cambios
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
