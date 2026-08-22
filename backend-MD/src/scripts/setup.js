import { spawnSync } from 'node:child_process';
import { copyFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(here, '..', '..');
const ML_DIR = path.join(ROOT, 'ML');
const ENV_FILE = path.join(ROOT, '.env');
const ENV_EXAMPLE = path.join(ROOT, '.env.example');

const VENV_PYTHON = path.join(
  ML_DIR,
  '.venv',
  process.platform === 'win32' ? 'Scripts/python.exe' : 'bin/python',
);
const MODEL_FILE = path.join(ML_DIR, 'artifacts', 'model.pkl');
const SCALER_FILE = path.join(ML_DIR, 'artifacts', 'scaler.pkl');
const CLUSTER_FILE = path.join(ML_DIR, 'artifacts', 'cluster_model.pkl');
const METADATA_FILE = path.join(ML_DIR, 'artifacts', 'model_metadata.json');

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

const PYTHON_CANDIDATES =
  process.platform === 'win32'
    ? [
        { cmd: 'py', args: ['-3.10'] },
        { cmd: 'py', args: ['-3.9'] },
        { cmd: 'python', args: [] },
      ]
    : [
        { cmd: 'python3.10', args: [] },
        { cmd: 'python3.9', args: [] },
        { cmd: 'python3', args: [] },
        { cmd: 'python', args: [] },
      ];

function resolvePythonLauncher() {
  for (const candidate of PYTHON_CANDIDATES) {
    const commandLine = [candidate.cmd, ...candidate.args, '--version'].map(shellQuote).join(' ');
    const probe = spawnSync(commandLine, { stdio: 'ignore', shell: true });
    if (probe.status === 0) return candidate;
  }
  return null;
}

if (!existsSync(ENV_FILE)) {
  if (existsSync(ENV_EXAMPLE)) {
    copyFileSync(ENV_EXAMPLE, ENV_FILE);
    warn(
      '.env criado a partir de .env.example — preencha DB_URL e MD_API_KEY antes ' +
        'de "npm start" (MD_API_KEY precisa ser IDÊNTICO ao do backend-Project).',
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

if (existsSync(VENV_PYTHON)) {
  log('ambiente Python (ML/.venv) já existe.');
} else {
  const launcher = resolvePythonLauncher();
  if (!launcher) {
    warn(
      'nenhum interpretador Python encontrado (tentado: ' +
        PYTHON_CANDIDATES.map((c) => c.cmd).join(', ') +
        '). Instale Python 3.9+ e rode "npm install" novamente — ou crie o ambiente ' +
        'manualmente com ML/environment.yml (conda) ou ML/requirements.txt (venv).',
    );
  } else {
    log(`criando ambiente Python em ML/.venv (${launcher.cmd} ${launcher.args.join(' ')})...`);
    const created = run(launcher.cmd, [...launcher.args, '-m', 'venv', path.join(ML_DIR, '.venv')]);

    if (created && existsSync(VENV_PYTHON)) {
      log('instalando dependências de ML (scikit-learn, pandas, numpy, joblib)...');
      const installed = run(
        VENV_PYTHON,
        ['-m', 'pip', 'install', '--disable-pip-version-check', '-r', path.join(ML_DIR, 'requirements.txt')],
        { shell: false },
      );
      if (!installed) {
        warn(
          'falha ao instalar as dependências Python. Rode manualmente: ' +
            `"${VENV_PYTHON}" -m pip install -r ML/requirements.txt`,
        );
      }
    } else {
      warn('falha ao criar o ambiente virtual Python em ML/.venv.');
    }
  }
}

if (existsSync(VENV_PYTHON)) {
  const modelReady = existsSync(MODEL_FILE) && existsSync(SCALER_FILE);

  if (modelReady) {
    log('modelo já treinado (ML/artifacts/model.pkl) — pulando treino.');
  } else {
    log('preparando dados e treinando o modelo (pode levar alguns segundos)...');
    const prepared = run(VENV_PYTHON, ['-u', path.join(ML_DIR, 'prepare_data.py')], {
      cwd: ML_DIR,
      shell: false,
    });
    const trained =
      prepared &&
      run(VENV_PYTHON, ['-u', path.join(ML_DIR, 'train_model.py')], { cwd: ML_DIR, shell: false });

    if (!trained) {
      warn('não foi possível treinar o modelo automaticamente. Rode "npm run ml:pipeline" manualmente.');
    }
  }

  const clusterReady = existsSync(CLUSTER_FILE);
  if (clusterReady) {
    log('agrupamento já treinado (ML/artifacts/cluster_model.pkl) — pulando.');
  } else if (existsSync(SCALER_FILE)) {
    log('treinando o agrupamento (análise complementar)...');
    const clustered = run(VENV_PYTHON, ['-u', path.join(ML_DIR, 'train_clusters.py')], {
      cwd: ML_DIR,
      shell: false,
    });
    if (!clustered) {
      warn('não foi possível treinar o agrupamento automaticamente. Rode "npm run ml:cluster" manualmente.');
    }
  }

  if (dbReady && existsSync(METADATA_FILE)) {
    log('registrando metadados do modelo no MongoDB...');
    run('node', [path.join(ROOT, 'src', 'scripts', 'registerModel.js')], { shell: false });
  }
} else {
  warn('ambiente Python indisponível — o pipeline de ML não pôde ser executado automaticamente.');
}

log('setup concluído. Use "npm start" (ou "npm run dev") para subir o serviço.');
