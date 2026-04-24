const { pool } = require('./backend/src/config/database');

async function main() {
  try {
    const tableSql = `
      CREATE TABLE IF NOT EXISTS lembur (
        id INT AUTO_INCREMENT PRIMARY KEY,
        nik VARCHAR(50) NOT NULL,
        nama VARCHAR(100) NOT NULL,
        bidang VARCHAR(100),
        departemen VARCHAR(100),
        jbtn VARCHAR(100),
        tgl_lembur DATE NOT NULL,
        jam_mulai TIME NOT NULL,
        jam_selesai TIME NOT NULL,
        total_jam VARCHAR(20),
        keterangan TEXT,
        status ENUM('PENDING', 'APPROVED_SUPERVISOR', 'APPROVED_HRD', 'REJECTED') DEFAULT 'PENDING',
        approved_self_at TIMESTAMP NULL,
        approved_supervisor_by VARCHAR(50) NULL,
        approved_supervisor_at TIMESTAMP NULL,
        approved_hrd_by VARCHAR(50) NULL,
        approved_hrd_at TIMESTAMP NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `;
    await pool.query(tableSql);
    console.log('✅ Table lembur created successfully');
  } catch (err) {
    console.error('❌ Error creating table lembur:', err.message);
  } finally {
    await pool.end();
    process.exit(0);
  }
}

main();
