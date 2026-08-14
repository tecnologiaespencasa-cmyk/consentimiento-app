import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/authOptions";
import { tieneAccesoClinicaHeridas } from "@/lib/roles";
import ClinicaHeridasWorkspace from "./ClinicaHeridasWorkspace";

/**
 * Modulo Clinica de Heridas.
 *
 * Segunda barrera de rol (la primera es el middleware, la tercera cada API
 * route). Aqui no se consulta nada del Bridge: la busqueda siempre sale del
 * endpoint POST, para que el documento nunca llegue como parametro de la URL.
 */
export default async function ClinicaHeridasPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");
  if (!tieneAccesoClinicaHeridas(session.user.rol)) redirect("/");

  return <ClinicaHeridasWorkspace />;
}
