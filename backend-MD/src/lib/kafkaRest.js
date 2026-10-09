import { randomUUID } from 'node:crypto';
import os from 'node:os';

const JSON_V2 = 'application/vnd.kafka.json.v2+json';
const V2 = 'application/vnd.kafka.v2+json';

const POLL_TIMEOUT_MS = 5000;
const POLL_MAX_BYTES = 2 * 1024 * 1024;
const REQUEST_TIMEOUT_MS = 30000;
const RETRY_DELAY_MS = 5000;

export class KafkaRestError extends Error {
  constructor(status, body, message) {
    super(message);
    this.name = 'KafkaRestError';
    this.status = status;
    this.errorCode = body?.error_code ?? null;
  }
}

function wait(ms, signal) {
  return new Promise((resolve) => {
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener(
      'abort',
      () => {
        clearTimeout(timer);
        resolve();
      },
      { once: true },
    );
  });
}

export function createKafkaRestClient({ url, username, password }) {
  const baseUrl = url.replace(/\/+$/, '');
  const authorization = `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`;

  async function call(target, { method = 'GET', contentType, accept, body, signal, timeoutMs } = {}) {
    const headers = { Authorization: authorization };
    if (contentType) headers['Content-Type'] = contentType;
    if (accept) headers.Accept = accept;

    const timeout = AbortSignal.timeout(timeoutMs ?? REQUEST_TIMEOUT_MS);

    const response = await fetch(target.startsWith('http') ? target : `${baseUrl}${target}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
    });

    const text = await response.text();
    let payload = null;
    if (text) {
      try {
        payload = JSON.parse(text);
      } catch {
        payload = { message: text };
      }
    }

    if (!response.ok) {
      throw new KafkaRestError(
        response.status,
        payload,
        payload?.message ?? `Kafka REST respondeu HTTP ${response.status}.`,
      );
    }
    return payload;
  }

  async function produce(topic, records) {
    const payload = await call(`/topics/${encodeURIComponent(topic)}`, {
      method: 'POST',
      contentType: JSON_V2,
      accept: V2,
      body: { records },
    });

    const failed = (payload?.offsets ?? []).find((entry) => entry.error_code != null);
    if (failed) {
      throw new KafkaRestError(
        500,
        failed,
        `Falha ao publicar em "${topic}": ${failed.error ?? failed.error_code}.`,
      );
    }
    return payload.offsets;
  }

  function subscribe({ group, topics, name, onMessage, logger = console }) {
    const controller = new AbortController();
    const { signal } = controller;
    let instanceUri = null;
    let stopped = false;

    async function open() {
      const instanceName = `${name}-${os.hostname()}-${randomUUID().slice(0, 8)}`.replace(
        /[^A-Za-z0-9._-]/g,
        '-',
      );
      const created = await call(`/consumers/${encodeURIComponent(group)}`, {
        method: 'POST',
        contentType: V2,
        accept: V2,
        body: {
          name: instanceName,
          format: 'json',
          'auto.offset.reset': 'earliest',
          'auto.commit.enable': 'false',
        },
        signal,
      });
      instanceUri = created.base_uri;
      await call(`${instanceUri}/subscription`, {
        method: 'POST',
        contentType: V2,
        body: { topics },
        signal,
      });
      logger.log(`[kafka] consumidor "${group}" inscrito em ${topics.join(', ')}`);
    }

    async function close() {
      if (!instanceUri) return;
      const target = instanceUri;
      instanceUri = null;
      try {
        await call(target, { method: 'DELETE', contentType: V2, timeoutMs: 5000 });
      } catch {
      }
    }

    async function run() {
      while (!stopped) {
        try {
          if (!instanceUri) await open();

          const records = await call(
            `${instanceUri}/records?timeout=${POLL_TIMEOUT_MS}&max_bytes=${POLL_MAX_BYTES}`,
            { accept: JSON_V2, signal, timeoutMs: POLL_TIMEOUT_MS + REQUEST_TIMEOUT_MS },
          );

          if (Array.isArray(records) && records.length > 0) {
            for (const record of records) await onMessage(record);
            await call(`${instanceUri}/offsets`, {
              method: 'POST',
              contentType: V2,
              body: {
                offsets: records.map(({ topic, partition, offset }) => ({ topic, partition, offset })),
              },
              signal,
            });
          }
        } catch (error) {
          if (stopped) break;
          logger.error(`[kafka] consumidor "${group}": ${error.message} — nova tentativa em ${RETRY_DELAY_MS}ms`);
          await close();
          await wait(RETRY_DELAY_MS, signal);
        }
      }
      await close();
    }

    const running = run();

    return {
      async stop() {
        stopped = true;
        controller.abort();
        await running;
      },
    };
  }

  return { produce, subscribe };
}

export default createKafkaRestClient;
