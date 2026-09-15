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
const { authMiddleware, requireRole } = require('../middleware/authMiddleware');

// ----------------------------------------------------------
// ENDPOINT MESIN: Mesin push ke POST/GET /api/absen
// Setting di mesin: Server Path = /api/absen
// Tetap PUBLIC agar mesin fingerprint bisa mengirim data tanpa auth header
// ----------------------------------------------------------
router.get('/absen',  receiveAbsensi);
router.post('/absen', receiveAbsensi);

// ----------------------------------------------------------
// ENDPOINT FRONTEND (Membutuhkan Login)
// ----------------------------------------------------------
// List absensi & rekap harian: IT & HRD bisa lihat semua, STAFF hanya absensi sendiri
router.get('/absensi',               authMiddleware, getAbsensi);
router.get('/absensi/realtime',      authMiddleware, getRealtimeAbsensi);
router.get('/absensi/rekap',         authMiddleware, getRekapHarian);
router.get('/absensi/lembur-finder', authMiddleware, getLemburFinder);

// Laporan Departemen & Jadwal Dinas: HANYA IT
router.get('/absensi/laporan-kb',    authMiddleware, requireRole('IT'), getLaporanAbsenKB);
router.post('/absensi/jadwal-dinas', authMiddleware, requireRole('IT'), upsertJadwalDinas);

module.exports = router;
