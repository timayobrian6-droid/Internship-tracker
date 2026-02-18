const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const http = require('http');
const { Server } = require('socket.io');
const multer = require('multer');
const nodemailer = require('nodemailer');
const crypto = require('crypto');
require('dotenv').config();

const path = require('path');

// ... (existing imports) ...

const app = express();
app.use(cors());
app.use(express.json());
// Serve static files from the React frontend app
app.use(express.static(path.join(__dirname, 'internship-frontend/build')));


const JWT_SECRET = process.env.JWT_SECRET || 'dev_jwt_secret_change_me';
const SMTP_HOST = process.env.SMTP_HOST || '';
const SMTP_PORT = Number(process.env.SMTP_PORT || 587);
const SMTP_SECURE = String(process.env.SMTP_SECURE || '').toLowerCase() === 'true';
const SMTP_USER = process.env.SMTP_USER || '';
const SMTP_PASS = process.env.SMTP_PASS || '';
const SMTP_FROM = process.env.SMTP_FROM || '';
const resetBaseUrl = process.env.RESET_BASE_URL || process.env.RENDER_EXTERNAL_URL || 'http://localhost:3000';
const RESET_BASE_URL = resetBaseUrl.replace(/\/$/, '');
const RESET_EMAIL_MODE = (process.env.RESET_EMAIL_MODE || 'smtp').toLowerCase();
let mailTransporter = null;

function getMailTransporter() {
    if (mailTransporter) return mailTransporter;
    if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS || !SMTP_FROM) return null;
    mailTransporter = nodemailer.createTransport({
        host: SMTP_HOST,
        port: SMTP_PORT,
        secure: SMTP_SECURE,
        auth: { user: SMTP_USER, pass: SMTP_PASS }
    });
    return mailTransporter;
}

