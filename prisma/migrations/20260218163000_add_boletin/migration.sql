-- CreateEnum
CREATE TYPE "BoletinAdjuntoTipo" AS ENUM ('IMAGE', 'PDF');

-- CreateTable
CREATE TABLE "Boletin" (
    "id" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "contenidoHtml" TEXT,
    "adjuntoTipo" "BoletinAdjuntoTipo",
    "adjuntoDriveItemId" TEXT,
    "adjuntoNombre" TEXT,
    "adjuntoMimeType" TEXT,
    "publicado" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "autorId" TEXT NOT NULL,

    CONSTRAINT "Boletin_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "Boletin" ADD CONSTRAINT "Boletin_autorId_fkey" FOREIGN KEY ("autorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
