import { getServerSession } from "next-auth"
import { authOptions } from "@/app/api/auth/[...nextauth]/route"
import { prisma } from "@/lib/prisma"
import { redirect } from "next/navigation"
import CrearUsuarioForm from "./CrearUsuarioForm"
import ToggleUsuarioButton from "./ToggleUsuarioButton"

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

    return (
        <div className="p-6 space-y-6">
            <h1 className="text-xl font-bold">
                Gestión de usuarios
            </h1>

            <CrearUsuarioForm />

            <table className="w-full border text-sm">
                <thead>
                    <tr className="bg-gray-100">
                        <th className="border p-2">Usuario</th>
                        <th className="border p-2">Nombre</th>
                        <th className="border p-2">Rol</th>
                        <th className="border p-2">Estado</th>
                        <th className="border p-2">Acción</th>
                    </tr>
                </thead>
                <tbody>
                    {usuarios.map(u => (
                        <tr key={u.id}>
                            <td className="border p-2">{u.username}</td>
                            <td className="border p-2">{u.nombre}</td>
                            <td className="border p-2">{u.rol}</td>
                            <td className="border p-2">
                                {u.activo ? "Activo" : "Inactivo"}
                            </td>
                            <td className="border p-2">
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
    )
}