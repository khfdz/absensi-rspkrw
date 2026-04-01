const { pool } = require('../config/database');
const { getIO } = require('../config/socket');
const { parseAbsensiData } = require('../utils/parser');
const dayjs    = require('dayjs');

// ============================================================
// HELPER: Format tanggal untuk tabel record (M/D/YYYY H:mm:ss)
// ============================================================
function formatRecordDate(date) {
  const d = dayjs(date);
  // Format: Bulan/Hari/Tahun Jam:Menit:Detik (tanpa padding nol di bulan/hari)
  return `${d.month() + 1}/${d.date()}/${d.year()} ${d.format('H:mm:ss')}`;
}

// ============================================================
// HELPER: Mapping status ke I/O (In / Out)
// ============================================================
function mapCheckType(status) {
  const map = {
    'masuk':            'I',
    'istirahat_masuk':  'I',
    'lembur_masuk':     'I',
    'pulang':           'O',
    'istirahat_keluar': 'O',
    'lembur_pulang':    'O'
  };
  return map[status] || 'I';
}

// ============================================================
// POST/GET / — Endpoint utama yang dihit mesin X100C ADMS
// Menerima raw data, simpan apa adanya, lalu proses ke absensi
// ============================================================
async function receivePushMesin(req, res) {
  const ip          = req.ip || req.headers['x-forwarded-for'] || 'unknown';
  const method      = req.method;
  const contentType = req.headers['content-type'] || '';
  const rawBody     = req.rawBody   || '';
  const parsedBody  = req.body      || {};
  const queryParams = req.query     || {};

  try {
    // ── 1. Simpan raw log dulu (audit trail) ──────────────────
    const [rawInsert] = await pool.execute(
      `INSERT INTO raw_mesin_log
         (ip_source, http_method, content_type, query_string,
          body_json, raw_body, receive_at)
       VALUES (?, ?, ?, ?, ?, ?, NOW())`,
      [
        ip, method, contentType,
        JSON.stringify(queryParams),
        typeof parsedBody === 'object' ? JSON.stringify(parsedBody) : null,
        rawBody || null,
      ]
    );
    const rawLogId = rawInsert.insertId;

    // ── 1.b KHUSUS ADMS: Handle Sinkronisasi Opsi/Waktu ───────
    const sn   = queryParams.SN || queryParams.sn || queryParams.device_id || 'unknown';
    const path = req.path;

    // A. Handle 'getrequest' (Mesin tanya perintah)
    if (path.includes('/getrequest')) {
      console.log(`📡 [ADMS] Polling GetRequest dari SN: ${sn} -> Respon OK (No Command)`);
      return res.status(200).send('OK');
    }

    // B. Handle 'devicecmd' (Mesin lapor hasil perintah)
    if (path.includes('/devicecmd')) {
      console.log(`📡 [ADMS] DeviceCmd receipt dari SN: ${sn} -> Respon OK`);
      return res.status(200).send('OK');
    }

    // C. Handle Sinkronisasi Opsi
    if (queryParams.options === 'all') {
      const serverTime = dayjs().format('YYYY-MM-DD HH:mm:ss');
      console.log(`📡 [ADMS] Sinkronisasi opsi untuk SN: ${sn} | Time: ${serverTime}`);
      
      return res.status(200).send(
        `GET OPTION FROM: ${sn}\r\n` +
        `Stamp=9999\r\n` +
        `OpStamp=9999\r\n` +
        `ErrorDelay=60\r\n` +
        `Delay=30\r\n` +
        `TransTimes=00:00;14:00\r\n` +
        `TransInterval=1\r\n` +
        `TransFlag=1111111111\r\n` +
        `TimeZone=7\r\n` +
        `Realtime=1\r\n` +
        `ServerTime=${serverTime}\r\n`
      );
    }

    // ── 2. Parse data menggunakan utilitas parser ──────────────
    const records = parseAbsensiData(req);

    if (!records || records.length === 0) {
      await pool.execute(
        `UPDATE raw_mesin_log SET parse_status = 'no_pin' WHERE id = ?`,
        [rawLogId]
      );
      // Kirim OK agar mesin berhenti mengirim ulang
      return res.status(200).send('OK');
    }

    let savedCount     = 0;
    let duplicateCount = 0;
    let lastAbsensiId  = null;

    // ── 3. Proses setiap record yang ditemukan ─────────────────
    for (const record of records) {
      try {
        const pinStr = String(record.pin).trim();
        const waktu  = record.waktu || new Date();
        const status = record.status || 'masuk';

        // ── 3a. Proteksi Duplikat (Tabel absensi lama) ───────
        const [dup1] = await pool.execute(
          `SELECT id FROM absensi
            WHERE pin = ? AND ABS(TIMESTAMPDIFF(SECOND, waktu, ?)) < 30
            LIMIT 1`,
          [pinStr, waktu]
        );

        // ── 3b. Proteksi Duplikat (Tabel record baru) ────────
        // Berdasarkan user_id dan check_time yang persis sama
        const formattedCheckTime = formatRecordDate(waktu);
        const [dup2] = await pool.execute(
          `SELECT user_id FROM record
            WHERE user_id = ? AND check_time = ?
            LIMIT 1`,
          [pinStr, formattedCheckTime]
        );

        if (dup1.length > 0 || dup2.length > 0) {
          duplicateCount++;
          lastAbsensiId = dup1.length > 0 ? dup1[0].id : null;
          console.log(`ℹ️ [SKIP] Duplikat terdeteksi untuk PIN: ${pinStr} | Time: ${formattedCheckTime}`);
          continue;
        }

        // ── 3c. Insert ke tabel absensi (Format Lama) ───────
        const [absenIns] = await pool.execute(
          `INSERT INTO absensi (pin, waktu, status, device_id, ip_source, raw_data, created_at)
           VALUES (?, ?, ?, ?, ?, ?, NOW())`,
          [
            pinStr,
            dayjs(waktu).format('YYYY-MM-DD HH:mm:ss'),
            status,
            record.device_id || null,
            ip,
            JSON.stringify({ raw_log_id: rawLogId, ...record.raw }),
          ]
        );

        // ── 3d. Insert ke tabel record (Format Baru/Stabil) ──
        await pool.execute(
          `INSERT INTO record (user_id, check_time, check_type)
           VALUES (?, ?, ?)`,
          [
            pinStr,
            formattedCheckTime,
            mapCheckType(status)
          ]
        );

        savedCount++;
        lastAbsensiId = absenIns.insertId;

        // Broadcast to Socket.io
        try {
          const [rows] = await pool.execute(
            `SELECT a.id, a.pin, u.name AS nama_karyawan,
                    a.waktu, a.status, a.device_id, a.created_at
               FROM absensi a
               LEFT JOIN user u ON u.nip = a.pin OR u.id = a.pin
              WHERE a.id = ?`,
            [lastAbsensiId]
          );
          if (rows.length) {
            getIO().emit('absensi:baru', {
              ...rows[0],
              waktu: dayjs(rows[0].waktu).format('YYYY-MM-DD HH:mm:ss'),
              raw_log_id: rawLogId
            });
          }
        } catch (_) {}

      } catch (innerErr) {
        console.error(`❌ Record error [RAW #${rawLogId}]:`, innerErr.message);
      }
    }

    // ── 4. Update status final pada raw log ────────────────────
    await pool.execute(
      `UPDATE raw_mesin_log
          SET pin_extracted    = ?,
              waktu_extracted  = ?,
              status_extracted = ?,
              parse_status     = 'parsed',
              process_status   = ?,
              absensi_id       = ?
        WHERE id = ?`,
      [
        records[0].pin,
        dayjs(records[0].waktu).format('YYYY-MM-DD HH:mm:ss'),
        records[0].status,
        savedCount > 0 ? 'done' : (duplicateCount > 0 ? 'duplicate' : 'pending'),
        lastAbsensiId,
        rawLogId,
      ]
    );

    console.log(`✅ [RAW-LOG #${rawLogId}] Batch: ${savedCount} saved, ${duplicateCount} dup from ${ip}`);
    return res.status(200).send('OK');

  } catch (err) {
    console.error('❌ receivePushMesin error:', err.message);
    try {
      await pool.execute(
        `INSERT INTO absensi_log_error
           (ip_source, method, content_type, raw_body, error_msg) VALUES (?,?,?,?,?)`,
        [ip, method, contentType, rawBody.slice(0, 65000), err.message]
      );
    } catch (_) {}
    return res.status(200).send('OK');
  }
}

