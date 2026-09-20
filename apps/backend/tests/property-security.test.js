const assert = require('node:assert/strict');
const path = require('node:path');
const test = require('node:test');
const security = require('../../../packages/shared/property-security');

test('recognizes only JPEG, PNG and WebP signatures, not client MIME types', () => {
  assert.deepEqual(security.imageInfo(Buffer.from([0xff, 0xd8, 0xff, 0x00])), { extension: '.jpg', mimetype: 'image/jpeg' });
  assert.deepEqual(security.imageInfo(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])), { extension: '.png', mimetype: 'image/png' });
  assert.deepEqual(security.imageInfo(Buffer.from('RIFFxxxxWEBP')), { extension: '.webp', mimetype: 'image/webp' });
  assert.equal(security.imageInfo(Buffer.from('<svg onload="alert(1)">')), null);
  assert.equal(security.imageInfo('image/png'), null);
});

test('limits R2 proxy keys to normalized objects under the property image prefix', () => {
  assert.equal(security.safeR2Key('imoveis/42-casa/abc.jpg'), true);
  assert.equal(security.safeR2Key('assets/tatui-imoveis-logo-email.png'), true);
  for (const key of ['/etc/passwd', 'imoveis/../secret', 'imoveis/a\\b', 'imoveis//file.jpg', 'other/file.jpg']) {
    assert.equal(security.safeR2Key(key), false, `reject ${key}`);
  }
});

test('verifies file containment without accepting sibling-prefix paths', () => {
  const root = path.resolve('data/Fotos_imoveis');
  assert.equal(security.dentroDe(root, path.join(root, 'a.jpg')), true);
  assert.equal(security.dentroDe(root, path.resolve('data/Fotos_imoveis_private/secret.txt')), false);
  assert.equal(security.dentroDe(root, path.resolve('data/secret.txt')), false);
});

test('password validation bounds the work factor input while preserving the strength policy', () => {
  assert.equal(security.validPassword('Abcdefg1'), true);
  assert.equal(security.validPassword('abcdefgh1'), false);
  assert.equal(security.validPassword('Abc1'), false);
  assert.equal(security.validPassword(`A1${'x'.repeat(1023)}`), false);
});

test('only publishes a Mapbox public token, never a secret token', () => {
  assert.equal(security.publicMapboxToken('pk.abc_123.-'), 'pk.abc_123.-');
  assert.equal(security.publicMapboxToken('sk.secret-token'), '');
  assert.equal(security.publicMapboxToken('pk.token\nalert(1)'), '');
});
