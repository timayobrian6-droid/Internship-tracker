const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcrypt');

const db = new sqlite3.Database('./internship_final.db');

const run = (sql, params = []) => new Promise((resolve, reject) => {
  db.run(sql, params, function (err) {
    if (err) return reject(err);
    resolve(this);
  });
});

const get = (sql, params = []) => new Promise((resolve, reject) => {
  db.get(sql, params, (err, row) => {
    if (err) return reject(err);
    resolve(row);
  });
});

const all = (sql, params = []) => new Promise((resolve, reject) => {
  db.all(sql, params, (err, rows) => {
    if (err) return reject(err);
    resolve(rows || []);
  });
});

const now = () => new Date().toISOString();

async function ensureStudent(student) {
  const existing = await get('SELECT id FROM students WHERE email = ?', [student.email]);
  if (existing) return existing.id;
  const res = await run(
    'INSERT INTO students (full_name, major, gpa, age, university, phone, email) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [student.full_name, student.major, student.gpa, student.age, student.university, student.phone, student.email]
  );
  return res.lastID;
}

async function ensureCompany(company) {
  const existing = await get('SELECT id FROM companies WHERE name = ?', [company.name]);
  if (existing) return existing.id;
  const res = await run(
    'INSERT INTO companies (name, industry, openings, location, contact_person, contact_email, contact_phone, overview, mission, vision) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [
      company.name,
      company.industry,
      company.openings,
      company.location,
      company.contact_person,
      company.contact_email,
      company.contact_phone,
      company.overview,
      company.mission,
      company.vision
    ]
  );
  return res.lastID;
}

async function ensureUser(user) {
  const existing = await get('SELECT id FROM users WHERE username = ? OR email = ?', [user.username, user.email]);
  if (existing) return existing.id;
  const hash = await bcrypt.hash(user.password, 10);
  const res = await run(
    'INSERT INTO users (username, email, password_hash, role, student_id, company_id) VALUES (?, ?, ?, ?, ?, ?)',
    [user.username, user.email, hash, user.role, user.student_id || null, user.company_id || null]
  );
  return res.lastID;
}

async function ensureOpening(opening) {
  const existing = await get(
    'SELECT id FROM company_openings WHERE company_id = ? AND department = ? AND role_title = ?',
    [opening.company_id, opening.department, opening.role_title]
  );
  if (existing) return existing.id;
  const res = await run(
    'INSERT INTO company_openings (company_id, department, role_title, expectations, slots, location, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [opening.company_id, opening.department, opening.role_title, opening.expectations, opening.slots, opening.location, now()]
  );
  return res.lastID;
}

async function ensureApplication(app) {
  const existing = await get(
    'SELECT id FROM applications WHERE student_id = ? AND company_id = ? AND position = ?',
    [app.student_id, app.company_id, app.position]
  );
  if (existing) return existing.id;
  const res = await run(
    'INSERT INTO applications (student_id, company_id, position, department, why_internship, skills_fit, career_goals, relevant_experience, stage, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [
      app.student_id,
      app.company_id,
      app.position,
      app.department,
      app.why_internship,
      app.skills_fit,
      app.career_goals,
      app.relevant_experience,
      app.stage,
      now()
    ]
  );
  return res.lastID;
}

async function ensureStudentProfile(profile) {
  const existing = await get('SELECT id FROM student_profiles_extended WHERE student_id = ?', [profile.student_id]);
  if (existing) return existing.id;
  const res = await run(
    `INSERT INTO student_profiles_extended (
      student_id, full_name, email_address, phone_number, school_name, degree_program, gpa_academic,
      skills_json, linkedin_url, locked, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, datetime('now'), datetime('now'))`,
    [
      profile.student_id,
      profile.full_name,
      profile.email_address,
      profile.phone_number,
      profile.school_name,
      profile.degree_program,
      profile.gpa_academic,
      JSON.stringify(profile.skills || []),
      profile.linkedin_url
    ]
  );
  return res.lastID;
}

