const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const PropertyOpenGraph = require('../../../packages/shared/property-open-graph');
const projectRoot = path.resolve(__dirname, '../../..');
const serverSource = fs.readFileSync(path.join(projectRoot, 'apps/backend/src/server.js'), 'utf8');

test('gera metadados sociais individuais usando a primeira foto pública do anúncio', () => {
  const tags = PropertyOpenGraph.criarTags({
    id: 14,
    categoria: 'Casa',
    tipo: 'Venda',
    bairro: 'Jardim América',
    cidade: 'Tatuí',
    estado: 'SP'
  }, '/r2/imoveis/14/capa.webp', 'https://tatuiimoveis.com.br', 'Casa ampla e arejada');

  assert.match(tags, /<title>Casa para Venda \| Tatuí Imóveis<\/title>/);
  assert.match(tags, /property="og:title" content="Casa para Venda \| Tatuí Imóveis"/);
  assert.match(tags, /property="og:description" content="Casa para Venda · Jardim América, Tatuí, SP · Casa ampla e arejada"/);
  assert.match(tags, /property="og:url" content="https:\/\/tatuiimoveis\.com\.br\/imovel\?id=14"/);
  assert.match(tags, /property="og:image" content="https:\/\/tatuiimoveis\.com\.br\/r2\/imoveis\/14\/capa\.webp"/);
  assert.match(tags, /name="twitter:card" content="summary_large_image"/);
});

test('escapa dados do anúncio e rejeita protocolo inseguro/identificador inválido', () => {
  const tags = PropertyOpenGraph.criarTags({ id: 7, categoria: '<img src=x onerror=alert(1)>', tipo: 'Venda & Aluguel' }, 'javascript:alert(1)', 'https://tatuiimoveis.com.br', 'descrição "especial"');
  assert.match(tags, /&lt;img src=x onerror=alert\(1\)&gt;/);
  assert.match(tags, /descrição &quot;especial&quot;/);
  assert.doesNotMatch(tags, /property="og:image"/);
  assert.doesNotMatch(PropertyOpenGraph.criarTags({ id: 0 }, '/foto.jpg', 'https://tatuiimoveis.com.br', ''), /og:title/);
  assert.equal(PropertyOpenGraph.criarTags({ id: 7 }, '/foto.jpg', 'javascript:alert(1)', ''), '');
});

test('rota de detalhes injeta Open Graph no HTML enviado aos robôs de compartilhamento', () => {
  const route = serverSource.match(/if \(url\.pathname === '\/imovel' && \['GET', 'HEAD'\]\.includes\(req\.method\)\) \{([\s\S]*?)\n    \}/);
  assert.ok(route, 'route serves crawler-readable HTML for property detail links');
  assert.match(route[1], /SELECT \* FROM imoveis WHERE id=\?/);
  assert.match(route[1], /ORDER BY ordem,id LIMIT 1/);
  assert.match(route[1], /PropertyOpenGraph\.criarTags/);
  assert.match(route[1], /text\/html; charset=utf-8/);
  assert.ok(serverSource.indexOf("url.pathname === '/imovel'") < serverSource.indexOf('const cleanRoute = url.pathname'), 'metadata route runs before static page fallback');
});
