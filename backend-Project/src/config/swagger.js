import path from 'node:path';

import swaggerJsdoc from 'swagger-jsdoc';

import { env, PROJECT_ROOT } from './env.js';

const definition = {
  openapi: '3.0.3',
  info: {
    title: 'backend-Project — API principal da plataforma',
    version: env.API_VERSION,
    license: { name: 'ISC' },
    description: [
      'API de negócio do projeto **Predict Students\' Dropout and Academic Success',
      "Classification** — PI do 6º semestre.",
      '',
      'É a interface oficial de comunicação dos clientes **Web, Mobile e Desktop**',
      'com o Back-End, e o orquestrador da plataforma.',
      '',
      '### Papel de gateway',
      'Toda inteligência analítica vive no serviço `backend-MD`, que **nunca** é',
      'chamado diretamente pelos clientes: esta API é o único caminho para dados',
      'e para resultados de IA. Os clientes não conhecem o endereço do `backend-MD`.',
      '',
      '### Autenticação',
      'JWT no header `Authorization: Bearer <token>`, obtido em `POST /api/auth/login`.',
      '',
      '**Papéis:**',
      '- `ADMIN` — administra usuários e instituições; acessa todas as instituições.',
      '- `ANALYST` — cadastra estudantes, executa análises e conduz acompanhamentos',
      '  na própria instituição.',
      '- `VIEWER` — somente leitura no escopo da própria instituição.',
      '',
      '### Natureza dos resultados de IA',
      'A classificação (`Dropout` / `Enrolled` / `Graduate`) é **apoio à tomada de',
      'decisão**, não uma garantia sobre o futuro de um estudante. `confidence` é a',
      'probabilidade estimada pelo modelo, sem calibração estatística.',
    ].join('\n'),
  },
  servers: [{ url: `http://localhost:${env.PORT}`, description: 'Ambiente local' }],
  tags: [
    { name: 'Saúde', description: 'Diagnóstico do serviço (público)' },
    { name: 'Autenticação', description: 'Login, perfil e senha' },
    { name: 'Estudantes', description: 'Cadastro e consulta de estudantes' },
    { name: 'Análises', description: 'Execução e histórico de classificações' },
    { name: 'Acompanhamento', description: 'Ações a partir das análises' },
    { name: 'Painel', description: 'Indicadores e séries temporais' },
    { name: 'Mineração de Dados', description: 'Processo de construção do modelo' },
    { name: 'Administração', description: 'Usuários e instituições' },
  ],
  components: {
    securitySchemes: {
      BearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'Token obtido em POST /api/auth/login.',
      },
    },
    schemas: {
      Error: {
        type: 'object',
        properties: {
          error: { type: 'string', description: 'Código estável', example: 'VALIDATION_ERROR' },
          message: { type: 'string' },
          details: { description: 'Detalhamento, quando aplicável' },
        },
      },
      Paginated: {
        type: 'object',
        properties: {
          data: { type: 'array', items: { type: 'object' } },
          pagination: {
            type: 'object',
            properties: {
              page: { type: 'integer', example: 1 },
              limit: { type: 'integer', example: 20 },
              total: { type: 'integer', example: 137 },
              totalPages: { type: 'integer', example: 7 },
              hasNext: { type: 'boolean' },
              hasPrevious: { type: 'boolean' },
            },
          },
        },
      },
      UserSummary: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          name: { type: 'string' },
          email: { type: 'string', format: 'email' },
          role: { type: 'string', enum: ['ADMIN', 'ANALYST', 'VIEWER'] },
          institutionId: { type: 'string', nullable: true },
        },
      },
      User: {
        allOf: [
          { $ref: '#/components/schemas/UserSummary' },
          {
            type: 'object',
            properties: {
              active: { type: 'boolean' },
              lastLoginAt: { type: 'string', format: 'date-time', nullable: true },
              createdAt: { type: 'string', format: 'date-time' },
              institution: { type: 'object', nullable: true },
            },
          },
        ],
      },
      Institution: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          name: { type: 'string' },
          city: { type: 'string', nullable: true },
          state: { type: 'string', nullable: true },
          type: { type: 'string', nullable: true, example: 'pública' },
          email: { type: 'string', format: 'email', nullable: true },
          phone: { type: 'string', nullable: true },
          active: { type: 'boolean' },
          studentCount: { type: 'integer' },
          userCount: { type: 'integer' },
        },
      },
      FeatureSpec: {
        type: 'object',
        description: 'Especificação de um atributo, repassada do backend-MD.',
        properties: {
          name: { type: 'string', example: 'age_at_enrollment' },
          label: { type: 'string', example: 'Idade na matrícula' },
          kind: { type: 'string', enum: ['numeric', 'binary', 'categorical'] },
          dtype: { type: 'string', enum: ['int', 'float'] },
          min: { type: 'number' },
          max: { type: 'number' },
          mean: { type: 'number' },
          required: { type: 'boolean' },
        },
      },
      StudentFeatures: {
        type: 'object',
        description:
          'Atributos acadêmicos e socioeconômicos no formato do contrato do modelo ' +
          '(36 campos numéricos). Use GET /api/students/feature-contract para a lista ' +
          'completa com rótulos e faixas válidas.',
        additionalProperties: { type: 'number' },
        example: {
          age_at_enrollment: 20,
          admission_grade: 127.3,
          curricular_units_1st_sem_approved: 6,
          curricular_units_2nd_sem_approved: 6,
          tuition_fees_up_to_date: 1,
          scholarship_holder: 0,
        },
      },
      FeaturesStatus: {
        type: 'object',
        description: 'Preenchimento dos atributos em relação ao contrato do modelo.',
        properties: {
          complete: { type: 'boolean' },
          filled: { type: 'integer', example: 30 },
          total: { type: 'integer', example: 36 },
          missing: { type: 'array', items: { type: 'string' } },
        },
      },
      StudentSummary: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          code: { type: 'string' },
          name: { type: 'string' },
          email: { type: 'string', nullable: true },
          course: { type: 'string', nullable: true },
          enrollmentYear: { type: 'integer', nullable: true },
          institutionId: { type: 'string' },
          lastClassification: {
            type: 'string',
            nullable: true,
            enum: ['Dropout', 'Enrolled', 'Graduate'],
          },
          lastConfidence: { type: 'number', nullable: true },
          lastAnalysisAt: { type: 'string', format: 'date-time', nullable: true },
          lastPriority: { type: 'string', nullable: true, enum: ['LOW', 'MEDIUM', 'HIGH'] },
          active: { type: 'boolean' },
        },
      },
      Student: {
        allOf: [
          { $ref: '#/components/schemas/StudentSummary' },
          {
            type: 'object',
            properties: {
              features: { $ref: '#/components/schemas/StudentFeatures' },
              featuresStatus: { $ref: '#/components/schemas/FeaturesStatus' },
              analyses: { type: 'array', items: { type: 'object' } },
              followUps: { type: 'array', items: { type: 'object' } },
            },
          },
        ],
      },
      Recommendation: {
        type: 'object',
        description:
          'Leitura de acompanhamento derivada pelo núcleo de negócio a partir do ' +
          'resultado do modelo. O serviço de IA não decide prioridade.',
        properties: {
          priority: { type: 'string', enum: ['LOW', 'MEDIUM', 'HIGH'] },
          label: { type: 'string', example: 'Acompanhamento prioritário' },
          description: { type: 'string' },
          factors: {
            type: 'object',
            properties: {
              classification: { type: 'string' },
              confidence: { type: 'number', nullable: true },
              confidenceThreshold: { type: 'number', example: 0.6 },
              confidentSignal: { type: 'boolean' },
            },
          },
        },
      },
      AnalysisResult: {
        type: 'object',
        properties: {
          id: { type: 'string', nullable: true },
          studentId: { type: 'string', nullable: true },
          persisted: {
            type: 'boolean',
            description: 'Presente e false quando a análise foi simulada e não entrou no histórico.',
          },
          analysis: {
            type: 'object',
            properties: {
              classification: { type: 'string', enum: ['Dropout', 'Enrolled', 'Graduate'] },
              classId: { type: 'integer' },
              confidence: { type: 'number', nullable: true, example: 0.78 },
              probabilities: {
                type: 'object',
                additionalProperties: { type: 'number' },
                example: { Dropout: 0.78, Enrolled: 0.12, Graduate: 0.1 },
              },
            },
          },
          recommendation: { $ref: '#/components/schemas/Recommendation' },
          model: {
            type: 'object',
            properties: { version: { type: 'string' }, algorithm: { type: 'string' } },
          },
          warnings: {
            type: 'array',
            description: 'Atributos fora da faixa observada no treino do modelo.',
            items: { type: 'object' },
          },
          disclaimer: { type: 'string' },
        },
      },
      AnalysisRecord: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          studentId: { type: 'string' },
          classification: { type: 'string' },
          confidence: { type: 'number', nullable: true },
          priority: { type: 'string', enum: ['LOW', 'MEDIUM', 'HIGH'] },
          modelVersion: { type: 'string' },
          algorithm: { type: 'string' },
          createdAt: { type: 'string', format: 'date-time' },
          student: { type: 'object' },
          requestedBy: { type: 'object', nullable: true },
        },
      },
      FollowUp: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          studentId: { type: 'string' },
          analysisId: { type: 'string', nullable: true },
          title: { type: 'string' },
          notes: { type: 'string', nullable: true },
          status: { type: 'string', enum: ['OPEN', 'IN_PROGRESS', 'DONE', 'CANCELLED'] },
          priority: { type: 'string', enum: ['LOW', 'MEDIUM', 'HIGH'] },
          dueDate: { type: 'string', format: 'date-time', nullable: true },
          resolvedAt: { type: 'string', format: 'date-time', nullable: true },
          createdAt: { type: 'string', format: 'date-time' },
        },
      },
      Distribution: {
        type: 'object',
        properties: {
          total: { type: 'integer' },
          items: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                value: { type: 'string' },
                count: { type: 'integer' },
                ratio: { type: 'number', example: 0.32 },
              },
            },
          },
        },
      },
      Dashboard: {
        type: 'object',
        properties: {
          scope: { type: 'object' },
          overview: {
            type: 'object',
            properties: {
              totalStudents: { type: 'integer' },
              activeStudents: { type: 'integer' },
              analyzedStudents: { type: 'integer' },
              analysisCoverage: { type: 'number', example: 0.72 },
              pendingAnalysis: { type: 'integer' },
              totalAnalyses: { type: 'integer' },
              analysesInPeriod: { type: 'integer' },
            },
          },
          classificationDistribution: { $ref: '#/components/schemas/Distribution' },
          priorityDistribution: { $ref: '#/components/schemas/Distribution' },
          followUps: { type: 'object' },
          attentionQueue: {
            type: 'array',
            items: { $ref: '#/components/schemas/StudentSummary' },
          },
          recentAnalyses: { type: 'array', items: { type: 'object' } },
          lastModelUsed: { type: 'object', nullable: true },
          disclaimer: { type: 'string' },
        },
      },
      Health: {
        type: 'object',
        properties: {
          status: { type: 'string', enum: ['ok', 'degraded', 'unavailable'] },
          service: { type: 'string', example: 'backend-Project' },
          role: { type: 'string', example: 'API principal e núcleo de negócio' },
          apiVersion: { type: 'string' },
          environment: { type: 'string' },
          uptimeSeconds: { type: 'integer' },
          timestamp: { type: 'string', format: 'date-time' },
          database: { type: 'object', properties: { connected: { type: 'boolean' } } },
          mlService: {
            type: 'object',
            properties: {
              reachable: { type: 'boolean' },
              status: { type: 'string', nullable: true },
              classifierReady: { type: 'boolean' },
              modelVersion: { type: 'string', nullable: true },
            },
          },
        },
      },
    },
    responses: {
      Unauthorized: {
        description: 'Token ausente, inválido ou expirado',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/Error' },
            example: { error: 'TOKEN_EXPIRED', message: 'Sessão expirada. Faça login novamente.' },
          },
        },
      },
      Forbidden: {
        description: 'Permissão insuficiente para o recurso',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/Error' },
            example: {
              error: 'INSUFFICIENT_ROLE',
              message: 'Este recurso exige um dos papéis: ADMIN.',
            },
          },
        },
      },
      NotFound: {
        description: 'Recurso não encontrado',
        content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
      },
      Conflict: {
        description: 'Conflito com um registro existente',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/Error' },
            example: { error: 'STUDENT_CODE_IN_USE', message: 'Já existe um estudante com este código.' },
          },
        },
      },
      ValidationError: {
        description: 'Dados inválidos',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/Error' },
            example: {
              error: 'VALIDATION_ERROR',
              message: 'Dados inválidos na requisição.',
              details: [{ field: 'email', message: 'E-mail inválido.' }],
            },
          },
        },
      },
      MlServiceError: {
        description: 'Falha na comunicação com o serviço de IA',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/Error' },
            example: {
              error: 'ML_SERVICE_ERROR',
              message: 'Falha na comunicação com o serviço de IA.',
            },
          },
        },
      },
      MlUnavailable: {
        description: 'Serviço de IA sem modelo treinado ou indisponível',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/Error' },
            example: {
              error: 'MODEL_NOT_TRAINED',
              message: 'Nenhum modelo treinado disponível no serviço de IA.',
            },
          },
        },
      },
      MlTimeout: {
        description: 'O serviço de IA excedeu o tempo limite',
        content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
      },
    },
  },
  security: [{ BearerAuth: [] }],
};

const ROUTES_GLOB = path.join(PROJECT_ROOT, 'src', 'modules', '**', '*.routes.js').replace(/\\/g, '/');

export const swaggerSpec = swaggerJsdoc({
  definition,
  apis: [ROUTES_GLOB],
});

export default swaggerSpec;
