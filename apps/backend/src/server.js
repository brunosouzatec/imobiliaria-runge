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
const PropertyOpenGraph = require('../../../packages/shared/property-open-graph');
const OpportunityMatching = require('../../../packages/shared/opportunity-matching');
const Maintenance = require('../../../packages/shared/maintenance');
const { normalizePropertyStatus } = require('./property-status');
const HttpPerformance = require('./http-performance');
const { runMigrations } = require('./migrate');
const { sendPasswordResetEmail, sendAccountChangeEmail, sendTestEmail, diagnoseSmtpError, emailConfigured, emailProvider } = require('./mailer');
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
const SESSION_TIMEOUT = 60 * 60 * 1000;
const SESSION_COOKIE_MAX_AGE = Math.floor(SESSION_TIMEOUT / 1000);
const PASSWORD_RESET_TTL_MS = 30 * 60 * 1000;
const sessions = new Map();
const adminSessions = new Map();
const rateLimits = new Map();
const scrypt = promisify(crypto.scrypt);
let activePasswordHashes = 0;
const BR_STATES = [['AC','Acre'],['AL','Alagoas'],['AP','Amapá'],['AM','Amazonas'],['BA','Bahia'],['CE','Ceará'],['DF','Distrito Federal'],['ES','Espírito Santo'],['GO','Goiás'],['MA','Maranhão'],['MT','Mato Grosso'],['MS','Mato Grosso do Sul'],['MG','Minas Gerais'],['PA','Pará'],['PB','Paraíba'],['PR','Paraná'],['PE','Pernambuco'],['PI','Piauí'],['RJ','Rio de Janeiro'],['RN','Rio Grande do Norte'],['RS','Rio Grande do Sul'],['RO','Rondônia'],['RR','Roraima'],['SC','Santa Catarina'],['SP','São Paulo'],['SE','Sergipe'],['TO','Tocantins']].map(([sigla, nome]) => ({ sigla, nome }));
const localidadesCidadeCache = new Map();
const pool = mysql.createPool({
  host: process.env.DB_HOST || '127.0.0.1',
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.MYSQL_USER || 'runge_app',
  password: process.env.MYSQL_PASSWORD || '',
  database: process.env.MYSQL_DATABASE || 'imobiliaria_runge',
  waitForConnections: true,
  connectionLimit: 10
});
const mimeTypes = { '.html':'text/html; charset=utf-8', '.css':'text/css; charset=utf-8', '.js':'text/javascript; charset=utf-8', '.json':'application/json; charset=utf-8', '.png':'image/png', '.jpg':'image/jpeg', '.webp':'image/webp', '.svg':'image/svg+xml', '.woff2':'font/woff2' };
const maintenancePage = path.join(webRoot, 'manutencao.html');
const cleanPageRoutes = new Map([
  ['/index.html', '/'],
  ['/imoveis.html', '/imoveis'],
  ['/imovel.html', '/imovel'],
  ['/login.html', '/login'],
  ['/recuperar-senha.html', '/recuperar-senha'],
  ['/confirmar-alteracao.html', '/confirmar-alteracao'],
  ['/perfil.html', '/perfil'],
  ['/cadastro.html', '/cadastro'],
  ['/meus-imoveis.html', '/meus-imoveis'],
  ['/sucesso.html', '/sucesso'],
  ['/privacidade.html', '/privacidade'],
  ['/termos-de-uso.html', '/termos-de-uso'],
  ['/termos-proprietario.html', '/termos-proprietario'],
  ['/termos-corretor-parceiro.html', '/termos-corretor-parceiro'],
  ['/oportunidades.html', '/oportunidades'],
  ['/oportunidade.html', '/oportunidade'],
  ['/admin.html', '/admin'],
]);

function httpError(message, statusCode) { return Object.assign(new Error(message), { statusCode }); }
function normalizarLocalidade(value) { return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim().replace(/\s+/g, ' '); }
function limitarLocalidade(value, max) { return String(value || '').trim().slice(0, max); }
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
function sessionCookie(req, token, maxAge = SESSION_COOKIE_MAX_AGE) {
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
function isProfessionalPartner(type) {
  const normalized = String(type || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase();
  return normalized === 'corretor' || normalized === 'imobiliaria';
}
function isDirectPropertyOwner(type) { return String(type || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase() === 'proprietario direto'; }
function validRegistration(data) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return false;
  const limits = [['tipo_usuario', 80], ['nome_usuario', 180], ['telefone_usuario', 40], ['email_usuario', 180]];
  return limits.every(([key, max]) => data[key] == null || (typeof data[key] === 'string' && data[key].length <= max))
    && ['tipo_usuario', 'nome_usuario', 'telefone_usuario'].every(key => typeof data[key] === 'string' && data[key].trim())
    && typeof data.email_usuario === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email_usuario.trim()) && data.email_usuario.trim().length <= 180
    && PropertySecurity.validPassword(data.senha_usuario)
    && (data.aceite_privacidade === true || data.aceite_privacidade === 'true')
    && (data.aceite_termos === true || data.aceite_termos === 'true')
    && (!isProfessionalPartner(data.tipo_usuario) || ((data.aceite_termos_corretor_parceiro === true || data.aceite_termos_corretor_parceiro === 'true') && Number.isInteger(Number(data.termos_corretor_parceiro_versao))))
    && (!isDirectPropertyOwner(data.tipo_usuario) || ((data.aceite_termos_proprietario === true || data.aceite_termos_proprietario === 'true') && Number.isInteger(Number(data.termos_proprietario_versao))));
}
async function insertUser(data) {
  const hash = await hashPassword(data.senha_usuario);
  const [[terms]] = await pool.query('SELECT versao FROM site_conteudos WHERE chave=?', ['termos_uso']);
  if (!terms) throw httpError('Os Termos de Uso ainda não estão disponíveis para aceite.', 503);
  let partnerTerms = null;
  let proprietorTerms = null;
  if (isProfessionalPartner(data.tipo_usuario)) {
    const [[current]] = await pool.query('SELECT versao,conteudo FROM site_conteudos WHERE chave=?', ['termos_corretor_parceiro']);
    if (!current?.conteudo) throw httpError('Os Termos do Corretor Parceiro ainda não estão disponíveis para aceite.', 503);
    if (!(data.aceite_termos_corretor_parceiro === true || data.aceite_termos_corretor_parceiro === 'true') || Number(data.termos_corretor_parceiro_versao) !== Number(current.versao)) {
      throw httpError('Leia e aceite a versão vigente dos Termos do Corretor Parceiro para criar uma conta profissional.', 400);
    }
    partnerTerms = current;
  }
  if (isDirectPropertyOwner(data.tipo_usuario)) {
    const [[current]] = await pool.query('SELECT versao,conteudo FROM site_conteudos WHERE chave=?', ['termos_proprietario']);
    if (!current?.conteudo) throw httpError('Os Termos de Uso e Intermediação do Proprietário ainda não estão disponíveis para aceite.', 503);
    if (!(data.aceite_termos_proprietario === true || data.aceite_termos_proprietario === 'true') || Number(data.termos_proprietario_versao) !== Number(current.versao)) {
      throw httpError('Leia e aceite a versão vigente dos Termos de Uso e Intermediação do Proprietário para criar a conta.', 400);
    }
    proprietorTerms = current;
  }
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [result] = await connection.query('INSERT INTO usuarios (tipo_usuario,nome,telefone,email,senha_hash,privacidade_versao,privacidade_aceita_em,termos_uso_versao,termos_uso_aceita_em) VALUES (?,?,?,?,?,?,NOW(),?,NOW())', [data.tipo_usuario.trim(), data.nome_usuario.trim(), data.telefone_usuario.trim(), data.email_usuario.trim().toLowerCase(), hash, PRIVACY_POLICY_VERSION, String(terms.versao)]);
    if (partnerTerms) await connection.query('INSERT INTO usuario_termo_aceites (usuario_id,chave_termo,versao_termos,conteudo_termos) VALUES (?,?,?,?)', [result.insertId, 'termos_corretor_parceiro', partnerTerms.versao, partnerTerms.conteudo]);
    if (proprietorTerms) await connection.query('INSERT INTO usuario_termo_aceites (usuario_id,chave_termo,versao_termos,conteudo_termos) VALUES (?,?,?,?)', [result.insertId, 'termos_proprietario', proprietorTerms.versao, proprietorTerms.conteudo]);
    await connection.commit();
    return result.insertId;
  } catch (error) {
    try { await connection.rollback(); } catch (_) { /* Keep the original database error. */ }
    throw error;
  } finally { connection.release(); }
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
  if (!emailConfigured(smtp || {})) return sendJson(res, 503, { message: 'O e-mail foi encontrado, mas o serviço de envio ainda não está configurado.' });
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

function validAccountChangeEmail(email) { return typeof email === 'string' && email.length <= 180 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email); }
async function requestEmailChange(data, userId, res) {
  const email = typeof data?.email === 'string' ? data.email.trim().toLowerCase() : '';
  const confirmation = typeof data?.email_confirmacao === 'string' ? data.email_confirmacao.trim().toLowerCase() : '';
  if (!validAccountChangeEmail(email) || email !== confirmation) return sendJson(res, 400, { error: 'Informe um e-mail válido e confirme-o corretamente.' });
  const [[user]] = await pool.query('SELECT id,nome,email FROM usuarios WHERE id=? AND ativo=TRUE LIMIT 1', [userId]);
  if (!user) return sendJson(res, 404, { error: 'Conta não encontrada.' });
  if (email === String(user.email).toLowerCase()) return sendJson(res, 400, { error: 'Este já é o e-mail de acesso atual.' });
  const [[existing]] = await pool.query('SELECT id FROM usuarios WHERE LOWER(email)=? LIMIT 1', [email]);
  if (existing) return sendJson(res, 409, { error: 'Este e-mail já está associado a outra conta.' });
  const smtp = await loadSmtpSettings();
  if (!emailConfigured(smtp || {})) return sendJson(res, 503, { error: 'O serviço de e-mail ainda não está configurado.' });
  const token = crypto.randomBytes(32).toString('hex');
  const tokenHash = passwordResetHash(token);
  await pool.query('DELETE FROM alteracao_email_tokens WHERE usuario_id=? OR expires_at<=NOW()', [user.id]);
  await pool.query('INSERT INTO alteracao_email_tokens (usuario_id,novo_email,token_hash,expires_at) VALUES (?,?,?,?)', [user.id, email, tokenHash, new Date(Date.now() + PASSWORD_RESET_TTL_MS)]);
  try {
    await sendAccountChangeEmail({ email, name: user.nome, token, type: 'email' }, smtp);
    return sendJson(res, 200, { message: 'Enviamos um link de confirmação para o novo endereço. O e-mail de acesso só mudará depois que você confirmar.' });
  } catch (error) {
    await pool.query('DELETE FROM alteracao_email_tokens WHERE usuario_id=? AND token_hash=?', [user.id, tokenHash]);
    console.error('Falha ao enviar confirmação de troca de e-mail:', error.message);
    return sendJson(res, 502, { error: 'Não foi possível enviar o e-mail de confirmação. Tente novamente mais tarde.' });
  }
}
async function requestPasswordChange(data, userId, res) {
  if (!PropertySecurity.validPassword(data?.senha_atual) || !PropertySecurity.validPassword(data?.senha_nova) || data.senha_nova !== data.senha_confirmacao) return sendJson(res, 400, { error: 'Confira a senha atual, os requisitos da nova senha e a confirmação.' });
  const [[user]] = await pool.query('SELECT id,nome,email,senha_hash FROM usuarios WHERE id=? AND ativo=TRUE LIMIT 1', [userId]);
  if (!user) return sendJson(res, 404, { error: 'Conta não encontrada.' });
  if (!(await verifyPassword(data.senha_atual, user.senha_hash))) return sendJson(res, 400, { error: 'A senha atual está incorreta.' });
  if (await verifyPassword(data.senha_nova, user.senha_hash)) return sendJson(res, 400, { error: 'A nova senha deve ser diferente da senha atual.' });
  const smtp = await loadSmtpSettings();
  if (!emailConfigured(smtp || {})) return sendJson(res, 503, { error: 'O serviço de e-mail ainda não está configurado.' });
  const token = crypto.randomBytes(32).toString('hex');
  const tokenHash = passwordResetHash(token);
  const pendingHash = await hashPassword(data.senha_nova);
  await pool.query('DELETE FROM alteracao_senha_tokens WHERE usuario_id=? OR expires_at<=NOW()', [user.id]);
  await pool.query('INSERT INTO alteracao_senha_tokens (usuario_id,senha_hash,token_hash,expires_at) VALUES (?,?,?,?)', [user.id, pendingHash, tokenHash, new Date(Date.now() + PASSWORD_RESET_TTL_MS)]);
  try {
    await sendAccountChangeEmail({ email: user.email, name: user.nome, token, type: 'senha' }, smtp);
    return sendJson(res, 200, { message: 'Enviamos um link de confirmação para o e-mail cadastrado. A nova senha só será aplicada depois da confirmação.' });
  } catch (error) {
    await pool.query('DELETE FROM alteracao_senha_tokens WHERE usuario_id=? AND token_hash=?', [user.id, tokenHash]);
    console.error('Falha ao enviar confirmação de troca de senha:', error.message);
    return sendJson(res, 502, { error: 'Não foi possível enviar o e-mail de confirmação. Tente novamente mais tarde.' });
  }
}
async function confirmAccountChange(data, req, res) {
  const token = typeof data?.token === 'string' ? data.token.trim().toLowerCase() : '';
  const type = data?.tipo;
  if (!/^[a-f0-9]{64}$/.test(token) || !['email', 'senha'].includes(type)) return sendJson(res, 400, { error: 'O link é inválido ou expirou. Solicite uma nova confirmação.' });
  const connection = await pool.getConnection();
  let userId;
  try {
    await connection.beginTransaction();
    if (type === 'email') {
      const [[change]] = await connection.query('SELECT id,usuario_id,novo_email FROM alteracao_email_tokens WHERE token_hash=? AND used_at IS NULL AND expires_at>NOW() FOR UPDATE', [passwordResetHash(token)]);
      if (!change) { await connection.rollback(); return sendJson(res, 400, { error: 'O link é inválido, já foi utilizado ou expirou.' }); }
      userId = change.usuario_id;
      const [result] = await connection.query('UPDATE usuarios SET email=? WHERE id=? AND ativo=TRUE', [change.novo_email, userId]);
      if (!result.affectedRows) { await connection.rollback(); return sendJson(res, 400, { error: 'Não foi possível atualizar a conta. Entre novamente e solicite outra confirmação.' }); }
      await connection.query('UPDATE alteracao_email_tokens SET used_at=NOW() WHERE id=?', [change.id]);
      await connection.query('DELETE FROM alteracao_email_tokens WHERE usuario_id=? AND id<>?', [userId, change.id]);
    } else {
      const [[change]] = await connection.query('SELECT id,usuario_id,senha_hash FROM alteracao_senha_tokens WHERE token_hash=? AND used_at IS NULL AND expires_at>NOW() FOR UPDATE', [passwordResetHash(token)]);
      if (!change) { await connection.rollback(); return sendJson(res, 400, { error: 'O link é inválido, já foi utilizado ou expirou.' }); }
      userId = change.usuario_id;
      const [result] = await connection.query('UPDATE usuarios SET senha_hash=? WHERE id=? AND ativo=TRUE', [change.senha_hash, userId]);
      if (!result.affectedRows) { await connection.rollback(); return sendJson(res, 400, { error: 'Não foi possível atualizar a conta. Entre novamente e solicite outra confirmação.' }); }
      await connection.query('UPDATE alteracao_senha_tokens SET used_at=NOW() WHERE id=?', [change.id]);
      await connection.query('DELETE FROM alteracao_senha_tokens WHERE usuario_id=? AND id<>?', [userId, change.id]);
    }
    await connection.commit();
    for (const [sessionToken, session] of sessions) if (session.userId === userId) sessions.delete(sessionToken);
    return sendJson(res, 200, { message: type === 'email' ? 'E-mail alterado com sucesso. Entre novamente usando o novo endereço.' : 'Senha alterada com sucesso. Entre novamente usando a nova senha.' }, { 'Set-Cookie': sessionCookie(req, '', 0) });
  } catch (error) {
    await connection.rollback();
    if (error.code === 'ER_DUP_ENTRY') return sendJson(res, 409, { error: 'Este e-mail já está associado a outra conta. Solicite a alteração com outro endereço.' });
    throw error;
  } finally { connection.release(); }
}

