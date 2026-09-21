const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.resolve(__dirname, '../../..');
const shared = fs.readFileSync(path.join(root, 'packages/shared/map-layers.js'), 'utf8');
const vueApp = fs.readFileSync(path.join(root, 'apps/frontend/public/vue-app.js'), 'utf8');

test('camadas do mapa oferecem ruas, satélite e estilos alternativos', () => {
  assert.match(shared, /streets-v12/);
  assert.match(shared, /satellite-streets-v12/);
  assert.match(shared, /outdoors-v12/);
  assert.match(shared, /light-v11/);
  assert.match(shared, /dark-v11/);
  assert.match(shared, /L\.control\.layers/);
});

test('home, cadastro e detalhe usam o controle compartilhado de camadas', () => {
  assert.equal((vueApp.match(/PropertyMapLayers\.addControl\(/g) || []).length, 3);
  for (const page of ['index.html', 'cadastro.html', 'imovel.html']) {
    const html = fs.readFileSync(path.join(root, 'apps/frontend/public', page), 'utf8');
    assert.match(html, /shared\/map-layers\.js/);
    assert.ok(html.indexOf('map-layers.js') < html.indexOf('vue-app.js'), `${page} loads map layers before Vue components`);
  }
});
