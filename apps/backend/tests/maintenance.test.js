const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const maintenance = require('../../../packages/shared/maintenance');

test('maintenance mode accepts explicit boolean-like environment values', () => {
  assert.equal(maintenance.enabled('true'), true);
  assert.equal(maintenance.enabled('ON'), true);
  assert.equal(maintenance.enabled('1'), true);
  assert.equal(maintenance.enabled('false'), false);
  assert.equal(maintenance.enabled(''), false);
});

test('maintenance mode protects every application route while keeping maintenance and health routes available', () => {
  assert.equal(maintenance.shouldShow('/', 'true'), true);
  assert.equal(maintenance.shouldShow('/imoveis.html', 'true'), true);
  assert.equal(maintenance.shouldShow('/api/imoveis', 'true'), true);
  assert.equal(maintenance.shouldShow('/manutencao.html', 'true'), false);
  assert.equal(maintenance.shouldShow('/healthz', 'true'), false);
  assert.equal(maintenance.shouldShow('/', 'false'), false);
});

test('maintenance page contains the official inline Tatuí Imóveis logo', () => {
  const page = fs.readFileSync(path.resolve(__dirname, '../../frontend/public/manutencao.html'), 'utf8');
  assert.match(page, /class="brand"/);
  assert.match(page, /TATUÍ IMÓVEIS/);
  assert.match(page, /Cidade Ternura/);
});
