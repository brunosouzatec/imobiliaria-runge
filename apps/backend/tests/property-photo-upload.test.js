const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '../../..');
const server = fs.readFileSync(path.join(root, 'apps/backend/src/server.js'), 'utf8');

test('photo upload does not create a local folder before selecting the storage backend', () => {
  const start = server.indexOf('async function addPropertyPhotos(');
  const end = server.indexOf('\nasync function deletePropertyPhoto(', start);
  assert.notEqual(start, -1);
  assert.notEqual(end, -1);
  const uploadHandler = server.slice(start, end);

  assert.doesNotMatch(uploadHandler, /fs\.mkdirSync\(/);
  assert.match(uploadHandler, /await savePhoto\(foto, photoObjectKey\(/);
});

test('owner and admin photo upload routes await the handler so errors reach the HTTP error handler', () => {
  assert.match(server, /if \(photoRoute && req\.method === 'POST'\) return await addPropertyPhotos\(/);
  assert.match(server, /return await addPropertyPhotos\(req, res, adminPhotoRoute\[1\], admin\.id\)/);
});
