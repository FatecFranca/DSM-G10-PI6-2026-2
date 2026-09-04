import { registerCurrentArtifacts } from '../modules/models/models.service.js';
import { disconnectPrisma } from '../lib/prisma.js';

try {
  const result = await registerCurrentArtifacts();

  console.log('[ml:register] modelo registrado e marcado como ativo:');
  console.log(`  versão    : ${result.model.modelVersion}`);
  console.log(`  algoritmo : ${result.model.algorithm}`);
  console.log(`  treinado  : ${result.model.trainedAt.toISOString()}`);
} catch (error) {
  console.error(`[ml:register] falhou: ${error.message}`);
  process.exitCode = 1;
} finally {
  await disconnectPrisma();
}
