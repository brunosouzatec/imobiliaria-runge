async function up(connection) {
  const [columns] = await connection.query("SELECT COUNT(*) AS total FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='imoveis' AND column_name='perimetro'");
  if (!Number(columns[0]?.total)) await connection.query('ALTER TABLE imoveis ADD COLUMN perimetro JSON NULL AFTER longitude');
}

module.exports = { up };
