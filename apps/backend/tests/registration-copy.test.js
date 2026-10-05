const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const app = fs.readFileSync(path.resolve(__dirname, '../../frontend/public/vue-app.js'), 'utf8');
const styles = fs.readFileSync(path.resolve(__dirname, '../../frontend/public/react-pages.css'), 'utf8');

test('registration introduction describes account creation until the property stage', () => {
  assert.ok(app.includes('Vamos começar pelo seu perfil.'));
  assert.ok(app.includes('Crie sua conta.'));
  assert.ok(app.includes('Preencha seus dados para criar sua conta e acessar sua área de usuário.'));
  assert.ok(app.includes('Informe as características, a localização e as fotos do imóvel que deseja anunciar.'));
  assert.ok(app.includes('class="registration-consents"'));
  assert.ok(styles.includes('.registration-consents .owner-terms-consent strong { font-weight: 400; }'));
});
