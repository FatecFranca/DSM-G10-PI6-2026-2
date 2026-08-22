import 'dotenv/config';
import { spawnSync } from 'node:child_process';
import { copyFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(here, '..', '..');
const ENV_FILE = path.join(ROOT, '.env');
const ENV_EXAMPLE = path.join(ROOT, '.env.example');

const log = (message) => console.log(`[setup] ${message}`);
const warn = (message) => console.warn(`[setup] AVISO: ${message}`);

const shellQuote = (value) => (/\s/.test(value) ? `"${value}"` : value);

function run(command, args, options = {}) {
  const { shell: shellOption, ...rest } = options;
  const useShell = shellOption ?? process.platform === 'win32';

  const result = useShell
    ? spawnSync([command, ...args].map(shellQuote).join(' '), { stdio: 'inherit', shell: true, cwd: ROOT, ...rest })
    : spawnSync(command, args, { stdio: 'inherit', shell: false, cwd: ROOT, ...rest });

  return result.status === 0;
}

if (!existsSync(ENV_FILE)) {
  if (existsSync(ENV_EXAMPLE)) {
    copyFileSync(ENV_EXAMPLE, ENV_FILE);
    warn(
      '.env criado a partir de .env.example — preencha DB_URL, JWT_SECRET e ' +
        'MD_API_KEY antes de "npm start" (MD_API_KEY precisa ser IDÊNTICO ao do backend-MD).',
    );
  } else {
    warn('.env ausente e .env.example não encontrado — crie o .env manualmente.');
  }
} else {
  log('.env já existe.');
}

log('sincronizando schema com o MongoDB (prisma db push)...');
const dbReady = run('npx', ['prisma', 'db', 'push']);
if (!dbReady) {
  warn(
    'não foi possível sincronizar o schema agora (banco fora do ar ou DB_URL ' +
      'incompleta). Rode "npm run prisma:push" manualmente depois de corrigir o .env.',
  );
}

const isProduction = process.env.NODE_ENV === 'production';

if (!dbReady) {
  warn('pulando criação de dados iniciais — banco indisponível. Rode "npm run seed" manualmente depois.');
} else if (isProduction) {
  log('NODE_ENV=production — pulando criação de dados de demonstração (seed usa senhas padrão).');
} else {
  log('criando instituição e usuários de demonstração (se ainda não existirem)...');
  const seeded = run('node', [path.join(ROOT, 'src', 'scripts', 'seed.js')], { shell: false });
  if (!seeded) {
    warn('não foi possível criar os dados iniciais agora. Rode "npm run seed" manualmente depois.');
  }
}

log('setup concluído. Use "npm start" (ou "npm run dev") para subir o serviço.');
log(
  'Para popular o painel com estudantes de exemplo (requer o backend-MD no ar): ' +
    'npm run seed:students -- --count=90',
);
