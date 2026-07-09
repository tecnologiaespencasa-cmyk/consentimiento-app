import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import { redirect } from "next/navigation";
import Link from "next/link";
import { FaExclamationTriangle, FaPlusCircle, FaListAlt, FaTasks } from "react-icons/fa";

export default async function NovedadesHome() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");

  const { rol } = session.user as any;
  const puedeVerTodas = rol === "ADMINISTRATIVO" || rol === "TECNICO";

  return (
    <div className="min-h-screen bg-gradient-to-b from-red-50 to-white">
      <div className="bg-gradient-to-r from-red-700 to-red-800 text-white py-8">
        <div className="container mx-auto px-4">
          <h1 className="text-3xl md:text-4xl font-bold mb-2">
            <FaExclamationTriangle className="inline-block mr-3" />
            Novedades
          </h1>
          <p className="text-red-100 text-lg">
            Registra y gestiona novedades del personal (paciente / ruta / proceso farmaceutico / terapias ambulatorias).
          </p>
        </div>
      </div>

      <div className="container mx-auto px-4 py-10">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Link
            href="/novedades/registrar"
            className="group bg-white rounded-2xl shadow-lg border border-gray-100 p-6 hover:shadow-xl transition-all"
          >
            <div className="flex items-center gap-3">
              <div className="p-3 bg-red-100 rounded-2xl">
                <FaPlusCircle className="text-2xl text-red-600" />
              </div>
              <div>
                <h2 className="text-lg font-extrabold text-gray-900">Registrar una novedad</h2>
              </div>
            </div>
            <p className="mt-4 text-sm text-gray-600">
              Registra una novedad y notifica automáticamente al área administrativa para gestión y apoyo.
            </p>
          </Link>

          <Link
            href="/novedades/mis"
            className="group bg-white rounded-2xl shadow-lg border border-gray-100 p-6 hover:shadow-xl transition-all"
          >
            <div className="flex items-center gap-3">
              <div className="p-3 bg-blue-100 rounded-2xl">
                <FaListAlt className="text-2xl text-blue-600" />
              </div>
              <div>
                <h2 className="text-lg font-extrabold text-gray-900">Mis novedades</h2>
              </div>
            </div>
            <p className="mt-4 text-sm text-gray-600">
              Historial personal con estado, prioridad y fecha de cada novedad.
            </p>
          </Link>

          {puedeVerTodas ? (
            <Link
              href="/novedades/todas"
              className="group bg-white rounded-2xl shadow-lg border border-gray-100 p-6 hover:shadow-xl transition-all"
            >
              <div className="flex items-center gap-3">
                <div className="p-3 bg-green-100 rounded-2xl">
                  <FaTasks className="text-2xl text-green-600" />
                </div>
                <div>
                  <h2 className="text-lg font-extrabold text-gray-900">Ver todas las novedades</h2>
                </div>
              </div>
              <p className="mt-4 text-sm text-gray-600">
                Panel completo de administración, filtros avanzados y actualización de estado.
              </p>
            </Link>
          ) : (
            <p ></p>
          )}
        </div>
      </div>
    </div>
  );
}
