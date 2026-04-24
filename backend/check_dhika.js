const { pool } = require('./src/config/database');
const dayjs = require('dayjs');

async function check() {
  try {
    const [rows] = await pool.execute(
      `SELECT * FROM jadwal_dinas WHERE pin = '60000624' AND tanggal = '2026-04-20'`
    );
    console.log('Jadwal:', rows);
    
    const [abs] = await pool.execute(
      `SELECT * FROM absensi WHERE pin = '60000624' AND DATE(waktu) = '2026-04-20' ORDER BY waktu ASC`
    );
    console.log('Absensi:', abs.map(a => ({ waktu: a.waktu, status: a.status })));
    
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

check();
