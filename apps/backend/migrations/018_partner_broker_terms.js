const INITIAL_PARTNER_TERMS = `MINUTA PARA REVISÃO JURÍDICA — Termos de Parceria e Honorários do Corretor Parceiro
TATUÍ IMÓVEIS — parceria profissional

DOS HONORÁRIOS DE CORRETAGEM E DA PARCERIA

O Corretor Parceiro declara estar ciente de que, nas negociações originadas ou intermediadas por meio da plataforma TATUÍ IMÓVEIS, a corretagem padrão prevista para a operação será de 6% (seis por cento) sobre o valor total da negociação, observadas as condições estabelecidas com o proprietário do imóvel.

Havendo participação conjunta entre o Corretor responsável pelo imóvel e a Corretora de Imóveis Drielly Runge – CRECI/SP 273083-F, em razão de interessado originado, apresentado ou atendido por meio da plataforma TATUÍ IMÓVEIS, a divisão padrão dos honorários será:

4,15% (quatro vírgula quinze por cento) sobre o valor total da negociação para o Corretor responsável pelo imóvel; e

1,85% (um vírgula oitenta e cinco por cento) sobre o valor total da negociação para a Corretora de Imóveis Drielly Runge – CRECI/SP 273083-F, em razão de sua participação na captação do interessado e/ou na intermediação da negociação vinculada à plataforma TATUÍ IMÓVEIS.

A soma das parcelas corresponde aos 6% de honorários de corretagem contratados com o proprietário, não implicando, em regra, cobrança adicional ao vendedor em razão da parceria entre os profissionais.

A divisão dos honorários somente será aplicável quando houver efetiva participação dos profissionais na negociação e conversão da intermediação em negócio.

Eventuais condições diferentes de divisão somente terão validade quando previamente acordadas entre os corretores envolvidos e formalizadas antes da conclusão da negociação.

O Corretor Parceiro declara, ainda, estar ciente de que a divisão interna dos honorários entre os profissionais participantes da negociação não altera as obrigações assumidas pelo proprietário no instrumento de intermediação.

ACEITE ELETRÔNICO

Ao marcar a caixa de aceite durante o cadastro profissional, o usuário declara estar ciente e concordar que, nas negociações originadas pela TATUÍ IMÓVEIS, a corretagem padrão será de 6% sobre o valor total da negociação, sendo, na parceria padrão, 4,15% destinados ao Corretor responsável pelo imóvel e 1,85% destinados à Corretora de Imóveis Drielly Runge – CRECI/SP 273083-F, quando houver sua participação na captação do interessado e/ou intermediação da negociação. O sistema registra a identificação da conta, a versão e o conteúdo aceitos, além da data e hora.`;

async function up(connection) {
  await connection.query(
    'INSERT IGNORE INTO site_conteudos (chave, titulo, conteudo) VALUES (?, ?, ?)',
    ['termos_corretor_parceiro', 'Termos do Corretor Parceiro', INITIAL_PARTNER_TERMS]
  );
  await connection.query(`CREATE TABLE IF NOT EXISTS usuario_termo_aceites (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    usuario_id INT NOT NULL,
    chave_termo VARCHAR(60) NOT NULL,
    versao_termos INT NOT NULL,
    conteudo_termos LONGTEXT NOT NULL,
    aceito_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_usuario_termo_versao (usuario_id, chave_termo, versao_termos),
    INDEX idx_usuario_termo_chave (chave_termo),
    CONSTRAINT fk_usuario_termo_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE
  )`);
}

module.exports = { up, INITIAL_PARTNER_TERMS };
