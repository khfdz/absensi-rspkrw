const { pool, sikkPool } = require('../config/database');
const { getUserRole } = require('../utils/roleHelper');

/**
 * Mendapatkan daftar seluruh user dan role mereka di aplikasi absensi
 * HANYA DAPAT DIAKSES OLEH ROLE IT
 */
exports.getRoles = async (req, res) => {
  try {
    const { search, roleFilter, deptFilter } = req.query;

    // 1. Ambil seluruh data pegawai dari SIKKRW
    let query = `
      SELECT nik, nama, jk, jbtn, jnj_jabatan, departemen, bidang, stts_aktif
      FROM pegawai
      WHERE 1=1
    `;
    const params = [];

    if (search && search.trim() !== '') {
      query += ` AND (nama LIKE ? OR nik LIKE ?)`;
      const term = `%${search.trim()}%`;
      params.push(term, term);
    }

    if (deptFilter && deptFilter !== 'all') {
      query += ` AND departemen = ?`;
      params.push(deptFilter);
    }

    query += ` ORDER BY nama ASC`;

    const [pegawaiRows] = await sikkPool.query(query, params);

    // 2. Ambil semua data custom role yang tersimpan di user_roles
    const [rolesRows] = await pool.query(`SELECT nik, role, keterangan, updated_by, updated_at FROM user_roles`);
    const customRolesMap = {};
    rolesRows.forEach(r => {
      customRolesMap[r.nik] = r;
    });

    // 3. Gabungkan dan tentukan role aktif
    let mappedUsers = pegawaiRows.map(p => {
      const custom = customRolesMap[p.nik];
      let role = 'STAFF';
      let isCustom = false;

      if (custom && custom.role) {
        role = custom.role;
        isCustom = true;
      } else {
        if (String(p.nik).toLowerCase() === 'adm' || (p.departemen && p.departemen.trim().toUpperCase() === 'IT')) {
          role = 'IT';
        } else if (p.departemen && p.departemen.trim().toUpperCase() === 'HRD') {
          role = 'HRD';
        } else {
          role = 'STAFF';
        }
      }

      return {
        nik: p.nik,
        nama: p.nama,
        jk: p.jk,
        jbtn: p.jbtn,
        departemen: p.departemen,
        stts_aktif: p.stts_aktif,
        role: role,
        isCustom: isCustom,
        keterangan: custom?.keterangan || null,
        updated_by: custom?.updated_by || null,
        updated_at: custom?.updated_at || null,
      };
    });

    // Filter by role jika ada filter role
    if (roleFilter && roleFilter !== 'all') {
      mappedUsers = mappedUsers.filter(u => u.role === roleFilter);
    }

    // Hitung ringkasan statistik
    const stats = {
      total: mappedUsers.length,
      itCount: mappedUsers.filter(u => u.role === 'IT').length,
      hrdCount: mappedUsers.filter(u => u.role === 'HRD').length,
      staffCount: mappedUsers.filter(u => u.role === 'STAFF').length,
    };

    res.status(200).json({
      success: true,
      stats,
      data: mappedUsers,
    });
  } catch (error) {
    console.error('Error in getRoles:', error);
    res.status(500).json({
      success: false,
      message: 'Gagal mengambil data hak akses',
      error: error.message,
    });
  }
};

/**
 * Memperbarui / menetapkan role pengguna
 * HANYA DAPAT DIAKSES OLEH ROLE IT
 */
exports.updateRole = async (req, res) => {
  try {
    const { nik, role, keterangan = '' } = req.body;

    if (!nik || !role) {
      return res.status(400).json({
        success: false,
        message: 'NIK dan Role wajib diisi',
      });
    }

    const validRoles = ['IT', 'HRD', 'STAFF'];
    if (!validRoles.includes(role)) {
      return res.status(400).json({
        success: false,
        message: `Role tidak valid. Pilihan role: ${validRoles.join(', ')}`,
      });
    }

    const updatedBy = req.user?.nik || 'IT_ADMIN';

    await pool.query(
      `INSERT INTO user_roles (nik, role, keterangan, updated_by)
       VALUES (?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         role = VALUES(role),
         keterangan = VALUES(keterangan),
         updated_by = VALUES(updated_by),
         updated_at = NOW()`,
      [nik, role, keterangan, updatedBy]
    );

    res.status(200).json({
      success: true,
      message: `Hak akses untuk NIK ${nik} berhasil diubah menjadi ${role}`,
      data: { nik, role, keterangan, updated_by: updatedBy },
    });
  } catch (error) {
    console.error('Error in updateRole:', error);
    res.status(500).json({
      success: false,
      message: 'Gagal memperbarui hak akses',
      error: error.message,
    });
  }
};

/**
 * Mereset role ke default departemen
 * HANYA DAPAT DIAKSES OLEH ROLE IT
 */
exports.resetRole = async (req, res) => {
  try {
    const { nik } = req.params;

    if (!nik) {
      return res.status(400).json({
        success: false,
        message: 'NIK wajib ditentukan',
      });
    }

    await pool.query('DELETE FROM user_roles WHERE nik = ?', [nik]);

    res.status(200).json({
      success: true,
      message: `Hak akses NIK ${nik} berhasil dikembalikan ke default departemen`,
    });
  } catch (error) {
    console.error('Error in resetRole:', error);
    res.status(500).json({
      success: false,
      message: 'Gagal mereset hak akses',
      error: error.message,
    });
  }
};
