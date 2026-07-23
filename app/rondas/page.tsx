import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import { redirect } from "next/navigation";
import Link from "next/link";
import { FaClipboardList, FaListAlt, FaPlusCircle, FaUsers } from "react-icons/fa";

export default async function RondasHome() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");
  const puedeVerTodas = ["ADMINISTRATIVO", "TECNICO"].includes(session.user.rol);
  const puedeUsarRondas = puedeVerTodas || session.user.rol === "MEDICO_RONDA";
  if (!puedeUsarRondas) redirect("/");
  return <div className="min-h-screen bg-gradient-to-b from-red-50 to-white">
    <div className="bg-gradient-to-r from-red-700 to-red-800 py-8 text-white"><div className="container mx-auto px-4"><h1 className="text-3xl md:text-4xl font-bold"><FaClipboardList className="inline mr-3" />Ronda Intramural</h1><p className="mt-2 text-red-100">Registra y consulta los pacientes atendidos en ronda intramural.</p></div></div>
    <div className="container mx-auto px-4 py-10"><div className="grid grid-cols-1 gap-6 md:grid-cols-3">
      <Opcion href="/rondas/registrar" icon={<FaPlusCircle />} title="Registrar paciente de Ronda intramural" description="Registra los datos clínicos, el diagnóstico y hasta seis medicamentos." />
      <Opcion href="/rondas/mis" icon={<FaListAlt />} title="Ver mis pacientes reportados" description="Consulta únicamente los pacientes que has reportado con tu perfil." />
      {puedeVerTodas && <Opcion href="/rondas/todas" icon={<FaUsers />} title="Ver todos los pacientes reportados" description="Panel administrativo con filtros por médico, fecha, IPS y más." />}
    </div></div>
  </div>;
}
function Opcion({ href, icon, title, description }: { href: string; icon: React.ReactNode; title: string; description: string }) {
  return <Link href={href} className="group rounded-2xl border border-slate-100 bg-white p-6 shadow-lg transition-all hover:-translate-y-0.5 hover:shadow-xl"><div className="flex items-center gap-3"><span className="rounded-2xl bg-red-100 p-3 text-2xl text-red-700">{icon}</span><h2 className="text-lg font-extrabold text-slate-900">{title}</h2></div><p className="mt-4 text-sm leading-6 text-slate-600">{description}</p></Link>;
}
