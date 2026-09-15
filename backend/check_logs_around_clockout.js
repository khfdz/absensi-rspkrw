const { pool } = require('./src/config/database');

async function main() {
  try {
    console.log('=== RAW LOGS RECEIVED BETWEEN 16:05:00 AND 16:15:00 ON 2026-06-22 ===');
    const [rows] = await pool.execute(
      `SELECT id, ip_source, http_method, query_string, body_text, body_json, raw_body, pin_extracted, waktu_extracted, status_extracted, parse_status, process_status, error_msg, receive_at
       FROM raw_mesin_log 
       WHERE receive_at >= '2026-06-22 16:05:00' AND receive_at <= '2026-06-22 16:15:00'
       ORDER BY receive_at ASC`
    );
    console.log(`Found ${rows.length} raw logs.`);
    for (const r of rows) {
      console.log(`\n---------------------------------------------`);
      console.log(`ID: ${r.id} | Received: ${r.receive_at} | Method: ${r.http_method} | IP: ${r.ip_source}`);
      console.log(`Query: ${r.query_string}`);
      console.log(`Pin Extracted: ${r.pin_extracted} | Waktu Extracted: ${r.waktu_extracted} | Status: ${r.status_extracted}`);
      console.log(`Parse Status: ${r.parse_status} | Process Status: ${r.process_status}`);
      console.log(`Raw Body: ${JSON.stringify(r.raw_body)}`);
      console.log(`Body Text: ${JSON.stringify(r.body_text)}`);
      console.log(`Body JSON: ${JSON.stringify(r.body_json)}`);
      if (r.error_msg) console.log(`Error Msg: ${r.error_msg}`);
    }

    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

main();
