import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import AdminNovedades from "./AdminNovedades";

export default async function TodasLasNovedadesPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");

  const { rol } = session.user as any;
  if (!(rol === "ADMINISTRATIVO" || rol === "TECNICO")) redirect("/");

  const novedades = await prisma.novedad.findMany({
    include: {
      usuario: {
        select: {
          username: true,
          nombres: true,
          primerApellido: true,
          segundoApellido: true,
          rol: true,
          email: true,
          telefono: true,
          cedula: true,
          profesion: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return <AdminNovedades initialNovedades={novedades as any} />;
}