async function seed() {
  const students = [
    {
      full_name: 'Amina Yusuf',
      major: 'Computer Science',
      gpa: 3.6,
      age: 21,
      university: 'Lagos State University',
      phone: '0803-111-2233',
      email: 'amina.yusuf@example.com'
    },
    {
      full_name: 'Tunde Adeyemi',
      major: 'Business Administration',
      gpa: 3.4,
      age: 22,
      university: 'University of Ibadan',
      phone: '0802-555-7812',
      email: 'tunde.adeyemi@example.com'
    },
    {
      full_name: 'Chisom Okafor',
      major: 'Design',
      gpa: 3.8,
      age: 20,
      university: 'Covenant University',
      phone: '0909-220-4411',
      email: 'chisom.okafor@example.com'
    }
  ];

  const companies = [
    {
      name: 'Nimbus Analytics',
      industry: 'Tech',
      openings: 3,
      location: 'Lagos',
      contact_person: 'Hassan Bello',
      contact_email: 'talent@nimbus.example.com',
      contact_phone: '0809-555-1001',
      overview: 'We build data products that help teams make fast, confident decisions.',
      mission: 'Turn complex data into clear, actionable insights for African businesses.',
      vision: 'A continent where every company runs on trusted intelligence.'
    },
    {
      name: 'BrightPath Health',
      industry: 'Healthcare',
      openings: 2,
      location: 'Abuja',
      contact_person: 'Ngozi Musa',
      contact_email: 'careers@brightpath.example.com',
      contact_phone: '0703-112-8899',
      overview: 'We improve patient outcomes with digital care pathways and smart clinics.',
      mission: 'Make quality care accessible and delightful for every patient.',
      vision: 'Healthy communities powered by compassionate innovation.'
    }
  ];

  const studentIds = [];
  for (const student of students) {
    studentIds.push(await ensureStudent(student));
  }

  const companyIds = [];
  for (const company of companies) {
    companyIds.push(await ensureCompany(company));
  }

  await ensureUser({
    username: 'amina',
    email: students[0].email,
    password: 'Password123!',
    role: 'student',
    student_id: studentIds[0]
  });
  await ensureUser({
    username: 'tunde',
    email: students[1].email,
    password: 'Password123!',
    role: 'student',
    student_id: studentIds[1]
  });
  await ensureUser({
    username: 'chisom',
    email: students[2].email,
    password: 'Password123!',
    role: 'student',
    student_id: studentIds[2]
  });
  await ensureUser({
    username: 'nimbus',
    email: companies[0].contact_email,
    password: 'Password123!',
    role: 'company',
    company_id: companyIds[0]
  });
  await ensureUser({
    username: 'brightpath',
    email: companies[1].contact_email,
    password: 'Password123!',
    role: 'company',
    company_id: companyIds[1]
  });

  await ensureStudentProfile({
    student_id: studentIds[0],
    full_name: students[0].full_name,
    email_address: students[0].email,
    phone_number: students[0].phone,
    school_name: students[0].university,
    degree_program: students[0].major,
    gpa_academic: students[0].gpa,
    skills: ['Python', 'SQL', 'Data Viz'],
    linkedin_url: 'https://linkedin.com/in/amina-yusuf'
  });

  const openings = [
    {
      company_id: companyIds[0],
      department: 'Data',
      role_title: 'Data Analyst Intern',
      expectations: 'Work on dashboards, clean datasets, and support analytics reviews.',
      slots: '2',
      location: 'Lagos (Hybrid)'
    },
    {
      company_id: companyIds[0],
      department: 'Product',
      role_title: 'Product Ops Intern',
      expectations: 'Support product research, customer feedback loops, and roadmaps.',
      slots: '1',
      location: 'Remote'
    },
    {
      company_id: companyIds[1],
      department: 'Clinical Ops',
      role_title: 'Care Coordinator Intern',
      expectations: 'Assist care teams, maintain records, and help run patient outreach.',
      slots: '2',
      location: 'Abuja'
    },
    {
      company_id: companyIds[1],
      department: 'Design',
      role_title: 'UX Design Intern',
      expectations: 'Create patient experience flows and prototype wellness tools.',
      slots: '1',
      location: 'Abuja (Hybrid)'
    }
  ];

  for (const opening of openings) {
    await ensureOpening(opening);
  }

  const applications = [
    {
      student_id: studentIds[0],
      company_id: companyIds[0],
      position: 'Data Analyst Intern',
      department: 'Data',
      why_internship: 'I enjoy turning data into insights that help teams move faster.',
      skills_fit: 'Python, SQL, dashboards, and stakeholder reporting.',
      career_goals: 'Grow into a data product analyst role.',
      relevant_experience: 'Built analytics dashboards for a campus project.',
      stage: 'Interviewing'
    },
    {
      student_id: studentIds[1],
      company_id: companyIds[0],
      position: 'Product Ops Intern',
      department: 'Product',
      why_internship: 'I want to learn how product teams run operationally.',
      skills_fit: 'Research synthesis, coordination, and documentation.',
      career_goals: 'Become a product operations lead.',
      relevant_experience: 'Managed club operations and reporting.',
      stage: 'Applied'
    },
    {
      student_id: studentIds[2],
      company_id: companyIds[1],
      position: 'UX Design Intern',
      department: 'Design',
      why_internship: 'I want to design compassionate healthcare experiences.',
      skills_fit: 'Figma, user research, wireframing.',
      career_goals: 'Grow into a healthcare product designer.',
      relevant_experience: 'Designed a telemedicine prototype in class.',
      stage: 'Offer'
    }
  ];

  for (const app of applications) {
    await ensureApplication(app);
  }

  const summary = await all('SELECT COUNT(*) as total_students FROM students');
  console.log('Sample data ready. Total students:', summary[0]?.total_students || 0);
}

seed()
  .then(() => db.close())
  .catch((err) => {
    console.error('Seed error:', err.message);
    db.close();
    process.exit(1);
  });
