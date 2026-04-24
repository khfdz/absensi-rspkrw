const { pool } = require('./backend/src/config/database');
async function main() {
  try {
    const [rows] = await pool.query('DESCRIBE jadwal_dinas');
    console.log(JSON.stringify(rows, null, 2));
  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await pool.end();
    process.exit(0);
  }
}
main();
