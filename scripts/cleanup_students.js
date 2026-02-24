/**
 * cleanup_students.js
 * Deletes all student/user data from internship_final.db, keeping companies intact.
 * Also VACUUMs the database to reclaim disk space.
 */
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const DB_PATH = path.join(__dirname, '..', 'internship_final.db');
const db = new sqlite3.Database(DB_PATH, (err) => {
  if (err) { console.error('Cannot open DB:', err.message); process.exit(1); }
  console.log('Opened', DB_PATH);
});

function run(sql) {
  return new Promise((resolve, reject) => {
    db.run(sql, function (err) {
      if (err) reject(err);
      else resolve(this.changes);
    });
  });
}

function get(sql) {
  return new Promise((resolve, reject) => {
    db.get(sql, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
}

(async () => {
  try {
    // ── Before counts ──
    console.log('\n=== BEFORE ===');
    const tables = [
      'users', 'students', 'companies', 'student_profiles_extended',
      'applications', 'student_company_subscriptions', 'company_interviews',
      'application_requests', 'password_reset_tokens', 'support_tickets', 'audit_logs'
    ];
    for (const t of tables) {
      const r = await get(`SELECT COUNT(*) as c FROM ${t}`);
      console.log(`  ${t}: ${r.c}`);
    }
    const companyUsers = await get("SELECT COUNT(*) as c FROM users WHERE role='company'");
    const adminUsers = await get("SELECT COUNT(*) as c FROM users WHERE role='admin'");
    console.log(`  company users: ${companyUsers.c}`);
    console.log(`  admin users: ${adminUsers.c}`);

    // ── Delete student-related data ──
    console.log('\n=== DELETING ===');

    let n;
    n = await run("DELETE FROM student_company_subscriptions");
    console.log(`  student_company_subscriptions: ${n} rows deleted`);

    n = await run("DELETE FROM application_requests");
    console.log(`  application_requests: ${n} rows deleted`);

    n = await run("DELETE FROM company_interviews");
    console.log(`  company_interviews: ${n} rows deleted`);

    n = await run("DELETE FROM applications");
    console.log(`  applications: ${n} rows deleted`);

    n = await run("DELETE FROM student_profiles_extended");
    console.log(`  student_profiles_extended: ${n} rows deleted`);

    n = await run("DELETE FROM students");
    console.log(`  students: ${n} rows deleted`);

    // Delete student and admin users, keep company users
    n = await run("DELETE FROM users WHERE role != 'company'");
    console.log(`  users (non-company): ${n} rows deleted`);

    n = await run("DELETE FROM password_reset_tokens");
    console.log(`  password_reset_tokens: ${n} rows deleted`);

    n = await run("DELETE FROM support_tickets");
    console.log(`  support_tickets: ${n} rows deleted`);

    n = await run("DELETE FROM audit_logs");
    console.log(`  audit_logs: ${n} rows deleted`);

    // ── Reclaim disk space ──
    console.log('\n  Running VACUUM to reclaim space...');
    await run("VACUUM");
    console.log('  VACUUM complete.');

    // ── After counts ──
    console.log('\n=== AFTER ===');
    for (const t of tables) {
      const r = await get(`SELECT COUNT(*) as c FROM ${t}`);
      console.log(`  ${t}: ${r.c}`);
    }

    console.log('\nDone! Student data removed, companies preserved.');
  } catch (err) {
    console.error('ERROR:', err.message);
    process.exit(1);
  } finally {
    db.close();
  }
})();
