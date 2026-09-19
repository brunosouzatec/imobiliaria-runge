const test = require('node:test');
const assert = require('node:assert/strict');
const { diagnoseSmtpError, smtpConfigured } = require('../src/mailer');

test('SMTP é considerado configurado somente com os dados essenciais', () => {
  assert.equal(smtpConfigured({ SMTP_HOST: 'smtp.example.com', SMTP_USER: 'user@example.com', SMTP_PASS: 'secret', SMTP_FROM: 'user@example.com' }), true);
  assert.equal(smtpConfigured({ SMTP_HOST: 'smtp.example.com', SMTP_USER: 'user@example.com', SMTP_FROM: 'user@example.com' }), false);
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
