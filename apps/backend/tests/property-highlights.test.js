const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.resolve(__dirname, '../..', '..');
const server = fs.readFileSync(path.join(root, 'apps/backend/src/server.js'), 'utf8');
const migration = fs.readFileSync(path.join(root, 'apps/backend/migrations/003_property_views.js'), 'utf8');
const home = fs.readFileSync(path.join(root, 'apps/frontend/public/home-highlights.js'), 'utf8');
const index = fs.readFileSync(path.join(root, 'apps/frontend/public/index.html'), 'utf8');
const styles = fs.readFileSync(path.join(root, 'apps/frontend/public/react.css'), 'utf8');

test('ranking mensal possui tabela, consulta e registro de visualizações', () => {
  assert.match(migration, /CREATE TABLE IF NOT EXISTS imovel_visualizacoes/);
  assert.match(migration, /FOREIGN KEY \(imovel_id\) REFERENCES imoveis\(id\) ON DELETE CASCADE/);
  assert.match(server, /\/api\/imoveis\/destaques/);
  assert.match(server, /DATE_FORMAT\(CURRENT_DATE, '%Y-%m-01'\)/);
  assert.match(server, /INSERT INTO imovel_visualizacoes \(imovel_id\)/);
});

test('home carrega destaques sem inserir dados de anúncios como HTML', () => {
  assert.match(index, /home-highlights\.js/);
  assert.match(home, /fetch\('\/api\/imoveis\/destaques\?limit=4'\)/);
  assert.match(home, /textContent/);
  assert.match(styles, /\.home-highlights-grid/);
});
