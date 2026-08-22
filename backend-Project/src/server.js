import { assertEnv, env } from './config/env.js';
import { createApp } from './app.js';
import { checkDatabase, disconnectPrisma } from './lib/prisma.js';
import { checkMdService } from './services/mdClient.js';

assertEnv();

const app = createApp();

function handleListenError(error) {
  if (error.code === 'EADDRINUSE') {
    console.error(
      `\n[backend-Project] ERRO: a porta ${env.PORT} já está em uso.\n` +
        '  Provavelmente há outra instância deste serviço rodando (em outra aba de terminal,\n' +
        '  ou um processo esquecido de uma execução anterior).\n' +
        `  Encontre e finalize com:\n` +
        `    netstat -ano | findstr :${env.PORT}\n` +
        '    taskkill /PID <pid> /F\n',
    );
  } else {
    console.error(`\n[backend-Project] ERRO ao iniciar o servidor: ${error.message}\n`, error);
  }
  process.exit(1);
}

const server = app.listen(env.PORT, async () => {
  console.log(`[backend-Project] ouvindo em http://localhost:${env.PORT} (${env.NODE_ENV})`);
  console.log(`[backend-Project] documentação: http://localhost:${env.PORT}/api/docs`);

  const [database, mlService] = await Promise.all([checkDatabase(), checkMdService()]);

  if (database.connected) {
    console.log('[backend-Project] banco: conectado');
  } else {
    console.warn(`[backend-Project] AVISO: banco inacessível — ${database.error}`);
  }

  if (mlService.reachable) {
    console.log(
      `[backend-Project] serviço de IA: ${mlService.status} ` +
        `(modelo ${mlService.modelVersion ?? 'não treinado'})`,
    );
  } else {
    console.warn(
      `[backend-Project] AVISO: serviço de IA inacessível em ${env.MD_API_BASE_URL} — ` +
        'as rotas de análise responderão 503 até ele subir.',
    );
  }
});

server.on('error', handleListenError);

async function shutdown(signal) {
  console.log(`\n[backend-Project] ${signal} recebido, encerrando...`);
  server.close(async () => {
    await disconnectPrisma();
    console.log('[backend-Project] encerrado.');
    process.exit(0);
  });

  setTimeout(() => process.exit(1), 10000).unref();
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

process.on('unhandledRejection', (reason) => {
  console.error('[backend-Project] promise rejeitada sem tratamento:', reason);
});
