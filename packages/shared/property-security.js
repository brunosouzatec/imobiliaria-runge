const path = require('path');

function dentroDe(diretorio, arquivo) {
  const relativo = path.relative(path.resolve(diretorio), path.resolve(arquivo));
  return relativo === '' || (relativo !== '..' && !relativo.startsWith(`..${path.sep}`) && !path.isAbsolute(relativo));
}

function imageInfo(buffer) {
  if (!Buffer.isBuffer(buffer)) return null;
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return { extension: '.jpg', mimetype: 'image/jpeg' };
  if (buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return { extension: '.png', mimetype: 'image/png' };
  if (buffer.length >= 12 && buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP') return { extension: '.webp', mimetype: 'image/webp' };
  return null;
}

function safeR2Key(key) {
  return typeof key === 'string' && key.length <= 512 && (key.startsWith('imoveis/') || key === 'assets/tatui-imoveis-logo-email.png')
    && !key.includes('\0') && !key.split('/').some(part => !part || part === '.' || part === '..' || part.includes('\\'));
}

function validPassword(password) {
  return typeof password === 'string' && Buffer.byteLength(password, 'utf8') >= 8
    && Buffer.byteLength(password, 'utf8') <= 1024 && /[a-z]/.test(password)
    && /[A-Z]/.test(password) && /\d/.test(password);
}

function publicMapboxToken(token) {
  return typeof token === 'string' && /^pk\.[A-Za-z0-9._-]+$/.test(token) ? token : '';
}

module.exports = { dentroDe, imageInfo, safeR2Key, validPassword, publicMapboxToken };
