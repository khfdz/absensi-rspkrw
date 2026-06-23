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

    // 5. Gender Distribution (Pria vs Wanita)
    const [genderStats] = await sikkPool.query(`
      SELECT jk, COUNT(*) as count 
      FROM pegawai 
      GROUP BY jk
    `);
    let pria = 0;
    let wanita = 0;
    genderStats.forEach(g => {
      const jkStr = String(g.jk || '').toLowerCase();
      if (jkStr.startsWith('l') || jkStr.startsWith('pria') || jkStr === 'm') {
        pria += g.count;
      } else if (jkStr.startsWith('p') || jkStr.startsWith('wanita') || jkStr.startsWith('w') || jkStr === 'f') {
        wanita += g.count;
      }
    });
    const genderData = [
      { name: 'Pria', value: pria },
      { name: 'Wanita', value: wanita }
    ];

    // 6. Hourly Attendance Pattern (Today)
    const [hourlyStats] = await pool.query(`
      SELECT HOUR(waktu) as hour, COUNT(*) as count
      FROM absensi
      WHERE DATE(waktu) = ?
      GROUP BY HOUR(waktu)
      ORDER BY hour ASC
    `, [today]);

    const hourlyData = Array.from({ length: 24 }, (_, i) => ({
      hour: `${String(i).padStart(2, '0')}:00`,
      count: 0
    }));
    hourlyStats.forEach(h => {
      if (h.hour >= 0 && h.hour < 24) {
        hourlyData[h.hour].count = h.count;
      }
    });

    // Filter hourlyData to active hospital scanning hours (e.5., 05:00 to 22:00) for a cleaner chart
    const activeHourlyData = hourlyData.slice(5, 23);

    // 7. Today's Scan Status Breakdown
    const [statusBreakdownStats] = await pool.query(`
      SELECT status, COUNT(*) as count
      FROM absensi
      WHERE DATE(waktu) = ?
      GROUP BY status
    `, [today]);

    const statusBreakdown = statusBreakdownStats.map(s => ({
      status: s.status,
      count: s.count
    }));

    // 8. Recent Attendance Activity (10 Latest Logs)
    const [recentLogs] = await pool.query(`
      SELECT id, pin, waktu, status, ip_source, device_id
      FROM absensi
      ORDER BY waktu DESC
      LIMIT 10
    `);

    let recentActivity = [];
    if (recentLogs.length > 0) {
      const pins = recentLogs.map(l => l.pin);
      const [pegawaiDetails] = await sikkPool.query(
        `SELECT nik, nama, departemen FROM pegawai WHERE nik IN (?)`,
        [pins]
      );
      const employeeMap = {};
      pegawaiDetails.forEach(p => {
        employeeMap[p.nik] = p;
      });

      recentActivity = recentLogs.map(l => ({
        id: l.id,
        pin: l.pin,
        nama: employeeMap[l.pin]?.nama || 'Karyawan Baru / Tidak Terdaftar',
        departemen: employeeMap[l.pin]?.departemen || '-',
        waktu: dayjs(l.waktu).format('YYYY-MM-DD HH:mm:ss'),
        status: l.status,
        lokasi: (l.ip_source === '192.168.10.150' || l.device_id == 1) 
          ? 'Basement' 
          : (l.ip_source === '192.168.10.185' ? 'Poli Lt 2' : (l.ip_source || `Mesin ${l.device_id}`))
      }));
    }

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
      statusData: statusData,
      genderData: genderData,
      hourlyData: activeHourlyData,
      statusBreakdown: statusBreakdown,
      recentActivity: recentActivity
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
