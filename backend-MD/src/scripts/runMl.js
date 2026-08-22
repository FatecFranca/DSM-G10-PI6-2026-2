import { spawn } from 'node:child_process';
import path from 'node:path';

import { env } from '../config/env.js';

const [script, ...args] = process.argv.slice(2);

if (!script) {
  console.error('uso: node src/scripts/runMl.js <script.py> [args...]');
  process.exit(1);
}

console.log(`[ml] ${env.PYTHON_BIN} ${script}`);

const child = spawn(env.PYTHON_BIN, ['-u', path.join(env.ML_DIR, script), ...args], {
  cwd: env.ML_DIR,
  stdio: 'inherit',
});

child.on('error', (error) => {
  console.error(
    `[ml] não foi possível executar "${env.PYTHON_BIN}": ${error.message}\n` +
      '     crie o ambiente descrito em ML/environment.yml (conda) ou ML/requirements.txt (venv),\n' +
      '     ou aponte PYTHON_BIN no .env para o interpretador correto.',
  );
  process.exit(1);
});

child.on('close', (code) => process.exit(code ?? 1));
