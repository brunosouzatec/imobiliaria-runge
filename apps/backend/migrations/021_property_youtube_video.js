async function up(connection) {
  const [columns] = await connection.query(
    "SELECT COUNT(*) AS total FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='imoveis' AND column_name='youtube_video_id'"
  );
  if (!Number(columns[0]?.total)) {
    await connection.query('ALTER TABLE imoveis ADD COLUMN youtube_video_id VARCHAR(11) NULL AFTER perimetro');
  }
}

module.exports = { up };
