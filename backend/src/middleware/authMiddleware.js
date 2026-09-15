const jwt = require('jsonwebtoken');
const { getUserRole } = require('../utils/roleHelper');

/**
 * Middleware untuk verifikasi JWT Token
 */
async function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      success: false,
      message: 'Token tidak ditemukan atau tidak valid'
    });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'supersecretkey');
    // Sinkronisasi role terkini secara real-time dari database absensi
    const currentRole = await getUserRole(decoded.nik, decoded.departemen);
    req.user = {
      ...decoded,
      role: currentRole
    };
    next();
  } catch (error) {
    console.error('Token verification error:', error.message);
    return res.status(401).json({
      success: false,
      message: 'Token kedaluwarsa atau tidak valid'
    });
  }
}

/**
 * Middleware untuk membatasi akses berdasarkan peran (Role)
 */
function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Pengguna belum terotentikasi'
      });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: 'Akses ditolak: Anda tidak memiliki izin untuk fitur ini',
        requiredRoles: roles,
        yourRole: req.user.role
      });
    }

    next();
  };
}

authMiddleware.authMiddleware = authMiddleware;
authMiddleware.requireRole = requireRole;

module.exports = authMiddleware;
module.exports.authMiddleware = authMiddleware;
module.exports.requireRole = requireRole;