function descricaoSegura(value) { return PropertyDescription.sanitizar(value); }
function imovelJson(row) { let caracteristicas = row.caracteristicas || {}; if (typeof caracteristicas === 'string') { try { caracteristicas = JSON.parse(caracteristicas) || {}; } catch (_) { caracteristicas = {}; } } let perimetro = row.perimetro || null; if (typeof perimetro === 'string') { try { perimetro = JSON.parse(perimetro) || null; } catch (_) { perimetro = null; } } const tipos = PropertyOffers.normalizeTypes(row.transacoes, row.tipo); const preco = Number(row.preco); const precoVenda = row.preco_venda == null ? (tipos.includes('Venda') ? preco : null) : Number(row.preco_venda); const precoAluguel = row.preco_aluguel == null ? (tipos.includes('Aluguel') ? preco : null) : Number(row.preco_aluguel); return { ...row, titulo: PropertyOffers.displayTitle({ ...row, tipos_transacao: tipos }), transacoes: tipos, tipos_transacao: tipos, preco_venda: precoVenda, preco_aluguel: precoAluguel, agua_inclusa: Boolean(row.agua_inclusa), luz_inclusa: Boolean(row.luz_inclusa), internet_inclusa: Boolean(row.internet_inclusa), condominio_incluso: Boolean(row.condominio_incluso), caracteristicas, perimetro, descricao: descricaoSegura(row.descricao), preco, coordenadas: { latitude: Number(row.latitude), longitude: Number(row.longitude) } }; }
const opportunityTypes = ['Casa', 'Apartamento', 'Terreno', 'Chácara / Sítio', 'Comercial'];
const opportunityStatuses = ['rascunho', 'publicada', 'atendida', 'expirada', 'cancelada'];
function jsonValue(value, fallback = []) { if (value == null || value === '') return fallback; if (typeof value === 'object') return value; try { return JSON.parse(value); } catch (_) { return fallback; } }
function opportunityJson(row) { const tipos = jsonValue(row.tipos_imovel, row.tipo_imovel ? [row.tipo_imovel] : []); return { ...row, tipo_imovel: tipos[0] || row.tipo_imovel || '', tipos_imovel: tipos, transacoes: jsonValue(row.transacoes), estado: row.estado || 'SP', bairros: jsonValue(row.bairros), caracteristicas: jsonValue(row.caracteristicas), descricao: descricaoSegura(row.descricao) }; }
async function configuredOpportunityTypes() { try { const [rows] = await pool.query('SELECT nome FROM oportunidade_tipos_imovel WHERE ativo=TRUE ORDER BY nome'); return rows.map(row => row.nome); } catch (_) { return opportunityTypes; } }
function opportunityInput(data, { partial = false, availableTypes = opportunityTypes } = {}) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) throw httpError('Dados da oportunidade inválidos.', 400);
  const tiposImovel = Array.isArray(data.tipos_imovel)
    ? [...new Set(data.tipos_imovel.filter(item => typeof item === 'string').map(item => item.trim()).filter(Boolean))]
    : (typeof data.tipo_imovel === 'string' && data.tipo_imovel.trim() ? [data.tipo_imovel.trim()] : []);
  const input = {
    titulo: typeof data.titulo === 'string' ? data.titulo.trim() : '',
    tipo_imovel: tiposImovel[0] || '',
    tipos_imovel: tiposImovel,
    transacoes: Array.isArray(data.transacoes) ? [...new Set(data.transacoes.filter(item => ['Venda', 'Aluguel', 'Permuta'].includes(item)))] : [],
    estado: typeof data.estado === 'string' ? data.estado.trim().toUpperCase() : 'SP',
    cidade: typeof data.cidade === 'string' ? data.cidade.trim() : 'Tatuí',
    bairros: Array.isArray(data.bairros) ? data.bairros.filter(item => typeof item === 'string').map(item => item.trim()).filter(Boolean).slice(0, 30) : [],
    valor_minimo: data.valor_minimo === '' || data.valor_minimo == null ? null : Number(data.valor_minimo),
    valor_maximo: data.valor_maximo === '' || data.valor_maximo == null ? null : Number(data.valor_maximo),
    area_total_minima: data.area_total_minima === '' || data.area_total_minima == null ? null : Number(data.area_total_minima),
    area_total_maxima: data.area_total_maxima === '' || data.area_total_maxima == null ? null : Number(data.area_total_maxima),
    quartos_minimos: data.quartos_minimos === '' || data.quartos_minimos == null ? null : Number(data.quartos_minimos),
    suites_minimas: data.suites_minimas === '' || data.suites_minimas == null ? null : Number(data.suites_minimas),
    vagas_minimas: data.vagas_minimas === '' || data.vagas_minimas == null ? null : Number(data.vagas_minimas),
    caracteristicas: Array.isArray(data.caracteristicas) ? data.caracteristicas.filter(item => typeof item === 'string').map(item => item.trim()).filter(Boolean).slice(0, 30) : [],
    descricao: typeof data.descricao === 'string' ? data.descricao.trim() : '',
    status: typeof data.status === 'string' ? data.status : 'rascunho',
    expira_em: data.expira_em ? String(data.expira_em).slice(0, 10) : null
  };
  if (!partial && (!input.titulo || input.titulo.length > 180 || !input.tipos_imovel.length || !input.tipos_imovel.every(tipo => availableTypes.includes(tipo)) || !input.transacoes.length || !/^[A-Z]{2}$/.test(input.estado) || !input.cidade || input.cidade.length > 120 || !input.descricao || input.descricao.length > 5000)) throw httpError('Preencha título, tipo, transação, estado, cidade e descrição da oportunidade.', 400);
  if (input.status && !opportunityStatuses.includes(input.status)) throw httpError('Status da oportunidade inválido.', 400);
  for (const key of ['valor_minimo', 'valor_maximo', 'area_total_minima', 'area_total_maxima', 'quartos_minimos', 'suites_minimas', 'vagas_minimas']) if (input[key] != null && (!Number.isFinite(input[key]) || input[key] < 0)) throw httpError('Os valores numéricos da oportunidade são inválidos.', 400);
  if (input.valor_minimo != null && input.valor_maximo != null && input.valor_minimo > input.valor_maximo) throw httpError('O valor mínimo não pode ser maior que o máximo.', 400);
  if (input.area_total_minima != null && input.area_total_maxima != null && input.area_total_minima > input.area_total_maxima) throw httpError('A área mínima não pode ser maior que a máxima.', 400);
  return input;
}
async function opportunityPayload(id) { const [[row]] = await pool.query('SELECT * FROM oportunidades_compra WHERE id=?', [id]); return row ? opportunityJson(row) : null; }
async function saveOpportunity(req, res, id = null, adminId) {
  const data = opportunityInput(await bodyJson(req, 128 * 1024), { availableTypes: await configuredOpportunityTypes() });
  const publishedAt = data.status === 'publicada' ? new Date() : null;
  const updating = Boolean(id);
  if (updating) { const [result] = await pool.query(`UPDATE oportunidades_compra SET titulo=?,tipo_imovel=?,tipos_imovel=?,transacoes=?,estado=?,cidade=?,bairros=?,valor_minimo=?,valor_maximo=?,area_total_minima=?,area_total_maxima=?,quartos_minimos=?,suites_minimas=?,vagas_minimas=?,caracteristicas=?,descricao=?,status=?,publicada_em=COALESCE(publicada_em,?),expira_em=? WHERE id=?`, [data.titulo, data.tipo_imovel, JSON.stringify(data.tipos_imovel), JSON.stringify(data.transacoes), data.estado, data.cidade, JSON.stringify(data.bairros), data.valor_minimo, data.valor_maximo, data.area_total_minima, data.area_total_maxima, data.quartos_minimos, data.suites_minimas, data.vagas_minimas, JSON.stringify(data.caracteristicas), data.descricao, data.status, publishedAt, data.expira_em, id]); if (!result.affectedRows) return sendJson(res, 404, { error: 'Oportunidade não encontrada.' }); }
  else { const [result] = await pool.query(`INSERT INTO oportunidades_compra (titulo,tipo_imovel,tipos_imovel,transacoes,estado,cidade,bairros,valor_minimo,valor_maximo,area_total_minima,area_total_maxima,quartos_minimos,suites_minimas,vagas_minimas,caracteristicas,descricao,status,publicada_em,expira_em,criada_por_admin) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`, [data.titulo, data.tipo_imovel, JSON.stringify(data.tipos_imovel), JSON.stringify(data.transacoes), data.estado, data.cidade, JSON.stringify(data.bairros), data.valor_minimo, data.valor_maximo, data.area_total_minima, data.area_total_maxima, data.quartos_minimos, data.suites_minimas, data.vagas_minimas, JSON.stringify(data.caracteristicas), data.descricao, data.status, publishedAt, data.expira_em, adminId]); id = result.insertId; }
  await audit(adminId, updating ? 'editar' : 'criar', 'oportunidade', id, { titulo: data.titulo, status: data.status });
  return sendJson(res, updating ? 200 : 201, await opportunityPayload(id));
}
async function comFotos(rows, { primeiraFotoApenas = false } = {}) {
  if (!rows.length) return [];
  const ids = rows.map((row) => row.id);
  const [fotos] = await pool.query(`SELECT id, imovel_id, caminho, nome_original FROM imovel_fotos WHERE imovel_id IN (${ids.map(() => '?').join(',')}) ORDER BY ordem, id`, ids);
  const porImovel = new Map(ids.map((id) => [id, []]));
  fotos.forEach((foto) => {
    const lista = porImovel.get(foto.imovel_id);
    if (!lista || (primeiraFotoApenas && lista.length)) return;
    lista.push({ id: foto.id, url: foto.caminho, nome: foto.nome_original });
  });
  return rows.map((row) => ({ ...imovelJson(row), fotos: porImovel.get(row.id) || [] }));
}
function sendJson(res, status, data, headers = {}) {
  const contentType = 'application/json; charset=utf-8';
  const body = Buffer.from(JSON.stringify(data));
  const encoding = HttpPerformance.TEXT_TYPES.has(contentType) ? HttpPerformance.chooseEncoding(res.req?.headers?.['accept-encoding']) : '';
  HttpPerformance.compressBuffer(body, encoding, (error, output, appliedEncoding) => {
    const responseHeaders = { 'Content-Type': contentType, 'Cache-Control': 'no-store', ...headers };
    if (encoding) responseHeaders.Vary = responseHeaders.Vary ? `${responseHeaders.Vary}, Accept-Encoding` : 'Accept-Encoding';
    if (!error && appliedEncoding) responseHeaders['Content-Encoding'] = appliedEncoding;
    const responseBody = error ? body : output;
    responseHeaders['Content-Length'] = responseBody.length;
    res.writeHead(status, responseHeaders);
    res.end(['HEAD'].includes(res.req?.method) ? undefined : responseBody);
  });
}
function sendStatic(req, res, file) {
  const stat = fs.statSync(file);
  const etag = HttpPerformance.etagFor(stat);
  const lastModified = stat.mtime.toUTCString();
  const headers = {
    'Content-Type': mimeTypes[path.extname(file)] || 'application/octet-stream',
    'Cache-Control': HttpPerformance.cacheControlFor(file),
    ETag: etag,
    'Last-Modified': lastModified
  };
  if (HttpPerformance.isNotModified(req, etag, stat.mtimeMs)) {
    res.writeHead(304, headers);
    return res.end();
  }
  const canCompress = HttpPerformance.TEXT_TYPES.has(headers['Content-Type']);
  const encoding = canCompress ? HttpPerformance.chooseEncoding(req.headers['accept-encoding']) : '';
  if (encoding) headers.Vary = 'Accept-Encoding';
  fs.readFile(file, (readError, data) => {
    if (readError) {
      if (!res.headersSent) res.writeHead(500, { 'Cache-Control': 'no-store' });
      return res.end();
    }
    HttpPerformance.compressBuffer(data, encoding, (compressError, output, appliedEncoding) => {
      const responseBody = compressError ? data : output;
      if (appliedEncoding) headers['Content-Encoding'] = appliedEncoding;
      headers['Content-Length'] = responseBody.length;
      res.writeHead(200, headers);
      res.end(req.method === 'HEAD' ? undefined : responseBody);
    });
  });
}
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
async function fetchJson(url) {
  const response = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!response.ok) throw new Error(`Serviço externo retornou HTTP ${response.status}.`);
  return response.json();
}
async function carregarEstadosCatalogo() {
  const [[count]] = await pool.query('SELECT COUNT(*) AS total FROM localidades_estados');
  if (Number(count.total) < BR_STATES.length) {
    let rows = BR_STATES;
    try {
      const remote = await fetchJson('https://servicodados.ibge.gov.br/api/v1/localidades/estados?orderBy=nome');
      if (Array.isArray(remote) && remote.length) rows = remote.map(row => ({ sigla: String(row.sigla).toUpperCase(), nome: String(row.nome) })).filter(row => /^[A-Z]{2}$/.test(row.sigla));
    } catch (_) {}
    for (const row of rows) await pool.query('INSERT INTO localidades_estados (sigla,nome,nome_normalizado) VALUES (?,?,?) ON DUPLICATE KEY UPDATE nome=VALUES(nome),nome_normalizado=VALUES(nome_normalizado)', [row.sigla, row.nome, normalizarLocalidade(row.nome)]);
  }
  const [rows] = await pool.query('SELECT sigla,nome FROM localidades_estados ORDER BY nome');
  return rows;
}
async function carregarCidadesCatalogo(uf) {
  const normalizedUf = String(uf || '').trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(normalizedUf)) throw httpError('Estado inválido.', 400);
  const cached = localidadesCidadeCache.get(normalizedUf);
  if (cached) return cached;
  await carregarEstadosCatalogo();
  const [[count]] = await pool.query('SELECT COUNT(*) AS total FROM localidades_cidades WHERE estado_sigla=?', [normalizedUf]);
  if (!Number(count.total)) {
    let rows = [];
    try {
      const remote = await fetchJson(`https://servicodados.ibge.gov.br/api/v1/localidades/estados/${encodeURIComponent(normalizedUf)}/municipios?orderBy=nome`);
      rows = Array.isArray(remote) ? remote.map(row => String(row.nome || '').trim()).filter(Boolean) : [];
    } catch (_) {}
    for (const nome of rows) await pool.query('INSERT INTO localidades_cidades (estado_sigla,nome,nome_normalizado) VALUES (?,?,?) ON DUPLICATE KEY UPDATE nome=VALUES(nome)', [normalizedUf, nome, normalizarLocalidade(nome)]);
  }
  const [rows] = await pool.query('SELECT nome FROM localidades_cidades WHERE estado_sigla=? ORDER BY nome', [normalizedUf]);
  const result = rows.map(row => row.nome);
  localidadesCidadeCache.set(normalizedUf, result);
  return result;
}
function nomeEstadoCatalogo(uf) { return BR_STATES.find(item => item.sigla === String(uf || '').toUpperCase())?.nome || uf; }
function mapboxFeaturePertenceAoLocal(feature, cidade, estado) {
  const contexto = [feature?.place_name, ...(feature?.context || []).map(item => `${item.text || ''} ${item.place_name || ''}`)].join(' ');
  const texto = normalizarLocalidade(contexto);
  return texto.includes(normalizarLocalidade(cidade)) && texto.includes(normalizarLocalidade(estado)) && texto.includes('brasil');
}
async function carregarContextoMapbox(token, uf, cidade, estado) {
  try {
    const query = [cidade, estado, 'Brasil'].join(', ');
    const data = await fetchJson(`https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?access_token=${encodeURIComponent(token)}&language=pt-BR&country=br&limit=1&types=place,locality`);
    const feature = data.features?.[0];
    return feature?.bbox && feature?.center ? { bbox: feature.bbox.join(','), proximity: feature.center.join(',') } : null;
  } catch (_) {
    return null;
  }
}
async function buscarBairrosMapbox(uf, cidade, termo) {
  const token = String(process.env.MAPBOX_TOKEN || '').trim();
  if (!token || termo.length < 2) return [];
  const estado = nomeEstadoCatalogo(uf);
  const contexto = await carregarContextoMapbox(token, uf, cidade, estado);
  const query = contexto ? termo : [termo, cidade, estado, 'Brasil'].filter(Boolean).join(', ');
  const params = new URLSearchParams({ access_token: token, language: 'pt-BR', country: 'br', limit: '10', autocomplete: 'true', types: 'neighborhood,locality,district', permanent: 'false' });
  if (contexto) { params.set('bbox', contexto.bbox); params.set('proximity', contexto.proximity); }
  try {
    const data = await fetchJson(`https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?${params}`);
    const features = (data.features || []).filter(feature => mapboxFeaturePertenceAoLocal(feature, cidade, estado));
    return [...new Map(features.map(feature => {
      const nome = String(feature.text || feature.place_name?.split(',')[0] || '').trim();
      return [normalizarLocalidade(nome), nome];
    }).filter(([key, nome]) => key && nome)).values()];
  } catch (error) {
    console.warn(`Não foi possível consultar bairros no Mapbox: ${error.message}`);
    return [];
  }
}
async function carregarBairrosCatalogo(uf, cidade, termo = '') {
  const normalizedUf = String(uf || '').trim().toUpperCase();
  const cidadeOriginal = limitarLocalidade(cidade, 120);
  const cidadeNormalizada = normalizarLocalidade(cidadeOriginal);
  const busca = normalizarLocalidade(termo).slice(0, 120);
  if (!/^[A-Z]{2}$/.test(normalizedUf) || !cidadeNormalizada) throw httpError('Estado e cidade são obrigatórios.', 400);
  await carregarCidadesCatalogo(normalizedUf);
  const [localRows] = await pool.query("SELECT DISTINCT bairro AS nome FROM imoveis WHERE estado=? AND cidade=? AND bairro IS NOT NULL AND bairro<>'' ORDER BY bairro LIMIT 1000", [normalizedUf, cidadeOriginal]);
  let names = localRows.map(row => String(row.nome || '').trim()).filter(nome => !busca || normalizarLocalidade(nome).includes(busca));
  if (busca.length >= 2 && names.length < 10) names = [...new Set([...names, ...(await buscarBairrosMapbox(normalizedUf, cidadeOriginal, busca))])];
  return names.sort((a, b) => a.localeCompare(b, 'pt-BR')).slice(0, 30);
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
async function userPayload(id) {
  const [[usuario]] = await pool.query(`SELECT u.id,u.nome,u.email,u.telefone,u.tipo_usuario,u.papel,
    (SELECT MAX(a.versao_termos) FROM usuario_termo_aceites a WHERE a.usuario_id=u.id AND a.chave_termo='termos_proprietario') AS termos_proprietario_versao
    FROM usuarios u WHERE u.id=?`, [id]);
  const [rows] = await pool.query(`SELECT i.*,
    (SELECT MAX(a.versao_termos) FROM imovel_termo_aceites a WHERE a.imovel_id=i.id AND a.usuario_id=i.usuario_id) AS termos_proprietario_versao
    FROM imoveis i WHERE i.usuario_id=? ORDER BY i.id DESC`, [id]);
  return { usuario, imoveis: await comFotos(rows) };
}
async function userPropertiesWithMetrics(id) {
  const [[usuario]] = await pool.query(`SELECT u.id,u.nome,u.email,u.telefone,u.tipo_usuario,u.papel,
    (SELECT MAX(a.versao_termos) FROM usuario_termo_aceites a WHERE a.usuario_id=u.id AND a.chave_termo='termos_proprietario') AS termos_proprietario_versao
    FROM usuarios u WHERE u.id=?`, [id]);
  const [rows] = await pool.query(`SELECT i.*,
    (SELECT MAX(a.versao_termos) FROM imovel_termo_aceites a WHERE a.imovel_id=i.id AND a.usuario_id=i.usuario_id) AS termos_proprietario_versao,
    (SELECT COUNT(*) FROM imovel_visualizacoes v WHERE v.imovel_id=i.id) AS total_visualizacoes,
    (SELECT COUNT(*) FROM imovel_compartilhamentos s WHERE s.imovel_id=i.id) AS total_compartilhamentos,
    (SELECT COUNT(*) FROM contatos c WHERE c.imovel_id=i.id) AS total_interesses
    FROM imoveis i WHERE i.usuario_id=? ORDER BY i.id DESC`, [id]);
  const imoveis = await comFotos(rows);
  for (let index = 0; index < imoveis.length; index += 1) {
    imoveis[index].metricas = {
      visualizacoes: Number(rows[index].total_visualizacoes || 0),
      compartilhamentos: Number(rows[index].total_compartilhamentos || 0),
      interesses: Number(rows[index].total_interesses || 0)
    };
  }
  return { usuario, imoveis };
}
async function authenticatedUser(req, res) { const token = cookies(req).runge_session; const session = sessions.get(token); if (!session || session.expiresAt < Date.now()) { if (token) sessions.delete(token); sendJson(res, 401, { error:'Sessão expirada.' }); return null; } session.expiresAt = Date.now() + SESSION_TIMEOUT; res.setHeader('Set-Cookie', sessionCookie(req, token)); return session.userId; }
async function ownerTermsFor(userId, propertyId, data) {
  const [[user]] = await pool.query('SELECT tipo_usuario FROM usuarios WHERE id=? AND ativo=TRUE', [userId]);
  if (!user || !isDirectPropertyOwner(user.tipo_usuario)) return null;
  const [[terms]] = await pool.query('SELECT versao,conteudo FROM site_conteudos WHERE chave=?', ['termos_proprietario']);
  if (!terms?.conteudo) throw httpError('Os Termos de Intermediação do Proprietário ainda não estão disponíveis.', 503);
  if (propertyId) {
    const [[accepted]] = await pool.query('SELECT id FROM imovel_termo_aceites WHERE imovel_id=? AND usuario_id=? AND versao_termos=? LIMIT 1', [propertyId, userId, terms.versao]);
    if (accepted) return null;
  }
  const [[accountAccepted]] = await pool.query('SELECT id FROM usuario_termo_aceites WHERE usuario_id=? AND chave_termo=? AND versao_termos=? LIMIT 1', [userId, 'termos_proprietario', terms.versao]);
  if (accountAccepted) return terms;
  const accepted = data?.aceite_termos_proprietario === true || data?.aceite_termos_proprietario === 'true';
  if (!accepted || Number(data?.termos_proprietario_versao) !== Number(terms.versao)) {
    throw httpError('Leia e aceite a versão vigente dos Termos de Uso e Intermediação do Proprietário para publicar ou atualizar o imóvel.', 400);
  }
  return terms;
}
async function recordOwnerTermsAcceptance(connection, userId, propertyId, terms) {
  if (!terms) return;
  await connection.query('INSERT IGNORE INTO imovel_termo_aceites (imovel_id,usuario_id,versao_termos,conteudo_termos) VALUES (?,?,?,?)', [propertyId, userId, terms.versao, terms.conteudo]);
}
async function insertPropertyWithOwnerTerms(sql, values, userId, terms) {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [result] = await connection.query(sql, values);
    await recordOwnerTermsAcceptance(connection, userId, result.insertId, terms);
    await connection.commit();
    return result;
  } catch (error) {
    try { await connection.rollback(); } catch (_) { /* Keep the original database error. */ }
    throw error;
  } finally { connection.release(); }
}
async function adminUser(req, res) {
  const token = cookies(req).admin_session; const session = adminSessions.get(token);
  if (!session || session.expiresAt < Date.now()) { if (token) adminSessions.delete(token); sendJson(res, 401, { error: 'Sessão administrativa expirada.' }); return null; }
  session.expiresAt = Date.now() + SESSION_TIMEOUT;
  res.setHeader('Set-Cookie', adminCookie(token));
  const [[user]] = await pool.query('SELECT id,email,ativo FROM admin_usuarios WHERE id=?', [session.userId]);
  if (!user?.ativo) { adminSessions.delete(token); sendJson(res, 403, { error: 'Administrador inativo.' }); return null; }
  return user;
}
async function audit(userId, acao, entidade, entidadeId = null, detalhes = {}) {
  await pool.query('INSERT INTO admin_auditoria (usuario_id,acao,entidade,entidade_id,detalhes) VALUES (?,?,?,?,?)', [userId, acao, entidade, entidadeId == null ? null : String(entidadeId), JSON.stringify(detalhes)]);
}
function propertyAuditSnapshot(property) {
  const characteristics = typeof property?.caracteristicas === 'string' ? (() => { try { return JSON.parse(property.caracteristicas || '{}'); } catch (_) { return {}; } })() : (property?.caracteristicas || {});
  return { tipo: property?.tipo || '', transacoes: property?.transacoes || '', preco: property?.preco ?? null, preco_venda: property?.preco_venda ?? null, preco_aluguel: property?.preco_aluguel ?? null, agua_inclusa: property?.agua_inclusa ?? false, luz_inclusa: property?.luz_inclusa ?? false, internet_inclusa: property?.internet_inclusa ?? false, condominio_incluso: property?.condominio_incluso ?? false, condominio_valor: property?.condominio_valor ?? null, categoria: property?.categoria || '', endereco: property?.endereco || '', cep: property?.cep || '', rua: property?.rua || '', numero: property?.numero || '', bairro: property?.bairro || '', cidade: property?.cidade || '', estado: property?.estado || '', descricao: property?.descricao || '', caracteristicas: characteristics, latitude: property?.latitude ?? null, longitude: property?.longitude ?? null, perimetro: property?.perimetro ?? null };
}
function adminCookie(token, maxAge = SESSION_COOKIE_MAX_AGE) { return 'admin_session=' + token + '; HttpOnly; SameSite=Lax; Max-Age=' + maxAge + '; Path=/'; }
async function ensureAdminAccount() { if (!process.env.ADMIN_EMAIL || !process.env.ADMIN_PASSWORD) return; const hash = await hashPassword(process.env.ADMIN_PASSWORD); await pool.query('INSERT INTO admin_usuarios (email,senha_hash) VALUES (?,?) ON DUPLICATE KEY UPDATE senha_hash=VALUES(senha_hash),ativo=TRUE', [process.env.ADMIN_EMAIL.trim().toLowerCase(), hash]); }

