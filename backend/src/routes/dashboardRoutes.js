const express = require('express');
const router  = express.Router();
const dashboardController = require('../controllers/dashboardController');

/**
 * @route GET /api/dashboard/stats
 * @desc Mendapatkan statistik dashboard (Jumlah Pegawai, Kehadiran, Chart Data)
 */
router.get('/stats', dashboardController.getDashboardStats);

module.exports = router;
