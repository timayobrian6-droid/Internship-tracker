const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./internship_final.db', (err)=>{ if (err) { console.error('DB open error', err); process.exit(1); } });
db.all("PRAGMA table_info('applications')", [], (err, rows) => {
  if (err) { console.error('Error', err); process.exit(1); }
  console.log('applications table columns:');
  rows.forEach(r => console.log(r.name, r.type));
  db.close();
});