// SMS Transporter
function sendSMS(to, body) {
    if (!process.env.TWILIO_ACCOUNT_SID || !process.env.TWILIO_AUTH_TOKEN || !process.env.TWILIO_PHONE_NUMBER) {
        console.log(`[SMS SKIPPED] Missing Twilio config. To: ${to}, Msg: ${body}`);
        return;
    }
    
    try {
        const client = require('twilio')(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
        client.messages.create({
            body: body,
            from: process.env.TWILIO_PHONE_NUMBER,
            to: to
        })
        .then(message => console.log('SMS sent:', message.sid))
        .catch(err => console.error('Twilio Error:', err.message));
    } catch (e) {
        console.error('Twilio Initialization Error:', e.message);
    }
}

function notifySubscribersForOpening(companyId, openingRow) {
    const transporter = getMailTransporter();
    if (!transporter) return;
    db.get(`SELECT name FROM companies WHERE id = ?`, [companyId], (err, companyRow) => {
        if (err) return console.error('Could not load company name for email', err.message);
        const companyName = companyRow?.name || 'a member company';
        db.all(`SELECT u.email
                FROM users u
                JOIN student_company_subscriptions s ON s.student_id = u.student_id
                WHERE u.role = 'student' AND s.company_id = ? AND u.email IS NOT NULL`, [companyId], (err2, rows) => {
            if (err2) return console.error('Could not load subscribers', err2.message);
            const recipients = (rows || []).map(r => r.email).filter(Boolean);
            if (!recipients.length) return;
            const title = openingRow?.role_title || openingRow?.department || 'Internship opening';
            const subject = `New opening at ${companyName}`;
            const text = `Good news! ${companyName} just opened a new role: ${title}.

Log in to your InternConnect dashboard to review the details and apply.`;
            transporter.sendMail({
                from: SMTP_FROM,
                bcc: recipients,
                subject,
                text
            }).catch((mailErr) => console.error('Could not send opening email', mailErr.message));
        });
    });
}

// 1. Connect to your database file
const db = new sqlite3.Database('./internship_final.db', (err) => {
    if (err) console.error("Database connection error:", err.message);
    else console.log("Connected to internship_final.db");
});

let io = null;

const uploadStorage = multer.memoryStorage();
const upload = multer({ storage: uploadStorage, limits: { fileSize: 10 * 1024 * 1024 } });
const profileUploadFields = upload.fields([
    { name: 'resume', maxCount: 1 },
    { name: 'cover_letter', maxCount: 1 },
    { name: 'recommendation_letters', maxCount: 1 },
    { name: 'transcript', maxCount: 1 },
    { name: 'student_id_doc', maxCount: 1 },
    { name: 'certificates', maxCount: 1 },
    { name: 'profile_picture', maxCount: 1 }
]);
const companyProfileUpload = upload.single('profile_picture');

function getAppSetting(key, fallback, callback) {
    db.get(`SELECT value FROM app_settings WHERE key = ?`, [key], (err, row) => {
        if (err) return callback(err, fallback);
        if (!row || typeof row.value === 'undefined' || row.value === null) return callback(null, fallback);
        callback(null, row.value);
    });
}

function logAudit({ actorUserId = null, actionType = '', entityType = '', entityId = null, details = {} }) {
    const payload = JSON.stringify(details || {});
    db.run(
        `INSERT INTO audit_logs (actor_user_id, action_type, entity_type, entity_id, details_json) VALUES (?, ?, ?, ?, ?)`
        , [actorUserId, actionType, entityType, entityId, payload]
    );
    if (io) {
        io.emit('admin:changed', { actionType, entityType, entityId, details });
    }
}

function pickUploadedFile(req, field) {
    const entry = req.files && req.files[field] ? req.files[field][0] : null;
    if (!entry) return null;
    return { blob: entry.buffer, name: entry.originalname, mime: entry.mimetype };
}

// Ensure `users` table exists for authentication
db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email TEXT UNIQUE,
        username TEXT,
        password_hash TEXT,
        role TEXT,
        student_id INTEGER,
        company_id INTEGER,
        status TEXT DEFAULT 'active'
    )`);

    // Migration: ensure required columns exist (handles older DB schemas)
    db.all(`PRAGMA table_info('users')`, [], (err, cols) => {
        if (err) return console.error('Could not read users table info', err.message);
        const names = (cols || []).map(c => c.name);
        const toAdd = [];
        if (!names.includes('email')) toAdd.push("email TEXT");
        if (!names.includes('username')) toAdd.push("username TEXT");
        if (!names.includes('password_hash')) toAdd.push("password_hash TEXT");
        if (!names.includes('role')) toAdd.push("role TEXT");
        if (!names.includes('student_id')) toAdd.push("student_id INTEGER");
        if (!names.includes('company_id')) toAdd.push("company_id INTEGER");
        if (!names.includes('status')) toAdd.push("status TEXT DEFAULT 'active'");
        if (toAdd.length) {
            // SQLite only supports adding one column at a time
            toAdd.forEach(colDef => {
                const colName = colDef.split(' ')[0];
                db.run(`ALTER TABLE users ADD COLUMN ${colDef}`, [], (err2) => {
                    if (err2) console.error(`Could not add column ${colName} to users:`, err2.message);
                    else console.log(`Added column ${colName} to users table`);
                });
            });
        }
    });
});

// Ensure core tables exist
db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS students (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        full_name TEXT,
        major TEXT,
        gpa REAL,
        age INTEGER,
        university TEXT,
        phone TEXT,
        email TEXT
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS companies (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT,
        industry TEXT,
        openings INTEGER DEFAULT 0,
        location TEXT,
        contact_person TEXT,
        contact_email TEXT,
        contact_phone TEXT,
        overview TEXT,
        mission TEXT,
        vision TEXT,
        profile_picture_name TEXT,
        profile_picture_blob BLOB
    )`);

    // Ensure students table has necessary columns (handle older DBs)
    db.all(`PRAGMA table_info('students')`, [], (err, cols) => {
        if (err) return console.error('Could not read students table info', err.message);
        const names = (cols || []).map(c => c.name);
        const toAdd = [];
        if (!names.includes('age')) toAdd.push("age INTEGER");
        if (!names.includes('university')) toAdd.push("university TEXT");
        if (!names.includes('phone')) toAdd.push("phone TEXT");
        if (!names.includes('email')) toAdd.push("email TEXT");
        toAdd.forEach(colDef => {
            const colName = colDef.split(' ')[0];
            db.run(`ALTER TABLE students ADD COLUMN ${colDef}`, [], (err2) => {
                if (err2) console.error(`Could not add column ${colName} to students:`, err2.message);
                else console.log(`Added column ${colName} to students table`);
            });
        });
    });

    // Ensure companies table has necessary columns (handle older DBs)
    db.all(`PRAGMA table_info('companies')`, [], (err2, cols2) => {
        if (err2) return console.error('Could not read companies table info', err2.message);
        const names2 = (cols2 || []).map(c => c.name);
        const toAdd2 = [];
        if (!names2.includes('location')) toAdd2.push("location TEXT");
        if (!names2.includes('contact_person')) toAdd2.push("contact_person TEXT");
        if (!names2.includes('contact_email')) toAdd2.push("contact_email TEXT");
        if (!names2.includes('contact_phone')) toAdd2.push("contact_phone TEXT");
        if (!names2.includes('overview')) toAdd2.push("overview TEXT");
        if (!names2.includes('mission')) toAdd2.push("mission TEXT");
        if (!names2.includes('vision')) toAdd2.push("vision TEXT");
        if (!names2.includes('profile_picture_name')) toAdd2.push("profile_picture_name TEXT");
        if (!names2.includes('profile_picture_blob')) toAdd2.push("profile_picture_blob BLOB");
        toAdd2.forEach(colDef => {
            const colName = colDef.split(' ')[0];
            db.run(`ALTER TABLE companies ADD COLUMN ${colDef}`, [], (err3) => {
                if (err3) console.error(`Could not add column ${colName} to companies:`, err3.message);
                else console.log(`Added column ${colName} to companies table`);
            });
        });
    });

    // improve concurrency: WAL + busy_timeout to reduce SQLITE_BUSY on ALTERs
    db.run("PRAGMA journal_mode = WAL", [], (errW) => { if (errW) console.error('Could not set WAL mode', errW.message); else console.log('WAL mode enabled'); });
    db.run("PRAGMA busy_timeout = 5000", [], (errB) => { if (errB) console.error('Could not set busy_timeout', errB.message); else console.log('busy_timeout set to 5000ms'); });

    // helper to retry ALTER operations when database is briefly locked
    function runAlterWithRetry(alterSql, params = [], attempt = 1, onSuccess) {
        const maxAttempts = 8;
        db.run(alterSql, params, (err2) => {
            if (err2) {
                const msg = (err2 && err2.message) || '';
                if (msg.includes('database is locked') && attempt < maxAttempts) {
                    const wait = 200 * attempt;
                    console.log(`ALTER locked, retrying in ${wait}ms (attempt ${attempt})`);
                    setTimeout(() => runAlterWithRetry(alterSql, params, attempt + 1), wait);
                } else {
                    console.error(`Could not run ALTER (${alterSql}):`, err2.message);
                }
            } else {
                console.log(`ALTER succeeded: ${alterSql}`);
                if (typeof onSuccess === 'function') onSuccess();
            }
        });
    }

    db.run(`CREATE TABLE IF NOT EXISTS student_profiles_extended (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        student_id INTEGER UNIQUE,
        full_name TEXT,
        email_address TEXT,
        phone_number TEXT,
        gender TEXT,
        date_of_birth TEXT,
        nationality TEXT,
        country_city TEXT,
        school_name TEXT,
        degree_program TEXT,
        year_of_study TEXT,
        expected_grad_year TEXT,
        gpa_academic TEXT,
        skills_json TEXT,
        work_experience TEXT,
        volunteer_experience TEXT,
        research_projects TEXT,
        leadership_roles TEXT,
        publications_competitions TEXT,
        resume_path TEXT,
        resume_name TEXT,
        resume_blob BLOB,
        cover_letter_path TEXT,
        cover_letter_name TEXT,
        cover_letter_blob BLOB,
        linkedin_url TEXT,
        recommendation_letters_path TEXT,
        recommendation_letters_name TEXT,
        recommendation_letters_blob BLOB,
        transcript_path TEXT,
        transcript_name TEXT,
        transcript_blob BLOB,
        id_path TEXT,
        id_name TEXT,
        id_blob BLOB,
        certificates_path TEXT,
        certificates_name TEXT,
        certificates_blob BLOB,
        profile_picture_name TEXT,
        profile_picture_blob BLOB,
        locked INTEGER DEFAULT 1,
        created_at DATETIME DEFAULT (datetime('now')),
        updated_at DATETIME DEFAULT (datetime('now'))
    )`);

    db.all(`PRAGMA table_info('student_profiles_extended')`, [], (err, cols) => {
        if (err) return console.error('Could not read student_profiles_extended table info', err.message);
        const names = (cols || []).map(c => c.name);
        const toAdd = [];
        if (!names.includes('email_address')) toAdd.push("email_address TEXT");
        if (!names.includes('phone_number')) toAdd.push("phone_number TEXT");
        if (!names.includes('gender')) toAdd.push("gender TEXT");
        if (!names.includes('date_of_birth')) toAdd.push("date_of_birth TEXT");
        if (!names.includes('nationality')) toAdd.push("nationality TEXT");
        if (!names.includes('country_city')) toAdd.push("country_city TEXT");
        if (!names.includes('school_name')) toAdd.push("school_name TEXT");
        if (!names.includes('degree_program')) toAdd.push("degree_program TEXT");
        if (!names.includes('year_of_study')) toAdd.push("year_of_study TEXT");
        if (!names.includes('expected_grad_year')) toAdd.push("expected_grad_year TEXT");
        if (!names.includes('gpa_academic')) toAdd.push("gpa_academic TEXT");
        if (!names.includes('skills_json')) toAdd.push("skills_json TEXT");
        if (!names.includes('work_experience')) toAdd.push("work_experience TEXT");
        if (!names.includes('volunteer_experience')) toAdd.push("volunteer_experience TEXT");
        if (!names.includes('research_projects')) toAdd.push("research_projects TEXT");
        if (!names.includes('leadership_roles')) toAdd.push("leadership_roles TEXT");
        if (!names.includes('publications_competitions')) toAdd.push("publications_competitions TEXT");
        if (!names.includes('resume_path')) toAdd.push("resume_path TEXT");
        if (!names.includes('resume_name')) toAdd.push("resume_name TEXT");
        if (!names.includes('resume_blob')) toAdd.push("resume_blob BLOB");
        if (!names.includes('cover_letter_path')) toAdd.push("cover_letter_path TEXT");
        if (!names.includes('cover_letter_name')) toAdd.push("cover_letter_name TEXT");
        if (!names.includes('cover_letter_blob')) toAdd.push("cover_letter_blob BLOB");
        if (!names.includes('linkedin_url')) toAdd.push("linkedin_url TEXT");
        if (!names.includes('recommendation_letters_path')) toAdd.push("recommendation_letters_path TEXT");
        if (!names.includes('recommendation_letters_name')) toAdd.push("recommendation_letters_name TEXT");
        if (!names.includes('recommendation_letters_blob')) toAdd.push("recommendation_letters_blob BLOB");
        if (!names.includes('transcript_path')) toAdd.push("transcript_path TEXT");
        if (!names.includes('transcript_name')) toAdd.push("transcript_name TEXT");
        if (!names.includes('transcript_blob')) toAdd.push("transcript_blob BLOB");
        if (!names.includes('id_path')) toAdd.push("id_path TEXT");
        if (!names.includes('id_name')) toAdd.push("id_name TEXT");
        if (!names.includes('id_blob')) toAdd.push("id_blob BLOB");
        if (!names.includes('certificates_path')) toAdd.push("certificates_path TEXT");
        if (!names.includes('certificates_name')) toAdd.push("certificates_name TEXT");
        if (!names.includes('certificates_blob')) toAdd.push("certificates_blob BLOB");
        if (!names.includes('profile_picture_name')) toAdd.push("profile_picture_name TEXT");
        if (!names.includes('profile_picture_blob')) toAdd.push("profile_picture_blob BLOB");
        if (!names.includes('locked')) toAdd.push("locked INTEGER DEFAULT 1");
        if (!names.includes('created_at')) toAdd.push("created_at DATETIME DEFAULT (datetime('now'))");
        if (!names.includes('updated_at')) toAdd.push("updated_at DATETIME DEFAULT (datetime('now'))");
        toAdd.forEach(colDef => {
            const colName = colDef.split(' ')[0];
            runAlterWithRetry(`ALTER TABLE student_profiles_extended ADD COLUMN ${colDef}`);
            console.log(`Ensured column ${colName} on student_profiles_extended`);
        });
    });

    db.run(`CREATE TABLE IF NOT EXISTS applications (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        student_id INTEGER,
        company_id INTEGER,
        position TEXT,
        department TEXT,
        why_internship TEXT,
        skills_fit TEXT,
        career_goals TEXT,
        relevant_experience TEXT,
        stage TEXT DEFAULT 'Applied',
        notes TEXT,
        created_at DATETIME DEFAULT (datetime('now'))
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS company_openings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        company_id INTEGER,
        department TEXT,
        role_title TEXT,
        expectations TEXT,
        slots TEXT,
        location TEXT,
        created_at DATETIME DEFAULT (datetime('now'))
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS company_interviews (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        company_id INTEGER,
        application_id INTEGER UNIQUE,
        interview_date TEXT,
        interview_time TEXT,
        mode TEXT,
        location TEXT,
        updated_at DATETIME DEFAULT (datetime('now'))
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS application_requests (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        application_id INTEGER UNIQUE,
        request_text TEXT,
        response_text TEXT,
        created_at DATETIME DEFAULT (datetime('now')),
        updated_at DATETIME DEFAULT (datetime('now'))
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS student_company_subscriptions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        student_id INTEGER,
        company_id INTEGER,
        created_at DATETIME DEFAULT (datetime('now')),
        UNIQUE(student_id, company_id)
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS password_reset_tokens (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        token_hash TEXT,
        expires_at DATETIME,
        used_at DATETIME,
        created_at DATETIME DEFAULT (datetime('now'))
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS support_tickets (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        user_role TEXT,
        subject TEXT,
        message TEXT,
        status TEXT DEFAULT 'open',
        admin_reply TEXT,
        created_at DATETIME DEFAULT (datetime('now')),
        updated_at DATETIME DEFAULT (datetime('now'))
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS audit_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        actor_user_id INTEGER,
        action_type TEXT,
        entity_type TEXT,
        entity_id INTEGER,
        details_json TEXT,
        created_at DATETIME DEFAULT (datetime('now'))
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS app_settings (
        key TEXT PRIMARY KEY,
        value TEXT
    )`);

    const defaultSettings = {
        branding_name: 'Internship Tracker',
        branding_mission: 'Connect students to real-world internships through transparent pipelines, proactive support, and accountable partnerships.',
        branding_vision: 'A campus-to-career network where every student discovers opportunities early, progresses with clarity, and graduates with confidence.',
        contact_email: process.env.ADMIN_EMAIL || '',
        require_approval: '0'
    };
    Object.entries(defaultSettings).forEach(([key, value]) => {
        db.run(`INSERT OR IGNORE INTO app_settings (key, value) VALUES (?, ?)`, [key, value]);
    });

    // Migration: ensure applications table has necessary columns (handle older DBs)
    db.all(`PRAGMA table_info('applications')`, [], (err, cols) => {
        if (err) return console.error('Could not read applications table info', err.message);
        const names = (cols || []).map(c => c.name);
        const toAdd = [];
        if (!names.includes('position')) toAdd.push("position TEXT");
        if (!names.includes('department')) toAdd.push("department TEXT");
        if (!names.includes('why_internship')) toAdd.push("why_internship TEXT");
        if (!names.includes('skills_fit')) toAdd.push("skills_fit TEXT");
        if (!names.includes('career_goals')) toAdd.push("career_goals TEXT");
        if (!names.includes('relevant_experience')) toAdd.push("relevant_experience TEXT");
        if (!names.includes('stage')) toAdd.push("stage TEXT DEFAULT 'Applied'");
        if (!names.includes('notes')) toAdd.push("notes TEXT");
        // SQLite only supports adding one column at a time
        toAdd.forEach(colDef => {
            const colName = colDef.split(' ')[0];
            runAlterWithRetry(`ALTER TABLE applications ADD COLUMN ${colDef}`);
        });
        // Copy legacy column data if present
        if (names.includes('status') && !names.includes('stage')) {
            runAlterWithRetry(`UPDATE applications SET stage = status WHERE status IS NOT NULL`);
        }

        const backfillCreatedAt = () => {
            if (names.includes('applied_date')) {
                runAlterWithRetry(`UPDATE applications SET created_at = COALESCE(created_at, applied_date, datetime('now'))`);
            } else {
                runAlterWithRetry(`UPDATE applications SET created_at = COALESCE(created_at, datetime('now'))`);
            }
        };

        if (!names.includes('created_at')) {
            runAlterWithRetry(`ALTER TABLE applications ADD COLUMN created_at DATETIME`, [], 1, backfillCreatedAt);
        } else if (names.includes('applied_date')) {
            backfillCreatedAt();
        }
    });

    db.all(`PRAGMA table_info('company_openings')`, [], (err, cols) => {
        if (err) return console.error('Could not read company_openings table info', err.message);
        const names = (cols || []).map(c => c.name);
        const toAdd = [];
        if (!names.includes('company_id')) toAdd.push("company_id INTEGER");
        if (!names.includes('department')) toAdd.push("department TEXT");
        if (!names.includes('role_title')) toAdd.push("role_title TEXT");
        if (!names.includes('expectations')) toAdd.push("expectations TEXT");
        if (!names.includes('slots')) toAdd.push("slots TEXT");
        if (!names.includes('location')) toAdd.push("location TEXT");
        if (!names.includes('deadline')) toAdd.push("deadline TEXT");
        if (!names.includes('created_at')) toAdd.push("created_at DATETIME DEFAULT (datetime('now'))");
        toAdd.forEach(colDef => {
            const colName = colDef.split(' ')[0];
            runAlterWithRetry(`ALTER TABLE company_openings ADD COLUMN ${colDef}`);
            console.log(`Ensured column ${colName} on company_openings`);
        });
    });

    db.all(`PRAGMA table_info('company_interviews')`, [], (err, cols) => {
        if (err) return console.error('Could not read company_interviews table info', err.message);
        const names = (cols || []).map(c => c.name);
        const toAdd = [];
        if (!names.includes('company_id')) toAdd.push("company_id INTEGER");
        if (!names.includes('application_id')) toAdd.push("application_id INTEGER");
        if (!names.includes('interview_date')) toAdd.push("interview_date TEXT");
        if (!names.includes('interview_time')) toAdd.push("interview_time TEXT");
        if (!names.includes('mode')) toAdd.push("mode TEXT");
        if (!names.includes('location')) toAdd.push("location TEXT");
        if (!names.includes('updated_at')) toAdd.push("updated_at DATETIME DEFAULT (datetime('now'))");
        toAdd.forEach(colDef => {
            const colName = colDef.split(' ')[0];
            runAlterWithRetry(`ALTER TABLE company_interviews ADD COLUMN ${colDef}`);
            console.log(`Ensured column ${colName} on company_interviews`);
        });
    });

    db.all(`PRAGMA table_info('application_requests')`, [], (err, cols) => {
        if (err) return console.error('Could not read application_requests table info', err.message);
        const names = (cols || []).map(c => c.name);
        const toAdd = [];
        if (!names.includes('application_id')) toAdd.push("application_id INTEGER");
        if (!names.includes('request_text')) toAdd.push("request_text TEXT");
        if (!names.includes('response_text')) toAdd.push("response_text TEXT");
        if (!names.includes('created_at')) toAdd.push("created_at DATETIME DEFAULT (datetime('now'))");
        if (!names.includes('updated_at')) toAdd.push("updated_at DATETIME DEFAULT (datetime('now'))");
        toAdd.forEach(colDef => {
            const colName = colDef.split(' ')[0];
            runAlterWithRetry(`ALTER TABLE application_requests ADD COLUMN ${colDef}`);
            console.log(`Ensured column ${colName} on application_requests`);
        });
    });

    // Seed a default admin user if none exists (development only)
    db.get("SELECT COUNT(*) as cnt FROM users", [], async (err, row) => {
        if (err) return console.error('Could not count users', err.message);
        if (row.cnt === 0) {
            const defaultEmail = process.env.ADMIN_EMAIL || '';
            const defaultPass = process.env.ADMIN_PASS || '';
            if (!defaultEmail || !defaultPass) return;
            const hash = await bcrypt.hash(defaultPass, 10);
            db.run(`INSERT INTO users (email, password_hash, role, status) VALUES (?, ?, ?, ?)`, [defaultEmail, hash, 'admin', 'active'], function(err) {
                if (err) console.error('Could not create default admin', err.message);
                else console.log('Created default admin:', defaultEmail);
            });
        }
    });
});

// 2. GET ROUTES: Retrieve data for the Frontend
app.get('/api/students', authenticateToken, (req, res) => {
    // Admin sees all students; student sees only their profile; company cannot list all students
    if (req.user.role === 'admin') {
        db.all("SELECT * FROM students", [], (err, rows) => {
            if (err) return res.status(500).json({ error: err.message });
            return res.json(rows);
        });
    } else if (req.user.role === 'student' && req.user.studentId) {
        db.get(`SELECT * FROM students WHERE id = ?`, [req.user.studentId], (err, row) => {
            if (err) return res.status(500).json({ error: err.message });
            if (!row) return res.status(404).json({ error: 'Not found' });
            return res.json([row]);
        });
    } else {
        return res.status(403).json({ error: 'Forbidden' });
    }
});

