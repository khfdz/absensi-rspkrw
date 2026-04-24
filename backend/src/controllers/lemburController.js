const { pool } = require('../config/database');
const dayjs = require('dayjs');

/**
 * Pengajuan Lembur Baru
 */
exports.createLembur = async (req, res) => {
  try {
    const { tgl_lembur, jam_mulai, jam_selesai, keterangan } = req.body;
    const user = req.user; // nik, nama, departemen, bidang, jbtn, jnj_jabatan

    if (!tgl_lembur || !jam_mulai || !jam_selesai) {
      return res.status(400).json({ success: false, message: 'Tanggal dan jam lembur wajib diisi' });
    }

    // Hitung total jam
    const start = dayjs(`${tgl_lembur} ${jam_mulai}`);
    let end = dayjs(`${tgl_lembur} ${jam_selesai}`);
    
    // Jika jam selesai < jam mulai, asumsikan lewat tengah malam
    if (end.isBefore(start)) {
      end = end.add(1, 'day');
    }

    const diffMinutes = end.diff(start, 'minute');
    const hours = Math.floor(diffMinutes / 60);
    const mins = diffMinutes % 60;
    const total_jam = `${hours}j ${mins}m`;

    const [result] = await pool.execute(
      `INSERT INTO lembur (
        nik, nama, bidang, departemen, jbtn, 
        tgl_lembur, jam_mulai, jam_selesai, total_jam, keterangan, 
        status, approved_self_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'PENDING', NOW())`,
      [
        user.nik, user.nama, user.bidang || '-', user.departemen || '-', user.jbtn || '-',
        tgl_lembur, jam_mulai, jam_selesai, total_jam, keterangan || ''
      ]
    );

    res.status(201).json({
      success: true,
      message: 'Form lembur berhasil diajukan dan disetujui diri sendiri',
      data: { id: result.insertId, total_jam }
    });
  } catch (error) {
    console.error('Error createLembur:', error);
    res.status(500).json({ success: false, message: 'Gagal mengajukan lembur', error: error.message });
  }
};

/**
 * List Lembur Saya
 */
exports.getMyLembur = async (req, res) => {
  try {
    const [rows] = await pool.execute(
      `SELECT * FROM lembur WHERE nik = ? ORDER BY created_at DESC LIMIT 100`,
      [req.user.nik]
    );
    res.json({ success: true, data: rows });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * List Lembur untuk Approval Supervisor (Departemen yang sama & jnj_jabatan != STAFF)
 */
exports.getLemburToApproveSupervisor = async (req, res) => {
  try {
    const { departemen, nik } = req.user;
    
    // Syarat: Status PENDING (menunggu supervisor)
    // Departemen sama, dan tidak boleh approve form sendiri
    const [rows] = await pool.execute(
      `SELECT * FROM lembur 
       WHERE departemen = ? AND status = 'PENDING' AND nik != ?
       ORDER BY created_at ASC`,
      [departemen, nik]
    );

    res.json({ success: true, data: rows });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * List Lembur untuk Approval HRD
 */
exports.getLemburToApproveHRD = async (req, res) => {
  try {
    // Syarat: Status sudah APPROVED_SUPERVISOR
    const [rows] = await pool.execute(
      `SELECT * FROM lembur 
       WHERE status = 'APPROVED_SUPERVISOR'
       ORDER BY created_at ASC`
    );

    res.json({ success: true, data: rows });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Proses Approval
 */
exports.approveLembur = async (req, res) => {
  try {
    const { id } = req.params;
    const { action } = req.body; // 'APPROVE' or 'REJECT'
    const user = req.user;

    // 1. Cek data lembur
    const [rows] = await pool.execute(`SELECT * FROM lembur WHERE id = ?`, [id]);
    if (rows.length === 0) return res.status(404).json({ success: false, message: 'Data tidak ditemukan' });
    const lembur = rows[0];

    if (action === 'REJECT') {
      await pool.execute(`UPDATE lembur SET status = 'REJECTED' WHERE id = ?`, [id]);
      return res.json({ success: true, message: 'Lembur ditolak' });
    }

    // 2. Logika Approval Supervisor
    if (lembur.status === 'PENDING') {
      // Pastikan approver dari departemen yang sama (kecuali admin/HR tetap bisa?)
      // User must have jnj_jabatan Level
      if (user.departemen !== lembur.departemen && !['Admin', 'HRD'].includes(user.role)) {
        return res.status(403).json({ success: false, message: 'Bukan dalam departemen yang sama' });
      }

      await pool.execute(
        `UPDATE lembur SET 
          status = 'APPROVED_SUPERVISOR', 
          approved_supervisor_by = ?, 
          approved_supervisor_at = NOW() 
         WHERE id = ?`,
        [user.nik, id]
      );
      return res.json({ success: true, message: 'Disetujui oleh Supervisor' });
    }

    // 3. Logika Approval HRD
    if (lembur.status === 'APPROVED_SUPERVISOR') {
      // Cek apakah user HRD (asumsi role 'Admin' atau departemen mengandung HRD/SDM)
      const isHRD = user.role === 'Admin' || (user.departemen && (user.departemen.includes('SDM') || user.departemen.includes('HRD') || user.departemen.includes('Personalia')));
      
      if (!isHRD) {
        return res.status(403).json({ success: false, message: 'Hanya HRD yang boleh menyetujui tahap ini' });
      }

      await pool.execute(
        `UPDATE lembur SET 
          status = 'APPROVED_HRD', 
          approved_hrd_by = ?, 
          approved_hrd_at = NOW() 
         WHERE id = ?`,
        [user.nik, id]
      );

      // OTOMATIS: Tambahkan ke jadwal_dinas
      await finalizeLemburToJadwal(lembur);

      return res.json({ success: true, message: 'Disetujui oleh HRD dan sudah masuk ke Jadwal Dinas' });
    }

    res.status(400).json({ success: false, message: 'Langkah approval tidak valid atau sudah selesai' });

  } catch (error) {
    console.error('Error approveLembur:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Private Helper: Sync approved lembur to jadwal_dinas
 */
async function finalizeLemburToJadwal(lembur) {
  try {
    // kategori LEMBUR, wajib_masuk 0
    // Jam mulai dan jam selesai diambil dari form
    const shiftCode = 'Lm'; // Code khusus lembur
    
    await pool.execute(
      `INSERT INTO jadwal_dinas (pin, tanggal, shift, wajib_masuk, kategori, jam_mulai, jam_selesai, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, NOW())
       ON DUPLICATE KEY UPDATE 
       shift = VALUES(shift), 
       kategori = VALUES(kategori),
       jam_mulai = VALUES(jam_mulai),
       jam_selesai = VALUES(jam_selesai)`,
      [
        lembur.nik, 
        lembur.tgl_lembur, 
        shiftCode, 
        0, 
        'LEMBUR', 
        lembur.jam_mulai, 
        lembur.jam_selesai
      ]
    );
    console.log(`✅ Sync lembur ID ${lembur.id} to jadwal_dinas SUCCESS`);
  } catch (err) {
    console.error(`❌ Sync lembur ID ${lembur.id} FAILED:`, err.message);
    throw err;
  }
}
