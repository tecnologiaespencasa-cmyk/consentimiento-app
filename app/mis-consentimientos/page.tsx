import { getServerSession } from "next-auth"
import { authOptions } from "@/app/api/auth/[...nextauth]/route"
import { prisma } from "@/lib/prisma"

export default async function MisConsentimientosPage() {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
        return <div className="p-6">No autorizado</div>
    }

    const consentimientos = await prisma.consentimiento.findMany({
        where: {
            usuarioId: session.user.id
        },
        orderBy: {
            createdAt: "desc"
        }
    })

    return (
        <div className="p-6">
            <h1 className="text-xl font-bold mb-4">
                Mis consentimientos
            </h1>

            {consentimientos.length === 0 ? (
                <p>No tienes consentimientos registrados.</p>
            ) : (
                <table className="w-full border text-sm">
                    <thead>
                        <tr className="bg-gray-100">
                            <th className="border p-2">Cédula</th>
                            <th className="border p-2">Fecha</th>
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