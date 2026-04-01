const express = require('express');
const router  = express.Router();
const pegawaiController = require('../controllers/pegawaiController');
const authMiddleware = require('../middleware/authMiddleware');

/**
 * @route GET /api/pegawai
 * @desc Mendapatkan data pegawai dari SIKKRW
 * @access Private (but let's make it public for now to test)
 */
router.get('/', pegawaiController.getPegawai);

module.exports = router;
