const sqlite3 = require('sqlite3').verbose();
const { dbFile } = require('./db_file');

const studentEmails = [
  'amina.yusuf@example.com',
  'tunde.adeyemi@example.com',
  'chisom.okafor@example.com'
];

const companyNames = [
  'Nimbus Analytics',
  'BrightPath Health'
];

const db = new sqlite3.Database(dbFile);

const run = (sql, params = []) => new Promise((resolve, reject) => {
  db.run(sql, params, function (err) {
    if (err) return reject(err);
    resolve(this);
  });
});

const all = (sql, params = []) => new Promise((resolve, reject) => {
  db.all(sql, params, (err, rows) => {
    if (err) return reject(err);
    resolve(rows || []);
  });
});

async function removeSeedData() {
  const students = await all('SELECT id FROM students WHERE email IN (?,?,?)', studentEmails);
  const studentIds = students.map(r => r.id);
  const companies = await all('SELECT id FROM companies WHERE name IN (?,?)', companyNames);
  const companyIds = companies.map(r => r.id);

  const appWhere = [];
  const appParams = [];
  if (studentIds.length) {
    appWhere.push(`student_id IN (${studentIds.map(() => '?').join(',')})`);
    appParams.push(...studentIds);
  }
  if (companyIds.length) {
    appWhere.push(`company_id IN (${companyIds.map(() => '?').join(',')})`);
    appParams.push(...companyIds);
  }
  const apps = appWhere.length
    ? await all(`SELECT id FROM applications WHERE ${appWhere.join(' OR ')}`, appParams)
    : [];
  const appIds = apps.map(r => r.id);

  if (appIds.length) {
    await run(`DELETE FROM application_requests WHERE application_id IN (${appIds.map(() => '?').join(',')})`, appIds);
  }
  if (companyIds.length) {
    await run(`DELETE FROM company_interviews WHERE company_id IN (${companyIds.map(() => '?').join(',')})`, companyIds);
  }
  if (appIds.length) {
    await run(`DELETE FROM applications WHERE id IN (${appIds.map(() => '?').join(',')})`, appIds);
  }
  if (companyIds.length) {
    await run(`DELETE FROM company_openings WHERE company_id IN (${companyIds.map(() => '?').join(',')})`, companyIds);
  }

  if (studentIds.length || companyIds.length) {
    const subClauses = [];
    const subParams = [];
    if (studentIds.length) {
      subClauses.push(`student_id IN (${studentIds.map(() => '?').join(',')})`);
      subParams.push(...studentIds);
    }
    if (companyIds.length) {
      subClauses.push(`company_id IN (${companyIds.map(() => '?').join(',')})`);
      subParams.push(...companyIds);
    }
    await run(`DELETE FROM student_company_subscriptions WHERE ${subClauses.join(' OR ')}`, subParams);
  }

  if (studentIds.length) {
    await run(`DELETE FROM student_profiles_extended WHERE student_id IN (${studentIds.map(() => '?').join(',')})`, studentIds);
    await run(`DELETE FROM students WHERE id IN (${studentIds.map(() => '?').join(',')})`, studentIds);
  }
  if (companyIds.length) {
    await run(`DELETE FROM companies WHERE id IN (${companyIds.map(() => '?').join(',')})`, companyIds);
  }

  console.log('Deleted seeded data. Students:', studentIds.length, 'Companies:', companyIds.length, 'Applications:', appIds.length);
}

removeSeedData()
  .then(() => db.close())
  .catch((err) => {
    console.error('Delete error:', err.message);
    db.close();
    process.exit(1);
  });
