const test = require('node:test');
const assert = require('node:assert/strict');
const { createMailer, diagnoseSmtpError, smtpConfigured, sendGridConfigured, emailConfigured, emailProvider, sendWithSendGrid } = require('../src/mailer');

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
    const result = await sendWithSendGrid({ to: 'teste@example.com', subject: 'Teste', text: 'Texto', html: '<p>Texto</p>' }, { SENDGRID_API_KEY: 'SG.secret', SMTP_FROM: 'noreply@tatuiimoveis.com.br' });
    assert.equal(result.messageId, 'sg-message-id');
    assert.equal(request.url, 'https://api.sendgrid.com/v3/mail/send');
    assert.equal(request.options.headers.Authorization, 'Bearer SG.secret');
    assert.match(request.options.body, /"email":"teste@example.com"/);
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

test('mailer encerra conexões SMTP que não respondem', () => {
  const transporter = createMailer({
    SMTP_HOST: 'smtp.example.com', SMTP_PORT: 465, SMTP_SECURE: true,
    SMTP_USER: 'user@example.com', SMTP_PASS: 'secret', SMTP_FROM: 'user@example.com'
  });
  assert.equal(transporter.options.connectionTimeout, 15000);
  assert.equal(transporter.options.greetingTimeout, 10000);
  assert.equal(transporter.options.socketTimeout, 20000);
});
