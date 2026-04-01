const { pool } = require('./src/config/database');
const fs = require('fs');

async function check() {
  try {
    const [tables] = await pool.query('SHOW TABLES');
    let out = 'TABLES FOUND:\n';
    tables.forEach(t => out += '- ' + Object.values(t)[0] + '\n');
    
    const targets = ['biometric', 'user', 'record', 'biometrics', 'users', 'records'];
    for(const t of targets) {
      try {
        const [cols] = await pool.query('DESCRIBE ' + t);
        out += '\n--- STRUCTURE OF ' + t + ' ---\n';
        cols.forEach(c => out += `${c.Field} | ${c.Type} | ${c.Null} | ${c.Key} | ${c.Default} | ${c.Extra}\n`);
      } catch(e) {
        // ignore not found
      }
    }
    fs.writeFileSync('db_structure.txt', out);
    console.log('Result written to db_structure.txt');
    process.exit(0);
  } catch (err) {
    console.error('Error:', err);
    fs.writeFileSync('db_structure.txt', 'ERROR: ' + err.message);
    process.exit(1);
  }
}

check();
