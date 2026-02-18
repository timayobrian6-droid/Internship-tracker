# Permanent Browser Link (Render)

This project is now prepared for Render deployment.

## One-click deploy (no command line)

Click the button below and follow the prompts in Render.
**Important:** If you are deploying a fork, replace the `repo=` URL in the button link with your own GitHub repo first.

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/timayobrian6-droid/Internship-tracker)

Example fork link: `https://render.com/deploy?repo=https://github.com/<your-username>/<your-repo>`

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

### Recommended environment variables

Set these in Render → **Environment** so you can log in immediately:

- `ADMIN_EMAIL` (initial admin account email)
- `ADMIN_PASS` (initial admin password)
- Optional: `RESET_EMAIL_MODE=console` if you have not set up SMTP yet

## 3) Share permanent link

After deploy, Render gives a URL like:

`https://internship-tracker.onrender.com`

Share that URL with anyone who needs access (your laptop can stay off).

## Notes

- First load after inactivity on free plan may take 30–60 seconds.
- Data is SQLite-based; free hosting file storage may reset on redeploy.
- For grading/demo, this is usually fine.
- Render provides `RENDER_EXTERNAL_URL` automatically. If you host elsewhere, set `RESET_BASE_URL` in `.env` so password reset links point to the hosted site.
