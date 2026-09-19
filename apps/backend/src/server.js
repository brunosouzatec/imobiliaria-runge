const http = require('http');
const { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { promisify } = require('util');
const mysql = require('mysql2/promise');
const PropertyOffers = require('../../../packages/shared/property-offers');
const PropertyDescription = require('../../../packages/shared/property-description');
const PropertySecurity = require('../../../packages/shared/property-security');
const Maintenance = require('../../../packages/shared/maintenance');
const { runMigrations } = require('./migrate');
const { sendPasswordResetEmail, sendTestEmail, diagnoseSmtpError, smtpConfigured } = require('./mailer');
const PRIVACY_POLICY_VERSION = '2026-09-18';

const projectRoot = path.resolve(__dirname, '../../..');
const webRoot = path.resolve(projectRoot, 'apps/frontend/public');
const sharedRoot = path.resolve(projectRoot, 'packages/shared');
const dataDir = process.env.DATA_DIR || path.join(projectRoot, 'data');
const photosDir = path.join(dataDir, 'Fotos_imoveis');
fs.mkdirSync(photosDir, { recursive: true });
const r2Enabled = Boolean(process.env.R2_ACCOUNT_ID && process.env.R2_ACCESS_KEY_ID && process.env.R2_SECRET_ACCESS_KEY && process.env.R2_BUCKET_NAME);
const r2Client = r2Enabled ? new S3Client({ region: 'auto', endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`, credentials: { accessKeyId: process.env.R2_ACCESS_KEY_ID, secretAccessKey: process.env.R2_SECRET_ACCESS_KEY } }) : null;
const r2PublicUrl = (process.env.R2_PUBLIC_URL || '').replace(/\/$/, '');
const port = Number(process.env.PORT || 3000);
const SESSION_TIMEOUT = 10 * 60 * 1000;
const PASSWORD_RESET_TTL_MS = 30 * 60 * 1000;
const sessions = new Map();
const adminSessions = new Map();
const rateLimits = new Map();
const scrypt = promisify(crypto.scrypt);
let activePasswordHashes = 0;
const pool = mysql.createPool({
  host: process.env.DB_HOST || '127.0.0.1',
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.MYSQL_USER || 'runge_app',
  password: process.env.MYSQL_PASSWORD || '',
  database: process.env.MYSQL_DATABASE || 'imobiliaria_runge',
  waitForConnections: true,
  connectionLimit: 10
});
const mimeTypes = { '.html':'text/html; charset=utf-8', '.css':'text/css; charset=utf-8', '.js':'text/javascript; charset=utf-8', '.json':'application/json; charset=utf-8', '.png':'image/png', '.jpg':'image/jpeg', '.webp':'image/webp', '.svg':'image/svg+xml' };
const maintenancePage = path.join(webRoot, 'manutencao.html');
const cleanPageRoutes = new Map([
  ['/index.html', '/'],
  ['/imoveis.html', '/imoveis'],
  ['/imovel.html', '/imovel'],
  ['/login.html', '/login'],
  ['/recuperar-senha.html', '/recuperar-senha'],
  ['/perfil.html', '/perfil'],
  ['/cadastro.html', '/cadastro'],
  ['/meus-imoveis.html', '/meus-imoveis'],
  ['/sucesso.html', '/sucesso'],
  ['/privacidade.html', '/privacidade'],
  ['/admin.html', '/admin'],
]);

function httpError(message, statusCode) { return Object.assign(new Error(message), { statusCode }); }
function enderecoCliente(req) {
  if (process.env.TRUST_PROXY === 'true' && typeof req.headers['x-forwarded-for'] === 'string') return req.headers['x-forwarded-for'].split(',')[0].trim().slice(0, 80);
  return String(req.socket?.remoteAddress || 'unknown').slice(0, 80);
}
function rateLimit(req, res, name, maximum, windowMs, subject = enderecoCliente(req)) {
  const now = Date.now();
  if (rateLimits.size >= 5000) for (const [key, entry] of rateLimits) if (entry.resetAt <= now) rateLimits.delete(key);
  const key = `${name}:${subject}`;
  let entry = rateLimits.get(key);
  if (!entry && rateLimits.size >= 10000) { sendJson(res, 503, { error: 'Serviço temporariamente ocupado. Tente novamente em instantes.' }); return false; }
  if (!entry || entry.resetAt <= now) { entry = { count: 0, resetAt: now + windowMs }; rateLimits.set(key, entry); }
  if (entry.count >= maximum) {
    res.setHeader('Retry-After', String(Math.max(1, Math.ceil((entry.resetAt - now) / 1000))));
    sendJson(res, 429, { error: 'Muitas tentativas. Aguarde antes de tentar novamente.' });
    return false;
  }
  entry.count += 1;
  return true;
}
function secureRequest(req) {
  return Boolean(req.socket?.encrypted) || (process.env.TRUST_PROXY === 'true' && String(req.headers['x-forwarded-proto'] || '').split(',')[0].trim().toLowerCase() === 'https');
}
function sessionCookie(req, token, maxAge = 600) {
  return `runge_session=${token}; HttpOnly; SameSite=Lax; Max-Age=${maxAge}; Path=/${secureRequest(req) ? '; Secure' : ''}`;
}
function validSameOrigin(req) {
  const origin = req.headers.origin;
  if (!origin) return false;
  try {
    const configuredOrigin = String(process.env.PUBLIC_ORIGIN || '').trim();
    if (configuredOrigin && new URL(origin).origin === new URL(configuredOrigin).origin) return true;
    const trustProxy = process.env.TRUST_PROXY === 'true';
    const forwardedProto = trustProxy ? String(req.headers['x-forwarded-proto'] || '').split(',')[0].trim() : '';
    const forwardedHost = trustProxy ? String(req.headers['x-forwarded-host'] || '').split(',')[0].trim() : '';
    const protocol = secureRequest(req) ? 'https:' : 'http:';
    const expectedHost = forwardedHost || req.headers.host;
    const expected = `${protocol}//${expectedHost}`;
    return new URL(origin).origin === (forwardedProto ? `${forwardedProto}://${expectedHost}` : expected);
  } catch (_) { return false; }
}
async function derivePassword(password, salt) {
  if (activePasswordHashes >= 8) throw httpError('Serviço de autenticação ocupado. Tente novamente em instantes.', 503);
  activePasswordHashes += 1;
  try { return await scrypt(password, salt, 64); } finally { activePasswordHashes -= 1; }
}
async function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  return `${salt}:${(await derivePassword(password, salt)).toString('hex')}`;
}
async function verifyPassword(password, stored) {
  const [salt, hash] = String(stored || '').split(':');
  const valid = /^[a-f0-9]{32}$/i.test(salt || '') && /^[a-f0-9]{128}$/i.test(hash || '');
  const candidate = await derivePassword(password, valid ? salt : '00000000000000000000000000000000');
  return valid && crypto.timingSafeEqual(Buffer.from(hash, 'hex'), candidate);
}
function validRegistration(data) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return false;
  const limits = [['tipo_usuario', 80], ['nome_usuario', 180], ['telefone_usuario', 40], ['email_usuario', 180]];
  return limits.every(([key, max]) => data[key] == null || (typeof data[key] === 'string' && data[key].length <= max))
    && ['tipo_usuario', 'nome_usuario', 'telefone_usuario'].every(key => typeof data[key] === 'string' && data[key].trim())
    && typeof data.email_usuario === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email_usuario.trim()) && data.email_usuario.trim().length <= 180
    && PropertySecurity.validPassword(data.senha_usuario)
    && (data.aceite_privacidade === true || data.aceite_privacidade === 'true');
}
async function insertUser(data) {
  const hash = await hashPassword(data.senha_usuario);
  const [result] = await pool.query('INSERT INTO usuarios (tipo_usuario,nome,telefone,email,senha_hash,privacidade_versao,privacidade_aceita_em) VALUES (?,?,?,?,?,?,NOW())', [data.tipo_usuario.trim(), data.nome_usuario.trim(), data.telefone_usuario.trim(), data.email_usuario.trim().toLowerCase(), hash, PRIVACY_POLICY_VERSION]);
  return result.insertId;
}
function createSession(userId) {
  const now = Date.now();
  if (sessions.size >= 5000) for (const [token, session] of sessions) if (session.expiresAt <= now) sessions.delete(token);
  if (sessions.size >= 10000) return null;
  const token = crypto.randomBytes(32).toString('hex');
  sessions.set(token, { userId, expiresAt: now + SESSION_TIMEOUT });
  return token;
}
function passwordResetHash(token) { return crypto.createHash('sha256').update(token).digest('hex'); }
function settingsKey() { const secret = String(process.env.APP_SECRET || ''); if (!secret) throw httpError('APP_SECRET não configurado.', 503); return crypto.createHash('sha256').update(secret).digest(); }
function encryptSettings(value) { const iv = crypto.randomBytes(12); const cipher = crypto.createCipheriv('aes-256-gcm', settingsKey(), iv); const encrypted = Buffer.concat([cipher.update(JSON.stringify(value), 'utf8'), cipher.final()]); return `v1:${iv.toString('hex')}:${cipher.getAuthTag().toString('hex')}:${encrypted.toString('hex')}`; }
function decryptSettings(value) { try { const [, ivHex, tagHex, dataHex] = String(value).split(':'); const decipher = crypto.createDecipheriv('aes-256-gcm', settingsKey(), Buffer.from(ivHex, 'hex')); decipher.setAuthTag(Buffer.from(tagHex, 'hex')); return JSON.parse(Buffer.concat([decipher.update(Buffer.from(dataHex, 'hex')), decipher.final()]).toString('utf8')); } catch (_) { return null; } }
async function loadSmtpSettings() { const [[row]] = await pool.query('SELECT valor FROM admin_configuracoes WHERE chave=?', ['smtp']); return row ? decryptSettings(row.valor) : null; }
async function requestPasswordReset(data, req, res) {
  const email = typeof data?.email === 'string' ? data.email.trim().toLowerCase() : '';
  if (!email || email.length > 180 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return sendJson(res, 400, { message: 'Informe um endereço de e-mail válido.' });
  const [[user]] = await pool.query('SELECT id,nome,email FROM usuarios WHERE LOWER(email)=? AND ativo=TRUE LIMIT 1', [email]);
  if (!user) return sendJson(res, 404, { message: 'Este e-mail não está cadastrado.' });
  const smtp = await loadSmtpSettings();
  if (!smtpConfigured(smtp || {})) return sendJson(res, 503, { message: 'O e-mail foi encontrado, mas o serviço de envio ainda não está configurado.' });
  const token = crypto.randomBytes(32).toString('hex');
  await pool.query('DELETE FROM recuperacao_senha_tokens WHERE usuario_id=? OR expires_at<=NOW()', [user.id]);
  await pool.query('INSERT INTO recuperacao_senha_tokens (usuario_id,token_hash,expires_at) VALUES (?,?,?)', [user.id, passwordResetHash(token), new Date(Date.now() + PASSWORD_RESET_TTL_MS)]);
  try {
    await sendPasswordResetEmail({ email: user.email, name: user.nome, token }, smtp);
    return sendJson(res, 200, { message: 'E-mail de recuperação enviado. Verifique sua caixa de entrada e a pasta de spam.' });
  } catch (error) {
    await pool.query('DELETE FROM recuperacao_senha_tokens WHERE usuario_id=? AND token_hash=?', [user.id, passwordResetHash(token)]);
    console.error('Falha ao enviar e-mail de recuperação:', error.message);
    return sendJson(res, 502, { message: 'Encontramos seu cadastro, mas não foi possível enviar o e-mail de recuperação. Tente novamente mais tarde.' });
  }
}
async function resetPassword(data, res) {
  const token = typeof data?.token === 'string' ? data.token.trim().toLowerCase() : '';
  if (!/^[a-f0-9]{64}$/.test(token) || !PropertySecurity.validPassword(data?.senha) || data.senha !== data.senha_confirmacao) return sendJson(res, 400, { error: 'O link é inválido ou a senha não atende aos requisitos.' });
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [[reset]] = await connection.query('SELECT id,usuario_id FROM recuperacao_senha_tokens WHERE token_hash=? AND used_at IS NULL AND expires_at>NOW() FOR UPDATE', [passwordResetHash(token)]);
    if (!reset) { await connection.rollback(); return sendJson(res, 400, { error: 'O link é inválido ou expirou. Solicite uma nova recuperação.' }); }
    const hash = await hashPassword(data.senha);
    await connection.query('UPDATE usuarios SET senha_hash=? WHERE id=? AND ativo=TRUE', [hash, reset.usuario_id]);
    await connection.query('UPDATE recuperacao_senha_tokens SET used_at=NOW() WHERE id=?', [reset.id]);
    await connection.commit();
    for (const [sessionToken, session] of sessions) if (session.userId === reset.usuario_id) sessions.delete(sessionToken);
    return sendJson(res, 200, { message: 'Senha alterada com sucesso. Você já pode entrar com a nova senha.' });
  } catch (error) { await connection.rollback(); throw error; } finally { connection.release(); }
}

