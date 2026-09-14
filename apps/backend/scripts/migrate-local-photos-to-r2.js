const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');

const dataDir = process.env.DATA_DIR || '/data';
const photosDir = path.join(dataDir, 'Fotos_imoveis');
const publicUrl = process.env.R2_PUBLIC_URL.replace(/\/$/, '');
const r2 = new S3Client({ region: 'auto', endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`, credentials: { accessKeyId: process.env.R2_ACCESS_KEY_ID, secretAccessKey: process.env.R2_SECRET_ACCESS_KEY } });
const pool = mysql.createPool({ host: process.env.DB_HOST || 'mysql', port: Number(process.env.DB_PORT || 3306), user: process.env.MYSQL_USER, password: process.env.MYSQL_PASSWORD, database: process.env.MYSQL_DATABASE, waitForConnections: true, connectionLimit: 2 });

function slug(value) { return String(value || 'imovel').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60) || 'imovel'; }
function contentType(file) { return ({ '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp' }[path.extname(file).toLowerCase()] || 'application/octet-stream'); }

async function main() {
  const [photos] = await pool.query('SELECT f.id, f.imovel_id, f.caminho, f.nome_original, i.titulo FROM imovel_fotos f JOIN imoveis i ON i.id=f.imovel_id WHERE f.caminho LIKE \'/Fotos_imoveis/%\' ORDER BY f.id');
  const pending = photos.map((photo) => ({ ...photo, localPath: path.resolve(dataDir, `.${photo.caminho}`), filename: path.basename(photo.caminho), key: `imoveis/${photo.imovel_id}-${slug(photo.titulo)}/${path.basename(photo.caminho)}` }));
  const missing = pending.filter((photo) => !fs.existsSync(photo.localPath));
  if (missing.length) throw new Error(`Arquivos locais não encontrados: ${missing.map((photo) => photo.localPath).join(', ')}`);
  console.log(`Validado: ${pending.length} foto(s) local(is).`);
  for (const photo of pending) {
    const body = fs.createReadStream(photo.localPath);
    await r2.send(new PutObjectCommand({ Bucket: process.env.R2_BUCKET_NAME, Key: photo.key, Body: body, ContentType: contentType(photo.filename) }));
    await pool.query('UPDATE imovel_fotos SET caminho=? WHERE id=?', [`${publicUrl}/${photo.key}`, photo.id]);
    console.log(`Migrada: ${photo.filename}`);
  }
  for (const photo of pending) fs.unlinkSync(photo.localPath);
  const directories = [...new Set(pending.map((photo) => path.dirname(photo.localPath)))].sort((a, b) => b.length - a.length);
  for (const directory of directories) { if (directory !== photosDir && fs.existsSync(directory) && !fs.readdirSync(directory).length) fs.rmdirSync(directory); }
  console.log(`Concluído: ${pending.length} foto(s) migrada(s) e removida(s) localmente.`);
  await pool.end();
}

main().catch(async (error) => { console.error('Migração interrompida:', error.message); await pool.end(); process.exit(1); });
