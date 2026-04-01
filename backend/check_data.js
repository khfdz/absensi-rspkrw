const { pool } = require('./src/config/database');

async function check() {
  try {
    const [rows] = await pool.execute(
      "SELECT * FROM absensi WHERE pin = '10004321' ORDER BY waktu DESC LIMIT 5"
    );
    console.log(JSON.stringify(rows, null, 2));
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

check();
