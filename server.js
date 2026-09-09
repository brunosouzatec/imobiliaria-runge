const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const mysql = require('mysql2/promise');

const root = __dirname;
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

async function initDatabase() {
  await pool.query(`CREATE TABLE IF NOT EXISTS usuarios (id INT AUTO_INCREMENT PRIMARY KEY, tipo_usuario VARCHAR(80) NOT NULL, nome VARCHAR(180) NOT NULL, telefone VARCHAR(40) NOT NULL, email VARCHAR(180) NOT NULL UNIQUE, senha_hash TEXT, cep VARCHAR(12), rua VARCHAR(180), numero VARCHAR(30), bairro VARCHAR(120), cidade VARCHAR(120), estado VARCHAR(2), creci VARCHAR(40), cnpj VARCHAR(24), created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`);
  await pool.query(`CREATE TABLE IF NOT EXISTS imoveis (id INT AUTO_INCREMENT PRIMARY KEY, titulo VARCHAR(180) NOT NULL, tipo ENUM('Venda','Aluguel') NOT NULL, preco DECIMAL(14,2) NOT NULL, categoria VARCHAR(100) NOT NULL, endereco VARCHAR(255) NOT NULL, descricao TEXT, latitude DECIMAL(10,7) NOT NULL, longitude DECIMAL(10,7) NOT NULL, tipo_usuario VARCHAR(80) DEFAULT 'Proprietário Direto', usuario_id INT NULL, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE SET NULL)`);
  await pool.query(`CREATE TABLE IF NOT EXISTS contatos (id INT AUTO_INCREMENT PRIMARY KEY, imovel_id INT NOT NULL, nome VARCHAR(180) NOT NULL, telefone VARCHAR(40) NOT NULL, email VARCHAR(180) NOT NULL, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (imovel_id) REFERENCES imoveis(id) ON DELETE CASCADE)`);
}
function imovelJson(row) { return { ...row, preco: Number(row.preco), coordenadas: { latitude: Number(row.latitude), longitude: Number(row.longitude) } }; }
function sendJson(res, status, data, headers = {}) { res.writeHead(status, { 'Content-Type':'application/json; charset=utf-8', ...headers }); res.end(JSON.stringify(data)); }
function bodyJson(req) { return new Promise((resolve, reject) => { let body=''; req.on('data', chunk => body += chunk); req.on('end', () => { try { resolve(JSON.parse(body || '{}')); } catch (e) { reject(e); } }); }); }
function cookies(req) { return Object.fromEntries((req.headers.cookie || '').split(';').filter(Boolean).map(x => x.trim().split('=').map(decodeURIComponent))); }
async function userPayload(id) { const [[usuario]] = await pool.query('SELECT id,nome,email,telefone,cep,rua,numero,bairro,cidade,estado,tipo_usuario,creci,cnpj FROM usuarios WHERE id=?', [id]); const [rows] = await pool.query('SELECT * FROM imoveis WHERE usuario_id=? ORDER BY id DESC', [id]); return { usuario, imoveis: rows.map(imovelJson) }; }
async function authenticatedUser(req, res) { const token = cookies(req).runge_session; const session = sessions.get(token); if (!session || session.expiresAt < Date.now()) { if (token) sessions.delete(token); sendJson(res, 401, { error:'Sessão expirada.' }); return null; } session.expiresAt = Date.now() + SESSION_TIMEOUT; return session.userId; }

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);
    if (url.pathname === '/mapbox-config.js') { res.writeHead(200, {'Content-Type':'text/javascript; charset=utf-8','Cache-Control':'no-store'}); return res.end(`const MAPBOX_TOKEN = ${JSON.stringify(process.env.MAPBOX_TOKEN || '')};`); }
    if (url.pathname === '/api/imoveis' && req.method === 'GET') { const [rows] = await pool.query('SELECT * FROM imoveis ORDER BY id DESC'); return sendJson(res, 200, rows.map(imovelJson)); }
    if (url.pathname === '/api/login' && req.method === 'POST') { const data = await bodyJson(req); const [[user]] = await pool.query('SELECT * FROM usuarios WHERE LOWER(email)=LOWER(?) LIMIT 1', [data.email]); const [salt, hash] = (user?.senha_hash || ':').split(':'); const attempt = user && data.senha ? crypto.scryptSync(data.senha, salt, 64).toString('hex') : ''; if (!user || !hash || !crypto.timingSafeEqual(Buffer.from(hash,'hex'), Buffer.from(attempt,'hex'))) return sendJson(res, 401, {error:'E-mail ou senha inválidos.'}); const token=crypto.randomBytes(32).toString('hex'); sessions.set(token,{userId:user.id,expiresAt:Date.now()+SESSION_TIMEOUT}); return sendJson(res,200,await userPayload(user.id),{'Set-Cookie':`runge_session=${token}; HttpOnly; SameSite=Lax; Max-Age=600; Path=/`}); }
    if (url.pathname === '/api/minha-conta' && req.method === 'GET') { const id=await authenticatedUser(req,res); return id ? sendJson(res,200,await userPayload(id)) : undefined; }
    if (url.pathname === '/api/logout' && req.method === 'POST') { const token=cookies(req).runge_session; sessions.delete(token); return sendJson(res,200,{success:true},{'Set-Cookie':'runge_session=; HttpOnly; SameSite=Lax; Max-Age=0; Path=/'}); }
    if (url.pathname === '/api/perfil' && req.method === 'PATCH') { const id=await authenticatedUser(req,res); if (!id) return; const d=await bodyJson(req); if (!d.nome||!d.telefone||!d.cep||!d.rua||!d.numero||!d.bairro||!d.cidade||!d.estado) return sendJson(res,400,{error:'Preencha todos os campos obrigatórios.'}); await pool.query('UPDATE usuarios SET nome=?,telefone=?,cep=?,rua=?,numero=?,bairro=?,cidade=?,estado=? WHERE id=?',[d.nome,d.telefone,d.cep,d.rua,d.numero,d.bairro,d.cidade,d.estado,id]); return sendJson(res,200,await userPayload(id)); }
    const contact = url.pathname.match(/^\/api\/imoveis\/(\\d+)\/contatos$/); if (contact && req.method === 'POST') { const d=await bodyJson(req); if (!d.nome||!d.telefone||!/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(d.email||'')) return sendJson(res,400,{error:'Preencha os dados corretamente.'}); const [[property]]=await pool.query('SELECT id FROM imoveis WHERE id=?',[contact[1]]); if(!property) return sendJson(res,404,{error:'Imóvel não encontrado.'}); const [result]=await pool.query('INSERT INTO contatos (imovel_id,nome,telefone,email) VALUES (?,?,?,?)',[contact[1],d.nome,d.telefone,d.email]); return sendJson(res,201,{id:result.insertId,message:'Contato registrado com sucesso.'}); }
    if (url.pathname === '/api/imoveis' && req.method === 'POST') { const d=await bodyJson(req); const sessionUser=cookies(req).runge_session; let userId=null; if(sessionUser) userId=await authenticatedUser(req,res); if(sessionUser && !userId) return; if(!userId) { if(!d.email_usuario||!/^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d).{8,}$/.test(d.senha_usuario||'')) return sendJson(res,400,{error:'E-mail ou senha inválidos.'}); const salt=crypto.randomBytes(16).toString('hex'); const hash=`${salt}:${crypto.scryptSync(d.senha_usuario,salt,64).toString('hex')}`; const [u]=await pool.query('INSERT INTO usuarios (tipo_usuario,nome,telefone,email,senha_hash,cep,rua,numero,bairro,cidade,estado,creci,cnpj) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)',[d.tipo_usuario,d.nome_usuario,d.telefone_usuario,d.email_usuario,hash,d.cep_usuario,d.rua_usuario,d.numero_usuario,d.bairro_usuario,d.cidade_usuario,d.estado_usuario,d.creci_usuario||'',d.cnpj_usuario||'']); userId=u.insertId; } const [result]=await pool.query('INSERT INTO imoveis (titulo,tipo,preco,categoria,endereco,descricao,latitude,longitude,tipo_usuario,usuario_id) VALUES (?,?,?,?,?,?,?,?,?,?)',[d.titulo,d.tipo,Number(d.preco),d.categoria,d.endereco,d.descricao||'',Number(d.latitude),Number(d.longitude),d.tipo_usuario||'Proprietário Direto',userId]); const [[row]]=await pool.query('SELECT * FROM imoveis WHERE id=?',[result.insertId]); return sendJson(res,201,imovelJson(row)); }
    const detail=url.pathname.match(/^\/api\/imoveis\/(\\d+)$/); if(detail && req.method==='GET') { const [[row]]=await pool.query('SELECT * FROM imoveis WHERE id=?',[detail[1]]); return row ? sendJson(res,200,imovelJson(row)) : sendJson(res,404,{error:'Imóvel não encontrado.'}); }
    const relative=url.pathname==='/'?'/index.html':url.pathname; const file=path.resolve(root,'.'+relative); if(!file.startsWith(root)||!fs.existsSync(file)||fs.statSync(file).isDirectory()) return sendJson(res,404,{error:'Arquivo não encontrado.'}); res.writeHead(200,{'Content-Type':mimeTypes[path.extname(file)]||'application/octet-stream'}); fs.createReadStream(file).pipe(res);
  } catch (error) { console.error(error); if(!res.headersSent) sendJson(res,500,{error:'Erro interno do servidor.'}); }
});
initDatabase().then(()=>server.listen(port,()=>console.log(`Imobiliária Runge disponível em http://localhost:${port}`))).catch(error=>{console.error('Falha ao iniciar banco MySQL:',error);process.exit(1);});

