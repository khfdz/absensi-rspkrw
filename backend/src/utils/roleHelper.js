const { pool, sikkPool } = require('../config/database');

/**
 * Mendapatkan role efektif pengguna (IT, HRD, STAFF)
 * Prioritas:
 * 1. Nilai yang tersimpan di tabel user_roles (database absensi)
 * 2. Fallback otomatis berdasarkan NIK atau departemen di SIKKRW:
 *    - NIK 'adm' atau departemen 'IT' -> 'IT'
 *    - departemen 'HRD' -> 'HRD'
 *    - selain itu -> 'STAFF'
 */
async function getUserRole(nik, departemen = null) {
  try {
    if (!nik) return 'STAFF';

    // 1. Cek apakah ada role tersimpan di database lokal absensi
    const [rows] = await pool.query(
      'SELECT role FROM user_roles WHERE nik = ? LIMIT 1',
      [nik]
    );

    if (rows && rows.length > 0 && rows[0].role) {
      return rows[0].role;
    }

    // 2. Jika departemen belum diberikan, ambil dari tabel pegawai SIKKRW
    let dept = departemen;
    if (dept === null || dept === undefined) {
      try {
        const [pegawaiRows] = await sikkPool.query(
          'SELECT departemen FROM pegawai WHERE nik = ? LIMIT 1',
          [nik]
        );
        if (pegawaiRows.length > 0) {
          dept = pegawaiRows[0].departemen;
        }
      } catch (err) {
        console.warn('Gagal mengambil departemen untuk fallback role:', err.message);
      }
    }

    // 3. Fallback default
    if (String(nik).toLowerCase() === 'adm' || (dept && String(dept).trim().toUpperCase() === 'IT')) {
      return 'IT';
    }
    if (dept && String(dept).trim().toUpperCase() === 'HRD') {
      return 'HRD';
    }

    return 'STAFF';
  } catch (error) {
    console.error('Error determining user role:', error);
    return 'STAFF';
  }
}

module.exports = { getUserRole };
