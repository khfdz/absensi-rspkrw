require('dotenv').config({ path: 'c:/Users/IT-HP/.gemini/antigravity/scratch/absensi-rspkrw/backend/.env' });
const { pool } = require('c:/Users/IT-HP/.gemini/antigravity/scratch/absensi-rspkrw/backend/src/config/database');

async function setupMapping() {
  console.log('1. Membuat tabel mapping_nik_mesin jika belum ada...');
  await pool.query(`
    CREATE TABLE IF NOT EXISTS mapping_nik_mesin (
      id INT AUTO_INCREMENT PRIMARY KEY,
      pin_mesin VARCHAR(50) NOT NULL UNIQUE,
      nik_pegawai VARCHAR(50) NOT NULL,
      nama VARCHAR(150) NOT NULL,
      departemen VARCHAR(100) DEFAULT '-',
      keterangan VARCHAR(255) DEFAULT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_pin_mesin (pin_mesin),
      INDEX idx_nik_pegawai (nik_pegawai)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  console.log('2. Memasukkan data 11 karyawan ke mapping_nik_mesin...');
  const mappings = [
    { pin_mesin: '50002121', nik_pegawai: '50002221', nama: 'Wijaya', departemen: 'UM', keterangan: 'Salah 1 digit di mesin (21 vs 22)' },
    { pin_mesin: '50004225', nik_pegawai: '50004225', nama: 'Abdul Rohman', departemen: 'ME', keterangan: 'Staf ME - Belum terdaftar di Khanza' },
    { pin_mesin: '50004425', nik_pegawai: '50004425', nama: 'Wildan Nurhayat', departemen: 'ME', keterangan: 'Staf ME - Belum terdaftar di Khanza' },
    { pin_mesin: '50004526', nik_pegawai: '50004526', nama: 'Gian Afta Suadana', departemen: 'ME', keterangan: 'Staf ME - Belum terdaftar di Khanza' },
    { pin_mesin: '90003516', nik_pegawai: '90003720', nama: 'Sandi Nur Sifa', departemen: 'IGD', keterangan: 'PIN di mesin berbeda dengan NIK Khanza' },
    { pin_mesin: '90006121', nik_pegawai: '90012422', nama: 'Herni Nurheni', departemen: 'VK', keterangan: 'PIN di mesin berbeda dengan NIK Khanza' },
    { pin_mesin: '90011522', nik_pegawai: '90001622', nama: 'Ike Nuriyah', departemen: 'RW5', keterangan: 'PIN di mesin berbeda dengan NIK Khanza' },
    { pin_mesin: '90011322', nik_pegawai: '90013322', nama: 'Regina Gustiani', departemen: 'RW5', keterangan: 'PIN di mesin berbeda dengan NIK Khanza' },
    { pin_mesin: '70000316', nik_pegawai: '70000316', nama: 'Hasanudin Mustika', departemen: 'RAD', keterangan: 'Departemen di Khanza adalah RAD (Radiologi/RO)' },
    { pin_mesin: '90011422', nik_pegawai: '90001522', nama: 'Gina Sukraba', departemen: 'KB', keterangan: 'PIN di mesin berbeda dengan NIK Khanza' },
    { pin_mesin: '70006921', nik_pegawai: '70006821', nama: 'Setia Murniawati Ramly', departemen: 'LAB', keterangan: 'Salah 1 digit di mesin (69 vs 68)' }
  ];

  for (const m of mappings) {
    await pool.query(`
      INSERT INTO mapping_nik_mesin (pin_mesin, nik_pegawai, nama, departemen, keterangan)
      VALUES (?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        nik_pegawai = VALUES(nik_pegawai),
        nama = VALUES(nama),
        departemen = VALUES(departemen),
        keterangan = VALUES(keterangan)
    `, [m.pin_mesin, m.nik_pegawai, m.nama, m.departemen, m.keterangan]);
  }

  console.log('3. Melakukan migrasi log riwayat di tabel absensi & record...');
  for (const m of mappings) {
    if (m.pin_mesin !== m.nik_pegawai) {
      const [resAbs] = await pool.query('UPDATE absensi SET pin = ? WHERE pin = ?', [m.nik_pegawai, m.pin_mesin]);
      const [resRec] = await pool.query('UPDATE record SET user_id = ? WHERE user_id = ?', [m.nik_pegawai, m.pin_mesin]);
      console.log(`Migrasi ${m.nama}: ${m.pin_mesin} -> ${m.nik_pegawai} (Absensi: ${resAbs.affectedRows}, Record: ${resRec.affectedRows})`);
    }
  }

  console.log('Selesai setup dan migrasi awal.');
  process.exit(0);
}

setupMapping().catch(err => {
  console.error('Error setupMapping:', err);
  process.exit(1);
});
