"use client"

import { useRouter, useSearchParams } from "next/navigation"
import { useEffect, useRef, useState } from "react"
import { FaSearch, FaFilter, FaTimes } from "react-icons/fa"

const PROFESIONES: { value: string; label: string }[] = [
  { value: "AUXILIAR_ENFERMERIA", label: "Auxiliar de enfermería" },
  { value: "ENFERMERIA", label: "Enfermería" },
  { value: "MEDICO", label: "Médico" },
  { value: "FISIOTERAPIA", label: "Fisioterapia" },
  { value: "FONOAUDIOLOGIA", label: "Fonoaudiología" },
  { value: "NUTRICION", label: "Nutrición" },
  { value: "OTRO", label: "Otro" },
]

export default function UsuariosFiltros({
  initialQ,
  initialRol,
  initialEstado,
  initialProfesion,
}: {
  initialQ: string
  initialRol: string
  initialEstado: string
  initialProfesion: string
}) {
  const router = useRouter()
  const sp = useSearchParams()

  const [q, setQ] = useState(initialQ ?? "")
  const [rol, setRol] = useState(initialRol ?? "")
  const [estado, setEstado] = useState(initialEstado ?? "")
  const [profesion, setProfesion] = useState(initialProfesion ?? "")

  // URL destino segun el estado actual de los filtros (sin 'page')
  function targetUrl() {
    const p = new URLSearchParams(sp?.toString() ?? "")
    p.delete("page")

    const nq = q.trim()
    if (nq) p.set("q", nq)
    else p.delete("q")

    if (rol) p.set("rol", rol)
    else p.delete("rol")

    if (estado) p.set("estado", estado)
    else p.delete("estado")

    if (profesion) p.set("profesion", profesion)
    else p.delete("profesion")

    const s = p.toString()
    return s ? `/usuarios?${s}` : "/usuarios"
  }

  // Comparacion de la parte de filtros (ignora 'page') para no navegar de mas
  function currentFilterString() {
    const p = new URLSearchParams(sp?.toString() ?? "")
    p.delete("page")
    return p.toString()
  }

  function desiredFilterString() {
    const url = targetUrl()
    const qs = url.split("?")[1] ?? ""
    return new URLSearchParams(qs).toString()
  }

  // Busqueda/filtrado en vivo con debounce: navega cuando cambian los filtros.
  const firstRun = useRef(true)
  useEffect(() => {
    if (firstRun.current) {
      firstRun.current = false
      return
    }
    if (desiredFilterString() === currentFilterString()) return

    const t = setTimeout(() => {
      router.replace(targetUrl(), { scroll: false })
    }, 300)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, rol, estado, profesion, sp])

  function applyNow() {
    router.replace(targetUrl(), { scroll: false })
  }

  function clear() {
    setQ("")
    setRol("")
    setEstado("")
    setProfesion("")
    router.replace("/usuarios", { scroll: false })
  }

  return (
    <div className="bg-white rounded-2xl shadow-lg p-4 border border-gray-100">
      <div className="flex items-center gap-2 mb-3">
        <FaFilter className="text-red-600" />
        <h3 className="font-bold text-gray-800">Filtros</h3>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <div className="md:col-span-2">
          <label className="text-xs font-semibold text-gray-600">Buscar</label>
          <div className="relative">
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") applyNow()
              }}
              placeholder="Usuario, nombre completo, cédula o email..."
              className="w-full pl-10 pr-3 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
            />
            <FaSearch className="absolute left-3 top-3.5 text-gray-400" />
          </div>
        </div>

        <div>
          <label className="text-xs font-semibold text-gray-600">Rol</label>
          <select
            value={rol}
            onChange={(e) => setRol(e.target.value)}
            className="w-full px-3 py-3 border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-red-500"
          >
            <option value="">Todos</option>
            <option value="ADMINISTRATIVO">ADMINISTRATIVO</option>
            <option value="TECNICO">TECNICO</option>
            <option value="FARMACIA">FARMACIA</option>
            <option value="ESPECIALISTA">ESPECIALISTA</option>
            <option value="MEDICO_RONDA">MEDICO RONDA</option>
            <option value="CLINICA_HERIDAS">CLINICA DE HERIDAS</option>
          </select>
        </div>

        <div>
          <label className="text-xs font-semibold text-gray-600">Estado</label>
          <select
            value={estado}
            onChange={(e) => setEstado(e.target.value)}
            className="w-full px-3 py-3 border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-red-500"
          >
            <option value="">Todos</option>
            <option value="activo">Activo</option>
            <option value="inactivo">Inactivo</option>
          </select>
        </div>

        <div className="md:col-span-2">
          <label className="text-xs font-semibold text-gray-600">Profesión</label>
          <select
            value={profesion}
            onChange={(e) => setProfesion(e.target.value)}
            className="w-full px-3 py-3 border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-red-500"
          >
            <option value="">Todas</option>
            {PROFESIONES.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="mt-3 flex flex-col md:flex-row gap-2 justify-end">
        <button
          type="button"
          onClick={clear}
          className="inline-flex items-center justify-center gap-2 px-4 py-3 rounded-lg border border-gray-300 font-semibold hover:bg-gray-50"
        >
          <FaTimes />
          Limpiar
        </button>

        <button
          type="button"
          onClick={applyNow}
          className="inline-flex items-center justify-center gap-2 px-4 py-3 rounded-lg bg-red-600 text-white font-semibold hover:bg-red-700"
        >
          Aplicar
        </button>
      </div>
    </div>
  )
}
