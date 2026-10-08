const zlib = require('zlib');

const TEXT_TYPES = new Set([
  'text/html; charset=utf-8',
  'text/css; charset=utf-8',
  'text/javascript; charset=utf-8',
  'application/javascript; charset=utf-8',
  'application/json; charset=utf-8',
  'image/svg+xml'
]);

function cacheControlFor(file) {
  const extension = String(file).split('.').pop().toLowerCase();
  if (extension === 'html') return 'no-cache';
  if (['js', 'css'].includes(extension)) return 'public, max-age=300, must-revalidate';
  if (['woff', 'woff2', 'ttf', 'otf'].includes(extension)) return 'public, max-age=86400';
  if (['svg', 'png', 'jpg', 'jpeg', 'webp', 'ico'].includes(extension)) return 'public, max-age=86400';
  return 'public, max-age=300, must-revalidate';
}

function chooseEncoding(header) {
  const encodings = new Map(String(header || '').split(',').map(entry => {
    const [name, ...parameters] = entry.trim().toLowerCase().split(';');
    const quality = parameters.map(value => value.trim()).find(value => value.startsWith('q='));
    return [name, quality ? Number(quality.slice(2)) : 1];
  }));
  if ((encodings.get('br') || 0) > 0) return 'br';
  if ((encodings.get('gzip') || 0) > 0) return 'gzip';
  return '';
}

function etagFor(stat) {
  return `W/"${Number(stat.size).toString(16)}-${Math.trunc(Number(stat.mtimeMs)).toString(16)}"`;
}

function isNotModified(req, etag, mtime) {
  const supplied = req.headers['if-none-match'];
  if (supplied) return supplied.split(',').map(value => value.trim()).includes(etag) || supplied.trim() === '*';
  const since = req.headers['if-modified-since'];
  return Boolean(since && Math.floor(new Date(since).getTime() / 1000) >= Math.floor(mtime / 1000));
}

function compressBuffer(buffer, encoding, callback) {
  if (!encoding || buffer.length < 512) return callback(null, buffer, '');
  if (encoding === 'br') {
    return zlib.brotliCompress(buffer, {
      params: { [zlib.constants.BROTLI_PARAM_QUALITY]: 4 }
    }, (error, compressed) => callback(error, compressed, 'br'));
  }
  return zlib.gzip(buffer, { level: 6 }, (error, compressed) => callback(error, compressed, 'gzip'));
}

module.exports = { TEXT_TYPES, cacheControlFor, chooseEncoding, etagFor, isNotModified, compressBuffer };
