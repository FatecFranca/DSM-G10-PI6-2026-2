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

export const env = {
  NODE_ENV,
  isProduction: NODE_ENV === 'production',
  isDevelopment: NODE_ENV === 'development',

  PORT: toInt(process.env.PORT, 3004),
  API_VERSION: process.env.API_VERSION ?? '0.0.1',

  DB_URL: process.env.DB_URL ?? '',

  JWT_SECRET: process.env.JWT_SECRET ?? '',
  JWT_EXPIRES_IN: process.env.AUTH_EXPIRES ?? '1d',

  BCRYPT_ROUNDS: toInt(process.env.BCRYPT_ROUNDS, 10),

  MD_API_BASE_URL: process.env.MD_API_BASE_URL ?? 'http://localhost:3003/api/',
  MD_API_KEY: process.env.MD_API_KEY ?? '',
  MD_TIMEOUT_MS: toInt(process.env.MD_TIMEOUT_MS, 40000),

  CORS_ORIGINS: (process.env.CORS_ORIGINS ?? 'http://localhost:5173')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),

  SMTP_HOST: process.env.SMTP_HOST ?? '',
  SMTP_PORT: toInt(process.env.SMTP_PORT, 587),
  SMTP_USER: process.env.SMTP_USER ?? '',
  SMTP_PASSWORD: process.env.SMTP_PASSWORD ?? '',

  FRONTEND_URL: (process.env.FRONTEND_URL ?? 'http://localhost:5173').replace(/\/+$/, ''),
};

export function assertEnv() {
  const missing = [];

  if (!env.DB_URL) missing.push('DB_URL');
  if (!env.JWT_SECRET) missing.push('JWT_SECRET');
  if (!env.MD_API_KEY) missing.push('MD_API_KEY');

  if (missing.length === 0) return;

  const message =
    `Variáveis de ambiente obrigatórias ausentes: ${missing.join(', ')}. ` +
    'Copie .env.example para .env e preencha os valores.';

  if (env.isProduction) throw new Error(message);
  console.warn(`[env] AVISO: ${message}`);
}

export default env;
