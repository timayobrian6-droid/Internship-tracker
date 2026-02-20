const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcrypt');
const { faker } = require('@faker-js/faker');
const { dbFile } = require('./db_file');

const db = new sqlite3.Database(dbFile, (err) => {
    if (err) {
        console.error("Error opening database:", err.message);
        process.exit(1);
    }
    console.log("Connected to database.");
});

async function runBackfill() {
    try {
        console.log("Starting backfill for Users and Profiles...");
        const defaultPassword = 'password123';
        const passwordHash = await bcrypt.hash(defaultPassword, 10);

        // 1. BACKFILL COMPANIES
        console.log("Processing companies...");
        const companies = await new Promise((resolve, reject) => {
            db.all("SELECT * FROM companies", [], (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });

        for (const company of companies) {
            // Check if user exists
            const userExists = await new Promise((resolve, reject) => {
                db.get("SELECT id FROM users WHERE company_id = ?", [company.id], (err, row) => {
                    if (err) reject(err);
                    else resolve(row);
                });
            });

            if (!userExists) {
                // Generate username
                let baseUsername = company.name.toLowerCase().replace(/[^a-z0-9]/g, '');
                if (baseUsername.length < 3) baseUsername = 'company' + company.id;
                
                // Add uniqueness (simple check, assume probability of collision low for now or retry logic could be added)
                // For safety, append ID if in doubt? No, let's try clean first.
                // Actually, let's just append ID to be safe and unique.
                const username = baseUsername + company.id; 

                console.log(`Creating user for company: ${company.name} -> ${username}`);

                await new Promise((resolve, reject) => {
                    db.run(`INSERT INTO users (username, password, role, company_id) VALUES (?, ?, 'company', ?)`, 
                    [username, passwordHash, company.id], (err) => {
                        if (err) reject(err);
                        else resolve();
                    });
                });
            }

            // Fill missing profile data
            const updates = [];
            const params = [];

            if (!company.industry) { updates.push("industry = ?"); params.push(faker.commerce.department()); }
            if (!company.location) { updates.push("location = ?"); params.push(faker.location.city() + ', ' + faker.location.country()); }
            if (!company.contact_person) { updates.push("contact_person = ?"); params.push(faker.person.fullName()); }
            if (!company.contact_email) { updates.push("contact_email = ?"); params.push(faker.internet.email()); }
            if (!company.contact_phone) { updates.push("contact_phone = ?"); params.push(faker.phone.number()); }
            if (!company.overview) { updates.push("overview = ?"); params.push(faker.company.catchPhrase() + '. ' + faker.lorem.paragraph()); }
            if (!company.mission) { updates.push("mission = ?"); params.push(faker.company.buzzPhrase()); }
            if (!company.vision) { updates.push("vision = ?"); params.push(faker.company.catchPhrase()); }

            if (updates.length > 0) {
                params.push(company.id);
                const sql = `UPDATE companies SET ${updates.join(', ')} WHERE id = ?`;
                await new Promise((resolve, reject) => {
                    db.run(sql, params, (err) => {
                        if (err) reject(err);
                        else resolve();
                    });
                });
                console.log(`Updated profile for company: ${company.name}`);
            }
        }

        // 2. BACKFILL STUDENTS
        console.log("Processing students...");
        const students = await new Promise((resolve, reject) => {
            db.all("SELECT * FROM students", [], (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });

        for (const student of students) {
            // Check if user exists
            const userExists = await new Promise((resolve, reject) => {
                db.get("SELECT id FROM users WHERE student_id = ?", [student.id], (err, row) => {
                    if (err) reject(err);
                    else resolve(row);
                });
            });

            if (!userExists) {
                // Generate username
                let baseUsername = student.full_name.toLowerCase().replace(/[^a-z0-9]/g, '');
                if (baseUsername.length < 3) baseUsername = 'student' + student.id;
                const username = baseUsername + student.id;

                console.log(`Creating user for student: ${student.full_name} -> ${username}`);

                await new Promise((resolve, reject) => {
                    db.run(`INSERT INTO users (username, password, role, student_id) VALUES (?, ?, 'student', ?)`, 
                    [username, passwordHash, student.id], (err) => {
                        if (err) reject(err);
                        else resolve();
                    });
                });
            }

            // Fill missing basic profile data
            const updates = [];
            const params = [];

            if (!student.major) { updates.push("major = ?"); params.push(faker.person.jobArea()); } // Close enough to major
            if (!student.gpa) { updates.push("gpa = ?"); params.push((Math.random() * (4.0 - 2.5) + 2.5).toFixed(2)); }
            if (!student.age) { updates.push("age = ?"); params.push(Math.floor(Math.random() * (30 - 19) + 19)); }
            if (!student.university) { updates.push("university = ?"); params.push("Tech University"); }
            if (!student.phone) { updates.push("phone = ?"); params.push(faker.phone.number()); }
            if (!student.email) { updates.push("email = ?"); params.push(faker.internet.email()); }

            if (updates.length > 0) {
                params.push(student.id);
                const sql = `UPDATE students SET ${updates.join(', ')} WHERE id = ?`;
                await new Promise((resolve, reject) => {
                    db.run(sql, params, (err) => {
                        if (err) reject(err);
                        else resolve();
                    });
                });
                console.log(`Updated profile for student: ${student.full_name}`);
            }

            // EXTENDED PROFILE BACKFILL
            // Check if student_profiles_extended row exists
            const extendedExists = await new Promise((resolve, reject) => {
                db.get("SELECT id FROM student_profiles_extended WHERE student_id = ?", [student.id], (err, row) => {
                    if (err) reject(err);
                    else resolve(row);
                });
            });

            if (!extendedExists) {
                const skills = JSON.stringify([faker.hacker.adjective(), faker.hacker.noun(), faker.company.buzzNoun()]);
                const sql = `INSERT INTO student_profiles_extended (student_id, full_name, email_address, phone_number, gender, date_of_birth, nationality, country_city, school_name, degree_program, year_of_study, expected_grad_year, gpa_academic, skills_json, work_experience, volunteer_experience, research_projects, leadership_roles, publications_competitions, locked, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, datetime('now'))`;
                
                const params = [
                    student.id,
                    student.full_name,
                    student.email || faker.internet.email(),
                    student.phone || faker.phone.number(),
                    Math.random() > 0.5 ? 'Male' : 'Female',
                    faker.date.birthdate({ min: 19, max: 30, mode: 'age' }).toISOString().split('T')[0],
                    faker.location.country(),
                    faker.location.city(),
                    student.university || "Tech University",
                    student.major || "Computer Science",
                    "Year 3",
                    "2026",
                    student.gpa || "3.5",
                    skills,
                    faker.person.jobTitle() + " at " + faker.company.name(),
                    "Volunteer at Local Shelter",
                    "None",
                    "Class Representative",
                    "None"
                ];

                await new Promise((resolve, reject) => {
                    db.run(sql, params, (err) => {
                        if (err) reject(err);
                        else resolve();
                    });
                });
                console.log(`Created extended profile for student: ${student.full_name}`);
            }
        }

        console.log("Backfill complete!");
        process.exit(0);

    } catch (error) {
        console.error("Backfill failed:", error);
        process.exit(1);
    }
}

runBackfill();
