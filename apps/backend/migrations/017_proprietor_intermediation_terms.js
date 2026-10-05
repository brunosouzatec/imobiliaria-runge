const INITIAL_PROPRIETOR_TERMS = `MINUTA PARA REVISÃO JURÍDICA — Termos de Uso, Anúncio e Intermediação Imobiliária do Proprietário
TATUÍ IMÓVEIS — operação em Pessoa Física
Profissional responsável nesta fase: Drielly Runge — Corretora de Imóveis — CRECI/SP 273083-F.

1. DA PLATAFORMA E DA INTERMEDIAÇÃO
A Tatuí Imóveis é uma plataforma de divulgação de imóveis, aproximação de interessados e geração de oportunidades em Tatuí e região. Nesta fase, a atividade profissional de corretagem e intermediação decorrente dos contatos originados ou atendidos pela plataforma será exercida por Drielly Runge, Corretora de Imóveis, CRECI/SP 273083-F. A identificação da plataforma não substitui a identificação da profissional responsável pela intermediação.

2. DO CADASTRO E DO ANÚNCIO GRATUITO
O cadastro e a divulgação inicial do imóvel são gratuitos. Não há cobrança pela simples publicação. A gratuidade não elimina os honorários de corretagem se a intermediação resultar em negócio, conforme as condições deste termo.

3. DA AUTORIZAÇÃO PARA DIVULGAÇÃO
O proprietário autoriza a divulgação do imóvel no site Tatuí Imóveis, em redes sociais, aplicativos de mensagens, mídias digitais e materiais eletrônicos, bem como o compartilhamento com potenciais interessados e corretores parceiros para apresentar o imóvel e aproximar as partes.

4. DAS INFORMAÇÕES E DOS MATERIAIS FORNECIDOS
O proprietário declara que as informações sobre titularidade, localização, área, características, preço, disponibilidade, ocupação, ônus, restrições e condições da negociação são verdadeiras e compromete-se a comunicar alterações relevantes. Autoriza o uso dos textos, fotografias, vídeos, plantas e demais materiais fornecidos para divulgação do imóvel e declara ter legitimidade para autorizá-los.

5. DA ANÁLISE DOCUMENTAL
O cadastro e a publicação não significam aprovação, auditoria, certificação ou validação prévia da documentação do imóvel ou do proprietário. A documentação será solicitada e analisada conforme o andamento dos contatos, quando houver interessado efetivo e possibilidade concreta de negociação. A análise poderá incluir matrícula atualizada, títulos aquisitivos, documentos dos proprietários, certidões, débitos, procurações e outros documentos necessários. Pendências que impeçam ou comprometam o negócio poderão precisar ser regularizadas antes de sua formalização.

6. DA INTERMEDIAÇÃO DOS INTERESSADOS
Os contatos originados pela plataforma poderão ser atendidos pela corretora responsável, diretamente ou em parceria com profissionais habilitados. O proprietário autoriza a apresentação do imóvel, o agendamento de visitas, o recebimento e encaminhamento de propostas e os demais atos de aproximação e condução das tratativas.

7. DOS HONORÁRIOS DE CORRETAGEM — 6%
Se a intermediação realizada pela corretora, pela plataforma ou por profissional parceiro resultar na concretização de negócio, o proprietário vendedor pagará honorários de corretagem de 6% (seis por cento) sobre o valor total efetivamente negociado. O percentual incidirá sobre o valor final do negócio, ainda que diferente do preço inicialmente anunciado, e será devido quando houver resultado útil da intermediação e concretização da negociação, observadas as condições aplicáveis ao caso.

8. DA ORIGEM DO INTERESSADO E DA RELAÇÃO COM O NEGÓCIO
Pode ser considerado originado pela intermediação o interessado que conheceu o imóvel, pediu informações, realizou contato ou visita, apresentou proposta ou iniciou tratativas por meio do anúncio, da divulgação, do atendimento da corretora ou de corretor parceiro. Se o proprietário concluir diretamente negócio com interessado apresentado ou captado durante essa atuação, os honorários poderão ser devidos quando houver relação comprovável entre a intermediação e a concretização do negócio.

9. DA PARCERIA COM OUTROS CORRETORES
A plataforma poderá atuar em parceria com corretores regularmente inscritos no CRECI. A divisão de honorários entre os profissionais será ajustada entre eles e não aumentará o percentual de 6% acordado com o proprietário, salvo ajuste específico e expresso.

10. DA AUSÊNCIA DE EXCLUSIVIDADE
O cadastro não estabelece exclusividade automática. A ausência de exclusividade não afasta eventual direito à corretagem quando o negócio decorrer de interessado captado, apresentado ou atendido pela Tatuí Imóveis ou pelos profissionais participantes.

11. DA NEGOCIAÇÃO DIRETA COM INTERESSADO APRESENTADO
O proprietário compromete-se a informar à corretora se receber contato direto de interessado anteriormente apresentado pela intermediação. A negociação direta não afasta eventual obrigação de corretagem quando o resultado decorrer da atividade de intermediação realizada, observada a comprovação dessa relação.

12. DOS SERVIÇOS E DESPESAS NÃO INCLUÍDOS
Os honorários de corretagem não incluem automaticamente regularização imobiliária, serviços de engenharia, levantamento topográfico, georreferenciamento, avaliações técnicas, despesas cartorárias, tributos, certidões pagas, serviços jurídicos ou outros serviços especializados. Quando necessários, serão informados e poderão ser objeto de contratação separada. Administração de imóveis também não está incluída.

13. DA DOCUMENTAÇÃO E DA RETIRADA DO ANÚNCIO
O proprietário compromete-se a fornecer documentos necessários quando solicitados. A divulgação inicial não declara inexistirem pendências registrais, tributárias, judiciais, urbanísticas, ambientais ou administrativas. O proprietário pode solicitar a retirada do anúncio; isso não elimina eventual direito à corretagem por negociação posteriormente concluída com interessado apresentado durante a intermediação, quando houver relação comprovável.

14. DO TRATAMENTO DE DADOS
Os dados serão tratados para cadastro, divulgação do imóvel, atendimento, análise documental, intermediação, segurança e cumprimento de obrigações legais, conforme a Política de Privacidade da plataforma.

15. DA TRANSIÇÃO FUTURA PARA PESSOA JURÍDICA
Nesta fase, a atividade de corretagem é exercida pela profissional identificada neste termo. Após eventual regularização e inscrição de pessoa jurídica perante o CRECI/SP, novos cadastros e operações poderão ser formalizados sob instrumento próprio. A transição dependerá de comunicação e de novo aceite quando aplicável.

16. DO ACEITE ELETRÔNICO
Ao marcar a caixa de aceite no cadastro do imóvel, o proprietário declara que leu e compreendeu este termo, autoriza a divulgação, confirma a veracidade das informações, reconhece que o anúncio é gratuito e concorda expressamente com honorários de 6% sobre o valor total da negociação se a intermediação resultar em negócio, nas condições aqui descritas. O sistema registra a identificação da conta, o imóvel, a versão e o conteúdo aceitos, além da data e hora.`;

async function up(connection) {
  await connection.query(
    'INSERT IGNORE INTO site_conteudos (chave, titulo, conteudo) VALUES (?, ?, ?)',
    ['termos_proprietario', 'Termos de Intermediação do Proprietário', INITIAL_PROPRIETOR_TERMS]
  );
  await connection.query(`CREATE TABLE IF NOT EXISTS imovel_termo_aceites (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    imovel_id INT NOT NULL,
    usuario_id INT NOT NULL,
    versao_termos INT NOT NULL,
    conteudo_termos LONGTEXT NOT NULL,
    aceito_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_imovel_termo_versao (imovel_id, versao_termos),
    INDEX idx_imovel_termo_usuario (usuario_id),
    CONSTRAINT fk_imovel_termo_imovel FOREIGN KEY (imovel_id) REFERENCES imoveis(id) ON DELETE CASCADE,
    CONSTRAINT fk_imovel_termo_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE
  )`);
}

module.exports = { up, INITIAL_PROPRIETOR_TERMS };
