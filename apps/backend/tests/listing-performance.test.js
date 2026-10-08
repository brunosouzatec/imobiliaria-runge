const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.resolve(__dirname, '../../..');
const server = fs.readFileSync(path.join(root, 'apps/backend/src/server.js'), 'utf8');
const app = fs.readFileSync(path.join(root, 'apps/frontend/public/vue-app.js'), 'utf8');
const listingHtml = fs.readFileSync(path.join(root, 'apps/frontend/public/imoveis.html'), 'utf8');
const admin = fs.readFileSync(path.join(root, 'apps/frontend/public/admin.js'), 'utf8');

test('public property listing is paginated, filtered on the server, and cached briefly', () => {
  assert.match(server, /url\.searchParams\.has\('page'\) \|\| url\.searchParams\.has\('limit'\)/);
  assert.match(server, /SELECT COUNT\(\*\) AS total FROM imoveis i/);
  assert.match(server, /LIMIT \? OFFSET \?/);
  assert.match(server, /i\.categoria LIKE \? OR i\.bairro LIKE \? OR i\.endereco LIKE \? OR i\.descricao LIKE \?/);
  assert.match(server, /s-maxage=30, stale-while-revalidate=60/);
  assert.match(app, /fetch\(`\/api\/imoveis\?\$\{query\}`\)/);
  assert.match(app, /Carregar mais imóveis/);
});

test('property cards defer offscreen images and load the first two at high priority', () => {
  assert.match(app, /:loading="priority \? 'eager' : 'lazy'" decoding="async" :fetchpriority="priority \? 'high' : 'auto'"/);
  assert.match(app, /:priority="index < 2"/);
});

test('listing waits for neither account lookup nor admin requests in sequence', () => {
  const listing = app.slice(app.indexOf('const Listing ='), app.indexOf('Home.components ='));
  assert.match(listing, /carregarImoveis\(1\); carregarConta\(\)/);
  assert.doesNotMatch(listing, /Promise\.all/);
  assert.match(admin, /Promise\.all\(\[api\('\/api\/admin\/dashboard'\)/);
  assert.match(listingHtml, /<script defer src="vue-app\.js"><\/script>/);
});
