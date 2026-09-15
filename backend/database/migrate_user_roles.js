const { pool } = require('../src/config/database');

async function migrate() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS user_roles (
        nik VARCHAR(50) NOT NULL PRIMARY KEY,
        role ENUM('IT', 'HRD', 'STAFF') NOT NULL DEFAULT 'STAFF',
        keterangan VARCHAR(255) NULL,
        updated_by VARCHAR(50) NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);
    console.log('✅ Table user_roles successfully created or already exists.');
    const [cols] = await pool.query('DESCRIBE user_roles');
    console.log(cols);
    process.exit(0);
  } catch (err) {
    console.error('❌ Migration failed:', err);
    process.exit(1);
  }
}

migrate();
