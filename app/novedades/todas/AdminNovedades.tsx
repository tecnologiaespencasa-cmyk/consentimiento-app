"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { toast } from "react-hot-toast";
import {
  FaArrowLeft,
  FaFilter,
  FaSearch,
  FaSync,
  FaFileExcel,
  FaExclamationTriangle,
  FaClock,
  FaSpinner,
  FaCheckCircle,
  FaUser,
  FaMapMarkedAlt,
  FaTimes,
} from "react-icons/fa";

type CurrentUser = {
  rol: "ADMINISTRATIVO" | "TECNICO";
  nombre: string;
};

type CategoriaFiltro = "" | "PACIENTE" | "RUTA";
type UsuarioNovedad = {
  username?: string | null;
  nombres?: string | null;
  primerApellido?: string | null;
  segundoApellido?: string | null;
  rol?: string | null;
  email?: string | null;
  telefono?: string | null;
  cedula?: string | null;
  profesion?: string | null;
};

type Novedad = {
  id: string;
  createdAt: string | Date;
  updatedAt: string | Date;
  prestadorNombre: string;
  prestadorCedula: string;
  prestadorProfesion: string;
  prestadorTelefono?: string | null;
  zonas?: string[] | null;
  categoria: CategoriaFiltro;
  pacienteNombre?: string | null;
  pacienteTipoDoc?: string | null;
  pacienteDocumento?: string | null;
  tipoPaciente?: string | null;
  fotoIngresoDomicilioUrl?: string | null;
  fotoIngresoDomicilioDriveItemId?: string | null;
  fotoIngresoDomicilioNombre?: string | null;
  fotoIngresoDomicilioMimeType?: string | null;
  fotoRutaEvidenciaUrl?: string | null;
  fotoRutaEvidenciaDriveItemId?: string | null;
  fotoRutaEvidenciaNombre?: string | null;
  fotoRutaEvidenciaMimeType?: string | null;
  tipoRuta?: string | null;
  descripcion?: string | null;
  ubicacionLatitud?: number | null;
  ubicacionLongitud?: number | null;
  estado: string;
  prioridad: string;
  asignadoA?: string | null;
  notasInternas?: string | null;
  usuarioId?: string | null;
  usuario?: UsuarioNovedad | null;
};

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

function fmtDate(d: unknown) {
  if (d == null || d === "") return "-";
  const date = d instanceof Date ? d : new Date(String(d));
  return Number.isNaN(date.getTime()) ? "-" : date.toLocaleString();
}

function nombreCompleto(u: UsuarioNovedad | null | undefined) {
  return `${u?.nombres ?? ""} ${u?.primerApellido ?? ""} ${u?.segundoApellido ?? ""}`
    .replace(/\s+/g, " ")
    .trim();
}

function estadoBadge(estado: string) {
  const map: Record<string, { cls: string; icon: typeof FaClock; label: string }> = {
    PENDIENTE: { cls: "bg-yellow-50 text-yellow-800 border-yellow-200", icon: FaClock, label: "Pendiente" },
    EN_PROCESO: { cls: "bg-blue-50 text-blue-800 border-blue-200", icon: FaSpinner, label: "En proceso" },
    RESUELTA: { cls: "bg-green-50 text-green-800 border-green-200", icon: FaCheckCircle, label: "Resuelta" },
  };
  return map[estado] ?? { cls: "bg-gray-50 text-gray-700 border-gray-200", icon: FaClock, label: estado };
}

function csvEscape(value: unknown) {
  const raw = value == null ? "" : String(value);
  return `"${raw.replace(/"/g, "\"\"")}"`;
}

function isoDate(value: unknown) {
  if (!value) return "";
  const dt = new Date(String(value));
  if (Number.isNaN(dt.getTime())) return "";
  return dt.toISOString();
}

function getErrorMessage(error: unknown, fallback = "Error") {
  return error instanceof Error && error.message ? error.message : fallback;
}

function toCategoriaFiltro(value: string): CategoriaFiltro {
  if (value === "PACIENTE" || value === "RUTA") return value;
  return "";
}

