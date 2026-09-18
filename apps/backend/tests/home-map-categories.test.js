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
  assert.match(categories, /explorer\.append\(panel, search, map\)/);
  const styles = fs.readFileSync(path.join(publicRoot, 'react.css'), 'utf8');
  assert.match(styles, /home-map-explorer \.home-search.*grid-row:3/);
  assert.match(styles, /home-map-explorer \.home-map.*grid-row:4/);
  assert.match(index, /<script src="home-categories\.js"><\/script>/);
});
