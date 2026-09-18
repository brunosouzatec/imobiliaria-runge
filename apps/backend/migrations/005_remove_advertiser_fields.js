async function columnExists(connection, table, column) {
  const [rows] = await connection.execute(
    'SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?',
    [table, column]
  );
  return rows.length > 0;
}

async function dropColumnIfPresent(connection, table, column) {
  if (await columnExists(connection, table, column)) {
    await connection.query(`ALTER TABLE \`${table}\` DROP COLUMN \`${column}\``);
  }
}

async function up(connection) {
  for (const column of ['cep', 'rua', 'numero', 'bairro', 'cidade', 'estado', 'creci', 'cnpj']) {
    await dropColumnIfPresent(connection, 'usuarios', column);
  }
}

module.exports = { up };
