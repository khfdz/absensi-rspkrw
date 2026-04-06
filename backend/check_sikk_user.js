const { sikkPool } = require('./src/config/database');
async function check() {
  try {
    const [cols] = await sikkPool.query('DESCRIBE user');
    console.log('--- STRUCTURE OF user in SIKKRW ---');
    cols.forEach(c => console.log(`${c.Field} | ${c.Type} | ${c.Null} | ${c.Key} | ${c.Default}`));
    process.exit(0);
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
}
check();
