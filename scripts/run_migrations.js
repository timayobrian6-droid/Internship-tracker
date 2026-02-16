const fs = require('fs');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const logPath = path.join(__dirname, 'migrations.log');
function log(...args) { fs.appendFileSync(logPath, new Date().toISOString() + ' - ' + args.join(' ') + '\n'); }
(async ()=>{
  try {
    log('Starting migration script');
    const dbFile = path.join(__dirname, '..', 'internship_final.db');
    const backup = dbFile + '.bak.' + Date.now();
    fs.copyFileSync(dbFile, backup);
    log('Backup created', backup);

    const db = new sqlite3.Database(dbFile);
    await new Promise((res, rej)=> db.run("PRAGMA journal_mode = WAL", [], (e)=> { if (e) { log('WAL error', e.message); } else log('WAL mode enabled'); res(); }));
    await new Promise((res, rej)=> db.run("PRAGMA busy_timeout = 5000", [], (e)=> { if (e) { log('busy_timeout error', e.message); } else log('busy_timeout set to 5000ms'); res(); }));

    const runAlter = (sql) => new Promise((resolve)=> {
      let attempts = 0;
      const max = 10;
      const tryRun = () => {
        attempts++;
        db.run(sql, [], (err) => {
          if (!err) { log('SUCCESS', sql); return resolve({ ok: true }); }
          if (err.message && err.message.includes('database is locked') && attempts < max) {
            const wait = 200 * attempts;
            log('Locked, retry', attempts, 'waiting', wait);
            return setTimeout(tryRun, wait);
          }
          log('FAILED', sql, err.message);
          return resolve({ ok: false, err: err.message });
        });
      };
      tryRun();
    });

    // Read existing columns
    const cols = await new Promise((res, rej) => db.all("PRAGMA table_info('applications')", [], (e, r) => { if (e) return rej(e); res((r||[]).map(x=>x.name)); }));
    log('Existing columns:', cols.join(', '));

    const toAdd = [];
    if (!cols.includes('position')) toAdd.push("ALTER TABLE applications ADD COLUMN position TEXT");
    if (!cols.includes('stage')) toAdd.push("ALTER TABLE applications ADD COLUMN stage TEXT DEFAULT 'Applied'");
    if (!cols.includes('notes')) toAdd.push("ALTER TABLE applications ADD COLUMN notes TEXT");
    if (!cols.includes('created_at')) toAdd.push("ALTER TABLE applications ADD COLUMN created_at DATETIME DEFAULT (datetime('now'))");

    for (const sql of toAdd) {
      const r = await runAlter(sql);
      if (!r.ok) log('ERROR applying', sql, r.err);
    }

    // Migrate legacy columns if present
    if (cols.includes('status') && !cols.includes('stage')) {
      const r = await runAlter("UPDATE applications SET stage = status WHERE status IS NOT NULL");
      if (!r.ok) log('ERROR migrating status->stage', r.err);
    }
    if (cols.includes('applied_date') && !cols.includes('created_at')) {
      const r = await runAlter("UPDATE applications SET created_at = applied_date WHERE applied_date IS NOT NULL");
      if (!r.ok) log('ERROR migrating applied_date->created_at', r.err);
    }

    // Dump final schema to file
    await new Promise((res, rej) => db.all("PRAGMA table_info('applications')", [], (e, rows) => { if (e) { log('PRAGMA error', e.message); return res(); } fs.writeFileSync(path.join(__dirname, 'apps_schema_after.json'), JSON.stringify(rows, null, 2)); log('Wrote apps_schema_after.json'); res(); }));

    db.close();
    log('Migration script finished');
    console.log('Migration script finished. Check scripts/migrations.log and scripts/apps_schema_after.json');
  } catch (err) { log('Script error', err.message); console.error(err); }
})();