const { pool, sikkPool } = require('../config/database');
const { getIO }          = require('../config/socket');
const { parseAbsensiData } = require('../utils/parser');
const dayjs              = require('dayjs');

// ============================================================
// POST /api/absen  — Menerima push data dari mesin X100C
// ============================================================
async function receiveAbsensi(req, res) {
  try {
    const records = parseAbsensiData(req);

    if (!records || records.length === 0) {
      console.warn('⚠️  Data kosong atau tidak dikenali dari', req.ip);
      return res.status(200).send('OK');
    }

    const saved  = [];
    const errors = [];

    for (const record of records) {
      try {
        if (!record.pin) { errors.push({ record, error: 'PIN kosong' }); continue; }

        if (!record.waktu || isNaN(record.waktu.getTime())) {
          record.waktu = new Date();
          console.warn(`⚠️  Waktu tidak valid untuk PIN ${record.pin}, pakai waktu server`);
        }

        const [dup] = await pool.execute(
          `SELECT id FROM absensi
           WHERE pin = ? AND ABS(TIMESTAMPDIFF(SECOND, waktu, ?)) < 30
           LIMIT 1`,
          [record.pin, record.waktu]
        );
        if (dup.length > 0) {
          console.log(`ℹ️  Duplikat diabaikan — PIN: ${record.pin}`);
          saved.push({ ...record, status_save: 'duplicate' });
          continue;
        }

        const [result] = await pool.execute(
          `INSERT INTO absensi (pin, waktu, status, device_id, raw_data, created_at)
           VALUES (?, ?, ?, ?, ?, NOW())`,
          [
            record.pin,
            dayjs(record.waktu).format('YYYY-MM-DD HH:mm:ss'),
            record.status,
            record.device_id || null,
            JSON.stringify(record.raw),
          ]
        );

        // Ambil data absensi yang baru disimpan
        const [rows] = await pool.execute(
          `SELECT id, pin, waktu, status, device_id, created_at FROM absensi WHERE id = ?`,
          [result.insertId]
        );

        const absensi = rows[0];

        // Cari nama di SIKKRW (manual fetch karena beda server)
        const [pegawai] = await sikkPool.query(
          `SELECT nama, departemen FROM pegawai WHERE nik = ? LIMIT 1`,
          [absensi.pin]
        );

        const absensiData = {
          ...absensi,
          nama_karyawan: pegawai[0] ? pegawai[0].nama : 'Tidak Terdaftar',
          departemen: pegawai[0] ? pegawai[0].departemen : '-',
          waktu: dayjs(absensi.waktu).format('YYYY-MM-DD HH:mm:ss')
        };

        console.log(`✅ Tersimpan — PIN: ${record.pin} | ${record.status} | ${absensiData.waktu}`);

        try {
          getIO().emit('absensi:baru', absensiData);
        } catch (_) {}

        saved.push({ ...absensiData, status_save: 'saved' });
      } catch (err) {
        console.error('❌ Gagal simpan record:', err.message);
        errors.push({ record, error: err.message });
      }
    }

    return res.status(200).json({ success: true, saved: saved.length, errors: errors.length });

  } catch (err) {
    console.error('❌ receiveAbsensi error:', err);
    return res.status(200).send('OK'); 
  }
}

