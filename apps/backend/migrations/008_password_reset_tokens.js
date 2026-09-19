async function up(connection) {
  await connection.query(`CREATE TABLE IF NOT EXISTS recuperacao_senha_tokens (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    usuario_id INT NOT NULL,
    token_hash CHAR(64) NOT NULL UNIQUE,
    expires_at DATETIME NOT NULL,
    used_at DATETIME NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_recuperacao_senha_usuario (usuario_id),
    INDEX idx_recuperacao_senha_validade (expires_at, used_at),
    CONSTRAINT fk_recuperacao_senha_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE
  )`);
}

module.exports = { up };