async function ownedProperty(req, res, propertyId) { const userId = await authenticatedUser(req, res); if (!userId) return null; const [[property]] = await pool.query('SELECT * FROM imoveis WHERE id=? AND usuario_id=?', [propertyId, userId]); if (!property) { sendJson(res, 404, { error: 'ImÃ³vel nÃ£o encontrado.' }); return null; } return { userId, property }; }
async function deleteOwnedProperty(userId, propertyId, res) {
  const [[property]] = await pool.query('SELECT id FROM imoveis WHERE id=? AND usuario_id=?', [propertyId, userId]);
  if (!property) return sendJson(res, 404, { error: 'Imóvel não encontrado.' });
  const [photos] = await pool.query('SELECT caminho FROM imovel_fotos WHERE imovel_id=?', [propertyId]);
  for (const photo of photos) await removePhoto(photo.caminho);
  await pool.query('DELETE FROM imoveis WHERE id=? AND usuario_id=?', [propertyId, userId]);
  return sendJson(res, 200, { success: true });
}
async function deleteUserAccount(userId, data, req, res) {
  if (!data || typeof data !== 'object' || Array.isArray(data)
    || typeof data.senha_atual !== 'string' || !data.senha_atual || data.senha_atual.length > 256
    || data.confirmacao !== 'EXCLUIR') {
    return sendJson(res, 400, { error: 'Informe sua senha atual e digite EXCLUIR para confirmar.' });
  }

  const connection = await pool.getConnection();
  let photos = [];
  try {
    await connection.beginTransaction();
    const [[user]] = await connection.query('SELECT id,senha_hash FROM usuarios WHERE id=? AND ativo=TRUE FOR UPDATE', [userId]);
    if (!user || !(await verifyPassword(data.senha_atual, user.senha_hash))) {
      await connection.rollback();
      return sendJson(res, 400, { error: 'A senha atual está incorreta.' });
    }

    const [photoRows] = await connection.query(
      'SELECT f.caminho FROM imovel_fotos f INNER JOIN imoveis i ON i.id=f.imovel_id WHERE i.usuario_id=?',
      [userId]
    );
    photos = photoRows;
    await connection.query('DELETE FROM imoveis WHERE usuario_id=?', [userId]);
    await connection.query('DELETE FROM usuarios WHERE id=?', [userId]);
    await connection.commit();
  } catch (error) {
    try { await connection.rollback(); } catch (_) { /* Preserve the original database error. */ }
    throw error;
  } finally {
    connection.release();
  }

  for (const photo of photos) {
    try { await removePhoto(photo.caminho); }
    catch (error) { console.error('Não foi possível remover uma foto após a exclusão da conta:', error.message); }
  }
  for (const [token, session] of sessions) if (Number(session.userId) === Number(userId)) sessions.delete(token);
  return sendJson(res, 200, { success: true, message: 'Conta e anúncios excluídos permanentemente.' }, { 'Set-Cookie': sessionCookie(req, '', 0) });
}
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
  let perimetro = data.perimetro;
  if (typeof perimetro === 'string') { try { perimetro = perimetro ? JSON.parse(perimetro) : null; } catch (_) { return false; } }
  if (perimetro != null) {
    const coordinates = perimetro?.type === 'Feature' ? perimetro.geometry?.coordinates?.[0] : perimetro?.type === 'Polygon' ? perimetro.coordinates?.[0] : null;
    if (perimetro?.type === 'Feature' && perimetro.geometry?.type !== 'Polygon') return false;
    if (perimetro?.type !== 'Feature' && perimetro?.type !== 'Polygon') return false;
    if (!Array.isArray(coordinates) || coordinates.length < 4 || JSON.stringify(perimetro).length > 65536) return false;
    const first = coordinates[0]; const last = coordinates[coordinates.length - 1];
    if (!Array.isArray(first) || !Array.isArray(last) || Number(first[0]) !== Number(last[0]) || Number(first[1]) !== Number(last[1])) return false;
    if (coordinates.some(point => !Array.isArray(point) || point.length < 2 || !Number.isFinite(Number(point[0])) || Number(point[0]) < -180 || Number(point[0]) > 180 || !Number.isFinite(Number(point[1])) || Number(point[1]) < -90 || Number(point[1]) > 90)) return false;
  }
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
  const termsAcceptance = adminId ? null : await ownerTermsFor(owned.userId, propertyId, d);
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    await connection.query('UPDATE imoveis SET tipo=?,transacoes=?,preco=?,preco_venda=?,preco_aluguel=?,agua_inclusa=?,luz_inclusa=?,internet_inclusa=?,condominio_incluso=?,condominio_valor=?,categoria=?,endereco=?,cep=?,rua=?,numero=?,bairro=?,cidade=?,estado=?,descricao=?,caracteristicas=?,latitude=?,longitude=?,perimetro=? WHERE id=?', [offer.type, JSON.stringify(offer.types), offer.price, offer.sale, offer.rent, offer.water, offer.power, offer.internet, offer.condo, offer.condoAmount, d.categoria, d.endereco, d.cep || '', d.rua || '', d.numero || '', d.bairro || '', d.cidade || '', d.estado || '', descricaoSegura(d.descricao), JSON.stringify(d.caracteristicas || {}), Number(d.latitude), Number(d.longitude), d.perimetro ? JSON.stringify(typeof d.perimetro === 'string' ? JSON.parse(d.perimetro) : d.perimetro) : null, propertyId]);
    await recordOwnerTermsAcceptance(connection, owned.userId, propertyId, termsAcceptance);
    await connection.commit();
  } catch (error) {
    try { await connection.rollback(); } catch (_) { /* Keep the original database error. */ }
    throw error;
  } finally { connection.release(); }
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
  const termsAcceptance = await ownerTermsFor(userId, null, d);
  const [result] = await insertPropertyWithOwnerTerms('INSERT INTO imoveis (tipo,transacoes,preco,preco_venda,preco_aluguel,agua_inclusa,luz_inclusa,internet_inclusa,condominio_incluso,condominio_valor,categoria,endereco,cep,rua,numero,bairro,cidade,estado,descricao,caracteristicas,latitude,longitude,perimetro,tipo_usuario,usuario_id) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)', [offer.type, JSON.stringify(offer.types), offer.price, offer.sale, offer.rent, offer.water, offer.power, offer.internet, offer.condo, offer.condoAmount, d.categoria, d.endereco, d.cep || '', d.rua || '', d.numero || '', d.bairro || '', d.cidade || '', d.estado || '', descricaoSegura(d.descricao), d.caracteristicas || '{}', Number(d.latitude), Number(d.longitude), d.perimetro ? JSON.stringify(typeof d.perimetro === 'string' ? JSON.parse(d.perimetro) : d.perimetro) : null, d.tipo_usuario || 'Proprietário Direto', userId], userId, termsAcceptance);
  for (let ordem = 0; ordem < fotos.length; ordem += 1) { const foto = fotos[ordem]; const info = PropertySecurity.imageInfo(foto.buffer); if (!info || !foto.buffer.length || foto.buffer.length > 5 * 1024 * 1024) continue; foto.verifiedMimetype = info.mimetype; const filename = `${crypto.randomBytes(16).toString('hex')}${info.extension}`; const caminho = await savePhoto(foto, photoObjectKey(result.insertId, titulo, filename)); await pool.query('INSERT INTO imovel_fotos (imovel_id,caminho,nome_original,ordem) VALUES (?,?,?,?)', [result.insertId, caminho, foto.filename, ordem]); }
  const [[row]] = await pool.query('SELECT * FROM imoveis WHERE id=?', [result.insertId]); return sendJson(res, 201, (await comFotos([row]))[0]);
}
async function criarImovelJson(req, res) {
  const d = await bodyJson(req); const offer = parsePropertyOffer(d); const sessionUser = cookies(req).runge_session; let userId = null;
  if (!validPropertyInput(d, offer)) return sendJson(res, 400, { error: 'Confira os dados obrigatórios, valores e localização do imóvel.' });
  if (sessionUser) userId = await authenticatedUser(req, res); if (sessionUser && !userId) return;
  if (!userId) { if (!validRegistration(d)) return sendJson(res, 400, { error: 'Confira os dados do anunciante e use uma senha válida.' }); userId = await insertUser(d); }
  const termsAcceptance = await ownerTermsFor(userId, null, d);
  const [result] = await insertPropertyWithOwnerTerms('INSERT INTO imoveis (tipo,transacoes,preco,preco_venda,preco_aluguel,agua_inclusa,luz_inclusa,internet_inclusa,condominio_incluso,condominio_valor,categoria,endereco,cep,rua,numero,bairro,cidade,estado,descricao,caracteristicas,latitude,longitude,perimetro,tipo_usuario,usuario_id) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)', [offer.type, JSON.stringify(offer.types), offer.price, offer.sale, offer.rent, offer.water, offer.power, offer.internet, offer.condo, offer.condoAmount, d.categoria, d.endereco, d.cep || '', d.rua || '', d.numero || '', d.bairro || '', d.cidade || '', d.estado || '', descricaoSegura(d.descricao), JSON.stringify(d.caracteristicas || {}), Number(d.latitude), Number(d.longitude), d.perimetro ? JSON.stringify(typeof d.perimetro === 'string' ? JSON.parse(d.perimetro) : d.perimetro) : null, d.tipo_usuario || 'Proprietário Direto', userId], userId, termsAcceptance);
  const [[row]] = await pool.query('SELECT * FROM imoveis WHERE id=?', [result.insertId]); return sendJson(res, 201, imovelJson(row));
}

