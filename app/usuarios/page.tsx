import { getServerSession } from "next-auth"
import { authOptions } from "@/app/api/auth/[...nextauth]/route"
import { prisma } from "@/lib/prisma"
import { redirect } from "next/navigation"
import CrearUsuarioForm from "./CrearUsuarioForm"
import ToggleUsuarioButton from "./ToggleUsuarioButton"
import { 
  FaUserPlus, 
  FaUsers, 
  FaShieldAlt, 
  FaUserCheck, 
  FaUserSlash,
  FaUserCog
} from "react-icons/fa"

export default async function UsuariosPage() {
  const session = await getServerSession(authOptions)

  if (!session?.user) {
    redirect("/login")
  }

  if (session.user.rol !== "ADMINISTRATIVO") {
    redirect("/")
  }

  const usuarios = await prisma.user.findMany({
    orderBy: { username: "asc" }
  })

  // Estadísticas
  const totalUsuarios = usuarios.length
  const usuariosActivos = usuarios.filter(u => u.activo).length
  const administradores = usuarios.filter(u => u.rol === "ADMINISTRATIVO").length
  const tecnicos = usuarios.filter(u => u.rol === "TECNICO").length
  const especialistas = usuarios.filter(u => u.rol === "ESPECIALISTA").length

  return (
    <div className="min-h-screen bg-gradient-to-b from-red-50 to-white">
      {/* Header de la página */}
      <div className="bg-gradient-to-r from-red-700 to-red-800 text-white py-8">
        <div className="container mx-auto px-4">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <div>
              <h1 className="text-3xl md:text-4xl font-bold mb-2">
                <FaUsers className="inline-block mr-3" />
                Gestión de Usuarios
              </h1>
              <p className="text-red-100 text-lg">
                Administra el acceso y permisos del personal
              </p>
            </div>
            
            <div className="mt-4 md:mt-0">
              <div className="flex items-center space-x-6">
                <div className="text-center">
                  <p className="text-2xl font-bold">{totalUsuarios}</p>
                  <p className="text-sm text-red-200">Total</p>
                </div>
                <div className="h-12 w-px bg-white/30"></div>
                <div className="text-center">
                  <p className="text-2xl font-bold">{usuariosActivos}</p>
                  <p className="text-sm text-red-200">Activos</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Contenido principal */}
      <div className="container mx-auto px-4 py-8">
        {/* Panel de estadísticas */}
        <div className="mb-8 grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="bg-white p-6 rounded-2xl shadow-lg border-l-4 border-red-500">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-3xl font-bold text-gray-800">{administradores}</p>
                <p className="text-sm text-gray-600 mt-1">Administradores</p>
              </div>
              <div className="p-3 bg-red-100 rounded-full">
                <FaShieldAlt className="text-2xl text-red-600" />
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-2xl shadow-lg border-l-4 border-blue-500">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-3xl font-bold text-gray-800">{tecnicos}</p>
                <p className="text-sm text-gray-600 mt-1">Técnicos</p>
              </div>
              <div className="p-3 bg-blue-100 rounded-full">
                <FaUserCog className="text-2xl text-blue-600" />
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-2xl shadow-lg border-l-4 border-green-500">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-3xl font-bold text-gray-800">{especialistas}</p>
                <p className="text-sm text-gray-600 mt-1">Especialistas</p>
              </div>
              <div className="p-3 bg-green-100 rounded-full">
                <FaUserCheck className="text-2xl text-green-600" />
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-2xl shadow-lg border-l-4 border-yellow-500">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-3xl font-bold text-gray-800">{totalUsuarios - usuariosActivos}</p>
                <p className="text-sm text-gray-600 mt-1">Inactivos</p>
              </div>
              <div className="p-3 bg-yellow-100 rounded-full">
                <FaUserSlash className="text-2xl text-yellow-600" />
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Formulario de creación */}
          <div className="lg:col-span-1">
            <CrearUsuarioForm />
          </div>

          {/* Lista de usuarios */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-bold text-gray-800">
                    Lista de Usuarios
                  </h2>
                  <span className="text-sm text-gray-600">
                    {usuarios.length} usuarios registrados
                  </span>
                </div>
              </div>

              {usuarios.length === 0 ? (
                <div className="text-center py-12">
                  <div className="inline-block p-4 bg-gray-100 rounded-full mb-4">
                    <FaUsers className="text-4xl text-gray-400" />
                  </div>
                  <h3 className="text-lg font-semibold text-gray-800 mb-2">
                    No hay usuarios registrados
                  </h3>
                  <p className="text-gray-600">
                    Comienza creando el primer usuario del sistema.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-200">
                        <th className="text-left py-4 px-6 text-sm font-semibold text-gray-700">
                          Usuario
                        </th>
                        <th className="text-left py-4 px-6 text-sm font-semibold text-gray-700">
                          Nombre
                        </th>
                        <th className="text-left py-4 px-6 text-sm font-semibold text-gray-700">
                          Rol
                        </th>
                        <th className="text-left py-4 px-6 text-sm font-semibold text-gray-700">
                          Estado
                        </th>
                        <th className="text-left py-4 px-6 text-sm font-semibold text-gray-700">
                          Acciones
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {usuarios.map(u => (
                        <tr 
                          key={u.id} 
                          className={`hover:bg-red-50 transition-colors ${
                            u.id === session.user.id ? 'bg-blue-50' : ''
                          }`}
                        >
                          <td className="py-4 px-6">
                            <div className="flex items-center">
                              <div className={`w-8 h-8 rounded-full flex items-center justify-center mr-3 ${
                                u.rol === 'ADMINISTRATIVO' 
                                  ? 'bg-red-100 text-red-600'
                                  : u.rol === 'TECNICO'
                                  ? 'bg-blue-100 text-blue-600'
                                  : 'bg-green-100 text-green-600'
                              }`}>
                                <FaUserCog className="text-sm" />
                              </div>
                              <span className="font-medium text-gray-800">
                                {u.username}
                              </span>
                            </div>
                          </td>
                          <td className="py-4 px-6">
                            <span className="text-gray-700">{u.nombre}</span>
                          </td>
                          <td className="py-4 px-6">
                            <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                              u.rol === 'ADMINISTRATIVO' 
                                ? 'bg-red-100 text-red-800' 
                                : u.rol === 'TECNICO'
                                ? 'bg-blue-100 text-blue-800'
                                : 'bg-green-100 text-green-800'
                            }`}>
                              {u.rol}
                            </span>
                          </td>
                          <td className="py-4 px-6">
                            <div className="flex items-center">
                              <div className={`w-3 h-3 rounded-full mr-2 ${
                                u.activo ? 'bg-green-500' : 'bg-red-500'
                              }`} />
                              <span className={`font-medium ${
                                u.activo ? 'text-green-700' : 'text-red-700'
                              }`}>
                                {u.activo ? "Activo" : "Inactivo"}
                              </span>
                            </div>
                          </td>
                          <td className="py-4 px-6">
                            <ToggleUsuarioButton
                              id={u.id}
                              activo={u.activo}
                              isSelf={u.id === session.user.id}
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Información adicional */}
              <div className="px-6 py-4 border-t border-gray-200 bg-gray-50">
                <div className="flex flex-col md:flex-row justify-between items-center">
                  <div className="text-sm text-gray-600 mb-4 md:mb-0">
                    <span className="font-semibold">Tu sesión:</span> {session.user.nombre} ({session.user.rol})
                  </div>
                  <div className="text-xs text-gray-500">
                    Solo administradores pueden gestionar usuarios
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}