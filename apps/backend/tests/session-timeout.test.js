const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.resolve(__dirname, '../../..');
const server = fs.readFileSync(path.join(root, 'apps/backend/src/server.js'), 'utf8');
const pages = fs.readFileSync(path.join(root, 'apps/frontend/public/react-pages.js'), 'utf8');

test('sessões globais expiram após uma hora de inatividade e renovam o cookie durante o uso', () => {
  assert.match(server, /const SESSION_TIMEOUT = 60 \* 60 \* 1000;/);
  assert.match(server, /const SESSION_COOKIE_MAX_AGE = Math\.floor\(SESSION_TIMEOUT \/ 1000\);/);
  assert.match(server, /session\.expiresAt = Date\.now\(\) \+ SESSION_TIMEOUT; res\.setHeader\('Set-Cookie', sessionCookie\(req, token\)\)/);
  assert.match(server, /session\.expiresAt = Date\.now\(\) \+ SESSION_TIMEOUT;\s+res\.setHeader\('Set-Cookie', adminCookie\(token\)\)/);
  assert.match(server, /function sessionCookie\(req, token, maxAge = SESSION_COOKIE_MAX_AGE\)/);
  assert.match(server, /function adminCookie\(token, maxAge = SESSION_COOKIE_MAX_AGE\)/);
  assert.equal((pages.match(/expira após 1 hora sem atividade/g) || []).length, 2);
  assert.doesNotMatch(pages, /expira após 10 minutos sem atividade/);
});
