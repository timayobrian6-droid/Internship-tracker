# InternConnect Enterprise Tracker

InternConnect is a full-stack internship management platform built with React, Node.js, and SQLite.
It helps students discover real internship openings, apply in one place, and track progress by stage while helping companies manage openings and applicant pipelines.

## What this app does

- Centralizes internship discovery, application, and tracking.
- Gives students a structured pipeline (`Applied`, `Interviewing`, `Offer`, `Placed`, etc.).
- Lets companies publish openings, review applicants, and move candidates through stages.
- Provides role-based dashboards for Students, Companies, and Admins.
- Supports profile management, support tickets, password reset, and live updates.

## Problems it solves for students

- Removes scattered applications across email/spreadsheets.
- Prevents missing deadlines by keeping openings and statuses visible in one dashboard.
- Gives clear visibility into where each application stands.
- Keeps company research (overview/mission/vision) next to openings for faster decisions.

## Who uses it

- **Students**: Build profile, follow companies, apply to openings, track status.
- **Companies**: Manage profile, publish openings, handle applicants.
- **Admins**: Monitor users, data quality, settings, support, and audit trails.

---

## Student frontend: how to navigate every tab

After login as a student, use the left sidebar tabs:

### 1) Dashboard

- See key stats and application summaries.
- Review interview/offer/progress highlights.

### 2) My Profile

- Create or update your student profile.
- Upload and manage required documents.

### 3) Member Companies

- View **all member companies** from the main database.
- Subscribe/unsubscribe to companies.
- See company details like industry, location, overview, mission, and vision.

### 4) Openings

- Browse current internship openings from companies you follow.
- Open the apply modal and submit an application.

### 5) Applications

- Track your own application pipeline by stage.
- Edit/withdraw where allowed.
- See only your own applications (isolated per student account).

### 6) Support

- Create support tickets.
- View admin replies and ticket status.

---

## Company frontend: how to navigate every tab

After login as a company user:

### Company 1) Dashboard

- View applicant and activity summaries.
- See recent pipeline movement.

### Company 2) Profile

- Manage company profile and branding information.

### Company 3) Openings

- Create, update, or remove internship openings.
- Control details like role title, department, expectations, slots, and deadlines.

### Company 4) Applications

- Review applicants for your company.
- Move candidates across stages (`Applied` → `Interviewing` → `Offer` → `Placed`, etc.).
- Handle candidate communication requests.

### Company 5) Support

- Contact admin through the in-app support flow.

---

## Run in VS Code (local deployment)

Use two terminals.

### Terminal 1 (Backend)

```bash
npm install
node server.js
```

Backend runs on `http://localhost:3001`.

### Terminal 2 (Frontend)

```bash
cd internship-frontend
npm install
npm start
```

Frontend usually runs on `http://localhost:3000`.

If prompted to use a different frontend port, accept it and open the URL shown in terminal.

---

## Optional single-port run

To serve the built frontend from the backend:

```bash
npm start
```

Open `http://localhost:3001`.

---

## Environment and database

Copy `.env.example` to `.env` and edit values as needed.

Key variables:

- `DB_FILE=internship_final.db` (single source database file)
- `PORT=5000` (used if set; app defaults to 3001 when not set)
- `JWT_SECRET=...`
- `RESET_BASE_URL=http://localhost:3001`

All backend and scripts are configured to use the same database file path.

---

## Useful scripts

From repo root:

- `npm run dev` → backend with nodemon
- `npm run db:backup-migrate` → backup DB and run safe migrations
- `npm run build:frontend` → build React app

---

## Notes

- New accounts are auto-approved.
- Student data is isolated by account (no cross-student pipeline leakage).
- Member Companies tab is backed by the main database company list.
