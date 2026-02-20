import { getServerSession } from "next-auth"
import { redirect } from "next/navigation"
import { FaUserCircle } from "react-icons/fa"
import { authOptions } from "@/lib/authOptions"
import MiUsuarioForm from "./MiUsuarioForm"

export default async function MiUsuarioPage() {
  const session = await getServerSession(authOptions)

  if (!session?.user) {
    redirect("/login")
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-red-50 via-white to-slate-50">
      <div className="mx-auto w-full max-w-6xl px-4 py-6 md:py-10">
        <div className="rounded-3xl border border-red-100 bg-white/90 shadow-xl backdrop-blur">
          <div className="border-b border-red-100 bg-gradient-to-r from-red-700 to-red-800 px-5 py-5 md:px-8">
            <div className="flex items-center gap-3">
              <div className="rounded-xl bg-white/20 p-3 text-white">
                <FaUserCircle className="text-2xl" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-white md:text-3xl">Mi usuario</h1>
                <p className="text-sm text-red-100">
                  Gestiona tu informacion personal y credenciales de acceso.
                </p>
              </div>
            </div>
          </div>

          <MiUsuarioForm />
        </div>
      </div>
    </div>
  )
}
