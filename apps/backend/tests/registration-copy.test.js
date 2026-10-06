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
  assert.ok(app.includes('class="registration-accept-all"'));
  assert.ok(app.includes('Aceitar todos <small>Política de Privacidade e Termos de Uso</small>'));
  assert.ok(app.includes('state.perfil.value.aceite_privacidade = Boolean(aceito)'));
  assert.ok(app.includes('state.perfil.value.aceite_termos = Boolean(aceito)'));
  assert.ok(styles.includes('.registration-consents .owner-terms-consent strong { font-weight: 400; }'));
  assert.ok(styles.includes('.registration-consents .registration-accept-all'));
});

test('cadastro trata respostas vazias ou não JSON sem expor erro de parse', () => {
  assert.match(app, /const responseText = await response\.text\(\)/);
  assert.match(app, /responseText\.trim\(\) \? JSON\.parse\(responseText\) : \{\}/);
  assert.match(app, /HTTP \$\{response\.status\}/);
  assert.match(app, /Confira se consegue entrar com o e-mail informado antes de tentar novamente/);
});

test('entrada para novo anunciante tem chamada de ação visualmente destacada e mantém o fluxo do cadastro', () => {
  assert.match(app, /class="login-register-promo"/);
  assert.match(app, /class="login-register-cta" href="cadastro\.html\?novo=conta&amp;fluxo=anunciar"/);
  assert.match(app, /Criar conta para anunciar/);
  assert.match(styles, /\.login-register-cta\s*\{[^}]*background: var\(--accent\)[^}]*min-height: 58px/);
  assert.match(styles, /\.login-register-cta:focus-visible/);
});

test('recuperação de senha continua acessível na tela de login junto ao novo CTA', () => {
  assert.match(app, /class="login-forgot-password"><a href="recuperar-senha\.html">Esqueci minha senha<\/a><\/p>/);
  assert.match(styles, /\.login-forgot-password\s*\{/);
});
