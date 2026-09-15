const express = require('express');
const router  = express.Router();
const dashboardController = require('../controllers/dashboardController');
const authMiddleware = require('../middleware/authMiddleware');

/**
 * @route GET /api/dashboard/stats
 * @desc Mendapatkan statistik dashboard (Jumlah Pegawai, Kehadiran, Chart Data)
 */
router.get('/stats', authMiddleware, dashboardController.getDashboardStats);

module.exports = router;
