import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const email = process.env.TITAN_ADMIN_EMAIL?.trim().toLowerCase();
if (!email) throw new Error("TITAN_ADMIN_EMAIL is required to promote an existing TITAN account.");
const user = await prisma.user.update({ where: { email }, data: { role: "ADMIN", status: "ACTIVE" }, select: { id: true, email: true, role: true } });
console.log(`TITAN administrator enabled: ${user.email}`);
await prisma.$disconnect();
