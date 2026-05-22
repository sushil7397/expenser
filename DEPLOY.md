# Deployment guide

The app is split into two halves:

- **Frontend**: React + Vite SPA in `frontend/`. Deploys to GitHub Pages at
  `https://<your-user>.github.io/expenser/`.
- **Backend**: Django + SQLCipher + WebAuthn API in `expense_app/` + `expenser/`.
  Deploys to any Python host with HTTPS (PythonAnywhere free tier is the simplest).

The frontend talks to the backend over HTTPS. They live on different domains;
CORS is configured in `expenser/settings.py`.

## 1. Backend on PythonAnywhere (free)

1. Sign up at pythonanywhere.com. Free plan gives you `https://<user>.pythonanywhere.com`.
2. Open a Bash console and clone your repo:
   ```bash
   git clone git@github.com:<you>/expenser.git
   cd expenser
   python3.12 -m venv venv && . venv/bin/activate
   pip install -r requirements.txt
   ```
3. Create a `.env` from `.env.example`. Set fresh values for every secret. **Do not
   reuse the keys from your old machine** — assume those were exposed when the
   plaintext DB landed in git.
4. Encrypt your database (skip if you already have an encrypted `db.sqlite3`):
   ```bash
   set -a && . ./.env && set +a
   python scripts/encrypt_db.py /path/to/plaintext.db db.sqlite3
   ```
5. PythonAnywhere → **Web** → Add new web app → Manual configuration → Python 3.12.
6. Point the WSGI file at this project's `expenser/wsgi.py` and set the virtualenv
   to the one you created above.
7. In **Web → Environment variables**, set everything from `.env`. Most importantly:
   - `SQLCIPHER_KEY`
   - `FIELD_ENC_KEY_SEED`
   - `DJANGO_SECRET_KEY`
   - `DJANGO_DEBUG=False`
   - `DJANGO_ALLOWED_HOSTS=<user>.pythonanywhere.com`
   - `DJANGO_CORS_ORIGINS=https://<you>.github.io`
   - `WEBAUTHN_RP_ID=<you>.github.io`
   - `WEBAUTHN_ORIGINS=https://<you>.github.io`
8. Reload the web app. Visit `https://<user>.pythonanywhere.com/api/auth/me/` —
   you should see a 401 JSON response.

## 2. Frontend on GitHub Pages

1. In your GitHub repo: **Settings → Pages → Build and deployment → Source = GitHub Actions**.
2. **Settings → Secrets and variables → Actions → New repository secret**:
   - Name: `VITE_API_BASE`
   - Value: `https://<user>.pythonanywhere.com`
3. Push to `main`. The workflow in `.github/workflows/deploy-frontend.yml` builds
   `frontend/` and publishes to Pages automatically.
4. Visit `https://<you>.github.io/expenser/`. You should see the login page.

If your repo isn't called `expenser`, change `base` in `frontend/vite.config.js`
and the `pathPrefix` in `frontend/public/404.html` to match.

## 3. Local development

Two terminals:

```bash
# Terminal 1 — Django API
set -a && . ./.env && set +a
python manage.py runserver 127.0.0.1:9099
```

```bash
# Terminal 2 — React dev server
cd frontend
npm install
npm run dev
# open http://localhost:5173/expenser/
```

`vite.config.js` proxies `/api` from `:5173` to `:9099`, so CORS and HTTPS aren't
in the way during dev. Fingerprint also works because `localhost` is treated as a
secure context.

## 4. Secrets housekeeping

`.env`, `db.sqlite3`, and any `db.sqlite3.*` backups must never be committed.
Both are listed in `.gitignore`. If you ever accidentally commit them, treat
that data as compromised and rotate every key in `.env`.
