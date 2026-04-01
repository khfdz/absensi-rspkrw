const { pool } = require('./src/config/database');

async function migrate() {
  try {
    console.log('--- Migrasi: Menambah kolom ip_source ke tabel absensi ---');
    await pool.query('ALTER TABLE absensi ADD COLUMN ip_source VARCHAR(45) AFTER device_id');
    console.log('✅ Berhasil menambah kolom ip_source');
    process.exit(0);
  } catch (err) {
    if (err.code === 'ER_DUP_COLUMN_NAME') {
      console.log('ℹ️ Kolom ip_source sudah ada.');
    } else {
      console.error('❌ Gagal migrasi:', err.message);
    }
    process.exit(1);
  }
}

migrate();
