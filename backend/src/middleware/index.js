// Simpan raw body sebelum di-parse (untuk debug)
function rawBodySaver(req, res, buf, encoding) {
  if (buf && buf.length) {
    req.rawBody = buf.toString(encoding || 'utf8');
  }
}

// Log setiap request masuk
function requestLogger(req, res, next) {
  const ip = req.ip || req.connection.remoteAddress;
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl} | IP: ${ip} | CT: ${req.headers['content-type'] || '-'}`);
  next();
}

// Global error handler
function errorHandler(err, req, res, next) {
  console.error('❌ Error:', err.stack);
  // Selalu 200 untuk endpoint mesin agar tidak retry
  if (req.path.startsWith('/api/absen')) return res.status(200).send('OK');
  return res.status(500).json({ success: false, message: 'Internal server error' });
}

module.exports = { rawBodySaver, requestLogger, errorHandler };
