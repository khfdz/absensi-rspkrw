require('dotenv').config();

const express    = require('express');
const http       = require('http');
const { Server } = require('socket.io');
const bodyParser = require('body-parser');
const cors       = require('cors');
const morgan     = require('morgan');

const { testConnection }             = require('./src/config/database');
const { setIO }                      = require('./src/config/socket');
const absensiRoutes                  = require('./src/routes/absensiRoutes');
const mesinRoutes                    = require('./src/routes/mesinRoutes');
const authRoutes                     = require('./src/routes/authRoutes');
const pegawaiRoutes                  = require('./src/routes/pegawaiRoutes');
const dashboardRoutes                = require('./src/routes/dashboardRoutes');
const { rawBodySaver, requestLogger, errorHandler } = require('./src/middleware');

// ============================================================
// EXPRESS + HTTP SERVER + SOCKET.IO
// ============================================================
const app        = express();
const httpServer = http.createServer(app);

const allowedOrigins = (process.env.ALLOWED_ORIGINS || 'http://localhost:3000')
  .split(',').map(o => o.trim());

const io = new Server(httpServer, {
  cors: { origin: allowedOrigins, methods: ['GET', 'POST'], credentials: true },
  transports: ['websocket', 'polling'],
});
setIO(io);

// ============================================================
// MIDDLEWARE
// ============================================================
// 1. CORS — Harus di paling atas sebelum rute lain
app.use(cors({
  origin: (origin, cb) => {
    // Jika tidak ada origin (Postman/Mesin Absensi), ijinkan
    if (!origin) return cb(null, true);

    // Normalisasi: hapus trailing slash
    const normalizedOrigin = origin.replace(/\/$/, "");

    // Selalu ijinkan localhost/127.0.0.1 untuk kenyamanan development
    if (
      normalizedOrigin.includes('localhost') || 
      normalizedOrigin.includes('127.0.0.1') ||
      allowedOrigins.includes(normalizedOrigin)
    ) {
      return cb(null, true);
    }

    console.warn(`⚠️ [CORS] Request dari origin ${origin} diblokir.`);
    return cb(null, false); 
  },
  credentials: true,
}));

app.use(morgan(':method :url :status - :response-time ms'));
app.use(requestLogger);

// ─── Body Parser (urutan penting!) ───────────────────────────
// rawBodySaver harus di verify sebelum body di-parse
app.use(bodyParser.json({
  limit:  '10mb',
  verify: rawBodySaver,
}));
app.use(bodyParser.urlencoded({
  extended: true,
  limit:    '10mb',
  verify:   rawBodySaver,
}));
app.use(bodyParser.text({
  type:   '*/*',
  limit:  '10mb',
  verify: rawBodySaver,
}));

// Sajikan dashboard frontend dari folder public/
app.use(express.static('public'));

// ============================================================
// ROUTES
// ============================================================

// 1. Rute Mesin (X100C ADMS) — Diletakkan di root / agar firmware basic terdeteksi
app.use('/', mesinRoutes);

// 2. Rute API Lainnya
app.use('/api/auth', authRoutes);
app.use('/api/pegawai', pegawaiRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api', absensiRoutes);
app.use('/api', mesinRoutes); // tetap ada di /api jika diperlukan

// Health check
app.get('/health', (req, res) =>
  res.json({ status: 'OK', uptime: process.uptime(), time: new Date().toISOString() })
);

// Debug endpoint — lihat raw request
app.all('/debug', (req, res) =>
  res.json({ method: req.method, headers: req.headers, body: req.body, rawBody: req.rawBody, query: req.query })
);

// 404
app.use((req, res) =>
  res.status(404).json({ success: false, message: `Route ${req.method} ${req.path} tidak ditemukan` })
);

// Error handler
app.use(errorHandler);

// ============================================================
// SOCKET.IO EVENTS
// ============================================================
io.on('connection', (socket) => {
  console.log(`🔌 Client terhubung: ${socket.id} dari ${socket.handshake.address}`);

  socket.emit('connected', { message: 'Terhubung ke server absensi RSPKRW', time: new Date().toISOString() });

  socket.on('join:room', (room) => {
    socket.join(room);
    console.log(`   ${socket.id} join room: ${room}`);
  });

  socket.on('disconnect', (reason) => {
    console.log(`🔌 Client disconnect: ${socket.id} | ${reason}`);
  });
});

// ============================================================
// START
// ============================================================
const PORT = parseInt(process.env.PORT) || 3103;
const HOST = '0.0.0.0'; // listen semua interface

async function startServer() {
  const dbOk = await testConnection();
  if (!dbOk) {
    console.error('❌ Server berhenti — koneksi MySQL gagal. Cek konfigurasi .env');
    process.exit(1);
  }

  httpServer.listen(PORT, HOST, () => {
    console.log('\n🚀 ================================================');
    console.log(`   Server    : http://0.0.0.0:${PORT}`);
    console.log(`   Dashboard : http://192.168.10.184:${PORT}`);
    console.log(`   ─── Endpoint Mesin X100C ───────────────────`);
    console.log(`   Mesin push: POST http://192.168.10.184:${PORT}/api/mesin/push`);
    console.log(`   Mesin push: GET  http://192.168.10.184:${PORT}/api/mesin/push`);
    console.log(`   ─── Endpoint Frontend ──────────────────────`);
    console.log(`   Raw Log   : GET  http://192.168.10.184:${PORT}/api/mesin/raw`);
    console.log(`   Raw Stats : GET  http://192.168.10.184:${PORT}/api/mesin/raw/stats`);
    console.log(`   Absensi   : GET  http://192.168.10.184:${PORT}/api/absensi`);
    console.log(`   Rekap     : GET  http://192.168.10.184:${PORT}/api/absensi/rekap`);
    console.log(`   Health    : GET  http://localhost:${PORT}/health`);
    console.log('🚀 ================================================\n');
  });
}

startServer();

process.on('SIGTERM', () => {
  console.log('⏹ Shutting down...');
  httpServer.close(() => process.exit(0));
});

module.exports = { app, io };
