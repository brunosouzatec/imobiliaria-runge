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
  await ensureColumn(connection, 'usuarios', 'privacidade_versao', 'VARCHAR(40) NULL');
  await ensureColumn(connection, 'usuarios', 'privacidade_aceita_em', 'DATETIME NULL');
  await ensureColumn(connection, 'contatos', 'privacidade_versao', 'VARCHAR(40) NULL');
  await ensureColumn(connection, 'contatos', 'privacidade_aceita_em', 'DATETIME NULL');
}

module.exports = { up };
