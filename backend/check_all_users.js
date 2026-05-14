const { sikkPool } = require('./src/config/database');

async function checkUsers() {
  let connection;
  try {
    connection = await sikkPool.getConnection();
    
    // Set encryption mode
    try {
      await connection.query("SET block_encryption_mode = 'aes-128-ecb'");
    } catch (e) {
      console.log("Note: MySQL standard ECB mode being used.");
    }

    console.log('--- FETCHING & DECRYPTING ALL USERS FROM SIKKRW ---');
    
    const [rows] = await connection.query(`
      SELECT 
        CAST(AES_DECRYPT(CONVERT(id_user USING latin1), 'nur') AS CHAR) as nik,
        CAST(AES_DECRYPT(CONVERT(password USING latin1), 'windi') AS CHAR) as password_plain
      FROM user
    `);

    console.log(`Total users found: ${rows.length}`);
    console.log('Sample (Top 10):');
    rows.slice(0, 10).forEach((u, i) => {
      console.log(`${i+1}. NIK: ${u.nik} | PW: ${u.password_plain}`);
    });

    process.exit(0);
  } catch (err) {
    console.error('❌ Error:', err.message);
    process.exit(1);
  } finally {
    if (connection) connection.release();
  }
}

checkUsers();
