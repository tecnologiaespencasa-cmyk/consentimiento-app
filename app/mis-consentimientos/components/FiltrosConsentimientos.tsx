"use client"

import { useState, useMemo } from "react"
import { FaSearch, FaCalendarAlt, FaIdCard, FaDownload, FaEye, FaClipboardCheck } from "react-icons/fa"
import Link from "next/link"

interface Consentimiento {
  id: string
  cedula: string
  fechaHora: Date
  archivoUrl: string
}

interface FiltrosConsentimientosProps {
  consentimientos: Consentimiento[]
}

export default function FiltrosConsentimientos({ consentimientos }: FiltrosConsentimientosProps) {
  const [busqueda, setBusqueda] = useState("")
  const [orden, setOrden] = useState<"asc" | "desc">("desc")
  const [filtroFecha, setFiltroFecha] = useState<"todos" | "hoy" | "semana" | "mes">("todos")

  // Función para filtrar consentimientos
  const consentimientosFiltrados = useMemo(() => {
    let resultado = [...consentimientos]

    // Filtrar por búsqueda en cédula
    if (busqueda) {
      resultado = resultado.filter(c => 
        c.cedula.toLowerCase().includes(busqueda.toLowerCase())
      )
    }

    // Filtrar por fecha
    const hoy = new Date()
    hoy.setHours(0, 0, 0, 0)
    
    switch (filtroFecha) {
      case "hoy":
        resultado = resultado.filter(c => {
          const fechaConsentimiento = new Date(c.fechaHora)
          fechaConsentimiento.setHours(0, 0, 0, 0)
          return fechaConsentimiento.getTime() === hoy.getTime()
        })
        break
      
      case "semana":
        const semanaAtras = new Date(hoy)
        semanaAtras.setDate(semanaAtras.getDate() - 7)
        resultado = resultado.filter(c => {
          const fechaConsentimiento = new Date(c.fechaHora)
          return fechaConsentimiento >= semanaAtras
        })
        break
      
      case "mes":
        const mesAtras = new Date(hoy)
        mesAtras.setMonth(mesAtras.getMonth() - 1)
        resultado = resultado.filter(c => {
          const fechaConsentimiento = new Date(c.fechaHora)
          return fechaConsentimiento >= mesAtras
        })
        break
      
      default:
        // "todos" - no filtrar por fecha
        break
    }

    // Ordenar
    resultado.sort((a, b) => {
      const fechaA = new Date(a.fechaHora).getTime()
      const fechaB = new Date(b.fechaHora).getTime()
      return orden === "desc" ? fechaB - fechaA : fechaA - fechaB
    })

    return resultado
  }, [consentimientos, busqueda, filtroFecha, orden])

  const limpiarFiltros = () => {
    setBusqueda("")
    setFiltroFecha("todos")
    setOrden("desc")
  }

  return (
    <>
      {/* Barra de herramientas */}
      <div className="mb-8 bg-white rounded-2xl shadow-lg p-6">
        <div className="flex flex-col md:flex-row justify-between items-center">
          <div className="flex flex-wrap gap-4 mb-4 md:mb-0">
            {/* Búsqueda por cédula */}
            <div className="relative">
              <input
                type="text"
                placeholder="Buscar por cédula..."
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent w-full md:w-64"
              />
              <FaSearch className="absolute left-3 top-3 text-gray-400" />
            </div>
            
            {/* Filtro por fecha */}
            <div className="flex items-center space-x-2">
              <span className="text-gray-600 text-sm whitespace-nowrap">Fecha:</span>
              <select
                value={filtroFecha}
                onChange={(e) => setFiltroFecha(e.target.value as any)}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
              >
                <option value="todos">Todos</option>
                <option value="hoy">Hoy</option>
                <option value="semana">Última semana</option>
                <option value="mes">Último mes</option>
              </select>
            </div>
            
            {/* Orden */}
            <div className="flex items-center space-x-2">
              <span className="text-gray-600 text-sm whitespace-nowrap">Orden:</span>
              <select
                value={orden}
                onChange={(e) => setOrden(e.target.value as "asc" | "desc")}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
              >
                <option value="desc">Más recientes</option>
                <option value="asc">Más antiguos</option>
              </select>
            </div>
            
            {/* Botón limpiar */}
            {(busqueda || filtroFecha !== "todos" || orden !== "desc") && (
              <button
                onClick={limpiarFiltros}
                className="px-4 py-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
              >
                Limpiar filtros
              </button>
            )}
          </div>
          
          <div className="flex items-center space-x-3">
            <Link
              href="/consentimiento"
              className="flex items-center px-6 py-3 bg-gradient-to-r from-red-600 to-red-700 text-white rounded-lg hover:from-red-700 hover:to-red-800 transition-all shadow-lg hover:shadow-xl"
            >
              <FaClipboardCheck className="mr-2" />
              Nuevo Consentimiento
            </Link>
          </div>
        </div>
        
        {/* Información de filtros aplicados */}
        {(busqueda || filtroFecha !== "todos") && (
          <div className="mt-4 p-3 bg-blue-50 rounded-lg">
            <p className="text-sm text-blue-800">
              Mostrando {consentimientosFiltrados.length} de {consentimientos.length} consentimientos
              {busqueda && ` • Buscando: "${busqueda}"`}
              {filtroFecha !== "todos" && ` • Filtro: ${filtroFecha === "hoy" ? "Hoy" : filtroFecha === "semana" ? "Última semana" : "Último mes"}`}
            </p>
          </div>
        )}
      </div>

      {/* Lista de consentimientos */}
      <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
        {consentimientosFiltrados.length === 0 ? (
          <div className="text-center py-16">
            <div className="inline-block p-6 bg-red-50 rounded-full mb-6">
              <FaClipboardCheck className="text-5xl text-red-400" />
            </div>
            <h2 className="text-2xl font-bold text-gray-800 mb-2">
              {consentimientos.length === 0 
                ? "No tienes consentimientos registrados"
                : "No se encontraron consentimientos"}
            </h2>
            <p className="text-gray-600 mb-8 max-w-md mx-auto">
              {consentimientos.length === 0
                ? "Comienza registrando tu primer consentimiento informado."
                : "Intenta con otros criterios de búsqueda o limpia los filtros."}
            </p>
            {consentimientos.length === 0 ? (
              <Link
                href="/consentimiento"
                className="inline-flex items-center px-8 py-3 bg-gradient-to-r from-red-600 to-red-700 text-white rounded-lg hover:from-red-700 hover:to-red-800 transition-all shadow-lg hover:shadow-xl"
              >
                <FaClipboardCheck className="mr-2" />
                Registrar Primer Consentimiento
              </Link>
            ) : (
              <button
                onClick={limpiarFiltros}
                className="inline-flex items-center px-8 py-3 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-all"
              >
                Limpiar filtros
              </button>
            )}
          </div>
        ) : (
          <>
            {/* Encabezado de la tabla */}
            <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
              <div className="grid grid-cols-12 gap-4 text-sm font-semibold text-gray-700">
                <div className="col-span-12 md:col-span-4 flex items-center">
                  <FaIdCard className="mr-2 text-red-500" />
                  Cédula del Paciente
                </div>
                <div className="col-span-12 md:col-span-4 flex items-center">
                  <FaCalendarAlt className="mr-2 text-red-500" />
                  Fecha y Hora
                </div>
                <div className="col-span-12 md:col-span-4 text-center">
                  Acciones
                </div>
              </div>
            </div>

            {/* Lista de items */}
            <div className="divide-y divide-gray-100">
              {consentimientosFiltrados.map((c) => (
                <div 
                  key={c.id} 
                  className="px-6 py-4 hover:bg-red-50 transition-colors"
                >
                  <div className="grid grid-cols-12 gap-4 items-center">
                    {/* Cédula */}
                    <div className="col-span-12 md:col-span-4">
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
                    <div className="col-span-12 md:col-span-4">
                      <div className="flex items-center">
                        <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center mr-3">
                          <FaCalendarAlt className="text-green-600" />
                        </div>
                        <div>
                          <p className="font-medium text-gray-800">
                            {new Date(c.fechaHora).toLocaleDateString('es-ES', {
                              year: 'numeric',
                              month: 'long',
                              day: 'numeric'
                            })}
                          </p>
                          <p className="text-sm text-gray-600">
                            {new Date(c.fechaHora).toLocaleTimeString('es-ES', {
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Acciones */}
                    <div className="col-span-12 md:col-span-4">
                      <div className="flex justify-center space-x-2">
                        <a
                          href={c.archivoUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center px-4 py-2 bg-red-100 text-red-600 rounded-lg hover:bg-red-200 transition-colors"
                          title="Ver documento"
                        >
                          <FaEye className="mr-1" />
                          <span className="hidden md:inline">Ver archivo</span>
                        </a>
                        
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Información de resultados */}
            <div className="px-6 py-4 border-t border-gray-200 bg-gray-50">
              <div className="flex flex-col md:flex-row justify-between items-center">
                <div className="text-sm text-gray-600 mb-4 md:mb-0">
                  Mostrando <span className="font-semibold">{consentimientosFiltrados.length}</span> de{" "}
                  <span className="font-semibold">{consentimientos.length}</span> consentimientos
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </>
  )
}