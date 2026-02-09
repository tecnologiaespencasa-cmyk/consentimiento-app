import { getServerSession } from "next-auth"
import { authOptions } from "@/app/api/auth/[...nextauth]/route"
import { prisma } from "@/lib/prisma"
import { redirect } from "next/navigation"
import CrearUsuarioForm from "./CrearUsuarioForm"
import ToggleUsuarioButton from "./ToggleUsuarioButton"
import CambiarPasswordButton from "./CambiarPasswordButton"
import UsuariosFiltros from "./components/UsuariosFiltros"
import UsuariosPaginacion from "./components/UsuariosPaginacion"
import {
  FaUsers,
  FaShieldAlt,
  FaUserCheck,
  FaUserSlash,
  FaUserCog,
} from "react-icons/fa"

const PAGE_SIZE = 20

function nombreCompleto(u: {
  nombres: string
  primerApellido: string
  segundoApellido: string | null
}) {
  return `${u.nombres} ${u.primerApellido} ${u.segundoApellido ?? ""}`
    .replace(/\s+/g, " ")
    .trim()
}

function nombreCorto(u: { nombres: string; primerApellido: string }) {
  const primerNombre = (u.nombres ?? "").trim().split(/\s+/)[0] || ""
  return `${primerNombre} ${u.primerApellido ?? ""}`.replace(/\s+/g, " ").trim()
}

function toInt(v: any, fallback: number) {
  const n = Number(v)
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback
}

