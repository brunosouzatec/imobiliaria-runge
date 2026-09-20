const nodemailer = require('nodemailer');
const path = require('path');
function escapeHtml(value) { return String(value ?? '').replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character])); }

function smtpConfigured(config = process.env) {
  return Boolean(config.SMTP_HOST && config.SMTP_USER && config.SMTP_PASS && config.SMTP_FROM);
}

function sendGridConfigured(config = process.env) {
  return Boolean(config.SENDGRID_API_KEY && config.SMTP_FROM);
}

function emailProvider(config = process.env) {
  return String(config.EMAIL_PROVIDER || 'smtp').toLowerCase() === 'sendgrid' ? 'sendgrid' : 'smtp';
}

function emailConfigured(config = process.env) {
  return emailProvider(config) === 'sendgrid' ? sendGridConfigured(config) : smtpConfigured(config);
}

function createMailer(config = process.env) {
  if (!smtpConfigured(config)) return null;
  return nodemailer.createTransport({
    host: config.SMTP_HOST,
    port: Number(config.SMTP_PORT || 587),
    secure: String(config.SMTP_SECURE || '').toLowerCase() === 'true' || Number(config.SMTP_PORT || 587) === 465,
    // Evita que um firewall/provedor bloqueando SMTP deixe a tela administrativa presa.
    connectionTimeout: 15000,
    greetingTimeout: 10000,
    socketTimeout: 20000,
    auth: { user: config.SMTP_USER, pass: config.SMTP_PASS }
  });
}

function logoAttachment() {
  const logoPath = path.resolve(__dirname, '../../frontend/public/assets/tatui-imoveis-logo-email.png');
  try {
    return { filename: 'tatui-imoveis-logo-email.png', path: logoPath, cid: 'tatui-imoveis-logo@tatuiimoveis.com.br', contentType: 'image/png' };
  } catch (_) {
    return null;
  }
}

function passwordResetContent({ email, name, token }, config) {
  const baseUrl = String(config.APP_PUBLIC_URL || process.env.APP_PUBLIC_URL || '').replace(/\/$/, '');
  if (!baseUrl) throw new Error('APP_PUBLIC_URL não configurada.');
  const link = `${baseUrl}/recuperar-senha?token=${encodeURIComponent(token)}`;
  const safeName = escapeHtml(name);
  const safeLink = escapeHtml(link);
  const logoCid = 'tatui-imoveis-logo@tatuiimoveis.com.br';
  const text = `Olá${name ? `, ${name}` : ''}!\n\nRecebemos uma solicitação para alterar sua senha. Acesse o link abaixo em até 30 minutos:\n\n${link}\n\nSe você não solicitou essa alteração, ignore este e-mail.`;
  const html = `<!doctype html><html lang="pt-BR"><body style="background:#f6f5f1;margin:0;padding:0;font-family:Arial,Helvetica,sans-serif;color:#173c3d"><table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background:#f6f5f1;padding:32px 12px"><tr><td align="center"><table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="max-width:600px;background:#fff;border:1px solid #dfe6e2;border-radius:12px;overflow:hidden"><tr><td style="padding:36px 40px 32px"><p style="font-size:16px;line-height:1.6;margin:0 0 18px">Olá${name ? `, ${safeName}` : ''}!</p><h1 style="font-size:25px;line-height:1.25;font-weight:600;margin:0 0 18px;color:#173c3d">Redefina sua senha</h1><p style="font-size:15px;line-height:1.7;color:#607674;margin:0 0 24px">Recebemos uma solicitação para alterar a senha da sua conta no Tatuí Imóveis.</p><table role="presentation" cellpadding="0" cellspacing="0" align="center" style="margin:0 auto 24px"><tr><td align="center" bgcolor="#e5651c" style="border-radius:7px"><a href="${safeLink}" style="display:inline-block;color:#fff;font-size:15px;font-weight:700;text-decoration:none;padding:14px 22px">Criar uma nova senha</a></td></tr></table><p style="font-size:13px;line-height:1.6;color:#607674;margin:0">Este link expira em 30 minutos. Se você não solicitou essa alteração, ignore este e-mail.</p></td></tr><tr><td align="center" bgcolor="#173c3d" style="padding:10px 20px"><img src="cid:${logoCid}" width="240" alt="Tatuí Imóveis — O portal de imóveis de Tatuí" style="display:block;margin:0 auto;height:auto;border:0"></td></tr></table></td></tr></table></body></html>`;
  return { to: email, subject: 'Recuperação de senha | Tatuí Imóveis', text, html };
}

