const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.resolve(__dirname, '../../..');
const server = fs.readFileSync(path.join(root, 'apps/backend/src/server.js'), 'utf8');
const migration = fs.readFileSync(path.join(root, 'apps/backend/migrations/011_purchase_opportunities.js'), 'utf8');
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

test('administração oferece criação, alteração de status, exclusão e auditoria', () => {
  assert.match(server, /url\.pathname === '\/api\/admin\/oportunidades' && req\.method === 'POST'/);
  assert.match(server, /adminOpportunity && req\.method === 'PATCH'/);
  assert.match(server, /adminOpportunity && req\.method === 'DELETE'/);
  assert.match(server, /audit\(adminId, updating \? 'editar' : 'criar', 'oportunidade'/);
  assert.match(admin, /data-tab="opportunities"/);
  assert.match(admin, /Oportunidades de compra/);
});

test('listagem e detalhe públicos existem e usam contato contextual', () => {
  assert.ok(fs.existsSync(path.join(root, 'apps/frontend/public/oportunidades.html')));
  assert.ok(fs.existsSync(path.join(root, 'apps/frontend/public/oportunidade.html')));
  assert.match(fs.readFileSync(path.join(root, 'apps/frontend/public/oportunidades.js'), 'utf8'), /api\/oportunidades/);
  assert.match(fs.readFileSync(path.join(root, 'apps/frontend/public/oportunidade.js'), 'utf8'), /Tenho um imóvel compatível/);
  assert.match(fs.readFileSync(path.join(root, 'apps/backend/src/server.js'), 'utf8'), /\['\/oportunidades\.html', '\/oportunidades'\]/);
});
