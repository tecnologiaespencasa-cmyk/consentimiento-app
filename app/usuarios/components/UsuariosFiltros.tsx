"use client"

import { useRouter, useSearchParams } from "next/navigation"
import { useMemo, useState } from "react"
import { FaSearch, FaFilter, FaTimes } from "react-icons/fa"

export default function UsuariosFiltros({
  initialQ,
  initialRol,
  initialEstado,
}: {
  initialQ: string
  initialRol: string
  initialEstado: string
}) {
  const router = useRouter()
  const sp = useSearchParams()

  const [q, setQ] = useState(initialQ ?? "")
  const [rol, setRol] = useState(initialRol ?? "")
  const [estado, setEstado] = useState(initialEstado ?? "")

  const baseParams = useMemo(() => {
    const p = new URLSearchParams(sp?.toString() ?? "")
    // limpiamos paginación al cambiar filtro
    p.delete("page")
    return p
  }, [sp])

  function apply() {
    const p = new URLSearchParams(baseParams.toString())

    if (q.trim()) p.set("q", q.trim())
    else p.delete("q")

    if (rol) p.set("rol", rol)
    else p.delete("rol")

    if (estado) p.set("estado", estado)
    else p.delete("estado")

    router.push(`/usuarios?${p.toString()}`)
  }

  function clear() {
    setQ("")
    setRol("")
    setEstado("")
    router.push("/usuarios")
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
              placeholder="Usuario, nombre o email..."
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
            <option value="ESPECIALISTA">ESPECIALISTA</option>
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
          onClick={apply}
          className="inline-flex items-center justify-center gap-2 px-4 py-3 rounded-lg bg-red-600 text-white font-semibold hover:bg-red-700"
        >
          Aplicar
        </button>
      </div>
    </div>
  )
}