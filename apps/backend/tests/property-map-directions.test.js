const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.resolve(__dirname, '../../..');
const source = fs.readFileSync(path.join(root, 'apps/frontend/public/vue-app.js'), 'utf8');
const styles = fs.readFileSync(path.join(root, 'apps/frontend/public/react-pages.css'), 'utf8');

test('marcador de localização oferece rotas em apps populares de navegação', () => {
  assert.match(source, /L\.marker\(\[latitude, longitude\]\)\.addTo\(perimetroMap\)\.bindPopup\(popupRotas/);
  assert.match(source, /https:\/\/www\.waze\.com\/ul\?ll=/);
  assert.match(source, /https:\/\/www\.google\.com\/maps\/dir\/\?api=1&destination=/);
  assert.match(source, /https:\/\/maps\.apple\.com\/\?daddr=/);
  assert.match(source, /target="_blank" rel="noopener noreferrer"/);
  assert.match(source, /A localização indicada pode ser aproximada/);
  assert.match(source, /toque no marcador para abrir a rota no Waze, Google Maps ou Apple Maps/i);
});

test('opções de navegação no popup têm apresentação e foco acessíveis', () => {
  assert.match(styles, /\.property-map-direction-links a\s*\{[^}]*padding:/);
  assert.match(styles, /\.property-map-direction-links a:hover,[\s\S]*?\.property-map-direction-links a:focus-visible/);
});
