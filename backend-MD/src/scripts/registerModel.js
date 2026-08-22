import { registerCurrentArtifacts } from '../modules/models/models.service.js';
import { disconnectPrisma } from '../lib/prisma.js';

try {
  const result = await registerCurrentArtifacts();

  console.log('[ml:register] modelo registrado e marcado como ativo:');
  console.log(`  versão    : ${result.model.modelVersion}`);
  console.log(`  algoritmo : ${result.model.algorithm}`);
  console.log(`  treinado  : ${result.model.trainedAt.toISOString()}`);

  if (result.clustering) {
    console.log('[ml:register] agrupamento registrado e marcado como ativo:');
    console.log(`  versão    : ${result.clustering.clusterVersion}`);
    console.log(`  k         : ${result.clustering.k}`);
  }

  for (const skipped of result.skipped) {
    console.log(`[ml:register] ignorado (${skipped.artifact}): ${skipped.message}`);
  }
} catch (error) {
  console.error(`[ml:register] falhou: ${error.message}`);
  process.exitCode = 1;
} finally {
  await disconnectPrisma();
}
