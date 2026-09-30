const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.resolve(__dirname, '../../..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');

test('Material Symbols Rounded é local e compartilhado pelo site e administração', () => {
  const styles = read('apps/frontend/public/react.css');
  const icons = read('apps/frontend/public/material-icons.js');
  const server = read('apps/backend/src/server.js');
  const vue = read('apps/frontend/public/vue-app.js');
  assert.match(styles, /assets\/material-symbols-rounded\.woff2/);
  assert.match(icons, /material-symbol-icon/);
  assert.match(server, /\.woff2':'font\/woff2'/);
  assert.doesNotMatch(server, /phosphor-icons\.css|phosphorIconRoute/);
  assert.doesNotMatch(read('package.json'), /@phosphor-icons\/core/);
  assert.match(icons, /root\.matches\?\.\(selector\)/);
  assert.match(icons, /'⌖': 'location_on'.*'⌕': 'search'/);
  assert.match(icons, /filter\(element => !element\.closest\?\.\('#app'\)\)/);
  assert.match(vue, /function materializeVueIcons\(template\)/);
  assert.match(vue, /transformVueComponent\(Page\)/);
  assert.match(vue, /class="material-symbol-icon password-eye password-eye-open"/);
  assert.match(read('apps/frontend/public/admin.css'), /admin-header img\{display:block;height:auto;max-width:100%;width:100%\}/);
  assert.match(styles, /home-map-category-button strong\.material-symbol-icon\s*\{\s*background:\s*color-mix/);
});

test('controles de senha têm estados de olho distintos, inclusive no acesso administrativo', () => {
  const icons = read('apps/frontend/public/material-icons.js');
  const css = read('apps/frontend/public/react.css');
  const admin = read('apps/frontend/public/admin.js');
  assert.match(icons, /password-eye-open[\s\S]*?visibility/);
  assert.match(icons, /password-eye-closed[\s\S]*?visibility_off/);
  assert.match(css, /password-toggle:not\(\.is-visible\) \.password-eye-open \{ display: none; \}/);
  assert.match(css, /password-toggle\.is-visible \.password-eye-closed \{ display: none; \}/);
  assert.match(admin, /aria-label="Mostrar senha"[\s\S]*?password-eye-open[\s\S]*?password-eye-closed/);
});

test('ícones das características usam nomes válidos do catálogo Material Symbols', () => {
  const characteristics = require('../../../packages/shared/property-characteristics');
  const symbols = Object.values({
    area: 'square_foot', area_total: 'square_foot', area_construida: 'home_work', quartos: 'bed', suite: 'bedroom_parent',
    banheiros: 'bathtub', vagas: 'directions_car', quintal: 'yard', piscina: 'pool', churrasqueira: 'outdoor_grill',
    sacada: 'balcony', elevador: 'elevator', condominio: 'apartment', frente: 'straighten', topografia: 'terrain',
    agua: 'water_drop', energia: 'bolt', rua_asfaltada: 'add_road', area_verde: 'park', nascente: 'waves',
    salas: 'chair', acessibilidade: 'accessible', estacionamento: 'local_parking', ar_condicionado: 'ac_unit'
  });
  const actual = ['area', 'area_total', 'area_construida', 'quartos', 'suite', 'banheiros', 'vagas', 'quintal', 'piscina', 'churrasqueira', 'sacada', 'elevador', 'condominio', 'frente', 'topografia', 'agua', 'energia', 'rua_asfaltada', 'area_verde', 'nascente', 'salas', 'acessibilidade', 'estacionamento', 'ar_condicionado'].map(key => characteristics.icon(key));
  assert.deepEqual(actual, symbols);
});

test('ícone de transações das oportunidades evita ligatura ausente na fonte local', () => {
  const homeOpportunities = read('apps/frontend/public/home-opportunities.js');
  const styles = read('apps/frontend/public/react.css');
  assert.match(homeOpportunities, /name === 'arrows-left-right'[\s\S]*?createElementNS\('http:\/\/www\.w3\.org\/2000\/svg', 'svg'\)[\s\S]*?for \(const d of iconPaths\[name\]\)/);
  assert.doesNotMatch(homeOpportunities, /'arrows-left-right': 'swap_horiz'/);
  assert.match(styles, /\.home-opportunity-exchange-icon \{[^}]*stroke-width:24/);
});

test('ação de detalhes dos destaques é um botão-link com seta alinhada', () => {
  const highlights = read('apps/frontend/public/home-highlights.js');
  const styles = read('apps/frontend/public/react.css');
  assert.match(highlights, /details\.className = 'home-highlight-details'/);
  assert.match(styles, /\.home-highlight-footer a\.home-highlight-details \{[^}]*align-items:center[^}]*display:inline-flex/);
  assert.match(styles, /\.home-highlight-details \.material-symbol-icon \{[^}]*height:18px[^}]*width:18px/);
});
