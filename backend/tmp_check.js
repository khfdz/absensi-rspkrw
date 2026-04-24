const { sikkPool } = require('./src/config/database');
async function test() {
  try {
    const [userRows] = await sikkPool.query("SELECT CAST(AES_DECRYPT(CONVERT(id_user USING latin1), 'nur') AS CHAR) as id_user FROM user LIMIT 5");
    console.log("USERS DB SIKKRW:");
    console.log(userRows);
    
    for (let row of userRows) {
        if (!row.id_user) continue;
        const [pegawaiRow] = await sikkPool.query("SELECT * FROM pegawai WHERE nik = ?", [row.id_user]);
        console.log(`Pencarian NIK: ${row.id_user} di tabel pegawai -> Hasil: ${pegawaiRow.length} baris`);
        if (pegawaiRow.length > 0) {
            console.log("    Nama Pegawai:", pegawaiRow[0].nama);
        } else {
            // Coba lihat apakah ada mapping lain, misalnya id_user bukan nik?
            const [coba] = await sikkPool.query("SELECT * FROM pegawai LIMIT 2");
            console.log(`    Contoh isi tabel pegawai: NIK(${coba[0]?.nik}) NAMA(${coba[0]?.nama})`);
        }
    }
  } catch(e) {
    console.error(e);
  } finally {
    process.exit();
  }
}
test();
