const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();

const root = path.resolve(__dirname, '..');
const dbPath = path.join(root, 'internship_final.db');
const backupsDir = path.join(root, 'backups');

function ensureDir(d) { if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true }); }

async function backup() {
  ensureDir(backupsDir);
  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  const target = path.join(backupsDir, `internship_final_${ts}.db`);
  fs.copyFileSync(dbPath, target);
  console.log('Backup created at', target);
}

function migrate() {
  const db = new sqlite3.Database(dbPath);
  db.serialize(() => {
    // create tables if missing (idempotent)
    db.run(`CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT,
      password_hash TEXT,
      role TEXT,
      student_id INTEGER,
      company_id INTEGER
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS students (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      full_name TEXT,
      major TEXT,
      gpa REAL
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS companies (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT,
      industry TEXT,
      openings INTEGER DEFAULT 0
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS applications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      student_id INTEGER,
      company_id INTEGER,
      position TEXT,
      stage TEXT DEFAULT 'Applied',
      notes TEXT,
      created_at DATETIME DEFAULT (datetime('now'))
    )`);

    // Add missing columns to users table safely
    db.all(`PRAGMA table_info('users')`, [], (err, cols) => {
      if (err) return console.error('Failed to read users table info:', err.message);
      const names = (cols || []).map(c => c.name);
      const add = [];
      if (!names.includes('email')) add.push("email TEXT");
      if (!names.includes('password_hash')) add.push("password_hash TEXT");
      if (!names.includes('role')) add.push("role TEXT");
      if (!names.includes('student_id')) add.push("student_id INTEGER");
      if (!names.includes('company_id')) add.push("company_id INTEGER");
      if (!add.length) {
        console.log('No user columns to add');
        return;
      }
      add.forEach(colDef => {
        const colName = colDef.split(' ')[0];
        db.run(`ALTER TABLE users ADD COLUMN ${colDef}`, [], (err2) => {
          if (err2) console.error(`Could not add column ${colName}:`, err2.message);
          else console.log(`Added column ${colName} to users table`);
        });
      });
    });
  });
  db.close();
}

async function main() {
  if (!fs.existsSync(dbPath)) {
    console.log('Database not found at', dbPath, '\nA new DB will be created by migration.');
    ensureDir(path.dirname(dbPath));
    fs.closeSync(fs.openSync(dbPath, 'a'));
  }
  await backup();
  migrate();
}

main().catch(e => { console.error(e); process.exit(1); });