// ============================================================
// GET /api/absensi — List data (untuk frontend)
// ============================================================
async function getAbsensi(req, res) {
  try {
    const {
      startDate, endDate,
      pin, status, departemen,
      page = 1, limit = 500,
    } = req.query;

    const offset = (parseInt(page) - 1) * parseInt(limit);
    const params = [];
    let where = 'WHERE 1=1';

    // Filter Tanggal
    if (startDate) {
      where += ' AND DATE(waktu) >= ?';
      params.push(startDate);
    }
    if (endDate) {
      where += ' AND DATE(waktu) <= ?';
      params.push(endDate);
    }

    // Filter Status
    if (status && status !== 'all') {
      where += ' AND status = ?';
      params.push(status.toLowerCase());
    }

    // FILTER BEBAS: Jika ada input pencarian (NIP atau Nama)
    let filteredPins = null;
    if (pin && pin.trim() !== '') {
      // Cari NIK di SIKKRW yang sesuai dengan NIP atau Nama
      const [matches] = await sikkPool.query(
        `SELECT nik FROM pegawai WHERE nik = ? OR nama LIKE ?`,
        [pin, `%${pin}%`]
      );
      filteredPins = matches.map(m => m.nik);
      
      if (filteredPins.length > 0) {
        where += ` AND pin IN (?)`;
        params.push(filteredPins);
      } else {
        // Jika tidak ada yang cocok di SIKKRW, paksa hasil kosong
        where += ` AND 1=0`;
      }
    }

    // 1. Ambil log absensi dari local DB
    const [rows] = await pool.execute(
      `SELECT id, pin, waktu, status, device_id, created_at
       FROM absensi
       ${where}
       ORDER BY waktu DESC
       LIMIT ${parseInt(limit)} OFFSET ${offset}`,
      params
    );

    const [cnt] = await pool.execute(`SELECT COUNT(*) AS total FROM absensi ${where}`, params);

    if (rows.length === 0) {
      return res.json({ success: true, data: [], pagination: { total: 0 } });
    }

    // 2. Ambil semua nama pegawai yang unik dari SIKKRW
    const pins = [...new Set(rows.map(r => r.pin))];
    const [pegawaiRows] = await sikkPool.query(
      `SELECT nik, nama, departemen FROM pegawai WHERE nik IN (?)`,
      [pins]
    );

    // Map pegawai ke object untuk akses cepat
    const pegawaiMap = {};
    pegawaiRows.forEach(p => { pegawaiMap[p.nik] = p; });

    // 3. Gabungkan data (Merge)
    let mergedData = rows.map(r => ({
      ...r,
      nama_karyawan: pegawaiMap[r.pin] ? pegawaiMap[r.pin].nama : '-',
      departemen: pegawaiMap[r.pin] ? pegawaiMap[r.pin].departemen : '-',
      waktu: dayjs(r.waktu).format('YYYY-MM-DD HH:mm:ss')
    }));

    // Optional: Filter by department if requested (since departemen is in SIKKRW)
    if (departemen && departemen !== 'all') {
      mergedData = mergedData.filter(d => d.departemen === departemen);
    }

    return res.json({
      success: true, 
      data: mergedData,
      pagination: {
        page: parseInt(page), limit: parseInt(limit),
        total: cnt[0].total,
        total_pages: Math.ceil(cnt[0].total / parseInt(limit)),
      },
    });
  } catch (err) {
    console.error('❌ getAbsensi:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
}

// ============================================================
// GET /api/absensi/realtime — Data 60 detik terakhir
// ============================================================
async function getRealtimeAbsensi(req, res) {
  try {
    const [rows] = await pool.execute(
      `SELECT id, pin, waktu, status, device_id
       FROM absensi
       WHERE created_at >= DATE_SUB(NOW(), INTERVAL 60 SECOND)
       ORDER BY created_at DESC LIMIT 20`
    );

    if (rows.length === 0) return res.json({ success: true, data: [] });

    const pins = [...new Set(rows.map(r => r.pin))];
    const [pegawaiRows] = await sikkPool.query(
      `SELECT nik, nama, departemen FROM pegawai WHERE nik IN (?)`,
      [pins]
    );
    const pegawaiMap = {};
    pegawaiRows.forEach(p => { pegawaiMap[p.nik] = p; });

    const merged = rows.map(r => ({
      ...r,
      nama_karyawan: pegawaiMap[r.pin] ? pegawaiMap[r.pin].nama : '-',
      departemen: pegawaiMap[r.pin] ? pegawaiMap[r.pin].departemen : '-',
      waktu: dayjs(r.waktu).format('YYYY-MM-DD HH:mm:ss')
    }));

    return res.json({ success: true, data: merged, server_time: dayjs().format('YYYY-MM-DD HH:mm:ss') });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

// ============================================================
// GET /api/absensi/rekap — Rekap harian (Pintar: Gabung In + Out)
// ============================================================
async function getRekapHarian(req, res) {
  try {
    const { tanggal = dayjs().format('YYYY-MM-DD') } = req.query;
    const nextDay = dayjs(tanggal).add(1, 'day').format('YYYY-MM-DD');

    // 1. Ambil semua log absensi untuk hari ini DAN besok (untuk shift malam)
    const [absensiRows] = await pool.execute(
      `SELECT pin, waktu, status, device_id, ip_source
       FROM absensi 
       WHERE DATE(waktu) BETWEEN ? AND ?
       ORDER BY waktu ASC`,
      [tanggal, nextDay]
    );

    // 2. Ambil data pegawai dari SIKKRW
    const [pegawaiRows] = await sikkPool.query(`SELECT nik, nama, departemen FROM pegawai`);

    // 3. Proses Gabung Baris (Consolidation Logic)
    const rekap = pegawaiRows.map(p => {
      const logs = absensiRows.filter(a => a.pin === p.nik);
      
      // Filter log 'masuk' khusus di tanggal yang dipilih (Basis Rekap)
      const logsMasukHariIni = logs.filter(l => 
        l.status === 'masuk' && dayjs(l.waktu).format('YYYY-MM-DD') === tanggal
      );

      // Filter log 'pulang' pada tanggal yang dipilih
      const logsPulangHariIni = logs.filter(l => 
        l.status === 'pulang' && dayjs(l.waktu).format('YYYY-MM-DD') === tanggal
      );

      // Cari Pasangan: Untuk setiap 'masuk', cari 'pulang' terdekat (max +14 jam)
      const results = [];
      
      if (logsMasukHariIni.length > 0) {
        logsMasukHariIni.forEach(m => {
          const startTime = dayjs(m.waktu);
          // Cari 'pulang' pertama setelah jam masuk ini, dalam jendela 14 jam
          const pMatch = logs.find(l => 
            l.status === 'pulang' && 
            dayjs(l.waktu).isAfter(startTime) && 
            dayjs(l.waktu).diff(startTime, 'hour') <= 14
          );

          results.push({
            pin: p.nik,
            nama: p.nama,
            departemen: p.departemen,
            tanggal: tanggal,
            jam_masuk: startTime.format('HH:mm:ss'),
            jam_pulang: pMatch ? dayjs(pMatch.waktu).format('HH:mm:ss') : null,
            tgl_pulang: pMatch ? dayjs(pMatch.waktu).format('YYYY-MM-DD') : null,
            total_scan: logs.filter(l => dayjs(l.waktu).format('YYYY-MM-DD') === tanggal).length,
            lokasi: (m.device_id == 1 || !m.device_id || m.ip_source === '192.168.10.150') ? 'Basement' : (m.ip_source || `Mesin ${m.device_id}`),
            status: pMatch ? 'LENGKAP' : 'LUPA_PULANG'
          });
        });
      } else if (logsPulangHariIni.length > 0) {
        // Kasus: Ada 'pulang' tapi tidak ada 'masuk' di hari yang sama
        logsPulangHariIni.forEach(pScan => {
          results.push({
            pin: p.nik,
            nama: p.nama,
            departemen: p.departemen,
            tanggal: tanggal,
            jam_masuk: null,
            jam_pulang: dayjs(pScan.waktu).format('HH:mm:ss'),
            lokasi: (pScan.device_id == 1 || !pScan.device_id || pScan.ip_source === '192.168.10.150') ? 'Basement' : (pScan.ip_source || `Mesin ${pScan.device_id}`),
            status: 'LUPA_MASUK'
          });
        });
      }

      return results;
    }).flat();

    // Mapping akhir untuk frontend
    const finalData = rekap.filter(r => r !== null);

    return res.json({ 
      success: true, 
      tanggal, 
      data: finalData 
    });
  } catch (err) {
    console.error('❌ getRekapHarian:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
}

module.exports = { receiveAbsensi, getAbsensi, getRealtimeAbsensi, getRekapHarian };
