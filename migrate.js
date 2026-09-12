const fs = require('fs');
const path = require('path');

async function runMigrations(pool) {
  const connection = await pool.getConnection();
  const lockName = 'tatu_imoveis_schema_migrations';
  let locked = false;
  try {
    const [[lock]] = await connection.query('SELECT GET_LOCK(?, 30) AS acquired', [lockName]);
    if (Number(lock.acquired) !== 1) throw new Error('Não foi possível obter o bloqueio para executar as migrations.');
    locked = true;
    await connection.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
      name VARCHAR(255) PRIMARY KEY,
      applied_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`);
    const directory = path.join(__dirname, 'migrations');
    const files = fs.readdirSync(directory).filter(file => /^\d+_[a-z0-9_-]+\.js$/i.test(file)).sort();
    const [appliedRows] = await connection.query('SELECT name FROM schema_migrations');
    const applied = new Set(appliedRows.map(row => row.name));
    for (const name of files) {
      if (applied.has(name)) continue;
      const migration = require(path.join(directory, name));
      if (typeof migration.up !== 'function') throw new Error(`Migration inválida: ${name}`);
      await migration.up(connection);
      await connection.query('INSERT INTO schema_migrations (name) VALUES (?)', [name]);
      console.log(`Migration aplicada: ${name}`);
    }
  } finally {
    if (locked) await connection.query('SELECT RELEASE_LOCK(?)', [lockName]);
    connection.release();
  }
}

module.exports = { runMigrations };
