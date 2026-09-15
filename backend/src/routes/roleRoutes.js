const express = require('express');
const router = express.Router();
const roleController = require('../controllers/roleController');
const { authMiddleware, requireRole } = require('../middleware/authMiddleware');

// Semua rute manajemen hak akses HANYA boleh diakses oleh user dengan role 'IT'
router.use(authMiddleware);
router.use(requireRole('IT'));

router.get('/', roleController.getRoles);
router.post('/', roleController.updateRole);
router.delete('/:nik', roleController.resetRole);

module.exports = router;
