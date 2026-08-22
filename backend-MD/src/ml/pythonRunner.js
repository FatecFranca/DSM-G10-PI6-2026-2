import { spawn } from 'node:child_process';
import path from 'node:path';

import { env } from '../config/env.js';
import { AppError } from '../utils/AppError.js';

const PYTHON_ERROR_STATUS = {
  INVALID_INPUT: 400,
  MISSING_FEATURES: 400,
  INVALID_FEATURE_VALUE: 400,
  MODEL_NOT_TRAINED: 503,
  CLUSTERING_NOT_TRAINED: 503,
  INFERENCE_FAILED: 500,
};

export function runPythonScript(script, payload) {
  const scriptPath = path.join(env.ML_DIR, script);

  return new Promise((resolve, reject) => {
    let child;
    try {
      child = spawn(env.PYTHON_BIN, [scriptPath], {
        cwd: env.ML_DIR,
        windowsHide: true,
        env: {
          ...process.env,
          PYTHONIOENCODING: 'utf-8',
          PYTHONDONTWRITEBYTECODE: '1',
        },
      });
    } catch (error) {
      reject(
        AppError.serviceUnavailable(
          `Não foi possível iniciar o interpretador Python (${env.PYTHON_BIN}): ${error.message}`,
          'ML_RUNTIME_UNAVAILABLE',
        ),
      );
      return;
    }

    let stdout = '';
    let stderr = '';
    let settled = false;

    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      child.kill('SIGKILL');
      reject(
        AppError.gatewayTimeout(
          `A execução de ${script} excedeu ${env.ML_TIMEOUT_MS}ms.`,
          'ML_TIMEOUT',
        ),
      );
    }, env.ML_TIMEOUT_MS);

    child.stdout.setEncoding('utf-8');
    child.stderr.setEncoding('utf-8');
    child.stdout.on('data', (chunk) => {
      stdout += chunk;
    });
    child.stderr.on('data', (chunk) => {
      stderr += chunk;
    });

    child.on('error', (error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      reject(
        AppError.serviceUnavailable(
          `Falha ao executar ${script} com "${env.PYTHON_BIN}": ${error.message}`,
          'ML_RUNTIME_UNAVAILABLE',
        ),
      );
    });

    child.on('close', (exitCode) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);

      if (stderr.trim()) {
        console.warn(`[ml:${script}] stderr: ${stderr.trim().slice(0, 2000)}`);
      }

      let parsed;
      try {
        parsed = JSON.parse(stdout);
      } catch {
        reject(
          AppError.internal(
            `Resposta inválida de ${script}: o script não devolveu JSON no stdout.`,
            'ML_INVALID_RESPONSE',
            env.isProduction
              ? undefined
              : { exitCode, stdout: stdout.slice(0, 1000), stderr: stderr.slice(0, 1000) },
          ),
        );
        return;
      }

      if (parsed?.ok === false) {
        const code = parsed.error?.code ?? 'INFERENCE_FAILED';
        reject(
          new AppError(
            PYTHON_ERROR_STATUS[code] ?? 500,
            code,
            parsed.error?.message ?? 'Falha na camada de ML.',
            parsed.error?.details,
          ),
        );
        return;
      }

      if (exitCode !== 0) {
        reject(
          AppError.internal(
            `${script} terminou com código ${exitCode}.`,
            'ML_EXECUTION_FAILED',
            env.isProduction ? undefined : { stderr: stderr.slice(0, 1000) },
          ),
        );
        return;
      }

      resolve(parsed);
    });

    child.stdin.on('error', () => {
    });
    child.stdin.end(JSON.stringify(payload), 'utf-8');
  });
}

export default runPythonScript;
