import { getServerSession } from "next-auth"
import { authOptions } from "./api/auth/[...nextauth]/route"
import Link from "next/link"
import { prisma } from "@/lib/prisma"
import BoletinInformativo from "@/app/components/BoletinInformativo"
import {
  FaFileSignature,
  FaClipboardList,
  FaUserMd,
  FaChartLine,
  FaHospital,
  FaCalendarCheck,
  FaBell,
  FaExclamationTriangle,
  FaArrowRight
} from "react-icons/fa"
import { PiWarningCircleBold } from "react-icons/pi"

export default async function HomePage() {
  const session = await getServerSession(authOptions)

  // Fecha actual
  const now = new Date()

  // Formato fecha header
  const options: Intl.DateTimeFormatOptions = {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric"
  }
  const currentDate = now.toLocaleDateString("es-ES", options)

  // Fechas de cálculo
  const startOfToday = new Date()
  startOfToday.setHours(0, 0, 0, 0)

  const startOfMonth = new Date(
    now.getFullYear(),
    now.getMonth(),
    1,
    0, 0, 0, 0
  )

  // Verificar roles
  const esTecnicoOAdministrativo = session?.user.rol === "TECNICO" || session?.user.rol === "ADMINISTRATIVO"
  const esAdministrativo = session?.user.rol === "ADMINISTRATIVO"
  const esEspecialista = session?.user.rol === "ESPECIALISTA"

  // Consultas estadísticas
  const [
    consentimientosHoy,
    consentimientosMes,
    consentimientosTotales,
    novedadesPendientes,
    novedadesHoy,
    novedadesMes,
    novedadesPorPrioridad
  ] = await Promise.all([
    // Estadísticas de consentimientos (solo para Técnicos y Administrativos)
    esTecnicoOAdministrativo ? prisma.consentimiento.count({
      where: { createdAt: { gte: startOfToday } }
    }) : Promise.resolve(0),
    
    esTecnicoOAdministrativo ? prisma.consentimiento.count({
      where: { createdAt: { gte: startOfMonth } }
    }) : Promise.resolve(0),
    
    esTecnicoOAdministrativo ? prisma.consentimiento.count() : Promise.resolve(0),
    
    // Estadísticas de novedades (solo para Técnicos y Administrativos)
    esTecnicoOAdministrativo ? prisma.novedad.count({
      where: { estado: "PENDIENTE" }
    }) : Promise.resolve(0),
    
    esTecnicoOAdministrativo ? prisma.novedad.count({
      where: { createdAt: { gte: startOfToday } }
    }) : Promise.resolve(0),
    
    esTecnicoOAdministrativo ? prisma.novedad.count({
      where: { createdAt: { gte: startOfMonth } }
    }) : Promise.resolve(0),
    
    // Novedades por prioridad (solo para Técnicos y Administrativos)
    esTecnicoOAdministrativo ? 
      Promise.all([
        prisma.novedad.count({ where: { prioridad: "ALTA", estado: "PENDIENTE" } }),
        prisma.novedad.count({ where: { prioridad: "MEDIA", estado: "PENDIENTE" } }),
        prisma.novedad.count({ where: { prioridad: "BAJA", estado: "PENDIENTE" } })
      ]) : Promise.resolve([0, 0, 0])
  ])

  const [novedadesAltas, novedadesMedias, novedadesBajas] = novedadesPorPrioridad

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-50 via-red-50 to-white">
      
      {/* CONTENIDO */}
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        {/* HEADER */}
        <div className="mb-10 relative overflow-hidden">
          {/* Fondo decorativo */}
          <div className="absolute inset-0 bg-gradient-to-r from-red-600 to-red-400 opacity-5 rounded-3xl"></div>
          
          <div className="relative p-6 md:p-8">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <div>
                <div className="flex items-center gap-3 mb-2">
                  <h1 className="text-3xl md:text-4xl font-black text-gray-800">
                    Panel de Control
                  </h1>
                  <span className="px-3 py-1 bg-red-100 text-red-700 rounded-full text-sm font-medium border border-red-200">
                    {session?.user.rol === "ADMINISTRATIVO" ? "Administrativo" : 
                     session?.user.rol === "TECNICO" ? "Técnico" : 
                     session?.user.rol === "ESPECIALISTA" ? "Especialista" : "Operativo"}
                  </span>
                </div>
                
                <div className="flex items-center gap-2 text-gray-600">
                  <FaCalendarCheck className="text-red-500" />
                  <p className="text-lg capitalize">
                    {currentDate}
                  </p>
                </div>

                {/* Bienvenida personalizada */}
                <p className="text-gray-600 mt-2">
                  Bienvenido, <span className="font-semibold text-gray-800">{session?.user.nombres}</span>
                </p>
              </div>

              <div className="flex items-center gap-4">
                <div className="hidden md:flex items-center gap-2 bg-white px-4 py-2 rounded-full shadow-sm border border-red-100">
                  <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                  <span className="text-sm text-gray-600">Sistema en línea</span>
                </div>
                
                {/* Indicador de novedades - Solo para Técnicos y Administrativos */}
                {esTecnicoOAdministrativo && (
                  <div className="flex items-center gap-3 bg-white px-4 py-2 rounded-lg shadow-sm">
                    <FaBell className="text-red-500" />
                    <span className="text-sm font-medium text-gray-700">
                      {novedadesPendientes > 0 ? (
                        <span className="flex items-center gap-1">
                          <span className="w-2 h-2 bg-red-500 rounded-full"></span>
                          {novedadesPendientes} novedad{novedadesPendientes !== 1 ? 'es' : ''} pendiente{novedadesPendientes !== 1 ? 's' : ''}
                        </span>
                      ) : "Sin novedades pendientes"}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* ACCIONES PRINCIPALES */}
        <div className="mb-12">
          <h2 className="text-lg font-semibold text-gray-700 mb-4 flex items-center">
            <span className="w-1 h-6 bg-red-600 rounded-full mr-3"></span>
            Acciones rápidas
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* Registrar Consentimiento - Siempre visible para todos */}
            <Link href="/consentimiento" className="group transform hover:-translate-y-1 transition-all duration-300">
              <div className="bg-white rounded-2xl shadow-lg hover:shadow-2xl overflow-hidden border-2 border-transparent hover:border-red-200 h-full">
                <div className="p-6 bg-gradient-to-br from-red-500 to-red-600">
                  <div className="flex items-center justify-between">
                    <FaFileSignature className="text-4xl text-white" />
                    <span className="px-3 py-1 bg-white/20 rounded-full text-white text-xs font-medium backdrop-blur-sm">
                      Nuevo
                    </span>
                  </div>
                </div>
                <div className="p-6">
                  <h3 className="text-xl font-bold text-gray-800 mb-2">Registrar Consentimiento</h3>
                  <p className="text-gray-600 text-sm mb-4">
                    Cree un nuevo consentimiento informado para pacientes de forma rápida y segura.
                  </p>
                  <div className="flex items-center text-red-600 font-medium text-sm">
                    <span>Crear consentimiento</span>
                    <FaArrowRight className="ml-2 group-hover:translate-x-1 transition-transform" />
                  </div>
                </div>
              </div>
            </Link>

            {/* Registrar Novedad - PARA TODOS LOS ROLES (incluyendo Especialistas) */}
            <Link href="/novedades/registrar" className="group transform hover:-translate-y-1 transition-all duration-300">
              <div className="bg-white rounded-2xl shadow-lg hover:shadow-2xl overflow-hidden border-2 border-transparent hover:border-amber-200 h-full">
                <div className="p-6 bg-gradient-to-br from-amber-500 to-amber-600">
                  <div className="flex items-center justify-between">
                    <FaExclamationTriangle className="text-4xl text-white" />
                    <span className="px-3 py-1 bg-white/20 rounded-full text-white text-xs font-medium backdrop-blur-sm">
                      Reportar
                    </span>
                  </div>
                </div>
                <div className="p-6">
                  <h3 className="text-xl font-bold text-gray-800 mb-2">Registrar Novedad</h3>
                  <p className="text-gray-600 text-sm mb-4">
                    Reporte incidentes, eventos o situaciones relevantes durante la atención o en ruta.
                  </p>
                  <div className="flex items-center text-amber-600 font-medium text-sm">
                    <span>Reportar novedad</span>
                    <FaArrowRight className="ml-2 group-hover:translate-x-1 transition-transform" />
                  </div>
                </div>
              </div>
            </Link>

            {/* Gestión de Consentimientos - Solo Administrativos */}
            {esTecnicoOAdministrativo && (
              <Link href="/consentimientos" className="group transform hover:-translate-y-1 transition-all duration-300">
                <div className="bg-white rounded-2xl shadow-lg hover:shadow-2xl overflow-hidden border-2 border-transparent hover:border-green-200 h-full">
                  <div className="p-6 bg-gradient-to-br from-green-500 to-green-600">
                    <div className="flex items-center justify-between">
                      <FaClipboardList className="text-4xl text-white" />
                      <span className="px-3 py-1 bg-white/20 rounded-full text-white text-xs font-medium backdrop-blur-sm">
                        Gestión
                      </span>
                    </div>
                  </div>
                  <div className="p-6">
                    <h3 className="text-xl font-bold text-gray-800 mb-2">Gestionar Consentimientos</h3>
                    <p className="text-gray-600 text-sm mb-4">
                      Visualice, filtre y administre todos los consentimientos del sistema.
                    </p>
                    <div className="flex items-center text-green-600 font-medium text-sm">
                      <span>Ir a gestión</span>
                      <FaArrowRight className="ml-2 group-hover:translate-x-1 transition-transform" />
                    </div>
                  </div>
                </div>
              </Link>
            )}
          </div>
        </div>

        {/* ESTADÍSTICAS - Solo visibles para Técnicos y Administrativos */}
        {esTecnicoOAdministrativo && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-12">
            {/* Estadísticas de Consentimientos */}
            <div className="bg-white rounded-2xl shadow-xl overflow-hidden border border-gray-100">
              <div className="p-6 bg-gradient-to-r from-red-50 to-red-100 border-b border-red-200">
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <div className="p-3 bg-red-600 rounded-xl mr-4">
                      <FaFileSignature className="text-2xl text-white" />
                    </div>
                    <div>
                      <h3 className="text-xl font-bold text-gray-800">Consentimientos Informados</h3>
                      <p className="text-sm text-gray-600">Seguimiento en tiempo real</p>
                    </div>
                  </div>
                  <FaChartLine className="text-3xl text-red-600 opacity-30" />
                </div>
              </div>
              
              <div className="p-6">
                <div className="grid grid-cols-3 gap-4">
                  <div className="text-center p-4 bg-red-50 rounded-xl">
                    <span className="text-3xl font-bold text-red-600">{consentimientosHoy}</span>
                    <p className="text-xs text-gray-600 mt-1">Hoy</p>
                  </div>
                  <div className="text-center p-4 bg-red-50 rounded-xl">
                    <span className="text-3xl font-bold text-red-600">{consentimientosMes}</span>
                    <p className="text-xs text-gray-600 mt-1">Este mes</p>
                  </div>
                  <div className="text-center p-4 bg-amber-50 rounded-xl">
                    <span className="text-3xl font-bold text-amber-600">{consentimientosTotales}</span>
                    <p className="text-xs text-gray-600 mt-1">Totales</p>
                  </div>
                </div>

                {esTecnicoOAdministrativo && (
                  <Link 
                    href="/consentimientos/todos" 
                    className="mt-6 block text-center py-2 text-sm text-red-600 hover:text-red-700 font-medium border border-red-200 rounded-lg hover:bg-red-50 transition-colors"
                  >
                    Ver todos los consentimientos
                  </Link>
                )}
              </div>
            </div>

            {/* Estadísticas de Novedades - Solo para Técnicos y Administrativos */}
            <div className="bg-white rounded-2xl shadow-xl overflow-hidden border border-gray-100">
              <div className="p-6 bg-gradient-to-r from-amber-50 to-amber-100 border-b border-amber-200">
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <div className="p-3 bg-amber-600 rounded-xl mr-4">
                      <FaExclamationTriangle className="text-2xl text-white" />
                    </div>
                    <div>
                      <h3 className="text-xl font-bold text-gray-800">Novedades y Alertas</h3>
                      <p className="text-sm text-gray-600">Seguimiento de incidentes</p>
                    </div>
                  </div>
                  <PiWarningCircleBold className="text-3xl text-amber-600 opacity-30" />
                </div>
              </div>
              
              <div className="p-6">
                {/* Resumen de novedades */}
                <div className="grid grid-cols-3 gap-4 mb-6">
                  <div className="text-center p-4 bg-amber-50 rounded-xl">
                    <span className="text-3xl font-bold text-amber-600">{novedadesHoy}</span>
                    <p className="text-xs text-gray-600 mt-1">Hoy</p>
                  </div>
                  <div className="text-center p-4 bg-amber-50 rounded-xl">
                    <span className="text-3xl font-bold text-amber-600">{novedadesMes}</span>
                    <p className="text-xs text-gray-600 mt-1">Este mes</p>
                  </div>
                  <div className="text-center p-4 bg-red-50 rounded-xl">
                    <span className="text-3xl font-bold text-red-600">{novedadesPendientes}</span>
                    <p className="text-xs text-gray-600 mt-1">Pendientes</p>
                  </div>
                </div>

                {/* Distribución por prioridad */}
                <div className="space-y-3 mb-4">
                  <h4 className="text-sm font-semibold text-gray-700 mb-2">Pendientes por prioridad</h4>
                  <div className="flex items-center justify-between text-sm">
                    <span className="flex items-center">
                      <span className="w-2 h-2 bg-red-500 rounded-full mr-2"></span>
                      Prioridad Alta
                    </span>
                    <span className="font-semibold">{novedadesAltas}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="flex items-center">
                      <span className="w-2 h-2 bg-amber-500 rounded-full mr-2"></span>
                      Prioridad Media
                    </span>
                    <span className="font-semibold">{novedadesMedias}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="flex items-center">
                      <span className="w-2 h-2 bg-green-500 rounded-full mr-2"></span>
                      Prioridad Baja
                    </span>
                    <span className="font-semibold">{novedadesBajas}</span>
                  </div>
                </div>

                {/* Acceso a gestión de novedades */}
                <Link 
                  href="/novedades/todas" 
                  className="mt-4 block w-full text-center py-2 bg-amber-50 hover:bg-amber-100 text-amber-700 rounded-lg transition-colors font-medium text-sm"
                >
                  Gestionar todas las novedades
                </Link>
              </div>
            </div>
          </div>
        )}

        {/* Mensaje para Especialistas - Solo ven acciones, no estadísticas */}
        {esEspecialista && (
          <div className="mb-12 p-6 bg-blue-50 rounded-2xl border border-blue-200">
            <div className="flex items-center">
              <div className="p-3 bg-blue-100 rounded-xl mr-4">
                <FaUserMd className="text-2xl text-blue-600" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-800">Bienvenido Especialista</h3>
                <p className="text-gray-600">
 Desde aquí puedes registrar consentimientos y reportar novedades durante tus atenciones domiciliarias.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* BOLETÍN INFORMATIVO - Visible para todos (solo Administrativo puede editar) */}
        <BoletinInformativo canEdit={esAdministrativo} />

        {/* FOOTER */}
        <footer className="mt-16 pt-8 border-t border-gray-200">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
            <div>
              <div className="flex items-center mb-4">
                <div className="w-12 h-12 bg-gradient-to-br from-red-600 to-red-500 rounded-xl flex items-center justify-center mr-3 shadow-lg">
                  <FaHospital className="text-white text-2xl" />
                </div>
                <div>
                  <h3 className="font-bold text-gray-800 text-lg">Especialistas en Casa IPS</h3>
                  <p className="text-gray-600 text-sm">Salud Domiciliaria Profesional</p>
                </div>
              </div>
              <p className="text-gray-500 text-sm">
                Comprometidos con la excelencia en atención médica domiciliaria y la satisfacción de nuestros pacientes.
              </p>
            </div>

            <div>
              <h4 className="font-semibold text-gray-800 mb-3">Información del sistema</h4>
              <div className="space-y-2 text-sm">
                <p className="text-gray-600">Versión 1.0.0</p>
                <p className="text-gray-600">© 2026 Especialistas en Casa IPS</p>
                <p className="text-gray-600">Todos los derechos reservados</p>
              </div>
            </div>
          </div>

          <div className="pt-6 border-t border-gray-100">
            <div className="flex flex-wrap justify-center gap-6">
              <span className="text-gray-500 text-sm">Calidad y seguridad</span>
              <span className="text-gray-500 text-sm">•</span>
              <span className="text-gray-500 text-sm">Confidencialidad garantizada</span>
              <span className="text-gray-500 text-sm">•</span>
              <span className="text-gray-500 text-sm">Atención humanizada</span>
              <span className="text-gray-500 text-sm">•</span>
              <span className="text-gray-500 text-sm">Mejora continua</span>
            </div>
          </div>
        </footer>
      </div>
    </main>
  )
}