export default async function UsuariosPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const session = await getServerSession(authOptions)

  if (!session?.user) redirect("/login")
  if (session.user.rol !== "ADMINISTRATIVO") redirect("/")

  const sp = await searchParams

  // filtros
  const q = (Array.isArray(sp.q) ? sp.q[0] : sp.q) ?? ""
  const rol = (Array.isArray(sp.rol) ? sp.rol[0] : sp.rol) ?? ""
  const estado = (Array.isArray(sp.estado) ? sp.estado[0] : sp.estado) ?? "" // "activo" | "inactivo" | ""

  // paginación
  const page = toInt(Array.isArray(sp.page) ? sp.page[0] : sp.page, 1)
  const take = PAGE_SIZE

  const where: any = {}

  if (rol && ["ADMINISTRATIVO", "TECNICO", "ESPECIALISTA"].includes(rol)) {
    where.rol = rol
  }

  if (estado === "activo") where.activo = true
  if (estado === "inactivo") where.activo = false

  if (q.trim()) {
    const query = q.trim()
    where.OR = [
      { username: { contains: query, mode: "insensitive" } },
      { email: { contains: query, mode: "insensitive" } },
      { nombres: { contains: query, mode: "insensitive" } },
      { primerApellido: { contains: query, mode: "insensitive" } },
      { segundoApellido: { contains: query, mode: "insensitive" } },
    ]
  }

  // Conteo para paginación (FILTRADO)
  const totalFiltrados = await prisma.user.count({ where })
  const totalPages = Math.max(1, Math.ceil(totalFiltrados / PAGE_SIZE))
  const safePage = Math.min(page, totalPages)
  const safeSkip = (safePage - 1) * PAGE_SIZE

  // Traer 20 por página
  const usuarios = await prisma.user.findMany({
    where,
    orderBy: { username: "asc" },
    skip: safeSkip,
    take,
    select: {
      id: true,
      username: true,
      rol: true,
      activo: true,
      email: true,
      telefono: true,
      nombres: true,
      primerApellido: true,
      segundoApellido: true,
    },
  })

  // Estadísticas globales (SI O SI se muestran)
  const [totalUsuarios, activos] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { activo: true } }),
  ])

  // Estadísticas por rol (se mantienen)
  const [administradores, tecnicos, especialistas, inactivos] = await Promise.all([
    prisma.user.count({ where: { rol: "ADMINISTRATIVO" } }),
    prisma.user.count({ where: { rol: "TECNICO" } }),
    prisma.user.count({ where: { rol: "ESPECIALISTA" } }),
    prisma.user.count({ where: { activo: false } }),
  ])

  const showingText = `Mostrando ${totalFiltrados} usuario(s) • Página ${safePage}/${totalPages}`

  return (
    <div className="min-h-screen bg-gradient-to-b from-red-50 to-white">
      <div className="p-[10px] mx-auto px-4 pt-6 ">
        <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="p-2 bg-red-100 rounded-2xl shrink-0">
                <FaUsers className="text-xl text-red-600" />
              </div>

              <div className="min-w-0">
                <h1 className="text-lg md:text-xl font-extrabold text-gray-900 truncate">
                  Administación de usuarios
                </h1>
                <p className="text-xs md:text-sm text-gray-600 truncate">
                  Administración del acceso, roles y contraseñas del personal.
                </p>
              </div>
            </div>

            {/* Derecha: Total/Activos (compacto) */}
            <div className="flex items-center gap-2 shrink-0">
              <div className="px-3 py-2 rounded-xl border border-gray-200 bg-gray-50 text-center min-w-[70px]">
                <p className="text-[11px] text-gray-600 font-semibold leading-none">Total</p>
                <p className="text-lg font-extrabold text-gray-900 leading-tight">{totalUsuarios}</p>
              </div>

              <div className="px-3 py-2 rounded-xl border border-green-200 bg-green-50 text-center min-w-[70px]">
                <p className="text-[11px] text-green-700 font-semibold leading-none">Activos</p>
                <p className="text-lg font-extrabold text-green-800 leading-tight">{activos}</p>
              </div>
            </div>
          </div>

          {/* Segunda línea: “Mostrando…” (compacta) */}
          <div className="mt-2 text-xs text-gray-600">
            {showingText}
          </div>
        </div>
      </div>

      {/* ✅ Cards por rol (se mantienen igual, con sus logos) */}
      <div className="p-[5px]mx-auto px-4 pt-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white p-5 rounded-2xl shadow-lg border-l-4 border-red-500">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-2xl font-bold text-gray-900">{administradores}</p>
                <p className="text-sm text-gray-600 mt-1">Administradores</p>
              </div>
              <div className="p-3 bg-red-100 rounded-full">
                <FaShieldAlt className="text-xl text-red-600" />
              </div>
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl shadow-lg border-l-4 border-blue-500">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-2xl font-bold text-gray-900">{tecnicos}</p>
                <p className="text-sm text-gray-600 mt-1">Técnicos</p>
              </div>
              <div className="p-3 bg-blue-100 rounded-full">
                <FaUserCog className="text-xl text-blue-600" />
              </div>
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl shadow-lg border-l-4 border-green-500">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-2xl font-bold text-gray-900">{especialistas}</p>
                <p className="text-sm text-gray-600 mt-1">Especialistas</p>
              </div>
              <div className="p-3 bg-green-100 rounded-full">
                <FaUserCheck className="text-xl text-green-600" />
              </div>
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl shadow-lg border-l-4 border-yellow-500">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-2xl font-bold text-gray-900">{inactivos}</p>
                <p className="text-sm text-gray-600 mt-1">Inactivos</p>
              </div>
              <div className="p-3 bg-yellow-100 rounded-full">
                <FaUserSlash className="text-xl text-yellow-600" />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Contenido */}
      <div className="p-[5px] mx-auto px-4 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Form crear */}
          <div className="lg:col-span-1">
            <CrearUsuarioForm />
          </div>

          {/* Lista */}
          <div className="lg:col-span-2">
            <UsuariosFiltros initialQ={q} initialRol={rol} initialEstado={estado} />

            <div className="bg-white rounded-2xl shadow-lg overflow-hidden mt-4">
              <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-bold text-gray-800">Lista de Usuarios</h2>
                  <span className="text-sm text-gray-600">
                    Página {safePage} de {totalPages} • {totalFiltrados} resultados
                  </span>
                </div>
              </div>

              {usuarios.length === 0 ? (
                <div className="text-center py-12">
                  <h3 className="text-lg font-semibold text-gray-800 mb-2">
                    No hay usuarios para esos filtros
                  </h3>
                  <p className="text-gray-600">Prueba cambiando el filtro o limpiándolo.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-200">
                        <th className="text-left py-4 px-6 text-sm font-semibold text-gray-700">Usuario</th>
                        <th className="text-left py-4 px-6 text-sm font-semibold text-gray-700">Nombre</th>
                        <th className="text-left py-4 px-6 text-sm font-semibold text-gray-700">Rol</th>
                        <th className="text-left py-4 px-6 text-sm font-semibold text-gray-700">Estado</th>
                        <th className="text-left py-4 px-6 text-sm font-semibold text-gray-700">Acciones</th>
                      </tr>
                    </thead>

                    <tbody className="divide-y divide-gray-200">
                      {usuarios.map((u) => (
                        <tr
                          key={u.id}
                          className={`hover:bg-red-50 transition-colors ${
                            u.id === session.user.id ? "bg-blue-50" : ""
                          }`}
                        >
                          <td className="py-4 px-6">
                            <div className="flex items-center">
                              <div
                                className={`w-8 h-8 rounded-full flex items-center justify-center mr-3 ${
                                  u.rol === "ADMINISTRATIVO"
                                    ? "bg-red-100 text-red-600"
                                    : u.rol === "TECNICO"
                                    ? "bg-blue-100 text-blue-600"
                                    : "bg-green-100 text-green-600"
                                }`}
                              >
                                <FaUserCog className="text-sm" />
                              </div>
                              <span className="font-medium text-gray-800">{u.username}</span>
                            </div>
                          </td>

                          <td className="py-4 px-6">
                            <span className="text-gray-700">{nombreCompleto(u)}</span>
                          </td>

                          <td className="py-4 px-6">
                            <span
                              className={`px-3 py-1 rounded-full text-xs font-semibold ${
                                u.rol === "ADMINISTRATIVO"
                                  ? "bg-red-100 text-red-800"
                                  : u.rol === "TECNICO"
                                  ? "bg-blue-100 text-blue-800"
                                  : "bg-green-100 text-green-800"
                              }`}
                            >
                              {u.rol}
                            </span>
                          </td>

                          <td className="py-4 px-6">
                            <div className="flex items-center">
                              <div className={`w-3 h-3 rounded-full mr-2 ${u.activo ? "bg-green-500" : "bg-red-500"}`} />
                              <span className={`font-medium ${u.activo ? "text-green-700" : "text-red-700"}`}>
                                {u.activo ? "Activo" : "Inactivo"}
                              </span>
                            </div>
                          </td>

                          <td className="py-4 px-6">
                            <div className="flex flex-wrap gap-2">
                              <CambiarPasswordButton
                                id={u.id}
                                username={u.username}
                                isSelf={u.id === session.user.id}
                              />
                              <ToggleUsuarioButton
                                id={u.id}
                                activo={u.activo}
                                isSelf={u.id === session.user.id}
                              />
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              <div className="px-6 py-4 border-t border-gray-200 bg-gray-50">
                <div className="flex flex-col md:flex-row justify-between items-center gap-3">
                  <div className="text-sm text-gray-600">
                    <span className="font-semibold">Tu sesión:</span>{" "}
                    {nombreCorto(session.user as any)} ({session.user.rol})
                  </div>

                  <UsuariosPaginacion
                    page={safePage}
                    totalPages={totalPages}
                    q={q}
                    rol={rol}
                    estado={estado}
                  />
                </div>

                <div className="mt-2 text-xs text-gray-500 text-right">
                  Máx. {PAGE_SIZE} por página
                </div>
              </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  )
}