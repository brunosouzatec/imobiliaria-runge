async function up(connection) {
  await connection.query('DROP TABLE IF EXISTS localidades_bairros');
}

module.exports = { up };
