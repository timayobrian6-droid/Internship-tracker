const sqlite3 = require('sqlite3').verbose();
const { dbFile } = require('./db_file');
const db = new sqlite3.Database(dbFile, (err) => { if (err) return console.error('DB open error', err); });

function allAsync(sql) {
  return new Promise((res, rej) => db.all(sql, [], (e, rows) => e ? rej(e) : res(rows)));
}

(async ()=>{
  try {
    const users = await allAsync('SELECT id, username, email, role, student_id, company_id FROM users');
    const students = await allAsync('SELECT * FROM students');
    const companies = await allAsync('SELECT * FROM companies');
    const applications = await allAsync('SELECT * FROM applications');
    const out = { users, students, companies, applications };
    const fs = require('fs');
    const outPath = 'C:/Users/HomePC/Desktop/INTERNSHIP TRACKER/scripts/dump_output.json';
    fs.writeFileSync(outPath, JSON.stringify(out, null, 2));
    console.log('WROTE', outPath);
    process.exit(0);
  } catch (e) { console.error('Dump error', e); process.exit(1); }
})();
