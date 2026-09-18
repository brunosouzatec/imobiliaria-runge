async function columnExists(connection, table, column) {
  const [rows] = await connection.execute(
    'SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?',
    [table, column]
  );
  return rows.length > 0;
}

async function up(connection) {
  if (!(await columnExists(connection, 'usuarios', 'papel'))) {
    await connection.query("ALTER TABLE usuarios ADD COLUMN papel VARCHAR(20) NOT NULL DEFAULT 'usuario'");
  }
  if (!(await columnExists(connection, 'usuarios', 'ativo'))) {
    await connection.query('ALTER TABLE usuarios ADD COLUMN ativo BOOLEAN NOT NULL DEFAULT TRUE');
  }
  if (!(await columnExists(connection, 'imovel_visualizacoes', 'usuario_id'))) {
    await connection.query('ALTER TABLE imovel_visualizacoes ADD COLUMN usuario_id INT NULL, ADD INDEX idx_visualizacoes_usuario (usuario_id), ADD CONSTRAINT fk_visualizacoes_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE SET NULL');
  }
  await connection.query(\`CREATE TABLE IF NOT EXISTS admin_auditoria (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    usuario_id INT NULL,
    acao VARCHAR(80) NOT NULL,
    entidade VARCHAR(80) NOT NULL,
    entidade_id VARCHAR(80) NULL,
    detalhes JSON NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_admin_auditoria_data (created_at),
    FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE SET NULL
  )\`);
  await connection.query(\`CREATE TABLE IF NOT EXISTS site_conteudos (
    chave VARCHAR(100) PRIMARY KEY,
    titulo VARCHAR(180) NOT NULL,
    conteudo LONGTEXT NOT NULL,
    versao INT NOT NULL DEFAULT 1,
    atualizado_por INT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (atualizado_por) REFERENCES usuarios(id) ON DELETE SET NULL
  )\`);
  await connection.query(
    "INSERT INTO site_conteudos (chave,titulo,conteudo) VALUES ('politica_privacidade','Política de Privacidade',?) ON DUPLICATE KEY UPDATE chave=chave",
    ['A política de privacidade está em revisão. Consulte a versão vigente publicada no portal.']
  );
}

module.exports = { up };