function descricaoSegura(value) { return PropertyDescription.sanitizar(value); }
function imovelJson(row) { let caracteristicas = row.caracteristicas || {}; if (typeof caracteristicas === 'string') { try { caracteristicas = JSON.parse(caracteristicas) || {}; } catch (_) { caracteristicas = {}; } } const tipos = PropertyOffers.normalizeTypes(row.transacoes, row.tipo); const preco = Number(row.preco); const precoVenda = row.preco_venda == null ? (tipos.includes('Venda') ? preco : null) : Number(row.preco_venda); const precoAluguel = row.preco_aluguel == null ? (tipos.includes('Aluguel') ? preco : null) : Number(row.preco_aluguel); return { ...row, titulo: PropertyOffers.displayTitle({ ...row, tipos_transacao: tipos }), transacoes: tipos, tipos_transacao: tipos, preco_venda: precoVenda, preco_aluguel: precoAluguel, agua_inclusa: Boolean(row.agua_inclusa), luz_inclusa: Boolean(row.luz_inclusa), internet_inclusa: Boolean(row.internet_inclusa), condominio_incluso: Boolean(row.condominio_incluso), caracteristicas, descricao: descricaoSegura(row.descricao), preco, coordenadas: { latitude: Number(row.latitude), longitude: Number(row.longitude) } }; }
async function comFotos(rows) {
  if (!rows.length) return [];
  const ids = rows.map((row) => row.id);
  const [fotos] = await pool.query(`SELECT id, imovel_id, caminho, nome_original FROM imovel_fotos WHERE imovel_id IN (${ids.map(() => '?').join(',')}) ORDER BY ordem, id`, ids);
  const porImovel = new Map(ids.map((id) => [id, []]));
  fotos.forEach((foto) => porImovel.get(foto.imovel_id)?.push({ id: foto.id, url: foto.caminho, nome: foto.nome_original }));
  return rows.map((row) => ({ ...imovelJson(row), fotos: porImovel.get(row.id) || [] }));
}
function sendJson(res, status, data, headers = {}) { res.writeHead(status, { 'Content-Type':'application/json; charset=utf-8', 'Cache-Control':'no-store', ...headers }); res.end(JSON.stringify(data)); }
function bodyJson(req, maxSize = 1024 * 1024) {
  return new Promise((resolve, reject) => {
    const declared = Number(req.headers['content-length'] || 0);
    if (declared > maxSize) { req.resume(); return reject(httpError('Corpo da requisição muito grande.', 413)); }
    const chunks = []; let total = 0; let settled = false;
    const fail = error => { if (settled) return; settled = true; reject(error); req.resume(); };
    req.on('data', chunk => {
      if (settled) return;
      total += chunk.length;
      if (total > maxSize) return fail(httpError('Corpo da requisição muito grande.', 413));
      chunks.push(chunk);
    });
    req.on('end', () => {
      if (settled) return;
      try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}')); }
      catch (_) { reject(httpError('JSON inválido.', 400)); }
    });
    req.on('error', fail);
  });
}
function parseMultipart(req) {
  return new Promise((resolve, reject) => {
    const match = (req.headers['content-type'] || '').match(/boundary=(?:"([^"]+)"|([^;]+))/i); if (!match) return reject(httpError('Limite do formulário inválido.', 400));
    const boundaryText = (match[1] || match[2] || '').trim(); if (!boundaryText || boundaryText.length > 200) return reject(httpError('Limite do formulário inválido.', 400));
    const boundary = Buffer.from(`--${boundaryText}`); const chunks = []; let total = 0; const maxSize = 40 * 1024 * 1024;
    const declared = Number(req.headers['content-length'] || 0); if (declared > maxSize) { req.resume(); return reject(httpError('Upload muito grande.', 413)); }
    let settled = false;
    req.on('data', chunk => { if (settled) return; total += chunk.length; if (total > maxSize) { settled = true; reject(httpError('Upload muito grande.', 413)); req.resume(); } else chunks.push(chunk); });
    req.on('error', error => { if (!settled) { settled = true; reject(error); } });
    req.on('end', () => { if (settled) return; try { const body = Buffer.concat(chunks); const fields = {}; const files = []; let cursor = 0; while ((cursor = body.indexOf(boundary, cursor)) !== -1) { cursor += boundary.length; if (body.slice(cursor, cursor + 2).toString() === '--') break; if (body.slice(cursor, cursor + 2).toString() === '\r\n') cursor += 2; const next = body.indexOf(boundary, cursor); if (next === -1) break; const part = body.slice(cursor, next - 2); const separator = part.indexOf(Buffer.from('\r\n\r\n')); if (separator === -1) continue; const headers = part.slice(0, separator).toString(); const value = part.slice(separator + 4); const disposition = headers.match(/content-disposition:\s*[^\r\n]*?\bname="([^"]+)"(?:;\s*filename="([^"]*)")?/i); if (!disposition) continue; if (disposition[2]) files.push({ name: disposition[1], filename: path.basename(disposition[2]), mimetype: (headers.match(/content-type:\s*([^\r\n]+)/i) || [])[1] || '', buffer: value }); else { if (value.length > 65536) throw httpError('Campo do formulário muito grande.', 413); fields[disposition[1]] = value.toString(); } cursor = next; } settled = true; resolve({ fields, files }); } catch (error) { settled = true; reject(error); } });
  });
}
function photoObjectKey(propertyId, title, filename) { return `imoveis/${propertyId}-${folderSlug(title)}/${filename}`; }
async function savePhoto(file, key) {
  if (r2Enabled) { await r2Client.send(new PutObjectCommand({ Bucket: process.env.R2_BUCKET_NAME, Key: key, Body: file.buffer, ContentType: file.verifiedMimetype, ContentDisposition: 'inline', CacheControl: 'public, max-age=31536000, immutable' })); return r2PublicUrl ? `${r2PublicUrl}/${key}` : `/r2/${encodeURIComponent(key)}`; }
  const localPath = path.join(photosDir, key.replace(/^imoveis\//, '').replaceAll('/', path.sep)); fs.mkdirSync(path.dirname(localPath), { recursive: true }); fs.writeFileSync(localPath, file.buffer); return `/Fotos_imoveis/${key.replace(/^imoveis\//, '')}`;
}
async function removePhoto(caminho) {
  if (r2Enabled) {
    let key = '';
    if (r2PublicUrl && caminho.startsWith(`${r2PublicUrl}/`)) key = caminho.slice(r2PublicUrl.length + 1);
    else if (caminho.startsWith('/r2/')) { try { key = decodeURIComponent(caminho.slice(4)); } catch (_) { return; } }
    if (PropertySecurity.safeR2Key(key)) return r2Client.send(new DeleteObjectCommand({ Bucket: process.env.R2_BUCKET_NAME, Key: key }));
    return;
  }
  const file = path.resolve(dataDir, `.${caminho}`); if (PropertySecurity.dentroDe(photosDir, file) && fs.existsSync(file)) fs.unlinkSync(file);
}
function folderSlug(value) { return String(value || 'imovel').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60) || 'imovel'; }
function cookies(req) { const result = {}; for (const item of String(req.headers.cookie || '').split(';')) { const separator = item.indexOf('='); if (separator < 1) continue; try { result[item.slice(0, separator).trim()] = decodeURIComponent(item.slice(separator + 1).trim()); } catch (_) { /* Ignore malformed cookies. */ } } return result; }
async function userPayload(id) { const [[usuario]] = await pool.query('SELECT id,nome,email,telefone,tipo_usuario,papel FROM usuarios WHERE id=?', [id]); const [rows] = await pool.query('SELECT * FROM imoveis WHERE usuario_id=? ORDER BY id DESC', [id]); return { usuario, imoveis: await comFotos(rows) }; }
async function authenticatedUser(req, res) { const token = cookies(req).runge_session; const session = sessions.get(token); if (!session || session.expiresAt < Date.now()) { if (token) sessions.delete(token); sendJson(res, 401, { error:'Sessão expirada.' }); return null; } session.expiresAt = Date.now() + SESSION_TIMEOUT; return session.userId; }
async function adminUser(req, res) {
  const token = cookies(req).admin_session; const session = adminSessions.get(token);
  if (!session || session.expiresAt < Date.now()) { if (token) adminSessions.delete(token); sendJson(res, 401, { error: 'Sessão administrativa expirada.' }); return null; }
  session.expiresAt = Date.now() + SESSION_TIMEOUT;
  const [[user]] = await pool.query('SELECT id,email,ativo FROM admin_usuarios WHERE id=?', [session.userId]);
  if (!user?.ativo) { adminSessions.delete(token); sendJson(res, 403, { error: 'Administrador inativo.' }); return null; }
  return user;
}
async function audit(userId, acao, entidade, entidadeId = null, detalhes = {}) {
  await pool.query('INSERT INTO admin_auditoria (usuario_id,acao,entidade,entidade_id,detalhes) VALUES (?,?,?,?,?)', [userId, acao, entidade, entidadeId == null ? null : String(entidadeId), JSON.stringify(detalhes)]);
}
function propertyAuditSnapshot(property) {
  const characteristics = typeof property?.caracteristicas === 'string' ? (() => { try { return JSON.parse(property.caracteristicas || '{}'); } catch (_) { return {}; } })() : (property?.caracteristicas || {});
  return { tipo: property?.tipo || '', transacoes: property?.transacoes || '', preco: property?.preco ?? null, preco_venda: property?.preco_venda ?? null, preco_aluguel: property?.preco_aluguel ?? null, agua_inclusa: property?.agua_inclusa ?? false, luz_inclusa: property?.luz_inclusa ?? false, internet_inclusa: property?.internet_inclusa ?? false, condominio_incluso: property?.condominio_incluso ?? false, condominio_valor: property?.condominio_valor ?? null, categoria: property?.categoria || '', endereco: property?.endereco || '', cep: property?.cep || '', rua: property?.rua || '', numero: property?.numero || '', bairro: property?.bairro || '', cidade: property?.cidade || '', estado: property?.estado || '', descricao: property?.descricao || '', caracteristicas, latitude: property?.latitude ?? null, longitude: property?.longitude ?? null };
}
function adminCookie(token, maxAge = 600) { return 'admin_session=' + token + '; HttpOnly; SameSite=Lax; Max-Age=' + maxAge + '; Path=/'; }
async function ensureAdminAccount() { if (!process.env.ADMIN_EMAIL || !process.env.ADMIN_PASSWORD) return; const hash = await hashPassword(process.env.ADMIN_PASSWORD); await pool.query('INSERT INTO admin_usuarios (email,senha_hash) VALUES (?,?) ON DUPLICATE KEY UPDATE senha_hash=VALUES(senha_hash),ativo=TRUE', [process.env.ADMIN_EMAIL.trim().toLowerCase(), hash]); }

async function ownedProperty(req, res, propertyId) { const userId = await authenticatedUser(req, res); if (!userId) return null; const [[property]] = await pool.query('SELECT * FROM imoveis WHERE id=? AND usuario_id=?', [propertyId, userId]); if (!property) { sendJson(res, 404, { error: 'ImÃ³vel nÃ£o encontrado.' }); return null; } return { userId, property }; }
function parsePropertyOffer(data) {
  return PropertyOffers.parse(data);
}
function validPropertyOffer(offer) { return PropertyOffers.isValid(offer); }
function validPropertyInput(data, offer) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return false;
  const shortText = (value, max) => typeof value === 'string' && value.trim().length > 0 && value.length <= max;
  let features = data.caracteristicas || {};
  if (typeof features === 'string') { try { features = JSON.parse(features || '{}'); } catch (_) { return false; } }
  if (!features || typeof features !== 'object' || Array.isArray(features) || Buffer.byteLength(JSON.stringify(features), 'utf8') > 16384) return false;
  if (data.latitude == null || data.latitude === '' || data.longitude == null || data.longitude === '') return false;
  const latitude = Number(data.latitude); const longitude = Number(data.longitude);
  return shortText(data.categoria, 100) && shortText(data.endereco, 255) && validPropertyOffer(offer)
    && (data.descricao == null || (typeof data.descricao === 'string' && data.descricao.length <= 20000))
    && Number.isFinite(latitude) && latitude >= -90 && latitude <= 90
    && Number.isFinite(longitude) && longitude >= -180 && longitude <= 180
    && ['cep', 'rua', 'numero', 'bairro', 'cidade', 'estado'].every(key => data[key] == null || (typeof data[key] === 'string' && data[key].length <= ({ cep: 12, rua: 180, numero: 30, bairro: 120, cidade: 120, estado: 2 })[key]));
}
async function updateProperty(req, res, propertyId, adminId = null) {
  const owned = adminId ? await (async () => { const [[property]] = await pool.query('SELECT * FROM imoveis WHERE id=?', [propertyId]); if (!property) { sendJson(res, 404, { error: 'Imóvel não encontrado.' }); return null; } return { userId: adminId, property }; })() : await ownedProperty(req, res, propertyId); if (!owned) return;
  const d = await bodyJson(req); const offer = parsePropertyOffer(d);
  if (!validPropertyInput(d, offer)) return sendJson(res, 400, { error: 'Confira os campos do imóvel, os valores e a localização.' });
  await pool.query('UPDATE imoveis SET tipo=?,transacoes=?,preco=?,preco_venda=?,preco_aluguel=?,agua_inclusa=?,luz_inclusa=?,internet_inclusa=?,condominio_incluso=?,condominio_valor=?,categoria=?,endereco=?,cep=?,rua=?,numero=?,bairro=?,cidade=?,estado=?,descricao=?,caracteristicas=?,latitude=?,longitude=? WHERE id=?', [offer.type, JSON.stringify(offer.types), offer.price, offer.sale, offer.rent, offer.water, offer.power, offer.internet, offer.condo, offer.condoAmount, d.categoria, d.endereco, d.cep || '', d.rua || '', d.numero || '', d.bairro || '', d.cidade || '', d.estado || '', descricaoSegura(d.descricao), JSON.stringify(d.caracteristicas || {}), Number(d.latitude), Number(d.longitude), propertyId]);
  const [[row]] = await pool.query('SELECT * FROM imoveis WHERE id=?', [propertyId]);
  if (adminId) await audit(adminId, 'editar', 'imovel', propertyId, { antes: propertyAuditSnapshot(owned.property), depois: propertyAuditSnapshot(row) });
  return sendJson(res, 200, (await comFotos([row]))[0]);
}
async function addPropertyPhotos(req, res, propertyId, adminId = null) {
  const owned = adminId ? await (async () => { const [[property]] = await pool.query('SELECT * FROM imoveis WHERE id=?', [propertyId]); if (!property) { sendJson(res, 404, { error: 'Imóvel não encontrado.' }); return null; } return { userId: adminId, property }; })() : await ownedProperty(req, res, propertyId); if (!owned) return;
  const [photosBefore] = adminId ? await pool.query('SELECT id,nome_original,ordem FROM imovel_fotos WHERE imovel_id=? ORDER BY ordem,id', [propertyId]) : [[]];
  if (!rateLimit(req, res, 'photo-upload', 20, 15 * 60 * 1000, String(owned.userId))) return;
  const parsed = await parseMultipart(req);
  const displayTitle = PropertyOffers.displayTitle(owned.property);
  const folderName = `imovel-${propertyId}-${folderSlug(displayTitle)}`;
  const folder = path.join(photosDir, folderName); fs.mkdirSync(folder, { recursive: true });
  const [[last]] = await pool.query('SELECT COALESCE(MAX(ordem), -1) AS ordem FROM imovel_fotos WHERE imovel_id=?', [propertyId]);
  const fotos = parsed.files.filter((file) => file.name === 'fotos');
  if (fotos.length > 10) return sendJson(res, 400, { error: 'Envie no máximo 10 fotos por vez.' });
  let uploaded = 0;
  for (const foto of fotos) {
    const info = PropertySecurity.imageInfo(foto.buffer); if (!info || !foto.buffer.length || foto.buffer.length > 5 * 1024 * 1024) continue;
    foto.verifiedMimetype = info.mimetype;
    const filename = `${crypto.randomBytes(16).toString('hex')}${info.extension}`;
    const caminho = await savePhoto(foto, photoObjectKey(propertyId, displayTitle, filename));
    await pool.query('INSERT INTO imovel_fotos (imovel_id,caminho,nome_original,ordem) VALUES (?,?,?,?)', [propertyId, caminho, foto.filename, Number(last.ordem) + uploaded + 1]);
    uploaded += 1;
  }
  if (!uploaded) return sendJson(res, 400, { error: 'Nenhuma foto válida foi recebida. Use JPG, PNG ou WEBP de até 5 MB.' });
  const [[row]] = await pool.query('SELECT * FROM imoveis WHERE id=?', [propertyId]);
  if (adminId) { const [photosAfter] = await pool.query('SELECT id,nome_original,ordem FROM imovel_fotos WHERE imovel_id=? ORDER BY ordem,id', [propertyId]); await audit(adminId, 'adicionar_fotos', 'imovel', propertyId, { antes: { ...propertyAuditSnapshot(owned.property), fotos: photosBefore }, depois: { ...propertyAuditSnapshot(row), fotos: photosAfter }, fotos_adicionadas: uploaded }); }
  return sendJson(res, 200, { ...(await comFotos([row]))[0], uploaded });
}
async function deletePropertyPhoto(req, res, propertyId, photoId) { const owned = await ownedProperty(req, res, propertyId); if (!owned) return; const [[photo]] = await pool.query('SELECT * FROM imovel_fotos WHERE id=? AND imovel_id=?', [photoId, propertyId]); if (!photo) return sendJson(res, 404, { error: 'Foto nÃ£o encontrada.' }); const file = path.resolve(dataDir, `.${photo.caminho}`); if (PropertySecurity.dentroDe(photosDir, file) && fs.existsSync(file)) fs.unlinkSync(file); await pool.query('DELETE FROM imovel_fotos WHERE id=?', [photoId]); return sendJson(res, 200, { success: true }); }
async function criarImovelComFotos(req, res) {
  const parsed = await parseMultipart(req); const d = parsed.fields; const sessionUser = cookies(req).runge_session; let userId = null;
  const fotos = parsed.files.filter((file) => file.name === 'fotos');
  if (fotos.length > 10) return sendJson(res, 400, { error: 'Envie no máximo 10 fotos.' });
  const offer = parsePropertyOffer(d);
  if (!validPropertyInput(d, offer)) return sendJson(res, 400, { error: 'Preencha corretamente os dados do imóvel, valores e localização.' });
  const titulo = PropertyOffers.displayTitle({ ...d, tipos_transacao: offer.types });
  if (sessionUser) userId = await authenticatedUser(req, res); if (sessionUser && !userId) return;
  if (!userId) { if (!validRegistration(d)) return sendJson(res, 400, { error: 'Confira os dados do anunciante e use uma senha válida.' }); userId = await insertUser(d); }
  const [result] = await pool.query('INSERT INTO imoveis (tipo,transacoes,preco,preco_venda,preco_aluguel,agua_inclusa,luz_inclusa,internet_inclusa,condominio_incluso,condominio_valor,categoria,endereco,cep,rua,numero,bairro,cidade,estado,descricao,caracteristicas,latitude,longitude,tipo_usuario,usuario_id) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)', [offer.type, JSON.stringify(offer.types), offer.price, offer.sale, offer.rent, offer.water, offer.power, offer.internet, offer.condo, offer.condoAmount, d.categoria, d.endereco, d.cep || '', d.rua || '', d.numero || '', d.bairro || '', d.cidade || '', d.estado || '', descricaoSegura(d.descricao), d.caracteristicas || '{}', Number(d.latitude), Number(d.longitude), d.tipo_usuario || 'ProprietÃ¡rio Direto', userId]);
  for (let ordem = 0; ordem < fotos.length; ordem += 1) { const foto = fotos[ordem]; const info = PropertySecurity.imageInfo(foto.buffer); if (!info || !foto.buffer.length || foto.buffer.length > 5 * 1024 * 1024) continue; foto.verifiedMimetype = info.mimetype; const filename = `${crypto.randomBytes(16).toString('hex')}${info.extension}`; const caminho = await savePhoto(foto, photoObjectKey(result.insertId, titulo, filename)); await pool.query('INSERT INTO imovel_fotos (imovel_id,caminho,nome_original,ordem) VALUES (?,?,?,?)', [result.insertId, caminho, foto.filename, ordem]); }
  const [[row]] = await pool.query('SELECT * FROM imoveis WHERE id=?', [result.insertId]); return sendJson(res, 201, (await comFotos([row]))[0]);
}
async function criarImovelJson(req, res) {
  const d = await bodyJson(req); const offer = parsePropertyOffer(d); const sessionUser = cookies(req).runge_session; let userId = null;
  if (!validPropertyInput(d, offer)) return sendJson(res, 400, { error: 'Confira os dados obrigatórios, valores e localização do imóvel.' });
  if (sessionUser) userId = await authenticatedUser(req, res); if (sessionUser && !userId) return;
  if (!userId) { if (!validRegistration(d)) return sendJson(res, 400, { error: 'Confira os dados do anunciante e use uma senha válida.' }); userId = await insertUser(d); }
  const [result] = await pool.query('INSERT INTO imoveis (tipo,transacoes,preco,preco_venda,preco_aluguel,agua_inclusa,luz_inclusa,internet_inclusa,condominio_incluso,condominio_valor,categoria,endereco,cep,rua,numero,bairro,cidade,estado,descricao,caracteristicas,latitude,longitude,tipo_usuario,usuario_id) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)', [offer.type, JSON.stringify(offer.types), offer.price, offer.sale, offer.rent, offer.water, offer.power, offer.internet, offer.condo, offer.condoAmount, d.categoria, d.endereco, d.cep || '', d.rua || '', d.numero || '', d.bairro || '', d.cidade || '', d.estado || '', descricaoSegura(d.descricao), JSON.stringify(d.caracteristicas || {}), Number(d.latitude), Number(d.longitude), d.tipo_usuario || 'Proprietário Direto', userId]);
  const [[row]] = await pool.query('SELECT * FROM imoveis WHERE id=?', [result.insertId]); return sendJson(res, 201, imovelJson(row));
}

