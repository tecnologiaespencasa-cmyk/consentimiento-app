"use client"

import { useState, useMemo } from "react"
import { addUtcDays, addUtcMonths, formatBogotaDate, formatBogotaTime, getBogotaDateKey, getStartOfBogotaDayUtc } from "@/lib/bogotaDate"
import { 
  FaSearch, 
  FaCalendarAlt, 
  FaIdCard, 
  FaClipboardCheck,
  FaCheckCircle,
  FaTimesCircle,
  FaFilter
} from "react-icons/fa"
import Link from "next/link"

interface Consentimiento {
  id: string
  cedula: string
  fechaHora: Date
  archivoUrl: string
  aceptado: boolean
}

interface FiltrosConsentimientosProps {
  consentimientos: Consentimiento[]
}

export default function FiltrosConsentimientos({ consentimientos }: FiltrosConsentimientosProps) {
  const [busqueda, setBusqueda] = useState("")
  const [orden, setOrden] = useState<"asc" | "desc">("desc")
  const [filtroFecha, setFiltroFecha] = useState<"todos" | "hoy" | "semana" | "mes">("todos")
  const [filtroEstado, setFiltroEstado] = useState<"todos" | "aceptado" | "rechazado">("todos")
  const [showMobileFilters, setShowMobileFilters] = useState(false)

  // Función para filtrar consentimientos
  const consentimientosFiltrados = useMemo(() => {
    let resultado = [...consentimientos]

    // Filtrar por búsqueda en cédula
    if (busqueda) {
      resultado = resultado.filter(c => 
        c.cedula.toLowerCase().includes(busqueda.toLowerCase())
      )
    }

    // Filtrar por estado
    if (filtroEstado !== "todos") {
      resultado = resultado.filter(c => 
        filtroEstado === "aceptado" ? c.aceptado : !c.aceptado
      )
    }

    // Filtrar por fecha
    const now = new Date()
    const hoyKey = getBogotaDateKey(now)
    const inicioHoy = getStartOfBogotaDayUtc(now)
    const semanaAtras = addUtcDays(inicioHoy, -7)
    const mesAtras = addUtcMonths(inicioHoy, -1)
    
    switch (filtroFecha) {
      case "hoy":
        resultado = resultado.filter(c => getBogotaDateKey(c.fechaHora) === hoyKey)
        break
      
      case "semana":
        resultado = resultado.filter(c => {
          const fechaConsentimiento = new Date(c.fechaHora)
          return fechaConsentimiento >= semanaAtras
        })
        break
      
      case "mes":
        resultado = resultado.filter(c => {
          const fechaConsentimiento = new Date(c.fechaHora)
          return fechaConsentimiento >= mesAtras
        })
        break
      
      default:
        break
    }

    // Ordenar
    resultado.sort((a, b) => {
      const fechaA = new Date(a.fechaHora).getTime()
      const fechaB = new Date(b.fechaHora).getTime()
      return orden === "desc" ? fechaB - fechaA : fechaA - fechaB
    })

    return resultado
  }, [consentimientos, busqueda, filtroFecha, filtroEstado, orden])

  const limpiarFiltros = () => {
    setBusqueda("")
    setFiltroFecha("todos")
    setFiltroEstado("todos")
    setOrden("desc")
    setShowMobileFilters(false)
  }

  const tieneFiltrosActivos = busqueda || filtroFecha !== "todos" || filtroEstado !== "todos" || orden !== "desc"

  // Función para renderizar el estado
  const renderEstado = (aceptado: boolean) => {
    if (aceptado) {
      return (
        <span className="flex items-center px-3 py-1.5 bg-green-100 text-green-800 rounded-full text-xs font-medium">
          <FaCheckCircle className="mr-1.5 text-sm" />
          Aceptado
        </span>
      )
    } else {
      return (
        <span className="flex items-center px-3 py-1.5 bg-red-100 text-red-800 rounded-full text-xs font-medium">
          <FaTimesCircle className="mr-1.5 text-sm" />
          Rechazado
        </span>
      )
    }
  }

  return (
    <>
      {/* Barra de herramientas - Versión Desktop */}
      <div className="mb-8 bg-white rounded-2xl shadow-lg p-4 md:p-6">
        <div className="flex flex-col md:flex-row justify-between items-center">
          <div className="w-full md:w-auto">
            {/* Fila superior: Búsqueda y Botón móvil */}
            <div className="flex justify-between items-center mb-4 md:mb-0">
              <div className="relative flex-1 md:flex-initial md:w-64">
                <input
                  type="text"
                  placeholder="Buscar por cédula..."
                  value={busqueda}
                  onChange={(e) => setBusqueda(e.target.value)}
                  className="pl-10 pr-4 py-3 md:py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent w-full"
                />
                <FaSearch className="absolute left-3 top-3.5 md:top-2.5 text-gray-400" />
              </div>
              
              {/* Botón filtros móvil */}
              <button
                onClick={() => setShowMobileFilters(!showMobileFilters)}
                className="md:hidden ml-3 p-3 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
              >
                <FaFilter className="text-gray-600" />
              </button>
            </div>

            {/* Filtros móvil (colapsable) */}
            {showMobileFilters && (
              <div className="mt-4 md:hidden bg-gray-50 p-4 rounded-lg space-y-3">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-700">Fecha:</span>
                    <select
                      value={filtroFecha}
                      onChange={(e) => setFiltroFecha(e.target.value as any)}
                      className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent text-sm"
                    >
                      <option value="todos">Todos</option>
                      <option value="hoy">Hoy</option>
                      <option value="semana">Última semana</option>
                      <option value="mes">Último mes</option>
                    </select>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-700">Estado:</span>
                    <select
                      value={filtroEstado}
                      onChange={(e) => setFiltroEstado(e.target.value as any)}
                      className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent text-sm"
                    >
                      <option value="todos">Todos</option>
                      <option value="aceptado">Aceptados</option>
                      <option value="rechazado">Rechazados</option>
                    </select>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-700">Orden:</span>
                    <select
                      value={orden}
                      onChange={(e) => setOrden(e.target.value as "asc" | "desc")}
                      className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent text-sm"
                    >
                      <option value="desc">Más recientes</option>
                      <option value="asc">Más antiguos</option>
                    </select>
                  </div>
                </div>
              </div>
            )}

            {/* Filtros Desktop */}
            <div className="hidden md:flex flex-wrap gap-4 mt-4 md:mt-0">
              {/* Filtro por fecha */}
              <div className="flex items-center space-x-2">
                <span className="text-gray-600 text-sm whitespace-nowrap">Fecha:</span>
                <select
                  value={filtroFecha}
                  onChange={(e) => setFiltroFecha(e.target.value as any)}
                  className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent text-sm"
                >
                  <option value="todos">Todos</option>
                  <option value="hoy">Hoy</option>
                  <option value="semana">Última semana</option>
                  <option value="mes">Último mes</option>
                </select>
              </div>
              
              {/* Filtro por estado */}
              <div className="flex items-center space-x-2">
                <span className="text-gray-600 text-sm whitespace-nowrap">Estado:</span>
                <select
                  value={filtroEstado}
                  onChange={(e) => setFiltroEstado(e.target.value as any)}
                  className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent text-sm"
                >
                  <option value="todos">Todos</option>
                  <option value="aceptado">Aceptados</option>
                  <option value="rechazado">Rechazados</option>
                </select>
              </div>
              
              {/* Orden */}
              <div className="flex items-center space-x-2">
                <span className="text-gray-600 text-sm whitespace-nowrap">Orden:</span>
                <select
                  value={orden}
                  onChange={(e) => setOrden(e.target.value as "asc" | "desc")}
                  className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent text-sm"
                >
                  <option value="desc">Más recientes</option>
                  <option value="asc">Más antiguos</option>
                </select>
              </div>
              
              {/* Botón limpiar */}
              {tieneFiltrosActivos && (
                <button
                  onClick={limpiarFiltros}
                  className="px-4 py-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors text-sm"
                >
                  Limpiar filtros
                </button>
              )}
            </div>
          </div>
          
          {/* Botón nuevo consentimiento */}
          <div className="mt-4 md:mt-0 w-full md:w-auto">
            <Link
              href="/consentimiento"
              className="flex items-center justify-center px-4 py-3 md:px-6 md:py-3 bg-gradient-to-r from-red-600 to-red-700 text-white rounded-lg hover:from-red-700 hover:to-red-800 transition-all shadow-lg hover:shadow-xl text-sm md:text-base w-full md:w-auto"
            >
              <FaClipboardCheck className="mr-2" />
              <span className="hidden sm:inline">Nuevo Consentimiento</span>
              <span className="sm:hidden">Nuevo</span>
            </Link>
          </div>
        </div>
        
        {/* Información de filtros aplicados */}
        {tieneFiltrosActivos && (
          <div className="mt-4 p-3 bg-blue-50 rounded-lg">
            <p className="text-sm text-blue-800">
              Mostrando {consentimientosFiltrados.length} de {consentimientos.length} consentimientos
              {busqueda && ` • Buscando: "${busqueda}"`}
              {filtroFecha !== "todos" && ` • Fecha: ${filtroFecha === "hoy" ? "Hoy" : filtroFecha === "semana" ? "Última semana" : "Último mes"}`}
              {filtroEstado !== "todos" && ` • Estado: ${filtroEstado === "aceptado" ? "Aceptados" : "Rechazados"}`}
            </p>
          </div>
        )}
      </div>

      {/* Lista de consentimientos */}
      <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
        {consentimientosFiltrados.length === 0 ? (
          <div className="text-center py-12 md:py-16 px-4">
            <div className="inline-block p-4 md:p-6 bg-red-50 rounded-full mb-4 md:mb-6">
              <FaClipboardCheck className="text-4xl md:text-5xl text-red-400" />
            </div>
            <h2 className="text-xl md:text-2xl font-bold text-gray-800 mb-2">
              {consentimientos.length === 0 
                ? "No tienes consentimientos registrados"
                : "No se encontraron consentimientos"}
            </h2>
            <p className="text-gray-600 mb-6 md:mb-8 text-sm md:text-base max-w-md mx-auto">
              {consentimientos.length === 0
                ? "Comienza registrando tu primer consentimiento informado."
                : "Intenta con otros criterios de búsqueda o limpia los filtros."}
            </p>
            {consentimientos.length === 0 ? (
              <Link
                href="/consentimiento"
                className="inline-flex items-center px-6 py-3 md:px-8 md:py-3 bg-gradient-to-r from-red-600 to-red-700 text-white rounded-lg hover:from-red-700 hover:to-red-800 transition-all shadow-lg hover:shadow-xl text-sm md:text-base"
              >
                <FaClipboardCheck className="mr-2" />
                Registrar Primer Consentimiento
              </Link>
            ) : (
              <button
                onClick={limpiarFiltros}
                className="inline-flex items-center px-6 py-3 md:px-8 md:py-3 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-all text-sm md:text-base"
              >
                Limpiar filtros
              </button>
            )}
          </div>
        ) : (
          <>
            {/* Encabezado de la tabla - Desktop */}
            <div className="hidden md:block px-6 py-4 border-b border-gray-200 bg-gray-50">
              <div className="grid grid-cols-12 gap-4 text-sm font-semibold text-gray-700">
                <div className="col-span-4 flex items-center">
                  <FaIdCard className="mr-2 text-red-500" />
                  Cédula del Paciente
                </div>
                <div className="col-span-4 flex items-center">
                  <FaCalendarAlt className="mr-2 text-red-500" />
                  Fecha y Hora
                </div>
                <div className="col-span-4 flex items-center">
                  Estado
                </div>
              </div>
            </div>

            {/* Lista de items */}
            <div className="divide-y divide-gray-100">
              {consentimientosFiltrados.map((c) => (
                <div 
                  key={c.id} 
                  className="px-4 md:px-6 py-4 hover:bg-red-50 transition-colors"
                >
                  {/* Versión móvil */}
                  <div className="md:hidden space-y-3">
                    <div className="flex justify-between items-center">
                      <div className="flex items-center">
                        <div className="w-8 h-8 bg-red-100 rounded-lg flex items-center justify-center mr-3">
                          <FaIdCard className="text-red-600 text-sm" />
                        </div>
                        <div>
                          <span className="font-medium text-gray-800 block text-sm">{c.cedula}</span>
                          <span className="text-xs text-gray-600">Cédula</span>
                        </div>
                      </div>
                      <div>
                        {renderEstado(c.aceptado)}
                      </div>
                    </div>
                    
                    <div className="flex items-center">
                      <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center mr-3">
                        <FaCalendarAlt className="text-green-600 text-sm" />
                      </div>
                      <div className="flex-1">
                          <p className="font-medium text-gray-800 text-xs">
                          {formatBogotaDate(c.fechaHora, 'es-CO', {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric'
                          })}
                        </p>
                        <p className="text-xs text-gray-600">
                          {formatBogotaTime(c.fechaHora, 'es-CO', {
                            hour: '2-digit',
                            minute: '2-digit',
                            hour12: false
                          })}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Versión desktop */}
                  <div className="hidden md:grid grid-cols-12 gap-4 items-center">
                    {/* Cédula */}
                    <div className="col-span-4">
                      <div className="flex items-center">
                        <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center mr-3">
                          <FaIdCard className="text-red-600" />
                        </div>
                        <div>
                          <span className="font-medium text-gray-800 block">{c.cedula}</span>
                          <span className="text-sm text-gray-600">Cédula del paciente</span>
                        </div>
                      </div>
                    </div>

                    {/* Fecha y Hora */}
                    <div className="col-span-4">
                      <div className="flex items-center">
                        <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center mr-3">
                          <FaCalendarAlt className="text-green-600" />
                        </div>
                        <div>
                          <p className="font-medium text-gray-800">
                            {formatBogotaDate(c.fechaHora, 'es-CO', {
                              year: 'numeric',
                              month: 'long',
                              day: 'numeric'
                            })}
                          </p>
                          <p className="text-sm text-gray-600">
                            {formatBogotaTime(c.fechaHora, 'es-CO', {
                              hour: '2-digit',
                              minute: '2-digit',
                              hour12: false
                            })}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Estado */}
                    <div className="col-span-4">
                      <div className="flex items-center">
                        {renderEstado(c.aceptado)}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Información de resultados */}
            <div className="px-4 md:px-6 py-4 border-t border-gray-200 bg-gray-50">
              <div className="flex flex-col md:flex-row justify-between items-center">
                <div className="text-sm text-gray-600 mb-2 md:mb-0 text-center md:text-left">
                  Mostrando <span className="font-semibold">{consentimientosFiltrados.length}</span> de{" "}
                  <span className="font-semibold">{consentimientos.length}</span> consentimientos
                </div>
                
                {/* Estadísticas por estado - Móvil */}
                <div className="flex items-center space-x-4 md:hidden">
                  <div className="text-center">
                    <span className="text-lg font-bold text-green-600">
                      {consentimientos.filter(c => c.aceptado).length}
                    </span>
                    <p className="text-xs text-gray-600">Aceptados</p>
                  </div>
                  <div className="h-8 w-px bg-gray-300"></div>
                  <div className="text-center">
                    <span className="text-lg font-bold text-red-600">
                      {consentimientos.filter(c => !c.aceptado).length}
                    </span>
                    <p className="text-xs text-gray-600">Rechazados</p>
                  </div>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </>
  )
}
