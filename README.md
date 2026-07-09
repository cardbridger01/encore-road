# Encore Road (prototype)

Standalone Vite + React app. 100% client-side — WebAudio + Canvas + React state,
no backend, no database, no env vars. That's what makes this safe to isolate
from another project on the same Render account: there's nothing here that
*could* reach into it.

## What's in this build

- Full loop: route the tour → structure the deal → build a setlist → play the gig → payout
- **20 songs** across 5 genre tags, each with a distinct rhythmic "feel"
  (four-on-the-floor, halftime, driving, syncopated, straight) so charts don't
  feel same-y; 12 cities across 5 crowd archetypes. The setlist picker surfaces
  crowd-loved songs first, hated ones last.
- **Difficulty modes (Easy / Normal / Hard),** chosen on the title screen and
  remembered per browser. Difficulty controls how many notes you tap, how far
  apart they're allowed to bunch (a hard cap on taps-per-second), how forgiving
  the timing windows are, and how punishing a miss is. Concretely, the hardest
  song runs ~2.5 taps/sec on Easy vs ~6 on Hard (the music itself always plays
  in full — only the tappable notes thin out). Every song is completable on Easy.
  The chart-density curve was also rebalanced down across the board.
- **Tour perks (roguelite meta):** finishing a gig at **B or higher** offers 3
  random perk cards from a pool of 20. The one you pick applies for the rest of
  the tour and stacks with everything else you've taken; a chosen perk is removed
  from the pool so it can't be offered again. Perks reset when you start a new
  tour. Active perks are shown on the pre-gig planning screen and exported in the
  playtest JSON. They're tuned to help without trivializing the game (e.g. "Hit
  windows 8% more forgiving," "Door gigs pay 12% more," "Once per gig a dying
  crowd revives at 25").
- **Cross-device controls:** desktop plays on D/F/J/K; mobile plays with four
  on-screen lane pads that support true multi-touch (two fingers register two
  lanes at once, and a finger sliding between pads re-triggers). The gig sizes to
  the device's real viewport height (`dvh`) so pads never get pushed off-screen,
  and double-tap/pinch zoom is disabled during play. On phones, the song picker
  is a **swipeable carousel** (swipe or use the ‹ › arrows; tap a card to pick it);
  desktop keeps the full chip grid.
- **Post-gig celebration splash:** each set ends on a results splash that counts
  up the cash you earned, fires confetti for a B-or-better set (scaled by grade),
  and shows an itemized **"where it came from"** breakdown — door take, the
  performance-grade multiplier, and any perk bonuses — so the payout math is
  legible instead of a single number.
- **Arcade leaderboard:** finishing a tour computes a score (cash + fans, times a
  multiplier from your average gig grade, so a rich-but-sloppy run can't beat a
  great one). Cracking the top 10 for that difficulty triggers an old-school
  **initials entry** (three ▲/▼ letter reels). Separate boards for Easy / Normal /
  Hard, viewable from the title screen or the end screen. Scores persist in
  `localStorage` — **per browser, not global**, since this ships as a static site
  with no backend. Swapping to a real shared leaderboard later means replacing
  `loadBoards`/`saveBoards` with API calls; nothing else changes.
- **Travel interstitial + road events:** between stops, a GBA-style pixel-art
  screen shows your van driving a neon highway (parallax scenery, bobbing van,
  spinning wheels) with a route ribbon tracking progress to the next stop. About
  60% of drives trigger an **Oregon-Trail-style road event** — a blowout, a speed
  trap, a viral clip, a scenic overlook, gas-station sushi — each drawn as its own
  pixel vignette with a **one-time** effect on cash/fans/morale (distinct from the
  persistent perks). Tap the scene to hurry the drive. Events encountered are
  recorded in the playtest export.
- **A/V calibration wizard** — runs on first launch (or from "Recalibrate audio" on
  the title screen). Taps along to a metronome, measures the player's timing
  offset, and applies it to hit judgment so scoring is fair across different
  devices/headphones/speakers. Stored per-browser in `localStorage`.
- **Playtester feedback capture** — at the end of a tour, a 1–5 star rating,
  a free-text notes field, and an **Export playtest data** button that downloads
  a JSON file per tester (calibration offset, device string, and per-gig timing
  stats — `deltaMeanMs`/`deltaStdMs`, the actual drift between hits and the
  beat). No backend needed yet: have testers email/Slack you the exported file
  and diff them by hand or in a spreadsheet.

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

## Running a playtest round

1. Deploy (above), send the URL to testers.
2. Ask each tester to actually go through calibration on their own device/headphones
   rather than skipping it — that's the whole point of collecting comparable data.
3. After a full tour, have them rate + leave notes, then hit **Export playtest data**
   and send you the downloaded `.json`.
4. Compare `deltaMeanMs` across testers/devices. If it clusters near 0 for everyone,
   calibration is doing its job. If some testers show a large, consistent non-zero
   mean even after calibrating, that's a signal worth digging into before writing
   it off as "they're just bad at rhythm games."

## What would NOT be isolated (avoid these)

- Adding this service into an existing project's repo and pointing Render's
  root-directory/build-filter config at a subfolder — keeps a Git-level tie
  even though the services stay separate.
- Manually copying another service's environment variables into this one
  "just in case." This app calls no API, so it needs zero env vars.
- Connecting this to another service's database. There's no code path here
  that touches a database — don't add one.
