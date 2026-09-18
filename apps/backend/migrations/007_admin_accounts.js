async function up(connection) {
  await connection.query("CREATE TABLE IF NOT EXISTS admin_usuarios (id INT AUTO_INCREMENT PRIMARY KEY,email VARCHAR(180) NOT NULL UNIQUE,senha_hash TEXT NOT NULL,ativo BOOLEAN NOT NULL DEFAULT TRUE,created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)");
}
module.exports = { up };
