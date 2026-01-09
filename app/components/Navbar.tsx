import Link from "next/link"
import { getServerSession } from "next-auth"
import { authOptions } from "@/app/api/auth/[...nextauth]/route"

export default async function Navbar() {
    const session = await getServerSession(authOptions)

    if (!session?.user) return null

    const { rol } = session.user

    return (
        <nav className="flex gap-4 bg-gray-100 p-4 text-sm">
            <Link href="/">Inicio</Link>

            <Link href="/mis-consentimientos">
                Mis consentimientos
            </Link>

            {(rol === "ADMINISTRATIVO" || rol === "TECNICO") && (
                <Link href="/consentimientos">
                    Ver todos
                </Link>
            )}

            {/* 🔐 SOLO ADMINISTRATIVO */}
            {rol === "ADMINISTRATIVO" && (
                <Link
                    href="/usuarios"
                    className="font-semibold text-blue-700"
                >
                    Usuarios
                </Link>
            )}

            <Link href="/api/auth/signout">
                Cerrar sesión
            </Link>
        </nav>
    )
}