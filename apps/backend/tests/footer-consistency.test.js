const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const publicRoot = path.resolve(__dirname, '../../frontend/public');
const vueApp = fs.readFileSync(path.join(publicRoot, 'vue-app.js'), 'utf8');
const privacy = fs.readFileSync(path.join(publicRoot, 'privacidade.html'), 'utf8');

const footerLinks = [
  'imoveis.html',
  'imoveis.html?tipo=Aluguel',
  'index.html#contato',
  'privacidade.html'
];

test('home e páginas Vue usam o rodapé público compartilhado', () => {
  assert.match(vueApp, /Home\.components = \{ Header, Footer \}/);
  assert.match(vueApp, /aria-haspopup="menu"/);
  assert.match(vueApp, /role="menu"/);
  assert.match(vueApp, /fecharAoClicarFora/);
  assert.match(vueApp, /<circle cx="12" cy="8" r="3\.25"><\/circle>/);
  assert.match(vueApp, /Meus imóveis<\/strong>/);
  assert.match(vueApp, /<path d="M4 21V5\.5L12 3l8 2\.5V21"><\/path>/);
  assert.match(vueApp, /Home\.template = Home\.template\.replace/);
  for (const link of footerLinks) assert.match(vueApp, new RegExp(link.replace(/[.?]/g, '\\$&')));
});

test('política de privacidade mantém os mesmos destinos do rodapé público', () => {
  for (const link of footerLinks) assert.match(privacy, new RegExp(link.replace(/[.?]/g, '\\$&')));
  assert.match(privacy, /class="site-footer" id="contato"/);
});
