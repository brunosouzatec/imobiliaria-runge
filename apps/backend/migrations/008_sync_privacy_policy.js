const DEFAULT_POLICY = [
  '1. Dados que podemos coletar',
  'Dependendo da ação realizada, podemos tratar nome, telefone, e-mail, senha protegida, endereço do imóvel, informações do imóvel, fotos e mensagens de interesse.',
  '2. Para que usamos esses dados',
  'Usamos os dados para criar e proteger sua conta, publicar e administrar anúncios, localizar o imóvel no mapa, organizar resultados, registrar solicitações de contato, prevenir abuso e atender solicitações relacionadas à privacidade.',
  '3. Compartilhamentos',
  'Usamos serviços de infraestrutura e funcionalidades externas para operar o portal, como hospedagem, armazenamento de fotos, mapas e consulta de CEP. Quando você escolhe continuar pelo WhatsApp, os dados informados são registrados para controle do contato e preparados para envio ao aplicativo, que passa a tratar a conversa conforme suas próprias políticas.',
  '4. Cookies e sessões',
  'Utilizamos um cookie técnico de sessão para manter o login e proteger a área do usuário. Não usamos, nesta versão, cookies de publicidade ou de rastreamento comportamental.',
  '5. Segurança e retenção',
  'Adotamos controles técnicos para proteger contas, requisições, senhas e uploads. Os dados são mantidos pelo tempo necessário para cumprir as finalidades descritas, atender obrigações legais e proteger direitos. Solicitações de exclusão ou anonimização serão avaliadas conforme essas obrigações.',
  '6. Seus direitos',
  'Você pode solicitar confirmação do tratamento, acesso, correção, informações sobre compartilhamento e exclusão ou anonimização quando aplicável. Para fazer uma solicitação, entre em contato pelo WhatsApp da Tatuí Imóveis, informando o pedido e os dados necessários para localizarmos o cadastro.',
  '7. Atualizações',
  'Esta versão foi publicada em 18 de setembro de 2026. Podemos atualizar o texto para refletir mudanças no portal, nos serviços utilizados ou na legislação aplicável. A versão vigente estará sempre disponível nesta página.'
].join('\n\n');

async function up(c) {
  await c.query(
    'UPDATE site_conteudos SET conteudo=?, versao=1 WHERE chave=? AND conteudo=?',
    [DEFAULT_POLICY, 'politica_privacidade', 'A política de privacidade está em revisão. Consulte a versão vigente publicada no portal.']
  );
}

module.exports = { up, DEFAULT_POLICY };
