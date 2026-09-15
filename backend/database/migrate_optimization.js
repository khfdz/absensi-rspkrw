const { pool } = require('../src/config/database');

async function runMigration() {
  console.log('🏁 Starting Database Migration & Optimization...\n');

  try {
    // 1. Drop absensi_log_error table
    console.log('🗑️  1. Dropping absensi_log_error table...');
    await pool.query('DROP TABLE IF EXISTS absensi_log_error');
    console.log('   ✅ Table dropped (if existed).');

    // 2. Add error_msg column to raw_mesin_log table
    console.log('📝 2. Adding error_msg column to raw_mesin_log...');
    const [rawMesinCols] = await pool.query('DESCRIBE raw_mesin_log');
    const hasErrorMsgCol = rawMesinCols.some(col => col.Field === 'error_msg');
    if (!hasErrorMsgCol) {
      await pool.query('ALTER TABLE raw_mesin_log ADD COLUMN error_msg TEXT NULL AFTER absensi_id');
      console.log('   ✅ error_msg column added to raw_mesin_log.');
    } else {
      console.log('   ℹ️  error_msg column already exists in raw_mesin_log.');
    }

    // 3. Optimize user table
    console.log('👤 3. Optimizing user table structure and keys...');
    
    // Clean up any duplicates in user table to avoid migration failure
    console.log('   - Cleaning up potential duplicate user records...');
    await pool.query(`
      CREATE TEMPORARY TABLE temp_user_keep AS
      SELECT MIN(id) as id_to_keep, nip
      FROM user
      WHERE nip IS NOT NULL AND nip != ''
      GROUP BY nip;
    `);
    
    // Delete duplicate rows
    const [delResult] = await pool.query(`
      DELETE u FROM user u
      LEFT JOIN temp_user_keep t ON u.id = t.id_to_keep
      WHERE t.id_to_keep IS NULL;
    `);
    console.log(`   - Removed ${delResult.affectedRows} duplicate/invalid users.`);

    // Modify user columns structure
    await pool.query('ALTER TABLE user MODIFY COLUMN id VARCHAR(50) NOT NULL');
    await pool.query('ALTER TABLE user MODIFY COLUMN nip VARCHAR(50) NOT NULL');
    await pool.query('ALTER TABLE user MODIFY COLUMN name VARCHAR(150) NOT NULL');

    // Check existing keys on user table
    const [userIndexes] = await pool.query('SHOW INDEX FROM user');
    const hasPrimary = userIndexes.some(idx => idx.Key_name === 'PRIMARY');
    const hasNipUnique = userIndexes.some(idx => idx.Key_name === 'idx_nip' || idx.Key_name === 'uk_nip' || idx.Key_name === 'nip');

    if (!hasPrimary) {
      await pool.query('ALTER TABLE user ADD PRIMARY KEY (id)');
      console.log('   ✅ Primary Key added to user.id');
    }
    if (!hasNipUnique) {
      await pool.query('ALTER TABLE user ADD UNIQUE KEY idx_nip (nip)');
      console.log('   ✅ Unique Key idx_nip added to user.nip');
    }

    // 4. Optimize record table
    console.log('📊 4. Optimizing record table structure and keys...');
    
    // Check if auto-increment primary key `id` exists
    const [recordCols] = await pool.query('DESCRIBE record');
    const hasRecordId = recordCols.some(col => col.Field === 'id');
    if (!hasRecordId) {
      console.log('   - Adding id primary key column...');
      await pool.query('ALTER TABLE record ADD COLUMN id INT AUTO_INCREMENT PRIMARY KEY FIRST');
      console.log('   ✅ id primary key column added to record.');
    }

    // Modify record columns structure
    await pool.query('ALTER TABLE record MODIFY COLUMN user_id VARCHAR(50) NOT NULL');
    await pool.query('ALTER TABLE record MODIFY COLUMN check_time VARCHAR(50) NOT NULL');
    await pool.query('ALTER TABLE record MODIFY COLUMN check_type VARCHAR(5) NOT NULL');
    console.log('   ✅ Column types shrunk on record.');

    // Add composite index (user_id, check_time) to record
    const [recordIndexes] = await pool.query('SHOW INDEX FROM record');
    const hasUserTimeIndex = recordIndexes.some(idx => idx.Key_name === 'idx_user_time');
    if (!hasUserTimeIndex) {
      console.log('   - Creating composite index idx_user_time on record (user_id, check_time)...');
      await pool.query('CREATE INDEX idx_user_time ON record (user_id, check_time)');
      console.log('   ✅ Composite index idx_user_time created.');
    } else {
      console.log('   ℹ️  Composite index idx_user_time already exists.');
    }

    // 5. Optimize absensi table
    console.log('📅 5. Optimizing absensi table structure and keys...');
    const [absCols] = await pool.query('SHOW COLUMNS FROM absensi');
    const absIdCol = absCols.find(c => c.Field === 'id');
    
    if (absIdCol && absIdCol.Key !== 'PRI') {
      console.log('   - Adding primary key and auto-increment to absensi.id...');
      await pool.query('ALTER TABLE absensi MODIFY COLUMN id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY');
      console.log('   ✅ Primary Key and auto_increment added to absensi.');
    } else {
      console.log('   ℹ️  absensi.id already has primary key/auto_increment.');
    }

    // Add missing indexes to absensi
    const [absIndexes] = await pool.query('SHOW INDEX FROM absensi');
    const absIdxNames = absIndexes.map(idx => idx.Key_name);
    
    const absIdxToCreate = {
      'idx_pin': 'ALTER TABLE absensi ADD INDEX idx_pin (pin)',
      'idx_waktu': 'ALTER TABLE absensi ADD INDEX idx_waktu (waktu)',
      'idx_status': 'ALTER TABLE absensi ADD INDEX idx_status (status)',
      'idx_device': 'ALTER TABLE absensi ADD INDEX idx_device (device_id)',
      'idx_created': 'ALTER TABLE absensi ADD INDEX idx_created (created_at)',
      'idx_date_pin': 'ALTER TABLE absensi ADD INDEX idx_date_pin (pin, waktu)'
    };

    for (const [name, sql] of Object.entries(absIdxToCreate)) {
      if (!absIdxNames.includes(name)) {
        console.log(`   - Creating index ${name} on absensi...`);
        await pool.query(sql);
        console.log(`   ✅ Index ${name} created on absensi.`);
      }
    }

    // 6. Optimize raw_mesin_log table
    console.log('📋 6. Optimizing raw_mesin_log table structure and keys...');
    const [rmlCols] = await pool.query('SHOW COLUMNS FROM raw_mesin_log');
    const rmlIdCol = rmlCols.find(c => c.Field === 'id');

    if (rmlIdCol && rmlIdCol.Key !== 'PRI') {
      console.log('   - Adding primary key and auto-increment to raw_mesin_log.id...');
      await pool.query('ALTER TABLE raw_mesin_log MODIFY COLUMN id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY');
      console.log('   ✅ Primary Key and auto_increment added to raw_mesin_log.');
    } else {
      console.log('   ℹ️  raw_mesin_log.id already has primary key/auto_increment.');
    }

    // Add missing indexes to raw_mesin_log
    const [rmlIndexes] = await pool.query('SHOW INDEX FROM raw_mesin_log');
    const rmlIdxNames = rmlIndexes.map(idx => idx.Key_name);

    const rmlIdxToCreate = {
      'idx_rml_pin': 'ALTER TABLE raw_mesin_log ADD INDEX idx_rml_pin (pin_extracted)',
      'idx_rml_device': 'ALTER TABLE raw_mesin_log ADD INDEX idx_rml_device (device_sn)',
      'idx_rml_receive': 'ALTER TABLE raw_mesin_log ADD INDEX idx_rml_receive (receive_at)',
      'idx_rml_parse': 'ALTER TABLE raw_mesin_log ADD INDEX idx_rml_parse (parse_status)',
      'idx_rml_process': 'ALTER TABLE raw_mesin_log ADD INDEX idx_rml_process (process_status)',
      'idx_rml_absensi': 'ALTER TABLE raw_mesin_log ADD INDEX idx_rml_absensi (absensi_id)',
      'idx_rml_date_pin': 'ALTER TABLE raw_mesin_log ADD INDEX idx_rml_date_pin (pin_extracted, receive_at)'
    };

    for (const [name, sql] of Object.entries(rmlIdxToCreate)) {
      if (!rmlIdxNames.includes(name)) {
        console.log(`   - Creating index ${name} on raw_mesin_log...`);
        await pool.query(sql);
        console.log(`   ✅ Index ${name} created on raw_mesin_log.`);
      }
    }

    // 7. Recreate View v_rekap_harian joining with local user table instead of karyawan
    console.log('👁️  7. Recreating view v_rekap_harian...');
    await pool.query(`
      CREATE OR REPLACE VIEW v_rekap_harian AS
      SELECT
        DATE(a.waktu)                                        AS tanggal,
        a.pin,
        u.name                                               AS nama_karyawan,
        CAST(NULL AS CHAR(50))                               AS departemen,
        MIN(CASE WHEN a.status='masuk'  THEN a.waktu END)    AS jam_masuk,
        MAX(CASE WHEN a.status='pulang' THEN a.waktu END)    AS jam_pulang,
        TIMEDIFF(
          MAX(CASE WHEN a.status='pulang' THEN a.waktu END),
          MIN(CASE WHEN a.status='masuk'  THEN a.waktu END)
        )                                                    AS durasi_kerja,
        COUNT(a.id)                                          AS total_scan
      FROM absensi a
      LEFT JOIN user u ON u.nip = a.pin
      GROUP BY DATE(a.waktu), a.pin, u.name
    `);
    console.log('   ✅ Recreated v_rekap_harian view.');

    console.log('\n🎉 Database optimization migration completed successfully!');
  } catch (error) {
    console.error('\n❌ Error during migration:', error);
  } finally {
    await pool.end();
    process.exit(0);
  }
}

runMigration();