app.get('/api/companies', (req, res) => {
    // public listing of companies for students to browse
    db.all("SELECT id, name, industry, openings, location, overview, mission, vision FROM companies", [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

app.post('/api/admin/setup', async (req, res) => {
    const setupToken = (req.body.setup_token || '').toString().trim();
    const adminEmail = (req.body.email || '').toString().trim();
    const adminPass = (req.body.password || '').toString();
    const requiredToken = process.env.ADMIN_SETUP_TOKEN || '';
    if (!requiredToken || setupToken !== requiredToken) return res.status(403).json({ error: 'Forbidden' });
    if (!adminEmail || !adminPass) return res.status(400).json({ error: 'email and password required' });
    db.get(`SELECT COUNT(*) as cnt FROM users WHERE role = 'admin'`, [], async (err, row) => {
        if (err) return res.status(500).json({ error: err.message });
        if (row && row.cnt > 0) return res.status(409).json({ error: 'Admin already exists' });
        try {
            const hash = await bcrypt.hash(adminPass, 10);
            db.run(`INSERT INTO users (email, password_hash, role, status) VALUES (?, ?, ?, ?)`, [adminEmail, hash, 'admin', 'active'], function(err2) {
                if (err2) return res.status(500).json({ error: err2.message });
                res.json({ status: 'created' });
            });
        } catch (e) {
            res.status(500).json({ error: 'Could not create admin' });
        }
    });
});

app.get('/api/support-tickets', authenticateToken, (req, res) => {
    if (req.user.role === 'admin') {
        db.all(`SELECT * FROM support_tickets ORDER BY created_at DESC`, [], (err, rows) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json(rows || []);
        });
        return;
    }
    db.all(`SELECT * FROM support_tickets WHERE user_id = ? ORDER BY created_at DESC`, [req.user.userId], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows || []);
    });
});

app.post('/api/support-tickets', authenticateToken, (req, res) => {
    const subject = (req.body.subject || '').toString().trim();
    const message = (req.body.message || '').toString().trim();
    if (!subject || !message) return res.status(400).json({ error: 'subject and message required' });
    db.run(
        `INSERT INTO support_tickets (user_id, user_role, subject, message, status) VALUES (?, ?, ?, ?, 'open')`,
        [req.user.userId, req.user.role, subject, message],
        function(err) {
            if (err) return res.status(500).json({ error: err.message });
            db.get(`SELECT * FROM support_tickets WHERE id = ?`, [this.lastID], (err2, row) => {
                if (err2) return res.status(500).json({ error: err2.message });
                logAudit({ actorUserId: req.user.userId, actionType: 'support_create', entityType: 'support', entityId: row?.id || null, details: { subject } });
                res.json(row || {});
            });
        }
    );
});

app.patch('/api/support-tickets/:id/reply', authenticateToken, authorizeRole(['admin']), (req, res) => {
    const { id } = req.params;
    const reply = (req.body.reply || '').toString().trim();
    const status = (req.body.status || 'answered').toString().trim();
    if (!reply) return res.status(400).json({ error: 'reply required' });
    db.run(
        `UPDATE support_tickets SET admin_reply = ?, status = ?, updated_at = datetime('now') WHERE id = ?`,
        [reply, status || 'answered', id],
        function(err) {
            if (err) return res.status(500).json({ error: err.message });
            db.get(`SELECT * FROM support_tickets WHERE id = ?`, [id], (err2, row) => {
                if (err2) return res.status(500).json({ error: err2.message });
                logAudit({ actorUserId: req.user.userId, actionType: 'support_reply', entityType: 'support', entityId: Number(id), details: { status } });
                res.json(row || {});
            });
        }
    );
});

app.get('/api/member-companies', authenticateToken, authorizeRole(['student']), (req, res) => {
    const studentId = req.user.studentId;
    if (!studentId) return res.status(400).json({ error: 'Student profile not linked to account' });
        const sql = `SELECT c.id, c.name, c.industry, c.openings, c.location, c.overview, c.mission, c.vision,
                       CASE WHEN s.id IS NULL THEN 0 ELSE 1 END as subscribed
                FROM companies c
                LEFT JOIN student_company_subscriptions s
                  ON s.company_id = c.id AND s.student_id = ?
                ORDER BY c.name`;
    db.all(sql, [studentId], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows || []);
    });
});

app.get('/api/subscriptions', authenticateToken, authorizeRole(['student']), (req, res) => {
    const studentId = req.user.studentId;
    if (!studentId) return res.status(400).json({ error: 'Student profile not linked to account' });
    db.all(`SELECT company_id FROM student_company_subscriptions WHERE student_id = ?`, [studentId], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows || []);
    });
});

app.post('/api/subscriptions', authenticateToken, authorizeRole(['student']), (req, res) => {
    const studentId = req.user.studentId;
    const { company_id } = req.body;
    if (!studentId) return res.status(400).json({ error: 'Student profile not linked to account' });
    if (!company_id) return res.status(400).json({ error: 'company_id required' });
    db.run(`INSERT OR IGNORE INTO student_company_subscriptions (student_id, company_id) VALUES (?, ?)`, [studentId, company_id], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        logAudit({ actorUserId: req.user.userId, actionType: 'subscription_add', entityType: 'subscription', entityId: null, details: { student_id: studentId, company_id } });
        res.json({ status: 'subscribed' });
    });
});

app.delete('/api/subscriptions/:companyId', authenticateToken, authorizeRole(['student']), (req, res) => {
    const studentId = req.user.studentId;
    const { companyId } = req.params;
    if (!studentId) return res.status(400).json({ error: 'Student profile not linked to account' });
    db.run(`DELETE FROM student_company_subscriptions WHERE student_id = ? AND company_id = ?`, [studentId, companyId], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        logAudit({ actorUserId: req.user.userId, actionType: 'subscription_remove', entityType: 'subscription', entityId: null, details: { student_id: studentId, company_id: companyId } });
        res.json({ status: 'unsubscribed' });
    });
});

app.get('/api/companies/:id/subscribers-count', authenticateToken, (req, res) => {
    const { id } = req.params;
    const allowed = req.user.role === 'admin' || (req.user.role === 'company' && req.user.companyId && req.user.companyId == id);
    if (!allowed) return res.status(403).json({ error: 'Forbidden' });
    db.get(`SELECT COUNT(*) as count FROM student_company_subscriptions WHERE company_id = ?`, [id], (err, row) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ count: row?.count || 0 });
    });
});

// Public openings list for students
app.get('/api/openings', authenticateToken, (req, res) => {
    const baseSql = `SELECT co.*, c.name as company_name, c.industry as company_industry, c.location as company_location,
                            c.overview as company_overview, c.mission as company_mission, c.vision as company_vision
                     FROM company_openings co
                     JOIN companies c ON c.id = co.company_id`;
    if (req.user.role === 'student') {
        if (!req.user.studentId) return res.status(400).json({ error: 'Student profile not linked to account' });
        const sql = `${baseSql}
                     JOIN student_company_subscriptions s ON s.company_id = co.company_id
                     WHERE s.student_id = ?
                     ORDER BY co.created_at DESC`;
        db.all(sql, [req.user.studentId], (err, rows) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json(rows || []);
        });
        return;
    }
    const sql = `${baseSql} ORDER BY co.created_at DESC`;
    db.all(sql, [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows || []);
    });
});

// Export applicants CSV for a company (admin or company owner)
app.get('/api/companies/:id/export', authenticateToken, (req, res) => {
    const { id } = req.params;
    if (req.user.role !== 'admin' && !(req.user.role === 'company' && req.user.companyId && req.user.companyId == id)) return res.status(403).json({ error: 'Forbidden' });
    const sql = `SELECT a.id as application_id, a.position, a.stage, a.created_at, s.id as student_id, s.full_name, s.major, s.email, s.phone FROM applications a JOIN students s ON a.student_id = s.id WHERE a.company_id = ?`;
    db.all(sql, [id], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        // build CSV
        const headers = ['application_id','position','stage','created_at','student_id','full_name','major','email','phone'];
        const csv = [headers.join(',')].concat((rows || []).map(r => headers.map(h => `"${(r[h]||'').toString().replace(/"/g,'""')}"`).join(','))).join('\n');
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename="company_${id}_applicants.csv"`);
        res.send(csv);
    });
});

// 3. AGGREGATION LOGIC: Calculate Dashboard Stats
app.get('/api/stats', (req, res) => {
    const query = `
        SELECT 
            COUNT(*) as total,
            SUM(CASE WHEN stage = 'Placed' THEN 1 ELSE 0 END) as placed
        FROM applications`;
    db.get(query, [], (err, row) => {
        if (err) return res.status(500).json({ error: err.message });
        const rate = row.total > 0 ? ((row.placed / row.total) * 100).toFixed(1) : 0;
        res.json({ total: row.total, placed: row.placed, rate });
    });
});

// 4. POST ROUTES: Add new data (Postman Replacement)
app.post('/api/students', authenticateToken, (req, res) => {
    const { full_name, major, gpa, age, university, phone, email } = req.body;
    const sql = `INSERT INTO students (full_name, major, gpa, age, university, phone, email) VALUES (?, ?, ?, ?, ?, ?, ?)`;
    // students create their own profile and get linked; admin can create any
    if (req.user.role === 'student' || req.user.role === 'admin') {
        db.run(sql, [full_name, major, gpa || null, age || null, university || null, phone || null, email || null], function(err) {
            if (err) return res.status(500).json({ error: err.message });
            const studentId = this.lastID;
            db.get(`SELECT * FROM students WHERE id = ?`, [studentId], (err3, studentRow) => {
                if (req.user.role === 'student') {
                    db.run(`UPDATE users SET student_id = ? WHERE id = ?`, [studentId, req.user.userId], function(err2) {
                        if (err2) console.error('Could not link student to user', err2.message);
                        logAudit({ actorUserId: req.user.userId, actionType: 'student_create', entityType: 'student', entityId: studentId, details: { full_name } });
                        res.json({ student: studentRow, status: "Success" });
                    });
                } else {
                    logAudit({ actorUserId: req.user.userId, actionType: 'student_create', entityType: 'student', entityId: studentId, details: { full_name } });
                    res.json({ student: studentRow, status: "Success" });
                }
            });
        });
    } else return res.status(403).json({ error: 'Forbidden' });
});

app.get('/api/students/:id', authenticateToken, (req, res) => {
    const { id } = req.params;
    db.get(`SELECT * FROM students WHERE id = ?`, [id], (err, row) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!row) return res.status(404).json({ error: 'Not found' });
        // allow admin, the student owner, or a company that has an application for this student
        if (req.user.role === 'admin' || (req.user.role === 'student' && req.user.studentId && req.user.studentId == id)) {
            return res.json(row);
        }
        if (req.user.role === 'company' && req.user.companyId) {
            db.get(`SELECT COUNT(*) as cnt FROM applications WHERE student_id = ? AND company_id = ?`, [id, req.user.companyId], (err2, r) => {
                if (err2) return res.status(500).json({ error: err2.message });
                if (r && r.cnt > 0) return res.json(row);
                return res.status(403).json({ error: 'Forbidden' });
            });
            return;
        }
        return res.status(403).json({ error: 'Forbidden' });
    });
});

app.put('/api/students/:id', authenticateToken, (req, res) => {
    const { id } = req.params;
    const { full_name, major, gpa, age, university, phone, email } = req.body;
    // allow only admin or owner student
    if (req.user.role !== 'admin' && req.user.studentId != id) return res.status(403).json({ error: 'Forbidden' });
    const sql = `UPDATE students SET full_name = ?, major = ?, gpa = ?, age = ?, university = ?, phone = ?, email = ? WHERE id = ?`;
    db.run(sql, [full_name, major, gpa, age || null, university || null, phone || null, email || null, id], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        logAudit({ actorUserId: req.user.userId, actionType: 'student_update', entityType: 'student', entityId: Number(id), details: { full_name, major, gpa, age, university, phone, email } });
        res.json({ status: 'updated' });
    });
});

app.delete('/api/students/:id', authenticateToken, authorizeRole(['admin']), (req, res) => {
    const { id } = req.params;
    db.run(`DELETE FROM students WHERE id = ?`, [id], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        logAudit({ actorUserId: req.user.userId, actionType: 'student_delete', entityType: 'student', entityId: Number(id), details: {} });
        res.json({ status: 'deleted' });
    });
});

app.post('/api/companies', authenticateToken, (req, res) => {
    const { name, industry, openings, location, contact_person, contact_email, contact_phone, overview, mission, vision } = req.body;
    const sql = `INSERT INTO companies (name, industry, openings, location, contact_person, contact_email, contact_phone, overview, mission, vision) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
    if (req.user.role === 'company' || req.user.role === 'admin') {
        db.run(sql, [name, industry, openings || 0, location || null, contact_person || null, contact_email || null, contact_phone || null, overview || null, mission || null, vision || null], function(err) {
            if (err) return res.status(500).json({ error: err.message });
            const companyId = this.lastID;
            db.get(`SELECT * FROM companies WHERE id = ?`, [companyId], (err3, companyRow) => {
                if (req.user.role === 'company') {
                    db.run(`UPDATE users SET company_id = ? WHERE id = ?`, [companyId, req.user.userId], function(err2) {
                        if (err2) console.error('Could not link company to user', err2.message);
                        logAudit({ actorUserId: req.user.userId, actionType: 'company_create', entityType: 'company', entityId: companyId, details: { name } });
                        res.json({ company: companyRow, status: "Success" });
                    });
                } else {
                    logAudit({ actorUserId: req.user.userId, actionType: 'company_create', entityType: 'company', entityId: companyId, details: { name } });
                    res.json({ company: companyRow, status: "Success" });
                }
            });
        });
    } else return res.status(403).json({ error: 'Forbidden' });
});

app.get('/api/companies/:id', (req, res) => {
    const { id } = req.params;
    db.get(`SELECT * FROM companies WHERE id = ?`, [id], (err, row) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!row) return res.status(404).json({ error: 'Not found' });
        res.json(row);
    });
});

