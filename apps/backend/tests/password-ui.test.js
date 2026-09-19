const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const frontend = fs.readFileSync(path.resolve(__dirname, '../../frontend/public/vue-app.js'), 'utf8');
const admin = fs.readFileSync(path.resolve(__dirname, '../../frontend/public/admin.js'), 'utf8');

test('redefinição de senha mantém o padrão de força e confirmação do cadastro', () => {
  assert.match(frontend, /const senhaForca = computed\(\(\) => \{ const valor = senha\.value/);
  assert.match(frontend, /senhaForca\.criterios\.tamanho/);
  assert.match(frontend, /senhaForca\.criterios\.maiuscula/);
  assert.match(frontend, /senhaForca\.criterios\.minuscula/);
  assert.match(frontend, /senhaForca\.criterios\.numero/);
  assert.match(frontend, /As senhas coincidem\./);
  assert.match(frontend, /passwordEyeIcons\('mostrarSenha'\)/);
  assert.match(frontend, /passwordEyeIcons\('mostrarConfirmacao'\)/);
});

test('senha SMTP administrativa também possui controle de mostrar e ocultar', () => {
  assert.match(admin, /id="smtp-pass" type="password"/);
  assert.match(admin, /class="password-toggle" aria-label="Mostrar senha"/);
  assert.match(admin, /admin-content \.password-toggle/);
});
