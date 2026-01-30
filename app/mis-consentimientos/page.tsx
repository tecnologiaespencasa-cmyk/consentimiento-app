import { getServerSession } from "next-auth"
import { authOptions } from "@/app/api/auth/[...nextauth]/route"
import { prisma } from "@/lib/prisma"
import { 
  FaFilePdf, 
  FaClipboardCheck,
  FaShieldAlt,
  FaCheckCircle
} from "react-icons/fa"
import Link from "next/link"
import FiltrosConsentimientos from "./components/FiltrosConsentimientos"

export default async function MisConsentimientosPage() {
  const session = await getServerSession(authOptions)

  if (!session?.user) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="text-center">
          <div className="inline-block p-4 bg-red-100 rounded-full mb-4">
            <FaClipboardCheck className="text-3xl text-red-600" />
          </div>
          <h1 className="text-2xl font-bold text-gray-800 mb-2">Acceso no autorizado</h1>
          <p className="text-gray-600 mb-6">Debes iniciar sesión para ver esta página</p>
          <Link
            href="/api/auth/signin"
            className="inline-flex items-center px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
          >
            Iniciar Sesión
          </Link>
        </div>
      </div>
    )
  }

  const consentimientos = await prisma.consentimiento.findMany({
    where: {
      usuarioId: session.user.id
    },
    orderBy: {
      createdAt: "desc"
    }
  })

  // Calcular estadísticas
  const totalConsentimientos = consentimientos.length
  const aceptados = consentimientos.filter(c => c.aceptado).length
  const rechazados = consentimientos.filter(c => !c.aceptado).length
  
  const hoy = new Date()
  hoy.setHours(0, 0, 0, 0)
  const consentimientosHoy = consentimientos.filter(c => {
    const fechaConsentimiento = new Date(c.fechaHora)
    fechaConsentimiento.setHours(0, 0, 0, 0)
    return fechaConsentimiento.getTime() === hoy.getTime()
  }).length

  // Mapear consentimientos para incluir el campo aceptado
  const consentimientosConEstado = consentimientos.map(c => ({
    ...c,
    aceptado: c.aceptado
  }))

  return (
    <div className="min-h-screen bg-gradient-to-b from-red-50 to-white">
      {/* Header de la página */}
      <div className="bg-gradient-to-r from-red-700 to-red-700 text-white py-6 md:py-8 px-4">
        <div className="container mx-auto">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <div className="text-center md:text-left mb-4 md:mb-0">
              <h1 className="text-2xl md:text-3xl lg:text-4xl font-bold mb-2">
                <FaClipboardCheck className="inline-block mr-2 md:mr-3" />
                Mis Consentimientos
              </h1>
              <p className="text-red-100 text-sm md:text-lg">
                Gestión de documentos consentimientos informados
              </p>
            </div>
            
            <div className="w-full md:w-auto">
              {/* Estadísticas - Móvil */}
              <div className="md:hidden flex justify-around mb-4">
                <div className="text-center">
                  <p className="text-2xl font-bold">{totalConsentimientos}</p>
                  <p className="text-xs text-red-200">Total</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-green-300">{aceptados}</p>
                  <p className="text-xs text-green-200">Aceptados</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-red-300">{rechazados}</p>
                  <p className="text-xs text-red-200">Rechazados</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-yellow-300">{consentimientosHoy}</p>
                  <p className="text-xs text-yellow-200">Hoy</p>
                </div>
              </div>

              {/* Estadísticas - Desktop */}
              <div className="hidden md:flex items-center space-x-4 lg:space-x-6">
                <div className="text-center">
                  <p className="text-2xl font-bold">{totalConsentimientos}</p>
                  <p className="text-sm text-red-200">Total</p>
                </div>
                <div className="h-12 w-px bg-white/30"></div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-green-300">{aceptados}</p>
                  <p className="text-sm text-green-200">Aceptados</p>
                </div>
                <div className="h-12 w-px bg-white/30"></div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-red-300">{rechazados}</p>
                  <p className="text-sm text-red-200">Rechazados</p>
                </div>
                <div className="h-12 w-px bg-white/30"></div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-yellow-300">{consentimientosHoy}</p>
                  <p className="text-sm text-yellow-200">Hoy</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Contenido principal */}
      <div className="container mx-auto px-4 py-6 md:py-8">
        {/* Componente de filtros (cliente) */}
        <FiltrosConsentimientos consentimientos={consentimientosConEstado} />
        
        {/* Información adicional */}
        <div className="mt-6 md:mt-8 grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
          <div className="bg-white p-4 md:p-6 rounded-2xl shadow-lg border-l-4 border-red-500">
            <div className="flex items-center mb-3 md:mb-4">
              <div className="p-2 md:p-3 bg-red-100 rounded-lg mr-3 md:mr-4">
                <FaFilePdf className="text-xl md:text-2xl text-red-600" />
              </div>
              <div>
                <h3 className="font-bold text-gray-800 text-sm md:text-base">Documentos PDF/imagen</h3>
                <p className="text-xs md:text-sm text-gray-600">Formato seguro y estándar</p>
              </div>
            </div>
            <p className="text-gray-700 text-sm md:text-base">
              Todos los consentimientos se almacenan en formato PDF o imagen para garantizar su integridad y facilitar su visualización.
            </p>
          </div>

          <div className="bg-white p-4 md:p-6 rounded-2xl shadow-lg border-l-4 border-green-500">
            <div className="flex items-center mb-3 md:mb-4">
              <div className="p-2 md:p-3 bg-green-100 rounded-lg mr-3 md:mr-4">
                <FaShieldAlt className="text-xl md:text-2xl text-green-600" />
              </div>
              <div>
                <h3 className="font-bold text-gray-800 text-sm md:text-base">Seguridad Garantizada</h3>
                <p className="text-xs md:text-sm text-gray-600">Protección de datos</p>
              </div>
            </div>
            <p className="text-gray-700 text-sm md:text-base">
              Los documentos están protegidos y solo son accesibles por personal autorizado.
            </p>
          </div>
        </div>

        {/* Sección de ayuda rápida - Solo móvil */}
        <div className="mt-6 md:hidden bg-gradient-to-r from-blue-50 to-indigo-50 p-4 rounded-2xl shadow">
          <h3 className="font-bold text-gray-800 mb-2 flex items-center">
            <FaCheckCircle className="mr-2 text-green-600" />
            Estados de Consentimientos
          </h3>
          <div className="space-y-2">
            <div className="flex items-center">
              <span className="inline-block w-3 h-3 bg-green-500 rounded-full mr-2"></span>
              <span className="text-sm text-gray-700">
                <span className="font-medium">Aceptado:</span> Documento aprobado y procesado
              </span>
            </div>
            <div className="flex items-center">
              <span className="inline-block w-3 h-3 bg-red-500 rounded-full mr-2"></span>
              <span className="text-sm text-gray-700">
                <span className="font-medium">Rechazado:</span> Requiere revisión o corrección
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}