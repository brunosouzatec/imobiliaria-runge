async function columnExists(connection, table, column) {
  const [rows] = await connection.execute(
    'SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?',
    [table, column]
  );
  return rows.length > 0;
}

async function ensureColumn(connection, table, column, definition) {
  if (!(await columnExists(connection, table, column))) {
    await connection.query(`ALTER TABLE \`${table}\` ADD COLUMN \`${column}\` ${definition}`);
  }
}

async function up(connection) {
  await connection.query(`CREATE TABLE IF NOT EXISTS usuarios (
    id INT AUTO_INCREMENT PRIMARY KEY,
    tipo_usuario VARCHAR(80) NOT NULL,
    nome VARCHAR(180) NOT NULL,
    telefone VARCHAR(40) NOT NULL,
    email VARCHAR(180) NOT NULL UNIQUE,
    senha_hash TEXT,
    cep VARCHAR(12), rua VARCHAR(180), numero VARCHAR(30), bairro VARCHAR(120),
    cidade VARCHAR(120), estado VARCHAR(2), creci VARCHAR(40), cnpj VARCHAR(24),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`);

  for (const [column, definition] of [
    ['cep', 'VARCHAR(12) NULL'], ['rua', 'VARCHAR(180) NULL'], ['numero', 'VARCHAR(30) NULL'],
    ['bairro', 'VARCHAR(120) NULL'], ['cidade', 'VARCHAR(120) NULL'], ['estado', 'VARCHAR(2) NULL'],
    ['creci', 'VARCHAR(40) NULL'], ['cnpj', 'VARCHAR(24) NULL']
  ]) await ensureColumn(connection, 'usuarios', column, definition);

  await connection.query(`CREATE TABLE IF NOT EXISTS imoveis (
    id INT AUTO_INCREMENT PRIMARY KEY,
    tipo ENUM('Venda','Aluguel','Permuta') NOT NULL,
    preco DECIMAL(14,2) NOT NULL,
    categoria VARCHAR(100) NOT NULL,
    endereco VARCHAR(255) NOT NULL,
    descricao TEXT,
    latitude DECIMAL(10,7) NOT NULL,
    longitude DECIMAL(10,7) NOT NULL,
    tipo_usuario VARCHAR(80) DEFAULT 'Proprietário Direto',
    usuario_id INT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE SET NULL
  )`);

  for (const [column, definition] of [
    ['transacoes', 'JSON NULL'], ['preco_venda', 'DECIMAL(14,2) NULL'], ['preco_aluguel', 'DECIMAL(14,2) NULL'],
    ['agua_inclusa', 'BOOLEAN NOT NULL DEFAULT FALSE'], ['luz_inclusa', 'BOOLEAN NOT NULL DEFAULT FALSE'],
    ['internet_inclusa', 'BOOLEAN NOT NULL DEFAULT FALSE'], ['condominio_incluso', 'BOOLEAN NOT NULL DEFAULT FALSE'],
    ['condominio_valor', 'DECIMAL(14,2) NULL'], ['caracteristicas', 'JSON NULL'], ['cep', 'VARCHAR(12) NULL'],
    ['rua', 'VARCHAR(180) NULL'], ['numero', 'VARCHAR(30) NULL'], ['bairro', 'VARCHAR(120) NULL'],
    ['cidade', 'VARCHAR(120) NULL'], ['estado', 'VARCHAR(2) NULL']
  ]) await ensureColumn(connection, 'imoveis', column, definition);

  await connection.query("ALTER TABLE imoveis MODIFY COLUMN tipo ENUM('Venda','Aluguel','Permuta') NOT NULL");
  await connection.query(`CREATE TABLE IF NOT EXISTS contatos (
    id INT AUTO_INCREMENT PRIMARY KEY,
    imovel_id INT NOT NULL,
    nome VARCHAR(180) NOT NULL,
    telefone VARCHAR(40) NOT NULL,
    email VARCHAR(180) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (imovel_id) REFERENCES imoveis(id) ON DELETE CASCADE
  )`);
  await connection.query(`CREATE TABLE IF NOT EXISTS imovel_fotos (
    id INT AUTO_INCREMENT PRIMARY KEY,
    imovel_id INT NOT NULL,
    caminho VARCHAR(255) NOT NULL,
    nome_original VARCHAR(255) NOT NULL,
    ordem INT NOT NULL DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (imovel_id) REFERENCES imoveis(id) ON DELETE CASCADE
  )`);
}

module.exports = { up };
