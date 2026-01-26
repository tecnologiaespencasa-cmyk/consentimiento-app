import { getServerSession } from "next-auth"
import { authOptions } from "@/app/api/auth/[...nextauth]/route"
import { prisma } from "@/lib/prisma"
import { redirect } from "next/navigation"
import { FaClipboardCheck, FaUserShield } from "react-icons/fa"
import ConsentimientosFiltros from "./components/ConsentimientosFiltros"

export default async function TodosLosConsentimientosPage() {
  const session = await getServerSession(authOptions)

  if (!session?.user) redirect("/login")

  const { rol } = session.user

  // ❌ Especialista NO puede ver todos
  if (rol === "ESPECIALISTA") redirect("/")

  const consentimientos = await prisma.consentimiento.findMany({
    include: {
      usuario: {
        select: {
          // ✅ NUEVOS CAMPOS
          nombres: true,
          primerApellido: true,
          segundoApellido: true,
          username: true,
          rol: true,
          email: true,
          telefono: true,
        },
      },
    },
    orderBy: {
      createdAt: "desc",
    },
  })

  // Estadísticas
  const totalConsentimientos = consentimientos.length
  const usuariosUnicos = new Set(consentimientos.map((c) => c.usuarioId)).size
  const hoy = new Date()
  hoy.setHours(0, 0, 0, 0)
  const consentimientosHoy =
    consentimientos.filter((c) => {
      const fechaConsentimiento = new Date(c.fechaHora)
      fechaConsentimiento.setHours(0, 0, 0, 0)
      return fechaConsentimiento.getTime() === hoy.getTime()
    }).length || 0

  return (
    <div className="min-h-screen bg-gradient-to-b from-red-50 to-white">
      {/* Header de la página */}
      <div className="bg-gradient-to-r from-red-700 to-red-800 text-white py-8">
        <div className="container mx-auto px-4">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <div>
              <h1 className="text-3xl md:text-4xl font-bold mb-2">
                <FaClipboardCheck className="inline-block mr-3" />
                Todos los Consentimientos
              </h1>
              <p className="text-red-100 text-lg">
                Vista administrativa completa de documentos
              </p>
            </div>

            <div className="mt-4 md:mt-0">
              <div className="flex items-center space-x-6">
                <div className="text-center">
                  <p className="text-2xl font-bold">{totalConsentimientos}</p>
                  <p className="text-sm text-red-200">Total</p>
                </div>
                <div className="h-12 w-px bg-white/30"></div>
                <div className="text-center">
                  <p className="text-2xl font-bold">{usuariosUnicos}</p>
                  <p className="text-sm text-red-200">Usuarios</p>
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
        {/* Componente de filtros */}
        <ConsentimientosFiltros consentimientos={consentimientos as any} rol={rol} />

        {/* Sección de información administrativa */}
        <div className="mt-8 bg-white rounded-2xl shadow-lg p-6">
          <div className="flex items-center mb-6">
            <div className="p-2 bg-red-100 rounded-lg mr-3">
              <FaUserShield className="text-xl text-red-600" />
            </div>
            <h2 className="text-2xl font-bold text-gray-800">
              Información Administrativa
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="p-4 bg-blue-50 rounded-lg">
              <h3 className="font-semibold text-blue-800 mb-2">Acceso por Rol</h3>
              <p className="text-blue-700 text-sm">
                Solo personal administrativo y técnico puede acceder a esta vista completa.
              </p>
            </div>

            <div className="p-4 bg-green-50 rounded-lg">
              <h3 className="font-semibold text-green-800 mb-2">Responsabilidad</h3>
              <p className="text-green-700 text-sm">
                Como {rol.toLowerCase()}, tienes acceso a todos los documentos registrados.
              </p>
            </div>

            <div className="p-4 bg-purple-50 rounded-lg">
              <h3 className="font-semibold text-purple-800 mb-2">Confidencialidad</h3>
              <p className="text-purple-700 text-sm">
                Toda la información aquí mostrada es confidencial y protegida por ley.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}