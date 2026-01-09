import { getServerSession } from "next-auth"
import { authOptions } from "@/app/api/auth/[...nextauth]/route"
import { prisma } from "@/lib/prisma"
import { redirect } from "next/navigation"

export default async function TodosLosConsentimientosPage() {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
        redirect("/login")
    }

    const { rol } = session.user

    // ❌ Especialista NO puede ver todos
    if (rol === "ESPECIALISTA") {
        redirect("/")
    }

    const consentimientos = await prisma.consentimiento.findMany({
        include: {
            usuario: {
                select: {
                    nombre: true,
                    username: true,
                    rol: true
                }
            }
        },
        orderBy: {
            createdAt: "desc"
        }
    })

    return (
        <div className="p-6">
            <h1 className="text-xl font-bold mb-4">
                Todos los consentimientos
            </h1>

            {consentimientos.length === 0 ? (
                <p>No hay consentimientos registrados.</p>
            ) : (
                <table className="w-full border text-sm">
                    <thead>
                        <tr className="bg-gray-100">
                            <th className="border p-2">Cédula</th>
                            <th className="border p-2">Fecha</th>
                            <th className="border p-2">Usuario</th>
                            <th className="border p-2">Rol</th>
                            <th className="border p-2">Archivo</th>
                        </tr>
                    </thead>
                    <tbody>
                        {consentimientos.map(c => (
                            <tr key={c.id}>
                                <td className="border p-2">{c.cedula}</td>
                                <td className="border p-2">
                                    {new Date(c.fechaHora).toLocaleString()}
                                </td>
                                <td className="border p-2">
                                    {c.usuario.nombre}
                                </td>
                                <td className="border p-2">
                                    {c.usuario.rol}
                                </td>
                                <td className="border p-2">
                                    <a
                                        href={c.archivoUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-blue-600 underline"
                                    >
                                        Ver archivo
                                    </a>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            )}
        </div>
    )
}