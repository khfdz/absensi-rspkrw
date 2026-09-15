const express = require('express');
const router  = express.Router();
const {
  receiveAbsensi,
  getAbsensi,
  getRealtimeAbsensi,
  getRekapHarian,
  getLaporanAbsenKB,
  upsertJadwalDinas,
  getLemburFinder,
} = require('../controllers/absensiController');

// ----------------------------------------------------------
// ENDPOINT MESIN: Mesin push ke POST/GET /api/absen
// Setting di mesin: Server Path = /api/absen
// ----------------------------------------------------------
router.get('/absen',  receiveAbsensi); // beberapa firmware kirim GET
router.post('/absen', receiveAbsensi); // default POST

// ----------------------------------------------------------
// ENDPOINT FRONTEND
// ----------------------------------------------------------
router.get('/absensi',          getAbsensi);          // list + filter + pagination
router.get('/absensi/realtime', getRealtimeAbsensi);  // polling 60 detik terakhir
router.get('/absensi/rekap',      getRekapHarian);      // rekap harian per karyawan
router.get('/absensi/laporan-kb', getLaporanAbsenKB);   // Laporan khusus Kamar Bayi
router.post('/absensi/jadwal-dinas', upsertJadwalDinas); // Update atau Simpan Shift
router.get('/absensi/lembur-finder', getLemburFinder);  // Cari Lembur & On-Call per Pegawai

module.exports = router;
