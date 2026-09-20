const test = require('node:test');
const assert = require('node:assert/strict');
const { createMailer, diagnoseSmtpError, smtpConfigured, sendGridConfigured, emailConfigured, emailProvider, sendWithSendGrid, sendTestEmail } = require('../src/mailer');

test('SMTP é considerado configurado somente com os dados essenciais', () => {
  assert.equal(smtpConfigured({ SMTP_HOST: 'smtp.example.com', SMTP_USER: 'user@example.com', SMTP_PASS: 'secret', SMTP_FROM: 'user@example.com' }), true);
  assert.equal(smtpConfigured({ SMTP_HOST: 'smtp.example.com', SMTP_USER: 'user@example.com', SMTP_FROM: 'user@example.com' }), false);
});

test('SendGrid usa somente chave da API e remetente', () => {
  const config = { EMAIL_PROVIDER: 'sendgrid', SENDGRID_API_KEY: 'SG.secret', SMTP_FROM: 'noreply@tatuiimoveis.com.br' };
  assert.equal(sendGridConfigured(config), true);
  assert.equal(emailConfigured(config), true);
  assert.equal(emailProvider(config), 'sendgrid');
  assert.equal(sendGridConfigured({ ...config, SENDGRID_API_KEY: '' }), false);
});

test('SendGrid envia payload Web API com Bearer sem expor a chave', async () => {
  const originalFetch = global.fetch;
  let request;
  global.fetch = async (url, options) => { request = { url, options }; return { ok: true, status: 202, headers: { get: () => 'sg-message-id' } }; };
  try {
    const result = await sendWithSendGrid({ to: 'teste@example.com', subject: 'Teste', text: 'Texto', html: '<img src="cid:tatui-imoveis-logo@tatuiimoveis.com.br">' }, { SENDGRID_API_KEY: 'SG.secret', SMTP_FROM: 'noreply@tatuiimoveis.com.br', APP_PUBLIC_URL: 'https://tatuiimoveis.com.br' });
    assert.equal(result.messageId, 'sg-message-id');
    assert.equal(request.url, 'https://api.sendgrid.com/v3/mail/send');
    assert.equal(request.options.headers.Authorization, 'Bearer SG.secret');
    assert.match(request.options.body, /"email":"teste@example.com"/);
    assert.match(request.options.body, /https:\/\/tatuiimoveis\.com\.br\/assets\/tatui-imoveis-logo-email\.png/);
    assert.doesNotMatch(request.options.body, /attachments/);
  } finally { global.fetch = originalFetch; }
});

test('SendGrid aceita URL pública de e-mail separada da URL local da aplicação', async () => {
  const originalFetch = global.fetch;
  let request;
  global.fetch = async (_url, options) => { request = JSON.parse(options.body); return { ok: true, status: 202, headers: { get: () => null } }; };
  try {
    await sendWithSendGrid({ to: 'teste@example.com', subject: 'Teste', text: 'Texto', html: '<img src="cid:tatui-imoveis-logo@tatuiimoveis.com.br">' }, { SENDGRID_API_KEY: 'SG.secret', SMTP_FROM: 'noreply@tatuiimoveis.com.br', APP_PUBLIC_URL: 'http://localhost:3000', EMAIL_PUBLIC_URL: 'https://tatuiimoveis.com.br' });
    assert.match(request.content[1].value, /https:\/\/tatuiimoveis\.com\.br\/assets\/tatui-imoveis-logo-email\.png/);
  } finally { global.fetch = originalFetch; }
});

test('e-mail de teste do SendGrid usa o mesmo padrão visual do SMTP', async () => {
  const originalFetch = global.fetch;
  let payload;
  global.fetch = async (_url, options) => { payload = JSON.parse(options.body); return { ok: true, status: 202, headers: { get: () => null } }; };
  try {
    await sendTestEmail({ email: 'teste@example.com' }, { EMAIL_PROVIDER: 'sendgrid', SENDGRID_API_KEY: 'SG.secret', SMTP_FROM: 'noreply@tatuiimoveis.com.br', APP_PUBLIC_URL: 'https://tatuiimoveis.com.br' });
    const html = payload.content.find(item => item.type === 'text/html').value;
    assert.match(html, /Teste de configuração de e-mail/);
    assert.match(html, /bgcolor="#173c3d"/);
    assert.match(html, /https:\/\/tatuiimoveis\.com\.br\/assets\/tatui-imoveis-logo-email\.png/);
    assert.equal(payload.attachments, undefined);
  } finally { global.fetch = originalFetch; }
});

test('diagnóstico SMTP identifica falha de autenticação sem expor a senha', () => {
  const diagnostic = diagnoseSmtpError({ code: 'EAUTH', responseCode: 535, command: 'AUTH PLAIN', response: '5.7.8 invalid password' });
  assert.equal(diagnostic.etapa, 'autenticação');
  assert.match(diagnostic.mensagem, /senha de aplicativo/i);
  assert.doesNotMatch(JSON.stringify(diagnostic), /invalid password/i);
});

test('diagnóstico SMTP diferencia falha de conexão e configuração TLS', () => {
  assert.equal(diagnoseSmtpError({ code: 'ECONNREFUSED' }).etapa, 'conexão');
  assert.equal(diagnoseSmtpError({ code: 'ESOCKET' }).etapa, 'TLS/SSL');
});

test('diagnóstico SendGrid identifica chave inválida e remetente não autorizado', () => {
  assert.equal(diagnoseSmtpError({ code: 'SENDGRID_API_ERROR', responseCode: 401 }).etapa, 'autenticação');
  assert.equal(diagnoseSmtpError({ code: 'SENDGRID_API_ERROR', responseCode: 403 }).etapa, 'remetente');
});

test('diagnóstico SendGrid informa detalhes seguros de requisição inválida', () => {
  const diagnostic = diagnoseSmtpError({ code: 'SENDGRID_API_ERROR', responseCode: 400, response: JSON.stringify({ errors: [{ field: 'from.email', message: 'The from address does not match a verified Sender Identity.' }] }) });
  assert.equal(diagnostic.etapa, 'requisição');
  assert.match(diagnostic.mensagem, /from\.email/);
  assert.doesNotMatch(diagnostic.mensagem, /SG\.secret/);
});

test('mailer encerra conexões SMTP que não respondem', () => {
  const transporter = createMailer({
    SMTP_HOST: 'smtp.example.com', SMTP_PORT: 465, SMTP_SECURE: true,
    SMTP_USER: 'user@example.com', SMTP_PASS: 'secret', SMTP_FROM: 'user@example.com'
  });
  assert.equal(transporter.options.connectionTimeout, 15000);
  assert.equal(transporter.options.greetingTimeout, 10000);
  assert.equal(transporter.options.socketTimeout, 20000);
});
