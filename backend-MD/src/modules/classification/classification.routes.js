import { Router } from 'express';

import { getFeatures, postClassify, postClassifyBatch } from './classification.controller.js';

const router = Router();

/**
 * @openapi
 * /api/features:
 *   get:
 *     tags: [Contrato]
 *     summary: Contrato de features aceito pelo classificador
 *     description: |
 *       Lista as features obrigatórias, com rótulo legível, tipo e a faixa de
 *       valores observada no dataset de treino. É a fonte que o backend-Project
 *       deve usar para validar entrada e que a interface deve usar para montar
 *       formulários — em vez de duplicar a lista de colunas.
 *     security: [{ ApiKeyAuth: [] }]
 *     responses:
 *       200:
 *         description: Contrato de features
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 featureCount: { type: integer, example: 36 }
 *                 featureOrder:
 *                   type: array
 *                   items: { type: string }
 *                   description: Ordem exata das colunas usada no treino.
 *                 features:
 *                   type: array
 *                   items: { $ref: '#/components/schemas/FeatureSpec' }
 *                 classes:
 *                   type: array
 *                   items: { type: string }
 *                   example: [Dropout, Enrolled, Graduate]
 *                 modelVersion: { type: string, nullable: true }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       503: { $ref: '#/components/responses/MlUnavailable' }
 */
router.get('/features', getFeatures);

/**
 * @openapi
 * /api/classify:
 *   post:
 *     tags: [Classificação]
 *     summary: Classifica um estudante em Dropout, Enrolled ou Graduate
 *     description: |
 *       Executa o pipeline de inferência: valida a entrada, aplica as mesmas
 *       transformações usadas no treino (transformadores persistidos) e devolve
 *       a classe mais provável.
 *
 *       O campo `confidence` é a probabilidade estimada pelo modelo para a classe
 *       escolhida e **não** passou por calibração estatística. O resultado é
 *       apoio à tomada de decisão, não uma garantia sobre o futuro do estudante.
 *
 *       Quando algum valor enviado está fora da faixa observada no treino, a
 *       resposta inclui `warnings` — a predição é feita, mas o modelo está
 *       extrapolando naquele atributo.
 *     security: [{ ApiKeyAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [features]
 *             properties:
 *               features:
 *                 $ref: '#/components/schemas/StudentFeatures'
 *     responses:
 *       200:
 *         description: Classificação produzida
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ClassificationResult' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       422: { $ref: '#/components/responses/ValidationError' }
 *       503: { $ref: '#/components/responses/MlUnavailable' }
 *       504: { $ref: '#/components/responses/MlTimeout' }
 */
router.post('/classify', postClassify);

/**
 * @openapi
 * /api/classify/batch:
 *   post:
 *     tags: [Classificação]
 *     summary: Classifica vários estudantes em uma única execução
 *     description: |
 *       Preferir este endpoint a N chamadas unitárias: a camada de ML é acionada
 *       por processo Python sob demanda, então o custo de subida do interpretador
 *       é pago uma vez por requisição, não uma vez por estudante.
 *     security: [{ ApiKeyAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [records]
 *             properties:
 *               records:
 *                 type: array
 *                 minItems: 1
 *                 items: { $ref: '#/components/schemas/StudentFeatures' }
 *     responses:
 *       200:
 *         description: Classificações produzidas, na mesma ordem do envio
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/BatchClassificationResult' }
 *       400: { $ref: '#/components/responses/BadRequest' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       422: { $ref: '#/components/responses/ValidationError' }
 *       503: { $ref: '#/components/responses/MlUnavailable' }
 *       504: { $ref: '#/components/responses/MlTimeout' }
 */
router.post('/classify/batch', postClassifyBatch);

export default router;
