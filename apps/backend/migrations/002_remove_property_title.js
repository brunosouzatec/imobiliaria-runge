async function up(connection) {
  const [columns] = await connection.execute(
    'SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?',
    ['imoveis', 'titulo']
  );
  if (columns.length) await connection.query('ALTER TABLE imoveis DROP COLUMN titulo');
}

module.exports = { up };
