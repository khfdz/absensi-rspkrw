/**
 * reprocess_raw_log.js
 * Reprocess data dari raw_mesin_log yang belum masuk ke tabel absensi
 * Jalankan: node reprocess_raw_log.js
 */

const { pool } = require('./src/config/database');
const dayjs = require('dayjs');

async function reprocess() {
  console.log('🔄 Mulai reprocess raw_mesin_log → absensi...\n');

  try {
    // 1. Ambil semua raw log yang sudah ter-parse tapi PIN & waktu valid
    const [rawLogs] = await pool.query(`
      SELECT id, pin_extracted, waktu_extracted, ip_source, device_sn, status_extracted
      FROM raw_mesin_log
      WHERE parse_status = 'parsed'
        AND pin_extracted IS NOT NULL
        AND waktu_extracted IS NOT NULL
      ORDER BY waktu_extracted ASC
    `);

    console.log(`📋 Ditemukan ${rawLogs.length} raw log yang ter-parse`);

    let inserted = 0;
    let skipped  = 0;
    let errors   = 0;

    for (const log of rawLogs) {
      try {
        const pin    = String(log.pin_extracted).trim();
        const waktu  = dayjs(log.waktu_extracted).format('YYYY-MM-DD HH:mm:ss');
        const status = log.status_extracted || 'masuk';
        const ip     = log.ip_source || 'unknown';

        // Cek duplikat di absensi (toleransi 30 detik)
        const [dup] = await pool.execute(
          `SELECT id FROM absensi
           WHERE pin = ?
             AND waktu >= DATE_SUB(?, INTERVAL 30 SECOND)
             AND waktu <= DATE_ADD(?, INTERVAL 30 SECOND)
           LIMIT 1`,
          [pin, waktu, waktu]
        );

        if (dup.length > 0) {
          skipped++;
          continue;
        }

        // Insert ke absensi
        await pool.execute(
          `INSERT INTO absensi (pin, waktu, status, device_id, ip_source, raw_data, created_at)
           VALUES (?, ?, ?, ?, ?, ?, NOW())`,
          [
            pin,
            waktu,
            status,
            log.device_sn || null,
            ip,
            JSON.stringify({ reprocessed_from_raw_log: log.id }),
          ]
        );

        inserted++;

        if (inserted % 100 === 0) {
          console.log(`  ✅ Progress: ${inserted} inserted, ${skipped} skipped...`);
        }

      } catch (err) {
        errors++;
        console.error(`  ❌ Error pada raw_log #${log.id}:`, err.message);
      }
    }

    console.log('\n══════════════════════════════════════');
    console.log(`✅ SELESAI:`);
    console.log(`   Berhasil dimasukkan : ${inserted} record`);
    console.log(`   Skip (duplikat)     : ${skipped} record`);
    console.log(`   Error               : ${errors} record`);
    console.log('══════════════════════════════════════');

    // Cek range data setelah reprocess
    const [[range]] = await pool.query(
      `SELECT COUNT(*) as total, MIN(waktu) as dari, MAX(waktu) as sampai FROM absensi`
    );
    console.log(`\n📊 Data absensi sekarang:`);
    console.log(`   Total  : ${range.total} record`);
    console.log(`   Dari   : ${range.dari}`);
    console.log(`   Sampai : ${range.sampai}`);

  } catch (err) {
    console.error('❌ Fatal error:', err.message);
  } finally {
    await pool.end();
    process.exit(0);
  }
}

reprocess();
