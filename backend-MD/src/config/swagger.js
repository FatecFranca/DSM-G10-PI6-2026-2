import path from 'node:path';

import swaggerJsdoc from 'swagger-jsdoc';

import { env, PROJECT_ROOT } from './env.js';

const definition = {
  openapi: '3.0.3',
  info: {
    title: 'backend-MD — Motor de IA e Mineração de Dados',
    version: env.API_VERSION,
    description: [
      'Serviço especializado de Inteligência Artificial e Mineração de Dados do',
      'projeto **Predict Students\' Dropout and Academic Success Classification**.',
      '',
      'Classifica estudantes entre `Dropout`, `Enrolled` e `Graduate` e disponibiliza',
      'análise não supervisionada de perfis.',
      '',
      '### Consumidor',
      'O consumidor previsto é o **backend-Project**, nunca um front-end diretamente.',
      'Toda requisição precisa da API Key de serviço (seção 11.1).',
      '',
      '### Natureza do resultado',
      'A classificação é **apoio à tomada de decisão**, não uma garantia sobre o futuro',
      'de um estudante. `confidence` é a probabilidade estimada pelo modelo para a classe',
      'escolhida e não passou por calibração estatística.',
      '',
      '### Camada de ML',
      'O pipeline é Python (scikit-learn), acionado pelo Express via `child_process`.',
      'A ordem das features é parte do contrato — ver `GET /api/features`.',
    ].join('\n'),
  },
  servers: [
    { url: `http://localhost:${env.PORT}`, description: 'Ambiente local' },
  ],
  tags: [
    { name: 'Saúde', description: 'Diagnóstico do serviço (público)' },
    { name: 'Contrato', description: 'Contrato de dados aceito pelo modelo' },
    { name: 'Classificação', description: 'Aprendizado supervisionado — 3 classes' },
    { name: 'Mineração de Dados', description: 'Aprendizado não supervisionado — perfis' },
    { name: 'Modelos', description: 'Metadados técnicos de reprodutibilidade' },
  ],
  components: {
    securitySchemes: {
      ApiKeyAuth: {
        type: 'apiKey',
        in: 'header',
        name: 'X-API-Key',
        description:
          'Segredo compartilhado com o backend-Project. Também é aceito como ' +
          '`Authorization: Bearer <api_key>`. Não há autenticação de usuário final ' +
          'neste serviço — ela é responsabilidade do backend-Project.',
      },
    },
    schemas: {
      Error: {
        type: 'object',
        properties: {
          error: { type: 'string, código estável', example: 'INVALID_FEATURES' },
          message: { type: 'string' },
          details: { description: 'Detalhamento, quando aplicável' },
        },
      },
      FeatureSpec: {
        type: 'object',
        properties: {
          name: { type: 'string', example: 'age_at_enrollment' },
          label: { type: 'string', example: 'Idade na matrícula' },
          kind: { type: 'string', enum: ['numeric', 'binary', 'categorical'] },
          dtype: { type: 'string', enum: ['int', 'float'] },
          min: { type: 'number', description: 'Menor valor observado no treino' },
          max: { type: 'number', description: 'Maior valor observado no treino' },
          mean: { type: 'number' },
          required: { type: 'boolean' },
        },
      },
      StudentFeatures: {
        type: 'object',
        description:
          'As 36 features do contrato, todas obrigatórias e numéricas. ' +
          'Use GET /api/features para a lista completa com faixas válidas.',
        additionalProperties: { type: 'number' },
        example: {
          marital_status: 1,
          application_mode: 17,
          application_order: 5,
          course: 171,
          daytime_evening_attendance: 1,
          previous_qualification: 1,
          previous_qualification_grade: 122,
          nationality: 1,
          mothers_qualification: 19,
          fathers_qualification: 12,
          mothers_occupation: 5,
          fathers_occupation: 9,
          admission_grade: 127.3,
          displaced: 1,
          educational_special_needs: 0,
          debtor: 0,
          tuition_fees_up_to_date: 1,
          gender: 1,
          scholarship_holder: 0,
          age_at_enrollment: 20,
          international: 0,
          curricular_units_1st_sem_credited: 0,
          curricular_units_1st_sem_enrolled: 6,
          curricular_units_1st_sem_evaluations: 6,
          curricular_units_1st_sem_approved: 6,
          curricular_units_1st_sem_grade: 14,
          curricular_units_1st_sem_without_evaluations: 0,
          curricular_units_2nd_sem_credited: 0,
          curricular_units_2nd_sem_enrolled: 6,
          curricular_units_2nd_sem_evaluations: 6,
          curricular_units_2nd_sem_approved: 6,
          curricular_units_2nd_sem_grade: 13.6,
          curricular_units_2nd_sem_without_evaluations: 0,
          unemployment_rate: 10.8,
          inflation_rate: 1.4,
          gdp: 1.74,
        },
      },
      ModelSummary: {
        type: 'object',
        properties: {
          version: { type: 'string', example: 'LogisticRegression-20260817T145904' },
          algorithm: { type: 'string' },
          contractVersion: { type: 'string', example: '1.0.0' },
          supportsProbability: { type: 'boolean' },
          trainedAt: { type: 'string', format: 'date-time' },
          classes: { type: 'array', items: { type: 'string' } },
        },
      },
      OutOfRangeWarning: {
        type: 'object',
        description: 'Valor fora da faixa observada no treino — o modelo extrapola.',
        properties: {
          feature: { type: 'string' },
          value: { type: 'number' },
          trainedRange: { type: 'array', items: { type: 'number' }, example: [17, 70] },
        },
      },
      ClassificationResult: {
        type: 'object',
        properties: {
          classification: { type: 'string', enum: ['Dropout', 'Enrolled', 'Graduate'] },
          classId: { type: 'integer', example: 0 },
          confidence: {
            type: 'number',
            nullable: true,
            example: 0.78,
            description: 'Probabilidade estimada para a classe escolhida. Não calibrada.',
          },
          probabilities: {
            type: 'object',
            nullable: true,
            additionalProperties: { type: 'number' },
            example: { Dropout: 0.78, Enrolled: 0.12, Graduate: 0.1 },
          },
          model: { $ref: '#/components/schemas/ModelSummary' },
          disclaimer: { type: 'string' },
          warnings: { type: 'array', items: { $ref: '#/components/schemas/OutOfRangeWarning' } },
        },
      },
      BatchClassificationResult: {
        type: 'object',
        properties: {
          model: { $ref: '#/components/schemas/ModelSummary' },
          count: { type: 'integer' },
          results: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                index: { type: 'integer', description: 'Posição no array enviado' },
                classification: { type: 'string' },
                classId: { type: 'integer' },
                confidence: { type: 'number', nullable: true },
                probabilities: { type: 'object', additionalProperties: { type: 'number' } },
              },
            },
          },
          disclaimer: { type: 'string' },
        },
      },
      ClusterProfile: {
        type: 'object',
        properties: {
          clusterId: { type: 'integer' },
          size: { type: 'integer' },
          ratio: { type: 'number' },
          dropoutRatio: { type: 'number' },
          attentionLevel: { type: 'string', enum: ['baixa', 'média', 'alta'] },
          classDistribution: { type: 'object' },
          featureMeans: { type: 'object', additionalProperties: { type: 'number' } },
        },
      },
      ClusterProfiles: {
        type: 'object',
        properties: {
          clustering: {
            type: 'object',
            properties: {
              version: { type: 'string' },
              algorithm: { type: 'string', example: 'KMeans' },
              k: { type: 'integer' },
              silhouette: { type: 'number' },
              trainedAt: { type: 'string', format: 'date-time' },
            },
          },
          selectionRationale: { type: 'string' },
          metrics: { type: 'object' },
          profiles: { type: 'array', items: { $ref: '#/components/schemas/ClusterProfile' } },
          disclaimer: { type: 'string' },
        },
      },
      ClusterAssignment: {
        type: 'object',
        properties: {
          clustering: { type: 'object' },
          count: { type: 'integer' },
          results: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                index: { type: 'integer' },
                clusterId: { type: 'integer' },
                distance: { type: 'number' },
                attentionLevel: { type: 'string' },
                profile: { type: 'object' },
              },
            },
          },
          disclaimer: { type: 'string' },
        },
      },
      Health: {
        type: 'object',
        properties: {
          status: { type: 'string', enum: ['ok', 'degraded'] },
          service: { type: 'string', example: 'backend-MD' },
          apiVersion: { type: 'string' },
          environment: { type: 'string' },
          uptimeSeconds: { type: 'integer' },
          timestamp: { type: 'string', format: 'date-time' },
          database: { type: 'object', properties: { connected: { type: 'boolean' } } },
          ml: {
            type: 'object',
            properties: {
              featureSpecReady: { type: 'boolean' },
              classifierReady: { type: 'boolean' },
              clusteringReady: { type: 'boolean' },
              modelVersion: { type: 'string', nullable: true },
              clusterVersion: { type: 'string', nullable: true },
              bridge: { type: 'string', example: 'child_process' },
            },
          },
        },
      },
    },
    responses: {
      BadRequest: {
        description: 'Requisição malformada',
        content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
      },
      Unauthorized: {
        description: 'API Key ausente ou inválida',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/Error' },
            example: { error: 'API_KEY_MISSING', message: 'Chave de API ausente.' },
          },
        },
      },
      NotFound: {
        description: 'Recurso não encontrado',
        content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
      },
      ValidationError: {
        description: 'Features ausentes ou inválidas',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/Error' },
            example: {
              error: 'INVALID_FEATURES',
              message: 'Registros inválidos: todas as features do contrato são obrigatórias.',
              details: {
                expectedFeatureCount: 36,
                problems: [{ index: 0, missingFeatures: ['admission_grade'] }],
              },
            },
          },
        },
      },
      MlUnavailable: {
        description: 'Camada de ML indisponível (modelo/agrupamento não treinado)',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/Error' },
            example: {
              error: 'MODEL_NOT_TRAINED',
              message: 'Nenhum modelo treinado disponível: execute "npm run ml:train".',
            },
          },
        },
      },
      MlTimeout: {
        description: 'A execução do pipeline Python excedeu o tempo limite',
        content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
      },
    },
  },
  security: [{ ApiKeyAuth: [] }],
};

const ROUTES_GLOB = path.join(PROJECT_ROOT, 'src', 'modules', '**', '*.routes.js').replace(/\\/g, '/');

export const swaggerSpec = swaggerJsdoc({
  definition,
  apis: [ROUTES_GLOB],
});

export default swaggerSpec;
