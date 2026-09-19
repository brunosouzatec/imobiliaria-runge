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

function diagnoseSmtpError(error) {
  const code = String(error?.code || '').toUpperCase();
  const responseCode = Number(error?.responseCode || 0) || null;
  const command = String(error?.command || '').toUpperCase() || null;
  if (code === 'EAUTH' || responseCode === 535 || responseCode === 534) {
    return { etapa: 'autenticação', codigo: code || String(responseCode), comando: command, mensagem: 'O servidor recusou usuário ou senha. Confirme o e-mail completo e use uma senha de aplicativo quando houver autenticação em dois fatores.' };
  }
  if (code === 'ENOTFOUND' || code === 'EAI_AGAIN') {
    return { etapa: 'conexão', codigo: code, comando: command, mensagem: 'O servidor SMTP não foi encontrado. Confira o nome do servidor e o DNS.' };
  }
  if (code === 'ECONNECTION' || code === 'ECONNREFUSED' || code === 'ETIMEDOUT' || responseCode === 421) {
    return { etapa: 'conexão', codigo: code || String(responseCode), comando: command, mensagem: 'Não foi possível conectar ao servidor SMTP. Confira a porta, TLS/SSL e se o provedor permite conexões SMTP.' };
  }
  if (code === 'ESOCKET' || code === 'CERT_HAS_EXPIRED' || code === 'ERR_TLS_CERT_ALTNAME_INVALID') {
    return { etapa: 'TLS/SSL', codigo: code, comando: command, mensagem: 'A conexão segura falhou. Use porta 465 com SSL ativado ou porta 587 com SSL desativado para STARTTLS.' };
  }
  if (code === 'EENVELOPE' || responseCode === 550 || responseCode === 553) {
    return { etapa: 'remetente', codigo: code || String(responseCode), comando: command, mensagem: 'O provedor rejeitou o remetente ou destinatário. Use um remetente autorizado e com o mesmo domínio da conta SMTP.' };
  }
  return { etapa: 'envio', codigo: code || String(responseCode || 'SMTP_ERROR'), comando: command, mensagem: 'O provedor recusou o envio. Confira os dados SMTP, a autenticação do domínio e os registros SPF/DKIM.' };
}

async function sendTestEmail({ email }, config = process.env) {
  const transporter = createMailer(config);
  if (!transporter) throw new Error('SMTP não configurado.');
  await transporter.verify();
  const timestamp = new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
  return transporter.sendMail({
    from: config.SMTP_FROM,
    to: email,
    subject: 'Teste de configuração de e-mail | Tatuí Imóveis',
    text: `Este é um e-mail de teste da Tatuí Imóveis.\n\nA configuração SMTP foi validada com sucesso em ${timestamp}.\n\nSe você recebeu esta mensagem, o sistema está pronto para enviar e-mails de recuperação de senha.`,
    html: `<p>Este é um e-mail de teste da <strong>Tatuí Imóveis</strong>.</p><p>A configuração SMTP foi validada com sucesso em ${escapeHtml(timestamp)}.</p><p>Se você recebeu esta mensagem, o sistema está pronto para enviar e-mails de recuperação de senha.</p>`
  });
}

module.exports = { createMailer, sendPasswordResetEmail, sendTestEmail, diagnoseSmtpError, smtpConfigured };
