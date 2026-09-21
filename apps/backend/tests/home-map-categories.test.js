const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.resolve(__dirname, '../../..');
const publicRoot = path.join(root, 'apps/frontend/public');

test('home integra categorias ao mapa e aplica cores aos marcadores', () => {
  const vue = fs.readFileSync(path.join(publicRoot, 'vue-app.js'), 'utf8');
  const categories = fs.readFileSync(path.join(publicRoot, 'home-categories.js'), 'utf8');
  const index = fs.readFileSync(path.join(publicRoot, 'index.html'), 'utf8');

  assert.match(vue, /categoriaMapa = ref\('\'\)/);
  assert.match(vue, /imoveisDoMapa = computed/);
  assert.match(vue, /L\.divIcon/);
  assert.match(vue, /--marker-color/);
  assert.match(vue, /const buscar = \(\) =>/);
  assert.doesNotMatch(vue.match(/const buscar = \(\) =>[\s\S]*?location\.href/)?.[0] || '', /await geocodificar/);
  assert.match(vue, /item\.bairro/);
  assert.match(vue, /\(jd\|jard\)/);
  assert.match(categories, /home-map-categories/);
  assert.match(categories, /__homeSetCategory/);
  assert.match(categories, /Limpar categoria/);
  assert.match(categories, /querySelector\('\.home-search'\)/);
  assert.match(categories, /home-map-category-controls/);
  assert.doesNotMatch(categories, /home-map-category-help/);
  assert.match(categories, /explorer\.append\(panel, search, map\)/);
  const styles = fs.readFileSync(path.join(publicRoot, 'react.css'), 'utf8');
  assert.match(styles, /home-map-category-button span \{[^}]*font-size:12px;[^}]*position:static/);
  assert.match(styles, /home-map-category-button strong \{[^}]*width:48px; height:48px/);
  assert.match(styles, /home-map-categories \.home-map-filter-heading \{ text-align:center; \}/);
  assert.match(styles, /home-map-categories h3 \{ font:650 18px/);
  assert.match(styles, /home-map-categories \{ grid-template-columns:1fr auto 1fr; }/);
  assert.match(styles, /home-map-categories \.home-category-clear \{[^}]*grid-column:3/);
  assert.match(styles, /home-map-explorer \.home-search.*grid-row:3/);
  assert.match(styles, /home-map-explorer \.home-map.*grid-row:4/);
  assert.match(styles, /home-all-properties-card \{[^}]*grid-column:2; grid-row:3/);
  assert.match(styles, /home-map-section \.home-all-properties-card \{ grid-column:1; grid-row:4/);
  assert.match(styles, /home-map-section \.home-announce-card \{ grid-column:1; grid-row:5; margin-top:16px; \}/);
  assert.match(styles, /home-map-section \.home-announce-button \{ display:flex; justify-content:center/);
  assert.match(index, /<script src="home-categories\.js"><\/script>/);
});
