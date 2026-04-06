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

        const ipSource = req.headers['x-forwarded-for'] || req.socket.remoteAddress || req.ip;
        const [result] = await pool.execute(
          `INSERT INTO absensi (pin, waktu, status, device_id, ip_source, raw_data, created_at)
           VALUES (?, ?, ?, ?, ?, ?, NOW())`,
          [
            record.pin,
            dayjs(record.waktu).format('YYYY-MM-DD HH:mm:ss'),
            record.status,
            record.device_id || null,
            ipSource,
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
            lokasi: (m.ip_source === '192.168.10.150' || m.device_id == 1) ? 'Basement' : (m.ip_source === '192.168.10.185' ? 'Poli Lt 2' : (m.ip_source || `Mesin ${m.device_id}`)),
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
            lokasi: (pScan.ip_source === '192.168.10.150' || pScan.device_id == 1) ? 'Basement' : (pScan.ip_source === '192.168.10.185' ? 'Poli Lt 2' : (pScan.ip_source || `Mesin ${pScan.device_id}`)),
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

// ============================================================
// GET /api/absensi/laporan-kb — Laporan Khusus Kamar Bayi
// ============================================================
async function getLaporanAbsenKB(req, res) {
  try {
    const { startDate, endDate, departemen } = req.query;

    if (!startDate || !endDate) {
      return res.status(400).json({ success: false, message: 'startDate dan endDate wajib diisi' });
    }

    const start = dayjs(startDate);
    const end = dayjs(endDate);
    const diffDays = end.diff(start, 'day') + 1;

    if (diffDays > 40) {
      return res.status(400).json({ success: false, message: 'Rentang tanggal maksimal 40 hari' });
    }

    // 1. Generate Array Tanggal
    const dateArray = [];
    for (let i = 0; i < diffDays; i++) {
      dateArray.push(start.add(i, 'day').format('YYYY-MM-DD'));
    }

    // 2. Ambil Data Pegawai dari SIKKRW
    let pegawaiQuery = `
      SELECT nik, nama, pendidikan, jbtn, mulai_kerja, departemen 
      FROM pegawai 
      WHERE stts_aktif = 'AKTIF'
    `;
    const pegawaiParams = [];
    if (departemen && departemen !== 'all') {
      pegawaiQuery += ` AND departemen = ?`;
      pegawaiParams.push(departemen);
    }

    const [pegawaiRows] = await sikkPool.query(pegawaiQuery, pegawaiParams);

    if (pegawaiRows.length === 0) {
      return res.json({ success: true, data: [], dates: dateArray });
    }

    const pins = pegawaiRows.map(p => p.nik);

    // 3. Ambil Jadwal Dinas & Jam Wajib
    const [jadwalRows] = await pool.execute(
      `SELECT pin, tanggal, shift, wajib_masuk, kategori, jam_mulai, jam_selesai 
       FROM jadwal_dinas 
       WHERE tanggal BETWEEN ? AND ? AND pin IN (${pins.map(() => '?').join(',')})`,
      [startDate, endDate, ...pins]
    );

    const jadwalMap = {};
    jadwalRows.forEach(j => {
      const tgl = dayjs(j.tanggal).format('YYYY-MM-DD');
      if (!jadwalMap[j.pin]) jadwalMap[j.pin] = {};
      if (!jadwalMap[j.pin][tgl]) jadwalMap[j.pin][tgl] = {};
      jadwalMap[j.pin][tgl][j.kategori || 'WAJIB'] = j;
    });

    // 4. Ambil Data Absensi Log (untuk cek apakah masuk atau tidak)
    const [absensiLogs] = await pool.execute(
      `SELECT pin, DATE(waktu) as tanggal, COUNT(*) as jml_scan
       FROM absensi 
       WHERE DATE(waktu) BETWEEN ? AND ? AND pin IN (${pins.map(() => '?').join(',')})
       GROUP BY pin, DATE(waktu)`,
      [startDate, endDate, ...pins]
    );

    const absensiMap = {};
    absensiLogs.forEach(a => {
      const tgl = dayjs(a.tanggal).format('YYYY-MM-DD');
      if (!absensiMap[a.pin]) absensiMap[a.pin] = {};
      absensiMap[a.pin][tgl] = a.jml_scan;
    });

    // 5. Hitung Sisa Cuti (12 - Cuti diambil tahun ini)
    const currentYear = dayjs().year();
    const [cutiRows] = await pool.execute(
      `SELECT pin, COUNT(*) as total_cuti 
       FROM jadwal_dinas 
       WHERE (shift = 'Ct' OR shift = 'CB') AND YEAR(tanggal) = ? AND pin IN (${pins.map(() => '?').join(',')})
       GROUP BY pin`,
      [currentYear, ...pins]
    );
    const cutiMap = {};
    cutiRows.forEach(c => { cutiMap[c.pin] = c.total_cuti; });

    // 6. Proses Agregasi per Pegawai
    const reportData = pegawaiRows.map(p => {
      let totalJamAktual = 0;
      let jamWajibPeriode = 0;
      let totalLemburActual = 0; 
      let countLemburActual = 0; 
      const shiftCounts = { P: 0, S: 0, M: 0, Md: 0, Lm: 0, L: 0, Oc: 0, PS: 0, X: 0, SID: 0, SKS: 0, Pe: 0, Ct: 0, CB: 0, i: 0, A: 0 };
      const dailyStatus = {};

      const todayStr = dayjs().format('YYYY-MM-DD');

      dateArray.forEach(tgl => {
        const jWajib = jadwalMap[p.nik]?.[tgl]?.['WAJIB'];
        const jLembur = jadwalMap[p.nik]?.[tgl]?.['LEMBUR'];
        const hasScan = (absensiMap[p.nik]?.[tgl] || 0) > 0;
        const isPast = dayjs(tgl).isBefore(todayStr, 'day');
        
        let jamHariIni = 0;
        let shiftWajib = "-";
        let shiftLembur = "-";
        let wajib = (dayjs(tgl).day() === 0 ? 0 : 7);

        // 1. Proses Shift Wajib
        if (jWajib) {
          shiftWajib = jWajib.shift;
          wajib = jWajib.wajib_masuk;

          if (['P', 'S', 'Md', 'SID', 'SKS', 'Pe', 'Ct', 'i', 'CB'].includes(shiftWajib)) {
            jamHariIni += 7; 
          } else if (shiftWajib === 'PS') {
            jamHariIni += 14; 
          } else if (shiftWajib === 'M') {
            jamHariIni += 10; 
          }
        } else {
          shiftWajib = (dayjs(tgl).day() === 0 ? 'L' : '-');
          if (isPast && shiftWajib === '-' && !hasScan) shiftWajib = 'A';
        }

        // 2. Proses Shift Lembur
        if (jLembur) {
          shiftLembur = jLembur.shift;
          const start = jLembur.jam_mulai;
          const end = jLembur.jam_selesai;

          if (start && end) {
            shiftLembur = `${start.substring(0, 5)}-${end.substring(0, 5)}`;
            
            // Hitung Jam (Floor)
            const [h1, m1] = start.split(':').map(Number);
            const [h2, m2] = end.split(':').map(Number);
            let diffMenit = (h2 * 60 + m2) - (h1 * 60 + m1);
            
            // Jika lewat tengah malam
            if (diffMenit < 0) diffMenit += 24 * 60;
            
            const floorJam = Math.floor(diffMenit / 60);
            jamHariIni += floorJam;
            totalLemburActual += floorJam;
            countLemburActual++; // Tambah jumlah hari lembur
          } else {
            // Fallback ke shift code lama jika tidak ada jam (untuk kompatibilitas)
            if (['P', 'S', 'Md', 'SID', 'SKS', 'Pe', 'Ct', 'i', 'CB', 'Oc', 'Lm'].includes(shiftLembur)) {
              jamHariIni += 7; 
              totalLemburActual += 7;
              countLemburActual++;
            } else if (shiftLembur === 'PS') {
              jamHariIni += 14; 
              totalLemburActual += 14;
              countLemburActual++;
            } else if (shiftLembur === 'M') {
              jamHariIni += 10; 
              totalLemburActual += 10;
              countLemburActual++;
            }
          }
        }

        jamWajibPeriode += wajib;
        totalJamAktual += jamHariIni;
        
        // Simpan status harian (untuk frontend dua baris)
        dailyStatus[tgl] = { wajib: shiftWajib, lembur: shiftLembur };

        // Update counts (berdasarkan shift wajib saja untuk statistik utama)
        if (shiftWajib === 'PS') {
          shiftCounts.P++;
          shiftCounts.S++;
          shiftCounts.PS++;
        } else if (shiftCounts.hasOwnProperty(shiftWajib)) {
          shiftCounts[shiftWajib]++;
        }
        
        // Jika ada lembur Oc, tambahkan ke count Oc
        if (shiftLembur === 'Oc') shiftCounts.Oc++;
        if (shiftLembur === 'Lm') shiftCounts.Lm++;
      });

      return {
        pin: p.nik,
        nama: p.nama,
        pendidikan: p.pendidikan || '-',
        jbtn: p.jbtn || '-',
        mulai_kerja: p.mulai_kerja ? dayjs(p.mulai_kerja).format('YYYY-MM-DD') : '-',
        jam_wajib: jamWajibPeriode,
        jam_aktual: totalJamAktual,
        jam_lembur_actual: totalLemburActual,
        count_lembur: countLemburActual, // Kirim jumlah hari
        shift_counts: shiftCounts,
        daily_status: dailyStatus,
        sisa_cuti: 12 - (cutiMap[p.nik] || 0)
      };
    });

    // 7. Cari Karu (atau Kepala Ruangan/Benchmark)
    // Keywords: Karu, Kabid, Kepala, Koor (Koordinator)
    let karu = reportData.find(d => 
      d.jbtn.toLowerCase().includes('karu') || 
      d.jbtn.toLowerCase().includes('kepala') || 
      d.jbtn.toLowerCase().includes('kabid') || 
      d.jbtn.toLowerCase().includes('koor')
    );

    // FIX: Jika tidak ditemukan jabatan Karu, jadikan orang PERTAMA di list sebagai benchmark
    if (!karu && reportData.length > 0) {
      karu = reportData[0];
    }

    const benchmarkHours = karu ? karu.jam_aktual : 0;

    // 8. Hitung Hutang & Lembur Berdasarkan Karu
    reportData.forEach(d => {
      if (benchmarkHours > 0) {
        // Jika aktual < benchmark -> Hutang
        d.hutang_jam = d.jam_aktual < benchmarkHours ? (benchmarkHours - d.jam_aktual) : 0;
        // Lembur adalah total jam lembur yang diinput manual
        d.jam_lembur = d.jam_lembur_actual;
      } else {
        d.hutang_jam = d.jam_aktual < d.jam_wajib ? (d.jam_wajib - d.jam_aktual) : 0;
        d.jam_lembur = d.jam_lembur_actual;
      }
      d.benchmark_karu = benchmarkHours;
    });

    return res.json({
      success: true,
      startDate,
      endDate,
      dates: dateArray,
      data: reportData
    });

  } catch (err) {
    console.error('❌ getLaporanAbsenKB error:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
}

// ============================================================
// POST /api/absensi/jadwal-dinas — Update atau Simpan Shift
// ============================================================
async function upsertJadwalDinas(req, res) {
  try {
    const { pin, tanggal, shift, kategori = 'WAJIB', jam_mulai, jam_selesai } = req.body;

    if (!pin || !tanggal || !shift) {
      return res.status(400).json({ success: false, message: 'pin, tanggal, dan shift wajib diisi' });
    }

    // Default: jika L, Lm (jika wajib), atau X maka wajib_masuk 0, selain itu 7 (kecuali PS=14)
    // Untuk kategori LEMBUR, wajib_masuk selalu 0
    let wajib_masuk = (kategori === 'LEMBUR' || shift === 'L' || shift === 'Lm' || shift === 'X') ? 0 : 7;
    if (shift === 'PS' && kategori === 'WAJIB') wajib_masuk = 14;

    const [result] = await pool.execute(
      `INSERT INTO jadwal_dinas (pin, tanggal, shift, wajib_masuk, kategori, jam_mulai, jam_selesai, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, NOW())
       ON DUPLICATE KEY UPDATE 
       shift = VALUES(shift), 
       wajib_masuk = VALUES(wajib_masuk),
       jam_mulai = VALUES(jam_mulai),
       jam_selesai = VALUES(jam_selesai)`,
      [pin, tanggal, shift, wajib_masuk, kategori, jam_mulai || null, jam_selesai || null]
    );

    return res.json({ 
      success: true, 
      message: 'Jadwal berhasil diperbarui', 
      data: { pin, tanggal, shift, wajib_masuk, jam_mulai, jam_selesai } 
    });
  } catch (err) {
    console.error('❌ upsertJadwalDinas error:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
}

module.exports = { 
  receiveAbsensi, getAbsensi, getRealtimeAbsensi, getRekapHarian, 
  getLaporanAbsenKB, upsertJadwalDinas 
};