function coordenadasValidas(latitud: unknown, longitud: unknown): latitud is number {
  return typeof latitud === "number" && Number.isFinite(latitud) &&
    typeof longitud === "number" && Number.isFinite(longitud);
}

function buildGoogleMapsUrl(latitud: number, longitud: number) {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${latitud},${longitud}`)}`;
}

function buildGoogleMapsEmbedUrl(latitud: number, longitud: number) {
  return `https://maps.google.com/maps?q=${encodeURIComponent(`${latitud},${longitud}`)}&z=16&output=embed`;
}

export default function AdminNovedades({
  initialNovedades,
  currentUser,
}: {
  initialNovedades: Novedad[];
  currentUser: CurrentUser;
}) {
  const [data, setData] = useState<Novedad[]>(initialNovedades ?? []);
  const [showFilters, setShowFilters] = useState(true);
  const isAdmin = currentUser.rol === "ADMINISTRATIVO";

  // filtros
  const [q, setQ] = useState("");
  const [categoria, setCategoria] = useState<CategoriaFiltro>("");
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
        n.pacienteDocumento,
        n.fotoIngresoDomicilioUrl,
        n.fotoRutaEvidenciaUrl,
        n.prestadorNombre,
        n.prestadorCedula,
        n.ubicacionLatitud,
        n.ubicacionLongitud,
        n.asignadoA,
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
  const fotoEditEvidenciaUrl = edit?.fotoIngresoDomicilioUrl ?? edit?.fotoRutaEvidenciaUrl ?? null;
  const editTieneUbicacion = coordenadasValidas(edit?.ubicacionLatitud, edit?.ubicacionLongitud);
  const editGoogleMapsUrl = editTieneUbicacion
    ? buildGoogleMapsUrl(edit!.ubicacionLatitud as number, edit!.ubicacionLongitud as number)
    : null;
  const editGoogleMapsEmbedUrl = editTieneUbicacion
    ? buildGoogleMapsEmbedUrl(edit!.ubicacionLatitud as number, edit!.ubicacionLongitud as number)
    : null;
  const asignadoNormalizado = editAsignadoA.trim();
  const bloqueadoPorAsignacion =
    !isAdmin && Boolean(asignadoNormalizado) && asignadoNormalizado !== currentUser.nombre;
  const puedeTomarNovedad = !saving && !bloqueadoPorAsignacion;

  async function refresh() {
    const t = toast.loading("Actualizando...");
    try {
      const res = await fetch("/api/novedades?all=true");
      if (!res.ok) throw new Error("No se pudo actualizar");
      const j = (await res.json()) as Novedad[];
      setData(j);
      toast.success("Actualizado", { id: t });
    } catch (error: unknown) {
      toast.error(getErrorMessage(error), { id: t });
    }
  }

  function exportExcel() {
    if (!filtered.length) {
      toast.error("No hay novedades para exportar");
      return;
    }

    const columns = [
      "id",
      "createdAt",
      "updatedAt",
      "prestadorNombre",
      "prestadorCedula",
      "prestadorProfesion",
      "prestadorTelefono",
      "zonas",
      "categoria",
      "pacienteNombre",
      "pacienteTipoDoc",
      "pacienteDocumento",
      "tipoPaciente",
      "fotoIngresoDomicilioUrl",
      "fotoIngresoDomicilioDriveItemId",
      "fotoIngresoDomicilioNombre",
      "fotoIngresoDomicilioMimeType",
      "fotoRutaEvidenciaUrl",
      "fotoRutaEvidenciaDriveItemId",
      "fotoRutaEvidenciaNombre",
      "fotoRutaEvidenciaMimeType",
      "tipoRuta",
      "descripcion",
      "ubicacionLatitud",
      "ubicacionLongitud",
      "estado",
      "prioridad",
      "asignadoA",
      "notasInternas",
      "usuarioId",
      "usuarioUsername",
      "usuarioNombres",
      "usuarioPrimerApellido",
      "usuarioSegundoApellido",
      "usuarioRol",
      "usuarioEmail",
      "usuarioTelefono",
      "usuarioCedula",
      "usuarioProfesion",
    ];

    const rows = filtered.map((n) => [
      n.id ?? "",
      isoDate(n.createdAt),
      isoDate(n.updatedAt),
      n.prestadorNombre ?? "",
      n.prestadorCedula ?? "",
      n.prestadorProfesion ?? "",
      n.prestadorTelefono ?? "",
      (n.zonas ?? []).join(", "),
      n.categoria ?? "",
      n.pacienteNombre ?? "",
      n.pacienteTipoDoc ?? "",
      n.pacienteDocumento ?? "",
      n.tipoPaciente ?? "",
      n.fotoIngresoDomicilioUrl ?? "",
      n.fotoIngresoDomicilioDriveItemId ?? "",
      n.fotoIngresoDomicilioNombre ?? "",
      n.fotoIngresoDomicilioMimeType ?? "",
      n.fotoRutaEvidenciaUrl ?? "",
      n.fotoRutaEvidenciaDriveItemId ?? "",
      n.fotoRutaEvidenciaNombre ?? "",
      n.fotoRutaEvidenciaMimeType ?? "",
      n.tipoRuta ?? "",
      n.descripcion ?? "",
      n.ubicacionLatitud ?? "",
      n.ubicacionLongitud ?? "",
      n.estado ?? "",
      n.prioridad ?? "",
      n.asignadoA ?? "",
      n.notasInternas ?? "",
      n.usuarioId ?? "",
      n.usuario?.username ?? "",
      n.usuario?.nombres ?? "",
      n.usuario?.primerApellido ?? "",
      n.usuario?.segundoApellido ?? "",
      n.usuario?.rol ?? "",
      n.usuario?.email ?? "",
      n.usuario?.telefono ?? "",
      n.usuario?.cedula ?? "",
      n.usuario?.profesion ?? "",
    ]);

    const csv = [
      columns.map(csvEscape).join(";"),
      ...rows.map((row) => row.map(csvEscape).join(";")),
    ].join("\n");

    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
    a.href = url;
    a.download = `novedades_${stamp}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);

    toast.success(`Exportadas ${filtered.length} novedades`);
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
    if (!editAsignadoA.trim() && !isAdmin) {
      toast.error("Debes tomar la novedad antes de guardar cambios");
      return;
    }

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
        const err = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(err?.error || "No se pudo guardar");
      }
      const updated = (await res.json()) as { novedad?: Partial<Novedad> };
      const novedadActualizada = updated.novedad ?? {};

      setData((prev) => prev.map((x) => (x.id === edit.id ? { ...x, ...novedadActualizada } : x)));
      toast.success("Actualizado", { id: t });
      setEdit(null);
    } catch (error: unknown) {
      toast.error(getErrorMessage(error), { id: t });
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
              onClick={exportExcel}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-700 font-bold hover:bg-emerald-100"
            >
              <FaFileExcel /> Exportar Excel
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
                    setCategoria(toCategoriaFiltro(e.target.value));
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
                  <th className="px-4 py-3">Asignado</th>
                  <th className="px-4 py-3">Estado</th>
                  <th className="px-4 py-3">Prioridad</th>
                </tr>
              </thead>
              <tbody>
                {pageData.map((n) => {
                  const b = estadoBadge(n.estado);
                  const Icon = b.icon;
                  const tipo = n.categoria === "PACIENTE" ? n.tipoPaciente : n.tipoRuta;
                  const fotoEvidenciaUrl = n.fotoIngresoDomicilioUrl ?? n.fotoRutaEvidenciaUrl;
                  const tieneUbicacion = coordenadasValidas(n.ubicacionLatitud, n.ubicacionLongitud);
                  const ubicacionGoogleMapsUrl = tieneUbicacion
                    ? buildGoogleMapsUrl(n.ubicacionLatitud as number, n.ubicacionLongitud as number)
                    : null;
                  const paciente = n.categoria === "PACIENTE"
                    ? ` • ${n.pacienteNombre ?? ""}${n.pacienteTipoDoc ? ` (${n.pacienteTipoDoc}${n.pacienteDocumento ? ` ${n.pacienteDocumento}` : ""})` : ""}`
                    : "";
                  return (
                    <tr
                      key={n.id}
                      className="border-t border-gray-100 hover:bg-gray-50 cursor-pointer focus:outline-none focus:ring-2 focus:ring-red-500/40"
                      onClick={() => openEdit(n)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          openEdit(n);
                        }
                      }}
                      tabIndex={0}
                      role="button"
                      aria-label={`Abrir gestión de novedad ${n.id}`}
                    >
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
                        {fotoEvidenciaUrl ? (
                          <div className="mt-1">
                            <a
                              href={fotoEvidenciaUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="text-xs text-blue-700 underline"
                              onClick={(e) => e.stopPropagation()}
                            >
                              Ver foto de evidencia
                            </a>
                          </div>
                        ) : null}
                        {ubicacionGoogleMapsUrl ? (
                          <div className="mt-1">
                            <a
                              href={ubicacionGoogleMapsUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 rounded-lg border border-emerald-200 bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-700 hover:bg-emerald-100"
                              onClick={(e) => e.stopPropagation()}
                            >
                              Ver ubicacion
                            </a>
                          </div>
                        ) : null}
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-700">{(n.zonas ?? []).join(", ")}</td>
                      <td className="px-4 py-3 text-xs text-gray-700">
                        {n.asignadoA ? (
                          <span className="font-semibold text-gray-800">{n.asignadoA}</span>
                        ) : (
                          <span className="text-gray-400">Sin asignar</span>
                        )}
                      </td>
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
        <div className="fixed inset-0 z-50 p-2 md:p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setEdit(null)} />
          <div className="relative h-full w-full overflow-y-auto pointer-events-none">
            <div className="min-h-full flex items-start md:items-center justify-center">
              <div className="relative pointer-events-auto bg-white rounded-2xl shadow-2xl border border-gray-100 w-[95vw] max-w-2xl max-h-[92dvh] overflow-hidden flex flex-col p-5">
                <div className="overflow-y-auto pr-1">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-extrabold text-gray-900">Gestión de novedad</h2>
                <p className="text-xs text-gray-500">ID: {edit.id}</p>
              </div>
              <button
                onClick={() => setEdit(null)}
                className="p-2 rounded-xl border border-gray-200 hover:bg-gray-50"
              >
                <FaTimes />
              </button>
            </div>

            <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="rounded-xl border border-gray-200 bg-gray-50/40 p-3">
                <p className="text-xs font-bold text-gray-600 mb-2">Datos del reporte</p>
                <p className="text-sm text-gray-700">
                  <span className="font-semibold">Prestador:</span> {edit.prestadorNombre || "No registrado"}
                </p>
                <p className="text-sm text-gray-700 mt-1">
                  <span className="font-semibold">Telefono:</span> {edit.prestadorTelefono || "No registrado"}
                </p>
                <p className="text-sm text-gray-700 mt-1">
                  <span className="font-semibold">Categoria:</span> {edit.categoria || "No registrada"}
                </p>
                <p className="text-sm text-gray-700 mt-1">
                  <span className="font-semibold">Tipo:</span> {(edit.categoria === "PACIENTE" ? edit.tipoPaciente : edit.tipoRuta) || "No registrado"}
                </p>
                <p className="text-sm text-gray-700 mt-1">
                  <span className="font-semibold">Fecha:</span> {fmtDate(edit.createdAt)}
                </p>
              </div>

              <div className="rounded-xl border border-gray-200 bg-gray-50/40 p-3">
                <p className="text-xs font-bold text-gray-600 mb-2">Datos del paciente</p>
                {edit.categoria === "PACIENTE" ? (
                  <>
                    <p className="text-sm text-gray-700">
                      <span className="font-semibold">Nombre:</span> {edit.pacienteNombre || "No registrado"}
                    </p>
                    <p className="text-sm text-gray-700 mt-1">
                      <span className="font-semibold">Tipo documento:</span> {edit.pacienteTipoDoc || "No registrado"}
                    </p>
                    <p className="text-sm text-gray-700 mt-1">
                      <span className="font-semibold">Numero documento:</span> {edit.pacienteDocumento || "No registrado"}
                    </p>
                  </>
                ) : (
                  <p className="text-sm text-gray-600">No aplica para novedades de ruta.</p>
                )}
              </div>
            </div>

            <div className="mt-3 rounded-xl border border-gray-200 p-3">
              <p className="text-xs font-bold text-gray-600 mb-1">Descripcion reportada</p>
              <p className="text-sm text-gray-700">{edit.descripcion || "Sin descripcion"}</p>
              {fotoEditEvidenciaUrl ? (
                <p className="text-sm mt-2">
                  <a
                    href={fotoEditEvidenciaUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-blue-700 underline"
                  >
                    Ver foto de evidencia
                  </a>
                </p>
              ) : null}
            </div>

            {editTieneUbicacion ? (
              <div className="mt-3 rounded-xl border border-gray-200 p-3">
                <p className="text-xs font-bold text-gray-600 mb-2">Ubicacion reportada</p>
                {editGoogleMapsUrl ? (
                  <p className="text-sm mt-1">
                    <a
                      href={editGoogleMapsUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center rounded-lg border border-emerald-200 bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-700 hover:bg-emerald-100"
                    >
                      Ver ubicacion en Google Maps
                    </a>
                  </p>
                ) : null}
                {editGoogleMapsEmbedUrl ? (
                  <div className="mt-3 h-56 w-full overflow-hidden rounded-xl border border-gray-200">
                    <iframe
                      title={`Mapa novedad ${edit.id}`}
                      src={editGoogleMapsEmbedUrl}
                      width="100%"
                      height="100%"
                      loading="lazy"
                      referrerPolicy="no-referrer-when-downgrade"
                    />
                  </div>
                ) : null}
              </div>
            ) : (
              <div className="mt-3 rounded-xl border border-dashed border-gray-200 p-3 text-sm text-gray-500">
                Esta novedad no tiene ubicacion capturada.
              </div>
            )}

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
                <div className="flex items-center justify-between gap-2 mb-1">
                  <label className="text-xs font-bold text-gray-600">Asignado a (obligatorio)</label>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setEditAsignadoA(currentUser.nombre)}
                      className={`px-3 py-1 rounded-lg text-xs font-bold border ${
                        puedeTomarNovedad
                          ? "bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100"
                          : "bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed"
                      }`}
                      disabled={!puedeTomarNovedad}
                    >
                      Tomar novedad
                    </button>
                    {isAdmin && (
                      <button
                        type="button"
                        onClick={() => setEditAsignadoA("")}
                        className="px-3 py-1 rounded-lg text-xs font-bold border border-gray-200 bg-white hover:bg-gray-50"
                        disabled={saving}
                      >
                        Desasignar
                      </button>
                    )}
                  </div>
                </div>
                <input
                  value={editAsignadoA}
                  onChange={(e) => setEditAsignadoA(e.target.value)}
                  className={`w-full px-3 py-2 border rounded-xl ${
                    !asignadoNormalizado ? "border-red-300" : "border-gray-300"
                  }`}
                  placeholder="Nombre del responsable"
                  disabled={saving}
                  readOnly={!isAdmin}
                />
                {!asignadoNormalizado ? (
                  <p className="text-xs text-red-600 mt-1">Debes asignar un responsable para guardar.</p>
                ) : null}
                {bloqueadoPorAsignacion ? (
                  <p className="text-xs text-gray-500 mt-1">
                    Esta novedad ya está asignada a <span className="font-semibold">{editAsignadoA}</span>. Solo administrativo puede cambiar o desasignar.
                  </p>
                ) : null}
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

                </div>

            <div className="shrink-0 flex items-center justify-end gap-2 mt-4 pt-3 border-t border-gray-100 bg-white">
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
          </div>
        </div>
      )}
    </div>
  );
}

