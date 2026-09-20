const fs = require('fs');
const path = require('path');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');

const required = ['R2_ACCOUNT_ID', 'R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY', 'R2_BUCKET_NAME'];
for (const name of required) {
  if (!process.env[name]) throw new Error(`${name} não configurada.`);
}

const file = path.resolve(__dirname, '../../frontend/public/assets/tatui-imoveis-logo-email.png');
const r2 = new S3Client({
  region: 'auto',
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: { accessKeyId: process.env.R2_ACCESS_KEY_ID, secretAccessKey: process.env.R2_SECRET_ACCESS_KEY }
});

async function main() {
  if (!fs.existsSync(file)) throw new Error(`Logo não encontrado: ${file}`);
  await r2.send(new PutObjectCommand({
    Bucket: process.env.R2_BUCKET_NAME,
    Key: 'assets/tatui-imoveis-logo-email.png',
    Body: fs.createReadStream(file),
    ContentType: 'image/png',
    ContentDisposition: 'inline',
    CacheControl: 'public, max-age=31536000, immutable'
  }));
  console.log('Logo enviado para R2: assets/tatui-imoveis-logo-email.png');
}

main().catch(error => { console.error(`Upload interrompido: ${error.message}`); process.exitCode = 1; });
