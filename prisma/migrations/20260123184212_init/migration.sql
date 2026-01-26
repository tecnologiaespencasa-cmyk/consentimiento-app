/*
  Warnings:

  - You are about to drop the column `nombre` on the `User` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[email]` on the table `User` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `nombres` to the `User` table without a default value. This is not possible if the table is not empty.
  - Added the required column `primerApellido` to the `User` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "User" DROP COLUMN "nombre",
ADD COLUMN     "email" TEXT,
ADD COLUMN     "nombres" TEXT NOT NULL,
ADD COLUMN     "primerApellido" TEXT NOT NULL,
ADD COLUMN     "segundoApellido" TEXT,
ADD COLUMN     "telefono" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
