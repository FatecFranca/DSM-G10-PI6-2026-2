import { env } from '../../config/env.js';
import { getKafka, TOPICS } from '../../lib/messaging.js';
import { classifyBatch } from './classification.service.js';

async function handleAnalysisRequested(record) {
  const message = record.value;
  if (!message?.jobId || !Array.isArray(message.records)) {
    console.warn(
      `[backend-MD] mensagem ignorada em ${record.topic}@${record.partition}:${record.offset} — formato inválido.`,
    );
    return;
  }

  let reply;
  try {
    const result = await classifyBatch({ records: message.records });
    reply = {
      jobId: message.jobId,
      status: 'SUCCEEDED',
      model: { version: result.model.version, algorithm: result.model.algorithm },
      results: result.results,
      completedAt: new Date().toISOString(),
    };
  } catch (error) {
    reply = {
      jobId: message.jobId,
      status: 'FAILED',
      error: { code: error.code ?? 'INTERNAL_ERROR', message: error.message },
      completedAt: new Date().toISOString(),
    };
  }

  await getKafka().produce(TOPICS.analysisCompleted, [{ key: message.jobId, value: reply }]);
  console.log(`[backend-MD] job ${message.jobId}: ${reply.status} (${message.records.length} registro(s))`);
}

export function startClassificationConsumer() {
  return getKafka().subscribe({
    group: env.KAFKA_CONSUMER_GROUP,
    topics: [TOPICS.analysisRequested],
    name: 'backend-md',
    onMessage: handleAnalysisRequested,
  });
}
