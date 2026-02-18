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

Share that URL with anyone who needs access (your laptop can stay off).

## Notes

- First load after inactivity on free plan may take 30–60 seconds.
- Data is SQLite-based; free hosting file storage may reset on redeploy.
- For grading/demo, this is usually fine.
- Render provides `RENDER_EXTERNAL_URL` automatically. If you host elsewhere, set `RESET_BASE_URL` in `.env` so password reset links point to the hosted site.
