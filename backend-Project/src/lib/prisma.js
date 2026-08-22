import { PrismaClient } from '@prisma/client';

import { env } from '../config/env.js';

export const prisma = new PrismaClient({
  log: env.isDevelopment ? ['warn', 'error'] : ['error'],
});

export async function checkDatabase() {
  try {
    await prisma.$runCommandRaw({ ping: 1 });
    return { connected: true };
  } catch (error) {
    return { connected: false, error: error.message };
  }
}

export async function disconnectPrisma() {
  await prisma.$disconnect();
}

export default prisma;
