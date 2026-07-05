# Encore Road (prototype)

Standalone Vite + React app. 100% client-side — WebAudio + Canvas + React state,
no backend, no database, no env vars. That's what makes this safe to isolate
from another project on the same Render account: there's nothing here that
*could* reach into it.

## Run locally

```bash
npm install
npm run dev       # http://localhost:5173
npm run build     # outputs to ./dist
```

## Deploy to Render as its own service

**Do this in a new GitHub repo**, separate from any existing project's repo.
That's the actual isolation boundary — not the Render container (every Render
service already gets its own container regardless), but making sure this repo
has no path back to another project's service, database, or env vars.

### Option A — Dashboard (no blueprint)
1. Push this folder to a new repo.
2. Render Dashboard → **New +** → **Static Site**.
3. Connect the new repo.
4. Build command: `npm ci && npm run build`
5. Publish directory: `dist`
6. Create. Don't add any environment variables — none are needed.

### Option B — Blueprint (render.yaml included)
1. Push this folder (including `render.yaml`) to a new repo.
2. Render Dashboard → **New +** → **Blueprint** → connect the repo.
3. Render reads `render.yaml` and provisions one static site. Nothing else.

Either way you get a service type called **Static Site**, which is the
lowest-risk option available on Render: builds run in a throwaway container,
the result is just files pushed to Render's CDN, and there's no persistent
runtime process at all after the build finishes — nothing stays "on" to
misbehave.

## What would NOT be isolated (avoid these)

- Adding this service into an existing project's repo and pointing Render's
  root-directory/build-filter config at a subfolder — keeps a Git-level tie
  even though the services stay separate.
- Manually copying another service's environment variables into this one
  "just in case." This app calls no API, so it needs zero env vars.
- Connecting this to another service's database. There's no code path here
  that touches a database — don't add one.
