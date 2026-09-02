import { existsSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import dotenv from 'dotenv';

const here = path.dirname(fileURLToPath(import.meta.url));

export const PROJECT_ROOT = path.resolve(here, '..', '..');

dotenv.config({ path: path.join(PROJECT_ROOT, '.env') });

const toInt = (value, fallback) => {
  const parsed = Number.parseInt(value ?? '', 10);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const NODE_ENV = process.env.NODE_ENV ?? 'development';
const isProduction = NODE_ENV === 'production';

const defaultPythonBin = () => {
  const venvPython = path.join(
    PROJECT_ROOT,
    'ML',
    '.venv',
    process.platform === 'win32' ? 'Scripts/python.exe' : 'bin/python',
  );
  if (existsSync(venvPython)) return venvPython;
  return process.platform === 'win32' ? 'python' : 'python3';
};

export const env = {
  NODE_ENV,
  isProduction,
  isDevelopment: NODE_ENV === 'development',

  PORT: toInt(process.env.PORT, 3003),
  API_VERSION: process.env.API_VERSION ?? '0.0.1',

  DB_URL: process.env.DB_URL ?? '',

  MD_API_KEY: process.env.MD_API_KEY ?? '',

  CORS_ORIGINS: (process.env.CORS_ORIGINS ?? '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),

  PYTHON_BIN: process.env.PYTHON_BIN || defaultPythonBin(),
  ML_DIR: path.join(PROJECT_ROOT, 'ML'),
  ML_TIMEOUT_MS: toInt(process.env.ML_TIMEOUT_MS, 30000),
  ML_MAX_BATCH_SIZE: toInt(process.env.ML_MAX_BATCH_SIZE, 500),
  ML_MAX_CONCURRENCY: toInt(process.env.ML_MAX_CONCURRENCY, Math.max(2, os.cpus().length - 1)),
};

export function assertEnv() {
  const missing = [];

  if (!env.DB_URL) missing.push('DB_URL');
  if (!env.MD_API_KEY) missing.push('MD_API_KEY');

  if (missing.length === 0) return;

  const message =
    `Variáveis de ambiente obrigatórias ausentes: ${missing.join(', ')}. ` +
    'Copie .env.example para .env e preencha os valores.';

  if (env.isProduction) throw new Error(message);
  console.warn(`[env] AVISO: ${message}`);
}

export default env;
