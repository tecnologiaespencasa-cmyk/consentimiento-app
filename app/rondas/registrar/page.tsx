import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import RegistrarRondaForm from "./RegistrarRondaForm";

export default async function RegistrarRondaPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");
  if (!['MEDICO_RONDA', 'TECNICO', 'ADMINISTRATIVO'].includes(session.user.rol)) redirect("/");
  const medicamentosCatalogo = await prisma.medicamentoCatalogo.findMany({ select: { nombre: true }, orderBy: { nombre: "asc" } });
  return <RegistrarRondaForm medicamentosCatalogo={medicamentosCatalogo} />;
}
