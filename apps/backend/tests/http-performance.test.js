const test = require('node:test');
const assert = require('node:assert/strict');
const zlib = require('node:zlib');
const { promisify } = require('node:util');
const Performance = require('../src/http-performance');

test('static assets use short revalidation for code and no-cache for HTML', () => {
  assert.equal(Performance.cacheControlFor('/assets/app.js'), 'public, max-age=300, must-revalidate');
  assert.equal(Performance.cacheControlFor('/assets/app.css'), 'public, max-age=300, must-revalidate');
  assert.equal(Performance.cacheControlFor('/pages/list.html'), 'no-cache');
  assert.equal(Performance.cacheControlFor('/assets/font.woff2'), 'public, max-age=86400');
});

test('content negotiation honors supported encodings and q=0', () => {
  assert.equal(Performance.chooseEncoding('gzip, br'), 'br');
  assert.equal(Performance.chooseEncoding('br;q=0, gzip;q=0.8'), 'gzip');
  assert.equal(Performance.chooseEncoding('gzip;q=0, br;q=0'), '');
});

test('conditional requests validate ETags and modified dates', () => {
  const stat = { size: 1024, mtimeMs: Date.UTC(2026, 0, 1) };
  const etag = Performance.etagFor(stat);
  assert.equal(Performance.isNotModified({ headers: { 'if-none-match': etag } }, etag, stat.mtimeMs), true);
  assert.equal(Performance.isNotModified({ headers: { 'if-none-match': '"different"' } }, etag, stat.mtimeMs), false);
  assert.equal(Performance.isNotModified({ headers: { 'if-modified-since': new Date(stat.mtimeMs).toUTCString() } }, etag, stat.mtimeMs), true);
});

test('Brotli and gzip compression round-trip without changing payload', async () => {
  const brotli = promisify(zlib.brotliDecompress);
  const gunzip = promisify(zlib.gunzip);
  const input = Buffer.from('Tatuí Imóveis — conteúdo público '.repeat(100));
  const compress = (encoding) => new Promise((resolve, reject) => Performance.compressBuffer(input, encoding, (error, result, applied) => error ? reject(error) : resolve({ result, applied })));
  const br = await compress('br');
  const gz = await compress('gzip');
  assert.equal(br.applied, 'br');
  assert.equal(gz.applied, 'gzip');
  assert.deepEqual(await brotli(br.result), input);
  assert.deepEqual(await gunzip(gz.result), input);
});
