-- CreateTable
CREATE TABLE "Consentimiento" (
    "id" TEXT NOT NULL,
    "cedula" TEXT NOT NULL,
    "especialista" TEXT NOT NULL,
    "fechaHora" TIMESTAMP(3) NOT NULL,
    "archivoUrl" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Consentimiento_pkey" PRIMARY KEY ("id")
);
