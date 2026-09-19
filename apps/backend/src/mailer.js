const nodemailer = require('nodemailer');
function escapeHtml(value) { return String(value ?? '').replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character])); }

function smtpConfigured(config = process.env) {
  return Boolean(config.SMTP_HOST && config.SMTP_USER && config.SMTP_PASS && config.SMTP_FROM);
}

function createMailer(config = process.env) {
  if (!smtpConfigured(config)) return null;
  return nodemailer.createTransport({
    host: config.SMTP_HOST,
    port: Number(config.SMTP_PORT || 587),
    secure: String(config.SMTP_SECURE || '').toLowerCase() === 'true' || Number(config.SMTP_PORT || 587) === 465,
    auth: { user: config.SMTP_USER, pass: config.SMTP_PASS }
  });
}

async function sendPasswordResetEmail({ email, name, token }, config = process.env) {
  const transporter = createMailer(config);
  if (!transporter) throw new Error('SMTP não configurado.');
  const baseUrl = String(config.APP_PUBLIC_URL || process.env.APP_PUBLIC_URL || '').replace(/\/$/, '');
  if (!baseUrl) throw new Error('APP_PUBLIC_URL não configurada.');
  const link = `${baseUrl}/recuperar-senha?token=${encodeURIComponent(token)}`;
  const safeName = escapeHtml(name);
  const safeLink = escapeHtml(link);
  return transporter.sendMail({
    from: config.SMTP_FROM,
    to: email,
    subject: 'Recuperação de senha | Tatuí Imóveis',
    text: `Olá${name ? `, ${name}` : ''}!\n\nRecebemos uma solicitação para alterar sua senha. Acesse o link abaixo em até 30 minutos:\n\n${link}\n\nSe você não solicitou essa alteração, ignore este e-mail.`,
    html: `<p>Olá${name ? `, ${safeName}` : ''}!</p><p>Recebemos uma solicitação para alterar sua senha.</p><p><a href="${safeLink}">Criar uma nova senha</a></p><p>Este link expira em 30 minutos. Se você não solicitou essa alteração, ignore este e-mail.</p>`
  });
}

module.exports = { createMailer, sendPasswordResetEmail, smtpConfigured };
