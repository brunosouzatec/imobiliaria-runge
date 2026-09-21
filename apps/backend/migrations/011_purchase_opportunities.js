async function up(connection) {
  await connection.query(`CREATE TABLE IF NOT EXISTS oportunidades_compra (
    id INT AUTO_INCREMENT PRIMARY KEY,
    titulo VARCHAR(180) NOT NULL,
    tipo_imovel VARCHAR(80) NOT NULL,
    transacoes JSON NOT NULL,
    cidade VARCHAR(120) NOT NULL DEFAULT 'Tatuí',
    bairros JSON NULL,
    valor_minimo DECIMAL(14,2) NULL,
    valor_maximo DECIMAL(14,2) NULL,
    area_total_minima DECIMAL(12,2) NULL,
    area_total_maxima DECIMAL(12,2) NULL,
    quartos_minimos TINYINT UNSIGNED NULL,
    suites_minimas TINYINT UNSIGNED NULL,
    vagas_minimas TINYINT UNSIGNED NULL,
    caracteristicas JSON NULL,
    descricao TEXT NOT NULL,
    status ENUM('rascunho','publicada','atendida','expirada','cancelada') NOT NULL DEFAULT 'rascunho',
    publicada_em DATETIME NULL,
    expira_em DATE NULL,
    criada_por_admin INT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_oportunidades_publicacao (status, publicada_em, expira_em),
    INDEX idx_oportunidades_tipo (tipo_imovel),
    CONSTRAINT fk_oportunidades_admin FOREIGN KEY (criada_por_admin) REFERENCES admin_usuarios(id) ON DELETE SET NULL
  )`);
}

module.exports = { up };