// ============================================================
// GET /api/mesin/raw — List raw log dari mesin
// Query: tanggal, pin, device_sn, parse_status, process_status,
//        page, limit, start_date, end_date
// ============================================================
async function getRawLog(req, res) {
  try {
    const {
      tanggal,
      pin,
      device_sn,
      parse_status,
      process_status,
      start_date,
      end_date,
      page  = 1,
      limit = 100,
    } = req.query;

    const params = [];
    const conditions = [];

    if (tanggal) {
      conditions.push('DATE(r.receive_at) = ?');
      params.push(tanggal);
    } else if (start_date && end_date) {
      conditions.push('DATE(r.receive_at) BETWEEN ? AND ?');
      params.push(start_date, end_date);
    } else if (start_date) {
      conditions.push('DATE(r.receive_at) >= ?');
      params.push(start_date);
    } else {
      conditions.push('DATE(r.receive_at) = CURDATE()');
    }

    if (pin)            { conditions.push('r.pin_extracted = ?');    params.push(pin); }
    if (device_sn)      { conditions.push('r.device_sn = ?');        params.push(device_sn); }
    if (parse_status)   { conditions.push('r.parse_status = ?');     params.push(parse_status); }
    if (process_status) { conditions.push('r.process_status = ?');   params.push(process_status); }

    const where  = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const offset = (parseInt(page) - 1) * parseInt(limit);

    const [rows] = await pool.execute(
      `SELECT
         r.id,
         r.ip_source,
         r.http_method,
         r.content_type,
         r.query_string,
         r.body_json,
         r.raw_body,
         r.pin_extracted,
         r.waktu_extracted,
         r.status_extracted,
         r.device_sn,
         r.verify_type,
         r.work_code,
         r.parse_status,
         r.process_status,
         r.absensi_id,
         r.receive_at,
         u.name    AS nama_karyawan
       FROM raw_mesin_log r
       LEFT JOIN user u ON u.nip = r.pin_extracted
       ${where}
       ORDER BY r.receive_at DESC
       LIMIT ${parseInt(limit)} OFFSET ${offset}`,
      params
    );

    const [cnt] = await pool.execute(
      `SELECT COUNT(*) AS total FROM raw_mesin_log r ${where}`, params
    );

    return res.json({
      success: true,
      data: rows,
      pagination: {
        page:        parseInt(page),
        limit:       parseInt(limit),
        total:       cnt[0].total,
        total_pages: Math.ceil(cnt[0].total / parseInt(limit)),
      },
    });

  } catch (err) {
    console.error('❌ getRawLog:', err.message);
    return res.status(500).json({ success: false, message: err.message });
  }
}

