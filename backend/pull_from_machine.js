/**
 * pull_from_machine.js
 * Pull SEMUA data attendance langsung dari memori mesin ZKTeco via TCP
 * Menggunakan package: node-zklib
 *
 * Install dulu: npm install node-zklib (sudah dilakukan)
 * Jalankan    : node pull_from_machine.js
 */

const ZKLib = require('node-zklib');
const { pool } = require('./src/config/database');
const dayjs = require('dayjs');

// ─── Konfigurasi Mesin ──────────────────────────────────────────────────────
const MACHINES = [
  { ip: '192.168.10.150', port: 4370, name: 'Mesin Basement' },
  { ip: '192.168.10.185', port: 4370, name: 'Mesin Poli Lt 2' },
];
const CONNECT_TIMEOUT = 10000;  // 10 detik untuk koneksi awal
const RECV_TIMEOUT    = 300000; // 300 detik (5 menit) untuk download 200K records
// ────────────────────────────────────────────────────────────────────────────

async function insertBatch(logs, ip, name) {
  let inserted = 0;
  let skipped  = 0;
  let errors   = 0;

  let skipInvalidPin = 0;
  let skipInvalidYear = 0;
  let skipDuplicate = 0;

  const samplesInvalidPin = [];
  const samplesInvalidYear = [];
  const samplesDuplicate = [];

  for (const log of logs) {
    try {
      const pin   = log.deviceUserId ? String(log.deviceUserId).trim() : '';
      const rawWaktu = log.recordTime || log.attTime;
      const waktu = rawWaktu ? dayjs(rawWaktu).format('YYYY-MM-DD HH:mm:ss') : '';

      // Lewati data yang tidak valid
      if (!pin || pin === '0') {
        skipInvalidPin++;
        skipped++;
        if (samplesInvalidPin.length < 3) samplesInvalidPin.push(log);
        continue;
      }

      // Tahun < 2020
      if (!rawWaktu || dayjs(rawWaktu).year() < 2020) {
        skipInvalidYear++;
        skipped++;
        if (samplesInvalidYear.length < 3) samplesInvalidYear.push(log);
        continue;
      }

      // Tentukan status (masuk/pulang) dari inOutStatus
      const statusMap = { 0:'masuk', 1:'pulang', 2:'istirahat_keluar', 3:'istirahat_masuk', 4:'lembur_masuk', 5:'lembur_pulang' };
      const status = statusMap[log.inOutStatus] || 'masuk';

      // Cek duplikat (toleransi 30 detik)
      const [dup] = await pool.execute(
        `SELECT id FROM absensi
          WHERE pin = ?
            AND waktu >= DATE_SUB(?, INTERVAL 30 SECOND)
            AND waktu <= DATE_ADD(?, INTERVAL 30 SECOND)
          LIMIT 1`,
        [pin, waktu, waktu]
      );

      if (dup.length > 0) {
        skipDuplicate++;
        skipped++;
        if (samplesDuplicate.length < 3) samplesDuplicate.push({ pin, waktu, status, log });
        continue;
      }

      // Insert ke absensi
      await pool.execute(
        `INSERT INTO absensi (pin, waktu, status, ip_source, raw_data, created_at) VALUES (?, ?, ?, ?, ?, NOW())`,
        [pin, waktu, status, ip, JSON.stringify({ source: 'zk_pull', machine: name, verify: log.verifyMethod })]
      );

      inserted++;
      if (inserted % 1000 === 0) {
        process.stdout.write(`\r   Progress: ${inserted} inserted, ${skipped} skipped...`);
      }

    } catch (err) {
      errors++;
      if (errors <= 3) console.error(`\n   ❌ Error:`, err.message);
    }
  }

  console.log(`\n   📊 Skip Breakdown:`);
  console.log(`      - Invalid PIN ('0' or empty): ${skipInvalidPin}`);
  if (samplesInvalidPin.length > 0) console.log(`        Samples:`, JSON.stringify(samplesInvalidPin));
  console.log(`      - Invalid Year (< 2020): ${skipInvalidYear}`);
  if (samplesInvalidYear.length > 0) console.log(`        Samples:`, JSON.stringify(samplesInvalidYear));
  console.log(`      - Duplicates in DB: ${skipDuplicate}`);
  if (samplesDuplicate.length > 0) console.log(`        Samples (first 3):`, JSON.stringify(samplesDuplicate));

  return { inserted, skipped, errors };
}

