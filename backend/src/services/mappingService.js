const { pool } = require('../config/database');

let mappingCache = null;
let lastFetch = 0;

/**
 * Mengambil cache daftar mapping NIK/PIN
 */
async function getMappingMap() {
  const now = Date.now();
  if (mappingCache && (now - lastFetch < 30000)) {
    return mappingCache;
  }
  try {
    const [rows] = await pool.query('SELECT pin_mesin, nik_pegawai, nama, departemen FROM mapping_nik_mesin');
    mappingCache = { byPin: {}, byNik: {}, list: rows };
    for (const r of rows) {
      mappingCache.byPin[String(r.pin_mesin).trim()] = r;
      mappingCache.byNik[String(r.nik_pegawai).trim()] = r;
    }
    lastFetch = now;
    return mappingCache;
  } catch (err) {
    console.error('Error fetching mappingCache:', err.message);
    return mappingCache || { byPin: {}, byNik: {}, list: [] };
  }
}

/**
 * Mengonversi PIN dari mesin ke NIK pegawai resmi jika ada di mapping
 */
async function resolvePin(pin) {
  if (!pin) return pin;
  const pinStr = String(pin).trim();
  const cache = await getMappingMap();
  const found = cache.byPin[pinStr];
  return found ? found.nik_pegawai : pinStr;
}

module.exports = {
  getMappingMap,
  resolvePin,
};
