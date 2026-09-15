const ZKLib = require('node-zklib');
const { pool } = require('../config/database');
const dayjs = require('dayjs');
const { getIO } = require('../config/socket');

// State sinkronisasi global di memori backend
let syncStatus = {
  isSyncing: false,
  status: 'idle', // 'idle', 'connecting', 'downloading', 'saving', 'done', 'error'
  currentMachine: null,
  currentMachineIndex: 0,
  totalMachines: 0,
  progress: 0,
  processedCount: 0,
  totalCount: 0,
  inserted: 0,
  skipped: 0,
  errors: 0,
  timeRemaining: null,
  errorMsg: null,
  lastSync: null,
  machineSummaries: [] // detail hasil sinkronisasi per mesin
};

// Helper: Format tanggal untuk tabel record (M/D/YYYY H:mm:ss)
function formatRecordDate(date) {
  const d = dayjs(date);
  return `${d.month() + 1}/${d.date()}/${d.year()} ${d.format('H:mm:ss')}`;
}

// Helper: Mapping status ke I/O (In / Out)
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

// Broadcast progress lewat Socket.io jika diinisialisasi
function broadcastProgress() {
  try {
    const io = getIO();
    if (io) {
      io.emit('sync:progress', syncStatus);
    }
  } catch (err) {
    // Socket.io mungkin tidak terhubung / tidak terdefinisi
  }
}

/**
 * Memulai sinkronisasi di latar belakang
 */
