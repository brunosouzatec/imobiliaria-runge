const http = require('http');
const fs = require('fs');
const path = require('path');
const { DatabaseSync } = require('node:sqlite');
const crypto = require('crypto');
const sessions = new Map();
const SESSION_TIMEOUT = 10 * 60 * 1000;

const port = process.env.PORT || 3000;
const root = __dirname;
const mimeTypes = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8'
};
const db = new DatabaseSync(path.join(root, 'imoveis.db'));
db.exec(`CREATE TABLE IF NOT EXISTS imoveis (id INTEGER PRIMARY KEY AUTOINCREMENT, titulo TEXT NOT NULL, tipo TEXT NOT NULL CHECK(tipo IN ('Venda', 'Aluguel')), preco REAL NOT NULL, categoria TEXT NOT NULL, endereco TEXT NOT NULL, descricao TEXT, latitude REAL NOT NULL, longitude REAL NOT NULL, created_at TEXT DEFAULT CURRENT_TIMESTAMP)`);
db.exec(`CREATE TABLE IF NOT EXISTS usuarios (id INTEGER PRIMARY KEY AUTOINCREMENT, tipo_usuario TEXT NOT NULL, nome TEXT NOT NULL, telefone TEXT NOT NULL, email TEXT, senha_hash TEXT, cep TEXT, rua TEXT, numero TEXT, bairro TEXT, cidade TEXT, estado TEXT, creci TEXT, cnpj TEXT, created_at TEXT DEFAULT CURRENT_TIMESTAMP)`);
db.exec(`CREATE TABLE IF NOT EXISTS contatos (id INTEGER PRIMARY KEY AUTOINCREMENT, imovel_id INTEGER NOT NULL, nome TEXT NOT NULL, telefone TEXT NOT NULL, email TEXT NOT NULL, created_at TEXT DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (imovel_id) REFERENCES imoveis(id))`);
if (!db.prepare("SELECT 1 FROM pragma_table_info('imoveis') WHERE name = 'usuario_id'").get()) db.exec('ALTER TABLE imoveis ADD COLUMN usuario_id INTEGER');
for (const column of [['email', 'TEXT'], ['senha_hash', 'TEXT']]) if (!db.prepare(`SELECT 1 FROM pragma_table_info('usuarios') WHERE name = '${column[0]}'`).get()) db.exec(`ALTER TABLE usuarios ADD COLUMN ${column[0]} ${column[1]}`);
if (!db.prepare("SELECT 1 FROM pragma_table_info('imoveis') WHERE name = 'tipo_usuario'").get()) db.exec("ALTER TABLE imoveis ADD COLUMN tipo_usuario TEXT NOT NULL DEFAULT 'Imobiliária'");
function imovelJson(row) { return { ...row, coordenadas: { latitude: row.latitude, longitude: row.longitude } }; }
function bodyJson(request) { return new Promise((resolve, reject) => { let data = ''; request.on('data', chunk => { data += chunk; }); request.on('end', () => { try { resolve(JSON.parse(data || '{}')); } catch (error) { reject(error); } }); }); }
function sendJson(response, status, data) { response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' }); response.end(JSON.stringify(data)); }
function cookies(request) { return Object.fromEntries((request.headers.cookie || '').split(';').filter(Boolean).map((item) => item.trim().split('=').map(decodeURIComponent))); }
function userPayload(userId) { return { usuario: db.prepare('SELECT id,nome,email,telefone,cep,rua,numero,bairro,cidade,estado,tipo_usuario,creci,cnpj FROM usuarios WHERE id = ?').get(userId), imoveis: db.prepare('SELECT * FROM imoveis WHERE usuario_id = ? ORDER BY id DESC').all(userId).map(imovelJson) }; }
function authenticatedUser(request, response) { const token = cookies(request).runge_session; const session = sessions.get(token); if (!session || session.expiresAt < Date.now()) { if (token) sessions.delete(token); sendJson(response, 401, { error: 'Sessão expirada.' }); return null; } session.expiresAt = Date.now() + SESSION_TIMEOUT; return session.userId; }

const server = http.createServer((request, response) => {
  const requestUrl = new URL(request.url, `http://${request.headers.host}`);
  if (requestUrl.pathname === '/api/login' && request.method === 'POST') return bodyJson(request).then((data) => { const usuario = db.prepare('SELECT * FROM usuarios WHERE lower(email) = lower(?) ORDER BY id DESC LIMIT 1').get(data.email); if (!usuario || !data.senha) return sendJson(response, 401, { error: 'E-mail ou senha inválidos.' }); const [salt, hash] = (usuario.senha_hash || ':').split(':'); const tentativa = crypto.scryptSync(data.senha, salt, 64).toString('hex'); if (!hash || !crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(tentativa, 'hex'))) return sendJson(response, 401, { error: 'E-mail ou senha inválidos.' }); const token = crypto.randomBytes(32).toString('hex'); sessions.set(token, { userId: usuario.id, expiresAt: Date.now() + SESSION_TIMEOUT }); response.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Set-Cookie': `runge_session=${token}; HttpOnly; SameSite=Lax; Max-Age=600; Path=/` }); response.end(JSON.stringify(userPayload(usuario.id))); }).catch(() => sendJson(response, 400, { error: 'Dados inválidos.' }));
  if (requestUrl.pathname === '/api/minha-conta' && request.method === 'GET') { const userId = authenticatedUser(request, response); return userId ? sendJson(response, 200, userPayload(userId)) : undefined; }
  if (requestUrl.pathname === '/api/perfil' && request.method === 'PATCH') return bodyJson(request).then((data) => { const userId = authenticatedUser(request, response); if (!userId) return; if (!data.nome || !data.telefone || !data.cep || !data.rua || !data.numero || !data.bairro || !data.cidade || !data.estado) return sendJson(response, 400, { error: 'Preencha todos os campos obrigatórios.' }); db.prepare('UPDATE usuarios SET nome = ?, telefone = ?, cep = ?, rua = ?, numero = ?, bairro = ?, cidade = ?, estado = ? WHERE id = ?').run(data.nome, data.telefone, data.cep, data.rua, data.numero, data.bairro, data.cidade, data.estado, userId); sendJson(response, 200, userPayload(userId)); }).catch(() => sendJson(response, 400, { error: 'Não foi possível atualizar o perfil.' }));
  if (requestUrl.pathname === '/api/logout' && request.method === 'POST') { const token = cookies(request).runge_session; sessions.delete(token); response.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Set-Cookie': 'runge_session=; HttpOnly; SameSite=Lax; Max-Age=0; Path=/' }); response.end(JSON.stringify({ success: true })); return; }
  if (requestUrl.pathname === '/api/imoveis' && request.method === 'POST' && cookies(request).runge_session) return bodyJson(request).then((data) => { const userId = authenticatedUser(request, response); if (!userId) return; const result = db.prepare('INSERT INTO imoveis (titulo,tipo,preco,categoria,endereco,descricao,latitude,longitude,tipo_usuario,usuario_id) VALUES (?,?,?,?,?,?,?,?,?,?)').run(data.titulo,data.tipo,Number(data.preco),data.categoria,data.endereco,data.descricao || '',Number(data.latitude),Number(data.longitude),data.tipo_usuario || 'Proprietário Direto',userId); sendJson(response, 201, imovelJson(db.prepare('SELECT * FROM imoveis WHERE id = ?').get(result.lastInsertRowid))); }).catch(() => sendJson(response, 400, { error: 'Não foi possível cadastrar o imóvel.' }));
  const contactMatch = requestUrl.pathname.match(/^\/api\/imoveis\/(\d+)\/contatos$/);
  if (contactMatch && request.method === 'POST') return bodyJson(request).then((data) => { if (!data.nome || !data.telefone || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email || '') || !db.prepare('SELECT id FROM imoveis WHERE id = ?').get(contactMatch[1])) return sendJson(response, 400, { error: 'Preencha os dados corretamente.' }); const result = db.prepare('INSERT INTO contatos (imovel_id,nome,telefone,email) VALUES (?,?,?,?)').run(contactMatch[1],data.nome,data.telefone,data.email); sendJson(response, 201, { id: result.lastInsertRowid, message: 'Contato registrado com sucesso.' }); }).catch(() => sendJson(response, 400, { error: 'Não foi possível registrar o contato.' }));
  if (requestUrl.pathname === '/api/imoveis' && request.method === 'GET') return sendJson(response, 200, db.prepare('SELECT * FROM imoveis ORDER BY id DESC').all().map(imovelJson));
  if (requestUrl.pathname === '/api/login' && request.method === 'POST') return bodyJson(request).then((data) => { const usuario = db.prepare('SELECT * FROM usuarios WHERE lower(email) = lower(?) ORDER BY id DESC LIMIT 1').get(data.email); if (!usuario || !data.senha) return sendJson(response, 401, { error: 'E-mail ou senha inválidos.' }); const [salt, hash] = (usuario.senha_hash || ':').split(':'); const tentativa = crypto.scryptSync(data.senha, salt, 64).toString('hex'); if (!crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(tentativa, 'hex'))) return sendJson(response, 401, { error: 'E-mail ou senha inválidos.' }); const imoveisUsuario = db.prepare('SELECT * FROM imoveis WHERE usuario_id = ? ORDER BY id DESC').all(usuario.id).map(imovelJson); sendJson(response, 200, { usuario: { id: usuario.id, nome: usuario.nome, email: usuario.email }, imoveis: imoveisUsuario }); }).catch(() => sendJson(response, 400, { error: 'Dados inválidos.' }));
  if (requestUrl.pathname === '/api/imoveis' && request.method === 'POST') {
    return bodyJson(request).then((data) => { if (!data.email_usuario || !/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/.test(data.senha_usuario || '')) return sendJson(response, 400, { error: 'E-mail ou senha inválidos.' }); const salt = crypto.randomBytes(16).toString('hex'); const senhaHash = `${salt}:${crypto.scryptSync(data.senha_usuario, salt, 64).toString('hex')}`; const usuario = db.prepare('INSERT INTO usuarios (tipo_usuario,nome,telefone,email,senha_hash,cep,rua,numero,bairro,cidade,estado,creci,cnpj) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)').run(data.tipo_usuario,data.nome_usuario,data.telefone_usuario,data.email_usuario,senhaHash,data.cep_usuario,data.rua_usuario,data.numero_usuario,data.bairro_usuario,data.cidade_usuario,data.estado_usuario,data.creci_usuario || '',data.cnpj_usuario || ''); const result = db.prepare('INSERT INTO imoveis (titulo,tipo,preco,categoria,endereco,descricao,latitude,longitude,tipo_usuario,usuario_id) VALUES (?,?,?,?,?,?,?,?,?,?)').run(data.titulo,data.tipo,Number(data.preco),data.categoria,data.endereco,data.descricao || '',Number(data.latitude),Number(data.longitude),data.tipo_usuario || 'Proprietário Direto',usuario.lastInsertRowid); sendJson(response, 201, imovelJson(db.prepare('SELECT * FROM imoveis WHERE id = ?').get(result.lastInsertRowid))); }).catch((error) => sendJson(response, error.code === 'SQLITE_CONSTRAINT_UNIQUE' ? 409 : 400, { error: 'Não foi possível cadastrar os dados.' }));
  }
  const detailMatch = requestUrl.pathname.match(/^\/api\/imoveis\/(\d+)$/);
  if (detailMatch && request.method === 'GET') { const row = db.prepare('SELECT * FROM imoveis WHERE id = ?').get(detailMatch[1]); return row ? sendJson(response, 200, imovelJson(row)) : sendJson(response, 404, { error: 'Imóvel não encontrado.' }); }
  const relativePath = requestUrl.pathname === '/' ? '/index.html' : requestUrl.pathname;
  const filePath = path.resolve(root, `.${relativePath}`);

  if (!filePath.startsWith(root) || !fs.existsSync(filePath)) {
    response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    response.end('Arquivo não encontrado.');
    return;
  }

  response.writeHead(200, {
    'Content-Type': mimeTypes[path.extname(filePath)] || 'application/octet-stream'
  });
  fs.createReadStream(filePath).pipe(response);
});

server.listen(port, () => {
  console.log(`Imobiliária Runge disponível em http://localhost:${port}`);
});
