import { prisma, disconnectPrisma } from '../lib/prisma.js';
import { hashPassword } from '../modules/auth/auth.service.js';
import { env } from '../config/env.js';

const INSTITUTION = {
  name: 'Instituição Demonstrativa — Franca/SP',
  city: 'Franca',
  state: 'SP',
  type: 'entidade social',
  email: 'contato@pi6.local',
};

const LEGACY_INSTITUTION_NAMES = ['Instituição Demonstrativa PI 6'];

const USERS = [
  { name: 'Administrador', email: 'admin@pi6.local', password: 'Admin@123456', role: 'ADMIN', linkInstitution: false },
  { name: 'Analista', email: 'analista@pi6.local', password: 'Analista@123456', role: 'ANALYST', linkInstitution: true },
  { name: 'Consulta', email: 'consulta@pi6.local', password: 'Consulta@123456', role: 'VIEWER', linkInstitution: true },
];

async function upsertInstitution() {
  const existing = await prisma.institution.findUnique({ where: { name: INSTITUTION.name } });
  if (existing) {
    console.log(`[seed] instituição já existe: ${existing.name} (${existing.id})`);
    return existing;
  }

  for (const legacyName of LEGACY_INSTITUTION_NAMES) {
    const legacy = await prisma.institution.findUnique({ where: { name: legacyName } });
    if (legacy) {
      const renamed = await prisma.institution.update({ where: { id: legacy.id }, data: INSTITUTION });
      console.log(`[seed] instituição renomeada: "${legacyName}" → "${renamed.name}" (${renamed.id})`);
      return renamed;
    }
  }

  const created = await prisma.institution.create({ data: INSTITUTION });
  console.log(`[seed] instituição criada: ${created.name} (${created.id})`);
  return created;
}

async function main() {
  if (env.isProduction) {
    throw new Error(
      'Este seed usa senhas padrão e não deve ser executado em produção. ' +
        'Crie o primeiro ADMIN manualmente com uma senha forte.',
    );
  }

  const institution = await upsertInstitution();

  for (const entry of USERS) {
    const existing = await prisma.user.findUnique({ where: { email: entry.email } });
    if (existing) {
      console.log(`[seed] usuário já existe, senha preservada: ${entry.email} (${existing.role})`);
      continue;
    }

    const user = await prisma.user.create({
      data: {
        name: entry.name,
        email: entry.email,
        passwordHash: await hashPassword(entry.password),
        role: entry.role,
        institutionId: entry.linkInstitution ? institution.id : null,
      },
      select: { id: true, email: true, role: true },
    });
    console.log(`[seed] usuário criado: ${user.email} / ${entry.password} (${user.role})`);
  }

  console.log('\n[seed] concluído. Faça login em POST /api/auth/login com um dos usuários acima.');
  console.log('[seed] próximo passo (opcional): npm run seed:students -- --count=80');
}

try {
  await main();
} catch (error) {
  console.error(`[seed] falhou: ${error.message}`);
  process.exitCode = 1;
} finally {
  await disconnectPrisma();
}
