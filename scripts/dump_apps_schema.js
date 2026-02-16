const fs = require('fs');
const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./internship_final.db', (err)=>{ if (err) { console.error('DB open error', err); process.exit(1); } });

db.all("PRAGMA table_info('applications')", [], (err, rows) => {
  if (err) { console.error('Error', err); process.exit(1); }
  fs.writeFileSync('scripts/apps_schema.json', JSON.stringify(rows, null, 2));
  console.log('Wrote scripts/apps_schema.json');
  db.close();
});