import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
const names = ["Dwiki", "Ingrid", "Kodirin", "Maria", "Merry", "Suharyuni", "Yani"];
const count = await prisma.interviewer.count();
if (count === 0) {
  await prisma.interviewer.createMany({ data: names.map((name) => ({ name })) });
  console.log(`Seed: ${names.length} interviewer awal ditambahkan.`);
} else {
  console.log("Seed: interviewer sudah ada, dilewati.");
}
await prisma.$disconnect();
