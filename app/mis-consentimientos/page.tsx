import { getServerSession } from "next-auth"
import { authOptions } from "@/app/api/auth/[...nextauth]/route"
import { prisma } from "@/lib/prisma"
import { 
  FaFilePdf, 
  FaCalendarAlt, 
  FaIdCard, 
  FaDownload, 
  FaEye,
  FaClipboardCheck,
  FaShieldAlt
} from "react-icons/fa"
import Link from "next/link"
import FiltrosConsentimientos from "./components/FiltrosConsentimientos"

export default async function MisConsentimientosPage() {
  const session = await getServerSession(authOptions)

  if (!session?.user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
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

  // Calcular estadísticas simples
  const totalConsentimientos = consentimientos.length
  const hoy = new Date()
  hoy.setHours(0, 0, 0, 0)
  const consentimientosHoy = consentimientos.filter(c => {
    const fechaConsentimiento = new Date(c.fechaHora)
    fechaConsentimiento.setHours(0, 0, 0, 0)
    return fechaConsentimiento.getTime() === hoy.getTime()
  }).length

  return (
    <div className="min-h-screen bg-gradient-to-b from-red-50 to-white">
      {/* Header de la página */}
      <div className="bg-gradient-to-r from-red-700 to-red-700 text-white py-8">
        <div className="container mx-auto px-4">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <div>
              <h1 className="text-3xl md:text-4xl font-bold mb-2">
                <FaClipboardCheck className="inline-block mr-3" />
                Mis Consentimientos
              </h1>
              <p className="text-red-100 text-lg">
                Gestión de documentos consentimientos informados
              </p>
            </div>
            
            <div className="mt-4 md:mt-0">
              <div className="flex items-center space-x-4">
                <div className="text-center">
                  <p className="text-2xl font-bold">{totalConsentimientos}</p>
                  <p className="text-sm text-red-200">Total</p>
                </div>
                <div className="h-12 w-px bg-white/30"></div>
                <div className="text-center">
                  <p className="text-2xl font-bold">{consentimientosHoy}</p>
                  <p className="text-sm text-red-200">Hoy</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Contenido principal */}
      <div className="container mx-auto px-4 py-8">
        {/* Componente de filtros (cliente) */}
        <FiltrosConsentimientos consentimientos={consentimientos} />
        
        {/* Información adicional */}
        <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white p-6 rounded-2xl shadow-lg border-l-4 border-red-500">
            <div className="flex items-center mb-4">
              <div className="p-3 bg-red-100 rounded-lg mr-4">
                <FaFilePdf className="text-2xl text-red-600" />
              </div>
              <div>
                <h3 className="font-bold text-gray-800">Documentos PDF/imagen</h3>
                <p className="text-sm text-gray-600">Formato seguro y estándar</p>
              </div>
            </div>
            <p className="text-gray-700">
              Todos los consentimientos se almacenan en formato PDF o imagen para garantizar su integridad y facilitar su visualización.
            </p>
          </div>

          <div className="bg-white p-6 rounded-2xl shadow-lg border-l-4 border-green-500">
            <div className="flex items-center mb-4">
              <div className="p-3 bg-green-100 rounded-lg mr-4">
                <FaShieldAlt className="text-2xl text-green-600" />
              </div>
              <div>
                <h3 className="font-bold text-gray-800">Seguridad Garantizada</h3>
                <p className="text-sm text-gray-600">Protección de datos</p>
              </div>
            </div>
            <p className="text-gray-700">
              Los documentos están protegidos y solo son accesibles por personal autorizado.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}