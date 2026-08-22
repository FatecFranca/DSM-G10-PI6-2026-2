import nodemailer from 'nodemailer';

import { env } from '../config/env.js';

let transporter = null;

function getTransporter() {
  if (transporter) return transporter;

  transporter = nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_PORT === 465,
    auth: { user: env.SMTP_USER, pass: env.SMTP_PASSWORD },
  });

  return transporter;
}

export function isMailerConfigured() {
  return Boolean(env.SMTP_HOST && env.SMTP_USER && env.SMTP_PASSWORD);
}

export async function sendPasswordResetEmail({ to, name, resetUrl, expiresInMinutes }) {
  const subject = 'Redefinição de senha — Plataforma de Acompanhamento Educacional';

  const text =
    `Olá, ${name}.\n\n` +
    'Recebemos uma solicitação para redefinir a senha da sua conta na Plataforma de ' +
    'Acompanhamento Educacional. Acesse o link abaixo para escolher uma nova senha:\n\n' +
    `${resetUrl}\n\n` +
    `Este link expira em ${expiresInMinutes} minutos e só pode ser usado uma vez.\n\n` +
    'Se você não solicitou esta redefinição, ignore este e-mail — sua senha atual continua válida.';

  const html = `
    <p>Olá, ${escapeHtml(name)}.</p>
    <p>Recebemos uma solicitação para redefinir a senha da sua conta na
       <strong>Plataforma de Acompanhamento Educacional</strong>.
       Clique no botão abaixo para escolher uma nova senha:</p>
    <p>
      <a href="${resetUrl}"
         style="display:inline-block;padding:10px 18px;background:#2f6fed;color:#fff;
                border-radius:6px;text-decoration:none;font-weight:600;">
        Redefinir senha
      </a>
    </p>
    <p>Ou copie e cole este endereço no navegador:<br>
       <a href="${resetUrl}">${resetUrl}</a></p>
    <p style="color:#666;font-size:13px;">
      Este link expira em ${expiresInMinutes} minutos e só pode ser usado uma vez.
      Se você não solicitou esta redefinição, ignore este e-mail — sua senha atual continua válida.
    </p>
  `;

  await getTransporter().sendMail({
    from: env.SMTP_USER,
    to,
    subject,
    text,
    html,
  });
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}