app.get('/api/companies/:id/profile-picture', authenticateToken, (req, res) => {
    const { id } = req.params;
    const allow = req.user.role === 'admin' || (req.user.role === 'company' && req.user.companyId && req.user.companyId == id);
    if (!allow) return res.status(403).json({ error: 'Forbidden' });
    db.get(`SELECT profile_picture_blob as blob, profile_picture_name as name FROM companies WHERE id = ?`, [id], (err, row) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!row || !row.blob) return res.status(404).json({ error: 'Not found' });
        const filename = row.name || 'company_profile.bin';
        res.setHeader('Content-Type', 'application/octet-stream');
        res.setHeader('Content-Disposition', `attachment; filename="${filename.replace(/"/g, '')}"`);
        return res.end(row.blob);
    });
});

app.put('/api/companies/:id/profile-picture', authenticateToken, companyProfileUpload, (req, res) => {
    const { id } = req.params;
    const allow = req.user.role === 'admin' || (req.user.role === 'company' && req.user.companyId && req.user.companyId == id);
    if (!allow) return res.status(403).json({ error: 'Forbidden' });
    if (!req.file) return res.status(400).json({ error: 'profile_picture required' });
    const sql = `UPDATE companies SET profile_picture_name = ?, profile_picture_blob = ? WHERE id = ?`;
    db.run(sql, [req.file.originalname, req.file.buffer, id], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ status: 'updated' });
    });
});

// Company openings
app.get('/api/company-openings', authenticateToken, (req, res) => {
    const companyId = req.user.role === 'admin' ? (req.query.company_id || null) : req.user.companyId;
    if (!companyId) return res.status(403).json({ error: 'Forbidden' });
    db.all(`SELECT * FROM company_openings WHERE company_id = ? ORDER BY created_at DESC`, [companyId], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows || []);
    });
});

app.post('/api/company-openings', authenticateToken, (req, res) => {
    if (req.user.role !== 'company' && req.user.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });
    const companyId = req.user.role === 'admin' ? (req.body.company_id || null) : req.user.companyId;
    if (!companyId) return res.status(400).json({ error: 'company_id required' });
    const { department, role_title, expectations, slots, location, deadline } = req.body;
    if (!department || !expectations) return res.status(400).json({ error: 'department and expectations required' });
    const sql = `INSERT INTO company_openings (company_id, department, role_title, expectations, slots, location, deadline) VALUES (?, ?, ?, ?, ?, ?, ?)`;
    db.run(sql, [companyId, department, role_title || null, expectations, slots || null, location || null, deadline || null], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        db.get(`SELECT * FROM company_openings WHERE id = ?`, [this.lastID], (err2, row) => {
            if (err2) return res.status(500).json({ error: err2.message });
            logAudit({ actorUserId: req.user.userId, actionType: 'opening_create', entityType: 'opening', entityId: row.id, details: { company_id: companyId, department, role_title } });
            emitOpeningsChanged({ action: 'created', openingId: row.id, companyId });
            notifySubscribersForOpening(companyId, row);
            res.json(row);
        });
    });
});

app.delete('/api/company-openings/:id', authenticateToken, (req, res) => {
    const { id } = req.params;
    db.get(`SELECT * FROM company_openings WHERE id = ?`, [id], (err, row) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!row) return res.status(404).json({ error: 'Not found' });
        const allowed = req.user.role === 'admin' || (req.user.role === 'company' && req.user.companyId && req.user.companyId === row.company_id);
        if (!allowed) return res.status(403).json({ error: 'Forbidden' });
        db.run(`DELETE FROM company_openings WHERE id = ?`, [id], function(err2) {
            if (err2) return res.status(500).json({ error: err2.message });
            logAudit({ actorUserId: req.user.userId, actionType: 'opening_delete', entityType: 'opening', entityId: Number(id), details: { company_id: row.company_id } });
            res.json({ status: 'deleted' });
        });
    });
});

// Company interviews
app.get('/api/company-interviews', authenticateToken, (req, res) => {
    const companyId = req.user.role === 'admin' ? (req.query.company_id || null) : req.user.companyId;
    if (!companyId) return res.status(403).json({ error: 'Forbidden' });
    db.all(`SELECT * FROM company_interviews WHERE company_id = ?`, [companyId], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows || []);
    });
});

app.get('/api/my-interviews', authenticateToken, (req, res) => {
    if (req.user.role !== 'student' || !req.user.studentId) return res.status(403).json({ error: 'Forbidden' });
    const sql = `SELECT ci.*, a.id as application_id, a.company_id, a.department, a.position, c.name as company_name
                 FROM company_interviews ci
                 JOIN applications a ON a.id = ci.application_id
                 JOIN companies c ON c.id = a.company_id
                 WHERE a.student_id = ?`;
    db.all(sql, [req.user.studentId], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows || []);
    });
});

app.put('/api/company-interviews/:applicationId', authenticateToken, (req, res) => {
    const { applicationId } = req.params;
    if (req.user.role !== 'company' && req.user.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });
    db.get(`SELECT * FROM applications WHERE id = ?`, [applicationId], (err, appRow) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!appRow) return res.status(404).json({ error: 'Application not found' });
        const allowed = req.user.role === 'admin' || (req.user.role === 'company' && req.user.companyId && req.user.companyId === appRow.company_id);
        if (!allowed) return res.status(403).json({ error: 'Forbidden' });

        const companyId = appRow.company_id;
        const { interview_date, interview_time, mode, location } = req.body;
        db.get(`SELECT * FROM company_interviews WHERE application_id = ?`, [applicationId], (err2, row) => {
            if (err2) return res.status(500).json({ error: err2.message });
            if (row) {
                const sql = `UPDATE company_interviews SET interview_date = ?, interview_time = ?, mode = ?, location = ?, updated_at = datetime('now') WHERE application_id = ?`;
                db.run(sql, [interview_date || null, interview_time || null, mode || null, location || null, applicationId], function(err3) {
                    if (err3) return res.status(500).json({ error: err3.message });
                    db.get(`SELECT * FROM company_interviews WHERE application_id = ?`, [applicationId], (err4, updated) => {
                        if (err4) return res.status(500).json({ error: err4.message });
                        emitApplicationsChanged({ action: 'interview', applicationId });
                        res.json(updated);
                    });
                });
            } else {
                const sql = `INSERT INTO company_interviews (company_id, application_id, interview_date, interview_time, mode, location, updated_at) VALUES (?, ?, ?, ?, ?, ?, datetime('now'))`;
                db.run(sql, [companyId, applicationId, interview_date || null, interview_time || null, mode || null, location || null], function(err3) {
                    if (err3) return res.status(500).json({ error: err3.message });
                    db.get(`SELECT * FROM company_interviews WHERE application_id = ?`, [applicationId], (err4, created) => {
                        if (err4) return res.status(500).json({ error: err4.message });
                        emitApplicationsChanged({ action: 'interview', applicationId });
                        res.json(created);
                    });
                });
            }
        });
    });
});

// Application requests for additional details
app.get('/api/application-requests', authenticateToken, (req, res) => {
    let sql = `SELECT ar.*, a.id as application_id, a.company_id, a.student_id, c.name as company_name
               FROM application_requests ar
               JOIN applications a ON a.id = ar.application_id
               JOIN companies c ON c.id = a.company_id`;
    const params = [];
    if (req.user.role === 'student' && req.user.studentId) {
        sql += ` WHERE a.student_id = ?`;
        params.push(req.user.studentId);
    } else if (req.user.role === 'company' && req.user.companyId) {
        sql += ` WHERE a.company_id = ?`;
        params.push(req.user.companyId);
    }
    db.all(sql, params, (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows || []);
    });
});

app.post('/api/applications/:id/request', authenticateToken, (req, res) => {
    const { id } = req.params;
    const { request_text } = req.body;
    if (!request_text) return res.status(400).json({ error: 'request_text required' });
    if (req.user.role !== 'company' && req.user.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });
    db.get(`SELECT * FROM applications WHERE id = ?`, [id], (err, appRow) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!appRow) return res.status(404).json({ error: 'Not found' });
        const allowed = req.user.role === 'admin' || (req.user.role === 'company' && req.user.companyId && req.user.companyId === appRow.company_id);
        if (!allowed) return res.status(403).json({ error: 'Forbidden' });
        db.get(`SELECT * FROM application_requests WHERE application_id = ?`, [id], (err2, row) => {
            if (err2) return res.status(500).json({ error: err2.message });
            if (row) {
                const sql = `UPDATE application_requests SET request_text = ?, response_text = NULL, updated_at = datetime('now') WHERE application_id = ?`;
                db.run(sql, [request_text, id], function(err3) {
                    if (err3) return res.status(500).json({ error: err3.message });
                    emitApplicationsChanged({ action: 'request', applicationId: id });
                    res.json({ status: 'updated' });
                });
            } else {
                const sql = `INSERT INTO application_requests (application_id, request_text, response_text, updated_at) VALUES (?, ?, NULL, datetime('now'))`;
                db.run(sql, [id, request_text], function(err3) {
                    if (err3) return res.status(500).json({ error: err3.message });
                    emitApplicationsChanged({ action: 'request', applicationId: id });
                    res.json({ status: 'created' });
                });
            }
        });
    });
});

app.patch('/api/applications/:id/request-response', authenticateToken, (req, res) => {
    const { id } = req.params;
    const { response_text } = req.body;
    if (!response_text) return res.status(400).json({ error: 'response_text required' });
    if (req.user.role !== 'student' || !req.user.studentId) return res.status(403).json({ error: 'Forbidden' });
    db.get(`SELECT * FROM applications WHERE id = ?`, [id], (err, appRow) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!appRow) return res.status(404).json({ error: 'Not found' });
        if (appRow.student_id !== req.user.studentId) return res.status(403).json({ error: 'Forbidden' });
        db.get(`SELECT * FROM application_requests WHERE application_id = ?`, [id], (err2, row) => {
            if (err2) return res.status(500).json({ error: err2.message });
            if (!row) return res.status(404).json({ error: 'Request not found' });
            const sql = `UPDATE application_requests SET response_text = ?, updated_at = datetime('now') WHERE application_id = ?`;
            db.run(sql, [response_text, id], function(err3) {
                if (err3) return res.status(500).json({ error: err3.message });
                emitApplicationsChanged({ action: 'response', applicationId: id });
                res.json({ status: 'updated' });
            });
        });
    });
});

function hydrateProfileRow(row) {
    if (!row) return row;
    let skills = [];
    if (row.skills_json) {
        try { skills = JSON.parse(row.skills_json); } catch (e) { skills = []; }
    }
    const sanitized = { ...row, skills };
    delete sanitized.resume_blob;
    delete sanitized.cover_letter_blob;
    delete sanitized.recommendation_letters_blob;
    delete sanitized.transcript_blob;
    delete sanitized.id_blob;
    delete sanitized.certificates_blob;
    delete sanitized.profile_picture_blob;
    return sanitized;
}

app.get('/api/student-profile', authenticateToken, (req, res) => {
    const studentId = req.user.studentId;
    if (req.user.role === 'student') {
        if (!studentId) return res.status(404).json({ error: 'Not found' });
        db.get(`SELECT * FROM student_profiles_extended WHERE student_id = ?`, [studentId], (err, row) => {
            if (err) return res.status(500).json({ error: err.message });
            if (!row) return res.status(404).json({ error: 'Not found' });
            return res.json(hydrateProfileRow(row));
        });
        return;
    }

    const queryStudentId = req.query.student_id;
    if (req.user.role === 'admin' && queryStudentId) {
        db.get(`SELECT * FROM student_profiles_extended WHERE student_id = ?`, [queryStudentId], (err, row) => {
            if (err) return res.status(500).json({ error: err.message });
            if (!row) return res.status(404).json({ error: 'Not found' });
            return res.json(hydrateProfileRow(row));
        });
        return;
    }

    return res.status(403).json({ error: 'Forbidden' });
});

app.get('/api/student-profile/profile-picture', authenticateToken, authorizeRole(['student']), (req, res) => {
    const studentId = req.user.studentId;
    if (!studentId) return res.status(404).json({ error: 'Not found' });
    db.get(`SELECT profile_picture_blob, profile_picture_name FROM student_profiles_extended WHERE student_id = ?`, [studentId], (err, row) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!row || !row.profile_picture_blob) return res.status(404).json({ error: 'Not found' });
        const filename = row.profile_picture_name || 'profile_picture';
        res.setHeader('Content-Type', 'image/*');
        res.setHeader('Content-Disposition', `inline; filename="${filename.replace(/"/g, '')}"`);
        return res.end(row.profile_picture_blob);
    });
});

