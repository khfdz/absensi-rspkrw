const { sikkPool } = require('../config/database');
const jwt = require('jsonwebtoken');

/**
 * Login Controller
 * Menggunakan database eksternal SIKKRW dengan enkripsi AES-128-ECB
 */
exports.login = async (req, res) => {
  const { nik, password } = req.body;

  if (!nik || !password) {
    return res.status(400).json({
      success: false,
      message: 'NIK dan Password wajib diisi'
    });
  }

  let connection;
  try {
    connection = await sikkPool.getConnection();

    // 1. Set mode enkripsi ke AES-128-ECB sesuai spesifikasi
    // Note: Jika MySQL versi lama (< 5.7.4), variabel ini tidak ada dan defaultnya sudah ECB.
    try {
      await connection.query("SET block_encryption_mode = 'aes-128-ecb'");
    } catch (e) {
      console.log("MySQL tidak mendukung SET block_encryption_mode, menggunakan default (ECB)...");
    }

    // 2. Query ke table user (asumsi nama table 'user' di database sikkrw)
    // Menggunakan pattern CONVERT(... USING latin1) dan CAST(... AS CHAR)
    const [rows] = await connection.query(
      `SELECT 
        CAST(AES_DECRYPT(CONVERT(id_user USING latin1), 'nur') AS CHAR) as nik,
        -- Tambahkan field lain jika diperlukan, misal nama
        'User SIKKRW' as nama 
      FROM user 
      WHERE 
        CAST(AES_DECRYPT(CONVERT(id_user USING latin1), 'nur') AS CHAR) = ? 
        AND 
        CAST(AES_DECRYPT(CONVERT(password USING latin1), 'windi') AS CHAR) = ?
      LIMIT 1`,
      [nik, password]
    );

    if (rows.length === 0) {
      return res.status(401).json({
        success: false,
        message: 'NIK atau Password salah'
      });
    }

    const user = rows[0];

    // 3. Generate JWT Token
    const token = jwt.sign(
      { 
        nik: user.nik, 
        nama: user.nama,
        role: user.nik.startsWith('ADM') ? 'Admin' : 'Staff' // Simple role mapping
      },
      process.env.JWT_SECRET || 'supersecretkey',
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );

    res.status(200).json({
      success: true,
      message: 'Login berhasil',
      token,
      user: {
        nik: user.nik,
        nama: user.nama,
        role: user.nik.startsWith('ADM') ? 'Admin' : 'Staff'
      }
    });

  } catch (error) {
    console.error('Login Error:', error);
    res.status(500).json({
      success: false,
      message: 'Terjadi kesalahan pada server saat login',
      error: error.message
    });
  } finally {
    if (connection) connection.release();
  }
};

/**
 * Validasi Token (Check Me)
 */
exports.checkMe = (req, res) => {
  res.status(200).json({
    success: true,
    user: req.user
  });
};
