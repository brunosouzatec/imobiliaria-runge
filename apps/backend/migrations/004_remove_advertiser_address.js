async function up(connection) {
  const columns = ['cep', 'rua', 'numero', 'bairro', 'cidade', 'estado'];
  for (const column of columns) {
    const [found] = await connection.execute(
      'SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?',
      ['usuarios', column]
    );
    if (found.length) await connection.query(`ALTER TABLE usuarios DROP COLUMN \`${column}\``);
  }
}

module.exports = { up };
