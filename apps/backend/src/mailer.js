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
  const safeLogoUrl = escapeHtml(`${baseUrl}/assets/tatui-imoveis-share.png`);
  return transporter.sendMail({
    from: config.SMTP_FROM,
    to: email,
    subject: 'Recuperação de senha | Tatuí Imóveis',
    text: `Olá${name ? `, ${name}` : ''}!\n\nRecebemos uma solicitação para alterar sua senha. Acesse o link abaixo em até 30 minutos:\n\n${link}\n\nSe você não solicitou essa alteração, ignore este e-mail.`,
    html: `<!doctype html><html lang="pt-BR"><body style="background:#f6f5f1;margin:0;padding:0;font-family:Arial,Helvetica,sans-serif;color:#173c3d"><table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background:#f6f5f1;padding:32px 12px"><tr><td align="center"><table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="max-width:600px;background:#fff;border:1px solid #dfe6e2;border-radius:12px;overflow:hidden"><tr><td style="padding:36px 40px 32px"><p style="font-size:16px;line-height:1.6;margin:0 0 18px">Olá${name ? `, ${safeName}` : ''}!</p><h1 style="font-size:25px;line-height:1.25;font-weight:600;margin:0 0 18px;color:#173c3d">Redefina sua senha</h1><p style="font-size:15px;line-height:1.7;color:#607674;margin:0 0 24px">Recebemos uma solicitação para alterar a senha da sua conta no Tatuí Imóveis.</p><table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 24px"><tr><td bgcolor="#e5651c" style="border-radius:7px"><a href="${safeLink}" style="display:inline-block;color:#fff;font-size:15px;font-weight:700;text-decoration:none;padding:14px 22px">Criar uma nova senha</a></td></tr></table><p style="font-size:13px;line-height:1.6;color:#607674;margin:0">Este link expira em 30 minutos. Se você não solicitou essa alteração, ignore este e-mail.</p></td></tr><tr><td align="center" bgcolor="#173c3d" style="padding:24px 20px"><img src="${safeLogoUrl}" width="240" alt="Tatuí Imóveis — O portal de imóveis de Tatuí" style="display:block;margin:0 auto;max-width:100%;height:auto;border:0"><p style="color:#b8cbc5;font-size:12px;line-height:1.5;margin:14px 0 0">O portal de imóveis de Tatuí.</p></td></tr></table></td></tr></table></body></html>`
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
