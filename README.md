# InternConnect - Internship Management Platform

InternConnect is a comprehensive web application that connects students with internship opportunities and helps companies manage their hiring pipeline efficiently.

## What It Does

InternConnect provides a complete internship management solution with:
- **Student Portal**: Browse and apply to internships, track applications, build profiles
- **Company Portal**: Post openings, manage applications, track hiring progress
- **Admin Dashboard**: System-wide analytics and user management
- **Real-time Updates**: Live application status tracking for all users

## Problem It Solves

**For Students:**
- Scattered internship listings across multiple platforms
- No centralized tracking of application status
- Delayed or missing feedback from companies
- Manual follow-ups and status checks

**For Companies:**
- Overwhelming volume of applications to organize
- Difficulty coordinating between hiring team members
- Lack of visibility into hiring pipeline stages
- Manual status updates and candidate communication

InternConnect solves these by providing a unified platform where students can easily find and track opportunities, while companies can efficiently manage their entire hiring workflow.

---

## How to Run

### Step 1 — Install dependencies (first time only)

```bash
npm install
npm --prefix internship-frontend install
```

---

### Step 2 — Start the servers

**Option A: Two separate terminals (recommended)**

Open two terminals side by side.

**Terminal 1 — Backend:**
```bash
npm run dev
```

**Terminal 2 — Frontend:**
```bash
npm --prefix internship-frontend start
```

**Option B: One terminal (both at once)**
```bash
npm run start:all
```

Press `Ctrl+C` to stop everything.

---

### Step 3 — Open the app

- **Laptop / local:** open `http://localhost:3000`
- **GitHub Codespaces:** click the **Ports** tab in VS Code → click the globe icon next to port **3000**

> In Codespaces, only port 3000 needs to be open. API calls are automatically proxied from port 3000 to the backend on port 5000 — no extra config needed.

---

### GitHub Codespaces — Automatic Setup

When you open this repository in a **GitHub Codespace**, everything starts automatically — no manual steps required.

| What happens | When |
|---|---|
| `npm install` + frontend dependencies installed | On container creation (`postCreateCommand`) |
| Backend (port 5000) + Frontend (port 3000) launched | Every time the Codespace opens (`postStartCommand`) |
| Ports 3000 & 5000 forwarded automatically | On startup |
| Browser opens to the frontend | On startup |

**Logs** (if something goes wrong):
```bash
tail -f /tmp/backend.log    # backend output
tail -f /tmp/frontend.log   # frontend output
```

The configuration lives in `.devcontainer/devcontainer.json` and `.devcontainer/start-services.sh`.

---

### Environment variables (optional / production)

Create a `.env` file in the project root:

```
JWT_SECRET=some_long_random_string
PORT=5000
```

Email and SMS (optional):
```
SMTP_HOST=
SMTP_PORT=587
SMTP_USER=
SMTP_PASS=
SMTP_FROM=
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_PHONE_NUMBER=
```

---

### Database

Uses SQLite — no setup needed. The database file is created automatically on first run.

---

## Student Guide

### Getting Started
1. Visit the application and click "First Time User"
2. Register as a Student with your email and password
3. Complete your profile with education, skills, and preferences

### Dashboard Tab
- **Overview**: See your application statistics and recent activity
- **Quick Actions**: Apply to recommended internships, update profile
- **Notifications**: View important updates about your applications

### Profile Tab
- **Personal Information**: Update contact details and basic info
- **Education**: Add schools, degrees, GPA, and graduation dates
- **Skills & Experience**: List technical skills, projects, and work experience
- **Resume Upload**: Upload your resume/CV for applications
- **Preferences**: Set location preferences, salary expectations, and job types

### Openings Tab
- **Browse Internships**: Search and filter available positions
- **Filters**: Location, company, salary range, job type, skills required
- **Job Details**: View full job descriptions, requirements, and company info
- **Save for Later**: Bookmark interesting opportunities
- **Apply**: Submit applications directly through the platform

### Applications Tab
- **Application History**: View all your submitted applications
- **Status Tracking**: See current stage (Applied, Screening, Interview, Offer, etc.)
- **Company Communication**: View messages and updates from companies
- **Withdraw Applications**: Remove applications if you change your mind

---

## Company Guide

### Getting Started
1. Register as a Company with your email and password
2. Complete your company profile with business information
3. Start posting internship openings

### Dashboard Tab
- **Overview Metrics**: Total applications, active openings, hiring progress
- **Recent Activity**: New applications, upcoming interviews, recent hires
- **Quick Stats**: Application volume, conversion rates, time-to-hire

### Profile Tab
- **Company Information**: Business details, industry, company size
- **Contact Information**: Hiring manager details and contact methods
- **Company Description**: About your company and culture
- **Logo & Branding**: Upload company logo and set branding preferences

### Openings Tab
- **Create New Opening**: Post new internship positions
- **Job Details**: Title, description, requirements, salary, location
- **Application Settings**: Application deadlines, required documents
- **Edit Existing**: Modify active job postings
- **Close/Open Positions**: Control application acceptance

### Applications Tab (Kanban Pipeline)
- **Applied**: New applications awaiting review
- **Screening**: Initial candidate evaluation
- **Interview**: Scheduled and completed interviews
- **Offer**: Extended job offers
- **Hired**: Successfully placed candidates
- **Rejected**: Unsuccessful applications

**Pipeline Features:**
- Drag and drop applications between stages
- Add notes and feedback for each candidate
- Schedule interviews and track outcomes
- Send automated status updates to candidates
- Export candidate data for record keeping

### Analytics Tab
- **Hiring Metrics**: Success rates, time-to-hire, application volume
- **Candidate Insights**: Popular skills, education levels, locations
- **Pipeline Efficiency**: Bottlenecks and optimization opportunities
- **Custom Reports**: Generate CSV/PDF reports for management

---

## Recent Changes

| What | Why |
|---|---|
| Added `"proxy"` to frontend `package.json` | Fixes "Network Error" in Codespaces — API calls route through port 3000 internally |
| Removed hardcoded `:5000` from frontend API URLs | App works on both laptop and Codespaces without changing any code |
| Added `compression` middleware | All API responses are gzip compressed — 50–80% smaller payloads |
| Added 13 SQLite indexes | Faster queries on applications, users, subscriptions, audit logs |
| Removed BLOBs from `/api/companies` responses | Company list no longer sends MB of image data in every JSON response |
| Fixed `authenticateToken` middleware | Removed redundant DB query on every authenticated request |
| Admin dashboard loads in parallel | All 4 admin data fetches run simultaneously instead of one by one |
| Fixed `.vscode/tasks.json` | Removed Windows-only `npm.cmd`/`cmd` commands, uses bash now |
| Removed auto-start on folder open | VS Code no longer launches servers automatically on local — run them manually |
| Added Codespaces auto-launch | Backend + frontend start automatically when a Codespace opens via `.devcontainer/` |
