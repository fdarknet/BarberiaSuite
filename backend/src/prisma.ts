import prismaPkg from "@prisma/client";
const { PrismaClient } = prismaPkg as any;

export const prisma = new PrismaClient();