async function deletePropertyPhotoStored(req, res, propertyId, photoId, adminId = null) { const owned = adminId ? await (async () => { const [[property]] = await pool.query('SELECT * FROM imoveis WHERE id=?', [propertyId]); if (!property) { sendJson(res, 404, { error: 'Imóvel não encontrado.' }); return null; } return { userId: adminId, property }; })() : await ownedProperty(req, res, propertyId); if (!owned) return; const [[photo]] = await pool.query('SELECT * FROM imovel_fotos WHERE id=? AND imovel_id=?', [photoId, propertyId]); if (!photo) return sendJson(res, 404, { error: 'Foto não encontrada.' }); const [photosBefore] = adminId ? await pool.query('SELECT id,nome_original,ordem FROM imovel_fotos WHERE imovel_id=? ORDER BY ordem,id', [propertyId]) : [[]]; await removePhoto(photo.caminho); await pool.query('DELETE FROM imovel_fotos WHERE id=?', [photoId]); if (adminId) { const [photosAfter] = await pool.query('SELECT id,nome_original,ordem FROM imovel_fotos WHERE imovel_id=? ORDER BY ordem,id', [propertyId]); await audit(adminId, 'excluir_foto', 'imovel', propertyId, { antes: { ...propertyAuditSnapshot(owned.property), fotos: photosBefore }, depois: { ...propertyAuditSnapshot(owned.property), fotos: photosAfter }, foto: { id: photo.id, nome: photo.nome_original } }); } return sendJson(res, 200, { success: true }); }