app.get('/api/student-profile/:studentId', authenticateToken, (req, res) => {
    const { studentId } = req.params;
    if (req.user.role === 'admin' || (req.user.role === 'student' && req.user.studentId == studentId)) {
        db.get(`SELECT * FROM student_profiles_extended WHERE student_id = ?`, [studentId], (err, row) => {
            if (err) return res.status(500).json({ error: err.message });
            if (!row) return res.status(404).json({ error: 'Not found' });
            return res.json(hydrateProfileRow(row));
        });
        return;
    }
    if (req.user.role === 'company' && req.user.companyId) {
        db.get(`SELECT COUNT(*) as cnt FROM applications WHERE student_id = ? AND company_id = ?`, [studentId, req.user.companyId], (err, row) => {
            if (err) return res.status(500).json({ error: err.message });
            if (!row || row.cnt === 0) return res.status(403).json({ error: 'Forbidden' });
            db.get(`SELECT * FROM student_profiles_extended WHERE student_id = ?`, [studentId], (err2, profileRow) => {
                if (err2) return res.status(500).json({ error: err2.message });
                if (!profileRow) return res.status(404).json({ error: 'Not found' });
                return res.json(hydrateProfileRow(profileRow));
            });
        });
        return;
    }
    return res.status(403).json({ error: 'Forbidden' });
});

app.get('/api/student-profile/:studentId/document/:docType', authenticateToken, (req, res) => {
    const { studentId, docType } = req.params;
    const allowedTypes = {
        resume: { blob: 'resume_blob', name: 'resume_name' },
        cover_letter: { blob: 'cover_letter_blob', name: 'cover_letter_name' },
        recommendation_letters: { blob: 'recommendation_letters_blob', name: 'recommendation_letters_name' },
        transcript: { blob: 'transcript_blob', name: 'transcript_name' },
        student_id: { blob: 'id_blob', name: 'id_name' },
        certificates: { blob: 'certificates_blob', name: 'certificates_name' },
        profile_picture: { blob: 'profile_picture_blob', name: 'profile_picture_name' }
    };
    const mapping = allowedTypes[docType];
    if (!mapping) return res.status(400).json({ error: 'Invalid document type' });

    const allowSelf = req.user.role === 'student' && req.user.studentId && req.user.studentId == studentId;
    const allowAdmin = req.user.role === 'admin';
    const allowCompany = req.user.role === 'company' && req.user.companyId;

    const fetchDoc = () => {
        const sql = `SELECT ${mapping.blob} as blob, ${mapping.name} as name FROM student_profiles_extended WHERE student_id = ?`;
        db.get(sql, [studentId], (err, row) => {
            if (err) return res.status(500).json({ error: err.message });
            if (!row || !row.blob) return res.status(404).json({ error: 'Not found' });
            const filename = row.name || `${docType}.bin`;
            res.setHeader('Content-Type', 'application/octet-stream');
            res.setHeader('Content-Disposition', `attachment; filename="${filename.replace(/"/g, '')}"`);
            return res.end(row.blob);
        });
    };

    if (allowAdmin || allowSelf) {
        return fetchDoc();
    }

    if (allowCompany) {
        db.get(`SELECT COUNT(*) as cnt FROM applications WHERE student_id = ? AND company_id = ?`, [studentId, req.user.companyId], (err, row) => {
            if (err) return res.status(500).json({ error: err.message });
            if (!row || row.cnt === 0) return res.status(403).json({ error: 'Forbidden' });
            return fetchDoc();
        });
        return;
    }

    return res.status(403).json({ error: 'Forbidden' });
});

app.post('/api/student-profile', authenticateToken, authorizeRole(['student']), profileUploadFields, (req, res) => {
    let studentId = req.user.studentId;
    const createProfile = (finalStudentId) => {
        db.get(`SELECT * FROM student_profiles_extended WHERE student_id = ?`, [finalStudentId], (err, existing) => {
            if (err) return res.status(500).json({ error: err.message });
            if (existing) return res.status(409).json({ error: 'Profile already exists' });

            const resume = pickUploadedFile(req, 'resume');
            const cover = pickUploadedFile(req, 'cover_letter');
            const rec = pickUploadedFile(req, 'recommendation_letters');
            const transcript = pickUploadedFile(req, 'transcript');
            const idDoc = pickUploadedFile(req, 'student_id_doc');
            const certs = pickUploadedFile(req, 'certificates');
            const profilePicture = pickUploadedFile(req, 'profile_picture');
            const skillsJson = req.body.skills_json || null;

            const sql = `INSERT INTO student_profiles_extended (
                student_id, full_name, email_address, phone_number, gender, date_of_birth, nationality, country_city,
                school_name, degree_program, year_of_study, expected_grad_year, gpa_academic, skills_json,
                work_experience, volunteer_experience, research_projects, leadership_roles, publications_competitions,
                resume_name, resume_blob, cover_letter_name, cover_letter_blob, linkedin_url,
                recommendation_letters_name, recommendation_letters_blob, transcript_name, transcript_blob,
                id_name, id_blob, certificates_name, certificates_blob, profile_picture_name, profile_picture_blob, locked, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, datetime('now'))`;

            const params = [
                finalStudentId,
                req.body.full_name || null,
                req.body.email_address || null,
                req.body.phone_number || null,
                req.body.gender || null,
                req.body.date_of_birth || null,
                req.body.nationality || null,
                req.body.country_city || null,
                req.body.school_name || null,
                req.body.degree_program || null,
                req.body.year_of_study || null,
                req.body.expected_grad_year || null,
                req.body.gpa_academic || null,
                skillsJson,
                req.body.work_experience || null,
                req.body.volunteer_experience || null,
                req.body.research_projects || null,
                req.body.leadership_roles || null,
                req.body.publications_competitions || null,
                resume ? resume.name : null,
                resume ? resume.blob : null,
                cover ? cover.name : null,
                cover ? cover.blob : null,
                req.body.linkedin_url || null,
                rec ? rec.name : null,
                rec ? rec.blob : null,
                transcript ? transcript.name : null,
                transcript ? transcript.blob : null,
                idDoc ? idDoc.name : null,
                idDoc ? idDoc.blob : null,
                certs ? certs.name : null,
                certs ? certs.blob : null,
                profilePicture ? profilePicture.name : null,
                profilePicture ? profilePicture.blob : null
            ];

            db.run(sql, params, function(err2) {
                if (err2) return res.status(500).json({ error: err2.message });
                db.get(`SELECT * FROM student_profiles_extended WHERE student_id = ?`, [finalStudentId], (err3, row) => {
                    if (err3) return res.status(500).json({ error: err3.message });
                    const payload = hydrateProfileRow(row);
                    payload.student_id = finalStudentId;
                    logAudit({ actorUserId: req.user.userId, actionType: 'student_profile_create', entityType: 'student_profile', entityId: finalStudentId, details: {} });
                    return res.json(payload);
                });
            });
        });
    };

    if (!studentId) {
        const sql = `INSERT INTO students (full_name, major, gpa, university, phone, email) VALUES (?, ?, ?, ?, ?, ?)`;
        const params = [
            req.body.full_name || null,
            req.body.degree_program || null,
            req.body.gpa_academic || null,
            req.body.school_name || null,
            req.body.phone_number || null,
            req.body.email_address || null
        ];
        db.run(sql, params, function(err) {
            if (err) return res.status(500).json({ error: err.message });
            studentId = this.lastID;
            db.run(`UPDATE users SET student_id = ? WHERE id = ?`, [studentId, req.user.userId], function(err2) {
                if (err2) return res.status(500).json({ error: err2.message });
                createProfile(studentId);
            });
        });
        return;
    }

    createProfile(studentId);
});

app.put('/api/student-profile', authenticateToken, authorizeRole(['student']), profileUploadFields, (req, res) => {
    const studentId = req.user.studentId;
    if (!studentId) return res.status(400).json({ error: 'Student profile not linked to account' });
    db.get(`SELECT * FROM student_profiles_extended WHERE student_id = ?`, [studentId], (err, existing) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!existing) return res.status(404).json({ error: 'Not found' });
        if (existing.locked) return res.status(403).json({ error: 'Profile is locked' });

        const resume = pickUploadedFile(req, 'resume');
        const cover = pickUploadedFile(req, 'cover_letter');
        const rec = pickUploadedFile(req, 'recommendation_letters');
        const transcript = pickUploadedFile(req, 'transcript');
        const idDoc = pickUploadedFile(req, 'student_id_doc');
        const certs = pickUploadedFile(req, 'certificates');
        const profilePicture = pickUploadedFile(req, 'profile_picture');
        const skillsJson = req.body.skills_json || null;

        const sql = `UPDATE student_profiles_extended SET
            full_name = ?, email_address = ?, phone_number = ?, gender = ?, date_of_birth = ?, nationality = ?, country_city = ?,
            school_name = ?, degree_program = ?, year_of_study = ?, expected_grad_year = ?, gpa_academic = ?, skills_json = ?,
            work_experience = ?, volunteer_experience = ?, research_projects = ?, leadership_roles = ?, publications_competitions = ?,
            resume_name = ?, resume_blob = ?, cover_letter_name = ?, cover_letter_blob = ?, linkedin_url = ?,
            recommendation_letters_name = ?, recommendation_letters_blob = ?, transcript_name = ?, transcript_blob = ?,
            id_name = ?, id_blob = ?, certificates_name = ?, certificates_blob = ?, profile_picture_name = ?, profile_picture_blob = ?, locked = 1, updated_at = datetime('now')
            WHERE student_id = ?`;

        const params = [
            req.body.full_name || null,
            req.body.email_address || null,
            req.body.phone_number || null,
            req.body.gender || null,
            req.body.date_of_birth || null,
            req.body.nationality || null,
            req.body.country_city || null,
            req.body.school_name || null,
            req.body.degree_program || null,
            req.body.year_of_study || null,
            req.body.expected_grad_year || null,
            req.body.gpa_academic || null,
            skillsJson,
            req.body.work_experience || null,
            req.body.volunteer_experience || null,
            req.body.research_projects || null,
            req.body.leadership_roles || null,
            req.body.publications_competitions || null,
            resume ? resume.name : existing.resume_name,
            resume ? resume.blob : existing.resume_blob,
            cover ? cover.name : existing.cover_letter_name,
            cover ? cover.blob : existing.cover_letter_blob,
            req.body.linkedin_url || null,
            rec ? rec.name : existing.recommendation_letters_name,
            rec ? rec.blob : existing.recommendation_letters_blob,
            transcript ? transcript.name : existing.transcript_name,
            transcript ? transcript.blob : existing.transcript_blob,
            idDoc ? idDoc.name : existing.id_name,
            idDoc ? idDoc.blob : existing.id_blob,
            certs ? certs.name : existing.certificates_name,
            certs ? certs.blob : existing.certificates_blob,
            profilePicture ? profilePicture.name : existing.profile_picture_name,
            profilePicture ? profilePicture.blob : existing.profile_picture_blob,
            studentId
        ];

        db.run(sql, params, function(err2) {
            if (err2) return res.status(500).json({ error: err2.message });
            const syncSql = `UPDATE students SET full_name = ?, major = ?, gpa = ?, university = ?, phone = ?, email = ? WHERE id = ?`;
            const syncParams = [
                req.body.full_name || null,
                req.body.degree_program || null,
                req.body.gpa_academic || null,
                req.body.school_name || null,
                req.body.phone_number || null,
                req.body.email_address || null,
                studentId
            ];
            db.run(syncSql, syncParams, (syncErr) => {
                if (syncErr) console.error('Could not sync students table', syncErr.message);
            });
            db.get(`SELECT * FROM student_profiles_extended WHERE student_id = ?`, [studentId], (err3, row) => {
                if (err3) return res.status(500).json({ error: err3.message });
                logAudit({ actorUserId: req.user.userId, actionType: 'student_profile_update', entityType: 'student_profile', entityId: studentId, details: {} });
                return res.json(hydrateProfileRow(row));
            });
        });
    });
});

app.patch('/api/student-profile/lock', authenticateToken, authorizeRole(['student']), (req, res) => {
    const studentId = req.user.studentId;
    if (!studentId) return res.status(400).json({ error: 'Student profile not linked to account' });
    db.run(`UPDATE student_profiles_extended SET locked = 1, updated_at = datetime('now') WHERE student_id = ?`, [studentId], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        logAudit({ actorUserId: req.user.userId, actionType: 'student_profile_lock', entityType: 'student_profile', entityId: studentId, details: {} });
        res.json({ status: 'locked' });
    });
});

