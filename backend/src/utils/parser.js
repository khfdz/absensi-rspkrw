const dayjs = require('dayjs');
const customParseFormat = require('dayjs/plugin/customParseFormat');
dayjs.extend(customParseFormat);

// ============================================================
// FORMAT WAKTU YANG DIDUKUNG
// ============================================================
const DATE_FORMATS = [
  'YYYY-MM-DD HH:mm:ss',
  'YYYYMMDDHHmmss',
  'YYYY-MM-DDTHH:mm:ss',
  'YYYY/MM/DD HH:mm:ss',
  'DD-MM-YYYY HH:mm:ss',
  'MM/DD/YYYY HH:mm:ss',
];

function parseWaktu(rawTime) {
  if (!rawTime) return null;
  const str = String(rawTime).trim();
  for (const fmt of DATE_FORMATS) {
    const parsed = dayjs(str, fmt, true);
    if (parsed.isValid()) return parsed.toDate();
  }
  const fallback = new Date(str);
  return isNaN(fallback.getTime()) ? null : fallback;
}

// ============================================================
// STATUS ABSENSI
// 0=Masuk, 1=Pulang, 2=Lembur Masuk, 3=Lembur Pulang,
// 4=Istirahat Keluar, 5=Istirahat Masuk
// ============================================================
function parseStatus(rawStatus) {
  const map = {
    '0': 'masuk',
    '1': 'pulang',
    '2': 'lembur_masuk',
    '3': 'lembur_pulang',
    '4': 'istirahat_keluar',
    '5': 'istirahat_masuk',
  };
  return map[String(rawStatus)] || 'masuk';
}

// ============================================================
// PARSE: form-urlencoded / JSON object
// Mesin X100C bisa kirim berbagai nama field
// ============================================================
function parseFormData(body) {
  const pin =
    body.pin || body.user_id || body.userid ||
    body.emp_id || body.EnrollNumber || body.id || null;

  const rawTime =
    body.time || body.datetime || body.timestamp ||
    body.Timestamp || body.checktime || body.att_time || null;

  const rawStatus =
    body.status      !== undefined ? body.status :
    body.att_type    !== undefined ? body.att_type :
    body.State       !== undefined ? body.State :
    body.type        !== undefined ? body.type : '0';

  const deviceId =
    body.device_id || body.SN || body.sn ||
    body.serialnumber || body.DeviceSN || null;

  return {
    pin:       pin ? String(pin).trim() : null,
    waktu:     parseWaktu(rawTime),
    status:    parseStatus(rawStatus),
    device_id: deviceId ? String(deviceId).trim() : null,
    raw:       body,
  };
}

// ============================================================
// PARSE: Raw text / ATTLOG (tab-separated)
// Contoh: 1001\t20240115083000\t0\t1\t0\t0
// ============================================================
function parseRawText(text) {
  const results = [];
  const lines   = text.split('\n').filter(l => l.trim());
  for (const line of lines) {
    if (/^(ATTLOG|OK|Content|GET|POST|HTTP)/i.test(line.trim())) continue;
    const parts = line.trim().split(/\t|,|\|/);
    if (parts.length >= 2) {
      results.push({
        pin:       parts[0] ? String(parts[0]).trim() : null,
        waktu:     parseWaktu(parts[1]),
        status:    parseStatus(parts[2] || '0'),
        device_id: null,
        raw:       { line },
      });
    }
  }
  return results;
}

// ============================================================
// MAIN PARSER — deteksi format otomatis
// Return: array of records
// ============================================================
function parseAbsensiData(req) {
  const contentType = (req.headers['content-type'] || '').toLowerCase();
  const body        = req.body;
  const rawBody     = req.rawBody || '';

  if (process.env.LOG_LEVEL === 'debug') {
    console.log('\n========= RAW REQUEST =========');
    console.log('[Method]       ', req.method);
    console.log('[URL]          ', req.originalUrl);
    console.log('[Content-Type] ', contentType);
    console.log('[Body]         ', JSON.stringify(body));
    console.log('[Raw Body]     ', rawBody);
    console.log('[Query]        ', JSON.stringify(req.query));
    console.log('================================\n');
  }

  // 1. JSON
  if (contentType.includes('application/json')) {
    if (Array.isArray(body)) return body.map(parseFormData).filter(d => d.pin);
    const r = parseFormData(body);
    return r.pin ? [r] : [];
  }

  // 2. x-www-form-urlencoded
  if (contentType.includes('application/x-www-form-urlencoded')) {
    // 2.a Spesifik ADMS: field 'cdata' berisi data mentah tab-separated
    if (body.cdata) {
      const records = parseRawText(body.cdata);
      if (records.length > 0) return records;
    }
    const r = parseFormData(body);
    return r.pin ? [r] : [];
  }

  // 3. multipart
  if (contentType.includes('multipart/form-data')) {
    const r = parseFormData(body);
    return r.pin ? [r] : [];
  }

  // 4. Raw text / ATTLOG
  if (rawBody) {
    const records = parseRawText(rawBody);
    if (records.length > 0) return records;
  }

  // 5. Parsed object yang tidak masuk kategori di atas
  if (body && typeof body === 'object' && Object.keys(body).length > 0) {
    const r = parseFormData(body);
    return r.pin ? [r] : [];
  }

  // 6. GET request (beberapa firmware lama)
  if (req.method === 'GET' && Object.keys(req.query).length > 0) {
    const r = parseFormData(req.query);
    return r.pin ? [r] : [];
  }

  return [];
}

module.exports = { parseAbsensiData, parseWaktu, parseStatus };
