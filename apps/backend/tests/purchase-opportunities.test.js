const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.resolve(__dirname, '../../..');
const server = fs.readFileSync(path.join(root, 'apps/backend/src/server.js'), 'utf8');
const migration = fs.readFileSync(path.join(root, 'apps/backend/migrations/011_purchase_opportunities.js'), 'utf8');
const locationMigration = fs.readFileSync(path.join(root, 'apps/backend/migrations/012_opportunity_location_types.js'), 'utf8');
const admin = fs.readFileSync(path.join(root, 'apps/frontend/public/admin.js'), 'utf8');

test('oportunidades possuem migration própria e status controlado', () => {
  assert.match(migration, /CREATE TABLE IF NOT EXISTS oportunidades_compra/);
  assert.match(migration, /status ENUM\('rascunho','publicada','atendida','expirada','cancelada'\)/);
  assert.match(migration, /fk_oportunidades_admin/);
});

test('API pública publica somente oportunidades vigentes e oferece filtro por tipo e texto', () => {
  assert.match(server, /url\.pathname === '\/api\/oportunidades' && req\.method === 'GET'/);
  assert.match(server, /status=\?'.*expira_em IS NULL OR expira_em>=CURRENT_DATE/);
  assert.match(server, /tipo_imovel=\?/);
  assert.match(server, /descricao LIKE \?/);
});

test('oportunidades suportam localização hierárquica, múltiplos tipos e faixas de área', () => {
  assert.match(locationMigration, /ADD COLUMN estado VARCHAR\(2\)/);
  assert.match(locationMigration, /ADD COLUMN tipos_imovel JSON/);
  assert.match(locationMigration, /CREATE TABLE IF NOT EXISTS oportunidade_tipos_imovel/);
  assert.match(server, /configuredOpportunityTypes/);
  assert.match(server, /JSON_CONTAINS\(COALESCE\(tipos_imovel/);
  assert.match(server, /url\.pathname === '\/api\/admin\/oportunidades\/tipos' && req\.method === 'POST'/);
  assert.match(admin, /op-property-type/);
  assert.match(admin, /id="op-state"/);
  assert.match(admin, /montarAutocomplete/);
  assert.match(admin, /admin-autocomplete-menu/);
  assert.match(admin, /id="op-area-min"/);
  assert.match(admin, /id="op-area-max"/);
  assert.match(admin, /add-opportunity-type/);
});

test('bairro usa consulta temporária do Mapbox sem persistir nem armazenar respostas em cache', () => {
  const server = fs.readFileSync(path.join(root, 'apps/backend/src/server.js'), 'utf8');
  const lookup = server.slice(server.indexOf('async function buscarBairrosMapbox'), server.indexOf('async function carregarBairrosCatalogo'));
  assert.match(lookup, /permanent:\s*'false'/);
  assert.doesNotMatch(lookup, /INSERT INTO|localidadesBairroCache|localidades_bairros/);
  assert.match(server, /SELECT DISTINCT bairro AS nome FROM imoveis/);
});

test('administração oferece criação, alteração de status, exclusão e auditoria', () => {
  assert.match(server, /url\.pathname === '\/api\/admin\/oportunidades' && req\.method === 'POST'/);
  assert.match(server, /adminOpportunity && req\.method === 'PATCH'/);
  assert.match(server, /adminOpportunity && req\.method === 'DELETE'/);
  assert.match(server, /audit\(adminId, updating \? 'editar' : 'criar', 'oportunidade'/);
  assert.match(admin, /data-tab="opportunities"/);
  assert.match(admin, /Oportunidades de compra/);
  assert.match(admin, /name="op-transaction" value="Venda"/);
  assert.match(admin, /name="op-transaction" value="Aluguel"/);
  assert.match(admin, /name="op-transaction" value="Permuta"/);
  assert.match(server, /\['Venda', 'Aluguel', 'Permuta'\]/);
});

test('listagem e detalhe públicos existem e usam contato contextual', () => {
  assert.ok(fs.existsSync(path.join(root, 'apps/frontend/public/oportunidades.html')));
  assert.ok(fs.existsSync(path.join(root, 'apps/frontend/public/oportunidade.html')));
  const opportunities = fs.readFileSync(path.join(root, 'apps/frontend/public/oportunidades.js'), 'utf8');
  assert.match(opportunities, /api\/oportunidades/);
  assert.match(opportunities, /op-card-header/);
  assert.match(opportunities, /op-card-stat/);
  assert.match(fs.readFileSync(path.join(root, 'apps/frontend/public/admin.js'), 'utf8'), /admin-opportunity-facts/);
  assert.match(fs.readFileSync(path.join(root, 'apps/frontend/public/oportunidade.js'), 'utf8'), /Tenho um imóvel compatível/);
  assert.match(fs.readFileSync(path.join(root, 'apps/backend/src/server.js'), 'utf8'), /\['\/oportunidades\.html', '\/oportunidades'\]/);
});

test('páginas públicas reutilizam o chrome compartilhado do portal', () => {
  const chrome = fs.readFileSync(path.join(root, 'apps/frontend/public/site-chrome.js'), 'utf8');
  assert.match(chrome, /function header/);
  assert.match(chrome, /function footer/);
  assert.match(chrome, /Política de Privacidade/);
  for (const file of ['oportunidades.html', 'oportunidade.html', 'privacidade.html', 'manutencao.html']) {
    const source = fs.readFileSync(path.join(root, 'apps/frontend/public', file), 'utf8');
    assert.match(source, /site-chrome\.js/);
    assert.match(source, /data-site-header/);
    assert.match(source, /data-site-footer/);
  }
  const opportunities = fs.readFileSync(path.join(root, 'apps/frontend/public/oportunidades.js'), 'utf8');
  const detail = fs.readFileSync(path.join(root, 'apps/frontend/public/oportunidade.js'), 'utf8');
  assert.doesNotMatch(opportunities, /class="op-header"/);
  assert.doesNotMatch(detail, /class="op-header"/);
  const vue = fs.readFileSync(path.join(root, 'apps/frontend/public/vue-app.js'), 'utf8');
  assert.match(vue, /const Footer/);
  assert.match(vue, /<Footer\/>/);
  assert.match(vue, /href="oportunidades\.html">Oportunidades/);
});