app.patch('/api/student-profile/unlock', authenticateToken, authorizeRole(['student']), (req, res) => {
    const studentId = req.user.studentId;
    if (!studentId) return res.status(400).json({ error: 'Student profile not linked to account' });
    db.run(`UPDATE student_profiles_extended SET locked = 0, updated_at = datetime('now') WHERE student_id = ?`, [studentId], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        logAudit({ actorUserId: req.user.userId, actionType: 'student_profile_unlock', entityType: 'student_profile', entityId: studentId, details: {} });
        res.json({ status: 'unlocked' });
    });
});

app.put('/api/companies/:id', authenticateToken, (req, res) => {
    const { id } = req.params;
    const { name, industry, openings, location, contact_person, contact_email, contact_phone, overview, mission, vision } = req.body;
    // allow admin or company owner to update
    if (req.user.role !== 'admin' && !(req.user.role === 'company' && req.user.companyId && req.user.companyId == id)) return res.status(403).json({ error: 'Forbidden' });
    const sql = `UPDATE companies SET name = ?, industry = ?, openings = ?, location = ?, contact_person = ?, contact_email = ?, contact_phone = ?, overview = ?, mission = ?, vision = ? WHERE id = ?`;
    db.run(sql, [name, industry, openings, location, contact_person, contact_email, contact_phone, overview || null, mission || null, vision || null, id], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        logAudit({ actorUserId: req.user.userId, actionType: 'company_update', entityType: 'company', entityId: Number(id), details: { name, industry, openings, location } });
        res.json({ status: 'updated' });
    });
});

app.delete('/api/companies/:id', authenticateToken, (req, res) => {
    const { id } = req.params;
    // allow admin or company owner
    if (req.user.role !== 'admin' && !(req.user.role === 'company' && req.user.companyId && req.user.companyId == id)) return res.status(403).json({ error: 'Forbidden' });
    db.run(`DELETE FROM companies WHERE id = ?`, [id], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        logAudit({ actorUserId: req.user.userId, actionType: 'company_delete', entityType: 'company', entityId: Number(id), details: {} });
        res.json({ status: 'deleted' });
    });
});

// --- Authentication routes ---
app.post('/api/auth/register', async (req, res) => {
    try {
        // accept multiple field names from varied clients
        const username = (req.body.username || req.body.login || req.body.identifier || '').toString().trim();
        const email = (req.body.email || req.body.login || req.body.identifier || '').toString().trim();
        const password = (req.body.password || '').toString();
        let role = (req.body.role || '').toString().trim();
        const student_id = req.body.student_id || null;
        const company_id = req.body.company_id || null;

        console.log('Register attempt payload:', { username, email, role, student_id, company_id });

        // default role to student if absent
        if (!role) role = 'student';
        // prevent creating admin accounts via public registration
        if (role === 'admin') return res.status(403).json({ error: 'Admin registration is disabled' });
        if ((!username && !email) || !password) return res.status(400).json({ error: 'username/email and password required' });

        getAppSetting('require_approval', '0', async (errSetting, value) => {
            if (errSetting) return res.status(500).json({ error: errSetting.message });
            const status = value === '1' ? 'pending' : 'active';
            const hash = await bcrypt.hash(password, 10);
            const sql = `INSERT INTO users (username, email, password_hash, role, student_id, company_id, status) VALUES (?, ?, ?, ?, ?, ?, ?)`;
            db.run(sql, [username || null, email || null, hash, role, student_id || null, company_id || null, status], function(err) {
                if (err) return res.status(500).json({ error: err.message });
                const userId = this.lastID;

                logAudit({ actorUserId: userId, actionType: 'register', entityType: 'user', entityId: userId, details: { role, status } });
                const user = { id: userId, username: username || null, email: email || null, role, status };
                const payload = { userId: userId, role: user.role, studentId: student_id || null, companyId: company_id || null };
                // fetch linked profile display name if possible
                if (student_id) {
                    db.get(`SELECT * FROM students WHERE id = ?`, [student_id], (err2, studentRow) => {
                        const displayName = studentRow ? studentRow.full_name : (username || email || 'User');
                        const token = jwt.sign({ ...payload }, JWT_SECRET, { expiresIn: '8h' });
                        res.json({ token, user: { ...payload, displayName, status } });
                    });
                } else if (company_id) {
                    db.get(`SELECT * FROM companies WHERE id = ?`, [company_id], (err3, companyRow) => {
                        const displayName = companyRow ? companyRow.name : (username || email || 'User');
                        const token = jwt.sign({ ...payload }, JWT_SECRET, { expiresIn: '8h' });
                        res.json({ token, user: { ...payload, displayName, status } });
                    });
                } else {
                    const displayName = username || email || 'User';
                    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '8h' });
                    res.json({ token, user: { ...payload, displayName, status } });
                }
            });
        });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/auth/login', (req, res) => {
    // accept multiple possible field names from clients
    const username = (req.body.username || req.body.login || req.body.identifier || '').toString().trim();
    const email = (req.body.email || req.body.login || req.body.identifier || '').toString().trim();
    const password = (req.body.password || '').toString();
    const adminOnly = Boolean(req.body.admin_only || req.body.adminOnly);
    if ((!username && !email) || !password) return res.status(400).json({ error: 'username/email and password required' });
    const sql = `SELECT * FROM users WHERE username = ? OR email = ?`;
    // prefer using provided username first, but allow email in either field
    db.get(sql, [username || email || null, email || username || null], async (err, user) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!user) {
            console.log('Login failed: user not found for', username || email);
            return res.status(401).json({ error: 'Invalid credentials' });
        }
        try {
            if (adminOnly && user.role !== 'admin') {
                return res.status(403).json({ error: 'Admin access only' });
            }
            if (!adminOnly && user.role === 'admin') {
                return res.status(403).json({ error: 'Please sign in from the admin portal' });
            }
            const match = await bcrypt.compare(password, user.password_hash || '');
            if (!match) {
                console.log('Login failed: wrong password for user', user.id);
                return res.status(401).json({ error: 'Invalid credentials' });
            }
            const status = (user.status || 'active').toString().toLowerCase();
            if (status !== 'active') {
                const message = status === 'pending' ? 'Account pending approval' : 'Account disabled';
                return res.status(403).json({ error: message });
            }
            const basePayload = { userId: user.id, role: user.role, studentId: user.student_id || null, companyId: user.company_id || null };
            // include friendly displayName from linked profile when available
            if (user.student_id) {
                db.get(`SELECT full_name FROM students WHERE id = ?`, [user.student_id], (err2, row) => {
                    const displayName = row ? row.full_name : (user.username || user.email || 'User');
                    const token = jwt.sign(basePayload, JWT_SECRET, { expiresIn: '8h' });
                    res.json({ token, user: { ...basePayload, displayName } });
                });
            } else if (user.company_id) {
                db.get(`SELECT name FROM companies WHERE id = ?`, [user.company_id], (err3, row) => {
                    const displayName = row ? row.name : (user.username || user.email || 'User');
                    const token = jwt.sign(basePayload, JWT_SECRET, { expiresIn: '8h' });
                    res.json({ token, user: { ...basePayload, displayName } });
                });
            } else {
                const displayName = user.username || user.email || 'User';
                const token = jwt.sign(basePayload, JWT_SECRET, { expiresIn: '8h' });
                res.json({ token, user: { ...basePayload, displayName } });
            }
        } catch (ex) {
            console.error('Login error', ex);
            res.status(500).json({ error: 'Login error' });
        }
    });
});

function createPasswordResetForEmail(email, options = {}) {
    const silentNotFound = options.silentNotFound !== false;
    return new Promise((resolve, reject) => {
        db.get(`SELECT id, email FROM users WHERE email = ?`, [email], (err, user) => {
            if (err) return reject(err);
            if (!user) {
                if (silentNotFound) return resolve(null);
                return reject(new Error('User not found'));
            }
            const rawToken = crypto.randomBytes(32).toString('hex');
            const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
            const expiresAt = new Date(Date.now() + 1000 * 60 * 30).toISOString();
            db.run(`INSERT INTO password_reset_tokens (user_id, token_hash, expires_at) VALUES (?, ?, ?)`, [user.id, tokenHash, expiresAt], function(err2) {
                if (err2) return reject(err2);
                const resetLink = `${RESET_BASE_URL}/?reset_token=${rawToken}`;
                resolve({ email: user.email, resetLink });
            });
        });
    });
}

function sendPasswordResetForEmail(email, res, options = {}) {
    const silentNotFound = options.silentNotFound !== false;
    const transporter = getMailTransporter();
    if (!transporter && RESET_EMAIL_MODE !== 'console') return res.status(500).json({ error: 'Email service not configured' });
    createPasswordResetForEmail(email, { silentNotFound })
        .then((payload) => {
            if (!payload) return res.json({ status: 'ok' });
            if (RESET_EMAIL_MODE === 'console') {
                console.log(`Password reset link for ${payload.email}: ${payload.resetLink}`);
                return res.json({ status: 'ok', reset_link: payload.resetLink });
            }
            const subject = 'Reset your InternConnect password';
            const text = `We received a request to reset your password.\n\nReset link: ${payload.resetLink}\n\nThis link expires in 30 minutes.`;
            transporter.sendMail({ from: SMTP_FROM, to: payload.email, subject, text })
                .then(() => res.json({ status: 'ok' }))
                .catch((mailErr) => res.status(500).json({ error: mailErr.message }));
        })
        .catch((err) => {
            if (err.message === 'User not found') return res.status(404).json({ error: 'User not found' });
            return res.status(500).json({ error: err.message });
        });
}

app.post('/api/auth/request-password-reset', (req, res) => {
    const email = (req.body.email || '').toString().trim();
    if (!email) return res.status(400).json({ error: 'email required' });
    return sendPasswordResetForEmail(email, res, { silentNotFound: true });
});

app.post('/api/admin/password-reset', authenticateToken, authorizeRole(['admin']), (req, res) => {
    const email = (req.body.email || '').toString().trim();
    if (!email) return res.status(400).json({ error: 'email required' });
    return sendPasswordResetForEmail(email, res, { silentNotFound: false });
});

app.get('/api/admin/users', authenticateToken, authorizeRole(['admin']), (req, res) => {
    db.all(`SELECT id, email, username, role, status, student_id, company_id FROM users ORDER BY id DESC`, [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows || []);
    });
});

app.patch('/api/admin/users/:id', authenticateToken, authorizeRole(['admin']), (req, res) => {
    const { id } = req.params;
    const { role, status, email, username } = req.body;
    const fields = [];
    const params = [];
    if (typeof role !== 'undefined') { fields.push('role = ?'); params.push(role); }
    if (typeof status !== 'undefined') { fields.push('status = ?'); params.push(status); }
    if (typeof email !== 'undefined') { fields.push('email = ?'); params.push(email || null); }
    if (typeof username !== 'undefined') { fields.push('username = ?'); params.push(username || null); }
    if (!fields.length) return res.status(400).json({ error: 'No updates provided' });

    const ensureAdminGuard = () => new Promise((resolve, reject) => {
        db.get(`SELECT role, status FROM users WHERE id = ?`, [id], (err, row) => {
            if (err) return reject(err);
            if (!row) return reject(new Error('User not found'));
            const wasAdmin = row.role === 'admin';
            const nextRole = typeof role !== 'undefined' ? role : row.role;
            const nextStatus = typeof status !== 'undefined' ? status : row.status;
            const removingAdmin = wasAdmin && (nextRole !== 'admin' || nextStatus !== 'active');
            if (!removingAdmin) return resolve();
            db.get(`SELECT COUNT(*) as cnt FROM users WHERE role = 'admin' AND status = 'active' AND id != ?`, [id], (err2, countRow) => {
                if (err2) return reject(err2);
                if (!countRow || countRow.cnt === 0) return reject(new Error('Cannot remove the last admin'));
                resolve();
            });
        });
    });

    ensureAdminGuard()
        .then(() => {
            params.push(id);
            const sql = `UPDATE users SET ${fields.join(', ')} WHERE id = ?`;
            db.run(sql, params, function(err) {
                if (err) return res.status(500).json({ error: err.message });
                logAudit({ actorUserId: req.user.userId, actionType: 'user_update', entityType: 'user', entityId: Number(id), details: { role, status, email, username } });
                res.json({ status: 'updated' });
            });
        })
        .catch((err) => res.status(409).json({ error: err.message }));
});

app.post('/api/admin/users/bulk', authenticateToken, authorizeRole(['admin']), (req, res) => {
    const { action, user_ids } = req.body;
    if (!Array.isArray(user_ids) || !user_ids.length) return res.status(400).json({ error: 'user_ids required' });
    const normalizedAction = (action || '').toString().trim();
    let nextStatus = null;
    if (normalizedAction === 'disable') nextStatus = 'disabled';
    if (normalizedAction === 'enable' || normalizedAction === 'approve') nextStatus = 'active';
    if (!nextStatus) return res.status(400).json({ error: 'Invalid action' });
    const placeholders = user_ids.map(() => '?').join(',');
    db.run(`UPDATE users SET status = ? WHERE id IN (${placeholders})`, [nextStatus, ...user_ids], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        logAudit({ actorUserId: req.user.userId, actionType: 'user_bulk_update', entityType: 'user', entityId: null, details: { action: normalizedAction, user_ids } });
        res.json({ status: 'updated', count: this.changes || 0 });
    });
});