const server = http.createServer(async (req, res) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  res.setHeader('X-Permitted-Cross-Domain-Policies', 'none');
  try {
    const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    if (Maintenance.shouldShow(url.pathname, process.env.MAINTENANCE_MODE)) {
      if (url.pathname.startsWith('/api/')) return sendJson(res, 503, { error: 'O site está temporariamente em manutenção.' }, { 'Retry-After': '3600' });
      res.writeHead(503, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', 'Retry-After': '3600' });
      return fs.createReadStream(maintenancePage).pipe(res);
    }
    if (url.pathname === '/healthz' && req.method === 'GET') return sendJson(res, 200, { status: 'ok', maintenance: Maintenance.enabled(process.env.MAINTENANCE_MODE) });
    if (url.pathname.startsWith('/api/') && !['GET', 'HEAD', 'OPTIONS'].includes(req.method) && !validSameOrigin(req)) return sendJson(res, 403, { error: 'Origem da requisição inválida.' });
    if (url.pathname.startsWith('/r2/')) {
      if (!r2Enabled) return sendJson(res, 404, { error: 'R2 não configurado.' });
      let key;
      try { key = decodeURIComponent(url.pathname.slice('/r2/'.length)); } catch { return sendJson(res, 400, { error: 'Referência de arquivo inválida.' }); }
      if (!PropertySecurity.safeR2Key(key)) return sendJson(res, 404, { error: 'Arquivo não encontrado.' });
      try {
        const object = await r2Client.send(new GetObjectCommand({ Bucket: process.env.R2_BUCKET_NAME, Key: key }));
        const contentType = ['image/jpeg', 'image/png', 'image/webp'].includes(String(object.ContentType || '').toLowerCase()) ? object.ContentType : 'application/octet-stream';
        res.writeHead(200, { 'Content-Type': contentType, 'Content-Disposition': 'inline', 'Cache-Control': 'public, max-age=31536000, immutable' });
        return object.Body.pipe(res);
      } catch { return sendJson(res, 404, { error: 'Arquivo não encontrado.' }); }
    }
    if (url.pathname.startsWith('/Fotos_imoveis/')) { const file = path.resolve(dataDir, `.${url.pathname}`); if (!PropertySecurity.dentroDe(photosDir, file) || !fs.existsSync(file)) return sendJson(res,404,{error:'Arquivo não encontrado.'}); res.writeHead(200, {'Content-Type': mimeTypes[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'public, max-age=31536000, immutable'}); return fs.createReadStream(file).pipe(res); }
    if (url.pathname === '/mapbox-config.js') { const token = PropertySecurity.publicMapboxToken(process.env.MAPBOX_TOKEN || ''); res.writeHead(200, {'Content-Type':'text/javascript; charset=utf-8','Cache-Control':'no-store'}); return res.end(`const MAPBOX_TOKEN = ${JSON.stringify(token)};`); }
    if (url.pathname.startsWith('/shared/')) { const file = path.resolve(sharedRoot, `.${url.pathname.slice('/shared'.length)}`); if (!file.startsWith(`${sharedRoot}${path.sep}`) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) return sendJson(res,404,{error:'Arquivo não encontrado.'}); res.writeHead(200, {'Content-Type':mimeTypes[path.extname(file)] || 'application/octet-stream'}); return fs.createReadStream(file).pipe(res); }
    if (['GET', 'HEAD'].includes(req.method) && cleanPageRoutes.has(url.pathname)) { const cleanPath = cleanPageRoutes.get(url.pathname); res.writeHead(301, { Location: `${cleanPath}${url.search}`, 'Cache-Control': 'no-store' }); return res.end(); }
    if (url.pathname === '/api/imoveis' && req.method === 'GET') { if (!rateLimit(req, res, 'public-list', 120, 60 * 1000)) return; const [rows] = await pool.query('SELECT * FROM imoveis ORDER BY id DESC'); return sendJson(res, 200, await comFotos(rows)); }
    if (url.pathname === '/api/imoveis/destaques' && req.method === 'GET') {
      if (!rateLimit(req, res, 'public-highlights', 60, 60 * 1000)) return;
      const parsedLimit = Number.parseInt(url.searchParams.get('limit') || '4', 10);
      const limit = Number.isFinite(parsedLimit) ? Math.min(Math.max(parsedLimit, 1), 8) : 4;
      const [rows] = await pool.query(`SELECT i.*, COUNT(v.id) AS visualizacoes
        FROM imoveis i
        LEFT JOIN imovel_visualizacoes v ON v.imovel_id = i.id
          AND v.created_at >= DATE_FORMAT(CURRENT_DATE, '%Y-%m-01')
        GROUP BY i.id
        ORDER BY visualizacoes DESC, i.created_at DESC, i.id DESC
        LIMIT ${limit}`);
      return sendJson(res, 200, await comFotos(rows));
    }
    const detailFixed = url.pathname.match(/^\/api\/imoveis\/(\d+)$/); if (detailFixed && req.method === 'GET') { if (!rateLimit(req, res, 'public-detail', 120, 60 * 1000)) return; const [[row]] = await pool.query('SELECT * FROM imoveis WHERE id=?', [detailFixed[1]]); if (!row) return sendJson(res, 404, { error: 'Imóvel não encontrado.' }); const viewToken = cookies(req).runge_session; const viewSession = sessions.get(viewToken); await pool.query('INSERT INTO imovel_visualizacoes (imovel_id,usuario_id) VALUES (?,?)', [detailFixed[1], viewSession?.expiresAt > Date.now() ? viewSession.userId : null]); return sendJson(res, 200, (await comFotos([row]))[0]); }
    const editRoute = url.pathname.match(/^\/api\/imoveis\/(\d+)$/); if (editRoute && req.method === 'PATCH') return updateProperty(req, res, editRoute[1]);
    const photoRoute = url.pathname.match(/^\/api\/imoveis\/(\d+)\/fotos$/); if (photoRoute && req.method === 'POST') return addPropertyPhotos(req, res, photoRoute[1]);
    const deletePhotoRoute = url.pathname.match(/^\/api\/imoveis\/(\d+)\/fotos\/(\d+)$/); if (deletePhotoRoute && req.method === 'DELETE') return deletePropertyPhotoStored(req, res, deletePhotoRoute[1], deletePhotoRoute[2]);
    if (url.pathname === '/api/imoveis' && req.method === 'POST' && (req.headers['content-type'] || '').startsWith('multipart/form-data')) { if (!rateLimit(req, res, 'property-create', 10, 60 * 60 * 1000)) return; return criarImovelComFotos(req, res); }
    if (url.pathname === '/api/login' && req.method === 'POST') {
      if (!rateLimit(req, res, 'login', 10, 15 * 60 * 1000)) return;
      const data = await bodyJson(req);
      if (!data || typeof data !== 'object' || Array.isArray(data) || typeof data.email !== 'string' || data.email.length > 180 || !PropertySecurity.validPassword(data.senha)) return sendJson(res, 401, { error: 'E-mail ou senha inválidos.' });
      const [[user]] = await pool.query('SELECT * FROM usuarios WHERE LOWER(email)=LOWER(?) AND ativo=TRUE LIMIT 1', [data.email]);
      const passwordOk = await verifyPassword(data.senha, user?.senha_hash);
      if (!user || !passwordOk) return sendJson(res, 401, { error: 'E-mail ou senha inválidos.' });
      const token = createSession(user.id); if (!token) return sendJson(res, 503, { error: 'Serviço de autenticação temporariamente ocupado.' });
      return sendJson(res, 200, await userPayload(user.id), { 'Set-Cookie': sessionCookie(req, token) });
    }
    if (url.pathname === '/api/recuperar-senha' && req.method === 'POST') {
      if (!rateLimit(req, res, 'password-reset-request', 5, 60 * 60 * 1000)) return;
      return requestPasswordReset(await bodyJson(req), req, res);
    }
    if (url.pathname === '/api/redefinir-senha' && req.method === 'POST') {
      if (!rateLimit(req, res, 'password-reset-complete', 10, 60 * 60 * 1000)) return;
      return resetPassword(await bodyJson(req), res);
    }
    if (url.pathname === '/api/usuarios' && req.method === 'POST') {
      if (!rateLimit(req, res, 'registration', 5, 60 * 60 * 1000)) return;
      const d = await bodyJson(req);
      if (!validRegistration(d)) return sendJson(res, 400, { error: 'Preencha os dados obrigatórios e use uma senha válida de até 1024 bytes.' });
      try {
        const userId = await insertUser(d); const token = createSession(userId); if (!token) return sendJson(res, 503, { error: 'Conta criada. Entre novamente em alguns instantes.' });
        return sendJson(res, 201, { usuario: (await userPayload(userId)).usuario }, { 'Set-Cookie': sessionCookie(req, token) });
      } catch (error) { if (error.code === 'ER_DUP_ENTRY') return sendJson(res, 409, { error: 'Este e-mail já está cadastrado.' }); throw error; }
    }
    if (url.pathname === '/api/minha-conta' && req.method === 'GET') { const id=await authenticatedUser(req,res); return id ? sendJson(res,200,await userPayload(id)) : undefined; }
    if (url.pathname === '/api/logout' && req.method === 'POST') { const requestCookies = cookies(req); sessions.delete(requestCookies.runge_session); adminSessions.delete(requestCookies.admin_session); return sendJson(res,200,{success:true},{'Set-Cookie':sessionCookie(req, '', 0)}); }
    if (url.pathname === '/api/conteudos/politica_privacidade' && req.method === 'GET') { const [[row]] = await pool.query('SELECT chave,titulo,conteudo,versao,updated_at FROM site_conteudos WHERE chave=?',['politica_privacidade']); return row ? sendJson(res,200,row) : sendJson(res,404,{error:'Conteúdo não encontrado.'}); }
    if (url.pathname === '/api/perfil' && req.method === 'PATCH') { const id=await authenticatedUser(req,res); if (!id) return; const d=await bodyJson(req); const fields = ['nome','telefone']; const max = { nome:180, telefone:40 }; if (!d || typeof d !== 'object' || Array.isArray(d) || !fields.every(key => typeof d[key] === 'string' && d[key].trim() && d[key].length <= max[key])) return sendJson(res,400,{error:'Confira os campos obrigatórios e seus limites.'}); await pool.query('UPDATE usuarios SET nome=?,telefone=? WHERE id=?',[d.nome.trim(),d.telefone.trim(),id]); return sendJson(res,200,await userPayload(id)); }
    if (url.pathname === '/api/admin/login' && req.method === 'POST') { if (!rateLimit(req, res, 'admin-login', 10, 15 * 60 * 1000)) return; const data = await bodyJson(req); const [[user]] = await pool.query('SELECT * FROM admin_usuarios WHERE LOWER(email)=LOWER(?) AND ativo=TRUE LIMIT 1', [data?.email || '']); const ok = await verifyPassword(data?.senha, user?.senha_hash); if (!user || !ok) return sendJson(res,401,{error:'Usuário ou senha administrativos inválidos.'}); const token = crypto.randomBytes(32).toString('hex'); adminSessions.set(token,{userId:user.id,expiresAt:Date.now()+SESSION_TIMEOUT}); return sendJson(res,200,{usuario:{id:user.id,email:user.email}},{'Set-Cookie':adminCookie(token)}); }
    if (url.pathname === '/api/admin/logout' && req.method === 'POST') { adminSessions.delete(cookies(req).admin_session); return sendJson(res,200,{success:true},{'Set-Cookie':adminCookie('',0)}); }
    if (url.pathname === '/api/admin/dashboard' && req.method === 'GET') {
      const admin = await adminUser(req, res); if (!admin) return;
      const [[users]] = await pool.query('SELECT COUNT(*) total FROM usuarios');
      const [[properties]] = await pool.query('SELECT COUNT(*) total FROM imoveis');
      const [[views]] = await pool.query('SELECT COUNT(*) total FROM imovel_visualizacoes WHERE created_at >= DATE_FORMAT(CURRENT_DATE, "%Y-%m-01")');
      const [[contacts]] = await pool.query('SELECT COUNT(*) total FROM contatos WHERE created_at >= DATE_FORMAT(CURRENT_DATE, "%Y-%m-01")');
      const [latest] = await pool.query('SELECT i.id,i.categoria,i.tipo,i.created_at,u.nome AS anunciante FROM imoveis i LEFT JOIN usuarios u ON u.id=i.usuario_id ORDER BY i.created_at DESC,i.id DESC LIMIT 8');
      const [popular] = await pool.query('SELECT i.id,i.categoria,i.tipo,COUNT(v.id) AS acessos FROM imoveis i LEFT JOIN imovel_visualizacoes v ON v.imovel_id=i.id AND v.created_at >= DATE_FORMAT(CURRENT_DATE, "%Y-%m-01") GROUP BY i.id ORDER BY acessos DESC,i.id DESC LIMIT 8');
      return sendJson(res, 200, { usuario: admin, metricas: { usuarios: Number(users.total), imoveis: Number(properties.total), acessosMes: Number(views.total), contatosMes: Number(contacts.total) }, ultimos: latest, populares: popular });
    }
    if (url.pathname === '/api/admin/imoveis' && req.method === 'GET') {
      const admin = await adminUser(req, res); if (!admin) return;
      const [rows] = await pool.query('SELECT i.*,u.nome AS anunciante,COUNT(v.id) AS acessos FROM imoveis i LEFT JOIN usuarios u ON u.id=i.usuario_id LEFT JOIN imovel_visualizacoes v ON v.imovel_id=i.id GROUP BY i.id ORDER BY i.created_at DESC,i.id DESC');
      return sendJson(res, 200, await comFotos(rows));
    }
    const adminProperty = url.pathname.match(/^\/api\/admin\/imoveis\/(\d+)$/);
    if (adminProperty && req.method === 'GET') { const admin = await adminUser(req, res); if (!admin) return; const [[row]] = await pool.query('SELECT * FROM imoveis WHERE id=?', [adminProperty[1]]); if (!row) return sendJson(res, 404, { error: 'Imóvel não encontrado.' }); const [historico] = await pool.query("SELECT a.id,a.acao,a.detalhes,a.created_at,u.email AS administrador FROM admin_auditoria a LEFT JOIN admin_usuarios u ON u.id=a.usuario_id WHERE a.entidade='imovel' AND a.entidade_id=? ORDER BY a.created_at DESC,a.id DESC", [adminProperty[1]]); return sendJson(res, 200, { ...(await comFotos([row]))[0], historico }); }
    if (adminProperty && req.method === 'PATCH') { const admin = await adminUser(req, res); if (!admin) return; return updateProperty(req, res, adminProperty[1], admin.id); }
    const adminPhotoRoute = url.pathname.match(/^\/api\/admin\/imoveis\/(\d+)\/fotos(?:\/(\d+))?$/);
    if (adminPhotoRoute && req.method === 'POST' && !adminPhotoRoute[2]) { const admin = await adminUser(req, res); if (!admin) return; return addPropertyPhotos(req, res, adminPhotoRoute[1], admin.id); }
    if (adminPhotoRoute && adminPhotoRoute[2] && req.method === 'DELETE') { const admin = await adminUser(req, res); if (!admin) return; return deletePropertyPhotoStored(req, res, adminPhotoRoute[1], adminPhotoRoute[2], admin.id); }
    if (adminProperty && req.method === 'DELETE') {
      const admin = await adminUser(req, res); if (!admin) return;
      const [[property]] = await pool.query('SELECT id FROM imoveis WHERE id=?', [adminProperty[1]]); if (!property) return sendJson(res, 404, { error: 'Imóvel não encontrado.' });
      const [photos] = await pool.query('SELECT caminho FROM imovel_fotos WHERE imovel_id=?', [adminProperty[1]]);
      for (const photo of photos) await removePhoto(photo.caminho);
      await pool.query('DELETE FROM imoveis WHERE id=?', [adminProperty[1]]); await audit(admin.id, 'excluir', 'imovel', adminProperty[1]);
      return sendJson(res, 200, { success: true });
    }
    if (url.pathname === '/api/admin/usuarios' && req.method === 'GET') {
      const admin = await adminUser(req, res); if (!admin) return;
      const [rows] = await pool.query('SELECT u.id,u.nome,u.email,u.telefone,u.tipo_usuario,u.papel,u.created_at,COUNT(DISTINCT i.id) AS imoveis,COUNT(DISTINCT v.id) AS acessos FROM usuarios u LEFT JOIN imoveis i ON i.usuario_id=u.id LEFT JOIN imovel_visualizacoes v ON v.usuario_id=u.id GROUP BY u.id ORDER BY u.created_at DESC');
      return sendJson(res, 200, rows);
    }
    const adminUserRoute = url.pathname.match(/^\/api\/admin\/usuarios\/(\d+)$/);
    if (adminUserRoute && req.method === 'PATCH') { const admin = await adminUser(req, res); if (!admin) return; const data = await bodyJson(req); if (!data || !['usuario','editor','admin'].includes(data.papel) || typeof data.ativo !== 'boolean') return sendJson(res,400,{error:'Perfil ou status inválido.'}); await pool.query('UPDATE usuarios SET papel=?,ativo=? WHERE id=?',[data.papel,data.ativo,adminUserRoute[1]]); await audit(admin.id,'alterar_acesso','usuario',adminUserRoute[1],{papel:data.papel,ativo:data.ativo}); const [[row]] = await pool.query('SELECT id,nome,email,papel,ativo FROM usuarios WHERE id=?',[adminUserRoute[1]]); return sendJson(res,200,row); }
    if (adminUserRoute && req.method === 'GET') {
      const admin = await adminUser(req, res); if (!admin) return;
      const [[user]] = await pool.query('SELECT id,nome,email,telefone,tipo_usuario,papel,created_at FROM usuarios WHERE id=?', [adminUserRoute[1]]); if (!user) return sendJson(res, 404, { error: 'Usuário não encontrado.' });
      const [properties] = await pool.query('SELECT * FROM imoveis WHERE usuario_id=? ORDER BY created_at DESC', [user.id]);
      const [accessed] = await pool.query('SELECT v.created_at,i.id,i.categoria,i.tipo FROM imovel_visualizacoes v JOIN imoveis i ON i.id=v.imovel_id WHERE v.usuario_id=? ORDER BY v.created_at DESC LIMIT 100', [user.id]);
      return sendJson(res, 200, { usuario:user, imoveis:await comFotos(properties), acessados:accessed });
    }
    if (url.pathname === '/api/admin/auditoria' && req.method === 'GET') { const admin = await adminUser(req, res); if (!admin) return; const [rows] = await pool.query('SELECT a.*,au.email AS administrador FROM admin_auditoria a LEFT JOIN admin_usuarios au ON au.id=a.usuario_id ORDER BY a.created_at DESC LIMIT 100'); return sendJson(res, 200, rows); }
    if (url.pathname === '/api/admin/configuracoes/email' && req.method === 'GET') { const admin = await adminUser(req, res); if (!admin) return; const smtp = await loadSmtpSettings(); return sendJson(res, 200, { configurado: Boolean(smtp && smtpConfigured(smtp)), host: smtp?.SMTP_HOST || '', port: smtp?.SMTP_PORT || 587, secure: Boolean(smtp?.SMTP_SECURE), usuario: smtp?.SMTP_USER || '', remetente: smtp?.SMTP_FROM || '', appUrl: process.env.APP_PUBLIC_URL || '' }); }
    if (url.pathname === '/api/admin/configuracoes/email' && req.method === 'PATCH') {
      const admin = await adminUser(req, res); if (!admin) return;
      const data = await bodyJson(req); const current = await loadSmtpSettings(); const port = Number(data?.port);
      if (!data || typeof data.host !== 'string' || !data.host.trim() || data.host.length > 255 || !Number.isInteger(port) || port < 1 || port > 65535 || typeof data.usuario !== 'string' || !data.usuario.trim() || data.usuario.length > 255 || typeof data.remetente !== 'string' || !data.remetente.trim() || data.remetente.length > 255 || typeof data.secure !== 'boolean' || (data.senha !== undefined && typeof data.senha !== 'string') || (!data.senha && !current?.SMTP_PASS)) return sendJson(res, 400, { error: 'Preencha os dados do SMTP e informe a senha na primeira configuração.' });
      const smtp = { SMTP_HOST: data.host.trim(), SMTP_PORT: port, SMTP_SECURE: data.secure, SMTP_USER: data.usuario.trim(), SMTP_PASS: data.senha || current.SMTP_PASS, SMTP_FROM: data.remetente.trim() };
      await pool.query('INSERT INTO admin_configuracoes (chave,valor,atualizado_por) VALUES (?,?,?) ON DUPLICATE KEY UPDATE valor=VALUES(valor),atualizado_por=VALUES(atualizado_por)', ['smtp', encryptSettings(smtp), admin.id]); await audit(admin.id, 'configurar', 'smtp');
      return sendJson(res, 200, { configurado: true, host: smtp.SMTP_HOST, port: smtp.SMTP_PORT, secure: smtp.SMTP_SECURE, usuario: smtp.SMTP_USER, remetente: smtp.SMTP_FROM, appUrl: process.env.APP_PUBLIC_URL || '' });
    }
    if (url.pathname === '/api/admin/configuracoes/email/teste' && req.method === 'POST') {
      const admin = await adminUser(req, res); if (!admin) return;
      if (!rateLimit(req, res, 'admin-email-test', 5, 15 * 60 * 1000, `admin:${admin.id}`)) return;
      const data = await bodyJson(req, 16 * 1024);
      const email = typeof data?.email === 'string' ? data.email.trim().toLowerCase() : '';
      if (!email || email.length > 180 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return sendJson(res, 400, { error: 'Informe um e-mail válido para receber o teste.' });
      const smtp = await loadSmtpSettings();
      if (!smtpConfigured(smtp || {})) return sendJson(res, 400, { error: 'Configure e salve o SMTP antes de enviar um teste.' });
      try {
        const result = await sendTestEmail({ email }, smtp);
        await audit(admin.id, 'testar', 'smtp', null, { destinatario: email, messageId: result.messageId || null });
        return sendJson(res, 200, { success: true, message: 'E-mail de teste enviado. Verifique a caixa de entrada e o spam.', messageId: result.messageId || null });
      } catch (error) {
        const diagnostic = diagnoseSmtpError(error);
        console.error('Falha no teste SMTP:', { host: smtp.SMTP_HOST, port: smtp.SMTP_PORT, secure: smtp.SMTP_SECURE, codigo: diagnostic.codigo, etapa: diagnostic.etapa, comando: diagnostic.comando });
        await audit(admin.id, 'falha_teste', 'smtp', null, { destinatario: email, etapa: diagnostic.etapa, codigo: diagnostic.codigo });
        return sendJson(res, 502, { error: diagnostic.mensagem, diagnostico: diagnostic });
      }
    }
    const contentRoute = url.pathname.match(/^\/api\/admin\/conteudos\/([a-z0-9_-]+)$/);
    if (contentRoute && req.method === 'GET') { const admin = await adminUser(req, res); if (!admin) return; const [[row]] = await pool.query('SELECT * FROM site_conteudos WHERE chave=?', [contentRoute[1]]); return row ? sendJson(res, 200, row) : sendJson(res, 404, { error: 'Conteúdo não encontrado.' }); }
    if (contentRoute && req.method === 'PATCH') { const admin = await adminUser(req, res); if (!admin) return; const data = await bodyJson(req, 256 * 1024); if (!data || typeof data.conteudo !== 'string' || !data.conteudo.trim() || data.conteudo.length > 200000) return sendJson(res,400,{error:'O conteúdo é obrigatório e deve ter até 200 mil caracteres.'}); await pool.query('UPDATE site_conteudos SET conteudo=?,versao=versao+1,atualizado_por=? WHERE chave=?',[data.conteudo.trim(),admin.id,contentRoute[1]]); await audit(admin.id,'editar','conteudo',contentRoute[1]); const [[row]] = await pool.query('SELECT * FROM site_conteudos WHERE chave=?',[contentRoute[1]]); return sendJson(res,200,row); }
    const contact = url.pathname.match(/^\/api\/imoveis\/(\d+)\/contatos$/); if (contact && req.method === 'POST') { if (!rateLimit(req, res, 'contact', 5, 15 * 60 * 1000)) return; const d=await bodyJson(req, 64 * 1024); if (!d || typeof d.nome !== 'string' || !d.nome.trim() || d.nome.length > 180 || typeof d.telefone !== 'string' || !d.telefone.trim() || d.telefone.length > 40 || typeof d.email !== 'string' || d.email.length > 180 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(d.email) || !(d.aceite_privacidade === true || d.aceite_privacidade === 'true')) return sendJson(res,400,{error:'Preencha os dados corretamente e aceite a Política de Privacidade.'}); const [[property]]=await pool.query('SELECT id FROM imoveis WHERE id=?',[contact[1]]); if(!property) return sendJson(res,404,{error:'Imóvel não encontrado.'}); const [result]=await pool.query('INSERT INTO contatos (imovel_id,nome,telefone,email,privacidade_versao,privacidade_aceita_em) VALUES (?,?,?, ?, ?, NOW())',[contact[1],d.nome.trim(),d.telefone.trim(),d.email.trim().toLowerCase(),PRIVACY_POLICY_VERSION]); return sendJson(res,201,{id:result.insertId,message:'Contato registrado com sucesso.'}); }
    if (url.pathname === '/api/imoveis' && req.method === 'POST') return criarImovelJson(req, res);
    const cleanRoute = url.pathname === '/' ? '/index.html' : url.pathname;
    const relative = cleanRoute.endsWith('.html') || path.extname(cleanRoute) ? cleanRoute : `${cleanRoute}.html`;
    const file=path.resolve(webRoot,'.'+relative); if(!file.startsWith(`${webRoot}${path.sep}`)||!fs.existsSync(file)||fs.statSync(file).isDirectory()) return sendJson(res,404,{error:'Arquivo não encontrado.'}); res.writeHead(200,{'Content-Type':mimeTypes[path.extname(file)]||'application/octet-stream'}); fs.createReadStream(file).pipe(res);
  } catch (error) { if (error.code === 'ER_DUP_ENTRY') return sendJson(res, 409, { error: 'Este e-mail já está cadastrado.' }); if (error.statusCode && error.statusCode < 500) return sendJson(res, error.statusCode, { error: error.message }); if (error.statusCode === 503) return sendJson(res, 503, { error: error.message }); console.error(error); if(!res.headersSent) sendJson(res,500,{error:'Erro interno do servidor.'}); }
});
server.headersTimeout = 15_000;
server.requestTimeout = 120_000;
server.keepAliveTimeout = 5_000;
runMigrations(pool).then(()=>ensureAdminAccount()).then(()=>server.listen(port,()=>console.log(`Imobiliária Runge disponível em http://localhost:${port}`))).catch(error=>{console.error('Falha ao executar migrations do MySQL:',error);process.exit(1);});
