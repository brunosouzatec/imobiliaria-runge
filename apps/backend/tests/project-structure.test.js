const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const projectRoot = path.resolve(__dirname, '../../..');
const publicRoot = path.join(projectRoot, 'apps/frontend/public');
const sharedRoot = path.join(projectRoot, 'packages/shared');

test('all local HTML scripts and styles remain resolvable after the split', () => {
  const pages = fs.readdirSync(publicRoot).filter((file) => file.endsWith('.html'));
  assert.ok(pages.includes('index.html'));
  assert.ok(pages.includes('cadastro.html'));

  for (const page of pages) {
    const html = fs.readFileSync(path.join(publicRoot, page), 'utf8');
    const references = [...html.matchAll(/<(?:script|link)\b[^>]*?\b(?:src|href)="([^"]+)"[^>]*>/gi)]
      .map((match) => match[1])
      .filter((reference) => !/^(?:[a-z]+:|#|\/\/)/i.test(reference) && reference !== 'mapbox-config.js');

    for (const reference of references) {
      const localPath = reference.startsWith('/shared/')
        ? path.join(sharedRoot, reference.slice('/shared/'.length))
        : path.join(publicRoot, reference.split(/[?#]/, 1)[0]);
      assert.ok(fs.existsSync(localPath), `${page} references missing local asset: ${reference}`);
    }
  }
});

test('backend, migrations, shared browser modules and infrastructure entrypoints exist', () => {
  assert.ok(fs.existsSync(path.join(projectRoot, 'apps/backend/src/server.js')));
  assert.ok(fs.existsSync(path.join(projectRoot, 'apps/backend/migrations/001_initial_schema.js')));
  assert.ok(fs.existsSync(path.join(sharedRoot, 'property-offers.js')));
  assert.ok(fs.existsSync(path.join(sharedRoot, 'property-contact.js')));
  assert.match(fs.readFileSync(path.join(projectRoot, 'apps/backend/src/server.js'), 'utf8'), /url\.pathname\.startsWith\('\/shared\/'\)/);
  assert.match(fs.readFileSync(path.join(projectRoot, 'package.json'), 'utf8'), /apps\/backend\/src\/server\.js/);
  assert.match(fs.readFileSync(path.join(projectRoot, 'infra/Dockerfile'), 'utf8'), /apps\/backend\/src\/server\.js/);
  assert.match(fs.readFileSync(path.join(publicRoot, 'imoveis.html'), 'utf8'), /shared\/property-contact\.js/);
  assert.match(fs.readFileSync(path.join(publicRoot, 'imovel.html'), 'utf8'), /shared\/property-contact\.js/);
  assert.match(fs.readFileSync(path.join(projectRoot, 'docker-compose.yml'), 'utf8'), /dockerfile: infra\/Dockerfile/);
  assert.match(fs.readFileSync(path.join(projectRoot, '.github/workflows/deploy.yml'), 'utf8'), /file: infra\/Dockerfile/);
});
