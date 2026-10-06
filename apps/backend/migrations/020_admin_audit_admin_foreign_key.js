async function up(connection) {
  const [foreignKeys] = await connection.query(`
    SELECT CONSTRAINT_NAME AS constraint_name, REFERENCED_TABLE_NAME AS referenced_table_name
    FROM information_schema.KEY_COLUMN_USAGE
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'admin_auditoria'
      AND COLUMN_NAME = 'usuario_id'
      AND REFERENCED_TABLE_NAME IS NOT NULL
  `);

  const hasAdminForeignKey = foreignKeys.some((key) => key.referenced_table_name === 'admin_usuarios');
  for (const key of foreignKeys) {
    if (key.referenced_table_name === 'admin_usuarios') continue;
    const constraint = String(key.constraint_name).replaceAll('`', '``');
    await connection.query(`ALTER TABLE admin_auditoria DROP FOREIGN KEY \`${constraint}\``);
  }

  if (hasAdminForeignKey) return;

  await connection.query(`
    UPDATE admin_auditoria AS audit
    LEFT JOIN admin_usuarios AS admin ON admin.id = audit.usuario_id
    SET audit.usuario_id = NULL
    WHERE audit.usuario_id IS NOT NULL AND admin.id IS NULL
  `);
  await connection.query(`
    ALTER TABLE admin_auditoria
    ADD CONSTRAINT fk_admin_auditoria_admin
    FOREIGN KEY (usuario_id) REFERENCES admin_usuarios(id) ON DELETE SET NULL
  `);
}

module.exports = { up };
