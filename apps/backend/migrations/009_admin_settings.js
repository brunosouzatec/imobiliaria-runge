async function up(connection) {
  await connection.query(`CREATE TABLE IF NOT EXISTS admin_configuracoes (
    chave VARCHAR(80) PRIMARY KEY,
    valor TEXT NOT NULL,
    atualizado_por INT NULL,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_admin_configuracoes_admin FOREIGN KEY (atualizado_por) REFERENCES admin_usuarios(id) ON DELETE SET NULL
  )`);
}

module.exports = { up };
