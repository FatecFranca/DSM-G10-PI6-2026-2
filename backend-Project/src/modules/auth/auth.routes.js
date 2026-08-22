import { Router } from 'express';

import { authenticate } from '../../middlewares/auth.js';
import { validate } from '../../utils/validate.js';
import {
  changePassword,
  getProfile,
  login,
  requestPasswordReset,
  resetPasswordWithToken,
} from './auth.service.js';

const router = Router();

/**
 * @openapi
 * /api/auth/login:
 *   post:
 *     tags: [Autenticação]
 *     summary: Autentica um usuário e devolve um JWT
 *     description: |
 *       Valida as credenciais contra o hash bcrypt armazenado e emite um JWT
 *       contendo identificação, papel e instituição do usuário.
 *
 *       O token deve ser enviado em todas as requisições seguintes no header
 *       `Authorization: Bearer <token>`.
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password]
 *             properties:
 *               email:    { type: string, format: email, example: admin@pi6.local }
 *               password: { type: string, format: password, example: Admin@123456 }
 *     responses:
 *       200:
 *         description: Autenticado
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 token:     { type: string }
 *                 expiresIn: { type: string, example: 1d }
 *                 user:      { $ref: '#/components/schemas/UserSummary' }
 *       401:
 *         description: Credenciais inválidas
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 *             example: { error: INVALID_CREDENTIALS, message: E-mail ou senha inválidos. }
 *       403: { $ref: '#/components/responses/Forbidden' }
 *       422: { $ref: '#/components/responses/ValidationError' }
 */
router.post('/login', async (req, res, next) => {
  try {
    const data = validate(req.body, {
      email: { type: 'email', required: true },
      password: { type: 'string', required: true, max: 128 },
    });
    res.json(await login(data));
  } catch (error) {
    next(error);
  }
});

/**
 * @openapi
 * /api/auth/me:
 *   get:
 *     tags: [Autenticação]
 *     summary: Perfil do usuário autenticado
 *     responses:
 *       200:
 *         description: Perfil
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/User' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 */
router.get('/me', authenticate, async (req, res, next) => {
  try {
    res.json(await getProfile(req.user.id));
  } catch (error) {
    next(error);
  }
});

/**
 * @openapi
 * /api/auth/change-password:
 *   post:
 *     tags: [Autenticação]
 *     summary: Troca a senha do próprio usuário
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [currentPassword, newPassword]
 *             properties:
 *               currentPassword: { type: string, format: password }
 *               newPassword:     { type: string, format: password, minLength: 8 }
 *     responses:
 *       200: { description: Senha alterada }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       422: { $ref: '#/components/responses/ValidationError' }
 */
router.post('/change-password', authenticate, async (req, res, next) => {
  try {
    const data = validate(req.body, {
      currentPassword: { type: 'string', required: true, max: 128 },
      newPassword: { type: 'password', required: true, min: 8 },
    });
    res.json(await changePassword(req.user.id, data));
  } catch (error) {
    next(error);
  }
});

/**
 * @openapi
 * /api/auth/forgot-password:
 *   post:
 *     tags: [Autenticação]
 *     summary: Solicita a recuperação de senha por e-mail
 *     description: |
 *       Recurso exclusivo do papel `VIEWER` (Consulta) — `ADMIN` e `ANALYST` já
 *       têm um caminho direto para recuperar acesso (um administrador redefine
 *       a senha pela tela de Usuários).
 *
 *       A resposta é sempre a mesma, exista ou não uma conta elegível para o
 *       e-mail informado, para não revelar se o e-mail está cadastrado nem o
 *       papel do usuário. O e-mail com o link de redefinição só é enviado
 *       quando o e-mail corresponde a um usuário `VIEWER` ativo.
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email]
 *             properties:
 *               email: { type: string, format: email }
 *     responses:
 *       200:
 *         description: Solicitação recebida (resposta genérica)
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 requested: { type: boolean }
 *                 message:   { type: string }
 *       422: { $ref: '#/components/responses/ValidationError' }
 */
router.post('/forgot-password', async (req, res, next) => {
  try {
    const { email } = validate(req.body, {
      email: { type: 'email', required: true },
    });
    res.json(await requestPasswordReset(email));
  } catch (error) {
    next(error);
  }
});

/**
 * @openapi
 * /api/auth/reset-password:
 *   post:
 *     tags: [Autenticação]
 *     summary: Conclui a recuperação de senha com o token recebido por e-mail
 *     description: |
 *       O token é de uso único e expira 30 minutos após a solicitação. Um
 *       token inválido, expirado ou já utilizado devolve `RESET_TOKEN_INVALID`.
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [token, newPassword]
 *             properties:
 *               token:       { type: string }
 *               newPassword: { type: string, format: password, minLength: 8 }
 *     responses:
 *       200: { description: Senha redefinida }
 *       400:
 *         description: Token inválido ou expirado
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 *             example: { error: RESET_TOKEN_INVALID, message: Link de recuperação inválido ou expirado. Solicite um novo. }
 *       422: { $ref: '#/components/responses/ValidationError' }
 */
router.post('/reset-password', async (req, res, next) => {
  try {
    const data = validate(req.body, {
      token: { type: 'string', required: true, max: 256 },
      newPassword: { type: 'password', required: true, min: 8 },
    });
    res.json(await resetPasswordWithToken(data));
  } catch (error) {
    next(error);
  }
});

export default router;
