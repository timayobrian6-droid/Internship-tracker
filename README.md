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

To let others access the tracker without your laptop running, deploy it to a hosting provider (Render is already set up).

**No-command-line option:** click this button and follow the prompts.
**Important:** If you are deploying a fork, replace the `repo=` URL in the button link with your own GitHub repo first.

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/your-username/your-repo)

Example fork link: `https://render.com/deploy?repo=https://github.com/<your-username>/<your-repo>`

1. Put the project on GitHub (without `node_modules`).
2. In Render, choose **New + → Blueprint**.
3. Select your GitHub repo; Render will use `render.yaml`.
4. In Render → **Environment**, set `ADMIN_EMAIL` and `ADMIN_PASS` to create your first admin account.
5. After deploy, share the Render URL with anyone who needs access.

Render automatically sets `RENDER_EXTERNAL_URL`, which the app uses for password reset links. On other hosts, set `RESET_BASE_URL` in `.env`.

Detailed steps: see `DEPLOY_RENDER.md`.
