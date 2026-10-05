const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.resolve(__dirname, '../../..');
const server = fs.readFileSync(path.join(root, 'apps/backend/src/server.js'), 'utf8');
const app = fs.readFileSync(path.join(root, 'apps/frontend/public/vue-app.js'), 'utf8');
const admin = fs.readFileSync(path.join(root, 'apps/frontend/public/admin.js'), 'utf8');
const page = fs.readFileSync(path.join(root, 'apps/frontend/public/termos-corretor-parceiro.html'), 'utf8');

test('partner terms page and content APIs are separate and administered independently', () => {
  assert.match(server, /termos_corretor_parceiro/);
  assert.match(server, /\['\/termos-corretor-parceiro\.html', '\/termos-corretor-parceiro'\]/);
  assert.match(admin, /Termos do corretor parceiro/);
  assert.match(admin, /api\/admin\/conteudos\/termos_corretor_parceiro/);
  assert.match(page, /api\/conteudos\/termos_corretor_parceiro/);
  assert.match(page, /textContent = line/);
});

test('professional account creation requires and records the current partner agreement', () => {
  assert.match(app, /v-model="aceiteTermosCorretorParceiro" type="checkbox" required/);
  assert.match(app, /4,15% destinados ao Corretor responsável/);
  assert.match(app, /1,85% destinados à Corretora de Imóveis Drielly Runge/);
  assert.match(app, /termos-corretor-parceiro\.html/);
  assert.match(server, /function isProfessionalPartner/);
  assert.match(server, /termos_corretor_parceiro_versao/);
  assert.match(server, /INSERT INTO usuario_termo_aceites \(usuario_id,chave_termo,versao_termos,conteudo_termos\)/);
  assert.match(server, /Number\(data\.termos_corretor_parceiro_versao\) !== Number\(current\.versao\)/);
});

test('partner checkbox applies only to broker and real-estate company registration', () => {
  assert.match(app, /\['corretor', 'imobiliaria'\]/);
  assert.match(server, /normalized === 'corretor' \|\| normalized === 'imobiliaria'/);
  assert.match(app, /ehParceiroProfissional" class="owner-terms-consent partner-terms-consent/);
});
