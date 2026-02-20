import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import Link from "next/link";
import { FaArrowLeft, FaListAlt, FaClock, FaCheckCircle, FaSpinner } from "react-icons/fa";

function badgeEstado(estado: string) {
  const map: Record<string, { cls: string; icon: any; label: string }> = {
    PENDIENTE: { cls: "bg-yellow-50 text-yellow-800 border-yellow-200", icon: FaClock, label: "Pendiente" },
    EN_PROCESO: { cls: "bg-blue-50 text-blue-800 border-blue-200", icon: FaSpinner, label: "En proceso" },
    RESUELTA: { cls: "bg-green-50 text-green-800 border-green-200", icon: FaCheckCircle, label: "Resuelta" },
  };
  return map[estado] ?? { cls: "bg-gray-50 text-gray-700 border-gray-200", icon: FaClock, label: estado };
}

export default async function MisNovedadesPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");

  const u = session.user as any;

  const novedades = await prisma.novedad.findMany({
    where: { usuarioId: u.id },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="min-h-screen bg-gradient-to-b from-red-50 to-white">
      <div className="container mx-auto px-4 py-6">
        <div className="flex items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-3">
            <Link
              href="/novedades"
              className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-white border border-gray-200 shadow-sm hover:bg-gray-50"
            >
              <FaArrowLeft /> Volver
            </Link>
            <h1 className="text-xl md:text-2xl font-extrabold text-gray-900 flex items-center gap-2">
              <FaListAlt className="text-blue-600" /> Mis novedades
            </h1>
          </div>
          <Link
            href="/novedades/registrar"
            className="inline-flex items-center justify-center px-4 py-2 rounded-xl bg-red-600 text-white font-bold hover:bg-red-700"
          >
            Registrar
          </Link>
        </div>

        <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-4">
          {novedades.length === 0 ? (
            <div className="p-8 text-center text-gray-600">
              Aún no has registrado novedades.
            </div>
          ) : (
            <div className="space-y-3">
              {novedades.map((n) => {
                const b = badgeEstado(n.estado);
                const Icon = b.icon;
                return (
                  <div
                    key={n.id}
                    className="rounded-2xl border border-gray-200 p-4 hover:shadow-sm transition-all"
                  >
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm text-gray-500">{new Date(n.createdAt).toLocaleString()}</p>
                        <p className="font-extrabold text-gray-900 truncate">
                          {n.categoria === "PACIENTE" ? "Paciente" : "Ruta"} • {n.categoria === "PACIENTE" ? (n.tipoPaciente ?? "-") : (n.tipoRuta ?? "-")}
                        </p>
                        <p className="text-sm text-gray-700 mt-1 line-clamp-50">
                          {n.descripcion}
                        </p>
                        {n.fotoIngresoDomicilioUrl ? (
                          <p className="text-xs mt-2">
                            <a
                              href={n.fotoIngresoDomicilioUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="text-blue-700 underline"
                            >
                              Ver foto de evidencia
                            </a>
                          </p>
                        ) : null}
                        <p className="text-xs text-gray-500 mt-2">
                          Zonas: {n.zonas.join(", ")}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className={`inline-flex items-center gap-2 text-xs font-bold px-3 py-2 rounded-full border ${b.cls}`}>
                          <Icon /> {b.label}
                        </span>
                        <span className="inline-flex items-center text-xs font-bold px-3 py-2 rounded-full border bg-gray-50 text-gray-700 border-gray-200">
                          Prioridad: {n.prioridad}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