async function deletePropertyPhotoStored(req, res, propertyId, photoId, adminId = null) { const owned = adminId ? await (async () => { const [[property]] = await pool.query('SELECT * FROM imoveis WHERE id=?', [propertyId]); if (!property) { sendJson(res, 404, { error: 'Imóvel não encontrado.' }); return null; } return { userId: adminId, property }; })() : await ownedProperty(req, res, propertyId); if (!owned) return; const [[photo]] = await pool.query('SELECT * FROM imovel_fotos WHERE id=? AND imovel_id=?', [photoId, propertyId]); if (!photo) return sendJson(res, 404, { error: 'Foto não encontrada.' }); const [photosBefore] = adminId ? await pool.query('SELECT id,nome_original,ordem FROM imovel_fotos WHERE imovel_id=? ORDER BY ordem,id', [propertyId]) : [[]]; await removePhoto(photo.caminho); await pool.query('DELETE FROM imovel_fotos WHERE id=?', [photoId]); if (adminId) { const [photosAfter] = await pool.query('SELECT id,nome_original,ordem FROM imovel_fotos WHERE imovel_id=? ORDER BY ordem,id', [propertyId]); await audit(adminId, 'excluir_foto', 'imovel', propertyId, { antes: { ...propertyAuditSnapshot(owned.property), fotos: photosBefore }, depois: { ...propertyAuditSnapshot(owned.property), fotos: photosAfter }, foto: { id: photo.id, nome: photo.nome_original } }); } return sendJson(res, 200, { success: true }); }

