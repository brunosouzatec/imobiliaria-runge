const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.resolve(__dirname, '../../..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');

test('página Vue carrega a dependência compartilhada de camadas antes dos componentes', () => {
  const html = read('apps/frontend/public/react.html');
  assert.ok(html.indexOf('/shared/map-layers.js') < html.indexOf('vue-app.js'));
});

test('política pública distingue títulos numerados de parágrafos e não interpreta HTML do conteúdo', () => {
  const html = read('apps/frontend/public/privacidade.html');
  assert.match(html, /const isHeading = \/\^\\d\+/);
  assert.match(html, /createElement\(isHeading \? 'h2' : 'p'\)/);
  assert.match(html, /element\.textContent = line/);
  assert.doesNotMatch(html, /innerHTML\s*=/);
});

test('ajustes móveis administrativos mantêm o conteúdo no viewport e empilham os painéis', () => {
  const css = read('apps/frontend/public/admin-ux.css');
  assert.match(css, /\.admin-shell,\s*\.admin-shell > \*,\s*\.admin-content/);
  assert.match(css, /\.admin-columns\s*\{\s*grid-template-columns: minmax\(0, 1fr\)/);
  assert.match(css, /\.admin-form-grid,\s*\.admin-opportunity-grid,\s*\.admin-policy-grid/);
  assert.match(css, /overscroll-behavior-x: contain/);
});

test('detalhes aproveitam Full HD, mostram fotos antes dos valores no celular e evitam ícone quebrado', () => {
  const css = read('apps/frontend/public/react-pages.css');
  const app = read('apps/frontend/public/vue-app.js');
  assert.match(css, /@media \(min-width: 1101px\)\s*\{\s*\.property-detail \{ max-width: 100%/);
  assert.match(css, /@media \(max-width: 720px\)\s*\{\s*\.property-detail-main \{ order: 0; \}\s*\.property-detail-sidebar \{ order: 1; \}/);
  assert.match(css, /url\('\/assets\/phosphor\/file-text\.svg'\)/);
  assert.ok(fs.existsSync(path.join(root, 'apps/frontend/public/assets/phosphor/file-text.svg')));
});

test('cadastro de imóvel usa texto correto e oportunidades formatam áreas no padrão brasileiro', () => {
  const app = read('apps/frontend/public/vue-app.js');
  const detail = read('apps/frontend/public/oportunidade.js');
  const admin = read('apps/frontend/public/admin.js');
  assert.match(app, /publicar seu imóvel no Tatuí Imóveis/);
  assert.match(app, /publicar uma nova oportunidade no Tatuí Imóveis/);
  assert.match(detail, /toLocaleString\('pt-BR', \{ maximumFractionDigits: 1 \}\)/);
  assert.match(admin, /dataset\.areaLocalized = 'true'/);
  assert.match(admin, /dataset\.phosphor = \['house', 'ruler', 'currency-circle-dollar'\]/);
});
