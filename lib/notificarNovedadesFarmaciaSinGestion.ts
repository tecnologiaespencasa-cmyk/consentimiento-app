import { prisma } from "@/lib/prisma";
import { sendGraphMail } from "@/lib/sendGraphMail";

const DESTINO_ALERTA_FARMACIA = "tecnologiaespencasa@gmail.com";
const UMBRAL_MINUTOS_SIN_GESTION = 15;

function truncarTexto(texto: string, limite: number) {
  const limpio = (texto || "").trim();
  if (limpio.length <= limite) return limpio;
  return `${limpio.slice(0, limite)}...`;
}

function minutosEntre(inicio: Date, fin: Date) {
  return Math.max(0, Math.floor((fin.getTime() - inicio.getTime()) / 60000));
}

type NovedadFarmaciaPendiente = {
  id: string;
  createdAt: Date;
  tipoFarmacia: string | null;
  descripcion: string;
  prestadorNombre: string;
};

export async function notificarNovedadesFarmaciaSinGestion() {
  const ahora = new Date();
  const limite = new Date(ahora.getTime() - UMBRAL_MINUTOS_SIN_GESTION * 60000);

  const candidatas = await prisma.novedad.findMany({
    where: {
      categoria: "PROCESO_FARMACEUTICO",
      estado: { not: "RESUELTA" },
      createdAt: { lte: limite },
      notificacionFarmaciaSinGestionAt: null,
    },
    select: {
      id: true,
      createdAt: true,
      tipoFarmacia: true,
      descripcion: true,
      prestadorNombre: true,
    },
    orderBy: { createdAt: "asc" },
    take: 25,
  });

  if (!candidatas.length) return { evaluadas: 0, notificadas: 0 };

  const reclamadas: Array<NovedadFarmaciaPendiente & { marca: Date }> = [];

  for (const novedad of candidatas) {
    const marca = new Date();
    const claim = await prisma.novedad.updateMany({
      where: {
        id: novedad.id,
        categoria: "PROCESO_FARMACEUTICO",
        estado: { not: "RESUELTA" },
        notificacionFarmaciaSinGestionAt: null,
      },
      data: { notificacionFarmaciaSinGestionAt: marca },
    });

    if (claim.count === 1) {
      reclamadas.push({ ...novedad, marca });
    }
  }

  if (!reclamadas.length) {
    return { evaluadas: candidatas.length, notificadas: 0 };
  }

  const baseUrl = process.env.NEXTAUTH_URL || "";
  const linkAdmin = baseUrl ? `${baseUrl}/novedades/todas` : "/novedades/todas";

  const detalleTexto = reclamadas
    .map((n) => {
      const minutos = minutosEntre(n.createdAt, ahora);
      return [
        `- Radicado: ${n.id}`,
        `  Tipo: ${n.tipoFarmacia ?? "SIN_TIPO"}`,
        `  Prestador: ${n.prestadorNombre}`,
        `  Tiempo sin resolver: ${minutos} minutos`,
        `  Descripcion: ${truncarTexto(n.descripcion, 200) || "Sin descripcion"}`,
      ].join("\n");
    })
    .join("\n\n");

  const subject = "Notificacion! novedades de farmacia sin gestionar";
  const text = [
    "Se detectaron novedades de proceso farmaceutico sin gestionar dentro del tiempo esperado.",
    `Condicion aplicada: mas de ${UMBRAL_MINUTOS_SIN_GESTION} minutos y estado distinto de RESUELTA.`,
    "",
    "Detalle:",
    detalleTexto,
    "",
    `Panel de gestion: ${linkAdmin}`,
  ].join("\n");

  try {
    await sendGraphMail({
      to: DESTINO_ALERTA_FARMACIA,
      subject,
      text,
    });
  } catch (error) {
    for (const n of reclamadas) {
      await prisma.novedad.updateMany({
        where: {
          id: n.id,
          notificacionFarmaciaSinGestionAt: n.marca,
        },
        data: {
          notificacionFarmaciaSinGestionAt: null,
        },
      });
    }
    throw error;
  }

  return { evaluadas: candidatas.length, notificadas: reclamadas.length };
}