function testEmailContent({ email, timestamp }) {
  const logoCid = 'tatui-imoveis-logo@tatuiimoveis.com.br';
  const text = `Olá!\n\nEste é um e-mail de teste da Tatuí Imóveis. A configuração foi validada com sucesso em ${timestamp}.\n\nSe você recebeu esta mensagem, o serviço de envio está pronto para enviar e-mails de recuperação de senha.`;
  const html = `<!doctype html><html lang="pt-BR"><body style="background:#f6f5f1;margin:0;padding:0;font-family:Arial,Helvetica,sans-serif;color:#173c3d"><table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background:#f6f5f1;padding:32px 12px"><tr><td align="center"><table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="max-width:600px;background:#fff;border:1px solid #dfe6e2;border-radius:12px;overflow:hidden"><tr><td style="padding:36px 40px 32px"><p style="font-size:16px;line-height:1.6;margin:0 0 18px">Olá!</p><h1 style="font-size:25px;line-height:1.25;font-weight:600;margin:0 0 18px;color:#173c3d">Teste de configuração de e-mail</h1><p style="font-size:15px;line-height:1.7;color:#607674;margin:0 0 24px">A configuração da Tatuí Imóveis foi validada com sucesso em ${escapeHtml(timestamp)}.</p><table role="presentation" cellpadding="0" cellspacing="0" align="center" style="margin:0 auto 24px"><tr><td align="center" bgcolor="#e5651c" style="border-radius:7px"><span style="display:inline-block;color:#fff;font-size:15px;font-weight:700;padding:14px 22px">Envio confirmado</span></td></tr></table><p style="font-size:13px;line-height:1.6;color:#607674;margin:0">Se você recebeu esta mensagem, o serviço está pronto para enviar os e-mails de recuperação de senha.</p></td></tr><tr><td align="center" bgcolor="#173c3d" style="padding:10px 20px"><img src="cid:${logoCid}" width="240" alt="Tatuí Imóveis — O portal de imóveis de Tatuí" style="display:block;margin:0 auto;height:auto;border:0"></td></tr></table></td></tr></table></body></html>`;
  return { to: email, subject: 'Teste de configuração de e-mail | Tatuí Imóveis', text, html };
}

async function sendWithSendGrid(message, config) {
  const publicUrl = String(config.APP_PUBLIC_URL || process.env.APP_PUBLIC_URL || '').replace(/\/$/, '');
  if (!/^https:\/\//i.test(publicUrl)) throw new Error('APP_PUBLIC_URL HTTPS não configurada para o logo do e-mail.');
  const hostedLogo = `${publicUrl}/assets/tatui-imoveis-logo-email.png`;
  const html = message.html.replace(/cid:tatui-imoveis-logo@tatuiimoveis\.com\.br/g, escapeHtml(hostedLogo));
  const payload = { personalizations: [{ to: [{ email: message.to }] }], from: { email: config.SMTP_FROM }, subject: message.subject, content: [{ type: 'text/plain', value: message.text }, { type: 'text/html', value: html }] };
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  try {
    const response = await fetch('https://api.sendgrid.com/v3/mail/send', { method: 'POST', headers: { Authorization: `Bearer ${config.SENDGRID_API_KEY}`, 'Content-Type': 'application/json' }, body: JSON.stringify(payload), signal: controller.signal });
    if (!response.ok) { const body = await response.text(); const error = new Error(`SendGrid recusou o envio (${response.status}).`); error.code = 'SENDGRID_API_ERROR'; error.responseCode = response.status; error.response = body.slice(0, 500); throw error; }
    return { messageId: response.headers.get('x-message-id') || null };
  } catch (error) {
    if (error.name === 'AbortError') { error.code = 'ETIMEDOUT'; error.response = 'Timeout na API SendGrid'; }
    throw error;
  } finally { clearTimeout(timer); }
}

async function sendPasswordResetEmail({ email, name, token }, config = process.env) {
  if (!emailConfigured(config)) throw new Error('Serviço de e-mail não configurado.');
  const message = passwordResetContent({ email, name, token }, config);
  if (emailProvider(config) === 'sendgrid') return sendWithSendGrid(message, config);
  const transporter = createMailer(config);
  if (!transporter) throw new Error('SMTP não configurado.');
  const logoPath = path.resolve(__dirname, '../../frontend/public/assets/tatui-imoveis-logo-email.png');
  return transporter.sendMail({
    from: config.SMTP_FROM,
    to: message.to, subject: message.subject, text: message.text, html: message.html,
    attachments: [logoAttachment()].filter(Boolean)
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
  if (code === 'SENDGRID_API_ERROR' && responseCode === 401) return { etapa: 'autenticação', codigo: String(responseCode), comando: null, mensagem: 'A chave do SendGrid foi rejeitada. Confira se ela está ativa e possui a permissão Mail Send.' };
  if (code === 'SENDGRID_API_ERROR' && responseCode === 403) return { etapa: 'remetente', codigo: String(responseCode), comando: null, mensagem: 'O SendGrid recusou o remetente. Verifique a autenticação do domínio ou a autorização do endereço de envio.' };
  if (code === 'EENVELOPE' || responseCode === 550 || responseCode === 553) {
    return { etapa: 'remetente', codigo: code || String(responseCode), comando: command, mensagem: 'O provedor rejeitou o remetente ou destinatário. Use um remetente autorizado e com o mesmo domínio da conta SMTP.' };
  }
  return { etapa: 'envio', codigo: code || String(responseCode || 'SMTP_ERROR'), comando: command, mensagem: 'O provedor recusou o envio. Confira os dados SMTP, a autenticação do domínio e os registros SPF/DKIM.' };
}

async function sendTestEmail({ email }, config = process.env) {
  const timestamp = new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
  if (!emailConfigured(config)) throw new Error('Serviço de e-mail não configurado.');
  const message = testEmailContent({ email, timestamp });
  if (emailProvider(config) === 'sendgrid') return sendWithSendGrid(message, config);
  const transporter = createMailer(config);
  await transporter.verify();
  return transporter.sendMail({ from: config.SMTP_FROM, ...message, attachments: [logoAttachment()].filter(Boolean) });
}

module.exports = { createMailer, sendPasswordResetEmail, sendTestEmail, diagnoseSmtpError, smtpConfigured, sendGridConfigured, emailConfigured, emailProvider, sendWithSendGrid };
