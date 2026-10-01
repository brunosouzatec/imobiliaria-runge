const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const publicRoot = path.resolve(__dirname, '../../frontend/public');
const server = fs.readFileSync(path.resolve(__dirname, '../src/server.js'), 'utf8');
const admin = fs.readFileSync(path.join(publicRoot, 'admin.js'), 'utf8');
const terms = fs.readFileSync(path.join(publicRoot, 'termos-de-uso.html'), 'utf8');

test('terms page uses the privacy page layout and safely renders editable plain text', () => {
  assert.match(terms, /class="react-page privacy-page"/);
  assert.match(terms, /SiteChrome\.mount\(document, 'terms'\)/);
  assert.match(terms, /fetch\('\/api\/conteudos\/termos_uso'\)/);
  assert.match(terms, /element\.textContent = line/);
  assert.match(terms, /Regras de utilização/);
});

test('terms content has separate public and administrator APIs with an explicit key allowlist', () => {
  assert.ok(server.includes('(politica_privacidade|termos_uso)'));
  assert.match(admin, /data-tab="terms">Termos de uso/);
  assert.match(admin, /\/api\/admin\/conteudos\/termos_uso/);
  assert.match(admin, /id="save-terms"/);
  assert.match(admin, /termos de uso\/i, 'description'/);
});

test('new advertiser registration requires terms acceptance and stores the accepted version and time', () => {
  const app = fs.readFileSync(path.join(publicRoot, 'vue-app.js'), 'utf8');
  assert.match(app, /v-model="perfil\.aceite_termos" type="checkbox" required/);
  assert.match(app, /href="termos-de-uso\.html"[^>]*>Termos de Uso/);
  assert.match(server, /data\.aceite_termos === true \|\| data\.aceite_termos === 'true'/);
  assert.match(server, /termos_uso_versao,termos_uso_aceita_em/);
  assert.match(server, /String\(terms\.versao\)/);
});