async function pullFromMachine(machineConfig) {
  const { ip, port, name } = machineConfig;
  // Parameter 3 = internalTimeout (connect), parameter 4 = recvTimeout (data download)
  const zk = new ZKLib(ip, port, CONNECT_TIMEOUT, RECV_TIMEOUT);

  console.log(`\n🔌 Menghubungkan ke ${name} (${ip}:${port})...`);

  try {
    await zk.createSocket();
    console.log(`✅ Terhubung ke ${name}`);

    // DYNAMIC TIMEOUT PATCH: Update the zklibTcp timeout and socket timeout for the large transfer
    if (zk.zklibTcp) {
      zk.zklibTcp.timeout = RECV_TIMEOUT;
      if (zk.zklibTcp.socket) {
        zk.zklibTcp.socket.setTimeout(RECV_TIMEOUT);
      }
    }

    const info = await zk.getInfo();
    console.log(`   📋 Info: ${info.logCounts} log, ${info.userCounts} user, kapasitas ${info.logCapacity}`);

    if (info.logCounts === 0) {
      console.log(`   ⚠️  Tidak ada log di mesin ini`);
      await zk.disconnect();
      return { inserted: 0, skipped: 0, errors: 0 };
    }

    console.log(`   ⬇️  Mendownload ${info.logCounts} log... (bisa 1-5 menit untuk data besar)`);

    // Disable device for safer/faster download
    try {
      await zk.disableDevice();
      console.log(`   🔒 Mesin dinonaktifkan sementara untuk download aman`);
    } catch (e) {
      const disableErr = e.err?.message || (e.toast && e.toast()) || e.message || String(e);
      console.log(`   ⚠️  Gagal menonaktifkan mesin (lanjut saja): ${disableErr}`);
    }

    let logs = [];
    try {
      const result = await zk.getAttendances();
      logs = result.data || [];
    } catch (dlErr) {
      const errMsg = dlErr.err?.message || (dlErr.toast && dlErr.toast()) || dlErr.message || String(dlErr);
      console.error(`\n   ⚠️  Error saat download: ${errMsg}`);
      
      // Try to re-enable device if disabled
      try {
        await zk.enableDevice();
      } catch (_) {}
      try {
        await zk.disconnect();
      } catch (_) {}
      return { inserted: 0, skipped: 0, errors: 1, note: `Download failed: ${errMsg}` };
    }

    // Re-enable device after successful download
    try {
      await zk.enableDevice();
      console.log(`   🔓 Mesin diaktifkan kembali`);
    } catch (e) {
      const enableErr = e.err?.message || (e.toast && e.toast()) || e.message || String(e);
      console.log(`   ⚠️  Gagal mengaktifkan kembali mesin: ${enableErr}`);
    }

    console.log(`\n   ✅ Download selesai: ${logs.length} log diambil`);
    console.log(`   💾 Menyimpan ke database...`);

    const result = await insertBatch(logs, ip, name);

    console.log(`\n   ══════════════════════════`);
    console.log(`   ${name} selesai:`);
    console.log(`   Insert : ${result.inserted}`);
    console.log(`   Skip   : ${result.skipped} (duplikat/invalid)`);
    console.log(`   Error  : ${result.errors}`);
    if (result.note) console.log(`   ⚠️  ${result.note}`);

    await zk.disconnect();
    return result;

  } catch (err) {
    const connErr = err.err?.message || (err.toast && err.toast()) || err.message || String(err);
    console.error(`❌ Gagal konek ke ${name} (${ip}): ${connErr}`);
    try { await zk.disconnect(); } catch (_) {}
    return { inserted: 0, skipped: 0, errors: 1 };
  }
}

async function main() {
  console.log('══════════════════════════════════════════════');
  console.log('  ZKTeco Attendance Pull Script');
  console.log('  Data akan diambil dari memori mesin langsung');
  console.log('══════════════════════════════════════════════');

  let totalInserted = 0;
  let totalSkipped  = 0;

  for (const machine of MACHINES) {
    const result = await pullFromMachine(machine);
    totalInserted += result.inserted;
    totalSkipped  += result.skipped;
  }

  // Cek range data setelah pull
  const [[range]] = await pool.query(
    `SELECT COUNT(*) as total, MIN(waktu) as dari, MAX(waktu) as sampai FROM absensi WHERE YEAR(waktu) >= 2020`
  );
  console.log('\n══════════════════════════════════════════════');
  console.log('  HASIL AKHIR:');
  console.log(`  Berhasil masuk : ${totalInserted} record baru`);
  console.log(`  Skip duplikat  : ${totalSkipped} record`);
  console.log(`\n📊 Data absensi sekarang:`);
  console.log(`   Total  : ${range.total} record`);
  console.log(`   Dari   : ${dayjs(range.dari).format('YYYY-MM-DD')}`);
  console.log(`   Sampai : ${dayjs(range.sampai).format('YYYY-MM-DD')}`);
  console.log('══════════════════════════════════════════════');

  await pool.end();
  process.exit(0);
}

main();