// ============================================================
// GET /api/mesin/raw/:id — Detail satu raw log
// ============================================================
async function getRawLogDetail(req, res) {
  try {
    const { id } = req.params;
    const [rows] = await pool.execute(
      `SELECT r.*, u.name AS nama_karyawan
         FROM raw_mesin_log r
         LEFT JOIN user u ON u.nip = r.pin_extracted
        WHERE r.id = ?
        LIMIT 1`,
      [id]
    );
    if (!rows.length) {
      return res.status(404).json({ success: false, message: 'Data tidak ditemukan' });
    }
    return res.json({ success: true, data: rows[0] });
  } catch (err) {
    console.error('❌ getRawLogDetail:', err.message);
    return res.status(500).json({ success: false, message: err.message });
  }
}

// ============================================================
// GET /api/mesin/raw/stats — Statistik raw log hari ini
// ============================================================
async function getRawLogStats(req, res) {
  try {
    const { tanggal = dayjs().format('YYYY-MM-DD') } = req.query;

    const [stats] = await pool.execute(
      `SELECT
         COUNT(*)                                              AS total_request,
         SUM(parse_status   = 'parsed')                       AS berhasil_parse,
         SUM(parse_status   = 'no_pin')                       AS tidak_ada_pin,
         SUM(process_status = 'done')                         AS berhasil_simpan,
         SUM(process_status = 'duplicate')                    AS duplikat,
         SUM(process_status = 'pending')                      AS pending,
         COUNT(DISTINCT ip_source)                            AS jumlah_device,
         COUNT(DISTINCT device_sn)                            AS jumlah_sn,
         MIN(receive_at)                                      AS pertama_masuk,
         MAX(receive_at)                                      AS terakhir_masuk
       FROM raw_mesin_log
       WHERE DATE(receive_at) = ?`,
      [tanggal]
    );

    const [perDevice] = await pool.execute(
      `SELECT device_sn, ip_source, COUNT(*) AS total,
              SUM(process_status = 'done') AS tersimpan
         FROM raw_mesin_log
        WHERE DATE(receive_at) = ?
        GROUP BY device_sn, ip_source
        ORDER BY total DESC`,
      [tanggal]
    );

    return res.json({
      success: true,
      tanggal,
      stats: stats[0],
      per_device: perDevice,
    });

  } catch (err) {
    console.error('❌ getRawLogStats:', err.message);
    return res.status(500).json({ success: false, message: err.message });
  }
}

// ============================================================
// DELETE /api/mesin/raw/purge — Hapus raw log lebih dari N hari
// Query: older_than_days (default 30)
// ============================================================
async function purgeRawLog(req, res) {
  try {
    const days = parseInt(req.query.older_than_days) || 30;
    if (days < 7) {
      return res.status(400).json({
        success: false,
        message: 'Minimal 7 hari untuk keamanan data',
      });
    }
    const [result] = await pool.execute(
      `DELETE FROM raw_mesin_log
        WHERE receive_at < DATE_SUB(NOW(), INTERVAL ? DAY)`,
      [days]
    );
    console.log(`🗑️  Purge raw_mesin_log: ${result.affectedRows} baris dihapus (>${days} hari)`);
    return res.json({
      success: true,
      message: `${result.affectedRows} data dihapus`,
      older_than_days: days,
    });
  } catch (err) {
    console.error('❌ purgeRawLog:', err.message);
    return res.status(500).json({ success: false, message: err.message });
  }
}

module.exports = {
  receivePushMesin,
  getRawLog,
  getRawLogDetail,
  getRawLogStats,
  purgeRawLog,
};
