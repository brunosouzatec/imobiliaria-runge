const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.resolve(__dirname, '../..', '..');
const server = fs.readFileSync(path.join(root, 'apps/backend/src/server.js'), 'utf8');
const app = fs.readFileSync(path.join(root, 'apps/frontend/public/vue-app.js'), 'utf8');
const css = fs.readFileSync(path.join(root, 'apps/frontend/public/react-pages.css'), 'utf8');
const admin = fs.readFileSync(path.join(root, 'apps/frontend/public/admin.js'), 'utf8');
const adminHtml = fs.readFileSync(path.join(root, 'apps/frontend/public/admin.html'), 'utf8');
const adminCss = fs.readFileSync(path.join(root, 'apps/frontend/public/admin.css'), 'utf8');
const adminUxCss = fs.readFileSync(path.join(root, 'apps/frontend/public/admin-ux.css'), 'utf8');
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
  assert.match(server, /url\.pathname === '\/api\/imoveis' && req\.method === 'GET'[\s\S]*?SELECT \* FROM imoveis ORDER BY id DESC/);
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

test('cards administrativos seguem o padrão do anunciante e exibem características e métricas completas', () => {
  const routeStart = server.indexOf("if (url.pathname === '/api/admin/imoveis' && req.method === 'GET')");
  const routeEnd = server.indexOf('const adminProperty =', routeStart);
  const adminRoute = server.slice(routeStart, routeEnd);
  assert.match(adminRoute, /const admin = await adminUser\(req, res\)/);
  assert.match(adminRoute, /AS total_visualizacoes/);
  assert.match(adminRoute, /AS total_compartilhamentos/);
  assert.match(adminRoute, /AS total_interesses/);
  assert.match(adminRoute, /properties\[index\]\.metricas = \{/);
  assert.match(adminRoute, /compartilhamentos: Number\(rows\[index\]\.total_compartilhamentos/);
  assert.match(adminRoute, /interesses: Number\(rows\[index\]\.total_interesses/);
  assert.match(admin, /characteristics\?\.summary\(characteristics\.list\(item\.caracteristicas\)\)/);
  assert.match(admin, /class="admin-property-feature-list"/);
  assert.match(admin, /class="owner-property-stats admin-property-stats"/);
  assert.match(admin, /metrics\.visualizacoes/);
  assert.match(admin, /metrics\.compartilhamentos/);
  assert.match(admin, /metrics\.interesses/);
  assert.match(adminHtml, /shared\/property-characteristics\.js/);
  assert.match(adminHtml, /shared\/property-offers\.js/);
  assert.match(adminCss, /\.admin-property-stats \.owner-property-stat/);
});

test('listas da visão geral mostram ID clicável para os detalhes do imóvel', () => {
  const dashboard = admin.slice(admin.indexOf('function dashboard()'), admin.indexOf('function properties()'));
  assert.match(dashboard, /<th>ID<\/th>/);
  assert.match(dashboard, /ultimos\.map\(item => `<tr><td>\$\{propertyLink\(item\)\}/);
  assert.match(dashboard, /populares\.map\(item => `<tr><td>\$\{propertyLink\(item\)\}/);
  assert.match(dashboard, /href="\/imovel\?id=\$\{encodeURIComponent\(item\.id\)\}"/);
  assert.match(adminUxCss, /\.admin-dashboard-property-link/);
});

test('painel administrativo permite filtrar por mês e compara acessos e interesses diariamente', () => {
  const routeStart = server.indexOf("if (url.pathname === '/api/admin/dashboard' && req.method === 'GET')");
  const routeEnd = server.indexOf("if (url.pathname === '/api/admin/oportunidades'", routeStart);
  const dashboardRoute = server.slice(routeStart, routeEnd);
  assert.match(dashboardRoute, /url\.searchParams\.get\('mes'\)/);
  assert.match(dashboardRoute, /requestedMonth && !\//);
  assert.match(dashboardRoute, /created_at >= \? AND created_at < \?/);
  assert.match(dashboardRoute, /serieDiaria/);
  assert.match(dashboardRoute, /periodo: period/);
  assert.match(dashboardRoute, /mesAtual: currentMonth/);
  assert.match(admin, /id="dashboard-month" type="month"/);
  assert.match(admin, /new window\.Chart\(chartContext/);
  assert.match(admin, /admin-activity-chart/);
  assert.match(admin, /role="img" aria-label="Gráfico de linhas/);
  assert.match(admin, /yAxisID: 'yViews'/);
  assert.match(admin, /yAxisID: 'yInterests'/);
  assert.match(admin, /api\('\/api\/admin\/dashboard\?mes='/);
  assert.match(adminHtml, /vendor\/chart\.umd\.min\.js/);
  assert.match(adminUxCss, /\.admin-dashboard-chart-canvas canvas/);
  assert.match(JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8')).dependencies['chart.js'], /^4\.5\.1$/);
  assert.ok(fs.existsSync(path.join(root, 'apps/frontend/public/vendor/chart.umd.min.js')));
});

test('contador de compartilhamentos tem índice e segue a exclusão do anúncio', async () => {
  const statements = [];
  await migration.up({ query: async sql => { statements.push(sql); } });
  assert.equal(statements.length, 1);
  assert.match(statements[0], /CREATE TABLE IF NOT EXISTS imovel_compartilhamentos/);
  assert.match(statements[0], /INDEX idx_imovel_compartilhamentos_imovel_data \(imovel_id, created_at\)/);
  assert.match(statements[0], /FOREIGN KEY \(imovel_id\) REFERENCES imoveis\(id\) ON DELETE CASCADE/);
});
