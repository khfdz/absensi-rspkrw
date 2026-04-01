const { pool, sikkPool } = require('../config/database');
const dayjs = require('dayjs');

/**
 * Mendapatkan statistik dashboard (Jumlah Pegawai, Kehadiran, Chart Data)
 */
exports.getDashboardStats = async (req, res) => {
  try {
    const today = dayjs().format('YYYY-MM-DD');

    // 1. Total Pegawai (dari SIKKRW - server 192.168.10.11)
    const [pegawaiStats] = await sikkPool.query(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN stts_aktif = 'Aktif' THEN 1 ELSE 0 END) as aktif,
        SUM(CASE WHEN stts_aktif = 'Non-Aktif' THEN 1 ELSE 0 END) as non_aktif,
        SUM(CASE WHEN stts_aktif = 'Cuti' THEN 1 ELSE 0 END) as cuti
      FROM pegawai
    `);

    // 2. Kehadiran Hari Ini (dari local database - localhost)
    const [absensiStats] = await pool.query(`
      SELECT COUNT(DISTINCT pin) as hadir
      FROM absensi
      WHERE DATE(waktu) = ? AND status IN ('masuk', 'pulang')
    `, [today]);

    // 3. Pegawai per Departemen (Top 10)
    const [deptStats] = await sikkPool.query(`
      SELECT departemen as dept, COUNT(*) as count
      FROM pegawai
      WHERE departemen != '-' AND departemen != ''
      GROUP BY departemen
      ORDER BY count DESC
      LIMIT 10
    `);

    // 4. Status Pegawai Distribution
    const statusData = [
      { name: 'Aktif', value: pegawaiStats[0].aktif || 0 },
      { name: 'Non-Aktif', value: pegawaiStats[0].non_aktif || 0 },
      { name: 'Cuti', value: pegawaiStats[0].cuti || 0 },
    ];

    res.status(200).json({
      success: true,
      stats: {
        totalPegawai: pegawaiStats[0].total || 0,
        hadirHariIni: absensiStats[0].hadir || 0,
        aktif: pegawaiStats[0].aktif || 0,
        nonAktif: pegawaiStats[0].non_aktif || 0,
        cuti: pegawaiStats[0].cuti || 0,
        tingkatKehadiran: pegawaiStats[0].aktif > 0 
          ? Math.round((absensiStats[0].hadir / pegawaiStats[0].aktif) * 100) 
          : 0
      },
      deptData: deptStats,
      statusData: statusData
    });

  } catch (error) {
    console.error('Dashboard Stats Error:', error);
    res.status(500).json({
      success: false,
      message: 'Gagal mengambil statistik dashboard',
      error: error.message
    });
  }
};
