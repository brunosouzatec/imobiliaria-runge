async function up(connection) {
  await connection.query(`CREATE TABLE IF NOT EXISTS localidades_estados (
    sigla CHAR(2) PRIMARY KEY,
    nome VARCHAR(80) NOT NULL,
    nome_normalizado VARCHAR(80) NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
  )`);

  await connection.query(`CREATE TABLE IF NOT EXISTS localidades_cidades (
    id INT AUTO_INCREMENT PRIMARY KEY,
    estado_sigla CHAR(2) NOT NULL,
    nome VARCHAR(120) NOT NULL,
    nome_normalizado VARCHAR(120) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_localidade_cidade (estado_sigla, nome_normalizado),
    CONSTRAINT fk_localidade_cidade_estado FOREIGN KEY (estado_sigla)
      REFERENCES localidades_estados(sigla) ON UPDATE CASCADE ON DELETE RESTRICT
  )`);

}

module.exports = { up };
