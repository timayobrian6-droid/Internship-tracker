# Permanent Browser Link (Render)

This project is now prepared for Render deployment.

## 1) Put project on GitHub

If `git` is not installed, easiest path:

1. Create a new empty GitHub repository.
2. Upload this project folder contents (do **not** upload `node_modules`).
3. Ensure these files exist in the repo root:
   - `server.js`
   - `package.json`
   - `render.yaml`
   - `internship-frontend/`

## 2) Deploy on Render

1. Go to [https://dashboard.render.com](https://dashboard.render.com)
2. Click **New +** → **Blueprint**.
3. Connect your GitHub account and choose your repository.
4. Render will read `render.yaml` and create the web service.
5. Click **Apply** and wait for deployment to finish.

## 3) Share permanent link

After deploy, Render gives a URL like:

`https://internship-tracker.onrender.com`

Share that URL with your professor.

## Notes

- First load after inactivity on free plan may take 30–60 seconds.
- Data is SQLite-based; free hosting file storage may reset on redeploy.
- For grading/demo, this is usually fine.

## Troubleshooting (If Render says deploy failed)

1. In Render, open your service → **Events** and **Logs** and check the first failing step.
2. Confirm this repo includes both lock files:
   - `package-lock.json`
   - `internship-frontend/package-lock.json`
3. Redeploy with **Clear build cache & deploy** once.
4. If build still fails, verify your service uses this config from `render.yaml`:
   - `buildCommand: npm run render-build`
   - `startCommand: npm start`
   - `NODE_VERSION=20`
   - `CI=false`

### Why this is now more stable

- Build now uses deterministic installs (`npm ci`) for both backend and frontend.
- Render env now enables `NPM_CONFIG_LEGACY_PEER_DEPS=true` to avoid peer-resolution failures.
- Render env sets `CI=false` so React warnings do not fail deployment as hard errors.
- Added `.gitignore` so large local artifacts (`node_modules`, uploads, local DB files) are not pushed accidentally.
