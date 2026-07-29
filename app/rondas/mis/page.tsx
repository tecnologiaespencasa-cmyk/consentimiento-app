import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { redirect } from "next/navigation";
import Link from "next/link";
import { FaArrowLeft, FaListAlt, FaPlusCircle } from "react-icons/fa";
import RondasTabla from "../components/RondasTabla";
import RondasMisFiltros from "./RondasMisFiltros";

const TAKE = 20;
const valor = (value: string | string[] | undefined) => Array.isArray(value) ? (value[0] ?? "") : (value ?? "");
const fechaValida = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value);

export default async function MisRondas({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");
  if (!["MEDICO_RONDA", "TECNICO", "ADMINISTRATIVO"].includes(session.user.rol)) redirect("/");

  const sp = await searchParams;
  const initial = { desde: valor(sp.desde), hasta: valor(sp.hasta), documento: valor(sp.documento) };
  const requested = Math.max(1, Number(valor(sp.page)) || 1);
  const where: Prisma.RondaIntramuralWhereInput = { usuarioId: session.user.id };

  if (initial.documento) where.pacienteDocumento = { contains: initial.documento, mode: "insensitive" };
  if (fechaValida(initial.desde) || fechaValida(initial.hasta)) {
    where.createdAt = {};
    if (fechaValida(initial.desde)) where.createdAt.gte = new Date(`${initial.desde}T00:00:00-05:00`);
    if (fechaValida(initial.hasta)) where.createdAt.lte = new Date(`${initial.hasta}T23:59:59.999-05:00`);
  }

  const total = await prisma.rondaIntramural.count({ where });
  const pages = Math.max(1, Math.ceil(total / TAKE));
  const page = Math.min(requested, pages);
  const rondas = await prisma.rondaIntramural.findMany({
    where,
    include: { medicamentos: { orderBy: { orden: "asc" } } },
    orderBy: { createdAt: "desc" },
    skip: (page - 1) * TAKE,
    take: TAKE,
  });
  const params = new URLSearchParams();
  Object.entries(initial).forEach(([key, value]) => { if (value) params.set(key, value); });
  const basePath = `/rondas/mis${params.size ? `?${params}` : ""}`;

  return <div className="min-h-screen bg-gradient-to-b from-red-50 to-white"><div className="container mx-auto px-4 py-7">
    <div className="mb-5 flex flex-wrap items-center justify-between gap-3"><div className="flex items-center gap-3"><Link href="/rondas" className="rounded-xl border border-slate-200 bg-white p-3 hover:bg-slate-50"><FaArrowLeft /></Link><div><h1 className="text-2xl font-extrabold text-slate-900"><FaListAlt className="mr-2 inline text-red-700" />Mis pacientes reportados</h1><p className="text-sm text-slate-500">Esta vista solo contiene los reportes creados con tu perfil.</p></div></div><Link href="/rondas/registrar" className="inline-flex items-center gap-2 rounded-xl bg-red-700 px-4 py-3 font-bold text-white hover:bg-red-800"><FaPlusCircle /> Registrar paciente</Link></div>
    <RondasMisFiltros initial={initial} />
    <p className="mb-3 text-sm text-slate-500">{total} paciente{total === 1 ? "" : "s"} encontrado{total === 1 ? "" : "s"}.</p>
    <RondasTabla rondas={rondas} page={page} totalPages={pages} basePath={basePath} mostrarIngreso puedeRegistrarCausaNoIngreso refrescarAutomaticamente />
  </div></div>;
}
