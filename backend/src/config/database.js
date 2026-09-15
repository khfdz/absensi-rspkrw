require('dotenv').config();
const mysql = require('mysql2/promise');

const pool = mysql.createPool({
  host:             process.env.DB_HOST || 'localhost',
  port:             parseInt(process.env.DB_PORT) || 3306,
  user:             process.env.DB_USER || 'root',
  password:         process.env.DB_PASS || '',
  database:         process.env.DB_NAME || 'db_absensi_rspkrw',
  waitForConnections: true,
  connectionLimit:  10,
  queueLimit:       0,
  timezone:         '+07:00',
  charset:          'utf8mb4',
  connectTimeout:   10000,
});

// POOL UNTUK DATABASE EKSTERNAL (SIKKRW)
const sikkPool = mysql.createPool({
  host:             process.env.SIKK_DB_HOST || 'localhost',
  port:             parseInt(process.env.SIKK_DB_PORT) || 3306,
  user:             process.env.SIKK_DB_USER || 'root',
  password:         process.env.SIKK_DB_PASS || '',
  database:         process.env.SIKK_DB_NAME || 'sikkrw',
  waitForConnections: true,
  connectionLimit:  5,
  queueLimit:       0,
  timezone:         '+07:00',
  charset:          'utf8mb4',
  connectTimeout:   10000,
});

async function testConnection() {
  try {
    const conn = await pool.getConnection();
    console.log(`✅ MySQL Utama terhubung: ${process.env.DB_HOST}:${process.env.DB_PORT || 3306} → ${process.env.DB_NAME}`);
    conn.release();

    const connSikk = await sikkPool.getConnection();
    console.log(`✅ MySQL SIKKRW terhubung: ${process.env.SIKK_DB_HOST}:${process.env.SIKK_DB_PORT || 3306} → ${process.env.SIKK_DB_NAME}`);
    connSikk.release();

    // Auto-create tabel user_roles di database absensi jika belum ada
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

    return true;
  } catch (err) {
    console.error('❌ Gagal koneksi MySQL:', err.message);
    return false;
  }
}

module.exports = { pool, sikkPool, testConnection };
