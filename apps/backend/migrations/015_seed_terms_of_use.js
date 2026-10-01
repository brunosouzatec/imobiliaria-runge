const INITIAL_TERMS = 'Os Termos de Uso estão em elaboração. A versão oficial será publicada após revisão e aprovação da responsável pelo site.';

async function up(connection) {
  await connection.query(
    'INSERT IGNORE INTO site_conteudos (chave, titulo, conteudo) VALUES (?, ?, ?)',
    ['termos_uso', 'Termos de Uso', INITIAL_TERMS]
  );
}

module.exports = { up, INITIAL_TERMS };
