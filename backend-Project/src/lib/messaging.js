import { env, missingKafkaVars } from '../config/env.js';
import { createKafkaRestClient } from './kafkaRest.js';

export const TOPICS = {
  analysisRequested: env.KAFKA_TOPIC_ANALYSIS_REQUESTED,
  analysisCompleted: env.KAFKA_TOPIC_ANALYSIS_COMPLETED,
};

let client = null;

export const isMessagingEnabled = () => env.KAFKA_ENABLED && missingKafkaVars().length === 0;

export function getKafka() {
  if (!isMessagingEnabled()) {
    throw new Error('Mensageria desativada: defina KAFKA_ENABLED=true e as variáveis KAFKA_*.');
  }
  client ??= createKafkaRestClient({
    url: env.KAFKA_REST_URL,
    username: env.KAFKA_REST_USERNAME,
    password: env.KAFKA_REST_PASSWORD,
  });
  return client;
}
