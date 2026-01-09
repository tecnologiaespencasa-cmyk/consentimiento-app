import { prisma } from "../lib/prisma.ts"
import * as bcrypt from "bcrypt"

async function main() {
  const passwordPlano = "123456"

  const passwordHash = await bcrypt.hash(passwordPlano, 10)

  await prisma.user.create({
    data: {
      username: "emma",
      nombre: "administrativo",
      passwordHash,
      rol: "ESPECIALISTA",
      activo: true
    }
  })

  console.log("Usuario creado correctamente")
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())