app.post('/api/admin/users/bulk-reset', authenticateToken, authorizeRole(['admin']), (req, res) => {
    const { user_ids } = req.body;
    if (!Array.isArray(user_ids) || !user_ids.length) return res.status(400).json({ error: 'user_ids required' });
    const transporter = getMailTransporter();
    if (!transporter && RESET_EMAIL_MODE !== 'console') return res.status(500).json({ error: 'Email service not configured' });
    const placeholders = user_ids.map(() => '?').join(',');
    db.all(`SELECT email FROM users WHERE id IN (${placeholders}) AND email IS NOT NULL`, user_ids, async (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        const emails = (rows || []).map(r => r.email).filter(Boolean);
        const results = [];
        for (const email of emails) {
            try {
                const payload = await createPasswordResetForEmail(email, { silentNotFound: true });
                if (!payload) continue;
                if (RESET_EMAIL_MODE === 'console') {
                    console.log(`Password reset link for ${payload.email}: ${payload.resetLink}`);
                    results.push({ email: payload.email, reset_link: payload.resetLink });
                } else {
                    const subject = 'Reset your InternConnect password';
                    const text = `We received a request to reset your password.\n\nReset link: ${payload.resetLink}\n\nThis link expires in 30 minutes.`;
                    await transporter.sendMail({ from: SMTP_FROM, to: payload.email, subject, text });
                    results.push({ email: payload.email });
                }
            } catch (ex) {
                console.error('Bulk reset failed for', email, ex.message);
            }
        }
        logAudit({ actorUserId: req.user.userId, actionType: 'user_bulk_reset', entityType: 'user', entityId: null, details: { user_ids } });
        res.json({ status: 'ok', results });
    });
});

app.post('/api/admin/users/bulk-message', authenticateToken, authorizeRole(['admin']), (req, res) => {
    const { user_ids, subject, message } = req.body;
    if (!Array.isArray(user_ids) || !user_ids.length) return res.status(400).json({ error: 'user_ids required' });
    if (!subject || !message) return res.status(400).json({ error: 'subject and message required' });
    const transporter = getMailTransporter();
    if (!transporter && RESET_EMAIL_MODE !== 'console') return res.status(500).json({ error: 'Email service not configured' });
    const placeholders = user_ids.map(() => '?').join(',');
    db.all(`SELECT email FROM users WHERE id IN (${placeholders}) AND email IS NOT NULL`, user_ids, async (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        const recipients = (rows || []).map(r => r.email).filter(Boolean);
        if (!recipients.length) return res.status(400).json({ error: 'No recipient emails found' });
        if (RESET_EMAIL_MODE === 'console') {
            console.log(`Admin announcement to ${recipients.join(', ')}: ${subject}`);
            console.log(message);
            logAudit({ actorUserId: req.user.userId, actionType: 'user_bulk_message', entityType: 'user', entityId: null, details: { user_ids, subject } });
            return res.json({ status: 'ok' });
        }
        try {
            await transporter.sendMail({ from: SMTP_FROM, bcc: recipients, subject, text: message });
            logAudit({ actorUserId: req.user.userId, actionType: 'user_bulk_message', entityType: 'user', entityId: null, details: { user_ids, subject } });
            res.json({ status: 'ok' });
        } catch (ex) {
            res.status(500).json({ error: ex.message });
        }
    });
});

app.delete('/api/admin/users/:id', authenticateToken, authorizeRole(['admin']), (req, res) => {
    const userId = Number(req.params.id);
    if (!userId) return res.status(400).json({ error: 'Invalid user id' });

    const getAsync = (sql, params = []) => new Promise((resolve, reject) => {
        db.get(sql, params, (err, row) => (err ? reject(err) : resolve(row)));
    });
    const allAsync = (sql, params = []) => new Promise((resolve, reject) => {
        db.all(sql, params, (err, rows) => (err ? reject(err) : resolve(rows || [])));
    });
    const runAsync = (sql, params = []) => new Promise((resolve, reject) => {
        db.run(sql, params, function(err) {
            if (err) return reject(err);
            resolve(this.changes || 0);
        });
    });

    const deleteByAppIds = async (appIds) => {
        if (!appIds.length) return;
        const placeholders = appIds.map(() => '?').join(',');
        await runAsync(`DELETE FROM application_requests WHERE application_id IN (${placeholders})`, appIds);
        await runAsync(`DELETE FROM company_interviews WHERE application_id IN (${placeholders})`, appIds);
    };

    (async () => {
        try {
            const user = await getAsync(`SELECT * FROM users WHERE id = ?`, [userId]);
            if (!user) return res.status(404).json({ error: 'User not found' });

            if (user.role === 'admin') {
                const row = await getAsync(`SELECT COUNT(*) as cnt FROM users WHERE role = 'admin' AND status = 'active' AND id != ?`, [userId]);
                if (!row || row.cnt === 0) return res.status(409).json({ error: 'Cannot delete the last admin' });
            }

            if (user.student_id) {
                const apps = await allAsync(`SELECT id FROM applications WHERE student_id = ?`, [user.student_id]);
                const appIds = apps.map(app => app.id);
                await deleteByAppIds(appIds);
                await runAsync(`DELETE FROM applications WHERE student_id = ?`, [user.student_id]);
                await runAsync(`DELETE FROM student_company_subscriptions WHERE student_id = ?`, [user.student_id]);
                await runAsync(`DELETE FROM student_profiles_extended WHERE student_id = ?`, [user.student_id]);
                await runAsync(`DELETE FROM students WHERE id = ?`, [user.student_id]);
            }

            if (user.company_id) {
                const apps = await allAsync(`SELECT id FROM applications WHERE company_id = ?`, [user.company_id]);
                const appIds = apps.map(app => app.id);
                await deleteByAppIds(appIds);
                await runAsync(`DELETE FROM applications WHERE company_id = ?`, [user.company_id]);
                await runAsync(`DELETE FROM company_openings WHERE company_id = ?`, [user.company_id]);
                await runAsync(`DELETE FROM company_interviews WHERE company_id = ?`, [user.company_id]);
                await runAsync(`DELETE FROM student_company_subscriptions WHERE company_id = ?`, [user.company_id]);
                await runAsync(`DELETE FROM companies WHERE id = ?`, [user.company_id]);
            }

            await runAsync(`DELETE FROM support_tickets WHERE user_id = ?`, [userId]);
            await runAsync(`DELETE FROM users WHERE id = ?`, [userId]);

            logAudit({
                actorUserId: req.user.userId,
                actionType: 'user_delete',
                entityType: 'user',
                entityId: userId,
                details: { role: user.role, student_id: user.student_id || null, company_id: user.company_id || null }
            });

            res.json({ status: 'deleted' });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    })();
});

app.get('/api/admin/audit-logs', authenticateToken, authorizeRole(['admin']), (req, res) => {
    const { action_type, entity_type, limit = 200 } = req.query;
    const clauses = [];
    const params = [];
    if (action_type) { clauses.push('action_type = ?'); params.push(action_type); }
    if (entity_type) { clauses.push('entity_type = ?'); params.push(entity_type); }
    const whereSql = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
    db.all(`SELECT * FROM audit_logs ${whereSql} ORDER BY created_at DESC LIMIT ?`, [...params, Number(limit) || 200], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows || []);
    });
});

app.get('/api/admin/settings', authenticateToken, authorizeRole(['admin']), (req, res) => {
    db.all(`SELECT key, value FROM app_settings`, [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        const map = Object.fromEntries((rows || []).map(r => [r.key, r.value]));
        res.json({
            ...map,
            reset_email_mode: RESET_EMAIL_MODE,
            reset_base_url: RESET_BASE_URL,
            smtp_from: SMTP_FROM
        });
    });
});

app.put('/api/admin/settings', authenticateToken, authorizeRole(['admin']), (req, res) => {
    const allowedKeys = ['branding_name', 'branding_mission', 'branding_vision', 'contact_email', 'require_approval'];
    const entries = Object.entries(req.body || {}).filter(([key]) => allowedKeys.includes(key));
    if (!entries.length) return res.status(400).json({ error: 'No settings to update' });
    const updates = entries.map(([key, value]) => new Promise((resolve, reject) => {
        db.run(`INSERT INTO app_settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value`, [key, String(value)], (err) => {
            if (err) return reject(err);
            resolve();
        });
    }));
    Promise.all(updates)
        .then(() => {
            logAudit({ actorUserId: req.user.userId, actionType: 'settings_update', entityType: 'settings', entityId: null, details: Object.fromEntries(entries) });
            res.json({ status: 'updated' });
        })
        .catch((err) => res.status(500).json({ error: err.message }));
});

app.get('/api/admin/subscriptions', authenticateToken, authorizeRole(['admin']), (req, res) => {
    const sql = `SELECT c.id as company_id, c.name, COUNT(s.id) as subscriber_count
                 FROM companies c
                 LEFT JOIN student_company_subscriptions s ON s.company_id = c.id
                 GROUP BY c.id
                 ORDER BY subscriber_count DESC`;
    db.all(sql, [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows || []);
    });
});