async function runSyncBackground() {
  if (syncStatus.isSyncing) return;

  syncStatus.isSyncing = true;
  syncStatus.status = 'connecting';
  syncStatus.progress = 0;
  syncStatus.processedCount = 0;
  syncStatus.totalCount = 0;
  syncStatus.inserted = 0;
  syncStatus.skipped = 0;
  syncStatus.errors = 0;
  syncStatus.timeRemaining = null;
  syncStatus.errorMsg = null;
  syncStatus.machineSummaries = [];
  broadcastProgress();

  // 1. Ambil semua mesin yang aktif dari DB
  let machines = [];
  try {
    const [rows] = await pool.execute(
      `SELECT nama, ip_address, device_id FROM device_mesin WHERE aktif = 1`
    );
    machines = rows.map(r => ({
      ip: r.ip_address,
      port: 4370,
      name: r.nama || r.device_id
    }));
  } catch (dbErr) {
    console.error('⚠️ [Sync Controller] Gagal mengambil data mesin dari DB:', dbErr.message);
  }

  // Fallback jika DB kosong
  if (machines.length === 0) {
    machines = [
      { ip: '192.168.10.150', port: 4370, name: 'Mesin Basement' },
      { ip: '192.168.10.185', port: 4370, name: 'Mesin Poli Lt 2' }
    ];
  }

  syncStatus.totalMachines = machines.length;
  broadcastProgress();

  const CONNECT_TIMEOUT = 10000;  // 10 detik
  const RECV_TIMEOUT    = 300000; // 5 menit

  // Loop setiap mesin
  for (let idx = 0; idx < machines.length; idx++) {
    const machine = machines[idx];
    syncStatus.currentMachine = machine.name;
    syncStatus.currentMachineIndex = idx + 1;
    syncStatus.status = 'connecting';
    syncStatus.progress = 0;
    syncStatus.processedCount = 0;
    syncStatus.totalCount = 0;
    syncStatus.timeRemaining = null;
    broadcastProgress();

    console.log(`🔌 [Sync Controller] Menghubungkan ke ${machine.name} (${machine.ip}:${machine.port})...`);
    const zk = new ZKLib(machine.ip, machine.port, CONNECT_TIMEOUT, RECV_TIMEOUT);
    
    let logs = [];
    let machineSummary = {
      name: machine.name,
      ip: machine.ip,
      status: 'pending',
      downloaded: 0,
      inserted: 0,
      skipped: 0,
      errors: 0,
      errorMsg: null
    };

    try {
      await zk.createSocket();
      
      // Dynamic timeout patch
      if (zk.zklibTcp) {
        zk.zklibTcp.timeout = RECV_TIMEOUT;
        if (zk.zklibTcp.socket) {
          zk.zklibTcp.socket.setTimeout(RECV_TIMEOUT);
        }
      }

      syncStatus.status = 'downloading';
      broadcastProgress();

      const info = await zk.getInfo();
      machineSummary.downloaded = info.logCounts || 0;

      if (info.logCounts > 0) {
        // Nonaktifkan mesin sementara agar aman/cepat
        try {
          await zk.disableDevice();
        } catch (_) {}

        // Download data
        const result = await zk.getAttendances();
        logs = result.data || [];

        // Aktifkan kembali
        try {
          await zk.enableDevice();
        } catch (_) {}
      }

      await zk.disconnect();

      if (logs.length === 0) {
        machineSummary.status = 'success';
        machineSummary.note = 'Tidak ada data log di mesin';
        syncStatus.machineSummaries.push(machineSummary);
        continue;
      }

      // Masuk fase penyimpanan
      syncStatus.status = 'saving';
      syncStatus.totalCount = logs.length;
      broadcastProgress();

      let machineInserted = 0;
      let machineSkipped = 0;
      let machineErrors = 0;
      const startTime = Date.now();

      for (let i = 0; i < logs.length; i++) {
        const log = logs[i];
        try {
          const pin = log.deviceUserId ? String(log.deviceUserId).trim() : '';
          const rawWaktu = log.recordTime || log.attTime;
          const waktu = rawWaktu ? dayjs(rawWaktu).format('YYYY-MM-DD HH:mm:ss') : '';

          // 1. Validasi PIN kosong/0
          if (!pin || pin === '0') {
            machineSkipped++;
            continue;
          }

          // 2. Validasi tahun < 2020 (data korup)
          if (!rawWaktu || dayjs(rawWaktu).year() < 2020) {
            machineSkipped++;
            continue;
          }

          // 3. Mapping status
          const statusMap = { 
            0: 'masuk', 
            1: 'pulang', 
            2: 'istirahat_keluar', 
            3: 'istirahat_masuk', 
            4: 'lembur_masuk', 
            5: 'lembur_pulang' 
          };
          const status = statusMap[log.inOutStatus] || 'masuk';

          // 4. Cek duplikat di absensi (toleransi 30 detik)
          const [dup1] = await pool.execute(
            `SELECT id FROM absensi
              WHERE pin = ?
                AND waktu >= DATE_SUB(?, INTERVAL 30 SECOND)
                AND waktu <= DATE_ADD(?, INTERVAL 30 SECOND)
              LIMIT 1`,
            [pin, waktu, waktu]
          );

          // 5. Cek duplikat di record (user_id & check_time presisi)
          const formattedCheckTime = formatRecordDate(waktu);
          const [dup2] = await pool.execute(
            `SELECT user_id FROM record
              WHERE user_id = ? AND check_time = ?
              LIMIT 1`,
            [pin, formattedCheckTime]
          );

          if (dup1.length > 0 || dup2.length > 0) {
            machineSkipped++;
            continue;
          }

          // 6. Simpan ke tabel absensi (Format Lama)
          await pool.execute(
            `INSERT INTO absensi (pin, waktu, status, ip_source, raw_data, created_at) 
             VALUES (?, ?, ?, ?, ?, NOW())`,
            [
              pin, 
              waktu, 
              status, 
              machine.ip, 
              JSON.stringify({ source: 'zk_pull_sync', machine: machine.name, verify: log.verifyMethod })
            ]
          );

          // 7. Simpan ke tabel record (Format Baru/Stabil)
          await pool.execute(
            `INSERT INTO record (user_id, check_time, check_type) 
             VALUES (?, ?, ?)`,
            [
              pin,
              formattedCheckTime,
              mapCheckType(status)
            ]
          );

          machineInserted++;

        } catch (itemErr) {
          machineErrors++;
          console.error(`❌ [Sync Item Error] PIN: ${log.deviceUserId} | Msg: ${itemErr.message}`);
        }

        // Throttle pembaruan status & estimasi waktu (setiap 50 record atau di akhir)
        if (i % 50 === 0 || i === logs.length - 1) {
          const elapsedMs = Date.now() - startTime;
          const avgTimePerRecord = elapsedMs / (i + 1);
          const remainingRecords = logs.length - (i + 1);
          const remainingMs = avgTimePerRecord * remainingRecords;

          let timeRemainingStr = 'Menghitung...';
          if (i > 10) {
            const remainingSecs = Math.round(remainingMs / 1000);
            if (remainingSecs < 60) {
              timeRemainingStr = `${remainingSecs} detik`;
            } else {
              const mins = Math.floor(remainingSecs / 60);
              const secs = remainingSecs % 60;
              timeRemainingStr = `${mins} menit ${secs} detik`;
            }
          }

          syncStatus.processedCount = i + 1;
          syncStatus.progress = Math.round(((i + 1) / logs.length) * 100);
          syncStatus.timeRemaining = timeRemainingStr;
          
          // Akumulasikan ke status total sementara
          broadcastProgress();
        }
      }

      machineSummary.status = 'success';
      machineSummary.inserted = machineInserted;
      machineSummary.skipped = machineSkipped;
      machineSummary.errors = machineErrors;

      syncStatus.inserted += machineInserted;
      syncStatus.skipped += machineSkipped;
      syncStatus.errors += machineErrors;
      syncStatus.machineSummaries.push(machineSummary);

      console.log(`✅ [Sync Controller] ${machine.name} selesai: ${machineInserted} disimpan, ${machineSkipped} dilewati.`);

    } catch (mErr) {
      const errMsg = mErr.err?.message || mErr.message || String(mErr);
      console.error(`❌ [Sync Controller] Gagal sinkronisasi ${machine.name}:`, errMsg);
      
      machineSummary.status = 'error';
      machineSummary.errorMsg = errMsg;
      syncStatus.machineSummaries.push(machineSummary);
      
      syncStatus.errors += 1;
      broadcastProgress();

      try {
        await zk.disconnect();
      } catch (_) {}
    }
  }

  // Done semua mesin
  syncStatus.isSyncing = false;
  syncStatus.status = 'done';
  syncStatus.progress = 100;
  syncStatus.timeRemaining = null;
  syncStatus.lastSync = {
    time: new Date(),
    inserted: syncStatus.inserted,
    skipped: syncStatus.skipped,
    errors: syncStatus.errors
  };

  broadcastProgress();
}

/**
 * Controller endpoint: POST /api/mesin/sync
 * Memicu sinkronisasi di background
 */
async function startSync(req, res) {
  if (syncStatus.isSyncing) {
    return res.status(400).json({
      success: false,
      message: 'Proses sinkronisasi sedang berlangsung. Silakan tunggu.',
      data: syncStatus
    });
  }

  // Jalankan di latar belakang (tidak ditunggu await agar respon instan)
  runSyncBackground().catch(err => {
    console.error('Fatal sync controller error:', err);
    syncStatus.isSyncing = false;
    syncStatus.status = 'error';
    syncStatus.errorMsg = err.message;
    broadcastProgress();
  });

  return res.status(200).json({
    success: true,
    message: 'Sinkronisasi mesin berhasil dijalankan di latar belakang.',
    data: syncStatus
  });
}

/**
 * Controller endpoint: GET /api/mesin/sync/status
 * Mendapatkan status sync saat ini
 */
async function getSyncStatus(req, res) {
  return res.status(200).json({
    success: true,
    data: syncStatus
  });
}

module.exports = {
  startSync,
  getSyncStatus
};
