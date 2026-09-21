const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.resolve(__dirname, '../..');
const frontend = fs.readFileSync(path.join(root, 'frontend/public/vue-app.js'), 'utf8');
const server = fs.readFileSync(path.join(root, 'backend/src/server.js'), 'utf8');
const migration = fs.readFileSync(path.join(root, 'backend/migrations/010_property_perimeter.js'), 'utf8');
const detailHtml = fs.readFileSync(path.join(root, 'frontend/public/imovel.html'), 'utf8');

test('cadastro oferece desenho, importação e persistência do perímetro', () => {
  assert.match(frontend, /Desenhar perímetro/);
  assert.match(frontend, /Finalizar perímetro/);
  assert.match(frontend, /importarArquivoPerimetro/);
  assert.match(frontend, /application\/vnd\.google-earth\.kml\+xml/);
  assert.match(frontend, /perimetro: permitePerimetro\.value && imovel\.value\.perimetro/);
});

test('perímetro só aparece para terreno ou chácara/sítio e é opcional', () => {
  assert.match(frontend, /const permitePerimetro = computed\(\(\) => \['Terreno', 'Chácara \/ Sítio'\]/);
  assert.match(frontend, /v-if="permitePerimetro" class="perimeter-panel"/);
  assert.match(frontend, /Perímetro do imóvel <em>\(opcional\)<\/em>/);
  assert.match(frontend, /Você pode seguir sem preencher/);
  assert.match(frontend, /perimetro: permitePerimetro\.value && imovel\.value\.perimetro/);
  const validation = frontend.match(/const validarEtapa = etapa =>([\s\S]*?)\n  \};/);
  assert.ok(validation, 'step validation exists');
  assert.doesNotMatch(validation[1], /perimetro/);
});

test('mapas públicos exibem o perímetro sem substituir o marcador', () => {
  assert.match(frontend, /L\.geoJSON\(item\.perimetro/);
  assert.match(frontend, /property-detail-map/);
  assert.match(detailHtml, /leaflet@1\.9\.4/);
  assert.match(detailHtml, /mapbox-config\.js/);
});

test('backend valida anel fechado e limita o GeoJSON persistido', () => {
  assert.match(migration, /perimetro JSON NULL/);
  assert.match(server, /coordinates\.length < 4/);
  assert.match(server, /Number\(first\[0\]\) !== Number\(last\[0\]\)/);
  assert.match(server, /JSON\.stringify\(perimetro\)\.length > 65536/);
});