app.get('/api/admin/export-stats', authenticateToken, authorizeRole(['admin']), (req, res) => {
    const today = new Date().toISOString().split('T')[0];
    const sql = `
        SELECT 
            s.full_name,
            s.email,
            s.university,
            s.major,
            c.name as company_name,
            a.position,
            a.department,
            a.stage,
            strftime('%Y-%m-%d', a.created_at) as application_date
        FROM applications a
        JOIN students s ON a.student_id = s.id
        JOIN companies c ON a.company_id = c.id
        WHERE a.stage IN ('Placed', 'Rejected')
        ORDER BY a.created_at DESC
    `;

    db.all(sql, [], (err, rows) => {
        if (err) {
            console.error('Export error:', err);
            return res.status(500).json({ error: 'Failed to generate report' });
        }

        let csv = `Student Name,Email,University,Major,Company,Position,Department,Stage,Application Date\n`;
        
        rows.forEach(r => {
            const row = [
                r.full_name || '',
                r.email || '',
                r.university || '',
                r.major || '',
                r.company_name || '',
                r.position || '',
                r.department || '',
                r.stage || '',
                r.application_date || ''
            ].map(field => `"${String(field).replace(/"/g, '""')}"`).join(',');
            csv += row + '\n';
        });

        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename="all_applications_${today}.csv"`);
        res.send(csv);
    });
});

app.get('/api/company/export-stats', authenticateToken, authorizeRole(['company']), (req, res) => {
    const companyId = req.user.companyId;
    const today = new Date().toISOString().split('T')[0];
    
    // Single detailed query for everything "Placed" (Accepted) 
    const sql = `
        SELECT 
            s.full_name,
            s.email,
            s.university,
            s.major,
            a.position,
            a.department,
            a.stage,
            strftime('%Y', a.created_at) as year,
            strftime('%Y-%m-%d', a.created_at) as application_date
        FROM applications a
        JOIN students s ON a.student_id = s.id
        WHERE a.company_id = ? AND a.stage = 'Placed'
        ORDER BY a.created_at DESC
    `;

    db.all(sql, [companyId], (err, rows) => {
        if (err) {
            console.error('Company export error:', err);
            return res.status(500).json({ error: 'Failed to generate report' });
        }

        let csv = `Student Name,Email,University,Major,Position,Department,Stage,Application Date,Year\n`;
        
        rows.forEach(r => {
            const row = [
                r.full_name || '',
                r.email || '',
                r.university || '',
                r.major || '',
                r.position || '',
                r.department || '',
                r.stage || '',
                r.application_date || '',
                r.year || ''
            ].map(field => `"${String(field).replace(/"/g, '""')}"`).join(',');
            csv += row + '\n';
        });

        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename="company_interns_list_${today}.csv"`);
        res.send(csv);
    });
});


app.post('/api/auth/reset-password', async (req, res) => {
    const token = (req.body.token || '').toString().trim();
    const password = (req.body.password || '').toString();
    if (!token || !password) return res.status(400).json({ error: 'token and password required' });
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    db.get(`SELECT * FROM password_reset_tokens WHERE token_hash = ? AND used_at IS NULL`, [tokenHash], async (err, row) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!row) return res.status(400).json({ error: 'Invalid or expired token' });
        const expires = new Date(row.expires_at || 0).getTime();
        if (!expires || Date.now() > expires) return res.status(400).json({ error: 'Invalid or expired token' });
        try {
            const hash = await bcrypt.hash(password, 10);
            db.run(`UPDATE users SET password_hash = ? WHERE id = ?`, [hash, row.user_id], function(err2) {
                if (err2) return res.status(500).json({ error: err2.message });
                db.run(`UPDATE password_reset_tokens SET used_at = datetime('now') WHERE id = ?`, [row.id]);
                res.json({ status: 'updated' });
            });
        } catch (e) {
            res.status(500).json({ error: 'Could not reset password' });
        }
    });
});

app.patch('/api/account', authenticateToken, async (req, res) => {
    try {
        const username = (req.body.username || '').toString().trim();
        const password = (req.body.password || '').toString();
        if (!username && !password) return res.status(400).json({ error: 'username or password required' });
        const fields = [];
        const params = [];

        if (username) {
            db.get(`SELECT id FROM users WHERE username = ? AND id != ?`, [username, req.user.userId], async (err, row) => {
                if (err) return res.status(500).json({ error: err.message });
                if (row) return res.status(409).json({ error: 'Username already taken' });

                if (username) {
                    fields.push('username = ?');
                    params.push(username);
                }
                if (password) {
                    const hash = await bcrypt.hash(password, 10);
                    fields.push('password_hash = ?');
                    params.push(hash);
                }
                if (!fields.length) return res.status(400).json({ error: 'No updates provided' });
                params.push(req.user.userId);
                const sql = `UPDATE users SET ${fields.join(', ')} WHERE id = ?`;
                db.run(sql, params, function(err2) {
                    if (err2) return res.status(500).json({ error: err2.message });
                    logAudit({ actorUserId: req.user.userId, actionType: 'account_update', entityType: 'user', entityId: req.user.userId, details: { username: username || null } });
                    res.json({ status: 'updated', user: { userId: req.user.userId, username } });
                });
            });
            return;
        }

        if (password) {
            const hash = await bcrypt.hash(password, 10);
            fields.push('password_hash = ?');
            params.push(hash);
        }
        params.push(req.user.userId);
        const sql = `UPDATE users SET ${fields.join(', ')} WHERE id = ?`;
        db.run(sql, params, function(err2) {
            if (err2) return res.status(500).json({ error: err2.message });
            logAudit({ actorUserId: req.user.userId, actionType: 'account_update', entityType: 'user', entityId: req.user.userId, details: { password: password ? 'changed' : null } });
            res.json({ status: 'updated', user: { userId: req.user.userId, username: null } });
        });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// Middleware to protect routes
function authenticateToken(req, res, next) {
    const auth = req.headers['authorization'];
    if (!auth) return res.status(401).json({ error: 'Missing token' });
    const parts = auth.split(' ');
    if (parts.length !== 2) return res.status(401).json({ error: 'Invalid token format' });
    const token = parts[1];
    jwt.verify(token, JWT_SECRET, (err, decoded) => {
        if (err) return res.status(403).json({ error: 'Invalid token' });
        if (!decoded || !decoded.userId) return res.status(403).json({ error: 'Invalid token' });
        if (decoded.studentId || decoded.companyId) {
            req.user = decoded;
            return next();
        }
        db.get(`SELECT role, student_id, company_id FROM users WHERE id = ?`, [decoded.userId], (err2, row) => {
            if (err2) return res.status(500).json({ error: err2.message });
            req.user = {
                ...decoded,
                role: row?.role || decoded.role,
                studentId: row?.student_id || decoded.studentId || null,
                companyId: row?.company_id || decoded.companyId || null
            };
            next();
        });
    });
}

function authorizeRole(allowed = []) {
    return (req, res, next) => {
        if (!req.user) return res.status(401).json({ error: 'Not authenticated' });
        if (allowed.length && !allowed.includes(req.user.role)) return res.status(403).json({ error: 'Forbidden' });
        next();
    };
}

// Applications endpoints with authorization
app.get('/api/applications', authenticateToken, (req, res) => {
    // students see only their applications; admins see all; companies see company-specific
    let sql = `SELECT a.*, s.full_name as student_name, c.name as company_name
               FROM applications a
               LEFT JOIN students s ON s.id = a.student_id
               LEFT JOIN companies c ON c.id = a.company_id`;
    const params = [];
    if (req.user.role === 'student' && req.user.studentId) {
        sql += ` WHERE a.student_id = ?`;
        params.push(req.user.studentId);
    } else if (req.user.role === 'company' && req.user.companyId) {
        sql += ` WHERE a.company_id = ? AND a.stage != 'Withdrawn'`;
        params.push(req.user.companyId);
    }
    db.all(sql, params, (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

app.post('/api/applications', authenticateToken, authorizeRole(['student']), (req, res) => {
    const { company_id, position, department, why_internship, skills_fit, career_goals, relevant_experience } = req.body;
    const student_id = req.user.studentId;
    if (!student_id) return res.status(400).json({ error: 'Student profile not linked to account' });
    if (!company_id) return res.status(400).json({ error: 'company_id required' });
    const sql = `INSERT INTO applications (
        student_id, company_id, position, department, why_internship, skills_fit, career_goals, relevant_experience, stage
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`;
    db.get(`SELECT 1 FROM student_company_subscriptions WHERE student_id = ? AND company_id = ?`, [student_id, company_id], (err, row) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!row) return res.status(403).json({ error: 'Subscribe to this company before applying' });
        db.get(`SELECT 1 FROM applications WHERE student_id = ? AND company_id = ? AND stage = 'Rejected'`, [student_id, company_id], (err2, rejectedRow) => {
            if (err2) return res.status(500).json({ error: err2.message });
            if (rejectedRow) return res.status(403).json({ error: 'You cannot reapply to this company in the current cycle after a rejection.' });
            db.run(sql, [
                student_id,
                company_id,
                position || department || '',
                department || null,
                why_internship || null,
                skills_fit || null,
                career_goals || null,
                relevant_experience || null,
                'Applied'
            ], function(err3) {
                if (err3) return res.status(500).json({ error: err3.message });
                const insertedId = this.lastID;
                db.get(`SELECT * FROM applications WHERE id = ?`, [insertedId], (err4, row2) => {
                    if (!err4 && row2) emitApplicationsChanged({ action: 'created', application: row2 });
                    res.json({ id: insertedId, status: 'applied' });
                });
            });
        });
    });
});
app.patch('/api/applications/:id/status', authenticateToken, (req, res) => {
    const { id } = req.params;
    const { stage } = req.body;
    if (!stage) return res.status(400).json({ error: 'stage required' });
    db.get(`SELECT * FROM applications WHERE id = ?`, [id], (err, row) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!row) return res.status(404).json({ error: 'Not found' });
        const allowed = (req.user.role === 'admin') ||
            (req.user.role === 'company' && req.user.companyId && req.user.companyId === row.company_id) ||
            (req.user.role === 'student' && req.user.studentId && req.user.studentId === row.student_id);
        if (!allowed) return res.status(403).json({ error: 'Forbidden' });
        const sql = `UPDATE applications SET stage = ? WHERE id = ?`;
        db.run(sql, [stage, id], function(err2) {
            if (err2) return res.status(500).json({ error: err2.message });
            db.get(`SELECT * FROM applications WHERE id = ?`, [id], (err3, updated) => {
                if (!err3 && updated) {
                    logAudit({ actorUserId: req.user.userId, actionType: 'application_stage', entityType: 'application', entityId: Number(id), details: { stage } });
                    emitApplicationsChanged({ action: 'updated', application: updated });
                    
                    // Send SMS notification
                    db.get(`SELECT phone FROM students WHERE id = ?`, [updated.student_id], (err4, studentRow) => {
                       if (!err4 && studentRow && studentRow.phone) {
                           const msg = `Your internship application status has been updated to: ${stage}. Check your dashboard for details.`;
                           sendSMS(studentRow.phone, msg);
                       }
                    });
                }
                res.json({ status: 'updated' });
            });
        });
    });
});

app.put('/api/applications/:id', authenticateToken, authorizeRole(['admin']), (req, res) => {
    const { id } = req.params;
    const {
        student_id,
        company_id,
        position,
        department,
        why_internship,
        skills_fit,
        career_goals,
        relevant_experience,
        stage,
        notes
    } = req.body;
    const sql = `UPDATE applications SET
        student_id = ?,
        company_id = ?,
        position = ?,
        department = ?,
        why_internship = ?,
        skills_fit = ?,
        career_goals = ?,
        relevant_experience = ?,
        stage = ?,
        notes = ?
        WHERE id = ?`;
    db.run(sql, [
        student_id || null,
        company_id || null,
        position || null,
        department || null,
        why_internship || null,
        skills_fit || null,
        career_goals || null,
        relevant_experience || null,
        stage || 'Applied',
        notes || null,
        id
    ], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        db.get(`SELECT * FROM applications WHERE id = ?`, [id], (err2, row) => {
            if (err2) return res.status(500).json({ error: err2.message });
                logAudit({ actorUserId: req.user.userId, actionType: 'application_update', entityType: 'application', entityId: Number(id), details: { student_id, company_id, stage } });
            res.json(row || {});
        });
    });
});

// Update application (partial) - notes, position, etc. Allows student/company/admin to add notes
app.patch('/api/applications/:id', authenticateToken, (req, res) => {
    const { id } = req.params;
    const { notes, position, department, why_internship, skills_fit, career_goals, relevant_experience } = req.body;
    db.get(`SELECT * FROM applications WHERE id = ?`, [id], (err, row) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!row) return res.status(404).json({ error: 'Not found' });
        // authorization: admin can edit any, student can edit own, company can edit apps for their company
        const allowed = (req.user.role === 'admin') || (req.user.role === 'student' && req.user.studentId && req.user.studentId === row.student_id) || (req.user.role === 'company' && req.user.companyId && req.user.companyId === row.company_id);
        if (!allowed) return res.status(403).json({ error: 'Forbidden' });
        const fields = [];
        const params = [];
        if (typeof notes !== 'undefined') { fields.push('notes = ?'); params.push(notes || null); }
        if (typeof position !== 'undefined') { fields.push('position = ?'); params.push(position || null); }
        if (typeof department !== 'undefined') { fields.push('department = ?'); params.push(department || null); }
        if (typeof why_internship !== 'undefined') { fields.push('why_internship = ?'); params.push(why_internship || null); }
        if (typeof skills_fit !== 'undefined') { fields.push('skills_fit = ?'); params.push(skills_fit || null); }
        if (typeof career_goals !== 'undefined') { fields.push('career_goals = ?'); params.push(career_goals || null); }
        if (typeof relevant_experience !== 'undefined') { fields.push('relevant_experience = ?'); params.push(relevant_experience || null); }
        if (!fields.length) return res.status(400).json({ error: 'No fields to update' });
        params.push(id);
        const sql = `UPDATE applications SET ${fields.join(', ')} WHERE id = ?`;
        db.run(sql, params, function(err2) {
            if (err2) return res.status(500).json({ error: err2.message });
            db.get(`SELECT * FROM applications WHERE id = ?`, [id], (err3, updated) => {
                if (!err3 && updated) {
                    logAudit({ actorUserId: req.user.userId, actionType: 'application_edit', entityType: 'application', entityId: Number(id), details: {} });
                    emitApplicationsChanged({ action: 'updated', application: updated });
                }
                res.json({ status: 'updated' });
            });
        });
    });
});

// 5. DELETE ROUTES: Data Management
app.delete('/api/:type/:id', (req, res) => {
    const { type, id } = req.params;
    const table = type === 'students' ? 'students' : 'companies';
    db.run(`DELETE FROM ${table} WHERE id = ?`, [id], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ status: "Deleted" });
    });
});

const PORT = process.env.PORT || 5000;
// create http server and attach socket.io
const server = http.createServer(app);
io = new Server(server, { cors: { origin: '*' } });

io.on('connection', (socket) => {
    console.log('Client connected to sockets:', socket.id);
    socket.on('disconnect', () => console.log('Socket disconnected', socket.id));
});

// helper to emit application changes
function emitApplicationsChanged(payload) {
    io.emit('applications:changed', payload);
}

function emitOpeningsChanged(payload) {
    io.emit('openings:changed', payload);
}

// Deadline Reminders
function checkDeadlinesAndNotify() {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const dateStr = tomorrow.toISOString().split('T')[0]; // YYYY-MM-DD
    
    // Find openings closing tomorrow
    db.all(`SELECT * FROM company_openings WHERE deadline LIKE ?`, [`${dateStr}%`], (err, openings) => {
        if (err || !openings || openings.length === 0) return;
        
        openings.forEach(opening => {
            // Notify subscribed students
            // You could also notify specific applicants who haven't finished, etc.
            db.all(`SELECT s.phone FROM students s 
                    JOIN student_company_subscriptions sub ON s.id = sub.student_id 
                    WHERE sub.company_id = ? AND s.phone IS NOT NULL`, [opening.company_id], (err2, subscribers) => {
                if (err2 || !subscribers) return;
                
                const msg = `Reminder: Application deadline for ${opening.role_title} at ${opening.department} is tomorrow (${dateStr})! Don't miss out.`;
                subscribers.forEach(sub => {
                    if (sub.phone) sendSMS(sub.phone, msg);
                });
            });
        });
    });
}

// Check every hour (approx)
setInterval(checkDeadlinesAndNotify, 60 * 60 * 1000);
// Check once on startup after a delay
setTimeout(checkDeadlinesAndNotify, 5000);

// Client-side routing: Serve index.html for any unknown route
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'internship-frontend/build', 'index.html'));
});

server.listen(PORT, () => console.log(`Backend Engine running on port ${PORT}`));
