async function columnExists(connection, table, column) {
  const [rows] = await connection.execute(
    'SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?',
    [table, column]
  );
  return rows.length > 0;
}

async function up(connection) {
  if (!(await columnExists(connection, 'oportunidades_compra', 'estado'))) {
    await connection.query("ALTER TABLE oportunidades_compra ADD COLUMN estado VARCHAR(2) NOT NULL DEFAULT 'SP' AFTER cidade");
  }
  if (!(await columnExists(connection, 'oportunidades_compra', 'tipos_imovel'))) {
    await connection.query('ALTER TABLE oportunidades_compra ADD COLUMN tipos_imovel JSON NULL AFTER tipo_imovel');
    await connection.query('UPDATE oportunidades_compra SET tipos_imovel=JSON_ARRAY(tipo_imovel) WHERE tipos_imovel IS NULL');
  }
  await connection.query(`CREATE TABLE IF NOT EXISTS oportunidade_tipos_imovel (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nome VARCHAR(80) NOT NULL UNIQUE,
    ativo BOOLEAN NOT NULL DEFAULT TRUE,
    criado_por_admin INT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_oportunidade_tipo_admin FOREIGN KEY (criado_por_admin) REFERENCES admin_usuarios(id) ON DELETE SET NULL
  )`);
  for (const nome of ['Casa', 'Apartamento', 'Terreno', 'Chácara / Sítio', 'Comercial']) {
    await connection.query('INSERT INTO oportunidade_tipos_imovel (nome) VALUES (?) ON DUPLICATE KEY UPDATE nome=VALUES(nome)', [nome]);
  }
}

module.exports = { up };
