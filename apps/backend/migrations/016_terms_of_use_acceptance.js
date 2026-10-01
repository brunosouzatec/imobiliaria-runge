async function columnExists(connection, table, column) {
  const [rows] = await connection.execute(
    'SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?',
    [table, column]
  );
  return rows.length > 0;
}

async function up(connection) {
  const columns = [
    ['termos_uso_versao', 'VARCHAR(40) NULL'],
    ['termos_uso_aceita_em', 'DATETIME NULL']
  ];
  for (const [column, definition] of columns) {
    if (!(await columnExists(connection, 'usuarios', column))) {
      await connection.query(`ALTER TABLE \`usuarios\` ADD COLUMN \`${column}\` ${definition}`);
    }
  }
}

module.exports = { up };
