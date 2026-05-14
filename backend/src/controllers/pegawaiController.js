const { sikkPool } = require('../config/database');

/**
 * Mendapatkan daftar pegawai dari database SIKKRW
 */
exports.getPegawai = async (req, res) => {
  try {
    const { search, limit = 100 } = req.query;
    
    let query = `
      SELECT 
        id, nik, nama, jk, jbtn, jnj_jabatan, departemen, bidang, stts_aktif,
        tgl_lahir, alamat, no_ktp
      FROM pegawai
    `;
    
    const params = [];
    if (search) {
      query += ` WHERE nama LIKE ? OR nik LIKE ? OR departemen LIKE ?`;
      const searchTerm = `%${search}%`;
      params.push(searchTerm, searchTerm, searchTerm);
    }
    
    query += ` ORDER BY nama ASC LIMIT ?`;
    params.push(parseInt(limit));

    const [rows] = await sikkPool.query(query, params);

    res.status(200).json({
      success: true,
      count: rows.length,
      data: rows.map(r => ({
        ...r,
        jk: (r.jk === 'Laki-Laki' || r.jk === 'Pria' || r.jk === 'L') ? 'L' : 'P' // Normalisasi JK untuk frontend
      }))
    });
  } catch (error) {
    console.error('Error fetching pegawai:', error);
    res.status(500).json({
      success: false,
      message: 'Gagal mengambil data pegawai dari database SIKKRW',
      error: error.message
    });
  }
};

/**
 * Mendapatkan daftar user + password terdekripsi dari SIKKRW
 * HANYA GET DATA (Read-Only)
 */
exports.getSikkUsers = async (req, res) => {
  let connection;
  try {
    connection = await sikkPool.getConnection();

    // Set encryption mode
    try {
      await connection.query("SET block_encryption_mode = 'aes-128-ecb'");
    } catch (e) {
      console.log("Note: Menggunakan default ECB mode.");
    }

    const [rows] = await connection.query(`
      SELECT 
        CAST(AES_DECRYPT(CONVERT(u.id_user USING latin1), 'nur') AS CHAR) as nik_decrypted,
        CAST(AES_DECRYPT(CONVERT(u.password USING latin1), 'windi') AS CHAR) as password_decrypted,
        p.nama,
        p.departemen,
        u.* 
      FROM user u
      LEFT JOIN pegawai p ON CAST(AES_DECRYPT(CONVERT(u.id_user USING latin1), 'nur') AS CHAR) = p.nik
    `);

    res.status(200).json({
      success: true,
      count: rows.length,
      data: rows
    });
  } catch (error) {
    console.error('Error fetching SIKK users:', error);
    res.status(500).json({
      success: false,
      message: 'Gagal mengambil data user SIKKRW',
      error: error.message
    });
  } finally {
    if (connection) connection.release();
  }
};
