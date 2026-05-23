# Expenser

A personal expense tracker. Pure React, no backend. Hosted on GitHub Pages.

**Live:** https://sushil7397.github.io/expenser/

## How it works

- The app ships with `frontend/src/seed.json` — historical expenses imported from the original Django app.
- New expenses you add are saved in your browser's `localStorage`. They're per-device — open the site on a different browser or computer and you'll see only the seed data.
- No server, no login, no API. Everything runs in the browser.

## Local development

```bash
cd frontend
npm install
npm run dev
# open the URL it prints (http://localhost:5173/expenser/)
```

## Deploying

Push to `main`. The workflow in `.github/workflows/deploy-frontend.yml` builds the React app and publishes it to GitHub Pages automatically.

One-time setup on a fresh fork:

1. Repo **Settings → Pages → Source = GitHub Actions**.
2. If your repo isn't named `expenser`, change `base` in `frontend/vite.config.js` and `pathPrefix` in `frontend/public/404.html` to match.
