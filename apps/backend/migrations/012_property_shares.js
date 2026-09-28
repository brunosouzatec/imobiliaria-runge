async function up(connection) {
  await connection.query(`CREATE TABLE IF NOT EXISTS imovel_compartilhamentos (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    imovel_id INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_imovel_compartilhamentos_imovel_data (imovel_id, created_at),
    FOREIGN KEY (imovel_id) REFERENCES imoveis(id) ON DELETE CASCADE
  )`);
}

module.exports = { up };
