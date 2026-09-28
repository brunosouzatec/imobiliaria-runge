const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.resolve(__dirname, '../..', '..');
const server = fs.readFileSync(path.join(root, 'apps/backend/src/server.js'), 'utf8');
const app = fs.readFileSync(path.join(root, 'apps/frontend/public/vue-app.js'), 'utf8');
const css = fs.readFileSync(path.join(root, 'apps/frontend/public/react-pages.css'), 'utf8');
const migration = require('../migrations/012_property_shares');

test('indicadores dos anúncios só são agregados na resposta autenticada dos imóveis próprios', () => {
  assert.match(server, /FROM imoveis i WHERE i\.usuario_id=\? ORDER BY i\.id DESC/);
  assert.match(server, /AS total_visualizacoes/);
  assert.match(server, /AS total_compartilhamentos/);
  assert.match(server, /AS total_interesses/);
  assert.match(server, /imoveis\[index\]\.metricas = \{/);
  assert.match(server, /Number\(viewerId\) !== Number\(row\.usuario_id\)/);
  assert.match(server, /url\.pathname === '\/api\/minha-conta\/imoveis' && req\.method === 'GET'.*userPropertiesWithMetrics\(id\).*private, no-store/);
  const regularAccountPayload = server.slice(server.indexOf('async function userPayload'), server.indexOf('async function userPropertiesWithMetrics'));
  assert.doesNotMatch(regularAccountPayload, /total_visualizacoes|metricas/);
  assert.match(server, /url\.pathname === '\/api\/imoveis' && req\.method === 'GET'.*SELECT \* FROM imoveis ORDER BY id DESC/);
  assert.match(app, /fetch\('\/api\/minha-conta\/imoveis'\)/);
});

test('compartilhamentos concluídos são contabilizados com limitação e vínculo ao imóvel', () => {
  assert.match(server, /const propertyShare = url\.pathname\.match\(/);
  assert.match(server, /compartilhamentos\$\/\)/);
  assert.match(server, /rateLimit\(req, res, 'property-share', 30, 10 \* 60 \* 1000\)/);
  assert.match(server, /INSERT INTO imovel_compartilhamentos \(imovel_id\) VALUES \(\?\)/);
  assert.match(app, /function registrarCompartilhamento\(imovelId\)/);
  assert.match(app, /\['shared', 'copied', 'fallback'\]\.includes\(result\)\) void registrarCompartilhamento/);
  assert.match(app, /if \(\['shared', 'fallback'\]\.includes\(result\)\) void registrarCompartilhamento/);
});

test('cartão privado mostra os três totais apenas no contexto de Meus imóveis', () => {
  assert.match(app, /v-if="showEdit" class="owner-property-stats"/);
  assert.match(app, /item\.metricas\?\.visualizacoes/);
  assert.match(app, /item\.metricas\?\.compartilhamentos/);
  assert.match(app, /item\.metricas\?\.interesses/);
  assert.match(app, /Solicitações enviadas pelo formulário Tenho interesse/);
  assert.match(css, /\.owner-property-stats[\s\S]*?@media \(max-width: 520px\)/);
});

test('contador de compartilhamentos tem índice e segue a exclusão do anúncio', async () => {
  const statements = [];
  await migration.up({ query: async sql => { statements.push(sql); } });
  assert.equal(statements.length, 1);
  assert.match(statements[0], /CREATE TABLE IF NOT EXISTS imovel_compartilhamentos/);
  assert.match(statements[0], /INDEX idx_imovel_compartilhamentos_imovel_data \(imovel_id, created_at\)/);
  assert.match(statements[0], /FOREIGN KEY \(imovel_id\) REFERENCES imoveis\(id\) ON DELETE CASCADE/);
});
