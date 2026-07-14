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
- **Genre-specific instruments + swappable music:** each genre now has its own
  synthesised kit rather than every song being the same drum machine at a
  different tempo. Punk and metal get waveshaper-distorted guitars (8th-note
  downstrokes vs. syncopated palm-muted chugs); synth gets an 808-style sub kick,
  a clap instead of a snare, an acid-style filter-envelope bass and arpeggios with
  delay; anthem gets big sustained triads, a long-tail snare and reverb; ballad
  gets a soft brushed kit, warm triangle bass and gentle arpeggios in a big room.
  A harmony layer plays real triads (correct minor/major per bar), and the master
  bus has a limiter — dense genres measurably clipped at peak 1.00 before it. The
  harmony is **audio-only and consumes no RNG**, so the tuned difficulty curve and
  every generated chart are bit-identical to before.
  **To use your own recordings:** drop a file in `public/audio/` and add `src` +
  `srcOffset` to that song in `SONGS` — the chart, judging and scoring are
  generated from `bpm`/`feel`, so nothing else changes. Songs can be swapped one
  at a time, and a missing or broken file automatically falls back to the synth
  rather than leaving a silent gig. See `public/audio/README.md`.
- **Infamy has to be earned (anti-exploit):** infamy is only granted by horrifying
  an audience that **stayed**. A walkout earns **zero** infamy — nobody films a
  disaster nobody watched — and infamy scales with how many people were actually
  in the room (`INFAMY_CROWD_REF`, full value at ~220 heads). A walkout also
  craters the door take by 65%, since an empty room buys no merch and the promoter
  saw it happen. The practical effect: "never touch the screen" now ends the tour
  as **Unknowns with zero infamy**, instead of Notorious. To go viral as a
  trainwreck you must draw a real crowd (promo + fans, which cost money and
  require earlier success) and then **hold the room for the whole song while
  playing badly** — measured, that needs ~80% of notes hit on Normal (~90% on
  Hard) with deliberately sloppy timing, since accuracy blends hit-rate with
  precision. That's active, skillful needle-threading, not idling.
  *Known caveat:* mashing all four lanes still reaches C-grade infamy (~92% of the
  time on Normal) at half rate, because `doHit` ignores taps with no note nearby.
  It scores well below honest play, but a spurious-tap penalty would close it.
- **Reputation & infamy — two ways to get famous:** every gig moves two hidden
  axes. **Cred** rises on B+ sets; **infamy** rises when you bomb. Your standing
  shows on the map (Unknowns → On the Radar → Rising → Acclaimed → Legendary, or
  Local Disaster → Viral Trainwreck → Notorious) with live cred/infamy meters.
  Past **50 infamy the virality pool unlocks**: the road starts throwing you
  hate-watch armies, tabloid buyouts, booing challenges, and anti-fans who buy
  tickets specifically to heckle. Fans arrive by spectacle instead of skill, and
  **virality compounds with notoriety** — a viral hit grows from ~49 fans at
  infamy 50 to ~71 at infamy 95. Many events also **reframe by reputation**: the
  same clip is "Critics Share the Clip" when you're acclaimed and "You're a Meme
  Now" when you're a trainwreck. Measured over full tours: an all-S run earns
  ~361 fans (mostly at gigs), while an all-F run earns ~151 — *entirely from the
  road*, since a bombing band converts zero fans on stage. Mastery still wins, but
  infamy is a real path. The worst place to be is the middle: an all-C run earns
  only ~71, too good to go viral and too bad to build cred.
- **Road-event catalog:** 134 authored events across 14 categories (van trouble,
  law, food, weather, fans, industry, money, roadside, band drama, absurd, plus
  infamy-virality, acclaim, after-bomb and after-banger sets), each tagged with the
  situations it fits — broke, flush, low morale, hot, infamous, fresh off a bomb or
  a banger. With reputation reframings and three magnitude tiers that's roughly
  **420 distinct experienced outcomes**, and the pool responds to how your last gig
  actually went.
- **Route choice at every junction (prototype):** leaving a stop no longer drops
  you straight onto one road — you pick from a **3-way fork**, each road a
  different gamble. The Interstate is always offered as the safe baseline; two
  others are drawn from a pool (Scenic, Shortcut, Coastal, Backroads). Each route
  has a guaranteed effect shown up front (e.g. Scenic +6 morale, Shortcut +$50,
  Coastal +9 morale/−$20), a "surprises" risk meter, and its own bias over which
  road events tend to fire — the Shortcut has a ~37% chance of a van breakdown,
  the Scenic road skews kind, the Interstate is quiet. This turns travel from a
  cutscene into a real decision layer: a morale-starved run wants the Coastal
  road, a cash-strapped one is tempted by the Shortcut gamble. (This is Tier 1 of
  the travel redesign; van-as-resource and opt-in micro-driving are future tiers.)
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
