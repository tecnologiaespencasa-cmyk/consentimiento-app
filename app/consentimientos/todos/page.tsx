import { getServerSession } from "next-auth"
import { authOptions } from "@/app/api/auth/[...nextauth]/route"
import { prisma } from "@/lib/prisma"
import { redirect } from "next/navigation"
import { FaClipboardCheck, FaUserMd, FaShieldAlt, FaHome, FaCheckCircle } from "react-icons/fa"
import ConsentimientosFiltros from "../components/ConsentimientosFiltros"

export default async function TodosLosConsentimientosPage() {
  const session = await getServerSession(authOptions)

  if (!session?.user) redirect("/login")

  const { rol } = session.user

  if (rol === "ESPECIALISTA") redirect("/")

  const consentimientos = await prisma.consentimiento.findMany({
    include: {
      usuario: {
        select: {
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

  const consentimientosMapeados = consentimientos.map((c) => ({
    id: c.id,
    cedula: c.cedula,
    fechaHora: c.fechaHora,
    archivoUrl: c.archivoUrl,
    usuarioId: c.usuarioId,
    usuario: {
      nombre: `${c.usuario.nombres} ${c.usuario.primerApellido} ${c.usuario.segundoApellido || ""}`.trim(),
      username: c.usuario.username,
      rol: c.usuario.rol,
    },
    nombreCompleto: `${c.usuario.nombres} ${c.usuario.primerApellido} ${c.usuario.segundoApellido || ""}`.trim(),
    aceptado: c.aceptado,
  }))

  const totalConsentimientos = consentimientos.length
  const aceptados = consentimientos.filter((c) => c.aceptado === true).length
  const rechazados = consentimientos.filter((c) => c.aceptado === false).length
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
      <div className="bg-gradient-to-r from-red-700 to-red-800 text-white py-8">
        <div className="container mx-auto px-4">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <div>
              <h1 className="text-3xl md:text-4xl font-bold mb-2">
                <FaClipboardCheck className="inline-block mr-3" />
                Todos los Consentimientos
              </h1>
              <p className="text-red-100 text-lg">Vista administrativa completa de documentos</p>
            </div>

            <div className="mt-4 md:mt-0">
              <div className="flex items-center space-x-4">
                <div className="text-center">
                  <p className="text-2xl font-bold">{totalConsentimientos}</p>
                  <p className="text-sm text-red-200">Total</p>
                </div>
                <div className="h-12 w-px bg-white/30"></div>
                <div className="text-center">
                  <p className="text-2xl font-bold">{aceptados}</p>
                  <p className="text-sm text-green-200">Aceptados</p>
                </div>
                <div className="h-12 w-px bg-white/30"></div>
                <div className="text-center">
                  <p className="text-2xl font-bold">{rechazados}</p>
                  <p className="text-sm text-red-200">Rechazados</p>
                </div>
                <div className="h-12 w-px bg-white/30"></div>
                <div className="text-center">
                  <p className="text-2xl font-bold">{consentimientosHoy}</p>
                  <p className="text-sm text-yellow-200">Hoy</p>
                </div>
                <div className="h-12 w-px bg-white/30"></div>
                <div className="text-center">
                  <p className="text-2xl font-bold">{usuariosUnicos}</p>
                  <p className="text-sm text-red-200">Usuarios</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        <ConsentimientosFiltros consentimientos={consentimientosMapeados} rol={rol} />

        <div className="bg-gradient-to-br from-white to-red-50 rounded-3xl shadow-xl p-8 mb-12 border border-red-100">
          <div className="flex items-center mb-8">
            <div className="p-4 bg-gradient-to-br from-red-500 to-red-600 rounded-2xl mr-5 shadow-lg">
              <FaShieldAlt className="text-3xl text-white" />
            </div>
            <div>
              <h2 className="text-3xl font-black text-gray-800">Consentimiento Informado</h2>
              <p className="text-gray-600">Pilar fundamental en la atencion medica domiciliaria</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              {
                icon: <FaUserMd className="text-2xl" />,
                title: "Derecho del Paciente",
                desc: "Informacion clara y completa sobre su tratamiento",
                color: "red",
              },
              {
                icon: <FaShieldAlt className="text-2xl" />,
                title: "Responsabilidad Medica",
                desc: "Proteccion legal para profesional y paciente",
                color: "blue",
              },
              {
                icon: <FaCheckCircle className="text-2xl" />,
                title: "Cumplimiento Legal",
                desc: "Obligatorio segun legislacion colombiana",
                color: "green",
              },
              {
                icon: <FaHome className="text-2xl" />,
                title: "Confianza y Transparencia",
                desc: "Fortalece la relacion medico-paciente",
                color: "purple",
              },
            ].map((item, index) => (
              <div key={index} className="bg-white rounded-xl p-5 shadow-md hover:shadow-lg transition border border-gray-100">
                <div className={`p-3 bg-${item.color}-100 rounded-lg w-fit mb-3`}>
                  <div className={`text-${item.color}-600`}>{item.icon}</div>
                </div>
                <h4 className="font-bold text-gray-800 mb-1">{item.title}</h4>
                <p className="text-sm text-gray-600">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
