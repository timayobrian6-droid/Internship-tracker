const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcrypt');

const db = new sqlite3.Database('./internship_final.db');

const run = (sql, params = []) =>
  new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) return reject(err);
      resolve(this);
    });
  });

const get = (sql, params = []) =>
  new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) return reject(err);
      resolve(row);
    });
  });

const demoUsers = [
  {
    role: 'student',
    username: 'newstudent_1740400000',
    email: 'newstudent_1740400000@example.com',
    password: 'Pass123!'
  },
  {
    role: 'company',
    username: 'newcompany_1771932705',
    email: 'newcompany_1771932705@example.com',
    password: 'Pass123'
  },
  {
    role: 'company',
    username: 'newcompany_test_001',
    email: 'newcompany_test_001@example.com',
    password: 'Pass123'
  }
];

async function upsertDemoUser(account) {
  const hash = await bcrypt.hash(account.password, 10);
  const existing = await get(
    `SELECT id FROM users WHERE lower(username) = lower(?) OR lower(email) = lower(?)`,
    [account.username, account.email]
  );

  if (existing) {
    await run(
      `UPDATE users
       SET username = ?, email = ?, password_hash = ?, role = ?, status = 'active'
       WHERE id = ?`,
      [account.username, account.email, hash, account.role, existing.id]
    );
    return { mode: 'updated', id: existing.id };
  }

  const created = await run(
    `INSERT INTO users (username, email, password_hash, role, status)
     VALUES (?, ?, ?, ?, 'active')`,
    [account.username, account.email, hash, account.role]
  );
  return { mode: 'created', id: created.lastID };
}

async function seedDemoAccounts() {
  let created = 0;
  let updated = 0;

  for (const account of demoUsers) {
    const result = await upsertDemoUser(account);
    if (result.mode === 'created') created += 1;
    if (result.mode === 'updated') updated += 1;
  }

  console.log(`Demo accounts ready. Created: ${created}, Updated: ${updated}`);
}

seedDemoAccounts()
  .then(() => db.close())
  .catch((err) => {
    console.error('Failed to seed demo accounts:', err.message);
    db.close();
    process.exit(1);
  });
