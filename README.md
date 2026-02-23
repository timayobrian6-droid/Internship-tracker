# InternConnect Enterprise Tracker 🚀

A high-fidelity, full-stack internship management system built with React, Node.js, and SQLite.

## Key Features

- **Kanban Pipeline**: Drag-and-drop style workflow management.
- **Placement Analytics**: Real-time aggregation of hiring success rates.
- **Global Search**: Performance-optimized search across students and companies.
- **Reporting**: Exportable CSV and PDF placement summaries.

## Setup Instructions

Backend (root)

1. Copy `.env.example` to `.env` and update values.
2. Install backend deps and run:

```powershell
npm install
npm run dev
```

Frontend (internship-frontend)

```powershell
cd internship-frontend
npm install
npm start
```

Notes:

- A development admin account is seeded automatically (see `.env.example`).
- Server runs on port 5000 by default. Update `PORT` in `.env` if needed.

## Codespaces Quick Start

This project includes `.devcontainer/devcontainer.json` so a new Codespace will:

- Install backend dependencies automatically.
- Install frontend dependencies automatically.
- Auto-start backend on port `5000` and frontend on port `3000`.

If you already had a Codespace open before this file was added, rebuild it once:

```powershell
# in Codespaces command palette
Dev Containers: Rebuild Container
```

If startup fails for any reason, run manually:

```powershell
npm ci
npm --prefix internship-frontend ci
npm run dev
```

In another terminal:

```powershell
npm --prefix internship-frontend start
```

## Demo Walkthrough (Create Accounts & Try the App)

Use two browser sessions (or normal + incognito) so you can stay logged in as both account types.

1. Open `http://localhost:3000` (or `http://localhost:5000` if using built frontend).
2. Click **First Time User** → register a **Student** account.
3. Sign out, then register a **Company** account.
4. After company login, the app will prompt **Create Company Profile**. Fill it and save.
5. In company tabs, open **Openings** and create at least one internship opening.
6. Switch to student login, open **My Profile**, complete profile details, then save.
7. Go to student **Openings**, find the company opening, and apply.
8. Switch back to company **Applications** to see and move the application stage.

This gives you a full end-to-end view: registration, profile setup, opening creation, student application, and company-side pipeline updates.

### Optional: Admin Login

- Admin portal URL: `http://localhost:3000/admin`
- Default dev admin credentials come from `.env` / `.env.example`:
  - `ADMIN_EMAIL=admin@local`
  - `ADMIN_PASS=adminpass`

## Submit by Email (Professor-Friendly)

To share this project by email:

1. Zip the whole project folder (include both root and `internship-frontend`).
2. Send the ZIP file to your professor.
3. Ask them to extract it, then double-click `launch.bat`.

If Node.js is missing, `launch.bat` now opens the official Node.js LTS download page automatically and then continues after installation.

What happens after launch:

- Preferred mode: backend starts and serves the built frontend at `http://localhost:5000`
- Fallback mode: backend on `http://localhost:5000` and frontend dev server on `http://localhost:3000`

Optional manual run (if they prefer terminal):

```powershell
npm install
npm start
```

Open:

```powershell
http://localhost:5000
```

If `internship-frontend/build` is missing, use dev mode:

```powershell
npm run dev
```

In another terminal:

```powershell
npm --prefix internship-frontend install
npm --prefix internship-frontend start
```

DB backup & migration

Before running any schema-changing scripts, create a backup and apply safe migrations:

```powershell
npm run db:backup-migrate
```

This copies `internship_final.db` into `backups/` with a timestamp and applies idempotent migrations (adds missing columns/tables).

## Technical Roadmap

Integrated 28 steps including UI Library setup, Stage Filtering, and Unit Testing.

## Permanent Public Link (Recommended)

This repo is Render-ready.

1. Put the project on GitHub (without `node_modules`).
2. In Render, choose **New + → Blueprint**.
3. Select your GitHub repo; Render will use `render.yaml`.
4. After deploy, share the Render URL with your professor.

Detailed steps: see `DEPLOY_RENDER.md`.
