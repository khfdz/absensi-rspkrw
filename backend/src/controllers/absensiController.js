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
           WHERE pin = ?
             AND waktu >= DATE_SUB(?, INTERVAL 30 SECOND)
             AND waktu <= DATE_ADD(?, INTERVAL 30 SECOND)
           LIMIT 1`,
          [record.pin, record.waktu, record.waktu]
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

    const userRole = req.user?.role || 'STAFF';
    const userNik = req.user?.nik;
    const isPrivileged = userRole === 'IT' || userRole === 'HRD';

    // 1. FILTER HAK AKSES: Jika STAFF (non IT/HRD), paksa hanya NIK miliknya sendiri
    if (!isPrivileged) {
      where += ' AND pin = ?';
      params.push(userNik);
    } else if ((pin && pin.trim() !== '') || (departemen && departemen !== 'all')) {
      let sikkQuery = `SELECT nik FROM pegawai WHERE 1=1`;
      const sikkParams = [];
      
      if (pin && pin.trim() !== '') {
        sikkQuery += ` AND (nik = ? OR nama LIKE ?)`;
        sikkParams.push(pin.trim(), `%${pin.trim()}%`);
      }
      
      if (departemen && departemen !== 'all') {
        sikkQuery += ` AND departemen = ?`;
        sikkParams.push(departemen);
      }

      const [matches] = await sikkPool.query(sikkQuery, sikkParams);
      const filteredPins = matches.map(m => m.nik);
      
      if (filteredPins.length > 0) {
        where += ` AND pin IN (?)`;
        params.push(filteredPins);
      } else {
        // Jika kriteria (Nama/Dept) diisi tapi tidak ada yang cocok di SIKKRW, paksa hasil kosong
        return res.json({ 
          success: true, 
          data: [], 
          pagination: { total: 0, page: parseInt(page), limit: parseInt(limit), total_pages: 0 } 
        });
      }
    }

    // 2. Filter Tanggal (Inclusive)
    if (startDate && startDate.trim() !== '') {
      where += ' AND DATE(waktu) >= ?';
      params.push(startDate);
    }
    if (endDate && endDate.trim() !== '') {
      where += ' AND DATE(waktu) <= ?';
      params.push(endDate);
    }

    // 3. Filter Status
    if (status && status !== 'all') {
      where += ' AND status = ?';
      params.push(status.toLowerCase());
    }

    // 4. Ambil log absensi dari local DB
    // Gunakan pool.query (bukan execute) agar IN (?) dengan array diproses dengan benar oleh mysql2
    const [rows] = await pool.query(
      `SELECT id, pin, waktu, status, device_id, created_at
       FROM absensi
       ${where}
       ORDER BY waktu DESC
       LIMIT ${parseInt(limit)} OFFSET ${offset}`,
      params
    );

    const [cnt] = await pool.query(`SELECT COUNT(*) AS total FROM absensi ${where}`, params);
    const total = cnt[0].total;

    if (rows.length === 0) {
      return res.json({ 
        success: true, 
        data: [], 
        pagination: { total: 0, page: parseInt(page), limit: parseInt(limit), total_pages: 0 } 
      });
    }

    // 5. Ambil detail pegawai & jadwal untuk baris yang muncul di halaman ini
    const pinsOnPage = [...new Set(rows.map(r => r.pin))];
    const [pegawaiRows] = await sikkPool.query(
      `SELECT nik, nama, departemen FROM pegawai WHERE nik IN (?)`,
      [pinsOnPage]
    );

    // Ambil jadwal dinas untuk penentuan "Lebih Jam"
    // Kita ambil jadwal untuk rentang tanggal yang dihasilkan saja
    const datesOnPage = [...new Set(rows.map(r => dayjs(r.waktu).format('YYYY-MM-DD')))];
    let jadwalRows = [];
    if (pinsOnPage.length > 0 && datesOnPage.length > 0) {
      [jadwalRows] = await pool.query(
        `SELECT pin, tanggal, jam_mulai, jam_selesai 
         FROM jadwal_dinas 
         WHERE pin IN (?) AND tanggal IN (?)`,
        [pinsOnPage, datesOnPage]
      );
    }

    const pegawaiMap = {};
    pegawaiRows.forEach(p => { pegawaiMap[p.nik] = p; });

    const jadwalMap = {};
    jadwalRows.forEach(j => {
      const tgl = dayjs(j.tanggal).format('YYYY-MM-DD');
      if (!jadwalMap[j.pin]) jadwalMap[j.pin] = {};
      jadwalMap[j.pin][tgl] = j;
    });

    // 6. Gabungkan data & Hitung Lembur (Pairing)
    // Kita buat map untuk mencari pasangan masuk/pulang per tanggal per pin
    const mergedData = rows.map(r => {
      const dayObj = dayjs(r.waktu);
      const tgl = dayObj.format('YYYY-MM-DD');
      const time = dayObj.format('HH:mm:ss');
      const dayOfWeek = dayObj.day();
      const j = jadwalMap[r.pin]?.[tgl];
      
      let defaultStart = '08:00:00';
      let defaultEnd   = '16:00:00';
      if (dayOfWeek === 6) defaultEnd = '13:00:00';
      else if (dayOfWeek === 0) defaultEnd = '00:00:00';

      const schedStartStr = j?.jam_mulai || defaultStart;
      const schedEndStr   = j?.jam_selesai || defaultEnd;
      
      const schedStartSec = dayjs(`${tgl} ${schedStartStr}`).diff(dayjs(tgl).startOf('day'), 'second');
      const schedEndSec   = dayjs(`${tgl} ${schedEndStr}`).diff(dayjs(tgl).startOf('day'), 'second');
      const actualTimeSec = dayjs(r.waktu).diff(dayjs(r.waktu).startOf('day'), 'second');

      let selisih_detik = 0;

      // Hanya tampilkan "Lebih" pada baris PULANG agar tidak membingungkan 
      if (r.status === 'pulang') {
        // Pairing: Cari 'masuk' yang sesuai untuk baris 'pulang' ini.
        // Kita cari 'masuk' terbaru yang terjadi SEBELUM jam pulang ini di hari yang sama.
        const matchingMasuk = rows.find(m => 
          m.pin === r.pin && 
          m.status === 'masuk' && 
          dayjs(m.waktu).isBefore(dayObj) && 
          dayjs(m.waktu).isAfter(dayObj.startOf('day'))
        );

        const masukTimeSec = matchingMasuk 
          ? dayjs(matchingMasuk.waktu).diff(dayjs(matchingMasuk.waktu).startOf('day'), 'second')
          : null;

        // startPointForOvertime adalah waktu dimulainya lembur.
        // Jika dia masuk SETELAH jam pulang normal (misal masuk 20:00), maka dihitung dari jam masuknya.
        // Jika tidak ada data masuk, kita anggap mulai dari jam pulang normal.
        const startPointForOvertime = masukTimeSec !== null ? Math.max(schedEndSec, masukTimeSec) : schedEndSec;
        
        if (actualTimeSec > startPointForOvertime) {
          selisih_detik = actualTimeSec - startPointForOvertime;
        }
      }

      return {
        ...r,
        nama_karyawan: pegawaiMap[r.pin] ? pegawaiMap[r.pin].nama : 'Tidak Terdaftar',
        departemen: pegawaiMap[r.pin] ? pegawaiMap[r.pin].departemen : '-',
        waktu: dayjs(r.waktu).format('YYYY-MM-DD HH:mm:ss'),
        selisih: selisih_detik
      };
    });

    return res.json({
      success: true, 
      data: mergedData,
      pagination: {
        page: parseInt(page), limit: parseInt(limit),
        total: total,
        total_pages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (err) {
    console.error('❌ getAbsensi error:', err);
    return res.status(500).json({ success: false, message: 'Server Error: ' + err.message });
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
// Mendukung single tanggal (?tanggal=YYYY-MM-DD) maupun rentang waktu (?startDate=...&endDate=...)
// ============================================================
async function getRekapHarian(req, res) {
  try {
    const startDate = req.query.startDate || req.query.tanggal || dayjs().format('YYYY-MM-DD');
    const endDate = req.query.endDate || req.query.tanggal || startDate;
    const nextDayAfterEnd = dayjs(endDate).add(1, 'day').format('YYYY-MM-DD');

    const userRole = req.user?.role || 'STAFF';
    const userNik = req.user?.nik;
    const isPrivileged = userRole === 'IT' || userRole === 'HRD';

    // 1. Ambil log absensi dari startDate hingga endDate + 1 hari (buffer shift malam)
    let absensiSql = `SELECT pin, waktu, status, device_id, ip_source
       FROM absensi 
       WHERE waktu >= ? AND waktu <= ?`;
    const absensiParams = [`${startDate} 00:00:00`, `${nextDayAfterEnd} 14:00:00`];

    if (!isPrivileged) {
      absensiSql += ` AND pin = ?`;
      absensiParams.push(userNik);
    }
    absensiSql += ` ORDER BY waktu ASC`;

    const [absensiRows] = await pool.query(absensiSql, absensiParams);

    // 2. Ambil data pegawai dari SIKKRW
    let pegawaiSql = `SELECT nik, nama, departemen FROM pegawai`;
    const pegawaiParams = [];
    if (!isPrivileged) {
      pegawaiSql += ` WHERE nik = ?`;
      pegawaiParams.push(userNik);
    }
    const [pegawaiRows] = await sikkPool.query(pegawaiSql, pegawaiParams);

    // 3. Proses Gabung Baris (Consolidation Logic) per tanggal per pegawai
    const rekap = pegawaiRows.map(p => {
      const logs = absensiRows.filter(a => a.pin === p.nik);
      if (logs.length === 0) return [];

      // Dapatkan semua tanggal unik dalam rentang [startDate, endDate] di mana pegawai memiliki scan
      const activeDates = [...new Set(
        logs
          .map(l => dayjs(l.waktu).format('YYYY-MM-DD'))
          .filter(tgl => tgl >= startDate && tgl <= endDate)
      )].sort();

      const results = [];

      activeDates.forEach(tgl => {
        // Filter log 'masuk' khusus di tanggal ini
        const logsMasukHariIni = logs.filter(l => 
          l.status === 'masuk' && dayjs(l.waktu).format('YYYY-MM-DD') === tgl
        );

        // Filter log 'pulang' pada tanggal ini
        const logsPulangHariIni = logs.filter(l => 
          l.status === 'pulang' && dayjs(l.waktu).format('YYYY-MM-DD') === tgl
        );

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
              tanggal: tgl,
              jam_masuk: startTime.format('HH:mm:ss'),
              jam_pulang: pMatch ? dayjs(pMatch.waktu).format('HH:mm:ss') : null,
              tgl_pulang: pMatch ? dayjs(pMatch.waktu).format('YYYY-MM-DD') : null,
              total_scan: logs.filter(l => dayjs(l.waktu).format('YYYY-MM-DD') === tgl).length,
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
              tanggal: tgl,
              jam_masuk: null,
              jam_pulang: dayjs(pScan.waktu).format('HH:mm:ss'),
              tgl_pulang: tgl,
              total_scan: logs.filter(l => dayjs(l.waktu).format('YYYY-MM-DD') === tgl).length,
              lokasi: (pScan.ip_source === '192.168.10.150' || pScan.device_id == 1) ? 'Basement' : (pScan.ip_source === '192.168.10.185' ? 'Poli Lt 2' : (pScan.ip_source || `Mesin ${pScan.device_id}`)),
              status: 'LUPA_MASUK'
            });
          });
        }
      });

      return results;
    }).flat();

    // Urutkan data rekap: tanggal terbaru terlebih dahulu, lalu nama
    rekap.sort((a, b) => {
      if (a.tanggal !== b.tanggal) return b.tanggal.localeCompare(a.tanggal);
      return a.nama.localeCompare(b.nama);
    });

    return res.json({ 
      success: true, 
      startDate,
      endDate,
      tanggal: startDate, 
      data: rekap 
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

// ============================================================
// GET /api/absensi/lembur-finder — Cari Lembur & On-Call per Pegawai
// Mendukung Pola Perawat (termasuk Minggu), Shift Swap (Tukar Jadwal),
// On-Call tanpa batas minimal, dan Lembur minimal 1 jam.
// ============================================================
async function getLemburFinder(req, res) {
  try {
    const { 
      nama, 
      startDate, 
      endDate,
      // Pola Jadwal: 'AUTO_PERAWAT' | 'NON_SHIFT' | 'CUSTOM'
      patternType = 'AUTO_PERAWAT',
      // Jadwal Kerja
      workStart = '08:00',
      workEnd = '16:00',
      saturdayStart = '08:00',
      saturdayEnd = '13:00',
      saturdayIsOff = 'false',
      sundayStart = '07:00',
      sundayEnd = '14:00',
      sundayIsOff = 'false',
      // Hari Libur
      holidayDays = '0',
      customHolidays = '',
      // Tukar Jadwal Hari (JSON map per tanggal: { "YYYY-MM-DD": { shift, start, end, isOff } })
      scheduleOverrides = '',
      // Koreksi Manual Fingerprint (JSON map per tanggal: { "YYYY-MM-DD": { masuk, pulang, tipe, detail } })
      manualCorrections = '',
      // Opsi Di Luar Jam Kerja
      outsideShiftMode = 'ON-CALL', // 'ON-CALL' | 'LEMBUR'
      // Kustom Jadwal Harian Senin s/d Minggu
      customDailySchedule = ''
    } = req.query;

    if (!nama || !startDate || !endDate) {
      return res.status(400).json({ success: false, message: 'nama, startDate, dan endDate wajib diisi' });
    }

    const userRole = req.user?.role || 'STAFF';
    const userNik = req.user?.nik;
    const isPrivileged = userRole === 'IT' || userRole === 'HRD';

    // Parse overrides (Tukar Jadwal)
    let parsedOverrides = {};
    if (scheduleOverrides) {
      try {
        parsedOverrides = typeof scheduleOverrides === 'string' 
          ? JSON.parse(scheduleOverrides) 
          : scheduleOverrides;
      } catch (e) {
        console.warn('Gagal parse scheduleOverrides:', e.message);
      }
    }

    // Parse manual corrections (Koreksi Fingerprint)
    let parsedCorrections = {};
    if (manualCorrections) {
      try {
        parsedCorrections = typeof manualCorrections === 'string' 
          ? JSON.parse(manualCorrections) 
          : manualCorrections;
      } catch (e) {
        console.warn('Gagal parse manualCorrections:', e.message);
      }
    }

    let parsedCustomSchedule = null;
    if (customDailySchedule) {
      try {
        parsedCustomSchedule = typeof customDailySchedule === 'string'
          ? JSON.parse(customDailySchedule)
          : customDailySchedule;
      } catch (e) {
        console.warn('Gagal parse customDailySchedule:', e.message);
      }
    }

    // Parse configuration rules
    const isSatOff = String(saturdayIsOff) === 'true';
    const isSunOff = String(sundayIsOff) === 'true';
    const parsedHolidayDays = holidayDays 
      ? String(holidayDays).split(',').map(d => parseInt(d.trim(), 10)).filter(n => !isNaN(n))
      : (patternType === 'AUTO_PERAWAT' ? [] : [0]);
    
    if (isSatOff && !parsedHolidayDays.includes(6)) parsedHolidayDays.push(6);
    if (isSunOff && !parsedHolidayDays.includes(0)) parsedHolidayDays.push(0);

    const parsedCustomHolidays = customHolidays
      ? String(customHolidays).split(',').map(s => s.trim()).filter(Boolean)
      : [];
    const modeOutside = outsideShiftMode === 'LEMBUR' ? 'LEMBUR' : 'ON-CALL';

    // 1. Cari pegawai yang cocok (jika STAFF, hanya cari NIK sendiri)
    let pegawaiQuery = `SELECT nik, nama, departemen FROM pegawai WHERE nama LIKE ? ORDER BY nama ASC LIMIT 10`;
    let pegawaiParams = [`%${nama.trim()}%`];

    if (!isPrivileged) {
      pegawaiQuery = `SELECT nik, nama, departemen FROM pegawai WHERE nik = ? LIMIT 1`;
      pegawaiParams = [userNik];
    }

    const [pegawaiRows] = await sikkPool.query(pegawaiQuery, pegawaiParams);

    if (pegawaiRows.length === 0) {
      return res.json({ success: true, pegawai: [], data: [] });
    }

    const pins = pegawaiRows.map(p => p.nik);

    // 2. Ambil semua log absensi untuk pegawai tersebut dalam rentang tanggal
    const endDatePlus = dayjs(endDate).add(2, 'day').format('YYYY-MM-DD'); // +2 untuk buffer shift malam

    const [absensiRows] = await pool.query(
      `SELECT pin, waktu, status, ip_source, device_id
       FROM absensi
       WHERE pin IN (?)
         AND waktu >= ?
         AND waktu < ?
       ORDER BY waktu ASC`,
      [pins, `${startDate} 00:00:00`, `${endDatePlus} 00:00:00`]
    );

    // 2b. Ambil jadwal dinas resmi dari database jadwal_dinas jika ada
    let dbJadwalMap = {};
    try {
      const [jadwalDbRows] = await pool.query(
        `SELECT pin, tanggal, shift, jam_mulai, jam_selesai, kategori 
         FROM jadwal_dinas 
         WHERE pin IN (?) AND tanggal >= ? AND tanggal <= ?`,
        [pins, startDate, endDate]
      );
      jadwalDbRows.forEach(j => {
        const dStr = dayjs(j.tanggal).format('YYYY-MM-DD');
        if (!dbJadwalMap[j.pin]) dbJadwalMap[j.pin] = {};
        dbJadwalMap[j.pin][dStr] = j;
      });
    } catch (err) {
      console.warn('⚠️ Gagal memuat jadwal_dinas:', err.message);
    }

    // 3. Kelompokkan log per pegawai per tanggal
    const pegawaiMap = {};
    pegawaiRows.forEach(p => { pegawaiMap[p.nik] = p; });

    const logsByPin = {};
    pins.forEach(pin => { logsByPin[pin] = []; });
    absensiRows.forEach(r => {
      if (logsByPin[r.pin]) logsByPin[r.pin].push(r);
    });

    // 4. Untuk setiap pegawai, proses per hari dalam rentang
    const allResults = [];

    for (const p of pegawaiRows) {
      const logs = logsByPin[p.nik] || [];
      const dailyResults = [];

      let cursor = dayjs(startDate);
      const end = dayjs(endDate);

      while (cursor.isBefore(end, 'day') || cursor.isSame(end, 'day')) {
        const tgl = cursor.format('YYYY-MM-DD');
        const dayOfWeek = cursor.day(); // 0=Minggu, 1=Senin, ..., 6=Sabtu

        // Ambil log untuk hari ini (mulai jam 05:00) s/d besok pagi (sebelum jam 05:00)
        const tglBerikut = cursor.add(1, 'day').format('YYYY-MM-DD');
        const startLimit = dayjs(`${tgl} 05:00:00`);
        const endLimit   = dayjs(`${tglBerikut} 05:00:00`);

        const dayTaps = logs
          .map(l => dayjs(l.waktu))
          .filter(d => (d.isSame(startLimit) || d.isAfter(startLimit)) && d.isBefore(endLimit))
          .sort((a, b) => a.diff(b));

        // ─── PENENTUAN JADWAL SHIFT & TUKAR JADWAL ───
        let shiftStart = null;
        let shiftEnd   = null;
        let shiftLabel = '';
        let isHoliday = false;

        // Prioritas 1: Tukar Jadwal Hari (Manual Override)
        if (parsedOverrides[tgl]) {
          const ovr = parsedOverrides[tgl];
          if (ovr.isOff) {
            isHoliday = true;
            shiftLabel = 'Tukar Jadwal: Libur (Off)';
          } else {
            shiftStart = ovr.start || '07:00';
            shiftEnd   = ovr.end || '14:00';
            shiftLabel = `Tukar: ${ovr.label || ovr.shift || 'Shift'} (${shiftStart}-${shiftEnd})`;
          }
        } 
        // Prioritas 2: Jadwal Resmi Database
        else if (dbJadwalMap[p.nik]?.[tgl]) {
          const jDb = dbJadwalMap[p.nik][tgl];
          if (jDb.shift === 'LIBUR' || jDb.shift === 'OFF') {
            isHoliday = true;
            shiftLabel = `Jadwal Dinas: Libur (${jDb.shift})`;
          } else {
            shiftStart = jDb.jam_mulai ? String(jDb.jam_mulai).substring(0, 5) : '07:00';
            shiftEnd   = jDb.jam_selesai ? String(jDb.jam_selesai).substring(0, 5) : '14:00';
            shiftLabel = `Jadwal Dinas: ${jDb.shift || 'Shift'} (${shiftStart}-${shiftEnd})`;
          }
        }
        // Prioritas 3: Tanggal Merah / Libur Nasional Khusus
        else if (parsedCustomHolidays.includes(tgl)) {
          isHoliday = true;
          shiftLabel = 'Libur Nasional / Khusus';
        }
        // Prioritas 4: Pola Shift Perawat (Dukungan penuh Hari Minggu & Deteksi Shift Cerdas)
        else if (patternType === 'AUTO_PERAWAT') {
          if (dayTaps.length === 0) {
            isHoliday = true;
            shiftLabel = dayOfWeek === 0 ? 'Libur (Minggu)' : 'Libur / Off';
          } else {
            // Deteksi shift perawat berdasarkan jam tap masuk pertama
            const firstHour = dayTaps[0].hour() + dayTaps[0].minute() / 60;
            if (firstHour >= 5.5 && firstHour < 12) {
              shiftStart = '07:00';
              shiftEnd   = '14:00';
              shiftLabel = 'Shift Pagi (07:00-14:00)';
            } else if (firstHour >= 12 && firstHour < 18.5) {
              shiftStart = '14:00';
              shiftEnd   = '21:00';
              shiftLabel = 'Shift Siang (14:00-21:00)';
            } else {
              shiftStart = '21:00';
              shiftEnd   = '07:00';
              shiftLabel = 'Shift Malam (21:00-07:00)';
            }
          }
        }
        // Prioritas 5: Pola Non-Shift / Kantor (Senin - Jumat/Sabtu, Minggu Libur)
        else if (patternType === 'NON_SHIFT') {
          if (dayOfWeek === 0 || (isSatOff && dayOfWeek === 6)) {
            isHoliday = true;
            shiftLabel = dayOfWeek === 0 ? 'Libur (Minggu)' : 'Libur (Sabtu)';
          } else if (dayOfWeek === 6) {
            shiftStart = saturdayStart;
            shiftEnd   = saturdayEnd;
            shiftLabel = `Sabtu (${saturdayStart}-${saturdayEnd})`;
          } else {
            shiftStart = workStart;
            shiftEnd   = workEnd;
            shiftLabel = `Kerja (${workStart}-${workEnd})`;
          }
        }
        // Prioritas 6: Pola Kustom (Senin s/d Minggu diatur per hari)
        else {
          const dayNames = ['Minggu','Senin','Selasa','Rabu','Kamis','Jumat','Sabtu'];
          const dayName = dayNames[dayOfWeek];
          const daySchedule = parsedCustomSchedule ? parsedCustomSchedule[dayOfWeek] : null;

          if (daySchedule) {
            if (daySchedule.isOff) {
              isHoliday = true;
              shiftLabel = `Libur (${dayName})`;
            } else {
              shiftStart = daySchedule.start || '08:00';
              shiftEnd   = daySchedule.end   || '16:00';
              shiftLabel = `${dayName} (${shiftStart}-${shiftEnd})`;
            }
          } else {
            const isWeeklyHoliday = parsedHolidayDays.includes(dayOfWeek);
            if (isWeeklyHoliday) {
              isHoliday = true;
              shiftLabel = `Libur (${dayName})`;
            } else if (dayOfWeek === 0) {
              shiftStart = sundayStart;
              shiftEnd   = sundayEnd;
              shiftLabel = `Minggu (${sundayStart}-${sundayEnd})`;
            } else if (dayOfWeek === 6) {
              shiftStart = saturdayStart;
              shiftEnd   = saturdayEnd;
              shiftLabel = `Sabtu (${saturdayStart}-${saturdayEnd})`;
            } else {
              shiftStart = workStart;
              shiftEnd   = workEnd;
              shiftLabel = `Kerja (${workStart}-${workEnd})`;
            }
          }
        }

        // ─── CEK KOREKSI MANUAL FINGERPRINT DARI USER ───
        if (parsedCorrections[tgl]) {
          const corr = parsedCorrections[tgl];
          let durasi_menit = 0;
          if (corr.masuk && corr.pulang) {
            let mDt = dayjs(`${tgl} ${corr.masuk}`);
            let pDt = dayjs(`${tgl} ${corr.pulang}`);
            if (pDt.isBefore(mDt)) {
              pDt = pDt.add(1, 'day'); // Melewati tengah malam
            }

            if (corr.tipe === 'LEMBUR' && shiftEnd) {
              let sEndDt = dayjs(`${tgl} ${shiftEnd}`);
              if (pDt.isAfter(sEndDt)) {
                durasi_menit = pDt.diff(sEndDt, 'minute');
              } else {
                durasi_menit = pDt.diff(mDt, 'minute');
              }
            } else {
              durasi_menit = pDt.diff(mDt, 'minute');
            }
          }

          dailyResults.push({
            tanggal: tgl,
            hari: ['Minggu','Senin','Selasa','Rabu','Kamis','Jumat','Sabtu'][dayOfWeek],
            jam_masuk: corr.masuk || null,
            jam_pulang: corr.pulang || null,
            shift_label: shiftLabel,
            shift_mulai: shiftStart,
            shift_selesai: shiftEnd,
            tipe: corr.tipe || 'LEMBUR',
            durasi_menit: corr.durasi_menit !== undefined ? corr.durasi_menit : durasi_menit,
            detail: corr.detail || 'Koreksi manual fingerprint',
            is_koreksi: true
          });

          cursor = cursor.add(1, 'day');
          continue;
        }

        if (dayTaps.length === 0) {
          cursor = cursor.add(1, 'day');
          continue;
        }

        // Hilangkan duplikat tap dalam rentang 3 menit
        const uniqueTaps = [];
        for (const tap of dayTaps) {
          if (uniqueTaps.length === 0 || tap.diff(uniqueTaps[uniqueTaps.length - 1], 'minute') >= 3) {
            uniqueTaps.push(tap);
          }
        }

        // Hitung jam batas normal shift
        let shiftStartHour = null;
        let shiftEndHour = null;
        if (shiftStart) {
          const [sh, sm] = shiftStart.split(':').map(Number);
          shiftStartHour = sh + (sm || 0) / 60;
        }
        if (shiftEnd) {
          const [eh, em] = shiftEnd.split(':').map(Number);
          shiftEndHour = eh + (em || 0) / 60;
        }

        // Bangun session kerja/on-call menggunakan state machine berbasis gap waktu
        // Jika ada tepat 2 tap (misal 07:14 dan 01:03), langsung pasangkan sebagai Masuk dan Pulang!
        const sessions = [];
        let currentSession = null;

        if (uniqueTaps.length === 2) {
          const firstTap = uniqueTaps[0];
          const firstHour = firstTap.hour() + firstTap.minute() / 60;
          let isOutside = isHoliday || !shiftStart || !shiftEnd;
          if (!isOutside && shiftStartHour !== null && shiftEndHour !== null) {
            if (shiftEndHour > shiftStartHour) {
              if (firstHour > shiftEndHour + 0.1 || firstHour < shiftStartHour - 1.5) {
                isOutside = true;
              }
            } else {
              if (firstHour > shiftEndHour + 0.1 && firstHour < shiftStartHour - 1.5) {
                isOutside = true;
              }
            }
          }
          sessions.push({
            masuk: uniqueTaps[0],
            pulang: uniqueTaps[1],
            isOnCall: isOutside
          });
        } else {
          for (const tap of uniqueTaps) {
            const hour = tap.hour() + tap.minute() / 60;

            let isOutsideNormal = isHoliday || !shiftStart || !shiftEnd;
            if (!isOutsideNormal && shiftStartHour !== null && shiftEndHour !== null) {
              if (shiftEndHour > shiftStartHour) {
                if (hour > shiftEndHour + 0.1 || hour < shiftStartHour - 1.5) {
                  isOutsideNormal = true;
                }
              } else {
                if (hour > shiftEndHour + 0.1 && hour < shiftStartHour - 1.5) {
                  isOutsideNormal = true;
                }
              }
            }

            if (currentSession === null) {
              // Jika tap ini sangat dekat (<= 20 menit) setelah pulang sesi sebelumnya, perbarui jam pulang sesi sebelumnya
              if (sessions.length > 0) {
                const lastSession = sessions[sessions.length - 1];
                if (lastSession.pulang && tap.diff(lastSession.pulang, 'minute') <= 20) {
                  lastSession.pulang = tap;
                  continue;
                }
              }
              currentSession = { masuk: tap, pulang: null, isOnCall: isOutsideNormal };
            } else {
              const durationHours = tap.diff(currentSession.masuk, 'hour');
              // Jika durasi terlalu panjang (> 16 jam), akhiri session dan mulai session baru
              if (durationHours > 16) {
                sessions.push(currentSession);
                currentSession = { masuk: tap, pulang: null, isOnCall: isOutsideNormal };
              } else {
                currentSession.pulang = tap;
                sessions.push(currentSession);
                currentSession = null;
              }
            }
          }
          if (currentSession !== null) {
            sessions.push(currentSession);
          }
        }

        // Koreksi single tap session (kasus lupa absen masuk atau pulang)
        sessions.forEach(session => {
          if (session.masuk && !session.pulang) {
            const tap = session.masuk;
            const hour = tap.hour();

            if (isHoliday || session.isOnCall) {
              session.isOnCall = true;
              session.detail = `Lupa absen pulang (${modeOutside})`;
            } else {
              if (hour < 12) {
                session.detail = 'Lupa absen pulang';
              } else {
                session.pulang = tap;
                session.masuk = null;
                session.isOnCall = false;
                session.detail = 'Lupa absen masuk';
              }
            }
          }
        });

        // ─── EVALUASI TIPE & DURASI LEMBUR / ON-CALL ───
        // REVISI ATURAN:
        // 1. On-call: "tanpa batas minimal jam" (berapapun menitnya dihitung)
        // 2. Lembur: "tetap 1 jam setelah absen" (kelebihan >= 60 menit baru dihitung lembur)
        sessions.forEach(session => {
          let tipe = 'NORMAL';
          let durasi_menit = 0;
          let detail = session.detail || '';
          const masukHH = session.masuk ? session.masuk.format('HH:mm') : null;
          const pulangHH = session.pulang ? session.pulang.format('HH:mm') : null;

          if (session.isOnCall) {
            // ── KASUS ON-CALL / DI LUAR JAM KERJA / LIBUR ──
            if (session.masuk && session.pulang) {
              const totalMins = session.pulang.diff(session.masuk, 'minute');

              if (modeOutside === 'LEMBUR') {
                // Lembur di luar jam kerja: wajib minimal 1 jam (>= 60 menit)
                if (totalMins >= 60) {
                  tipe = 'LEMBUR';
                  durasi_menit = totalMins;
                  detail = isHoliday 
                    ? `Lembur Hari Libur: Masuk ${masukHH}, Pulang ${pulangHH}`
                    : `Lembur Luar Jam Kerja: Masuk ${masukHH}, Pulang ${pulangHH}`;
                } else {
                  tipe = 'NORMAL';
                  durasi_menit = 0;
                  detail = `Masuk ${masukHH}, Pulang ${pulangHH} (${totalMins} mnt < 1 jam minimal lembur)`;
                }
              } else {
                // On-Call: "tanpa batas minimal jam"
                tipe = 'ON-CALL';
                durasi_menit = totalMins;
                detail = isHoliday 
                  ? `On-Call Hari Libur: Masuk ${masukHH}, Pulang ${pulangHH}`
                  : `On-Call Luar Jam Kerja: Masuk ${masukHH}, Pulang ${pulangHH}`;
              }
            } else {
              tipe = 'TIDAK_LENGKAP';
              durasi_menit = 0;
            }
          } else {
            // ── KASUS SHIFT NORMAL ──
            if (session.masuk && session.pulang) {
              if (shiftStart && shiftEnd) {
                let shiftEndDt = dayjs(`${session.masuk.format('YYYY-MM-DD')} ${shiftEnd}`);
                if (shiftEndHour < shiftStartHour) {
                  // Shift malam (melewati tengah malam)
                  shiftEndDt = shiftEndDt.add(1, 'day');
                }

                if (session.pulang.isAfter(shiftEndDt)) {
                  const overMinutes = session.pulang.diff(shiftEndDt, 'minute');

                  // REVISI: "untuk lembur tetap 1 jam setelah absen"
                  // Kelebihan harus minimal 60 menit (1 jam) baru dihitung lembur!
                  if (overMinutes >= 60) {
                    tipe = 'LEMBUR';
                    durasi_menit = overMinutes;
                    const jamLembur = Math.floor(overMinutes / 60);
                    const sisaMnt = overMinutes % 60;
                    detail = `Pulang jam ${pulangHH} (Lembur ${jamLembur}j ${sisaMnt}m setelah shift selesai ${shiftEnd})`;
                  } else {
                    tipe = 'NORMAL';
                    durasi_menit = 0;
                    detail = `Pulang jam ${pulangHH} (Kelebihan ${overMinutes} mnt < 1 jam, tidak dihitung lembur)`;
                  }
                } else {
                  tipe = 'NORMAL';
                  durasi_menit = 0;
                  detail = 'Sesuai shift';
                }
              } else {
                tipe = 'NORMAL';
                durasi_menit = 0;
                detail = 'Sesuai shift';
              }
            } else if (session.masuk && !session.pulang) {
              tipe = 'TIDAK_LENGKAP';
              durasi_menit = 0;
            } else if (session.pulang && !session.masuk) {
              if (shiftStart && shiftEnd) {
                let shiftEndDt = dayjs(`${session.pulang.format('YYYY-MM-DD')} ${shiftEnd}`);
                if (shiftEndHour < shiftStartHour) shiftEndDt = shiftEndDt.add(1, 'day');

                if (session.pulang.isAfter(shiftEndDt)) {
                  const overMinutes = session.pulang.diff(shiftEndDt, 'minute');
                  if (overMinutes >= 60) {
                    tipe = 'LEMBUR';
                    durasi_menit = overMinutes;
                    detail = `Lupa absen masuk, pulang jam ${pulangHH} (Lembur ${Math.floor(overMinutes / 60)}j ${overMinutes % 60}m setelah shift selesai ${shiftEnd})`;
                  } else {
                    tipe = 'TIDAK_LENGKAP';
                    durasi_menit = 0;
                  }
                } else {
                  tipe = 'TIDAK_LENGKAP';
                  durasi_menit = 0;
                }
              } else {
                tipe = 'TIDAK_LENGKAP';
                durasi_menit = 0;
              }
            }
          }

          dailyResults.push({
            tanggal: tgl,
            hari: ['Minggu','Senin','Selasa','Rabu','Kamis','Jumat','Sabtu'][dayOfWeek],
            jam_masuk: masukHH,
            jam_pulang: pulangHH,
            shift_label: shiftLabel,
            shift_mulai: shiftStart,
            shift_selesai: shiftEnd,
            tipe,
            durasi_menit,
            detail
          });
        });

        cursor = cursor.add(1, 'day');
      }

      allResults.push({
        pin: p.nik,
        nama: p.nama,
        departemen: p.departemen,
        daily: dailyResults
      });
    }

    return res.json({
      success: true,
      startDate,
      endDate,
      patternType,
      outsideShiftMode: modeOutside,
      data: allResults
    });

  } catch (err) {
    console.error('❌ getLemburFinder error:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
}

module.exports = { 
  receiveAbsensi, getAbsensi, getRealtimeAbsensi, getRekapHarian, 
  getLaporanAbsenKB, upsertJadwalDinas, getLemburFinder
};
