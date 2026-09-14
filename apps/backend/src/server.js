const http = require('http');
const { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const mysql = require('mysql2/promise');
const PropertyOffers = require('../../../packages/shared/property-offers');
const { runMigrations } = require('./migrate');

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
const sessions = new Map();
const pool = mysql.createPool({
  host: process.env.DB_HOST || '127.0.0.1',
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.MYSQL_USER || 'runge_app',
  password: process.env.MYSQL_PASSWORD || '',
  database: process.env.MYSQL_DATABASE || 'imobiliaria_runge',
  waitForConnections: true,
  connectionLimit: 10
});
const mimeTypes = { '.html':'text/html; charset=utf-8', '.css':'text/css; charset=utf-8', '.js':'text/javascript; charset=utf-8', '.json':'application/json; charset=utf-8', '.png':'image/png', '.jpg':'image/jpeg', '.svg':'image/svg+xml' };

function descricaoSegura(value) { return String(value || '').replace(/<\/?(script|style|iframe)[^>]*>/gi, '').replace(/\s(?:on\w+|style|href|src)\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, '').replace(/<(?!\/?(?:strong|b|em|i|u|ul|ol|li|p|br)(?:\s|>))[^>]*>/gi, ''); }
function imovelJson(row) { let caracteristicas = row.caracteristicas || {}; if (typeof caracteristicas === 'string') { try { caracteristicas = JSON.parse(caracteristicas) || {}; } catch (_) { caracteristicas = {}; } } const tipos = PropertyOffers.normalizeTypes(row.transacoes, row.tipo); const preco = Number(row.preco); const precoVenda = row.preco_venda == null ? (tipos.includes('Venda') ? preco : null) : Number(row.preco_venda); const precoAluguel = row.preco_aluguel == null ? (tipos.includes('Aluguel') ? preco : null) : Number(row.preco_aluguel); return { ...row, titulo: PropertyOffers.displayTitle({ ...row, tipos_transacao: tipos }), transacoes: tipos, tipos_transacao: tipos, preco_venda: precoVenda, preco_aluguel: precoAluguel, agua_inclusa: Boolean(row.agua_inclusa), luz_inclusa: Boolean(row.luz_inclusa), internet_inclusa: Boolean(row.internet_inclusa), condominio_incluso: Boolean(row.condominio_incluso), caracteristicas, descricao: descricaoSegura(row.descricao), preco, coordenadas: { latitude: Number(row.latitude), longitude: Number(row.longitude) } }; }
async function comFotos(rows) {
  if (!rows.length) return [];
  const ids = rows.map((row) => row.id);
  const [fotos] = await pool.query(`SELECT id, imovel_id, caminho, nome_original FROM imovel_fotos WHERE imovel_id IN (${ids.map(() => '?').join(',')}) ORDER BY ordem, id`, ids);
  const porImovel = new Map(ids.map((id) => [id, []]));
  fotos.forEach((foto) => porImovel.get(foto.imovel_id)?.push({ id: foto.id, url: foto.caminho, nome: foto.nome_original }));
  return rows.map((row) => ({ ...imovelJson(row), fotos: porImovel.get(row.id) || [] }));
}
function sendJson(res, status, data, headers = {}) { res.writeHead(status, { 'Content-Type':'application/json; charset=utf-8', ...headers }); res.end(JSON.stringify(data)); }
function bodyJson(req) { return new Promise((resolve, reject) => { let body=''; req.on('data', chunk => body += chunk); req.on('end', () => { try { resolve(JSON.parse(body || '{}')); } catch (e) { reject(e); } }); }); }
function parseMultipart(req) {
  return new Promise((resolve, reject) => {
    const match = (req.headers['content-type'] || '').match(/boundary=(?:"([^"]+)"|([^;]+))/i); if (!match) return reject(new Error('boundary-missing'));
    const boundary = Buffer.from(`--${match[1] || match[2]}`); const chunks = []; let total = 0; const maxSize = 40 * 1024 * 1024;
    req.on('data', (chunk) => { total += chunk.length; if (total > maxSize) { req.destroy(); reject(new Error('upload-too-large')); } else chunks.push(chunk); }); req.on('error', reject);
    req.on('end', () => { try { const body = Buffer.concat(chunks); const fields = {}; const files = []; let cursor = 0; while ((cursor = body.indexOf(boundary, cursor)) !== -1) { cursor += boundary.length; if (body.slice(cursor, cursor + 2).toString() === '--') break; if (body.slice(cursor, cursor + 2).toString() === '\r\n') cursor += 2; const next = body.indexOf(boundary, cursor); if (next === -1) break; const part = body.slice(cursor, next - 2); const separator = part.indexOf(Buffer.from('\r\n\r\n')); if (separator === -1) continue; const headers = part.slice(0, separator).toString(); const value = part.slice(separator + 4); const disposition = headers.match(/content-disposition:\s*[^\r\n]*?\bname="([^"]+)"(?:;\s*filename="([^"]*)")?/i); if (!disposition) continue; if (disposition[2]) files.push({ name: disposition[1], filename: path.basename(disposition[2]), mimetype: (headers.match(/content-type:\s*([^\r\n]+)/i) || [])[1] || '', buffer: value }); else fields[disposition[1]] = value.toString(); cursor = next; } resolve({ fields, files }); } catch (error) { reject(error); } });
  });
}
function imageExtension(file) {
  const allowed = { 'image/jpeg': '.jpg', 'image/jpg': '.jpg', 'image/png': '.png', 'image/webp': '.webp' };
  return allowed[String(file.mimetype || '').trim().toLowerCase()] || ({ '.jpg': '.jpg', '.jpeg': '.jpg', '.png': '.png', '.webp': '.webp' }[path.extname(file.filename || '').toLowerCase()] || null);
}
function photoObjectKey(propertyId, title, filename) { return `imoveis/${propertyId}-${folderSlug(title)}/${filename}`; }
async function savePhoto(file, key) {
  if (r2Enabled) { await r2Client.send(new PutObjectCommand({ Bucket: process.env.R2_BUCKET_NAME, Key: key, Body: file.buffer, ContentType: file.mimetype || 'application/octet-stream' })); return r2PublicUrl ? `${r2PublicUrl}/${key}` : `/r2/${encodeURIComponent(key)}`; }
  const localPath = path.join(photosDir, key.replace(/^imoveis\//, '').replaceAll('/', path.sep)); fs.mkdirSync(path.dirname(localPath), { recursive: true }); fs.writeFileSync(localPath, file.buffer); return `/Fotos_imoveis/${key.replace(/^imoveis\//, '')}`;
}
async function removePhoto(caminho) {
  if (r2Enabled && caminho.startsWith(r2PublicUrl + '/')) return r2Client.send(new DeleteObjectCommand({ Bucket: process.env.R2_BUCKET_NAME, Key: caminho.slice(r2PublicUrl.length + 1) }));
  const file = path.resolve(dataDir, `.${caminho}`); if (file.startsWith(path.resolve(photosDir)) && fs.existsSync(file)) fs.unlinkSync(file);
}
function folderSlug(value) { return String(value || 'imovel').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60) || 'imovel'; }
function cookies(req) { return Object.fromEntries((req.headers.cookie || '').split(';').filter(Boolean).map(x => x.trim().split('=').map(decodeURIComponent))); }
async function userPayload(id) { const [[usuario]] = await pool.query('SELECT id,nome,email,telefone,cep,rua,numero,bairro,cidade,estado,tipo_usuario,creci,cnpj FROM usuarios WHERE id=?', [id]); const [rows] = await pool.query('SELECT * FROM imoveis WHERE usuario_id=? ORDER BY id DESC', [id]); return { usuario, imoveis: await comFotos(rows) }; }
async function authenticatedUser(req, res) { const token = cookies(req).runge_session; const session = sessions.get(token); if (!session || session.expiresAt < Date.now()) { if (token) sessions.delete(token); sendJson(res, 401, { error:'Sessão expirada.' }); return null; } session.expiresAt = Date.now() + SESSION_TIMEOUT; return session.userId; }

async function ownedProperty(req, res, propertyId) { const userId = await authenticatedUser(req, res); if (!userId) return null; const [[property]] = await pool.query('SELECT * FROM imoveis WHERE id=? AND usuario_id=?', [propertyId, userId]); if (!property) { sendJson(res, 404, { error: 'ImÃ³vel nÃ£o encontrado.' }); return null; } return { userId, property }; }
function parsePropertyOffer(data) {
  return PropertyOffers.parse(data);
}
function validPropertyOffer(offer) { return PropertyOffers.isValid(offer); }
async function updateProperty(req, res, propertyId) {
  const owned = await ownedProperty(req, res, propertyId); if (!owned) return;
  const d = await bodyJson(req); const offer = parsePropertyOffer(d);
  if (!d.categoria || !validPropertyOffer(offer) || !d.endereco || !d.latitude || !d.longitude) return sendJson(res, 400, { error: 'Preencha os campos obrigatórios, informe os valores e indique o valor do condomínio quando ele não estiver incluso.' });
  await pool.query('UPDATE imoveis SET tipo=?,transacoes=?,preco=?,preco_venda=?,preco_aluguel=?,agua_inclusa=?,luz_inclusa=?,internet_inclusa=?,condominio_incluso=?,condominio_valor=?,categoria=?,endereco=?,cep=?,rua=?,numero=?,bairro=?,cidade=?,estado=?,descricao=?,caracteristicas=?,latitude=?,longitude=? WHERE id=?', [offer.type, JSON.stringify(offer.types), offer.price, offer.sale, offer.rent, offer.water, offer.power, offer.internet, offer.condo, offer.condoAmount, d.categoria, d.endereco, d.cep || '', d.rua || '', d.numero || '', d.bairro || '', d.cidade || '', d.estado || '', descricaoSegura(d.descricao), JSON.stringify(d.caracteristicas || {}), Number(d.latitude), Number(d.longitude), propertyId]);
  const [[row]] = await pool.query('SELECT * FROM imoveis WHERE id=?', [propertyId]);
  return sendJson(res, 200, (await comFotos([row]))[0]);
}
async function addPropertyPhotos(req, res, propertyId) {
  const owned = await ownedProperty(req, res, propertyId); if (!owned) return;
  const parsed = await parseMultipart(req);
  const displayTitle = PropertyOffers.displayTitle(owned.property);
  const folderName = `imovel-${propertyId}-${folderSlug(displayTitle)}`;
  const folder = path.join(photosDir, folderName); fs.mkdirSync(folder, { recursive: true });
  const [[last]] = await pool.query('SELECT COALESCE(MAX(ordem), -1) AS ordem FROM imovel_fotos WHERE imovel_id=?', [propertyId]);
  const fotos = parsed.files.filter((file) => file.name === 'fotos').slice(0, 10);
  let uploaded = 0;
  for (const foto of fotos) {
    const ext = imageExtension(foto); if (!ext || !foto.buffer.length || foto.buffer.length > 5 * 1024 * 1024) continue;
    const filename = `${crypto.randomBytes(16).toString('hex')}${ext}`;
    const caminho = await savePhoto(foto, photoObjectKey(propertyId, displayTitle, filename));
    await pool.query('INSERT INTO imovel_fotos (imovel_id,caminho,nome_original,ordem) VALUES (?,?,?,?)', [propertyId, caminho, foto.filename, Number(last.ordem) + uploaded + 1]);
    uploaded += 1;
  }
  if (!uploaded) return sendJson(res, 400, { error: 'Nenhuma foto válida foi recebida. Use JPG, PNG ou WEBP de até 5 MB.' });
  const [[row]] = await pool.query('SELECT * FROM imoveis WHERE id=?', [propertyId]);
  return sendJson(res, 200, { ...(await comFotos([row]))[0], uploaded });
}
async function deletePropertyPhoto(req, res, propertyId, photoId) { const owned = await ownedProperty(req, res, propertyId); if (!owned) return; const [[photo]] = await pool.query('SELECT * FROM imovel_fotos WHERE id=? AND imovel_id=?', [photoId, propertyId]); if (!photo) return sendJson(res, 404, { error: 'Foto nÃ£o encontrada.' }); const file = path.resolve(dataDir, `.${photo.caminho}`); if (file.startsWith(path.resolve(photosDir)) && fs.existsSync(file)) fs.unlinkSync(file); await pool.query('DELETE FROM imovel_fotos WHERE id=?', [photoId]); return sendJson(res, 200, { success: true }); }
async function criarImovelComFotos(req, res) {
  const parsed = await parseMultipart(req); const d = parsed.fields; const sessionUser = cookies(req).runge_session; let userId = null;
  const offer = parsePropertyOffer(d);
  if (!d.categoria || !validPropertyOffer(offer) || !d.endereco || !d.latitude || !d.longitude) return sendJson(res, 400, { error: 'Preencha os campos obrigatórios e informe um valor para cada modalidade escolhida.' });
  const titulo = PropertyOffers.displayTitle({ ...d, tipos_transacao: offer.types });
  if (sessionUser) userId = await authenticatedUser(req, res); if (sessionUser && !userId) return;
  if (!userId) { if (!d.email_usuario || !/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/.test(d.senha_usuario || '')) return sendJson(res, 400, { error: 'E-mail ou senha invÃ¡lidos.' }); const salt = crypto.randomBytes(16).toString('hex'); const hash = `${salt}:${crypto.scryptSync(d.senha_usuario, salt, 64).toString('hex')}`; const [u] = await pool.query('INSERT INTO usuarios (tipo_usuario,nome,telefone,email,senha_hash,cep,rua,numero,bairro,cidade,estado,creci,cnpj) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)', [d.tipo_usuario, d.nome_usuario, d.telefone_usuario, d.email_usuario, hash, d.cep_usuario, d.rua_usuario, d.numero_usuario, d.bairro_usuario, d.cidade_usuario, d.estado_usuario, d.creci_usuario || '', d.cnpj_usuario || '']); userId = u.insertId; }
  const [result] = await pool.query('INSERT INTO imoveis (tipo,transacoes,preco,preco_venda,preco_aluguel,agua_inclusa,luz_inclusa,internet_inclusa,condominio_incluso,condominio_valor,categoria,endereco,cep,rua,numero,bairro,cidade,estado,descricao,caracteristicas,latitude,longitude,tipo_usuario,usuario_id) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)', [offer.type, JSON.stringify(offer.types), offer.price, offer.sale, offer.rent, offer.water, offer.power, offer.internet, offer.condo, offer.condoAmount, d.categoria, d.endereco, d.cep || '', d.rua || '', d.numero || '', d.bairro || '', d.cidade || '', d.estado || '', descricaoSegura(d.descricao), d.caracteristicas || '{}', Number(d.latitude), Number(d.longitude), d.tipo_usuario || 'ProprietÃ¡rio Direto', userId]);
  const fotos = parsed.files.filter((file) => file.name === 'fotos').slice(0, 10);
  for (let ordem = 0; ordem < fotos.length; ordem += 1) { const foto = fotos[ordem]; const ext = imageExtension(foto); if (!ext || !foto.buffer.length || foto.buffer.length > 5 * 1024 * 1024) continue; const filename = `${crypto.randomBytes(16).toString('hex')}${ext}`; const caminho = await savePhoto(foto, photoObjectKey(result.insertId, titulo, filename)); await pool.query('INSERT INTO imovel_fotos (imovel_id,caminho,nome_original,ordem) VALUES (?,?,?,?)', [result.insertId, caminho, foto.filename, ordem]); }
  const [[row]] = await pool.query('SELECT * FROM imoveis WHERE id=?', [result.insertId]); return sendJson(res, 201, (await comFotos([row]))[0]);
}
async function criarImovelJson(req, res) {
  const d = await bodyJson(req); const offer = parsePropertyOffer(d); const sessionUser = cookies(req).runge_session; let userId = null;
  if (!d.categoria || !validPropertyOffer(offer) || !d.endereco || !d.latitude || !d.longitude) return sendJson(res, 400, { error: 'Preencha os dados obrigatórios do imóvel.' });
  if (sessionUser) userId = await authenticatedUser(req, res); if (sessionUser && !userId) return;
  if (!userId) {
    if (!d.tipo_usuario || !d.nome_usuario || !d.telefone_usuario || !d.email_usuario || !/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/.test(d.senha_usuario || '')) return sendJson(res, 400, { error: 'Preencha os dados do anunciante e use uma senha forte.' });
    const salt = crypto.randomBytes(16).toString('hex'); const hash = `${salt}:${crypto.scryptSync(d.senha_usuario, salt, 64).toString('hex')}`;
    const [user] = await pool.query('INSERT INTO usuarios (tipo_usuario,nome,telefone,email,senha_hash,cep,rua,numero,bairro,cidade,estado,creci,cnpj) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)', [d.tipo_usuario, d.nome_usuario, d.telefone_usuario, d.email_usuario, hash, d.cep_usuario || '', d.rua_usuario || '', d.numero_usuario || '', d.bairro_usuario || '', d.cidade_usuario || '', d.estado_usuario || '', d.creci_usuario || '', d.cnpj_usuario || '']); userId = user.insertId;
  }
  const [result] = await pool.query('INSERT INTO imoveis (tipo,transacoes,preco,preco_venda,preco_aluguel,agua_inclusa,luz_inclusa,internet_inclusa,condominio_incluso,condominio_valor,categoria,endereco,cep,rua,numero,bairro,cidade,estado,descricao,caracteristicas,latitude,longitude,tipo_usuario,usuario_id) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)', [offer.type, JSON.stringify(offer.types), offer.price, offer.sale, offer.rent, offer.water, offer.power, offer.internet, offer.condo, offer.condoAmount, d.categoria, d.endereco, d.cep || '', d.rua || '', d.numero || '', d.bairro || '', d.cidade || '', d.estado || '', descricaoSegura(d.descricao), JSON.stringify(d.caracteristicas || {}), Number(d.latitude), Number(d.longitude), d.tipo_usuario || 'Proprietário Direto', userId]);
  const [[row]] = await pool.query('SELECT * FROM imoveis WHERE id=?', [result.insertId]); return sendJson(res, 201, imovelJson(row));
}

async function deletePropertyPhotoStored(req, res, propertyId, photoId) { const owned = await ownedProperty(req, res, propertyId); if (!owned) return; const [[photo]] = await pool.query('SELECT * FROM imovel_fotos WHERE id=? AND imovel_id=?', [photoId, propertyId]); if (!photo) return sendJson(res, 404, { error: 'Foto não encontrada.' }); await removePhoto(photo.caminho); await pool.query('DELETE FROM imovel_fotos WHERE id=?', [photoId]); return sendJson(res, 200, { success: true }); }

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);
    if (url.pathname.startsWith('/r2/')) {
      if (!r2Enabled) return sendJson(res, 404, { error: 'R2 não configurado.' });
      let key;
      try { key = decodeURIComponent(url.pathname.slice('/r2/'.length)); } catch { return sendJson(res, 400, { error: 'Referência de arquivo inválida.' }); }
      try {
        const object = await r2Client.send(new GetObjectCommand({ Bucket: process.env.R2_BUCKET_NAME, Key: key }));
        res.writeHead(200, { 'Content-Type': object.ContentType || 'application/octet-stream', 'Cache-Control': 'public, max-age=31536000, immutable' });
        return object.Body.pipe(res);
      } catch { return sendJson(res, 404, { error: 'Arquivo não encontrado.' }); }
    }
    if (url.pathname.startsWith('/Fotos_imoveis/')) { const file = path.resolve(dataDir, `.${url.pathname}`); if (!file.startsWith(path.resolve(photosDir)) || !fs.existsSync(file)) return sendJson(res,404,{error:'Arquivo nÃ£o encontrado.'}); res.writeHead(200, {'Content-Type': mimeTypes[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'public, max-age=31536000, immutable'}); return fs.createReadStream(file).pipe(res); }
    if (url.pathname === '/mapbox-config.js') { res.writeHead(200, {'Content-Type':'text/javascript; charset=utf-8','Cache-Control':'no-store'}); return res.end(`const MAPBOX_TOKEN = ${JSON.stringify(process.env.MAPBOX_TOKEN || '')};`); }
    if (url.pathname.startsWith('/shared/')) { const file = path.resolve(sharedRoot, `.${url.pathname.slice('/shared'.length)}`); if (!file.startsWith(`${sharedRoot}${path.sep}`) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) return sendJson(res,404,{error:'Arquivo não encontrado.'}); res.writeHead(200, {'Content-Type':mimeTypes[path.extname(file)] || 'application/octet-stream'}); return fs.createReadStream(file).pipe(res); }
    if (url.pathname.startsWith('/uploads/')) { const file = path.resolve(uploadsDir, path.basename(url.pathname)); if (!file.startsWith(path.resolve(uploadsDir)) || !fs.existsSync(file)) return sendJson(res,404,{error:'Arquivo nÃ£o encontrado.'}); res.writeHead(200, {'Content-Type': mimeTypes[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'public, max-age=31536000, immutable'}); return fs.createReadStream(file).pipe(res); }
    if (url.pathname === '/api/imoveis' && req.method === 'GET') { const [rows] = await pool.query('SELECT * FROM imoveis ORDER BY id DESC'); return sendJson(res, 200, await comFotos(rows)); }
    const detailFixed = url.pathname.match(/^\/api\/imoveis\/(\d+)$/); if (detailFixed && req.method === 'GET') { const [[row]] = await pool.query('SELECT * FROM imoveis WHERE id=?', [detailFixed[1]]); return row ? sendJson(res, 200, (await comFotos([row]))[0]) : sendJson(res, 404, { error: 'Imóvel não encontrado.' }); }
    const editRoute = url.pathname.match(/^\/api\/imoveis\/(\d+)$/); if (editRoute && req.method === 'PATCH') return updateProperty(req, res, editRoute[1]);
    const photoRoute = url.pathname.match(/^\/api\/imoveis\/(\d+)\/fotos$/); if (photoRoute && req.method === 'POST') return addPropertyPhotos(req, res, photoRoute[1]);
    const deletePhotoRoute = url.pathname.match(/^\/api\/imoveis\/(\d+)\/fotos\/(\d+)$/); if (deletePhotoRoute && req.method === 'DELETE') return deletePropertyPhotoStored(req, res, deletePhotoRoute[1], deletePhotoRoute[2]);
    if (url.pathname === '/api/imoveis' && req.method === 'POST' && (req.headers['content-type'] || '').startsWith('multipart/form-data')) return criarImovelComFotos(req, res);
    if (url.pathname === '/api/login' && req.method === 'POST') { const data = await bodyJson(req); const [[user]] = await pool.query('SELECT * FROM usuarios WHERE LOWER(email)=LOWER(?) LIMIT 1', [data.email]); const [salt, hash] = (user?.senha_hash || ':').split(':'); const attempt = user && data.senha ? crypto.scryptSync(data.senha, salt, 64).toString('hex') : ''; if (!user || !hash || !crypto.timingSafeEqual(Buffer.from(hash,'hex'), Buffer.from(attempt,'hex'))) return sendJson(res, 401, {error:'E-mail ou senha inválidos.'}); const token=crypto.randomBytes(32).toString('hex'); sessions.set(token,{userId:user.id,expiresAt:Date.now()+SESSION_TIMEOUT}); return sendJson(res,200,await userPayload(user.id),{'Set-Cookie':`runge_session=${token}; HttpOnly; SameSite=Lax; Max-Age=600; Path=/`}); }
    if (url.pathname === '/api/usuarios' && req.method === 'POST') { const d = await bodyJson(req); if (!d.tipo_usuario || !d.nome_usuario || !d.telefone_usuario || !d.email_usuario || !/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/.test(d.senha_usuario || '')) return sendJson(res, 400, { error: 'Preencha os dados obrigatórios e use uma senha forte.' }); const salt = crypto.randomBytes(16).toString('hex'); const hash = `${salt}:${crypto.scryptSync(d.senha_usuario, salt, 64).toString('hex')}`; try { const [result] = await pool.query('INSERT INTO usuarios (tipo_usuario,nome,telefone,email,senha_hash,cep,rua,numero,bairro,cidade,estado,creci,cnpj) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)', [d.tipo_usuario, d.nome_usuario, d.telefone_usuario, d.email_usuario, hash, d.cep_usuario || '', d.rua_usuario || '', d.numero_usuario || '', d.bairro_usuario || '', d.cidade_usuario || '', d.estado_usuario || '', d.creci_usuario || '', d.cnpj_usuario || '']); const token = crypto.randomBytes(32).toString('hex'); sessions.set(token, { userId: result.insertId, expiresAt: Date.now() + SESSION_TIMEOUT }); return sendJson(res, 201, { usuario: (await userPayload(result.insertId)).usuario }, { 'Set-Cookie': `runge_session=${token}; HttpOnly; SameSite=Lax; Max-Age=600; Path=/` }); } catch (error) { if (error.code === 'ER_DUP_ENTRY') return sendJson(res, 409, { error: 'Este e-mail já está cadastrado.' }); throw error; } }
    if (url.pathname === '/api/minha-conta' && req.method === 'GET') { const id=await authenticatedUser(req,res); return id ? sendJson(res,200,await userPayload(id)) : undefined; }
    if (url.pathname === '/api/logout' && req.method === 'POST') { const token=cookies(req).runge_session; sessions.delete(token); return sendJson(res,200,{success:true},{'Set-Cookie':'runge_session=; HttpOnly; SameSite=Lax; Max-Age=0; Path=/'}); }
    if (url.pathname === '/api/perfil' && req.method === 'PATCH') { const id=await authenticatedUser(req,res); if (!id) return; const d=await bodyJson(req); if (!d.nome||!d.telefone||!d.cep||!d.rua||!d.numero||!d.bairro||!d.cidade||!d.estado) return sendJson(res,400,{error:'Preencha todos os campos obrigatórios.'}); await pool.query('UPDATE usuarios SET nome=?,telefone=?,cep=?,rua=?,numero=?,bairro=?,cidade=?,estado=? WHERE id=?',[d.nome,d.telefone,d.cep,d.rua,d.numero,d.bairro,d.cidade,d.estado,id]); return sendJson(res,200,await userPayload(id)); }
    const contact = url.pathname.match(/^\/api\/imoveis\/(\\d+)\/contatos$/); if (contact && req.method === 'POST') { const d=await bodyJson(req); if (!d.nome||!d.telefone||!/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(d.email||'')) return sendJson(res,400,{error:'Preencha os dados corretamente.'}); const [[property]]=await pool.query('SELECT id FROM imoveis WHERE id=?',[contact[1]]); if(!property) return sendJson(res,404,{error:'Imóvel não encontrado.'}); const [result]=await pool.query('INSERT INTO contatos (imovel_id,nome,telefone,email) VALUES (?,?,?,?)',[contact[1],d.nome,d.telefone,d.email]); return sendJson(res,201,{id:result.insertId,message:'Contato registrado com sucesso.'}); }
    if (url.pathname === '/api/imoveis' && req.method === 'POST') return criarImovelJson(req, res);
    const detail=url.pathname.match(/^\/api\/imoveis\/(\\d+)$/); if(detail && req.method==='GET') { const [[row]]=await pool.query('SELECT * FROM imoveis WHERE id=?',[detail[1]]); return row ? sendJson(res,200,imovelJson(row)) : sendJson(res,404,{error:'Imóvel não encontrado.'}); }
    const relative=url.pathname==='/'?'/index.html':url.pathname; const file=path.resolve(webRoot,'.'+relative); if(!file.startsWith(`${webRoot}${path.sep}`)||!fs.existsSync(file)||fs.statSync(file).isDirectory()) return sendJson(res,404,{error:'Arquivo não encontrado.'}); res.writeHead(200,{'Content-Type':mimeTypes[path.extname(file)]||'application/octet-stream'}); fs.createReadStream(file).pipe(res);
  } catch (error) { console.error(error); if(!res.headersSent) sendJson(res,500,{error:'Erro interno do servidor.'}); }
});
runMigrations(pool).then(()=>server.listen(port,()=>console.log(`Imobiliária Runge disponível em http://localhost:${port}`))).catch(error=>{console.error('Falha ao executar migrations do MySQL:',error);process.exit(1);});
