const express = require('express');
const router  = express.Router();

const {
  receivePushMesin,
  getRawLog,
  getRawLogDetail,
  getRawLogStats,
  purgeRawLog,
} = require('../controllers/rawMesinController');

// ============================================================
// ENDPOINT MESIN — dihit langsung oleh Solution X100C
// ============================================================

// 1. ADMS Basic (Firmware lama — hanya bisa ke root '/')
router.get( '/', receivePushMesin);
router.post('/', receivePushMesin);

// 2. ADMS Standard (Protokol IClock)
router.get( '/iclock/cdata',      receivePushMesin);
router.post('/iclock/cdata',      receivePushMesin);
router.get( '/iclock/getrequest',  receivePushMesin); // Handler untuk polling perintah
router.post('/iclock/devicecmd',  receivePushMesin); // Handler untuk laporan perintah selesai

// 3. ADMS Advanced (Custom Server Path)
router.get( '/mesin/push', receivePushMesin);
router.post('/mesin/push', receivePushMesin);

// ============================================================
// ENDPOINT FRONTEND / ADMIN — konsumsi raw log
// ============================================================

// List raw log (dengan filter & pagination)
router.get('/mesin/raw',        getRawLog);

// Statistik raw log per hari
router.get('/mesin/raw/stats',  getRawLogStats);

// Detail satu record raw log
router.get('/mesin/raw/:id',    getRawLogDetail);

// Hapus data lama (purge)
router.delete('/mesin/raw/purge', purgeRawLog);

module.exports = router;
