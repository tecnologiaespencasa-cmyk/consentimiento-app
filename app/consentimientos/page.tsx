import { getServerSession } from "next-auth"
import { authOptions } from "@/app/api/auth/[...nextauth]/route"
import { redirect } from "next/navigation"
import Link from "next/link"
import { FaFileSignature, FaPlusCircle, FaListAlt, FaTasks } from "react-icons/fa"

export default async function ConsentimientosHomePage() {
  const session = await getServerSession(authOptions)
  if (!session?.user) redirect("/login")

  const { rol } = session.user as { rol?: string }
  const puedeVerTodos = rol === "ADMINISTRATIVO" || rol === "TECNICO"

  return (
    <div className="min-h-screen bg-gradient-to-b from-red-50 to-white">
      <div className="bg-gradient-to-r from-red-700 to-red-800 text-white py-8">
        <div className="container mx-auto px-4">
          <h1 className="text-3xl md:text-4xl font-bold mb-2">
            <FaFileSignature className="inline-block mr-3" />
            Consentimientos
          </h1>
          <p className="text-red-100 text-lg">Registra, consulta y administra consentimientos informados.</p>
        </div>
      </div>

      <div className="container mx-auto px-4 py-10">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Link
            href="/consentimiento"
            className="group bg-white rounded-2xl shadow-lg border border-gray-100 p-6 hover:shadow-xl transition-all"
          >
            <div className="flex items-center gap-3">
              <div className="p-3 bg-red-100 rounded-2xl">
                <FaPlusCircle className="text-2xl text-red-600" />
              </div>
              <div>
                <h2 className="text-lg font-extrabold text-gray-900">Registrar consentimiento informado</h2>
              </div>
            </div>
            <p className="mt-4 text-sm text-gray-600">
              Diligencia o adjunta un consentimiento informado para un paciente.
            </p>
          </Link>

          <Link
            href="/mis-consentimientos"
            className="group bg-white rounded-2xl shadow-lg border border-gray-100 p-6 hover:shadow-xl transition-all"
          >
            <div className="flex items-center gap-3">
              <div className="p-3 bg-blue-100 rounded-2xl">
                <FaListAlt className="text-2xl text-blue-600" />
              </div>
              <div>
                <h2 className="text-lg font-extrabold text-gray-900">Mis consentimientos</h2>
              </div>
            </div>
            <p className="mt-4 text-sm text-gray-600">
              Consulta tu historial personal de consentimientos y su estado.
            </p>
          </Link>

          {puedeVerTodos ? (
            <Link
              href="/consentimientos/todos"
              className="group bg-white rounded-2xl shadow-lg border border-gray-100 p-6 hover:shadow-xl transition-all"
            >
              <div className="flex items-center gap-3">
                <div className="p-3 bg-green-100 rounded-2xl">
                  <FaTasks className="text-2xl text-green-600" />
                </div>
                <div>
                  <h2 className="text-lg font-extrabold text-gray-900">Ver todos los consentimientos</h2>
                </div>
              </div>
              <p className="mt-4 text-sm text-gray-600">
                Panel completo con filtros para tecnicos y administrativos.
              </p>
            </Link>
          ) : (
            <p></p>
          )}
        </div>
      </div>
    </div>
  )
}
