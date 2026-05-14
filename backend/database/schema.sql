-- ============================================================
-- DATABASE: db_absensi_rspkrw
-- Charset : utf8mb4
-- Timezone: +07:00 (WIB)
-- ============================================================

CREATE DATABASE IF NOT EXISTS db_absensi_rspkrw
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

USE db_absensi_rspkrw;

-- ============================================================
-- TABEL: karyawan
-- ============================================================
CREATE TABLE IF NOT EXISTS karyawan (
  id         INT UNSIGNED    AUTO_INCREMENT PRIMARY KEY,
  pin        VARCHAR(50)     NOT NULL UNIQUE COMMENT 'PIN di mesin absensi',
  nama       VARCHAR(100)    NOT NULL,
  departemen VARCHAR(100)    NULL,
  jabatan    VARCHAR(100)    NULL,
  email      VARCHAR(100)    NULL,
  aktif      TINYINT(1)      NOT NULL DEFAULT 1,
  created_at TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_pin (pin),
  INDEX idx_dept (departemen)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- TABEL: absensi  (tabel utama log mesin)
-- ============================================================
CREATE TABLE IF NOT EXISTS absensi (
  id         BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  pin        VARCHAR(50)     NOT NULL               COMMENT 'User ID dari mesin',
  waktu      DATETIME        NOT NULL               COMMENT 'Waktu scan',
  status     ENUM(
               'masuk','pulang',
               'lembur_masuk','lembur_pulang',
               'istirahat_keluar','istirahat_masuk'
             )               NOT NULL DEFAULT 'masuk',
  device_id  VARCHAR(50)     NULL                   COMMENT 'Serial number mesin',
  raw_data   JSON            NULL                   COMMENT 'Raw data mesin (debug)',
  created_at TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,

  INDEX idx_pin       (pin),
  INDEX idx_waktu     (waktu),
  INDEX idx_status    (status),
  INDEX idx_device    (device_id),
  INDEX idx_created   (created_at),
  INDEX idx_date_pin  (pin, waktu)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- TABEL: device_mesin
-- ============================================================
CREATE TABLE IF NOT EXISTS device_mesin (
  id         INT UNSIGNED    AUTO_INCREMENT PRIMARY KEY,
  device_id  VARCHAR(50)     NOT NULL UNIQUE,
  nama       VARCHAR(100)    NULL,
  ip_address VARCHAR(45)     NULL,
  lokasi     VARCHAR(100)    NULL,
  aktif      TINYINT(1)      NOT NULL DEFAULT 1,
  last_seen  TIMESTAMP       NULL,
  created_at TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- TABEL: absensi_log_error  (request yang gagal di-parse)
-- ============================================================
CREATE TABLE IF NOT EXISTS absensi_log_error (
  id           BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  ip_source    VARCHAR(45)  NULL,
  method       VARCHAR(10)  NULL,
  content_type VARCHAR(100) NULL,
  raw_body     TEXT         NULL,
  error_msg    TEXT         NULL,
  created_at   TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- TABEL: raw_mesin_log
-- Menyimpan SETIAP request dari mesin secara verbatim.
-- Tujuan:
--   1. Audit trail — bisa trace semua data masuk dari mesin
--   2. Debug — lihat raw body / query string asli
--   3. Replay — re-process data jika parsing gagal
-- ============================================================
CREATE TABLE IF NOT EXISTS raw_mesin_log (
  id               BIGINT UNSIGNED  AUTO_INCREMENT PRIMARY KEY,

  -- ── Informasi HTTP Request ──────────────────────────────
  ip_source        VARCHAR(45)      NULL    COMMENT 'IP mesin pengirim',
  http_method      VARCHAR(10)      NULL    COMMENT 'GET / POST',
  content_type     VARCHAR(150)     NULL    COMMENT 'Content-Type header',
  query_string     TEXT             NULL    COMMENT 'URL query params (JSON)',
  body_text        TEXT             NULL    COMMENT 'Body sebagai plain text',
  body_json        JSON             NULL    COMMENT 'Body jika sudah terparsing',
  raw_body         TEXT             NULL    COMMENT 'Raw body bytes asli dari mesin',

  -- ── Hasil ekstraksi / parsing ───────────────────────────
  pin_extracted    VARCHAR(50)      NULL    COMMENT 'PIN hasil parse',
  waktu_extracted  DATETIME         NULL    COMMENT 'Waktu scan hasil parse',
  status_extracted VARCHAR(30)      NULL    COMMENT 'Status absensi hasil parse',
  device_sn        VARCHAR(50)      NULL    COMMENT 'Serial number mesin',
  verify_type      VARCHAR(20)      NULL    COMMENT '0=PIN, 1=Fingerprint, 15=Face, dll',
  work_code        VARCHAR(20)      NULL    COMMENT 'Work code (jika ada)',

  -- ── Status pemrosesan ───────────────────────────────────
  parse_status     ENUM(
                     'parsed',      -- berhasil diekstrak
                     'no_pin',      -- tidak ada PIN
                     'error'        -- exception saat parse
                   ) NOT NULL DEFAULT 'parsed',

  process_status   ENUM(
                     'pending',     -- belum diproses ke absensi
                     'done',        -- sudah masuk tabel absensi
                     'duplicate',   -- duplikat, diabaikan
                     'error'        -- gagal insert ke absensi
                   ) NOT NULL DEFAULT 'pending',

  absensi_id       BIGINT UNSIGNED  NULL    COMMENT 'FK ke tabel absensi jika berhasil disimpan',

  receive_at       DATETIME         NOT NULL DEFAULT CURRENT_TIMESTAMP
                                    COMMENT 'Waktu request diterima server',

  -- ── Indexes ─────────────────────────────────────────────
  INDEX idx_rml_pin        (pin_extracted),
  INDEX idx_rml_device     (device_sn),
  INDEX idx_rml_receive    (receive_at),
  INDEX idx_rml_parse      (parse_status),
  INDEX idx_rml_process    (process_status),
  INDEX idx_rml_absensi    (absensi_id),
  INDEX idx_rml_date_pin   (pin_extracted, receive_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Raw log setiap request dari mesin absensi (audit trail)';


-- ============================================================
-- DATA AWAL
-- ============================================================
INSERT IGNORE INTO device_mesin (device_id, nama, ip_address, lokasi)
VALUES ('X100C-001', 'Mesin Pintu Utama', '192.168.10.150', 'Lobby RSPKRW');

INSERT IGNORE INTO karyawan (pin, nama, departemen, jabatan) VALUES
  ('1001', 'Budi Santoso',  'Umum',       'Staff Umum'),
  ('1002', 'Siti Aminah',   'Keperawatan','Perawat'),
  ('1003', 'Ahmad Fauzi',   'Keuangan',   'Bendahara'),
  ('1004', 'Dewi Lestari',  'Farmasi',    'Apoteker');

-- ============================================================
-- VIEW: Rekap harian
-- ============================================================
CREATE OR REPLACE VIEW v_rekap_harian AS
SELECT
  DATE(a.waktu)                                        AS tanggal,
  a.pin,
  k.nama                                               AS nama_karyawan,
  k.departemen,
  MIN(CASE WHEN a.status='masuk'  THEN a.waktu END)    AS jam_masuk,
  MAX(CASE WHEN a.status='pulang' THEN a.waktu END)    AS jam_pulang,
  TIMEDIFF(
    MAX(CASE WHEN a.status='pulang' THEN a.waktu END),
    MIN(CASE WHEN a.status='masuk'  THEN a.waktu END)
  )                                                    AS durasi_kerja,
  COUNT(a.id)                                          AS total_scan
FROM absensi a
LEFT JOIN karyawan k ON k.pin = a.pin
GROUP BY DATE(a.waktu), a.pin, k.nama, k.departemen;

-- ============================================================
-- TABEL TAMBAHAN (DIURUS OLEH CONTROLLER)
-- ============================================================

-- Tabel record (Format Stabil untuk ADMS)
CREATE TABLE IF NOT EXISTS record (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  user_id     VARCHAR(50)  NOT NULL,
  check_time  VARCHAR(50)  NOT NULL COMMENT 'Format: M/D/YYYY H:mm:ss',
  check_type  VARCHAR(5)   NOT NULL COMMENT 'I=In, O=Out',
  INDEX idx_user_time (user_id, check_time)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Tabel user (Local user reference untuk join cepat)
CREATE TABLE IF NOT EXISTS user (
  id      INT AUTO_INCREMENT PRIMARY KEY,
  nip     VARCHAR(50)  UNIQUE,
  name    VARCHAR(100) NOT NULL,
  role    VARCHAR(20)  DEFAULT 'Staff',
  INDEX idx_nip (nip)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Tabel jadwal_dinas
CREATE TABLE IF NOT EXISTS jadwal_dinas (
  id           INT AUTO_INCREMENT PRIMARY KEY,
  pin          VARCHAR(50)  NOT NULL,
  tanggal      DATE         NOT NULL,
  shift        VARCHAR(10)  NOT NULL,
  wajib_masuk  INT          DEFAULT 7,
  kategori     VARCHAR(20)  DEFAULT 'WAJIB',
  jam_mulai    TIME         NULL,
  jam_selesai  TIME         NULL,
  created_at   TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_pin_tanggal_kategori (pin, tanggal, kategori),
  INDEX idx_pin_tanggal (pin, tanggal)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Migrasi awal dari karyawan ke user
INSERT IGNORE INTO user (nip, name)
SELECT pin, nama FROM karyawan;
