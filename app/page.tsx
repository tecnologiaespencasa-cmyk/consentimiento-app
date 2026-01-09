import { getServerSession } from "next-auth"
import { authOptions } from "./api/auth/[...nextauth]/route"
import Link from "next/link"

export default async function HomePage() {
  const session = await getServerSession(authOptions)

  return (
    <main className="p-6">
      <h1 className="text-2xl font-bold mb-4">
        Sistema de Consentimientos
      </h1>

      <p className="mb-6">
        Bienvenido, {session?.user.nombre} ({session?.user.rol})
      </p>

      {/* Formulario siempre visible */}
      <Link
        href="/consentimiento"
        className="inline-block bg-blue-600 text-white px-4 py-2 rounded"
      >
        Registrar consentimiento
      </Link>

      {/* SOLO ADMINISTRATIVO */}
      {session?.user.rol === "ADMINISTRATIVO" && (
        <div className="mt-4">
          <Link
            href="/consentimientos"
            className="inline-block bg-green-600 text-white px-4 py-2 rounded"
          >
            Ver todos los consentimientos
          </Link>
        </div>
      )}
    </main>
  )
}