const express = require('express');
const router = express.Router();
const lemburController = require('../controllers/lemburController');
const authMiddleware = require('../middleware/authMiddleware');

// Semua route di sini require login
router.use(authMiddleware);

// Endpoint untuk user biasa
router.post('/', lemburController.createLembur);
router.get('/me', lemburController.getMyLembur);

// Endpoint untuk Supervisor (Approval level 1)
router.get('/pending-supervisor', lemburController.getLemburToApproveSupervisor);

// Endpoint untuk HRD (Approval level 2)
router.get('/pending-hrd', lemburController.getLemburToApproveHRD);

// Approve / Reject
router.patch('/:id/approve', lemburController.approveLembur);

module.exports = router;
