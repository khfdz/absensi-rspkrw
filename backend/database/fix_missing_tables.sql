-- ============================================================
-- MISSING TABLES FOR RSPKRW
-- ============================================================

USE rspkrw;

-- 1. Tabel record (Format Stabil/ADMS)
CREATE TABLE IF NOT EXISTS record (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  user_id     VARCHAR(50)  NOT NULL,
  check_time  VARCHAR(50)  NOT NULL COMMENT 'Format: M/D/YYYY H:mm:ss',
  check_type  VARCHAR(5)   NOT NULL COMMENT 'I=In, O=Out',
  INDEX idx_user_time (user_id, check_time)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. Tabel user (Local user reference)
-- Digunakan untuk join di rawMesinController
CREATE TABLE IF NOT EXISTS user (
  id      INT AUTO_INCREMENT PRIMARY KEY,
  nip     VARCHAR(50)  UNIQUE,
  name    VARCHAR(100) NOT NULL,
  role    VARCHAR(20)  DEFAULT 'Staff',
  INDEX idx_nip (nip)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. Tabel jadwal_dinas
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

-- 4. Tambahkan dummy data ke user agar join tidak kosong (Optional, tapi membantu)
INSERT IGNORE INTO user (nip, name)
SELECT pin, nama FROM karyawan;
