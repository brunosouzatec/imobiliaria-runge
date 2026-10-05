const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { PROPERTY_STATUSES, normalizePropertyStatus } = require('../src/property-status');
const migration = require('../migrations/019_property_status');

test('property status accepts only the five administrative values', () => {
  assert.deepEqual(PROPERTY_STATUSES, {
    em_negociacao: 'Em negociação',
    vendido: 'Vendido',
    reservado: 'Reservado',
    alugado: 'Alugado',
    disponivel: 'Disponível'
  });
  for (const status of Object.keys(PROPERTY_STATUSES)) assert.equal(normalizePropertyStatus(status), status);
  for (const status of ['publicado', '', null, '__proto__', 'vendido; DROP TABLE imoveis']) assert.equal(normalizePropertyStatus(status), null);
});

test('property status migration defaults existing and new properties to available and is repeat-safe', async () => {
  const statements = [];
  await migration.up({ query: async sql => { statements.push(sql); return [[{ total: 0 }]]; } });
  assert.equal(statements.length, 2);
  assert.match(statements[1], /status VARCHAR\(24\) NOT NULL DEFAULT 'disponivel'/);
  statements.length = 0;
  await migration.up({ query: async sql => { statements.push(sql); return [[{ total: 1 }]]; } });
  assert.equal(statements.length, 1);
});

test('property status is editable only through the authenticated admin action and appears as an image stamp', () => {
  const server = fs.readFileSync(path.resolve(__dirname, '../src/server.js'), 'utf8');
  const admin = fs.readFileSync(path.resolve(__dirname, '../../frontend/public/admin.js'), 'utf8');
  const vue = fs.readFileSync(path.resolve(__dirname, '../../frontend/public/vue-app.js'), 'utf8');
  const styles = fs.readFileSync(path.resolve(__dirname, '../../frontend/public/react-pages.css'), 'utf8');
  const statusRoute = server.slice(server.indexOf('const adminPropertyStatus'), server.indexOf('const adminProperty ='));
  assert.ok(statusRoute.includes('adminUser(req, res)'));
  assert.ok(statusRoute.includes('normalizePropertyStatus(data?.status)'));
  assert.ok(statusRoute.includes("req.method === 'PATCH'"));
  assert.match(admin, /data-property-status=/);
  assert.match(admin, /property-status-watermark/);
  assert.match(admin, /property-status-\$\{esc\(status\)\}/);
  assert.match(vue, /property-status-watermark/);
  assert.equal((vue.match(/item\.status && item\.status !== \\'disponivel\\'/g) || []).length, 4);
  assert.match(styles, /\.property-status-watermark/);
  assert.match(styles, /border-radius: 50%/);
  assert.match(styles, /content: "TATUÍ IMÓVEIS"/);
  const adminStyles = fs.readFileSync(path.resolve(__dirname, '../../frontend/public/admin.css'), 'utf8');
  assert.match(adminStyles, /\.admin-property-card\{[^}]*height:auto;min-height:340px\}/);
  assert.match(adminStyles, /\.admin-property-media img\{height:100%;inset:0;min-height:0;position:absolute;width:100%\}/);
  assert.match(adminStyles, /\.admin-property-actions\{margin-top:12px/);
  assert.match(adminStyles, /\.admin-property-status-control select\{appearance:auto/);
  assert.match(adminStyles, /\.admin-property-status-control select option\{background:#fff;color:#173b3b/);
  assert.match(adminStyles, /\.admin-property-status-control\{[^}]*margin-top:7px/);
  assert.match(adminStyles, /border-radius:50%/);
  assert.match(adminStyles, /content:"STATUS DO ANÚNCIO"/);
});
