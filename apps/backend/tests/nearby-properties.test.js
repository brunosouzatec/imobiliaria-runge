const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

test('localização pede autorização após o clique e apenas centraliza/ aproxima o mapa', () => {
  const root = path.resolve(__dirname, '../../..');
  const app = fs.readFileSync(path.join(root, 'apps/frontend/public/vue-app.js'), 'utf8');
  const home = app.slice(app.indexOf('const Home = {'), app.indexOf('const Listing ='));
  const index = fs.readFileSync(path.join(root, 'apps/frontend/public/index.html'), 'utf8');
  const styles = fs.readFileSync(path.join(root, 'apps/frontend/public/react.css'), 'utf8');
  const server = fs.readFileSync(path.join(root, 'apps/backend/src/server.js'), 'utf8');

  assert.match(home, /const imoveisDoMapa = computed\(\(\) => categoriaMapa\.value[\s\S]*: imoveis\.value\)/);
  assert.match(home, /navigator\.geolocation\.getCurrentPosition/);
  assert.match(home, /map\.flyTo\(nearbyCenter\.value, 15/);
  assert.match(home, /L\.marker\(nearbyCenter\.value[\s\S]*home-user-location-pulse[\s\S]*\.addTo\(userLayer\)/);
  assert.match(app, /@click="buscarProximos"/);
  assert.match(app, /class="home-nearby-button"/);
  assert.doesNotMatch(app, /nearbyRadius|home-nearby-radius|Raio da busca por imóveis próximos|5 km|10 km|25 km|50 km/);
  assert.doesNotMatch(app, /Ao clicar, o navegador solicitará autorização|não será armazenada pelo portal|class="home-nearby-clear"/);
  assert.doesNotMatch(styles, /\.home-map-nearby\s*\{[^}]*background:\s*#fff/);
  assert.doesNotMatch(home, /PropertyNearby|L\.circle\(nearbyCenter\.value/);
  assert.doesNotMatch(index, /nearby-properties\.js/);
  assert.match(server, /Permissions-Policy', 'camera=\(\), microphone=\(\), geolocation=\(self\)'/);
  assert.match(styles, /@keyframes home-user-location-pulse/);
  assert.doesNotMatch(home, /localStorage|sessionStorage|fetch\([^)]*nearby/i);
});