const server = http.createServer(async (req, res) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(self)');
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
    if (url.pathname === '/api/localidades/estados' && req.method === 'GET') {
      if (!rateLimit(req, res, 'localidades-estados', 60, 60 * 1000)) return;
      return sendJson(res, 200, await carregarEstadosCatalogo());
    }
    if (url.pathname === '/api/localidades/cidades' && req.method === 'GET') {
      if (!rateLimit(req, res, 'localidades-cidades', 120, 60 * 1000)) return;
      return sendJson(res, 200, await carregarCidadesCatalogo(url.searchParams.get('uf')));
    }
    if (url.pathname === '/api/localidades/bairros' && req.method === 'GET') {
      if (!rateLimit(req, res, 'localidades-bairros', 120, 60 * 1000)) return;
      const uf = url.searchParams.get('uf');
      const cidade = url.searchParams.get('cidade');
      const termo = url.searchParams.get('q') || '';
      return sendJson(res, 200, await carregarBairrosCatalogo(uf, cidade, termo));
    }
    if (url.pathname.startsWith('/shared/')) { const file = path.resolve(sharedRoot, `.${url.pathname.slice('/shared'.length)}`); if (!file.startsWith(`${sharedRoot}${path.sep}`) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) return sendJson(res,404,{error:'Arquivo não encontrado.'}); return sendStatic(req, res, file); }
    if (['GET', 'HEAD'].includes(req.method) && cleanPageRoutes.has(url.pathname)) { const cleanPath = cleanPageRoutes.get(url.pathname); res.writeHead(301, { Location: `${cleanPath}${url.search}`, 'Cache-Control': 'no-store' }); return res.end(); }
    if (url.pathname === '/api/oportunidades' && req.method === 'GET') {
      if (!rateLimit(req, res, 'opportunity-list', 120, 60 * 1000)) return;
      const filters = ['status=?', '(expira_em IS NULL OR expira_em>=CURRENT_DATE)']; const values = ['publicada'];
      const requestedLimit = Number.parseInt(url.searchParams.get('limit') || '100', 10);
      const limit = Number.isFinite(requestedLimit) ? Math.min(Math.max(requestedLimit, 1), 100) : 100;
      const q = String(url.searchParams.get('q') || '').trim().slice(0, 120);
      const tipo = String(url.searchParams.get('tipo') || '').trim();
      if (q) { filters.push('(titulo LIKE ? OR cidade LIKE ? OR descricao LIKE ? OR CAST(bairros AS CHAR) LIKE ? OR CAST(caracteristicas AS CHAR) LIKE ?)'); values.push(...Array(5).fill(`%${q}%`)); }
      if (tipo.length <= 80 && tipo) { filters.push('(tipo_imovel=? OR JSON_CONTAINS(COALESCE(tipos_imovel, JSON_ARRAY()), JSON_QUOTE(?)))'); values.push(tipo, tipo); }
      const [rows] = await pool.query(`SELECT * FROM oportunidades_compra WHERE ${filters.join(' AND ')} ORDER BY publicada_em DESC, id DESC LIMIT ${limit}`, values);
      return sendJson(res, 200, rows.map(opportunityJson), { 'Cache-Control': 'public, max-age=30, s-maxage=30, stale-while-revalidate=60' });
    }
    if (url.pathname === '/api/oportunidade-tipos' && req.method === 'GET') {
      if (!rateLimit(req, res, 'opportunity-types', 120, 60 * 1000)) return;
      return sendJson(res, 200, await configuredOpportunityTypes());
    }
    const opportunityPublic = url.pathname.match(/^\/api\/oportunidades\/(\d+)$/);
    if (opportunityPublic && req.method === 'GET') {
      if (!rateLimit(req, res, 'opportunity-detail', 120, 60 * 1000)) return;
      const [[row]] = await pool.query('SELECT * FROM oportunidades_compra WHERE id=? AND status=? AND (expira_em IS NULL OR expira_em>=CURRENT_DATE)', [opportunityPublic[1], 'publicada']);
      return row ? sendJson(res, 200, opportunityJson(row), { 'Cache-Control': 'public, max-age=30, s-maxage=30, stale-while-revalidate=60' }) : sendJson(res, 404, { error: 'Oportunidade não encontrada.' });
    }
    if (url.pathname === '/api/imoveis' && req.method === 'GET') {
      if (!rateLimit(req, res, 'public-list', 120, 60 * 1000)) return;
      if (url.searchParams.has('page') || url.searchParams.has('limit')) {
        const page = Math.min(Math.max(Number.parseInt(url.searchParams.get('page') || '1', 10) || 1, 1), 10000);
        const pageSize = Math.min(Math.max(Number.parseInt(url.searchParams.get('limit') || '12', 10) || 12, 1), 24);
        const filters = [];
        const values = [];
        const query = String(url.searchParams.get('q') || '').trim().slice(0, 120);
        if (query) {
          filters.push('(i.categoria LIKE ? OR i.bairro LIKE ? OR i.endereco LIKE ? OR i.descricao LIKE ?)');
          const pattern = `%${query}%`;
          values.push(pattern, pattern, pattern, pattern);
        }
        const category = String(url.searchParams.get('categoria') || '').trim().slice(0, 100);
        if (category) { filters.push('i.categoria=?'); values.push(category); }
        const type = String(url.searchParams.get('tipo') || '').trim();
        if (['Venda', 'Aluguel', 'Permuta'].includes(type)) { filters.push('i.tipo=?'); values.push(type); }
        const range = String(url.searchParams.get('faixa') || '');
        if (range === 'ate-250000') filters.push('i.preco<=250000');
        else if (range === '250000-500000') filters.push('i.preco BETWEEN 250000 AND 500000');
        else if (range === 'acima-500000') filters.push('i.preco>500000');
        const ids = String(url.searchParams.get('ids') || '').split(',').map(value => Number(value)).filter(value => Number.isSafeInteger(value) && value > 0).slice(0, 100);
        if (url.searchParams.has('ids')) {
          if (!ids.length) filters.push('1=0');
          else { filters.push(`i.id IN (${ids.map(() => '?').join(',')})`); values.push(...ids); }
        }
        const where = filters.length ? `WHERE ${filters.join(' AND ')}` : '';
        const orderBy = ({ recentes: 'i.id DESC', antigos: 'i.id ASC', menor: 'i.preco ASC, i.id DESC', maior: 'i.preco DESC, i.id DESC' })[url.searchParams.get('ordem')] || 'i.id DESC';
        const [[count]] = await pool.query(`SELECT COUNT(*) AS total FROM imoveis i ${where}`, values);
        const columns = 'i.id,i.tipo,i.preco,i.categoria,i.endereco,i.descricao,i.latitude,i.longitude,i.tipo_usuario,i.status,i.created_at,i.transacoes,i.preco_venda,i.preco_aluguel,i.agua_inclusa,i.luz_inclusa,i.internet_inclusa,i.condominio_incluso,i.condominio_valor,i.caracteristicas,i.rua,i.numero,i.bairro,i.cidade,i.estado';
        const [rows] = await pool.query(`SELECT ${columns} FROM imoveis i ${where} ORDER BY ${orderBy} LIMIT ? OFFSET ?`, [...values, pageSize, (page - 1) * pageSize]);
        const items = await comFotos(rows);
        return sendJson(res, 200, { items, total: Number(count.total), page, pageSize, hasMore: page * pageSize < Number(count.total) }, { 'Cache-Control': 'public, max-age=30, s-maxage=30, stale-while-revalidate=60' });
      }
      const [rows] = await pool.query('SELECT * FROM imoveis ORDER BY id DESC');
      return sendJson(res, 200, await comFotos(rows), { 'Cache-Control': 'public, max-age=30, s-maxage=30, stale-while-revalidate=60' });
    }
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
      return sendJson(res, 200, await comFotos(rows), { 'Cache-Control': 'public, max-age=30, s-maxage=30, stale-while-revalidate=60' });
    }
    const propertyShare = url.pathname.match(/^\/api\/imoveis\/(\d+)\/compartilhamentos$/);
    if (propertyShare && req.method === 'POST') {
      if (!rateLimit(req, res, 'property-share', 30, 10 * 60 * 1000)) return;
      const [[property]] = await pool.query('SELECT id FROM imoveis WHERE id=?', [propertyShare[1]]);
      if (!property) return sendJson(res, 404, { error: 'Imóvel não encontrado.' });
      await pool.query('INSERT INTO imovel_compartilhamentos (imovel_id) VALUES (?)', [property.id]);
      return sendJson(res, 201, { success: true });
    }
    const detailFixed = url.pathname.match(/^\/api\/imoveis\/(\d+)$/); if (detailFixed && req.method === 'GET') { if (!rateLimit(req, res, 'public-detail', 120, 60 * 1000)) return; const [[row]] = await pool.query('SELECT * FROM imoveis WHERE id=?', [detailFixed[1]]); if (!row) return sendJson(res, 404, { error: 'Imóvel não encontrado.' }); const viewToken = cookies(req).runge_session; const viewSession = sessions.get(viewToken); const viewerId = viewSession?.expiresAt > Date.now() ? viewSession.userId : null; if (viewerId == null || Number(viewerId) !== Number(row.usuario_id)) await pool.query('INSERT INTO imovel_visualizacoes (imovel_id,usuario_id) VALUES (?,?)', [detailFixed[1], viewerId]); return sendJson(res, 200, (await comFotos([row]))[0]); }
    if (detailFixed && req.method === 'DELETE') { const id=await authenticatedUser(req,res); if (!id) return; if (!rateLimit(req,res,'property-delete',5,60*60*1000,String(id))) return; return deleteOwnedProperty(id,detailFixed[1],res); }
    const editRoute = url.pathname.match(/^\/api\/imoveis\/(\d+)$/); if (editRoute && req.method === 'PATCH') return updateProperty(req, res, editRoute[1]);
    const photoRoute = url.pathname.match(/^\/api\/imoveis\/(\d+)\/fotos$/); if (photoRoute && req.method === 'POST') return await addPropertyPhotos(req, res, photoRoute[1]);
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
    if (url.pathname === '/api/minha-conta/imoveis' && req.method === 'GET') { const id=await authenticatedUser(req,res); return id ? sendJson(res,200,await userPropertiesWithMetrics(id), { 'Cache-Control': 'private, no-store' }) : undefined; }
    if (url.pathname === '/api/perfil/alterar-email' && req.method === 'POST') { const id=await authenticatedUser(req,res); if (!id) return; if (!rateLimit(req,res,'profile-email-change',5,60*60*1000,String(id))) return; return requestEmailChange(await bodyJson(req),id,res); }
    if (url.pathname === '/api/perfil/alterar-senha' && req.method === 'POST') { const id=await authenticatedUser(req,res); if (!id) return; if (!rateLimit(req,res,'profile-password-change',5,60*60*1000,String(id))) return; return requestPasswordChange(await bodyJson(req),id,res); }
    if (url.pathname === '/api/perfil/confirmar-alteracao' && req.method === 'POST') { if (!rateLimit(req,res,'profile-change-confirm',10,60*60*1000)) return; return confirmAccountChange(await bodyJson(req),req,res); }
    if (url.pathname === '/api/logout' && req.method === 'POST') { const requestCookies = cookies(req); sessions.delete(requestCookies.runge_session); adminSessions.delete(requestCookies.admin_session); return sendJson(res,200,{success:true},{'Set-Cookie':sessionCookie(req, '', 0)}); }
    const publicContentRoute = url.pathname.match(/^\/api\/conteudos\/(politica_privacidade|termos_uso|termos_proprietario|termos_corretor_parceiro)$/);
    if (publicContentRoute && req.method === 'GET') { const [[row]] = await pool.query('SELECT chave,titulo,conteudo,versao,updated_at FROM site_conteudos WHERE chave=?',[publicContentRoute[1]]); return row ? sendJson(res,200,row) : sendJson(res,404,{error:'Conteúdo não encontrado.'}); }
    if (url.pathname === '/api/perfil' && req.method === 'GET') { const id=await authenticatedUser(req,res); if (!id) return; const [[usuario]] = await pool.query('SELECT id,nome,email,telefone,tipo_usuario,papel FROM usuarios WHERE id=? AND ativo=TRUE', [id]); return usuario ? sendJson(res,200,{usuario}) : sendJson(res,404,{error:'Conta não encontrada.'}); }
    if (url.pathname === '/api/perfil' && req.method === 'PATCH') { const id=await authenticatedUser(req,res); if (!id) return; const d=await bodyJson(req); const fields = ['nome','telefone']; const max = { nome:180, telefone:40 }; if (!d || typeof d !== 'object' || Array.isArray(d) || !fields.every(key => typeof d[key] === 'string' && d[key].trim() && d[key].length <= max[key])) return sendJson(res,400,{error:'Confira os campos obrigatórios e seus limites.'}); await pool.query('UPDATE usuarios SET nome=?,telefone=? WHERE id=?',[d.nome.trim(),d.telefone.trim(),id]); const [[usuario]] = await pool.query('SELECT id,nome,email,telefone,tipo_usuario,papel FROM usuarios WHERE id=? AND ativo=TRUE', [id]); return sendJson(res,200,{usuario}); }
    if (url.pathname === '/api/perfil' && req.method === 'DELETE') { const id=await authenticatedUser(req,res); if (!id) return; if (!rateLimit(req,res,'profile-delete',3,60*60*1000,String(id))) return; return deleteUserAccount(id,await bodyJson(req),req,res); }
    if (url.pathname === '/api/admin/login' && req.method === 'POST') { if (!rateLimit(req, res, 'admin-login', 10, 15 * 60 * 1000)) return; const data = await bodyJson(req); const [[user]] = await pool.query('SELECT * FROM admin_usuarios WHERE LOWER(email)=LOWER(?) AND ativo=TRUE LIMIT 1', [data?.email || '']); const ok = await verifyPassword(data?.senha, user?.senha_hash); if (!user || !ok) return sendJson(res,401,{error:'Usuário ou senha administrativos inválidos.'}); const token = crypto.randomBytes(32).toString('hex'); adminSessions.set(token,{userId:user.id,expiresAt:Date.now()+SESSION_TIMEOUT}); return sendJson(res,200,{usuario:{id:user.id,email:user.email}},{'Set-Cookie':adminCookie(token)}); }
    if (url.pathname === '/api/admin/logout' && req.method === 'POST') { adminSessions.delete(cookies(req).admin_session); return sendJson(res,200,{success:true},{'Set-Cookie':adminCookie('',0)}); }
    if (url.pathname === '/api/admin/dashboard' && req.method === 'GET') {
      const admin = await adminUser(req, res); if (!admin) return;
      const requestedMonth = url.searchParams.get('mes');
      if (requestedMonth && !/^\d{4}-(0[1-9]|1[0-2])$/.test(requestedMonth)) return sendJson(res, 400, { error: 'Informe um mês de referência válido.' });
      const currentMonthParts = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit' }).formatToParts(new Date());
      const currentMonth = `${currentMonthParts.find(part => part.type === 'year').value}-${currentMonthParts.find(part => part.type === 'month').value}`;
      const period = requestedMonth || currentMonth;
      const [periodYear, periodMonth] = period.split('-').map(Number);
      const periodStart = `${period}-01 00:00:00`;
      const periodEnd = `${new Date(Date.UTC(periodYear, periodMonth, 1)).toISOString().slice(0, 10)} 00:00:00`;
      const [[users]] = await pool.query('SELECT COUNT(*) total FROM usuarios');
      const [[properties]] = await pool.query('SELECT COUNT(*) total FROM imoveis');
      const [latest] = await pool.query('SELECT i.id,i.categoria,i.tipo,i.created_at,u.nome AS anunciante FROM imoveis i LEFT JOIN usuarios u ON u.id=i.usuario_id ORDER BY i.created_at DESC,i.id DESC LIMIT 8');
      const [activity] = await pool.query(`SELECT DATE_FORMAT(created_at, '%Y-%m-%d') AS dia, COUNT(*) AS acessos, 0 AS interesses
        FROM imovel_visualizacoes WHERE created_at >= ? AND created_at < ? GROUP BY DATE_FORMAT(created_at, '%Y-%m-%d')
        UNION ALL
        SELECT DATE_FORMAT(created_at, '%Y-%m-%d') AS dia, 0 AS acessos, COUNT(*) AS interesses
        FROM contatos WHERE created_at >= ? AND created_at < ? GROUP BY DATE_FORMAT(created_at, '%Y-%m-%d')`, [periodStart, periodEnd, periodStart, periodEnd]);
      const activityByDay = new Map();
      for (const row of activity) {
        const current = activityByDay.get(row.dia) || { acessos: 0, interesses: 0 };
        current.acessos += Number(row.acessos || 0);
        current.interesses += Number(row.interesses || 0);
        activityByDay.set(row.dia, current);
      }
      const daysInPeriod = new Date(Date.UTC(periodYear, periodMonth, 0)).getUTCDate();
      const serieDiaria = Array.from({ length: daysInPeriod }, (_, index) => {
        const dia = `${period}-${String(index + 1).padStart(2, '0')}`;
        return { dia, ...(activityByDay.get(dia) || { acessos: 0, interesses: 0 }) };
      });
      const acessosMes = serieDiaria.reduce((total, day) => total + day.acessos, 0);
      const interessesMes = serieDiaria.reduce((total, day) => total + day.interesses, 0);
      const [popular] = await pool.query(`SELECT i.id,i.categoria,i.tipo,COUNT(v.id) AS acessos
        FROM imoveis i LEFT JOIN imovel_visualizacoes v ON v.imovel_id=i.id AND v.created_at >= ? AND v.created_at < ?
        GROUP BY i.id ORDER BY acessos DESC,i.id DESC LIMIT 8`, [periodStart, periodEnd]);
      return sendJson(res, 200, { usuario: admin, periodo: period, mesAtual: currentMonth, metricas: { usuarios: Number(users.total), imoveis: Number(properties.total), acessosMes, contatosMes: interessesMes }, serieDiaria, ultimos: latest, populares: popular });
    }
    if (url.pathname === '/api/admin/oportunidades' && req.method === 'GET') { const admin = await adminUser(req, res); if (!admin) return; const [rows] = await pool.query('SELECT * FROM oportunidades_compra ORDER BY created_at DESC,id DESC'); return sendJson(res, 200, rows.map(opportunityJson)); }
    const opportunityMatch = url.pathname.match(/^\/api\/admin\/oportunidades\/([0-9]+)\/compatibilidades\/?$/);
    if (opportunityMatch && req.method === 'GET') {
      const admin = await adminUser(req, res); if (!admin) return;
      if (!rateLimit(req, res, 'admin-opportunity-match', 30, 60 * 1000)) return;
      const [[row]] = await pool.query('SELECT * FROM oportunidades_compra WHERE id=?', [opportunityMatch[1]]);
      if (!row) return sendJson(res, 404, { error: 'Oportunidade não encontrada.' });
      const [properties] = await pool.query(`SELECT id,categoria,tipo,transacoes,preco,preco_venda,preco_aluguel,estado,cidade,bairro,descricao,caracteristicas
        FROM imoveis ORDER BY created_at DESC,id DESC`);
      return sendJson(res, 200, OpportunityMatching.scoreOpportunityMatches(opportunityJson(row), properties));
    }
    if (url.pathname === '/api/admin/oportunidades/tipos' && req.method === 'GET') { const admin = await adminUser(req, res); if (!admin) return; const [rows] = await pool.query('SELECT id,nome,ativo,created_at FROM oportunidade_tipos_imovel WHERE ativo=TRUE ORDER BY nome'); return sendJson(res, 200, rows); }
    if (url.pathname === '/api/admin/oportunidades/tipos' && req.method === 'POST') {
      const admin = await adminUser(req, res); if (!admin) return;
      const data = await bodyJson(req, 16 * 1024); const nome = typeof data?.nome === 'string' ? data.nome.trim() : '';
      if (!nome || nome.length > 80) return sendJson(res, 400, { error: 'Informe um tipo de imóvel com até 80 caracteres.' });
      try { const [result] = await pool.query('INSERT INTO oportunidade_tipos_imovel (nome,criado_por_admin) VALUES (?,?)', [nome, admin.id]); await audit(admin.id, 'criar', 'tipo_oportunidade', result.insertId, { nome }); return sendJson(res, 201, { id: result.insertId, nome, ativo: true }); }
      catch (error) { if (error.code === 'ER_DUP_ENTRY') return sendJson(res, 409, { error: 'Esse tipo de imóvel já está cadastrado.' }); throw error; }
    }
    if (url.pathname === '/api/admin/oportunidades' && req.method === 'POST') { const admin = await adminUser(req, res); if (!admin) return; return await saveOpportunity(req, res, null, admin.id); }
    const adminOpportunity = url.pathname.match(/^\/api\/admin\/oportunidades\/(\d+)$/);
    if (adminOpportunity && req.method === 'PATCH') { const admin = await adminUser(req, res); if (!admin) return; return await saveOpportunity(req, res, adminOpportunity[1], admin.id); }
    if (adminOpportunity && req.method === 'DELETE') { const admin = await adminUser(req, res); if (!admin) return; const [result] = await pool.query('DELETE FROM oportunidades_compra WHERE id=?', [adminOpportunity[1]]); if (!result.affectedRows) return sendJson(res, 404, { error: 'Oportunidade não encontrada.' }); await audit(admin.id, 'excluir', 'oportunidade', adminOpportunity[1]); return sendJson(res, 200, { success: true }); }
    if (url.pathname === '/api/admin/imoveis' && req.method === 'GET') {
      const admin = await adminUser(req, res); if (!admin) return;
      const [rows] = await pool.query(`SELECT i.*,u.nome AS anunciante,
        (SELECT COUNT(*) FROM imovel_visualizacoes v WHERE v.imovel_id=i.id) AS total_visualizacoes,
        (SELECT COUNT(*) FROM imovel_compartilhamentos s WHERE s.imovel_id=i.id) AS total_compartilhamentos,
        (SELECT COUNT(*) FROM contatos c WHERE c.imovel_id=i.id) AS total_interesses
        FROM imoveis i LEFT JOIN usuarios u ON u.id=i.usuario_id ORDER BY i.created_at DESC,i.id DESC`);
      const properties = await comFotos(rows);
      for (let index = 0; index < properties.length; index += 1) {
        properties[index].metricas = {
          visualizacoes: Number(rows[index].total_visualizacoes || 0),
          compartilhamentos: Number(rows[index].total_compartilhamentos || 0),
          interesses: Number(rows[index].total_interesses || 0)
        };
      }
      return sendJson(res, 200, properties);
    }
    const adminPropertyStatus = url.pathname.match(/^\/api\/admin\/imoveis\/(\d+)\/status$/);
    if (adminPropertyStatus && req.method === 'PATCH') {
      const admin = await adminUser(req, res); if (!admin) return;
      const data = await bodyJson(req, 16 * 1024);
      const status = normalizePropertyStatus(data?.status);
      if (!status) return sendJson(res, 400, { error: 'Selecione um status válido para o imóvel.' });
      const [[property]] = await pool.query('SELECT id,status FROM imoveis WHERE id=?', [adminPropertyStatus[1]]);
      if (!property) return sendJson(res, 404, { error: 'Imóvel não encontrado.' });
      if (property.status !== status) {
        await pool.query('UPDATE imoveis SET status=? WHERE id=?', [status, property.id]);
        await audit(admin.id, 'alterar_status', 'imovel', property.id, { antes: property.status || 'disponivel', depois: status });
      }
      return sendJson(res, 200, { success: true, status });
    }
    const adminProperty = url.pathname.match(/^\/api\/admin\/imoveis\/(\d+)$/);
    if (adminProperty && req.method === 'GET') { const admin = await adminUser(req, res); if (!admin) return; const [[row]] = await pool.query('SELECT * FROM imoveis WHERE id=?', [adminProperty[1]]); if (!row) return sendJson(res, 404, { error: 'Imóvel não encontrado.' }); const [historico] = await pool.query("SELECT a.id,a.acao,a.detalhes,a.created_at,u.email AS administrador FROM admin_auditoria a LEFT JOIN admin_usuarios u ON u.id=a.usuario_id WHERE a.entidade='imovel' AND a.entidade_id=? ORDER BY a.created_at DESC,a.id DESC", [adminProperty[1]]); return sendJson(res, 200, { ...(await comFotos([row]))[0], historico }); }
    if (adminProperty && req.method === 'PATCH') { const admin = await adminUser(req, res); if (!admin) return; return updateProperty(req, res, adminProperty[1], admin.id); }
    const adminPhotoRoute = url.pathname.match(/^\/api\/admin\/imoveis\/(\d+)\/fotos(?:\/(\d+))?$/);
    if (adminPhotoRoute && req.method === 'POST' && !adminPhotoRoute[2]) { const admin = await adminUser(req, res); if (!admin) return; return await addPropertyPhotos(req, res, adminPhotoRoute[1], admin.id); }
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
    if (url.pathname === '/api/admin/configuracoes/email' && req.method === 'GET') { const admin = await adminUser(req, res); if (!admin) return; const settings = await loadSmtpSettings(); const provider = emailProvider(settings || {}); return sendJson(res, 200, { configurado: Boolean(settings && emailConfigured(settings)), provedor: provider, host: settings?.SMTP_HOST || '', port: settings?.SMTP_PORT || 587, secure: Boolean(settings?.SMTP_SECURE), usuario: settings?.SMTP_USER || '', remetente: settings?.SMTP_FROM || '', appUrl: process.env.APP_PUBLIC_URL || '' }); }
    if (url.pathname === '/api/admin/configuracoes/email' && req.method === 'PATCH') {
      const admin = await adminUser(req, res); if (!admin) return;
      const data = await bodyJson(req); const current = await loadSmtpSettings(); const port = Number(data?.port);
      const provider = data?.provedor === 'sendgrid' ? 'sendgrid' : data?.provedor === 'smtp' ? 'smtp' : '';
      if (!data || !provider || typeof data.remetente !== 'string' || !data.remetente.trim() || data.remetente.length > 255 || (data.senha !== undefined && typeof data.senha !== 'string') || (data.senha !== undefined && data.senha.length > 4096)) return sendJson(res, 400, { error: 'Informe o provedor e um remetente válido.' });
      let settings;
      if (provider === 'sendgrid') {
        const apiKey = data.senha || current?.SENDGRID_API_KEY;
        if (!apiKey || typeof apiKey !== 'string' || !apiKey.trim()) return sendJson(res, 400, { error: 'Informe a chave da API do SendGrid na primeira configuração.' });
        settings = { EMAIL_PROVIDER: 'sendgrid', SENDGRID_API_KEY: apiKey.trim(), SMTP_FROM: data.remetente.trim() };
      } else {
        const port = Number(data.porta);
        if (typeof data.host !== 'string' || !data.host.trim() || data.host.length > 255 || !Number.isInteger(port) || port < 1 || port > 65535 || typeof data.usuario !== 'string' || !data.usuario.trim() || data.usuario.length > 255 || typeof data.seguro !== 'boolean') return sendJson(res, 400, { error: 'Preencha corretamente os dados do SMTP.' });
        if (!data.senha && !current?.SMTP_PASS) return sendJson(res, 400, { error: 'Informe a senha do SMTP na primeira configuração.' });
        settings = { EMAIL_PROVIDER: 'smtp', SMTP_HOST: data.host.trim(), SMTP_PORT: port, SMTP_SECURE: data.seguro, SMTP_USER: data.usuario.trim(), SMTP_PASS: data.senha || current?.SMTP_PASS, SMTP_FROM: data.remetente.trim() };
      }
      await pool.query('INSERT INTO admin_configuracoes (chave,valor,atualizado_por) VALUES (?,?,?) ON DUPLICATE KEY UPDATE valor=VALUES(valor),atualizado_por=VALUES(atualizado_por)', ['smtp', encryptSettings(settings), admin.id]); await audit(admin.id, 'configurar', provider === 'sendgrid' ? 'sendgrid' : 'smtp');
      return sendJson(res, 200, { configurado: true, provedor: provider, host: settings.SMTP_HOST || '', port: settings.SMTP_PORT || 587, secure: Boolean(settings.SMTP_SECURE), usuario: settings.SMTP_USER || '', remetente: settings.SMTP_FROM, appUrl: process.env.APP_PUBLIC_URL || '' });
    }
    if (url.pathname === '/api/admin/configuracoes/email/teste' && req.method === 'POST') {
      const admin = await adminUser(req, res); if (!admin) return;
      if (!rateLimit(req, res, 'admin-email-test', 5, 15 * 60 * 1000, `admin:${admin.id}`)) return;
      const data = await bodyJson(req, 16 * 1024);
      const email = typeof data?.email === 'string' ? data.email.trim().toLowerCase() : '';
      if (!email || email.length > 180 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return sendJson(res, 400, { error: 'Informe um e-mail válido para receber o teste.' });
      const smtp = await loadSmtpSettings();
      if (!emailConfigured(smtp || {})) return sendJson(res, 400, { error: 'Configure e salve o serviço de e-mail antes de enviar um teste.' });
      try {
        const result = await sendTestEmail({ email }, smtp);
        await audit(admin.id, 'testar', 'smtp', null, { destinatario: email, messageId: result.messageId || null });
        return sendJson(res, 200, { success: true, message: 'E-mail de teste enviado. Verifique a caixa de entrada e o spam.', messageId: result.messageId || null });
      } catch (error) {
        const diagnostic = diagnoseSmtpError(error);
        console.error('Falha no teste de e-mail:', { provedor: emailProvider(smtp), host: smtp.SMTP_HOST, port: smtp.SMTP_PORT, secure: smtp.SMTP_SECURE, codigo: diagnostic.codigo, etapa: diagnostic.etapa, comando: diagnostic.comando, mensagem: diagnostic.mensagem });
        await audit(admin.id, 'falha_teste', 'smtp', null, { destinatario: email, etapa: diagnostic.etapa, codigo: diagnostic.codigo });
        return sendJson(res, 502, { error: diagnostic.mensagem, diagnostico: diagnostic });
      }
    }
    const contentRoute = url.pathname.match(/^\/api\/admin\/conteudos\/(politica_privacidade|termos_uso|termos_proprietario|termos_corretor_parceiro)$/);
    if (contentRoute && req.method === 'GET') { const admin = await adminUser(req, res); if (!admin) return; const [[row]] = await pool.query('SELECT * FROM site_conteudos WHERE chave=?', [contentRoute[1]]); return row ? sendJson(res, 200, row) : sendJson(res, 404, { error: 'Conteúdo não encontrado.' }); }
    if (contentRoute && req.method === 'PATCH') { const admin = await adminUser(req, res); if (!admin) return; const data = await bodyJson(req, 256 * 1024); if (!data || typeof data.conteudo !== 'string' || !data.conteudo.trim() || data.conteudo.length > 200000) return sendJson(res,400,{error:'O conteúdo é obrigatório e deve ter até 200 mil caracteres.'}); await pool.query('UPDATE site_conteudos SET conteudo=?,versao=versao+1,atualizado_por=? WHERE chave=?',[data.conteudo.trim(),admin.id,contentRoute[1]]); await audit(admin.id,'editar','conteudo',contentRoute[1]); const [[row]] = await pool.query('SELECT * FROM site_conteudos WHERE chave=?',[contentRoute[1]]); return sendJson(res,200,row); }
    const contact = url.pathname.match(/^\/api\/imoveis\/(\d+)\/contatos$/); if (contact && req.method === 'POST') { if (!rateLimit(req, res, 'contact', 5, 15 * 60 * 1000)) return; const d=await bodyJson(req, 64 * 1024); if (!d || typeof d.nome !== 'string' || !d.nome.trim() || d.nome.length > 180 || typeof d.telefone !== 'string' || !d.telefone.trim() || d.telefone.length > 40 || typeof d.email !== 'string' || d.email.length > 180 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(d.email) || !(d.aceite_privacidade === true || d.aceite_privacidade === 'true')) return sendJson(res,400,{error:'Preencha os dados corretamente e aceite a Política de Privacidade.'}); const [[property]]=await pool.query('SELECT id FROM imoveis WHERE id=?',[contact[1]]); if(!property) return sendJson(res,404,{error:'Imóvel não encontrado.'}); const [result]=await pool.query('INSERT INTO contatos (imovel_id,nome,telefone,email,privacidade_versao,privacidade_aceita_em) VALUES (?,?,?, ?, ?, NOW())',[contact[1],d.nome.trim(),d.telefone.trim(),d.email.trim().toLowerCase(),PRIVACY_POLICY_VERSION]); return sendJson(res,201,{id:result.insertId,message:'Contato registrado com sucesso.'}); }
    if (url.pathname === '/imovel' && ['GET', 'HEAD'].includes(req.method)) {
      const propertyId = url.searchParams.get('id') || '';
      if (/^\d+$/.test(propertyId) && Number.isSafeInteger(Number(propertyId)) && Number(propertyId) > 0) {
        const [[property]] = await pool.query('SELECT * FROM imoveis WHERE id=?', [propertyId]);
        if (property) {
          const [[photo]] = await pool.query('SELECT caminho FROM imovel_fotos WHERE imovel_id=? ORDER BY ordem,id LIMIT 1', [propertyId]);
          const tags = PropertyOpenGraph.criarTags(property, photo?.caminho || '', process.env.APP_PUBLIC_URL || '', PropertyDescription.resumo(property.descricao));
          if (tags) {
            const pageFile = path.join(webRoot, 'imovel.html');
            const titleTag = tags.match(/^<title>[\s\S]*?<\/title>/)?.[0] || '';
            const metadata = tags.slice(titleTag.length);
            const html = fs.readFileSync(pageFile, 'utf8')
              .replace(/<title>[\s\S]*?<\/title>/i, titleTag)
              .replace('</head>', `${metadata}</head>`);
            res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'public, max-age=60' });
            return req.method === 'HEAD' ? res.end() : res.end(html);
          }
        }
      }
    }
    if (url.pathname === '/api/imoveis' && req.method === 'POST') return criarImovelJson(req, res);
    const cleanRoute = url.pathname === '/' ? '/index.html' : url.pathname;
    const relative = cleanRoute.endsWith('.html') || path.extname(cleanRoute) ? cleanRoute : `${cleanRoute}.html`;
    const file=path.resolve(webRoot,'.'+relative); if(!file.startsWith(`${webRoot}${path.sep}`)||!fs.existsSync(file)||fs.statSync(file).isDirectory()) return sendJson(res,404,{error:'Arquivo não encontrado.'}); return sendStatic(req, res, file);
  } catch (error) { if (error.code === 'ER_DUP_ENTRY') return sendJson(res, 409, { error: 'Este e-mail já está cadastrado.' }); if (error.statusCode && error.statusCode < 500) return sendJson(res, error.statusCode, { error: error.message }); if (error.statusCode === 503) return sendJson(res, 503, { error: error.message }); console.error(error); if(!res.headersSent) sendJson(res,500,{error:'Erro interno do servidor.'}); }
});
server.headersTimeout = 15_000;
server.requestTimeout = 120_000;
server.keepAliveTimeout = 5_000;
runMigrations(pool).then(()=>ensureAdminAccount()).then(()=>server.listen(port,()=>console.log(`Imobiliária Runge disponível em http://localhost:${port}`))).catch(error=>{console.error('Falha ao executar migrations do MySQL:',error);process.exit(1);});
