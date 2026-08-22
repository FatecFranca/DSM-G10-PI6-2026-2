import { assertEnv, env } from './config/env.js';
import { createApp } from './app.js';
import { disconnectPrisma } from './lib/prisma.js';
import { getMlStatus } from './ml/artifacts.js';

assertEnv();

const app = createApp();

function handleListenError(error) {
  if (error.code === 'EADDRINUSE') {
    console.error(
      `\n[backend-MD] ERRO: a porta ${env.PORT} já está em uso.\n` +
        '  Provavelmente há outra instância deste serviço rodando (em outra aba de terminal,\n' +
        '  ou um processo esquecido de uma execução anterior).\n' +
        `  Encontre e finalize com:\n` +
        `    netstat -ano | findstr :${env.PORT}\n` +
        '    taskkill /PID <pid> /F\n',
    );
  } else {
    console.error(`\n[backend-MD] ERRO ao iniciar o servidor: ${error.message}\n`, error);
  }
  process.exit(1);
}

const server = app.listen(env.PORT, async () => {
  console.log(`[backend-MD] ouvindo em http://localhost:${env.PORT} (${env.NODE_ENV})`);
  console.log(`[backend-MD] documentação: http://localhost:${env.PORT}/api/docs`);
  console.log(`[backend-MD] python: ${env.PYTHON_BIN}`);

  try {
    const ml = await getMlStatus();
    if (!ml.featureSpecReady) {
      console.warn('[backend-MD] AVISO: contrato de features ausente — rode "npm run ml:prepare".');
    }
    if (!ml.classifierReady) {
      console.warn('[backend-MD] AVISO: nenhum modelo treinado — rode "npm run ml:train".');
    } else {
      console.log(`[backend-MD] modelo ativo: ${ml.modelVersion}`);
    }
    if (!ml.clusteringReady) {
      console.log('[backend-MD] agrupamento não treinado (opcional) — rode "npm run ml:cluster".');
    } else {
      console.log(`[backend-MD] agrupamento ativo: ${ml.clusterVersion}`);
    }
  } catch (error) {
    console.warn('[backend-MD] AVISO: não foi possível inspecionar a camada de ML:', error.message);
  }
});

server.on('error', handleListenError);

async function shutdown(signal) {
  console.log(`\n[backend-MD] ${signal} recebido, encerrando...`);
  server.close(async () => {
    await disconnectPrisma();
    console.log('[backend-MD] encerrado.');
    process.exit(0);
  });

  setTimeout(() => process.exit(1), 10000).unref();
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

process.on('unhandledRejection', (reason) => {
  console.error('[backend-MD] promise rejeitada sem tratamento:', reason);
});
