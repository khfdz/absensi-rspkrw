const { pool } = require('./src/config/database');

async function main() {
  try {
    console.log('=== DATA DARI TABEL absensi ===');
    const [absensiRows] = await pool.execute(
      `SELECT id, pin, waktu, status, ip_source, created_at 
       FROM absensi 
       WHERE pin = '60000624' 
         AND waktu >= '2026-06-20 00:00:00' 
         AND waktu <= '2026-06-23 23:59:59'
       ORDER BY waktu ASC`
    );
    console.log(absensiRows);

    console.log('\n=== DATA DARI TABEL record ===');
    const [recordRows] = await pool.execute(
      `SELECT * FROM record 
       WHERE user_id = '60000624' 
         AND (
           check_time LIKE '6/20/2026%' OR 
           check_time LIKE '6/21/2026%' OR 
           check_time LIKE '6/22/2026%' OR 
           check_time LIKE '6/23/2026%'
         )
       ORDER BY id ASC`
    );
    console.log(recordRows);

    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

main();
