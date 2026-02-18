import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { redirect } from "next/navigation";
import RegistrarNovedadForm from "./RegistrarNovedadForm";

export default async function RegistrarNovedadPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");

  return <RegistrarNovedadForm />;
}
