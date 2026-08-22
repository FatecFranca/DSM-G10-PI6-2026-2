import fs from 'node:fs/promises';
import path from 'node:path';

import { env, PROJECT_ROOT } from '../config/env.js';
import { prisma, disconnectPrisma } from '../lib/prisma.js';
import { loadFeatureContract } from '../services/featureContract.js';

const FIRST_NAMES = [
  'Ana', 'Bruno', 'Carla', 'Daniel', 'Eduarda', 'Felipe', 'Gabriela', 'Henrique',
  'Isabela', 'João', 'Karina', 'Lucas', 'Mariana', 'Nathan', 'Olívia', 'Pedro',
  'Queila', 'Rafael', 'Sofia', 'Thiago', 'Ursula', 'Vitor', 'Wanda', 'Yuri',
];
const LAST_NAMES = [
  'Almeida', 'Barbosa', 'Cardoso', 'Duarte', 'Estevam', 'Ferreira', 'Gonçalves',
  'Henriques', 'Iglesias', 'Justino', 'Klein', 'Lima', 'Moraes', 'Nogueira',
  'Oliveira', 'Pereira', 'Queiroz', 'Ribeiro', 'Santos', 'Teixeira',
];
const COURSES = [
  'Análise e Desenvolvimento de Sistemas',
  'Administração',
  'Enfermagem',
  'Pedagogia',
  'Engenharia de Produção',
  'Serviço Social',
];

function parseArgs() {
  const args = new Map();
  for (const argument of process.argv.slice(2)) {
    const [key, value] = argument.replace(/^--/, '').split('=');
    args.set(key, value ?? 'true');
  }
  return {
    count: Math.min(Math.max(Number.parseInt(args.get('count') ?? '80', 10) || 80, 1), 2000),
    datasetPath:
      args.get('path') ??
      process.env.SEED_DATASET_PATH ??
      path.join(PROJECT_ROOT, '..', 'backend-MD', 'ML', 'predic-students-dataset.csv'),
  };
}

function splitCsvLine(line, separator) {
  const fields = [];
  let current = '';
  let inQuotes = false;

  for (const char of line) {
    if (char === '"') {
      inQuotes = !inQuotes;
      continue;
    }
    if (char === separator && !inQuotes) {
      fields.push(current);
      current = '';
      continue;
    }
    current += char;
  }
  fields.push(current);
  return fields.map((field) => field.trim());
}

function sampleRows(rows, count) {
  if (rows.length <= count) return rows;
  const step = rows.length / count;
  return Array.from({ length: count }, (_, index) => rows[Math.floor(index * step)]);
}

async function main() {
  const { count, datasetPath } = parseArgs();

  const contract = await loadFeatureContract();
  console.log(
    `[seed:students] contrato obtido do serviço de IA: ${contract.featureCount} atributos ` +
      `(modelo ${contract.modelVersion ?? 'não treinado'})`,
  );

  let raw;
  try {
    raw = await fs.readFile(datasetPath, 'utf-8');
  } catch {
    throw new Error(
      `dataset não encontrado em "${datasetPath}". ` +
        'Informe o caminho com --path=... ou defina SEED_DATASET_PATH.',
    );
  }

  const lines = raw
    .replace(/^﻿/, '')
    .split(/\r?\n/)
    .filter((line) => line.trim().length > 0);

  const separator = lines[0].includes(';') ? ';' : ',';
  const header = splitCsvLine(lines[0], separator);

  const expectedColumns = contract.featureCount + 1;
  if (header.length !== expectedColumns) {
    throw new Error(
      `o dataset tem ${header.length} colunas, mas o contrato do modelo espera ` +
        `${contract.featureCount} atributos + 1 coluna de desfecho (${expectedColumns}). ` +
        'O mapeamento posicional não é seguro — verifique se o dataset é o mesmo usado no treino.',
    );
  }

  const institution = await prisma.institution.findFirst({
    where: { active: true },
    orderBy: { createdAt: 'asc' },
    select: { id: true, name: true },
  });
  if (!institution) {
    throw new Error('nenhuma instituição encontrada. Rode "npm run seed" primeiro.');
  }

  const admin = await prisma.user.findFirst({
    where: { role: 'ADMIN' },
    select: { id: true },
  });

  const rows = sampleRows(lines.slice(1), count);
  const existingCodes = new Set(
    (
      await prisma.student.findMany({
        where: { institutionId: institution.id },
        select: { code: true },
      })
    ).map((student) => student.code),
  );

  let created = 0;
  let skipped = 0;

  for (const [index, line] of rows.entries()) {
    const values = splitCsvLine(line, separator);
    if (values.length !== expectedColumns) {
      skipped += 1;
      continue;
    }

    const features = {};
    let valid = true;
    contract.featureOrder.forEach((name, position) => {
      const value = Number(values[position]);
      if (!Number.isFinite(value)) valid = false;
      features[name] = value;
    });
    if (!valid) {
      skipped += 1;
      continue;
    }

    const code = `DEMO-${String(index + 1).padStart(4, '0')}`;
    if (existingCodes.has(code)) {
      skipped += 1;
      continue;
    }

    const name = `${FIRST_NAMES[index % FIRST_NAMES.length]} ${
      LAST_NAMES[(index * 7) % LAST_NAMES.length]
    }`;

    await prisma.student.create({
      data: {
        institutionId: institution.id,
        code,
        name,
        email: `${code.toLowerCase()}@pi6.local`,
        course: COURSES[index % COURSES.length],
        enrollmentYear: 2022 + (index % 4),
        features,
        createdById: admin?.id ?? null,
      },
    });
    created += 1;
  }

  console.log(`[seed:students] instituição: ${institution.name}`);
  console.log(`[seed:students] criados: ${created} | ignorados: ${skipped}`);
  console.log(
    '\n[seed:students] próximo passo: analise o lote via POST /api/analyses/batch ' +
      'para popular o painel com classificações.',
  );
}

try {
  await main();
} catch (error) {
  console.error(`[seed:students] falhou: ${error.message}`);
  if (error.code === 'ML_SERVICE_UNREACHABLE' || error.code === 'ML_SERVICE_NOT_CONFIGURED') {
    console.error(
      `[seed:students] o contrato de atributos vem do backend-MD (${env.MD_API_BASE_URL}). ` +
        'Suba aquele serviço antes de importar estudantes.',
    );
  }
  process.exitCode = 1;
} finally {
  await disconnectPrisma();
}
