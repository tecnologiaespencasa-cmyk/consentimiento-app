"use client"

import { useState, useMemo } from "react"
import { 
  FaSearch, 
  FaCalendarAlt, 
  FaIdCard, 
  FaDownload, 
  FaEye, 
  FaUser, 
  FaUserTag,
  FaFilePdf 
} from "react-icons/fa"

interface Usuario {
  nombre: string
  username: string
  rol: string
}

interface Consentimiento {
  id: string
  cedula: string
  fechaHora: Date
  archivoUrl: string
  usuarioId: string
  usuario: Usuario
}

interface ConsentimientosFiltrosProps {
  consentimientos: Consentimiento[]
  rol: string
}

export default function ConsentimientosFiltros({ consentimientos, rol }: ConsentimientosFiltrosProps) {
  const [busqueda, setBusqueda] = useState("")
  const [filtroUsuario, setFiltroUsuario] = useState("todos")
  const [filtroRol, setFiltroRol] = useState("todos")
  const [filtroFecha, setFiltroFecha] = useState<"todos" | "hoy" | "semana" | "mes">("todos")
  const [orden, setOrden] = useState<"desc" | "asc">("desc")

  // Obtener usuarios únicos para filtro
  const usuariosUnicos = useMemo(() => {
    const usuariosMap = new Map<string, Usuario>()
    consentimientos.forEach(c => {
      usuariosMap.set(c.usuarioId, c.usuario)
    })
    return Array.from(usuariosMap.values())
  }, [consentimientos])

  // Obtener roles únicos para filtro
  const rolesUnicos = useMemo(() => {
    const rolesSet = new Set<string>()
    consentimientos.forEach(c => {
      rolesSet.add(c.usuario.rol)
    })
    return Array.from(rolesSet)
  }, [consentimientos])

  // Función para filtrar consentimientos
  const consentimientosFiltrados = useMemo(() => {
    let resultado = [...consentimientos]

    // Filtrar por búsqueda (cédula o nombre de usuario)
    if (busqueda) {
      resultado = resultado.filter(c => 
        c.cedula.toLowerCase().includes(busqueda.toLowerCase()) ||
        c.usuario.nombre.toLowerCase().includes(busqueda.toLowerCase()) ||
        c.usuario.username.toLowerCase().includes(busqueda.toLowerCase())
      )
    }

    // Filtrar por usuario
    if (filtroUsuario !== "todos") {
      resultado = resultado.filter(c => c.usuarioId === filtroUsuario)
    }

    // Filtrar por rol
    if (filtroRol !== "todos") {
      resultado = resultado.filter(c => c.usuario.rol === filtroRol)
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
        break
    }

    // Ordenar
    resultado.sort((a, b) => {
      const fechaA = new Date(a.fechaHora).getTime()
      const fechaB = new Date(b.fechaHora).getTime()
      return orden === "desc" ? fechaB - fechaA : fechaA - fechaB
    })

    return resultado
  }, [consentimientos, busqueda, filtroUsuario, filtroRol, filtroFecha, orden])

  const limpiarFiltros = () => {
    setBusqueda("")
    setFiltroUsuario("todos")
    setFiltroRol("todos")
    setFiltroFecha("todos")
    setOrden("desc")
  }

  const tieneFiltrosActivos = busqueda || filtroUsuario !== "todos" || filtroRol !== "todos" || filtroFecha !== "todos"

  return (
    <>
      {/* Barra de herramientas */}
      <div className="mb-8 bg-white rounded-2xl shadow-lg p-6">
        <div className="flex flex-col gap-4">
          {/* Primera fila: Búsqueda */}
          <div className="flex flex-col md:flex-row gap-4">
            <div className="relative flex-1">
              <input
                type="text"
                placeholder="Buscar por cédula, nombre o usuario..."
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                className="pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent w-full"
              />
              <FaSearch className="absolute left-3 top-3.5 text-gray-400" />
            </div>
            
            <button
              onClick={limpiarFiltros}
              disabled={!tieneFiltrosActivos}
              className="px-6 py-3 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
            >
              Limpiar filtros
            </button>
          </div>

          {/* Segunda fila: Filtros */}
          <div className="flex flex-wrap gap-4">
            {/* Filtro por usuario */}
            <div className="flex items-center space-x-2">
              <FaUser className="text-gray-400" />
              <select
                value={filtroUsuario}
                onChange={(e) => setFiltroUsuario(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
              >
                <option value="todos">Todos los usuarios</option>
                {usuariosUnicos.map(usuario => (
                  <option key={usuario.username} value={consentimientos.find(c => c.usuario.username === usuario.username)?.usuarioId}>
                    {usuario.nombre} ({usuario.rol})
                  </option>
                ))}
              </select>
            </div>

            {/* Filtro por rol */}
            <div className="flex items-center space-x-2">
              <FaUserTag className="text-gray-400" />
              <select
                value={filtroRol}
                onChange={(e) => setFiltroRol(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
              >
                <option value="todos">Todos los roles</option>
                {rolesUnicos.map(rol => (
                  <option key={rol} value={rol}>{rol}</option>
                ))}
              </select>
            </div>

            {/* Filtro por fecha */}
            <div className="flex items-center space-x-2">
              <FaCalendarAlt className="text-gray-400" />
              <select
                value={filtroFecha}
                onChange={(e) => setFiltroFecha(e.target.value as any)}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
              >
                <option value="todos">Todas las fechas</option>
                <option value="hoy">Hoy</option>
                <option value="semana">Última semana</option>
                <option value="mes">Último mes</option>
              </select>
            </div>

            {/* Orden */}
            <div className="flex items-center space-x-2">
              <select
                value={orden}
                onChange={(e) => setOrden(e.target.value as "asc" | "desc")}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
              >
                <option value="desc">Más recientes primero</option>
                <option value="asc">Más antiguos primero</option>
              </select>
            </div>
          </div>

          {/* Información de filtros aplicados */}
          {tieneFiltrosActivos && (
            <div className="mt-2 p-3 bg-blue-50 rounded-lg">
              <p className="text-sm text-blue-800">
                Mostrando {consentimientosFiltrados.length} de {consentimientos.length} consentimientos
                {busqueda && ` • Buscando: "${busqueda}"`}
                {filtroUsuario !== "todos" && ` • Usuario: ${usuariosUnicos.find(u => consentimientos.find(c => c.usuario.username === u.username)?.usuarioId === filtroUsuario)?.nombre}`}
                {filtroRol !== "todos" && ` • Rol: ${filtroRol}`}
                {filtroFecha !== "todos" && ` • Fecha: ${filtroFecha === "hoy" ? "Hoy" : filtroFecha === "semana" ? "Última semana" : "Último mes"}`}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Lista de consentimientos */}
      <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
        {consentimientosFiltrados.length === 0 ? (
          <div className="text-center py-16">
            <div className="inline-block p-6 bg-red-50 rounded-full mb-6">
              <FaFilePdf className="text-5xl text-red-400" />
            </div>
            <h2 className="text-2xl font-bold text-gray-800 mb-2">
              {consentimientos.length === 0 
                ? "No hay consentimientos registrados"
                : "No se encontraron consentimientos"}
            </h2>
            <p className="text-gray-600 mb-8 max-w-md mx-auto">
              {consentimientos.length === 0
                ? "El sistema aún no tiene consentimientos registrados."
                : "Intenta con otros criterios de búsqueda o limpia los filtros."}
            </p>
            {consentimientos.length > 0 && (
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
                <div className="col-span-12 md:col-span-2 flex items-center">
                  <FaIdCard className="mr-2 text-red-500" />
                  Cédula
                </div>
                <div className="col-span-12 md:col-span-3 flex items-center">
                  <FaCalendarAlt className="mr-2 text-red-500" />
                  Fecha y Hora
                </div>
                <div className="col-span-12 md:col-span-3 flex items-center">
                  <FaUser className="mr-2 text-red-500" />
                  Usuario
                </div>
                <div className="col-span-12 md:col-span-2 flex items-center">
                  <FaUserTag className="mr-2 text-red-500" />
                  Rol
                </div>
                <div className="col-span-12 md:col-span-2 text-center">
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
                    <div className="col-span-12 md:col-span-2">
                      <div className="flex items-center">
                        <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center mr-3">
                          <FaIdCard className="text-red-600" />
                        </div>
                        <span className="font-medium text-gray-800">{c.cedula}</span>
                      </div>
                    </div>

                    {/* Fecha y Hora */}
                    <div className="col-span-12 md:col-span-3">
                      <div className="flex items-center">
                        <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center mr-3">
                          <FaCalendarAlt className="text-green-600" />
                        </div>
                        <div>
                          <p className="font-medium text-gray-800">
                            {new Date(c.fechaHora).toLocaleDateString('es-ES', {
                              year: 'numeric',
                              month: 'short',
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

                    {/* Usuario */}
                    <div className="col-span-12 md:col-span-3">
                      <div className="flex items-center">
                        <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center mr-3">
                          <FaUser className="text-blue-600" />
                        </div>
                        <div>
                          <p className="font-medium text-gray-800">{c.usuario.nombre}</p>
                          <p className="text-sm text-gray-600">{c.usuario.username}</p>
                        </div>
                      </div>
                    </div>

                    {/* Rol */}
                    <div className="col-span-12 md:col-span-2">
                      <div className="flex items-center">
                        <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                          c.usuario.rol === 'ADMINISTRATIVO' 
                            ? 'bg-red-100 text-red-800' 
                            : c.usuario.rol === 'TECNICO'
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-green-100 text-green-800'
                        }`}>
                          {c.usuario.rol}
                        </span>
                      </div>
                    </div>

                    {/* Acciones */}
                    <div className="col-span-12 md:col-span-2">
                      <div className="flex justify-center space-x-2">
                        <a
                          href={c.archivoUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center px-3 py-2 bg-red-100 text-red-600 rounded-lg hover:bg-red-200 transition-colors"
                          title="Ver documento"
                        >
                          <FaEye className="mr-1" />
                          <span className="hidden md:inline">Ver</span>
                        </a>
                        
                        <a
                          href={c.archivoUrl}
                          download
                          className="flex items-center px-3 py-2 bg-blue-100 text-blue-600 rounded-lg hover:bg-blue-200 transition-colors"
                          title="Descargar documento"
                        >
                          <FaDownload className="mr-1" />
                          <span className="hidden md:inline">Descargar</span>
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
                
                <div className="text-sm text-gray-600">
                  Rol actual: <span className="font-semibold text-red-600">{rol}</span>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </>
  )
}