import { getServerSession } from "next-auth"
import { authOptions } from "./api/auth/[...nextauth]/route"
import Link from "next/link"
import { prisma } from "@/lib/prisma"
import {
  FaFileSignature,
  FaClipboardList,
  FaUserMd,
  FaShieldAlt,
  FaChartLine,
  FaHospital,
  FaHome,
  FaCalendarCheck,
  FaBell
} from "react-icons/fa"
import Image from "next/image"

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

  // Consultas estadísticas
  const [
    consentimientosHoy,
    consentimientosMes,
    consentimientosTotales
  ] = await Promise.all([
    prisma.consentimiento.count({
      where: {
        createdAt: {
          gte: startOfToday
        }
      }
    }),
    prisma.consentimiento.count({
      where: {
        createdAt: {
          gte: startOfMonth
        }
      }
    }),
    prisma.consentimiento.count()
  ])

  return (
    <main className="min-h-screen bg-gradient-to-b from-red-50 to-white">
      
      {/* CONTENIDO */}
      <div className="container mx-auto px-4 py-8">
        {/* INFO SUPERIOR */}
        <div className="mb-8 p-4 bg-white rounded-2xl shadow-lg border-l-4 border-red-600">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <div>
              <h2 className="text-xl md:text-2xl font-bold text-gray-800">
                {session?.user.rol === "ADMINISTRATIVO"
                  ? "Panel de Administración"
                  : "Panel de Operaciones"}
              </h2>
              <p className="text-gray-600 mt-1">
                {currentDate.charAt(0).toUpperCase() + currentDate.slice(1)}
              </p>
            </div>

            <div className="mt-4 md:mt-0 flex items-center space-x-4">
              <div className="hidden md:flex items-center space-x-2 text-red-600">
                <FaBell className="animate-pulse" />
                <span className="text-sm">Sistema activo</span>
              </div>
              <div className="px-4 py-2 bg-red-100 text-red-700 rounded-full text-sm font-medium">
                Gestión de consentimientos informados
              </div>
            </div>
          </div>
        </div>

        {/* TARJETAS PRINCIPALES */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
          <Link href="/consentimiento" className="group">
            <div className="bg-white p-6 rounded-2xl shadow-lg hover:shadow-2xl transition">
              <div className="flex items-center mb-4">
                <div className="p-3 bg-red-100 rounded-xl mr-4">
                  <FaFileSignature className="text-2xl text-red-600" />
                </div>
                <h3 className="text-xl font-bold">Registrar Consentimiento</h3>
              </div>
              <p className="text-gray-600 mb-4">
                Cree un nuevo consentimiento informado para pacientes.
              </p>
            </div>
          </Link>

          {session?.user.rol === "ADMINISTRATIVO" && (
            <Link href="/consentimientos">
              <div className="bg-white p-6 rounded-2xl shadow-lg hover:shadow-2xl transition">
                <div className="flex items-center mb-4">
                  <div className="p-3 bg-green-100 rounded-xl mr-4">
                    <FaClipboardList className="text-2xl text-green-600" />
                  </div>
                  <h3 className="text-xl font-bold">
                    Gestión de Consentimientos
                  </h3>
                </div>
                <p className="text-gray-600 mb-4">
                  Visualice y administre todos los consentimientos.
                </p>
              </div>
            </Link>
          )}

          {session?.user.rol === "ADMINISTRATIVO" && (
            <div className="bg-gradient-to-br from-red-50 to-white p-6 rounded-2xl shadow-lg">
              <div className="flex items-center mb-4">
                <div className="p-3 bg-blue-100 rounded-xl mr-4">
                  <FaChartLine className="text-2xl text-blue-600" />
                </div>
                <h3 className="text-xl font-bold">
                  Estadísticas del Sistema
                </h3>
              </div>

              <div className="space-y-3">
                <div className="flex justify-between p-3 bg-white rounded-lg">
                  <span>Consentimientos hoy</span>
                  <span className="font-bold text-red-600">
                    {consentimientosHoy}
                  </span>
                </div>

                <div className="flex justify-between p-3 bg-white rounded-lg">
                  <span>Total este mes</span>
                  <span className="font-bold text-red-600">
                    {consentimientosMes}
                  </span>
                </div>

                <div className="flex justify-between p-3 bg-white rounded-lg">
                  <span>Consentimientos totales</span>
                  <span className="font-bold text-yellow-600">
                    {consentimientosTotales}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Sección de información y valores */}
        <div className="bg-white rounded-2xl shadow-lg p-6 mb-8">
          <div className="flex items-center mb-6">
            <div className="p-2 bg-red-100 rounded-lg mr-3">
              <FaShieldAlt className="text-xl text-red-600" />
            </div>
            <h2 className="text-2xl font-bold text-gray-800">Importancia del Consentimiento Informado</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div className="flex items-start">
                <div className="flex-shrink-0 mt-1">
                  <div className="w-6 h-6 bg-red-100 rounded-full flex items-center justify-center">
                    <span className="text-red-600 text-sm font-bold">1</span>
                  </div>
                </div>
                <div className="ml-4">
                  <h4 className="font-semibold text-gray-800">Derecho del Paciente</h4>
                  <p className="text-gray-600 text-sm mt-1">
                    Todo paciente tiene derecho a recibir información clara y completa sobre su tratamiento.
                  </p>
                </div>
              </div>

              <div className="flex items-start">
                <div className="flex-shrink-0 mt-1">
                  <div className="w-6 h-6 bg-red-100 rounded-full flex items-center justify-center">
                    <span className="text-red-600 text-sm font-bold">2</span>
                  </div>
                </div>
                <div className="ml-4">
                  <h4 className="font-semibold text-gray-800">Responsabilidad Médica</h4>
                  <p className="text-gray-600 text-sm mt-1">
                    Documentación que protege tanto al profesional como al paciente en procedimientos médicos.
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex items-start">
                <div className="flex-shrink-0 mt-1">
                  <div className="w-6 h-6 bg-red-100 rounded-full flex items-center justify-center">
                    <span className="text-red-600 text-sm font-bold">3</span>
                  </div>
                </div>
                <div className="ml-4">
                  <h4 className="font-semibold text-gray-800">Cumplimiento Legal</h4>
                  <p className="text-gray-600 text-sm mt-1">
                    Requisito obligatorio según la legislación colombiana de salud y derechos del paciente.
                  </p>
                </div>
              </div>

              <div className="flex items-start">
                <div className="flex-shrink-0 mt-1">
                  <div className="w-6 h-6 bg-red-100 rounded-full flex items-center justify-center">
                    <span className="text-red-600 text-sm font-bold">4</span>
                  </div>
                </div>
                <div className="ml-4">
                  <h4 className="font-semibold text-gray-800">Confianza y Transparencia</h4>
                  <p className="text-gray-600 text-sm mt-1">
                    Fortalece la relación médico-paciente mediante la comunicación clara y honesta.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer de la página */}
        <footer className="mt-12 pt-8 border-t border-gray-200">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <div className="mb-4 md:mb-0">
              <div className="flex items-center">
                <div className="w-10 h-10 bg-red-600 rounded-lg flex items-center justify-center mr-3">
                  <FaHospital className="text-white text-xl" />
                </div>
                <div>
                  <h3 className="font-bold text-gray-800">Especialistas en Casa IPS</h3>
                  <p className="text-gray-600 text-sm">Salud Domiciliaria Profesional</p>
                </div>
              </div>
            </div>

            <div className="text-center md:text-right">
              <p className="text-gray-600 text-sm">
                Portal administrativo especialistas en casa v1.0
              </p>
              <p className="text-gray-500 text-xs mt-1">
                © 2026 Todos los derechos reservados
              </p>
            </div>
          </div>

          <div className="mt-6 flex flex-wrap justify-center gap-4">
            <div className="flex items-center text-gray-600 text-sm">
              <FaHome className="mr-2 text-red-500" />
              <span>Salud Domiciliaria</span>
            </div>
            <div className="flex items-center text-gray-600 text-sm">
              <FaUserMd className="mr-2 text-red-500" />
              <span>Atención Especializada</span>
            </div>
            <div className="flex items-center text-gray-600 text-sm">
              <FaShieldAlt className="mr-2 text-red-500" />
              <span>Confidencialidad Garantizada</span>
            </div>
          </div>
        </footer>
      </div>
    </main>
  )
}