import React, { useState, useRef, useEffect, useCallback } from "react";

/* ================= ENCORE ROAD — playable prototype =================
   Loop: pick city → structure the deal → play the gig (rhythm game)
   Keys: D F J K  •  Mobile: tap the 4 lane pads
   ==================================================================== */

// ---------- seeded rng ----------
const mulberry32 = (a) => () => {
  a |= 0; a = (a + 0x6d2b79f5) | 0;
  let t = Math.imul(a ^ (a >>> 15), 1 | a);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

// ---------- content ----------
const CAL_KEY = "encoreRoadCalOffsetMs";
const DIFF_KEY = "encoreRoadDifficulty";

// Difficulty scales the whole feel: how many taps (densityMult), how far apart
// they can bunch (minGap seconds), how forgiving the timing (hitWindowMult),
// how punishing a miss is (missPenaltyMult), and the starting crowd cushion.
const DIFFICULTY = {
  easy:   { key: "easy",   label: "Easy",   blurb: "Fewer notes, spread out, forgiving.", densityMult: 0.62, minGap: 0.26,  hitWindowMult: 1.40, missPenaltyMult: 0.50, crowdStart: 72 },
  normal: { key: "normal", label: "Normal", blurb: "A real challenge, still fair.",         densityMult: 0.85, minGap: 0.165, hitWindowMult: 1.15, missPenaltyMult: 0.75, crowdStart: 62 },
  hard:   { key: "hard",   label: "Hard",   blurb: "Dense charts, tight timing.",           densityMult: 1.00, minGap: 0.10,  hitWindowMult: 1.00, missPenaltyMult: 1.00, crowdStart: 55 },
};
const DEFAULT_DIFF = "normal";

// feel drives the drum/note pattern; root is the bass note cycle (Hz) per bar.
// Notes: A2=110/2=55, C3=65.4, D3=73.4, E3=82.4, G2=49, F2=43.7, B2=61.7
const ROOTS = {
  Am:   [55, 55, 65.4, 49],
  Dm:   [73.4, 73.4, 55, 65.4],
  Em:   [82.4, 61.7, 55, 49],
  Gmaj: [49, 73.4, 61.7, 55],
  Fmaj: [43.7, 65.4, 55, 49],
};

const SONGS = [
  // punk — fast, syncopated
  { id: "s1",  name: "Gasoline Halo",     tag: "punk",   bpm: 168, diff: 3, feel: "syncopated", root: "Em", blurb: "2-min buzzsaw. Punk crowds lose it." },
  { id: "s10", name: "Curbstomp Sonata",  tag: "punk",   bpm: 190, diff: 4, feel: "driving",    root: "Am", blurb: "All gas, no brakes." },
  { id: "s11", name: "Static Prayer",     tag: "punk",   bpm: 176, diff: 3, feel: "syncopated", root: "Dm", blurb: "Snotty, catchy, relentless." },
  { id: "s12", name: "Teenage Cathedral", tag: "punk",   bpm: 160, diff: 2, feel: "driving",    root: "Gmaj",blurb: "Anthemic pop-punk. Easier entry." },
  // synth — four-on-floor / straight
  { id: "s2",  name: "Neon Mile",         tag: "synth",  bpm: 122, diff: 1, feel: "fourfloor",  root: "Am", blurb: "Synthwave cruiser. Easy hands." },
  { id: "s6",  name: "Chrome Halogen",    tag: "synth",  bpm: 140, diff: 2, feel: "fourfloor",  root: "Fmaj",blurb: "Faster synth cut. More hands." },
  { id: "s13", name: "Midnight Cassette", tag: "synth",  bpm: 128, diff: 2, feel: "straight",   root: "Dm", blurb: "Retro shimmer, steady groove." },
  { id: "s14", name: "Vaporlight",        tag: "synth",  bpm: 134, diff: 3, feel: "fourfloor",  root: "Em", blurb: "Dense arps, busy hi-hats." },
  // anthem — straight / driving
  { id: "s3",  name: "Cathedral Amp",     tag: "anthem", bpm: 138, diff: 2, feel: "straight",   root: "Gmaj",blurb: "Big-room singalong anthem." },
  { id: "s7",  name: "Concrete Choir",    tag: "anthem", bpm: 150, diff: 3, feel: "driving",    root: "Am", blurb: "Anthem with teeth. Dense chorus." },
  { id: "s15", name: "Hands Up High",     tag: "anthem", bpm: 132, diff: 2, feel: "straight",   root: "Fmaj",blurb: "Festival hands-in-the-air fodder." },
  { id: "s16", name: "The Long Encore",   tag: "anthem", bpm: 144, diff: 3, feel: "driving",    root: "Dm", blurb: "Slow-build to a big payoff." },
  // ballad — halftime, forgiving
  { id: "s4",  name: "Rust & Roses",      tag: "ballad", bpm: 96,  diff: 1, feel: "halftime",   root: "Am", blurb: "Lighters up. Slow, forgiving." },
  { id: "s9",  name: "Paper Saints",      tag: "ballad", bpm: 110, diff: 2, feel: "halftime",   root: "Gmaj",blurb: "Slow burn with a chorus spike." },
  { id: "s17", name: "Sawdust & Gold",    tag: "ballad", bpm: 88,  diff: 1, feel: "halftime",   root: "Fmaj",blurb: "Barroom weeper. Very gentle." },
  { id: "s18", name: "Cigarette Sunday",  tag: "ballad", bpm: 104, diff: 2, feel: "straight",   root: "Dm", blurb: "Mid-tempo heartbreak with lift." },
  // metal — driving / syncopated, hard
  { id: "s5",  name: "Blackout Fret",     tag: "metal",  bpm: 182, diff: 4, feel: "driving",    root: "Em", blurb: "Riff avalanche. Experts only." },
  { id: "s8",  name: "Faultline",         tag: "metal",  bpm: 158, diff: 3, feel: "syncopated", root: "Am", blurb: "Mid-tempo grind, still brutal." },
  { id: "s19", name: "Hammer County",     tag: "metal",  bpm: 170, diff: 4, feel: "driving",    root: "Dm", blurb: "Gallop riffs, double-kick bursts." },
  { id: "s20", name: "Iron Lung Blues",   tag: "metal",  bpm: 150, diff: 3, feel: "syncopated", root: "Gmaj",blurb: "Sludgy, heavy, off-beat stomp." },
];

const ARCH = {
  punkhouse: { label: "Punk House",    loves: "punk",   hates: "ballad", flavor: "Fast or nothing." },
  discoloft: { label: "Disco Loft",    loves: "synth",  hates: "metal",  flavor: "They came to glide." },
  stadiumkids:{ label: "Anthem Kids",  loves: "anthem", hates: "punk",   flavor: "Choruses win hearts." },
  divehearts:{ label: "Dive Hearts",   loves: "ballad", hates: "synth",  flavor: "Whiskey and feelings." },
  pitcrew:   { label: "Pit Crew",      loves: "metal",  hates: "ballad", flavor: "Open the pit." },
};

const CITY_POOL = [
  { name: "Tulsa",        arch: "punkhouse",  draw: 90 },
  { name: "Wichita",      arch: "divehearts", draw: 80 },
  { name: "Kansas City",  arch: "stadiumkids",draw: 140 },
  { name: "Denver",       arch: "pitcrew",    draw: 160 },
  { name: "Austin",       arch: "discoloft",  draw: 180 },
  { name: "St. Louis",    arch: "punkhouse",  draw: 150 },
  { name: "Nashville",    arch: "divehearts", draw: 200 },
  { name: "Chicago",      arch: "stadiumkids",draw: 260 },
  { name: "Minneapolis",  arch: "discoloft",  draw: 220 },
  { name: "Phoenix",      arch: "pitcrew",    draw: 240 },
  { name: "Las Vegas",    arch: "discoloft",  draw: 320 },
  { name: "Los Angeles",  arch: "stadiumkids",draw: 400 },
];

const TOTAL_STOPS = 6;
const LANE_KEYS = ["d", "f", "j", "k"];
const LANE_COLORS = ["#FF3D7F", "#FFB03A", "#57E0E8", "#B78CFF"];

const gradeOf = (acc) => acc >= 0.95 ? "S" : acc >= 0.88 ? "A" : acc >= 0.75 ? "B" : acc >= 0.6 ? "C" : "F";
const PERF = { S: 1.25, A: 1.05, B: 0.85, C: 0.6, F: 0.3 };
const CONV = { S: 0.35, A: 0.25, B: 0.15, C: 0.06, F: 0 };
const fmt$ = (n) => "$" + Math.round(n).toLocaleString();

/* ============================ PERKS ============================
   20 persistent, stackable tour perks. Offered as 3 random cards after any
   gig graded B or higher; the chosen perk applies for the rest of the tour and
   is removed from the pool so it can't be offered again. Kept modest so that
   even a full stack (~5-6 per tour) helps without trivializing the game.
   Each perk declares `mods`; aggregatePerks() folds all owned perks into one
   modifier object using per-key combine rules.
   ============================================================= */
const PERKS = [
  { id: "roadlegs",   name: "Road Legs",       emoji: "🚐", desc: "Driving overnight costs 6 less morale.",              mods: { moraleDriveReduction: 6 } },
  { id: "merch",      name: "Merch Table",     emoji: "👕", desc: "Door-split gigs pay 12% more.",                        mods: { doorMult: 1.12 } },
  { id: "soundcheck", name: "Soundcheck Ritual",emoji: "🎚️", desc: "Hit windows are 8% more forgiving.",                  mods: { hitWindowMult: 1.08 } },
  { id: "hometown",   name: "Hometown Heroes",  emoji: "🏟️", desc: "Crowds that love your genre draw 15% harder.",        mods: { loveBonus: 0.15 } },
  { id: "thickskin",  name: "Thick Skin",       emoji: "🦏", desc: "Playing a hated genre hurts attendance 40% less.",    mods: { hatePenaltyReduction: 0.4 } },
  { id: "encore",     name: "Encore Energy",    emoji: "⚡", desc: "Start every gig with +10 crowd.",                      mods: { crowdStartBonus: 10 } },
  { id: "pockets",    name: "Tight Pockets",    emoji: "💸", desc: "Promo spend costs 25% less.",                          mods: { promoCostMult: 0.75 } },
  { id: "loyal",      name: "Loyal Following",  emoji: "💞", desc: "Convert 20% more of the crowd into fans.",             mods: { fanConvMult: 1.20 } },
  { id: "steady",     name: "Steady Hands",     emoji: "🎯", desc: "Missed notes drain 30% less crowd.",                   mods: { missDrainMult: 0.70 } },
  { id: "wordofmouth",name: "Word of Mouth",    emoji: "🗣️", desc: "Your fanbase pulls 12% more attendance.",             mods: { fanPullMult: 1.12 } },
  { id: "rider",      name: "Rider Clause",     emoji: "📜", desc: "Guarantee deals pay 15% more.",                        mods: { guaranteeMult: 1.15 } },
  { id: "caffeine",   name: "Caffeine Rider",   emoji: "☕", desc: "Motel nights restore +8 extra morale.",               mods: { moraleRestBonus: 8 } },
  { id: "showstopper",name: "Showstopper",      emoji: "🎆", desc: "All gig scores are boosted 15%.",                      mods: { scoreMult: 1.15 } },
  { id: "ironwill",   name: "Iron Will",        emoji: "🛡️", desc: "Morale never drops below 30.",                        mods: { moraleFloor: 30 } },
  { id: "press",      name: "Press Darling",    emoji: "📰", desc: "A- or S-grade gigs earn 25% more fans.",               mods: { highGradeFanBonus: 1.25 } },
  { id: "frugal",     name: "Frugal Crew",      emoji: "🧾", desc: "Base costs each stop are $30 lower.",                  mods: { costReduction: 30 } },
  { id: "hustle",     name: "Ticket Hustle",    emoji: "🎟️", desc: "Ticket price is $3 higher everywhere.",               mods: { ticketBonus: 3 } },
  { id: "secondwind", name: "Second Wind",      emoji: "🌬️", desc: "Once per gig, a dying crowd revives at 25.",          mods: { reviveOnce: true } },
  { id: "fanclub",    name: "Fan Club",         emoji: "🎗️", desc: "Every gig earns +6 fans flat, any grade.",            mods: { flatFansPerGig: 6 } },
  { id: "perfect",    name: "Perfect Pitch",    emoji: "✨", desc: "Perfect hits pump +1 extra crowd.",                    mods: { perfectCrowdBonus: 1 } },

  // ---- reputation / infamy path ----
  { id: "publicist",  name: "Publicist",        emoji: "📢", desc: "Each drive, your infamy quietly converts to new fans.", mods: { infamyToFans: 0.22 } },
  { id: "methodactor",name: "Method Actor",     emoji: "🎭", desc: "Infamy fades far more slowly. Live the character.",     mods: { infamySticky: true } },
  { id: "damagectrl", name: "Damage Control",   emoji: "🧯", desc: "Bombed gigs cost less morale and less cred.",           mods: { damageControl: true } },
  { id: "tabloid",    name: "Tabloid Darling",  emoji: "🗞️", desc: "Viral 'trainwreck' road events pay 50% more.",         mods: { infamyEventBonus: 1.5 } },
  { id: "comeback",   name: "Comeback Kid",     emoji: "🔥", desc: "After a bombed gig, start the next with +12 crowd.",     mods: { afterBombCrowd: 12 } },
  { id: "cult",       name: "Cult Leader",      emoji: "🕯️", desc: "A steady trickle of true believers each drive.",        mods: { infamyToFans: 0.18, flatFansPerGig: 3 } },

  // ---- more economy / rhythm variety ----
  { id: "megamerch",  name: "Merch Empire",     emoji: "🧢", desc: "Door-split gigs pay another 10%.",                      mods: { doorMult: 1.10 } },
  { id: "streetteam", name: "Street Team",      emoji: "📌", desc: "Fanbase pulls another 10% attendance.",                 mods: { fanPullMult: 1.10 } },
  { id: "metronome",  name: "Inner Metronome",  emoji: "⏱️", desc: "Hit windows are another 6% more forgiving.",            mods: { hitWindowMult: 1.06 } },
  { id: "hypeman",    name: "Hype Man",         emoji: "🙌", desc: "Start every gig with +6 more crowd.",                    mods: { crowdStartBonus: 6 } },
  { id: "closer",     name: "Big Closer",       emoji: "🎬", desc: "Gig scores boosted another 10%.",                       mods: { scoreMult: 1.10 } },
  { id: "converter",  name: "True Believers",   emoji: "😇", desc: "Convert another 15% of the crowd into fans.",           mods: { fanConvMult: 1.15 } },
  { id: "roadwarrior",name: "Road Warrior",     emoji: "🛞", desc: "Driving overnight costs 8 less morale.",                mods: { moraleDriveReduction: 8 } },
  { id: "accountant", name: "Shrewd Accountant",emoji: "🧮", desc: "Base costs each stop are another $25 lower.",           mods: { costReduction: 25 } },
  { id: "scalper",    name: "Dynamic Pricing",  emoji: "🏷️", desc: "Ticket price is another $4 higher.",                    mods: { ticketBonus: 4 } },
  { id: "zen",        name: "Tour Zen",         emoji: "🧘", desc: "Morale never drops below 40.",                          mods: { moraleFloor: 40 } },
  { id: "diehards",   name: "Die-Hards",        emoji: "🤘", desc: "Every gig earns +8 fans flat, any grade.",              mods: { flatFansPerGig: 8 } },
];

// combine rules by modifier key
const MULT_KEYS = ["hitWindowMult", "missDrainMult", "scoreMult", "doorMult", "guaranteeMult", "fanConvMult", "promoCostMult", "fanPullMult", "highGradeFanBonus", "infamyEventBonus"];
const ADD_KEYS = ["crowdStartBonus", "perfectCrowdBonus", "loveBonus", "moraleRestBonus", "moraleDriveReduction", "costReduction", "ticketBonus", "flatFansPerGig", "infamyToFans", "afterBombCrowd"];

function aggregatePerks(ownedIds) {
  const m = {
    hitWindowMult: 1, missDrainMult: 1, scoreMult: 1, doorMult: 1, guaranteeMult: 1,
    fanConvMult: 1, promoCostMult: 1, fanPullMult: 1, highGradeFanBonus: 1, infamyEventBonus: 1,
    crowdStartBonus: 0, perfectCrowdBonus: 0, loveBonus: 0, moraleRestBonus: 0,
    moraleDriveReduction: 0, costReduction: 0, ticketBonus: 0, flatFansPerGig: 0,
    infamyToFans: 0, afterBombCrowd: 0,
    hatePenaltyReduction: 0, moraleFloor: 0, reviveOnce: false,
    infamySticky: false, damageControl: false,
  };
  for (const id of ownedIds) {
    const perk = PERKS.find((p) => p.id === id);
    if (!perk) continue;
    for (const [k, v] of Object.entries(perk.mods)) {
      if (MULT_KEYS.includes(k)) m[k] *= v;
      else if (ADD_KEYS.includes(k)) m[k] += v;
      else if (k === "hatePenaltyReduction") m[k] = 1 - (1 - m[k]) * (1 - v); // stack toward 1, never over
      else if (k === "moraleFloor") m[k] = Math.max(m[k], v);
      else if (k === "reviveOnce" || k === "infamySticky" || k === "damageControl") m[k] = m[k] || v;
    }
  }
  return m;
}

// pick up to n distinct random perks not already owned
function drawPerks(ownedIds, n = 3) {
  const pool = PERKS.filter((p) => !ownedIds.includes(p.id));
  for (let i = pool.length - 1; i > 0; i--) {
    const j = (Math.random() * (i + 1)) | 0;
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, Math.min(n, pool.length)).map((p) => p.id);
}

/* ============================ LEADERBOARD ============================
   Arcade-style local high scores, kept per difficulty. Persisted to
   localStorage (this ships as a static site, so there's no backend — scores
   are per-browser). Top 10 per board; qualifying runs prompt for initials.
   ==================================================================== */
const LB_KEY = "encoreRoadLeaderboard";
const LB_SIZE = 10;
const LB_NAME_KEY = "encoreRoadLastInitials";

// A tour's final score: cash is the spine, fans are worth something, and
// average gig grade is a multiplier so a rich-but-sloppy run can't top a great one.
const GRADE_POINTS = { S: 100, A: 80, B: 60, C: 35, F: 0 };
function scoreRun({ cash, fans, history }) {
  const gigs = history.length || 1;
  const gradeAvg = history.reduce((a, h) => a + (GRADE_POINTS[h.grade] || 0), 0) / gigs;
  const base = Math.max(0, cash) + fans * 4;
  const mult = 0.6 + (gradeAvg / 100) * 0.8; // 0.6x (all F) .. 1.4x (all S)
  return Math.round(base * mult);
}

function loadBoards() {
  if (typeof window === "undefined") return { easy: [], normal: [], hard: [] };
  try {
    const raw = window.localStorage.getItem(LB_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    return {
      easy: Array.isArray(parsed?.easy) ? parsed.easy : [],
      normal: Array.isArray(parsed?.normal) ? parsed.normal : [],
      hard: Array.isArray(parsed?.hard) ? parsed.hard : [],
    };
  } catch { return { easy: [], normal: [], hard: [] }; }
}
function saveBoards(boards) {
  try { window.localStorage.setItem(LB_KEY, JSON.stringify(boards)); } catch { /* storage full/blocked */ }
}
// where would `score` place on this board? returns 0-based rank, or -1 if it doesn't make the cut
function rankFor(board, score) {
  const better = board.filter((e) => e.score >= score).length;
  return better < LB_SIZE ? better : -1;
}
function insertScore(boards, diffKey, entry) {
  const board = [...(boards[diffKey] || []), entry]
    .sort((a, b) => b.score - a.score)
    .slice(0, LB_SIZE);
  const next = { ...boards, [diffKey]: board };
  saveBoards(next);
  return next;
}

// ---------- chart + audio generation ----------
// Each "feel" defines which 16th-note steps carry kick/snare/hat, giving songs
// audibly and mechanically distinct patterns instead of one shared groove.
function feelPattern(feel, s, bar, rng) {
  // returns { kick, snare, hat }
  switch (feel) {
    case "fourfloor": // steady dance kick on every quarter
      return { kick: s % 4 === 0, snare: s === 4 || s === 12, hat: s % 2 === 0 };
    case "halftime": // sparse, slow — snare on the 3, kick on 1 and a pickup
      return { kick: s === 0 || (s === 10 && rng() < 0.5), snare: s === 8, hat: s % 4 === 0 };
    case "driving": // busy: kick doubles, extra ghost snare (hats on 8ths, not every step)
      return { kick: s % 4 === 0 || s === 6 || (s === 14 && rng() < 0.7), snare: s === 4 || s === 12, hat: s % 2 === 0 };
    case "syncopated": // off-beat kicks, backbeat snare
      return { kick: s === 0 || s === 3 || s === 6 || s === 10, snare: s === 4 || s === 12, hat: s % 2 === 1 };
    default: // straight
      return { kick: s % 4 === 0 || (s === 14 && rng() < 0.4), snare: s === 4 || s === 12, hat: s % 2 === 0 };
  }
}

function buildChart(song, tier, seed, mode) {
  const md = mode || DIFFICULTY[DEFAULT_DIFF];
  const rng = mulberry32(seed);
  const spb = 60 / song.bpm;          // seconds per beat
  const step = spb / 4;               // 16th notes
  const bars = 16;
  // base note-fill scaled by difficulty; minGap caps how fast taps can bunch up
  const base = Math.min(0.72, 0.24 + song.diff * 0.075 + tier * 0.035);
  const density = base * md.densityMult;
  const minGap = md.minGap;
  const notes = [];   // {t, lane}
  const audio = [];   // {t, inst, freq}  — always full, so music stays intact even when taps thin
  const bassLine = ROOTS[song.root] || ROOTS.Am;
  const bassSteps = (song.feel === "syncopated")
    ? [0, 3, 6, 8, 11, 14]
    : (song.feel === "halftime")
    ? [0, 8]
    : [0, 4, 8, 12, 6];

  let lastStepT = -Infinity; // last step that placed a tap, for min-gap spacing

  for (let bar = 0; bar < bars; bar++) {
    const bt = bar * 16 * step;
    for (let s = 0; s < 16; s++) {
      const t = bt + s * step;
      const p = feelPattern(song.feel, s, bar, rng);
      const isKick = p.kick, isSnare = p.snare, isHat = p.hat;
      const isBass = bassSteps.includes(s) && rng() < 0.82;
      // audio plays regardless of whether we place a tappable note here
      if (isKick) audio.push({ t, inst: "kick" });
      if (isSnare) audio.push({ t, inst: "snare" });
      if (isHat) audio.push({ t, inst: "hat" });
      if (isBass) audio.push({ t, inst: "bass", freq: bassLine[bar % 4] * (s >= 8 ? 2 : 1) });

      // spacing: if too soon after the last tap-step, this step gets no notes
      if (t - lastStepT < minGap) continue;

      const cand = [];
      if (isKick) cand.push(0);
      if (isSnare) cand.push(1);
      if (isHat && rng() < density * 0.5) cand.push(2);
      if (isBass && rng() < density * 0.65) cand.push(3);
      let placed = 0;
      for (const lane of cand) {
        if (placed >= 2) break;                      // max 2-note chords
        if (lane >= 2 && bar < 2) continue;          // gentle intro
        if (rng() < (lane < 2 ? density + 0.18 : density)) {
          notes.push({ t, lane, hit: false, judged: null });
          placed++;
        }
      }
      if (placed > 0) lastStepT = t;
    }
  }
  notes.sort((a, b) => a.t - b.t);
  audio.sort((a, b) => a.t - b.t);
  return { notes, audio, length: bars * 16 * step };
}

function makeSynth(ctx) {
  const master = ctx.createGain();
  master.gain.value = 0.5;
  master.connect(ctx.destination);
  return {
    kick(t) {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.frequency.setValueAtTime(150, t);
      o.frequency.exponentialRampToValueAtTime(40, t + 0.12);
      g.gain.setValueAtTime(1, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
      o.connect(g); g.connect(master); o.start(t); o.stop(t + 0.16);
    },
    snare(t) {
      const buf = ctx.createBuffer(1, ctx.sampleRate * 0.12, ctx.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
      const src = ctx.createBufferSource(); src.buffer = buf;
      const f = ctx.createBiquadFilter(); f.type = "highpass"; f.frequency.value = 1200;
      const g = ctx.createGain(); g.gain.setValueAtTime(0.6, t);
      src.connect(f); f.connect(g); g.connect(master); src.start(t);
    },
    hat(t) {
      const buf = ctx.createBuffer(1, ctx.sampleRate * 0.04, ctx.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
      const src = ctx.createBufferSource(); src.buffer = buf;
      const f = ctx.createBiquadFilter(); f.type = "highpass"; f.frequency.value = 7000;
      const g = ctx.createGain(); g.gain.setValueAtTime(0.22, t);
      src.connect(f); f.connect(g); g.connect(master); src.start(t);
    },
    bass(t, freq) {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = "square"; o.frequency.value = freq;
      const f = ctx.createBiquadFilter(); f.type = "lowpass"; f.frequency.value = 500;
      g.gain.setValueAtTime(0.25, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.22);
      o.connect(f); f.connect(g); g.connect(master); o.start(t); o.stop(t + 0.24);
    },
  };
}

/* ============================ CALIBRATION ============================
   A/V + input-latency calibration. The player taps along to a metronome;
   we measure the average offset between the scheduled beat and the actual
   tap, then apply that offset to judgment (not to drawing/audio) in Gig.
   ==================================================================== */
function Calibration({ onDone, onSkip }) {
  const stateRef = useRef(null);
  const [taps, setTaps] = useState(0);
  const [ready, setReady] = useState(false);
  const [started, setStarted] = useState(false);
  const NEEDED = 8;
  const BPM = 100;

  // Browsers keep a freshly-created AudioContext "suspended" (its clock frozen)
  // until a real user gesture resumes it. Calibration is the very first screen,
  // so nothing has resumed audio yet — we gate both resume() and the metronome
  // start on the player's first press, rather than starting on mount.
  const start = useCallback(() => {
    if (stateRef.current) return;
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const period = 60 / BPM;
    const S = { ctx, t0: 0, period, deltas: [], nextIdx: 0, done: false, schedTimer: null };
    stateRef.current = S;

    const click = (at, accent) => {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.frequency.value = accent ? 1400 : 900;
      g.gain.setValueAtTime(0.35, at);
      g.gain.exponentialRampToValueAtTime(0.001, at + 0.06);
      o.connect(g); g.connect(ctx.destination); o.start(at); o.stop(at + 0.07);
    };

    const beginScheduling = () => {
      S.t0 = ctx.currentTime + 0.6;
      S.schedTimer = setInterval(() => {
        if (S.done) return;
        const ahead = ctx.currentTime + 0.3;
        while (S.t0 + S.nextIdx * period < ahead) {
          click(S.t0 + S.nextIdx * period, S.nextIdx % 4 === 0);
          S.nextIdx++;
        }
      }, 40);
    };
    const resumeP = ctx.state === "running" ? Promise.resolve() : ctx.resume();
    resumeP.then(beginScheduling).catch(beginScheduling);
    setStarted(true);
  }, []);

  const onTap = useCallback(() => {
    const S = stateRef.current;
    if (!S || S.done || S.t0 === 0) return;
    const now = S.ctx.currentTime - S.t0;
    if (now < 0) return;
    const beatIdx = Math.round(now / S.period);
    if (beatIdx <= 0) return;
    const beatT = beatIdx * S.period;
    const d = now - beatT;
    if (Math.abs(d) < S.period * 0.5) {
      S.deltas.push(d);
      setTaps(S.deltas.length);
      if (S.deltas.length >= NEEDED) {
        S.done = true;
        clearInterval(S.schedTimer);
        const mean = S.deltas.reduce((a, b) => a + b, 0) / S.deltas.length;
        setReady(true);
        setTimeout(() => onDone(Math.round(mean * 1000)), 500);
      }
    }
  }, [onDone]);

  const handlePress = useCallback(() => {
    if (!stateRef.current) start(); else onTap();
  }, [start, onTap]);

  useEffect(() => {
    const onKey = (e) => { if (e.code === "Space" && !e.repeat) handlePress(); };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      if (stateRef.current) {
        clearInterval(stateRef.current.schedTimer);
        stateRef.current.ctx.close();
      }
    };
  }, [handlePress]);

  return (
    <div className="panel center">
      <div className="kicker">BEFORE YOU GO ON STAGE</div>
      <h1 className="h2" style={{ marginTop: 4 }}>Calibrate your timing</h1>
      <p className="lede">
        Every device — speakers, headphones, especially Bluetooth — has a different audio delay.
        Tap along with the click, on the beat, for {NEEDED} beats. This tunes your hit windows so scoring is fair on your setup.
      </p>
      <div className="cal-dots">
        {[...Array(NEEDED)].map((_, i) => (
          <span key={i} className={i < taps ? "cal-dot on" : "cal-dot"} />
        ))}
      </div>
      <button id="cal-tap-btn" className="btn big" onClick={handlePress} style={{ background: ready ? "#57E0E8" : undefined }}>
        {ready ? "Calibrated ✓" : started ? "TAP HERE — or press Space" : "Tap to start"}
      </button>
      <button className="relink" onClick={onSkip}>Skip calibration (use default timing)</button>
    </div>
  );
}

/* ============================ GIG SCENE ============================ */
function Gig({ song, tier, morale, calOffset, perkMods, diff, seed, afterBomb, onDone }) {
  const canvasRef = useRef(null);
  const stateRef = useRef(null);
  const padsRef = useRef(null);
  const [hud, setHud] = useState({ score: 0, combo: 0, crowd: 60, acc: 1, count: 3 });
  const [padDown, setPadDown] = useState([false, false, false, false]);
  const [flash, setFlash] = useState(null);

  const md = diff || DIFFICULTY[DEFAULT_DIFF];
  const pm = perkMods || {};
  const effMorale = pm.moraleFloor ? Math.max(morale, pm.moraleFloor) : morale;
  const winScale = effMorale < 20 ? 0.75 : effMorale < 40 ? 0.85 : 1;
  const hitMult = (pm.hitWindowMult || 1) * md.hitWindowMult;
  const W_PERF = 0.055 * winScale * hitMult, W_GOOD = 0.125 * winScale * hitMult;

  // visually light a pad for a moment (used by both touch and keyboard)
  const lightPad = useCallback((lane, on) => {
    setPadDown((prev) => {
      if (prev[lane] === on) return prev;
      const next = prev.slice(); next[lane] = on; return next;
    });
  }, []);

  const doHit = useCallback((lane) => {
    const S = stateRef.current;
    if (!S || S.finished || !S.started) return;
    const trueNow = S.ctx.currentTime - S.t0;
    const now = trueNow - calOffset; // calibration-adjusted judgment clock
    S.pressFx[lane] = trueNow;
    let best = null, bestD = Infinity;
    for (const n of S.chart.notes) {
      if (n.judged || n.lane !== lane) continue;
      const d = n.t - now;
      if (d > W_GOOD) break;
      if (Math.abs(d) < bestD) { bestD = Math.abs(d); best = n; }
    }
    if (best && bestD <= W_GOOD) {
      const perfect = bestD <= W_PERF;
      best.judged = perfect ? "perfect" : "good";
      S.judgeFx = { text: perfect ? "PERFECT" : "GOOD", t: trueNow, lane };
      S.combo++;
      S.maxCombo = Math.max(S.maxCombo, S.combo);
      const mult = 1 + Math.min(3, Math.floor(S.combo / 10) * 0.5);
      S.score += Math.round((perfect ? 100 : 55) * mult * (pm.scoreMult || 1));
      S.pts += perfect ? 1 : 0.6; S.total++;
      const gain = (perfect ? 2 + (pm.perfectCrowdBonus || 0) : 1);
      S.crowd = Math.min(100, S.crowd + gain);
      S.deltas.push(best.t - now); // signed timing delta, for playtest telemetry
    }
  }, [W_PERF, W_GOOD, calOffset, pm]);

  useEffect(() => {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    if (ctx.state !== "running") ctx.resume().catch(() => {});
    const synth = makeSynth(ctx);
    const chart = buildChart(song, tier, seed, md);
    const t0 = ctx.currentTime + 3.2; // countdown
    // Comeback Kid: a bombed last gig means the room is rooting for you tonight
    const comebackBonus = afterBomb ? (pm.afterBombCrowd || 0) : 0;
    const startCrowd = Math.min(100, md.crowdStart + (pm.crowdStartBonus || 0) + comebackBonus);
    const S = {
      ctx, synth, chart, t0, audioIdx: 0, started: false, finished: false,
      score: 0, combo: 0, maxCombo: 0, crowd: startCrowd, pts: 0, total: 0,
      pressFx: [-9, -9, -9, -9], judgeFx: null, deltas: [],
      missDrainMult: (pm.missDrainMult || 1) * md.missPenaltyMult, canRevive: !!pm.reviveOnce, revived: false,
    };
    stateRef.current = S;

    const schedTimer = setInterval(() => {
      if (S.finished) return;
      const ahead = ctx.currentTime + 0.15;
      while (S.audioIdx < chart.audio.length && t0 + chart.audio[S.audioIdx].t < ahead) {
        const e = chart.audio[S.audioIdx++];
        const at = t0 + e.t;
        if (at > ctx.currentTime - 0.02) {
          if (e.inst === "kick") synth.kick(at);
          else if (e.inst === "snare") synth.snare(at);
          else if (e.inst === "hat") synth.hat(at);
          else synth.bass(at, e.freq);
        }
      }
    }, 25);

    const cvs = canvasRef.current;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const resize = () => {
      cvs.width = cvs.clientWidth * dpr;
      cvs.height = cvs.clientHeight * dpr;
    };
    resize();
    window.addEventListener("resize", resize);
    const g = cvs.getContext("2d");

    let raf, hudTick = 0;
    const APPROACH = 1.6; // seconds visible before hit line
    const loop = () => {
      const now = ctx.currentTime - t0;
      S.started = now >= 0;
      const W = cvs.width, H = cvs.height;
      const laneW = W / 4, hitY = H * 0.82;

      // miss sweep — judged on the calibration-adjusted clock, drawn on the true one
      const judgeNow = now - calOffset;
      for (const n of chart.notes) {
        if (!n.judged && n.t < judgeNow - W_GOOD) {
          n.judged = "miss";
          S.combo = 0; S.total++;
          S.crowd = Math.max(0, S.crowd - 6 * S.missDrainMult);
          S.judgeFx = { text: "MISS", t: now, lane: n.lane };
        }
      }

      // draw
      g.clearRect(0, 0, W, H);
      for (let l = 0; l < 4; l++) {
        g.fillStyle = l % 2 ? "rgba(255,255,255,0.025)" : "rgba(255,255,255,0.05)";
        g.fillRect(l * laneW, 0, laneW, H);
        const dt = now - S.pressFx[l];
        if (dt >= 0 && dt < 0.15) {
          g.fillStyle = LANE_COLORS[l] + "33";
          g.fillRect(l * laneW, 0, laneW, hitY);
        }
      }
      // road dashes
      g.strokeStyle = "rgba(255,255,255,0.12)"; g.lineWidth = 2 * dpr;
      g.setLineDash([14 * dpr, 18 * dpr]);
      const dashOff = (now * 260 * dpr) % (32 * dpr);
      for (let l = 1; l < 4; l++) {
        g.beginPath(); g.lineDashOffset = -dashOff;
        g.moveTo(l * laneW, 0); g.lineTo(l * laneW, H); g.stroke();
      }
      g.setLineDash([]);
      // hit line
      g.strokeStyle = "#F4EDE0"; g.lineWidth = 3 * dpr;
      g.beginPath(); g.moveTo(0, hitY); g.lineTo(W, hitY); g.stroke();

      // notes
      const r = laneW * 0.30;
      for (const n of chart.notes) {
        if (n.judged === "perfect" || n.judged === "good") continue;
        const dt = n.t - now;
        if (dt > APPROACH || dt < -0.2) continue;
        const y = hitY - (dt / APPROACH) * hitY;
        const x = n.lane * laneW + laneW / 2;
        g.fillStyle = n.judged === "miss" ? "rgba(120,120,130,0.5)" : LANE_COLORS[n.lane];
        g.beginPath();
        g.roundRect(x - r, y - r * 0.42, r * 2, r * 0.84, 8 * dpr);
        g.fill();
      }

      // judgment popup
      if (S.judgeFx && now - S.judgeFx.t < 0.4) {
        const a = 1 - (now - S.judgeFx.t) / 0.4;
        g.globalAlpha = a;
        g.fillStyle = S.judgeFx.text === "MISS" ? "#FF5A5A" : S.judgeFx.text === "PERFECT" ? "#FFB03A" : "#57E0E8";
        g.font = `bold ${26 * dpr}px 'Space Grotesk', sans-serif`;
        g.textAlign = "center";
        g.fillText(S.judgeFx.text, W / 2, hitY - 60 * dpr - (1 - a) * 24 * dpr);
        g.globalAlpha = 1;
      }

      // countdown
      if (now < 0) {
        g.fillStyle = "#F4EDE0";
        g.font = `900 ${72 * dpr}px 'Space Grotesk', sans-serif`;
        g.textAlign = "center";
        g.fillText(String(Math.ceil(-now)), W / 2, H / 2);
      }

      // hud throttle
      if (++hudTick % 6 === 0) {
        setHud({
          score: S.score, combo: S.combo, crowd: S.crowd,
          acc: S.total ? S.pts / S.total : 1,
          count: now < 0 ? Math.ceil(-now) : 0,
        });
      }

      // Second Wind: a dying crowd revives once instead of walking
      if (S.crowd <= 0 && now > 2 && S.canRevive && !S.revived) {
        S.revived = true;
        S.crowd = 25;
        S.judgeFx = { text: "SECOND WIND!", t: now, lane: 1 };
      }

      // end conditions
      const crowdWalked = S.crowd <= 0 && now > 2;
      if ((now > chart.length + 1.2 || crowdWalked) && !S.finished) {
        S.finished = true;
        const acc = S.total ? S.pts / Math.max(S.total, chart.notes.length * 0.4) : 0;
        const finalAcc = chart.notes.length ? S.pts / chart.notes.length : 0;
        const dn = S.deltas.length;
        const dMean = dn ? S.deltas.reduce((a, b) => a + b, 0) / dn : 0;
        const dVar = dn ? S.deltas.reduce((a, b) => a + (b - dMean) * (b - dMean), 0) / dn : 0;
        onDone({
          grade: crowdWalked ? "F" : gradeOf(finalAcc),
          acc: finalAcc, score: S.score, maxCombo: S.maxCombo, walked: crowdWalked,
          deltaMeanMs: Math.round(dMean * 1000), deltaStdMs: Math.round(Math.sqrt(dVar) * 1000),
        });
        return;
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    const onKey = (e) => {
      const i = LANE_KEYS.indexOf(e.key.toLowerCase());
      if (i >= 0 && !e.repeat) { doHit(i); lightPad(i, true); }
    };
    const onKeyUp = (e) => {
      const i = LANE_KEYS.indexOf(e.key.toLowerCase());
      if (i >= 0) lightPad(i, false);
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("keyup", onKeyUp);

    // ----- multi-touch: track each active pointer to its lane so two (or more)
    // fingers register independent lane hits, and a finger sliding between pads
    // re-triggers. Works for touch and mouse via Pointer Events. -----
    const padsEl = padsRef.current;
    const laneAt = (clientX) => {
      if (!padsEl) return -1;
      const r = padsEl.getBoundingClientRect();
      if (clientX < r.left || clientX > r.right) return -1;
      return Math.max(0, Math.min(3, Math.floor(((clientX - r.left) / r.width) * 4)));
    };
    const pointerLane = new Map(); // pointerId -> lane currently held
    const lanePointers = [0, 0, 0, 0]; // how many fingers on each lane (for release)

    const press = (pid, lane) => {
      if (lane < 0) return;
      pointerLane.set(pid, lane);
      lanePointers[lane]++;
      lightPad(lane, true);
      doHit(lane);
    };
    const release = (pid) => {
      const lane = pointerLane.get(pid);
      if (lane === undefined) return;
      pointerLane.delete(pid);
      lanePointers[lane] = Math.max(0, lanePointers[lane] - 1);
      if (lanePointers[lane] === 0) lightPad(lane, false);
    };
    const onPointerDown = (e) => {
      if (!padsEl) return;
      e.preventDefault();
      press(e.pointerId, laneAt(e.clientX));
    };
    const onPointerMove = (e) => {
      if (!pointerLane.has(e.pointerId)) return; // only track fingers that started on the pads
      const newLane = laneAt(e.clientX);
      const oldLane = pointerLane.get(e.pointerId);
      if (newLane !== oldLane && newLane >= 0) {
        // finger slid to a new lane: release old, trigger new
        lanePointers[oldLane] = Math.max(0, lanePointers[oldLane] - 1);
        if (lanePointers[oldLane] === 0) lightPad(oldLane, false);
        pointerLane.set(e.pointerId, newLane);
        lanePointers[newLane]++;
        lightPad(newLane, true);
        doHit(newLane);
      }
    };
    if (padsEl) {
      padsEl.addEventListener("pointerdown", onPointerDown);
      padsEl.addEventListener("pointermove", onPointerMove);
    }
    window.addEventListener("pointerup", (e) => release(e.pointerId));
    window.addEventListener("pointercancel", (e) => release(e.pointerId));

    return () => {
      clearInterval(schedTimer);
      cancelAnimationFrame(raf);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("keyup", onKeyUp);
      if (padsEl) {
        padsEl.removeEventListener("pointerdown", onPointerDown);
        padsEl.removeEventListener("pointermove", onPointerMove);
      }
      window.removeEventListener("pointerup", release);
      window.removeEventListener("pointercancel", release);
      window.removeEventListener("resize", resize);
      ctx.close();
    };
  }, [song, tier, seed, onDone, W_GOOD, calOffset, doHit, lightPad, pm, md]); // eslint-disable-line

  return (
    <div className="gig">
      <div className="gig-hud">
        <div>
          <div className="hud-label">Score</div>
          <div className="hud-big">{hud.score.toLocaleString()}</div>
        </div>
        <div className="crowd-wrap">
          <div className="hud-label">Crowd</div>
          <div className="crowd-bar">
            <div className="crowd-fill" style={{
              width: `${hud.crowd}%`,
              background: hud.crowd > 60 ? "#FFB03A" : hud.crowd > 30 ? "#FF7A3D" : "#FF5A5A",
            }} />
          </div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div className="hud-label">Combo</div>
          <div className="hud-big" style={{ color: hud.combo >= 20 ? "#FFB03A" : "#F4EDE0" }}>
            {hud.combo}×
          </div>
        </div>
      </div>
      <div className="stage-wrap">
        <canvas ref={canvasRef} className="stage" />
        <div className="pads" ref={padsRef}>
          {LANE_COLORS.map((c, i) => (
            <div key={i} className={"pad" + (padDown[i] ? " down" : "")} style={{ "--pc": c }}>
              <span className="pad-glyph" />
              <span className="pad-key">{LANE_KEYS[i].toUpperCase()}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="gig-song">♪ {song.name} — {song.bpm} BPM</div>
    </div>
  );
}

/* ============================ CELEBRATION + UI HELPERS ============================ */
// Confetti burst for a strong set (B+). Pure CSS-animated pieces, self-contained.
function Confetti({ count = 80 }) {
  const pieces = useRef(
    [...Array(count)].map(() => ({
      left: Math.random() * 100,
      delay: Math.random() * 0.5,
      dur: 2.2 + Math.random() * 1.6,
      rot: Math.random() * 360,
      color: ["#FF3D7F", "#FFB03A", "#57E0E8", "#B78CFF", "#8CFF9E"][(Math.random() * 5) | 0],
      size: 7 + Math.random() * 7,
      drift: (Math.random() * 2 - 1) * 80,
    }))
  ).current;
  return (
    <div className="confetti" aria-hidden="true">
      {pieces.map((p, i) => (
        <span key={i} className="confetti-piece" style={{
          left: p.left + "%",
          width: p.size, height: p.size * 1.4,
          background: p.color,
          animationDelay: p.delay + "s",
          animationDuration: p.dur + "s",
          "--rot": p.rot + "deg",
          "--drift": p.drift + "px",
        }} />
      ))}
    </div>
  );
}

// Animated count-up used for the payout number on the results splash.
function CashCountUp({ to, prefix = "", duration = 900 }) {
  const [n, setN] = useState(0);
  useEffect(() => {
    let raf, start;
    const tick = (ts) => {
      if (!start) start = ts;
      const t = Math.min(1, (ts - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3); // easeOutCubic
      setN(Math.round(to * eased));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [to, duration]);
  return <span>{prefix}{n.toLocaleString()}</span>;
}

// Tracks whether the viewport is phone-width, for mobile-specific UI (song carousel).
function useIsNarrow(bp = 620) {
  const [narrow, setNarrow] = useState(() =>
    typeof window !== "undefined" ? window.matchMedia(`(max-width:${bp}px)`).matches : false
  );
  useEffect(() => {
    const mq = window.matchMedia(`(max-width:${bp}px)`);
    const on = () => setNarrow(mq.matches);
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, [bp]);
  return narrow;
}

/* ---- arcade-style initials entry: three letter reels, ▲/▼ per slot ---- */
const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 -!".split("");
function InitialsEntry({ rank, score, diffLabel, onSubmit }) {
  const seed = (typeof window !== "undefined" && window.localStorage.getItem(LB_NAME_KEY)) || "AAA";
  const [chars, setChars] = useState(() => {
    const s = (seed + "AAA").slice(0, 3).toUpperCase().split("");
    return s.map((c) => (LETTERS.includes(c) ? c : "A"));
  });
  const bump = (i, dir) => {
    setChars((cs) => {
      const next = cs.slice();
      const at = LETTERS.indexOf(next[i]);
      next[i] = LETTERS[(at + dir + LETTERS.length) % LETTERS.length];
      return next;
    });
  };
  const submit = () => {
    const name = chars.join("").trim() || "AAA";
    try { window.localStorage.setItem(LB_NAME_KEY, name); } catch { /* ignore */ }
    onSubmit(name);
  };
  return (
    <div className="panel center hs-entry">
      <Confetti count={70} />
      <div className="kicker">NEW HIGH SCORE</div>
      <h1 className="hs-rank">#{rank + 1} <span className="hs-diff">{diffLabel}</span></h1>
      <div className="hs-score">{score.toLocaleString()}</div>
      <p className="lede">Enter your initials, hero.</p>
      <div className="reels">
        {chars.map((c, i) => (
          <div className="reel" key={i}>
            <button className="reel-btn" onClick={() => bump(i, 1)} aria-label="next letter">▲</button>
            <div className="reel-char">{c === " " ? "␣" : c}</div>
            <button className="reel-btn" onClick={() => bump(i, -1)} aria-label="previous letter">▼</button>
          </div>
        ))}
      </div>
      <button className="btn big" onClick={submit}>Carve it in →</button>
    </div>
  );
}

/* ---- leaderboard table, one board per difficulty ---- */
function Leaderboard({ boards, activeKey, onSelect, highlight }) {
  const board = boards[activeKey] || [];
  return (
    <div className="lb">
      <div className="lb-tabs">
        {Object.values(DIFFICULTY).map((d) => (
          <button key={d.key}
            className={"lb-tab" + (activeKey === d.key ? " sel" : "")}
            onClick={() => onSelect(d.key)}>{d.label}</button>
        ))}
      </div>
      {board.length === 0 ? (
        <p className="hint lb-empty">No scores yet on {DIFFICULTY[activeKey].label}. Be the first.</p>
      ) : (
        <div className="lb-rows">
          {board.map((e, i) => {
            const isMe = highlight && highlight.key === activeKey && highlight.ts === e.ts;
            return (
              <div className={"lb-row" + (isMe ? " me" : "") + (i === 0 ? " first" : "")} key={e.ts || i}>
                <span className="lb-pos">{i + 1}</span>
                <span className="lb-name">{e.name}</span>
                <span className="lb-meta">{e.fans}f · {e.grades}</span>
                <span className="lb-score">{e.score.toLocaleString()}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// Swipeable song carousel for narrow screens: scroll-snap cards, prev/next
// arrows, and a position readout. Tapping a card selects that song.
function SongCarousel({ songs, selectedId, onSelect, arch }) {
  const trackRef = useRef(null);
  const [idx, setIdx] = useState(() => Math.max(0, songs.findIndex((s) => s.id === selectedId)));

  // nearest card to the viewport center, computed live from the DOM
  const currentIndex = () => {
    const track = trackRef.current;
    if (!track) return idx;
    const center = track.getBoundingClientRect().left + track.clientWidth / 2;
    let best = 0, bestD = Infinity;
    for (let i = 0; i < track.children.length; i++) {
      const cr = track.children[i].getBoundingClientRect();
      const d = Math.abs(cr.left + cr.width / 2 - center);
      if (d < bestD) { bestD = d; best = i; }
    }
    return best;
  };

  const centerCard = (i, smooth) => {
    const track = trackRef.current;
    if (!track) return;
    const clamped = Math.max(0, Math.min(songs.length - 1, i));
    const card = track.children[clamped];
    if (card) card.scrollIntoView({ behavior: smooth ? "smooth" : "auto", inline: "center", block: "nearest" });
  };

  const go = (dir) => centerCard(currentIndex() + dir, true);

  const onScroll = () => {
    const i = currentIndex();
    if (i !== idx) setIdx(i);
  };

  // center the initially-selected card once mounted (instant, so state matches)
  useEffect(() => { centerCard(idx, false); }, []); // eslint-disable-line

  return (
    <div className="carousel-wrap">
      <div className="carousel-top">
        <button className="car-arrow" onClick={() => go(-1)} disabled={idx <= 0} aria-label="Previous song">‹</button>
        <span className="car-count">{idx + 1} / {songs.length}</span>
        <button className="car-arrow" onClick={() => go(1)} disabled={idx >= songs.length - 1} aria-label="Next song">›</button>
      </div>
      <div className="carousel" ref={trackRef} onScroll={onScroll}>
        {songs.map((s) => {
          const love = s.tag === arch.loves, hate = s.tag === arch.hates;
          const sel = s.id === selectedId;
          return (
            <div key={s.id}
              className={"song-slide" + (sel ? " sel" : "")}
              onClick={() => onSelect(s)}>
              <div className={"slide-badge " + (love ? "love" : hate ? "hate" : "neutral")}>
                {love ? "♥ crowd loves this" : hate ? "✕ crowd dislikes this" : s.tag}
              </div>
              <div className="slide-name">{s.name}</div>
              <div className="slide-meta">{s.tag} · {s.bpm} bpm</div>
              <div className="slide-diff">{"◆".repeat(s.diff)}{"◇".repeat(4 - s.diff)}</div>
              <div className="slide-blurb">{s.blurb}</div>
              <div className={"slide-pick" + (sel ? " on" : "")}>{sel ? "✓ In tonight's set" : "Tap to pick"}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ============================ TRAVEL: pixel van + road events ============================ */
const PX = {
  skyTop: "#1c1330", skyMid: "#3d2352", glow: "#ff6b9d", moon: "#ffe9a8",
  star: "#fff2c0", hillFar: "#2b1c40", hillNear: "#1d1330",
  road: "#14101c", roadEdge: "#2a2438", dash: "#f4ede0",
  van: "#ff3d7f", vanDk: "#b3164f", vanLt: "#ff8fb5", glass: "#8fe6ff",
  tire: "#0c0c11", hub: "#57e0e8", light: "#ffd36b", tail: "#ff5a5a", stripe: "#57e0e8",
  pole: "#2a2438", sign: "#ffb03a", town: "#332452", neon1: "#57e0e8", neon2: "#ffb03a", rain: "#8fb7ff",
};
const rect = (g, x, y, w, h, c) => { g.fillStyle = c; g.fillRect(Math.round(x), Math.round(y), Math.ceil(w), Math.ceil(h)); };

function drawWheel(g, wx, wy, s, spin) {
  rect(g, wx, wy, 4 * s, 4 * s, PX.tire);
  rect(g, wx + s, wy + s, 2 * s, 2 * s, PX.hub);
  if (Math.floor(spin) % 2 === 0) rect(g, wx + 1.4 * s, wy, s * 1.2, 4 * s, "#0a0a0f");
  else rect(g, wx, wy + 1.4 * s, 4 * s, s * 1.2, "#0a0a0f");
}
// van anchored by top-left of body; wheels sit 11*s below top. faces right.
// Tour bus, facing right.
// Anchor: (x, roadY) — roadY is the road surface the wheels rest on.
// The body is drawn upward from there, so callers never do sprite-height math.
function drawVan(g, x, roadY, s, t, tilt = 0) {
  const W = 22, H = 11;                 // body box, in sprite "pixels"
  const wheelD = 4;                     // wheel is 4x4 sprite px
  // Seat the wheels so their BOTTOM rests exactly on the road, and hang the
  // body so its lower edge overlaps the top of the wheels (skirt covers them).
  const wheelTop = roadY - wheelD * s;
  const y = wheelTop - (H - 2) * s;     // body top (body overlaps wheels by 2px)
  const yb = y + tilt;

  rect(g, x - s, roadY, (W + 2) * s, s, "rgba(0,0,0,0.35)");   // shadow

  // wheels: rear tandem pair + single front axle (rear takes the tilt)
  drawWheel(g, x + 2 * s, wheelTop + (tilt ? tilt : 0), s, t * 8);
  drawWheel(g, x + 5.2 * s, wheelTop + (tilt ? tilt : 0), s, t * 8);
  drawWheel(g, x + 16.5 * s, wheelTop, s, t * 8);

  // main body: one tall continuous box
  rect(g, x, yb, W * s, H * s, PX.van);
  rect(g, x + (W - 1) * s, yb, s, s, PX.skyMid);                // bevel front-top corner
  rect(g, x + s, yb, (W - 3) * s, s, PX.vanLt);                 // roof highlight
  rect(g, x, yb + (H - 2) * s, W * s, 2 * s, PX.vanDk);         // lower skirt shading

  // small destination sign, tucked under the roof at the front
  rect(g, x + 16 * s, yb + 1.3 * s, 4.5 * s, 1.2 * s, PX.sign);

  // big raked windshield, hanging from just under the sign
  rect(g, x + 16.4 * s, yb + 3 * s, 4.6 * s, 4 * s, PX.glass);
  rect(g, x + 15.7 * s, yb + 4 * s, 0.9 * s, 3 * s, PX.glass);  // raked lower edge

  // passenger window row — the detail that reads as "bus"
  for (let i = 0; i < 5; i++) rect(g, x + (2 + i * 2.7) * s, yb + 3 * s, 2.1 * s, 3.4 * s, PX.glass);
  for (let i = 1; i < 5; i++) rect(g, x + (4.1 + (i - 1) * 2.7) * s, yb + 3 * s, 0.6 * s, 3.4 * s, PX.vanDk);

  rect(g, x + 15.2 * s, yb + 3 * s, 0.6 * s, 5 * s, PX.vanDk);  // door seam
  rect(g, x, yb + 7.6 * s, W * s, 0.9 * s, PX.stripe);          // band stripe

  // lights
  rect(g, x + (W - 1) * s, yb + 8.8 * s, s, 1.4 * s, PX.light); // headlight
  rect(g, x, yb + 8.8 * s, s, 1.4 * s, PX.tail);                // taillight
  rect(g, x + (W - 1) * s, yb + 2.2 * s, s, 0.8 * s, PX.light); // marker lamp
}

// ---- static event vignettes (drawn on the same canvas when an event fires) ----
function bgNight(g, W, H, t) {
  rect(g, 0, 0, W, H, PX.skyTop);
  rect(g, 0, H * 0.28, W, H * 0.4, PX.skyMid);
  // stars
  for (let i = 0; i < 26; i++) {
    const sx = (i * 53) % W, sy = (i * 29) % (H * 0.45);
    if ((Math.floor(t * 2) + i) % 5 !== 0) rect(g, sx, sy, 2, 2, PX.star);
  }
  rect(g, W - 34, 16, 14, 14, PX.moon);
  rect(g, W - 30, 12, 8, 4, PX.moon); rect(g, W - 38, 24, 4, 8, PX.moon);
}
function ground(g, W, H) {
  rect(g, 0, H - 34, W, 34, PX.road);
  rect(g, 0, H - 34, W, 2, PX.roadEdge);
}
const SCENES = {
  flat(g, W, H, t) { bgNight(g, W, H, t); ground(g, W, H);
    drawVan(g, 90, H - 34, 3, 0.2, 6); // rear sags (flat)
    rect(g, 66, H - 40, 12, 6, "#0c0c11");                                   // removed tire lying flat
    rect(g, 60, H - 46, 3, 6, "#cfc6b8"); rect(g, 58, H - 48, 7, 3, "#cfc6b8"); }, // jack behind it
  food(g, W, H, t) { bgNight(g, W, H, t);
    rect(g, 20, H - 78, 70, 44, "#2a2438"); rect(g, 24, H - 74, 62, 22, "#3d2352"); // diner
    rect(g, 30, H - 92, 50, 12, PX.neon2); rect(g, 34, H - 89, 8, 6, "#1c1330"); rect(g, 46, H - 89, 8, 6, "#1c1330");
    ground(g, W, H); drawVan(g, 120, H - 34, 3, t); },
  crowd(g, W, H, t) { bgNight(g, W, H, t); ground(g, W, H);
    drawVan(g, 70, H - 34, 3, t);
    for (let i = 0; i < 6; i++) { const px = 140 + i * 14, bob = Math.sin(t * 4 + i) * 2;
      rect(g, px, H - 46 + bob, 6, 10, i % 2 ? PX.neon1 : PX.neon2); rect(g, px + 1, H - 50 + bob, 4, 4, "#ffd9b8"); } },
  cop(g, W, H, t) { bgNight(g, W, H, t); ground(g, W, H);
    drawVan(g, 120, H - 34, 3, t);
    rect(g, 30, H - 46, 40, 14, "#20304a"); rect(g, 36, H - 52, 26, 8, "#20304a"); // cruiser
    const f = Math.floor(t * 6) % 2; rect(g, 34, H - 56, 8, 5, f ? PX.tail : PX.neon1); rect(g, 52, H - 56, 8, 5, f ? PX.neon1 : PX.tail);
    rect(g, 34, H - 34, 10, 10, PX.tire); rect(g, 56, H - 34, 10, 10, PX.tire); },
  scenic(g, W, H, t) { bgNight(g, W, H, t);
    for (let x = 0; x < W; x += 4) { const hh = 70 + Math.sin(x * 0.05) * 10; rect(g, x, hh, 4, H - hh - 34, PX.hillNear); }
    ground(g, W, H); drawVan(g, 96, H - 34, 3, t);
    rect(g, 150, 40, 2, 2, PX.star); rect(g, 170, 54, 2, 2, PX.star); },
  engine(g, W, H, t) { bgNight(g, W, H, t); ground(g, W, H);
    drawVan(g, 96, H - 34, 3, t * 0.2);
    for (let i = 0; i < 5; i++) { const sy = H - 70 - i * 8 - Math.sin(t * 3 + i) * 3; rect(g, 150 + Math.sin(t * 2 + i) * 6, sy, 6 + i, 6 + i, "rgba(180,180,190,0.5)"); } },
  cash(g, W, H, t) { bgNight(g, W, H, t); ground(g, W, H);
    drawVan(g, 96, H - 34, 3, t);
    for (let i = 0; i < 7; i++) { const cy = 30 + ((t * 30 + i * 18) % 80), cx = 60 + i * 20; rect(g, cx, cy, 6, 6, PX.neon2); rect(g, cx + 2, cy + 1, 2, 4, "#7a5200"); } },
  storm(g, W, H, t) { rect(g, 0, 0, W, H, "#161022"); rect(g, 0, 0, W, H * 0.5, "#241830"); ground(g, W, H);
    drawVan(g, 96, H - 34, 3, t);
    for (let i = 0; i < 40; i++) { const rx = (i * 37 + t * 240) % W, ry = (i * 53 + t * 300) % H; rect(g, rx, ry, 1, 6, PX.rain); } },
  // a phone/screen showing a viral clip — used for virality & press
  meme(g, W, H, t) { bgNight(g, W, H, t); ground(g, W, H); drawVan(g, 30, H - 34, 2, t);
    const px = 120, py = 30, pw = 60, ph = 96;
    rect(g, px - 3, py - 3, pw + 6, ph + 6, "#0c0c11"); rect(g, px, py, pw, ph, "#3d2352"); // phone
    rect(g, px + 6, py + 8, pw - 12, 40, "#1c1330");                                        // screen
    for (let i = 0; i < 5; i++) rect(g, px + 8 + i * 9, py + 20 + Math.sin(t * 4 + i) * 6, 6, 12, i % 2 ? PX.neon1 : PX.neon2); // "clip"
    const hearts = Math.floor(t * 3) % 3; for (let i = 0; i <= hearts; i++) rect(g, px + 10 + i * 14, py + ph - 22, 6, 6, PX.van);
    rect(g, px + 8, py + ph - 12, pw - 16, 4, PX.stripe); },
  club(g, W, H, t) { bgNight(g, W, H, t);
    rect(g, 16, H - 84, 80, 50, "#2a2438"); rect(g, 22, H - 96, 68, 14, "#1c1330");   // venue + marquee
    for (let i = 0; i < 8; i++) rect(g, 26 + i * 8, H - 93, 4, 8, (Math.floor(t * 4) + i) % 2 ? PX.neon2 : PX.neon1);
    rect(g, 44, H - 62, 24, 28, "#100b18"); // door
    ground(g, W, H); drawVan(g, 130, H - 34, 3, t); },
  motel(g, W, H, t) { bgNight(g, W, H, t);
    rect(g, 14, H - 70, 92, 36, "#2a2438");                                            // low motel block
    for (let i = 0; i < 5; i++) rect(g, 20 + i * 18, H - 62, 12, 16, i === 2 ? PX.sign : "#1c1330");
    rect(g, 100, H - 96, 6, 30, "#3d2352"); rect(g, 92, H - 100, 22, 12, PX.neon1);    // vertical sign
    ground(g, W, H); drawVan(g, 128, H - 34, 3, t); },
  shop(g, W, H, t) { bgNight(g, W, H, t);
    rect(g, 12, H - 74, 70, 40, "#2a2438"); rect(g, 18, H - 68, 26, 34, "#100b18"); rect(g, 48, H - 68, 26, 34, "#100b18"); // garage bays
    rect(g, 16, H - 86, 62, 10, PX.sign);
    ground(g, W, H); drawVan(g, 116, H - 34, 3, t * 0.3);
    rect(g, 150, H - 44, 3, 10, "#cfc6b8"); rect(g, 149, H - 46, 5, 3, "#cfc6b8"); }, // lift/jack
};

/* ============================ REPUTATION ============================
   Two axes track what the band is becoming, updated after every gig:
     cred    — are you good?  rises on B+ gigs, decays slowly.
     infamy  — are you a memorable disaster?  rises on C/F gigs, sticks longer.
   Past a threshold, infamy flips from pure downside into VIRALITY: the road
   throws "trainwreck" events that pay fans by spectacle, not skill. The event
   pool is filtered/weighted by your current situation (broke, infamous, hot,
   fresh-off-a-bomb...), and many events REFRAME by reputation band — the same
   moment reads as acclaim when you're great and as a viral disaster when you're
   bombing. That reframing is what makes a modest authored catalog feel endless.
   ==================================================================== */
const clamp100 = (n) => Math.max(0, Math.min(100, n));
const INFAMY_VIRAL_AT = 50;   // infamy at which the virality event pool actually unlocks
const REP_GAIN = { S: { c: 18, i: -8 }, A: { c: 12, i: -5 }, B: { c: 6, i: -2 }, C: { c: -4, i: 9 }, F: { c: -9, i: 18 } };

function updateRep(cred, infamy, grade, mods = {}) {
  const g = REP_GAIN[grade] || { c: 0, i: 0 };
  let dC = g.c, dI = g.i;
  if (mods.damageControl && (grade === "F" || grade === "C")) { dC *= 0.5; dI *= 0.75; }
  return { cred: clamp100(cred + dC), infamy: clamp100(infamy + dI) };
}
function decayRep(cred, infamy, mods = {}) {
  return { cred: cred * 0.95, infamy: infamy * (mods.infamySticky ? 0.985 : 0.95) };
}
function repState(cred, infamy) {
  const viral = infamy >= INFAMY_VIRAL_AT;   // is the virality pool actually unlocked?
  if (infamy >= 75) return { id: "notorious", label: "Notorious", blurb: "Famous for all the wrong reasons.", band: "infamous", viral };
  if (infamy >= 50 && infamy >= cred) return { id: "trainwreck", label: "Viral Trainwreck", blurb: "They come to watch it burn.", band: "infamous", viral };
  if (infamy >= 30 && infamy >= cred) return { id: "disaster", label: "Local Disaster", blurb: "A cautionary tale with a setlist.", band: "infamous", viral };
  if (cred >= 80) return { id: "legendary", label: "Legendary", blurb: "Rooms sell out on your name alone.", band: "good", viral };
  if (cred >= 55) return { id: "acclaimed", label: "Acclaimed", blurb: "The critics are paying attention.", band: "good", viral };
  if (cred >= 30) return { id: "rising", label: "Rising", blurb: "Word is getting around.", band: "good", viral };
  if (cred >= 12 || infamy >= 12) return { id: "known", label: "On the Radar", blurb: "People are starting to notice.", band: "neutral", viral };
  return { id: "unknown", label: "Unknowns", blurb: "Nobody knows your name. Yet.", band: "neutral", viral };
}
function activeCtx({ lastGrade, cred, infamy, cash, morale }) {
  const s = new Set(["any"]);
  if (cred >= 55) s.add("hot");
  if (infamy >= INFAMY_VIRAL_AT) s.add("infamous");
  if (cash < 160) s.add("broke");
  if (cash > 1600) s.add("flush");
  if (morale < 35) s.add("lowMorale");
  if (lastGrade === "C" || lastGrade === "F") s.add("afterBomb");
  if (lastGrade === "S" || lastGrade === "A") s.add("afterBanger");
  return s;
}

/* ============================ ROAD EVENTS ============================
   E(id, cat, kind, scene, ctx, title, desc, effect, opts)
   ctx: which situations this event fits (see activeCtx). "any" = always eligible.
   opts.mech: van/mechanical (route bias interacts). opts.scale: magnitude varies.
   opts.vInf / opts.vHot: reputation reframings (title/desc/effect overrides) used
   when the band is currently infamous / acclaimed — this is the virality flip.
   ==================================================================== */
const E = (id, cat, kind, scene, ctx, title, desc, effect, opts = {}) =>
  ({ id, cat, kind, scene, ctx, title, desc, effect, ...opts });

const EVENTS = [
  // ---- mechanical / the van ----
  E("flat", "mech", "bad", "flat", ["any"], "Blowout on the Interstate", "A tire lets go at 70. You limp to a shop and hand over the cash.", { cash: -70 }, { mech: 1, scale: 1 }),
  E("engine", "mech", "bad", "engine", ["any"], "Engine Trouble", "Steam from under the hood. A roadside mechanic fixes it and bleeds you dry.", { cash: -90, morale: -4 }, { mech: 1, scale: 1 }),
  E("belt", "mech", "bad", "engine", ["any"], "Snapped Serpentine Belt", "The dash lights up like a pinball machine. Two hours in a gravel lot.", { cash: -45, morale: -3 }, { mech: 1, scale: 1 }),
  E("battery", "mech", "bad", "shop", ["any"], "Dead Battery", "Left the dome light on. A trucker jumps you for a handshake and a story.", { morale: -3 }, { mech: 1 }),
  E("brakes", "mech", "bad", "shop", ["any"], "Grinding Brakes", "Metal on metal down a grade. You pay for pads and your nerves.", { cash: -60, morale: -4 }, { mech: 1, scale: 1 }),
  E("overheat", "mech", "bad", "engine", ["any"], "Overheating", "Temp needle in the red. You crawl the last miles with the heater blasting.", { cash: -35, morale: -5 }, { mech: 1, scale: 1 }),
  E("tuneup", "mech", "good", "shop", ["flush"], "Proper Tune-Up", "Flush enough to do it right for once. The van purrs; so does the band.", { cash: -80, morale: 8 }, {}),
  E("mirror", "mech", "mix", "shop", ["any"], "Clipped a Mirror", "A gas-pump pillar takes your side mirror. Duct tape and a shrug.", { cash: -15 }, { mech: 1 }),

  // ---- law / authority ----
  E("speed", "law", "bad", "cop", ["any"], "Speed Trap", "Lights in the mirror outside some small town. The ticket stings.", { cash: -55 }, { scale: 1 }),
  E("checkpoint", "law", "mix", "cop", ["any"], "Sobriety Checkpoint", "Everyone's clean, but the search burns an hour and the mood.", { morale: -4 }, {}),
  E("parking", "law", "bad", "cop", ["any"], "Booted in a Tow Zone", "The load-in sign was 'implied,' the cop says. You pay to free the van.", { cash: -40 }, { scale: 1 }),
  E("warning", "law", "good", "cop", ["any"], "Let Off With a Warning", "The trooper's kid is a fan. Autograph on the citation pad, no fine.", { fans: 8, morale: 4 }, {}),
  E("noise", "law", "bad", "cop", ["afterBanger"], "Noise Complaint Follows You", "Last night ran hot. A cruiser 'escorts' you out of the county.", { morale: -3 }, {}),

  // ---- food / health ----
  E("diner", "food", "mix", "food", ["any"], "All-Night Diner", "Pancakes at 2am. Glorious — but the bathroom line eats your lead.", { cash: -15, morale: 6 }, { scale: 1 }),
  E("sushi", "food", "bad", "food", ["any"], "Gas-Station Sushi", "It seemed fine at the time. Regret sets in around mile 40.", { morale: -8 }, { scale: 1 }),
  E("bbq", "food", "good", "food", ["any"], "Roadside BBQ Shack", "A pitmaster feeds the whole band for a T-shirt. Spirits soar.", { morale: 9 }, {}),
  E("foodpoison", "food", "bad", "food", ["lowMorale"], "Bad Clams, Worse Timing", "Half the band is green. The drive is very quiet and very tense.", { morale: -10 }, { scale: 1 }),
  E("coffee", "food", "good", "food", ["any"], "Perfect Truck-Stop Coffee", "Somehow the best cup any of you have ever had. Small joys.", { morale: 4 }, {}),
  E("energy", "food", "mix", "food", ["lowMorale"], "Case of Energy Drinks", "Wired and jittery. You make great time and feel terrible.", { morale: -3 }, {}),

  // ---- weather / nature ----
  E("storm", "weather", "bad", "storm", ["any"], "Thunderstorm", "White-knuckle driving through a downpour. Everyone arrives frayed.", { morale: -5 }, { scale: 1 }),
  E("fog", "weather", "bad", "storm", ["any"], "Blinding Fog", "Twenty miles at twenty miles an hour. You lose the time and the nerve.", { morale: -3 }, {}),
  E("sunrise", "weather", "good", "scenic", ["any"], "Sunrise Over the Plains", "The whole sky goes pink. For a minute nobody's tired at all.", { morale: 7 }, {}),
  E("heatwave", "weather", "bad", "storm", ["any"], "AC Dies in a Heatwave", "Windows down, shirts off, tempers short. A rough, sweaty haul.", { morale: -6 }, { scale: 1 }),
  E("snow", "weather", "mix", "storm", ["any"], "Surprise Snow Squall", "Beautiful and terrifying. You chain up and inch forward, awed.", { morale: 2, cash: -15 }, {}),
  E("meteor", "weather", "good", "scenic", ["any"], "Meteor Shower", "You pull over and lie on the roof. Nobody says it, but it helps.", { morale: 8 }, {}),

  // ---- fans / social (the good stuff) ----
  E("radio", "fan", "good", "crowd", ["any"], "Local Radio Spot", "A college DJ spins your single on the overnight show. New ears tune in.", { fans: 18 }, { scale: 1 }),
  E("lot", "fan", "good", "crowd", ["any"], "Parking-Lot Set", "You busk in a gas-station lot for gas money. A small crowd, a big lift.", { fans: 12, morale: 4 }, { scale: 1 }),
  E("viral", "fan", "good", "meme", ["any"], "The Clip Goes Viral",
    "Someone filmed last night's encore. By sunrise it's everywhere.", { fans: 26 },
    { scale: 1,
      vInf: { title: "You're a Meme Now", desc: "The clip is everywhere — because it's a disaster. They can't look away.", effect: { fans: 40 } },
      vHot: { title: "Critics Share the Clip", desc: "A tastemaker reposts your encore. The right people are watching.", effect: { fans: 34 } } }),
  E("streetteam", "fan", "good", "crowd", ["any"], "Street Team Shows Up", "Kids with your logo Sharpied on their jackets flyer the whole town.", { fans: 15 }, { scale: 1 }),
  E("cover", "fan", "good", "crowd", ["any"], "A Cover Band Covers You", "Some bar act is playing your song. You've been covered. It's surreal.", { fans: 10, morale: 5 }, {}),
  E("wedding", "fan", "mix", "crowd", ["broke"], "Wedding Gig Detour", "A desperate bride books you cash-in-hand. Not the vibe. Pays the gas.", { cash: 90, morale: -4 }, { scale: 1 }),
  E("mailbag", "fan", "good", "crowd", ["any"], "Fan Mail Catches Up", "A stack of letters forwarded from home. Someone drew the whole band.", { morale: 6 }, {}),
  E("hometown", "fan", "good", "crowd", ["hot"], "Hometown Heroes", "Word reached home base. They're proud, and they're buying tickets.", { fans: 22, morale: 5 }, { scale: 1 }),

  // ---- industry / music biz ----
  E("sync", "biz", "good", "cash", ["hot"], "Sync Placement", "A show licenses your track for a montage. Real money for once.", { cash: 140, fans: 10 }, { scale: 1 }),
  E("label", "biz", "mix", "club", ["hot"], "A&R in the Booth", "A label scout catches the set. Flattering, non-committal, exhausting.", { fans: 14, morale: -2 }, {}),
  E("manager", "biz", "mix", "club", ["any"], "Smooth-Talking Manager", "He promises the world for 20%. You politely, nervously decline.", { morale: -3 }, {}),
  E("festival", "biz", "good", "crowd", ["hot"], "Festival Slot Opens Up", "A dropout means a mid-afternoon slot. Small stage, big exposure.", { fans: 30 }, { scale: 1 }),
  E("merchdeal", "biz", "good", "cash", ["any"], "Merch Restock Bargain", "A shop overprinted someone else's shirts. You buy blanks cheap.", { cash: -25, fans: 6 }, {}),
  E("payola", "biz", "bad", "cash", ["broke"], "Pay-to-Play Trap", "The 'promoter' wants a buy-on. You front it and learn a lesson.", { cash: -60 }, { scale: 1 }),

  // ---- money / finance ----
  E("tips", "money", "good", "cash", ["any"], "Fuller Than You Thought", "The tip jar had way more than you counted. Gas is on the band.", { cash: 65 }, { scale: 1 }),
  E("atm", "money", "bad", "cash", ["any"], "Sketchy ATM Fee", "Only machine for 40 miles. It charges like it knows.", { cash: -12 }, {}),
  E("busk", "money", "good", "crowd", ["broke"], "Busking Pays Off", "An hour on a corner and a hat full of crumpled fives. Enough for gas.", { cash: 45 }, { scale: 1 }),
  E("wallet", "money", "bad", "cash", ["any"], "Lost the Gas Money", "A pocket with a hole. The whole float, gone somewhere on I-80.", { cash: -50 }, { scale: 1 }),
  E("scratch", "money", "good", "cash", ["broke"], "Lucky Scratch Ticket", "Bought on a whim with the last dollar. It hits. Barely, but it hits.", { cash: 80 }, { scale: 1 }),
  E("loanshark", "money", "mix", "cash", ["broke"], "A Guy Named Sal", "He'll spot you cash tonight. You do not think about tomorrow.", { cash: 120, morale: -6 }, { scale: 1 }),

  // ---- roadside / random ----
  E("roadie", "road", "good", "scenic", ["any"], "Hitchhiking Roadie", "You pick up a fan who can coil cables and read a room. Good energy.", { morale: 5 }, {}),
  E("overlook", "road", "good", "scenic", ["any"], "Scenic Overlook", "You pull over at a canyon rim at dawn. Nobody speaks. Everybody breathes.", { morale: 8 }, { scale: 1 }),
  E("worldball", "road", "good", "scenic", ["any"], "World's Largest Ball of Twine", "Dumb, glorious, exactly what the trip needed. Photos for days.", { morale: 6 }, {}),
  E("detour", "road", "bad", "storm", ["any"], "Endless Construction Detour", "Orange cones to the horizon. You lose two hours and your minds.", { morale: -4 }, {}),
  E("hitcher", "road", "mix", "scenic", ["any"], "Chatty Hitchhiker", "Great stories, questionable smell. The miles fly; the van reeks.", { morale: 2 }, {}),
  E("breakdown_help", "road", "good", "scenic", ["lowMorale"], "A Stranger Helps", "You help push a stalled car; the driver knows a shortcut and a diner.", { morale: 5, cash: 10 }, {}),
  E("photo", "road", "good", "scenic", ["any"], "Perfect Band Photo", "Golden hour, a chain-link fence, a lucky shot. That's the album cover.", { morale: 5, fans: 6 }, {}),

  // ---- band drama / morale ----
  E("argument", "band", "bad", "motel", ["lowMorale"], "The Van Argument", "Six hours, one topic, no winner. Everyone's raw by the state line.", { morale: -7 }, { scale: 1 }),
  E("motel", "band", "good", "motel", ["any"], "Cheap Motel, Good Pool", "A dive with a working pool and free waffles. Somehow, restorative.", { morale: 7, cash: -30 }, {}),
  E("jam", "band", "good", "motel", ["any"], "Parking-Lot Jam", "An unplugged jam under a sodium light. You remember why you do this.", { morale: 8 }, {}),
  E("quit", "band", "bad", "motel", ["lowMorale"], "Someone Threatens to Quit", "It blows over by morning. It always does. Mostly.", { morale: -5, fans: -4 }, {}),
  E("birthday", "band", "good", "motel", ["any"], "Surprise Birthday", "Gas-station cake, one candle, off-key singing. A good night.", { morale: 9 }, {}),

  // ---- absurd / weird ----
  E("ufo", "weird", "mix", "storm", ["any"], "Lights in the Sky", "Probably a drone. Probably. Nobody sleeps; everybody's wired.", { morale: 3 }, {}),
  E("cult", "weird", "mix", "scenic", ["any"], "Roadside 'Congregation'", "They love your van's vibe and offer 'membership.' You floor it, laughing.", { morale: 4 }, {}),
  E("goat", "weird", "good", "scenic", ["any"], "A Goat in the Road", "You stop for a goat. It stares into your soul. You feel changed.", { morale: 5 }, {}),
  E("wrongturn", "weird", "mix", "storm", ["any"], "Gloriously Wrong Turn", "Ninety minutes lost leads to the best taco stand in America.", { morale: 6, cash: -18 }, {}),

  // ---- INFAMY: virality by spectacle (only when infamous) ----
  E("tabloid", "infamy", "good", "meme", ["infamous"], "Tabloid Pays for the Story", "A gossip site buys the 'worst band alive' angle. Cash is cash.", { cash: 120, fans: 20 }, { scale: 1, viral: 1 }),
  E("hatewatch", "infamy", "good", "meme", ["infamous"], "Hate-Watch Army", "They're streaming your sets to laugh. The play count doesn't care why.", { fans: 45 }, { scale: 1, viral: 1 }),
  E("meltdownmeme", "infamy", "good", "meme", ["infamous"], "The Meltdown Is a Meme", "Your onstage disaster is a reaction GIF now. Infamy is a kind of fame.", { fans: 38, morale: -3 }, { scale: 1, viral: 1 }),
  E("antifans", "infamy", "good", "crowd", ["infamous"], "Anti-Fans Buy Tickets", "People come specifically to heckle. They still pay at the door.", { cash: 70, fans: 15 }, { scale: 1, viral: 1 }),
  E("worstlist", "infamy", "good", "meme", ["infamous"], "'Worst Shows of the Year'", "A blogger ranks you #1. The link goes everywhere. So does your name.", { fans: 30 }, { viral: 1 }),
  E("sponsorchaos", "infamy", "mix", "cash", ["infamous"], "Chaos Energy Sponsorship", "An energy drink wants the trainwreck brand. Free product, weird looks.", { cash: 60, morale: -4 }, { viral: 1 }),
  E("challenge", "infamy", "good", "meme", ["infamous"], "The Booing Challenge", "Fans film themselves booing along. It's a whole trend. It's yours.", { fans: 42 }, { scale: 1, viral: 1 }),
  E("cultfollow", "infamy", "good", "crowd", ["infamous"], "An Actual Cult Following", "The irony fans curdled into real devotion. They'd follow you anywhere.", { fans: 28, morale: 6 }, { scale: 1, viral: 1 }),

  // ---- ACCLAIM: when you're genuinely hot ----
  E("review", "acclaim", "good", "meme", ["hot"], "Glowing Review", "A real critic uses the word 'vital.' You reread it at every stop light.", { fans: 24, morale: 8 }, { scale: 1 }),
  E("openslot", "acclaim", "good", "club", ["hot"], "Opening-Slot Offer", "A bigger act wants you on the bill. Their crowd becomes half yours.", { fans: 40 }, { scale: 1 }),
  E("bidwar", "acclaim", "good", "cash", ["hot"], "Two Promoters, One Night", "They're bidding for you. You've never felt so wanted or so tired.", { cash: 130 }, { scale: 1 }),
  E("playlist", "acclaim", "good", "meme", ["hot"], "Added to The Playlist", "An editorial playlist picks you up. The streams do not stop.", { fans: 35 }, { scale: 1 }),

  // ---- AFTER A BOMB (recent C/F) ----
  E("regroup", "afterbomb", "good", "motel", ["afterBomb"], "Honest Band Meeting", "You talk about the bad set instead of drinking about it. It helps.", { morale: 8 }, {}),
  E("refund", "afterbomb", "bad", "cash", ["afterBomb"], "Refund Demands", "A few from last night want their money back. The promoter obliges — with yours.", { cash: -40 }, { scale: 1 }),
  E("clipbad", "afterbomb", "mix", "meme", ["afterBomb"], "The Bad Set Got Filmed", "It's online. It's rough. A few people think the jankiness is 'punk.'", { fans: 8, morale: -4 }, { vInf: { title: "The Bad Set Blows Up", desc: "Turns out people love a disaster. The clip outperforms your good ones.", effect: { fans: 34 } } }),

  // ---- AFTER A BANGER (recent S/A) ----
  E("encoredemand", "afterbanger", "good", "crowd", ["afterBanger"], "They Chased the Van", "Fans followed you to the gas station to say last night mattered.", { fans: 16, morale: 6 }, { scale: 1 }),
  E("guestlist", "afterbanger", "good", "club", ["afterBanger"], "Word Traveled Ahead", "The next town already heard. Advance ticket sales are climbing.", { fans: 20 }, { scale: 1 }),

  // ---- batch two: more van/mechanical ----
  E("alternator", "mech", "bad", "shop", ["any"], "Alternator Quits", "Everything electric dies one by one. You coast into a lot on faith.", { cash: -65, morale: -3 }, { mech: 1, scale: 1 }),
  E("gascap", "mech", "mix", "shop", ["broke"], "Siphoned Gas Tank", "Someone helped themselves overnight. At least they left the cap.", { cash: -30 }, { mech: 1 }),
  E("newtires", "mech", "good", "shop", ["flush"], "Fresh Set of Tires", "You finally replace the bald ones. The van tracks straight and true.", { cash: -110, morale: 6 }, { scale: 1 }),
  E("gremlin", "mech", "mix", "engine", ["any"], "Phantom Rattle", "A rattle nobody can find. You learn to live with it. It becomes family.", { morale: -2 }, { mech: 1 }),
  E("jumpstart", "mech", "good", "shop", ["lowMorale"], "A Trucker Jumps You", "Big rig, bigger heart. Coffee, a jump, and forty minutes of good advice.", { morale: 6 }, {}),

  // ---- more law ----
  E("impound", "law", "bad", "cop", ["broke"], "Van Nearly Impounded", "Expired tags in the wrong county. You talk fast and pay faster.", { cash: -75 }, { scale: 1 }),
  E("escort", "law", "good", "cop", ["hot"], "Police Escort", "A sheriff who loves the record clears your lane to the venue. Surreal.", { morale: 5, fans: 6 }, {}),
  E("busk_ticket", "law", "bad", "cop", ["broke"], "Ticketed for Busking", "No permit, says the officer. The corner that fed you now costs you.", { cash: -25 }, {}),

  // ---- more food/health ----
  E("potluck", "food", "good", "food", ["lowMorale"], "Fan Potluck", "A local fan's family feeds the whole band a home-cooked meal. Tears, maybe.", { morale: 10 }, {}),
  E("hotdog", "food", "mix", "food", ["broke"], "Two-for-One Hot Dogs", "Dinner is a gas-station special. Cheap, filling, deeply regrettable.", { cash: -6, morale: -2 }, {}),
  E("farmstand", "food", "good", "scenic", ["any"], "Roadside Farm Stand", "Peaches the size of softballs. The van smells incredible for once.", { morale: 5 }, {}),

  // ---- more weather ----
  E("rainbow", "weather", "good", "scenic", ["afterBomb"], "Double Rainbow", "After the storm, the sky shows off. It feels like a sign. It isn't. Still.", { morale: 7 }, {}),
  E("windstorm", "weather", "bad", "storm", ["any"], "Crosswind Battering", "The van gets shoved lane to lane for an hour. White knuckles all around.", { morale: -4 }, { scale: 1 }),
  E("dust", "weather", "bad", "storm", ["any"], "Dust Storm", "Visibility to zero. You pull over and wait it out, coughing and quiet.", { morale: -3, cash: -10 }, {}),

  // ---- more fans/social with reframings ----
  E("busker_duet", "fan", "good", "crowd", ["any"], "Impromptu Street Duet", "You join a busker for one song. A crowd forms. Phones come out.", { fans: 14, morale: 4 }, { scale: 1,
    vInf: { title: "You Ruin a Busker's Set", desc: "You jump in uninvited and it's a disaster — which is, of course, content.", effect: { fans: 26 } } }),
  E("mural", "fan", "good", "crowd", ["hot"], "Someone Painted a Mural", "Your logo, twenty feet tall, on a brick wall downtown. You're somebody here.", { fans: 20, morale: 6 }, { scale: 1 }),
  E("fanart", "fan", "good", "crowd", ["any"], "Flood of Fan Art", "The tag is full of drawings of the band. Some are good. All are kind.", { morale: 7, fans: 5 }, {}),
  E("radiorequest", "fan", "good", "meme", ["any"], "Most-Requested Track", "A station says you're their #1 call-in. The DJ sounds baffled and delighted.", { fans: 22 }, { scale: 1,
    vInf: { title: "Requested 'Ironically'", desc: "The call-ins are a bit. The spins are real. The chart doesn't editorialize.", effect: { fans: 30 } } }),
  E("blooddrive", "fan", "good", "crowd", ["any"], "You Headline a Blood Drive", "A charity set for zero money and infinite goodwill. Worth it.", { fans: 12, morale: 6 }, {}),

  // ---- more industry ----
  E("distro", "biz", "good", "cash", ["hot"], "Distro Deal", "A small distributor wants your vinyl in real shops. Modest check, big feeling.", { cash: 90, fans: 8 }, { scale: 1 }),
  E("producer", "biz", "mix", "club", ["hot"], "A Producer's Card", "Someone with real credits slips you a number. You'll definitely call. Maybe.", { morale: 4 }, {}),
  E("bootleg", "biz", "mix", "meme", ["any"], "Bootleggers Found You", "Someone's selling unauthorized shirts. Annoying — but it means you matter.", { fans: 10, cash: -15 }, {}),
  E("sponsordrop", "biz", "bad", "cash", ["afterBomb"], "Sponsor Gets Cold Feet", "A brand that was 'interested' stops returning calls after the bad night.", { cash: -20, morale: -3 }, {}),

  // ---- more money ----
  E("crowdfund", "money", "good", "cash", ["broke"], "Fans Pass the Hat", "Word got out you were broke. An online tip jar fills up overnight.", { cash: 100, morale: 8 }, { scale: 1 }),
  E("gaswar", "money", "good", "cash", ["any"], "Local Gas War", "Two stations undercutting each other. You fill up for almost nothing.", { cash: 30 }, {}),
  E("bettips", "money", "mix", "cash", ["flush"], "Backstage Poker", "Feeling flush, you sit in on the promoter's game. It goes... about even.", { cash: -10 }, { scale: 1 }),
  E("busted_amp", "money", "bad", "cash", ["any"], "Amp Blows a Tube", "It dies mid-soundcheck. Replacement tubes aren't cheap or close.", { cash: -45 }, { scale: 1 }),

  // ---- more roadside ----
  E("diner_jukebox", "road", "good", "food", ["any"], "Your Song on a Jukebox", "You feed it a quarter and there you are, between Patsy Cline and Journey.", { morale: 8 }, {}),
  E("ghosttown", "road", "mix", "scenic", ["any"], "A Real Ghost Town", "You wander an abandoned main street at dusk. Eerie, gorgeous, a little sad.", { morale: 3 }, {}),
  E("hotspring", "road", "good", "scenic", ["lowMorale"], "Hidden Hot Spring", "A local tips you off. An hour of steam and stars resets the whole band.", { morale: 11 }, {}),
  E("rodeo", "road", "good", "crowd", ["any"], "You Stumble Into a Rodeo", "They let you play the beer tent. Cowboys are a surprisingly great crowd.", { fans: 14, cash: 20 }, { scale: 1 }),

  // ---- more band drama ----
  E("reconcile", "band", "good", "motel", ["lowMorale"], "The Air Clears", "Whatever's been simmering finally gets said, and then it's fine. Better, even.", { morale: 9 }, {}),
  E("newsong", "band", "good", "motel", ["any"], "A New Song Arrives", "It falls out of the air in a motel parking lot at 3am. It's good. It's really good.", { morale: 8, fans: 4 }, {}),
  E("sick", "band", "bad", "motel", ["any"], "Someone's Getting Sick", "A scratchy throat becomes a fever. You reshuffle parts and push on.", { morale: -6 }, { scale: 1 }),

  // ---- more absurd ----
  E("bigfoot", "weird", "good", "scenic", ["any"], "Definitely Bigfoot", "Something crossed the road up ahead. You will argue about it for years.", { morale: 6, fans: 3 }, {}),
  E("timezone", "weird", "mix", "storm", ["any"], "Lost an Hour to a Time Zone", "You cross a line on the map and the clock lies to you. Doors in ten minutes?!", { morale: -3 }, {}),
  E("radio_static", "weird", "mix", "storm", ["lowMorale"], "A Voice on the Static", "Between stations, a number station counts in a language nobody knows. Spooky miles.", { morale: -2 }, {}),

  // ---- more INFAMY virality ----
  E("roast", "infamy", "good", "meme", ["infamous"], "A Comedian Roasts You", "A late-night host does three minutes on your disaster tour. Ratings are ratings.", { fans: 44 }, { scale: 1, viral: 1 }),
  E("reactvid", "infamy", "good", "meme", ["infamous"], "Reaction-Video Fodder", "Every 'this is the worst band' video sends a few curious souls your way.", { fans: 32 }, { scale: 1, viral: 1 }),
  E("darkfans", "infamy", "mix", "crowd", ["infamous"], "The Wrong Kind of Devoted", "A cluster of fans loves you *because* it's chaos. Intense. A little scary.", { fans: 24, morale: -3 }, { viral: 1 }),
  E("gigposter", "infamy", "good", "meme", ["infamous"], "'Legendarily Bad' Poster", "A design blog features a poster mocking your set. It's beautiful. It's everywhere.", { fans: 26 }, { viral: 1 }),
  E("dare", "infamy", "good", "crowd", ["infamous"], "People Dare Friends to Come", "Attendance as a challenge. 'Bet you can't sit through the whole thing.' They can't. They pay.", { cash: 55, fans: 18 }, { scale: 1, viral: 1 }),
  E("nft", "infamy", "mix", "cash", ["infamous"], "A Weird Guy Wants the Rights", "Someone wants to mint your worst moment. The money's real; the vibe is not.", { cash: 90, morale: -5 }, { viral: 1 }),

  // ---- more ACCLAIM ----
  E("npr", "acclaim", "good", "meme", ["hot"], "Public-Radio Session", "A tasteful, hushed on-air session. Suddenly your parents' friends are fans.", { fans: 28, morale: 6 }, { scale: 1 }),
  E("bestof", "acclaim", "good", "meme", ["hot"], "'Best New Act' List", "A respected list includes you. You screenshot it eleven times.", { fans: 30 }, { scale: 1 }),
  E("residency", "acclaim", "good", "club", ["hot"], "Residency Offer", "A cool room wants you monthly. Stability! A word you'd forgotten.", { cash: 60, fans: 16 }, {}),
  E("mentor", "acclaim", "good", "club", ["hot"], "A Legend Says Hi", "An artist you idolize catches the set and nods once. You'll ride that for a year.", { morale: 12 }, {}),

  // ---- more broke-specific ----
  E("pawn", "money", "mix", "cash", ["broke"], "Pawn the Backup Guitar", "Rent for the road. You'll buy it back. You tell yourself you'll buy it back.", { cash: 85, morale: -6 }, { scale: 1 }),
  E("sleep_van", "band", "mix", "motel", ["broke"], "Everyone Sleeps in the Van", "No motel tonight. Cramped, cold, weirdly bonding. You save the cash.", { cash: 0, morale: -3 }, {}),
  E("dumpster", "money", "mix", "food", ["broke"], "Bakery Closing-Time Haul", "The kind clerk gives you the day's unsold bread. Feast of champions.", { morale: 4 }, {}),

  // ---- more flush-specific ----
  E("upgrade_gear", "biz", "good", "cash", ["flush"], "Finally, New Gear", "You buy the pedal you've wanted for a year. It sounds like money well spent.", { cash: -120, morale: 8, fans: 4 }, {}),
  E("hire_help", "biz", "good", "club", ["flush"], "Hire a Merch Kid", "Someone to run the table means you actually rest. Worth every dollar.", { cash: -60, morale: 7 }, {}),

  // ---- more after-bomb / after-banger ----
  E("pep_talk", "afterbomb", "good", "motel", ["afterBomb"], "The Pep Talk", "The oldest member says the thing everyone needed to hear. You believe it, mostly.", { morale: 9 }, {}),
  E("walkout_refund", "afterbomb", "bad", "cash", ["afterBomb"], "The Walkout", "Enough people left early that the club claws back part of the guarantee.", { cash: -35 }, { scale: 1 }),
  E("secondchance", "afterbanger", "good", "club", ["afterBanger"], "Promoter Rebooks You On the Spot", "Last night was that good. He wants you back, better slot, more money.", { cash: 70, fans: 12 }, { scale: 1 }),
  E("radio_after", "afterbanger", "good", "meme", ["afterBanger"], "The Set Gets Bootlegged (Nicely)", "A fan's clean recording of the great set circulates. Free, glowing advertising.", { fans: 24 }, { scale: 1 }),
];

/* ============================ ROUTES ============================
   Between stops, the player picks a road. Each route is a gamble with its own
   guaranteed effect (applied on arrival), how eventful it is (eventChance), and
   a bias over which KIND of road event tends to fire. This is the layer that
   turns travel from a cutscene into a decision. Interstate is always offered as
   the safe baseline; two others are drawn from the pool for variety.
   ==================================================================== */
const ROUTES = [
  { id: "interstate", name: "The Interstate", icon: "straight", accent: "#57E0E8", risk: "low",
    blurb: "Fast, flat, forgettable. Not much happens out here.",
    guaranteed: {}, eventChance: 0.35, bias: { good: 1, bad: 1, mix: 1 }, mild: true, always: true },
  { id: "scenic", name: "Scenic Route", icon: "winding", accent: "#8CFF9E", risk: "med",
    blurb: "Longer and prettier. The band unwinds — but the road's alive.",
    guaranteed: { morale: 6 }, eventChance: 0.75, bias: { good: 3, bad: 1, mix: 2 } },
  { id: "shortcut", name: "The Shortcut", icon: "rough", accent: "#FF3D7F", risk: "high",
    blurb: "Cuts miles and saves on gas — if the van holds together.",
    guaranteed: { cash: 50 }, eventChance: 0.7, bias: { good: 1, bad: 3, mix: 1 }, mechBoost: 3 },
  { id: "coastal", name: "Coastal Highway", icon: "winding", accent: "#6DB3FF", risk: "med",
    blurb: "Windows down, salt air. Spirits soar; the tolls sting a little.",
    guaranteed: { morale: 9, cash: -20 }, eventChance: 0.6, bias: { good: 4, bad: 1, mix: 1 } },
  { id: "backroad", name: "Backroads", icon: "rough", accent: "#FFB03A", risk: "high",
    blurb: "No map, no signs. Anything can happen out here — and usually does.",
    guaranteed: {}, eventChance: 0.9, bias: { good: 1, bad: 1, mix: 1 } },
];

// Interstate + 2 random others, for a 3-way fork with a guaranteed safe option.
function pickRoutes() {
  const others = ROUTES.filter((r) => !r.always).map((r) => r.id);
  for (let i = others.length - 1; i > 0; i--) { const j = (Math.random() * (i + 1)) | 0; [others[i], others[j]] = [others[j], others[i]]; }
  return ["interstate", others[0], others[1]].map((id) => ROUTES.find((r) => r.id === id));
}

// Scale an effect's numbers by a magnitude multiplier (keeps sign, min |1|).
function scaleEffect(effect, m) {
  const out = {};
  for (const [k, v] of Object.entries(effect)) {
    const s = Math.round(v * m);
    out[k] = s === 0 ? (v > 0 ? 1 : -1) : s;
  }
  return out;
}
// Merge a reputation variant (title/desc/effect) over the base event.
function applyVariant(ev, v) {
  return { ...ev, title: v.title ?? ev.title, desc: v.desc ?? ev.desc, effect: v.effect ?? ev.effect, viral: v.viral ?? ev.viral };
}

// Route- AND situation-aware event roll. ctx carries the band's current state so
// the pool responds to how you're doing and reframes by reputation.
function rollRouteEvent(route, ctx = {}) {
  if (Math.random() > route.eventChance) return null;
  const active = activeCtx(ctx);
  const inf = ctx.infamy || 0;
  const pool = EVENTS.filter((e) => e.ctx.some((t) => active.has(t)));
  if (pool.length === 0) return null;
  const weights = pool.map((e) => {
    let w = (route.bias && route.bias[e.kind]) ?? 1;
    if (route.mechBoost && e.mech) w *= route.mechBoost;
    if (route.mild && e.mech) w *= 0.25;
    // surface situation-specific events (broke/infamous/hot/afterBomb...) when live
    const specific = e.ctx.filter((t) => t !== "any");
    if (specific.length && specific.some((t) => active.has(t))) w *= 3.4;
    // Once you're genuinely infamous, virality is the STORY — it should crowd out
    // the ordinary road. Scales with how notorious you are.
    if (e.cat === "infamy" && active.has("infamous")) w *= 2 + (inf / 100) * 5;
    // ...and the "aftermath of a bad night" beats stop mattering once you ARE the bad night
    if (e.cat === "afterbomb" && e.kind === "bad" && inf >= 50) w *= 0.35;
    return w;
  });
  const total = weights.reduce((a, b) => a + b, 0);
  let r = Math.random() * total, base = pool[pool.length - 1];
  for (let i = 0; i < pool.length; i++) { r -= weights[i]; if (r <= 0) { base = pool[i]; break; } }

  // reputation reframing: same moment, different meaning by band
  let ev = { ...base, effect: { ...base.effect } };
  if (ctx.repBand === "infamous" && base.vInf) ev = applyVariant(ev, base.vInf);
  else if (ctx.repBand === "good" && base.vHot) ev = applyVariant(ev, base.vHot);
  // magnitude tier
  if (base.scale) { const tiers = [0.7, 1.0, 1.35]; ev.effect = scaleEffect(ev.effect, tiers[(Math.random() * tiers.length) | 0]); }
  // VIRALITY SNOWBALL: notoriety compounds — the more infamous you are, the harder
  // a viral moment hits. This is what makes "famous for being bad" a real path.
  if (ev.viral && ev.effect.fans > 0) {
    ev.effect = { ...ev.effect, fans: Math.round(ev.effect.fans * (0.8 + (inf / 100) * 1.6)) };
  }
  return ev;
}

// small crisp pixel road icon per route flavor
function RouteIcon({ kind, color }) {
  const road = "#2a2438";
  const common = { width: 46, height: 58, viewBox: "0 0 32 40", shapeRendering: "crispEdges", "aria-hidden": true };
  if (kind === "winding") {
    const segs = [[6, 0], [10, 5], [14, 10], [18, 15], [14, 20], [10, 25], [12, 30], [16, 35]];
    return (
      <svg {...common}>
        {segs.map(([x, y], i) => <rect key={i} x={x} y={y} width="11" height="6" fill={road} />)}
        {segs.filter((_, i) => i % 2 === 0).map(([x, y], i) => <rect key={"d" + i} x={x + 4} y={y + 1} width="2" height="3" fill={color} />)}
      </svg>
    );
  }
  if (kind === "rough") {
    const chunks = [0, 6, 13, 19, 26, 33];
    return (
      <svg {...common}>
        {chunks.map((y) => <rect key={y} x={11 + ((y % 12 === 0) ? 0 : 1)} y={y} width="10" height="4" fill={road} />)}
        <rect x="7" y="9" width="3" height="3" fill="#6b5a44" />
        <rect x="22" y="22" width="3" height="3" fill="#6b5a44" />
        {[2, 15, 28].map((y) => <rect key={"d" + y} x="15" y={y} width="2" height="3" fill={color} />)}
      </svg>
    );
  }
  // straight (interstate)
  return (
    <svg {...common}>
      <rect x="11" y="0" width="10" height="40" fill={road} />
      {[2, 10, 18, 26, 34].map((y) => <rect key={y} x="15" y={y} width="2" height="5" fill={color} />)}
    </svg>
  );
}

// tiny pixel-bus SVG used as the moving marker on the route ribbon
function VanIcon() {
  return (
    <svg viewBox="0 0 24 14" width="28" height="17" shapeRendering="crispEdges" aria-hidden="true">
      <rect x="0" y="1" width="22" height="10" fill="#ff3d7f" />
      <rect x="21" y="1" width="1" height="1" fill="none" />
      <rect x="1" y="1" width="19" height="1" fill="#ff8fb5" />
      <rect x="0" y="9" width="22" height="2" fill="#b3164f" />
      <rect x="15" y="2" width="5" height="1" fill="#ffb03a" />
      <rect x="2" y="3" width="2" height="3" fill="#8fe6ff" />
      <rect x="5" y="3" width="2" height="3" fill="#8fe6ff" />
      <rect x="8" y="3" width="2" height="3" fill="#8fe6ff" />
      <rect x="11" y="3" width="2" height="3" fill="#8fe6ff" />
      <rect x="17" y="3" width="3" height="3" fill="#8fe6ff" />
      <rect x="0" y="7" width="22" height="1" fill="#57e0e8" />
      <rect x="2" y="11" width="3" height="3" fill="#0c0c11" />
      <rect x="16" y="11" width="3" height="3" fill="#0c0c11" />
      <rect x="21" y="8" width="1" height="2" fill="#ffd36b" />
      <rect x="0" y="8" width="1" height="2" fill="#ff5a5a" />
    </svg>
  );
}

function TravelScene({ fromLabel, toLabel, route, event, onDone }) {
  const canvasRef = useRef(null);
  const fillRef = useRef(null);
  const vanRef = useRef(null);
  const [revealed, setRevealed] = useState(false);
  const DUR = 2.8;

  useEffect(() => {
    const cv = canvasRef.current;
    const g = cv.getContext("2d");
    const W = cv.width, H = cv.height;
    let raf, start, done = false;

    const drive = (t, progress) => {
      bgNight(g, W, H, t);
      // parallax hills
      const off = t * 10;
      for (let x = 0; x < W; x += 4) { const hh = 84 + Math.sin((x + off) * 0.04) * 5; rect(g, x, hh, 4, H - hh - 34, PX.hillFar); }
      for (let x = 0; x < W; x += 4) { const hh = 92 + Math.sin((x + off * 1.7) * 0.05) * 4; rect(g, x, hh, 4, H - hh - 34, PX.hillNear); }
      ground(g, W, H);
      // roadside poles (fast parallax)
      for (let i = 0; i < 6; i++) {
        const px = (i * 70 - (t * 80) % 70 + W) % (W + 70) - 20;
        rect(g, px, H - 66, 3, 22, PX.pole); rect(g, px - 3, H - 66, 12, 6, PX.sign);
      }
      // center dashes
      for (let i = 0; i < 10; i++) { const dx = (i * 32 - (t * 150) % 32 + W) % (W + 32) - 16; rect(g, dx, H - 16, 14, 3, PX.dash); }
      // van bobbing
      const bob = Math.sin(t * 11) * 2;
      drawVan(g, 92, H - 34 + bob, 3, t);
      // headlight beam, cast from the bus's front headlight
      g.fillStyle = "rgba(255,211,107,0.12)"; g.beginPath();
      g.moveTo(158, H - 34 - 9 + bob); g.lineTo(205, H - 50); g.lineTo(205, H - 30); g.closePath(); g.fill();
    };

    const loop = (ts) => {
      if (!start) start = ts;
      const t = (ts - start) / 1000;
      const progress = Math.min(1, t / DUR);
      if (fillRef.current) fillRef.current.style.width = (progress * 100) + "%";
      if (vanRef.current) vanRef.current.style.left = (progress * 100) + "%";
      if (!done && progress < 1) {
        drive(t, progress);
        raf = requestAnimationFrame(loop);
      } else if (!done) {
        done = true;
        if (event) { const draw = () => { SCENES[event.scene](g, W, H, (performance.now() - start) / 1000); raf = requestAnimationFrame(draw); }; draw(); }
        else { const draw = () => { drive((performance.now() - start) / 1000, 1); raf = requestAnimationFrame(draw); }; draw(); }
        setRevealed(true);
      }
    };
    raf = requestAnimationFrame(loop);

    const skip = () => { if (!done) start = performance.now() - DUR * 1000; };
    cv.addEventListener("pointerdown", skip);
    return () => { cancelAnimationFrame(raf); cv.removeEventListener("pointerdown", skip); };
  }, [event]);

  const fx = event?.effect || {};
  const gr = route?.guaranteed || {};
  const hasGuaranteed = gr.cash != null || gr.fans != null || gr.morale != null;
  const routeChips = hasGuaranteed && (
    <div className="event-fx route-fx">
      <span className="route-fx-label">{route.name}:</span>
      {gr.cash != null && <span className={"fx " + (gr.cash < 0 ? "neg" : "pos")}>{gr.cash < 0 ? "−" : "+"}{fmt$(Math.abs(gr.cash))}</span>}
      {gr.fans != null && <span className={"fx " + (gr.fans < 0 ? "neg" : "pos")}>{gr.fans < 0 ? "−" : "+"}{Math.abs(gr.fans)} fans</span>}
      {gr.morale != null && <span className={"fx " + (gr.morale < 0 ? "neg" : "pos")}>{gr.morale < 0 ? "−" : "+"}{Math.abs(gr.morale)} morale</span>}
    </div>
  );
  return (
    <div className="panel center travel">
      <div className="kicker">{route ? route.name : "On the road"}</div>
      <div className="route-ribbon">
        <span className="route-end">{fromLabel}</span>
        <div className="route-line">
          <div className="route-fill" ref={fillRef} style={route ? { background: route.accent } : undefined} />
          <div className="route-van" ref={vanRef}><VanIcon /></div>
        </div>
        <span className="route-end next">{toLabel}</span>
      </div>
      <canvas ref={canvasRef} width={240} height={150} className="travel-canvas" />

      {!revealed && <p className="hint">Driving to the next stop… (tap to hurry)</p>}

      {revealed && event && (
        <div className="event-card">
          <div className={"event-kind k-" + event.kind}>{event.kind === "good" ? "GOOD FORTUNE" : event.kind === "bad" ? "TROUBLE" : "A DETOUR"}</div>
          <h3 className="event-title">{event.title}</h3>
          <p className="event-desc">{event.desc}</p>
          <div className="event-fx">
            {fx.cash != null && <span className={"fx " + (fx.cash < 0 ? "neg" : "pos")}>{fx.cash < 0 ? "−" : "+"}{fmt$(Math.abs(fx.cash))}</span>}
            {fx.fans != null && <span className={"fx " + (fx.fans < 0 ? "neg" : "pos")}>{fx.fans < 0 ? "−" : "+"}{Math.abs(fx.fans)} fans</span>}
            {fx.morale != null && <span className={"fx " + (fx.morale < 0 ? "neg" : "pos")}>{fx.morale < 0 ? "−" : "+"}{Math.abs(fx.morale)} morale</span>}
          </div>
          {routeChips}
          <button className="btn big" onClick={() => onDone(route, event)}>Continue →</button>
        </div>
      )}

      {revealed && !event && (
        <div className="event-card">
          <h3 className="event-title">{hasGuaranteed ? "An easy stretch of road" : "Clear road, quiet night"}</h3>
          <p className="event-desc">{hasGuaranteed ? "No surprises — just the miles and the hum of the engine." : "Nothing but headlights and white lines. You make good time."}</p>
          {routeChips}
          <button className="btn big" onClick={() => onDone(route, null)}>Roll into town →</button>
        </div>
      )}
    </div>
  );
}

const loadCalOffsetMs = () => {
  if (typeof window === "undefined") return null;
  const saved = window.localStorage.getItem(CAL_KEY);
  return saved !== null ? parseFloat(saved) : null;
};

/* ============================ APP ============================ */
export default function App() {
  const [seed] = useState(() => (Math.random() * 1e9) | 0);
  const [calOffsetMs, setCalOffsetMs] = useState(loadCalOffsetMs);
  const [diffKey, setDiffKey] = useState(() => {
    if (typeof window === "undefined") return DEFAULT_DIFF;
    const saved = window.localStorage.getItem(DIFF_KEY);
    return saved && DIFFICULTY[saved] ? saved : DEFAULT_DIFF;
  });
  const diff = DIFFICULTY[diffKey] || DIFFICULTY[DEFAULT_DIFF];
  const setDifficulty = (k) => {
    setDiffKey(k);
    if (typeof window !== "undefined") window.localStorage.setItem(DIFF_KEY, k);
  };
  // title | calibrate | map | plan | gig | result | end
  const [phase, setPhase] = useState(() => (loadCalOffsetMs() === null ? "calibrate" : "title"));
  const [stop, setStop] = useState(0);
  const [cash, setCash] = useState(600);
  const [fans, setFans] = useState(120);
  const [morale, setMorale] = useState(80);
  const [city, setCity] = useState(null);
  const [plan, setPlan] = useState({ deal: "door", promo: 0, song: SONGS[1], travel: "rest" });
  const [result, setResult] = useState(null);
  const [history, setHistory] = useState([]);
  const [feedback, setFeedback] = useState({ rating: 0, notes: "" });
  const [ownedPerks, setOwnedPerks] = useState([]); // perk ids, reset each tour
  const [perkOffer, setPerkOffer] = useState([]);   // 3 ids currently offered
  const [travelEvent, setTravelEvent] = useState(null); // event rolled for current drive
  const [routeOptions, setRouteOptions] = useState([]); // 3 routes offered at a junction
  const [chosenRoute, setChosenRoute] = useState(null); // the route being driven
  const [eventsSeen, setEventsSeen] = useState([]);      // ids of road events encountered
  const [cred, setCred] = useState(0);                   // are you good?  (0-100)
  const [infamy, setInfamy] = useState(0);               // are you a memorable disaster? (0-100)
  const rep = repState(cred, infamy);
  const [boards, setBoards] = useState(loadBoards);
  const [pendingScore, setPendingScore] = useState(null); // {score, rank} awaiting initials
  const [lbTab, setLbTab] = useState(diffKey);
  const [lbHighlight, setLbHighlight] = useState(null);   // {key, ts} of the just-added entry

  const perkMods = React.useMemo(() => aggregatePerks(ownedPerks), [ownedPerks]);
  const isNarrow = useIsNarrow();

  const rng = useRef(mulberry32(seed + 7));

  const cityOptions = React.useMemo(() => {
    const r = mulberry32(seed + stop * 101);
    const tierPool = CITY_POOL.filter((c) => {
      const t = c.draw;
      if (stop < 2) return t <= 140;
      if (stop < 4) return t > 100 && t <= 260;
      return t > 180;
    });
    const a = tierPool[(r() * tierPool.length) | 0];
    let b = tierPool[(r() * tierPool.length) | 0];
    if (b === a) b = tierPool[(tierPool.indexOf(a) + 1) % tierPool.length];
    return [a, b];
  }, [seed, stop]);

  const tier = stop < 2 ? 0 : stop < 4 ? 1 : 2;
  const ticket = 12 + tier * 8 + (perkMods.ticketBonus || 0);

  const projAttend = (c, promo, song) => {
    const promoMult = promo === 0 ? 1 : promo === 150 ? 1.4 : 1.8;
    const arch = ARCH[c.arch];
    // perks: boost the "loves" bonus and soften the "hates" penalty
    const love = 1.3 + (perkMods.loveBonus || 0);
    const hate = 1 - (1 - 0.75) * (1 - (perkMods.hatePenaltyReduction || 0));
    const match = song.tag === arch.loves ? love : song.tag === arch.hates ? hate : 1;
    const fanPull = (1 + fans / 500) * (perkMods.fanPullMult || 1);
    return Math.min(c.draw * 1.7, Math.round(c.draw * promoMult * match * Math.min(2.4, fanPull)));
  };

  const pickCity = (c) => {
    setCity(c);
    const arch = ARCH[c.arch];
    const aff = (s) => (s.tag === arch.loves ? 0 : s.tag === arch.hates ? 2 : 1);
    const best = [...SONGS].sort((a, b) => aff(a) - aff(b) || a.diff - b.diff)[0];
    setPlan({ deal: "door", promo: 0, song: best, travel: "rest" });
    setPhase("plan");
  };

  const gigCosts = () =>
    Math.round(plan.promo * (perkMods.promoCostMult || 1))
    + Math.max(0, 80 - (perkMods.costReduction || 0))
    + (plan.travel === "rest" ? 120 : 0);

  const applyMoraleFloor = (m) => Math.max(perkMods.moraleFloor || 0, m);

  const startGig = () => {
    setCash((v) => v - gigCosts());
    const rest = 15 + (perkMods.moraleRestBonus || 0);
    const drive = -(18 - (perkMods.moraleDriveReduction || 0));
    setMorale((m) => applyMoraleFloor(Math.max(0, Math.min(100, m + (plan.travel === "rest" ? rest : drive)))));
    setPhase("gig");
  };

  const onGigDone = useCallback((res) => {
    setResult(res);
    setPhase("result");
  }, []);

  useEffect(() => {
    if (phase !== "result" || !result || result.settled) return;
    const attend = projAttend(city, plan.promo, plan.song);
    const shownAttend = Math.round(attend * (0.75 + PERF[result.grade] * 0.25));
    const highGrade = result.grade === "S" || result.grade === "A";
    const lines = []; // itemized contributions to the payout

    let revenue;
    if (plan.deal === "guarantee") {
      const base = city.draw * 3 + tier * 200;
      lines.push({ label: "Guaranteed fee", amount: Math.round(base) });
      const gMult = perkMods.guaranteeMult || 1;
      if (gMult !== 1) lines.push({ label: "Perk: bigger guarantee", amount: Math.round(base * (gMult - 1)) });
      revenue = Math.round(base * gMult);
    } else {
      const gate = shownAttend * ticket * 0.6;      // door take before performance
      const perf = PERF[result.grade];
      const withPerf = gate * perf;
      lines.push({ label: `Door: ${shownAttend} in @ ${fmt$(ticket)}`, amount: Math.round(gate) });
      lines.push({ label: `Set grade ${result.grade} (×${perf})`, amount: Math.round(withPerf - gate) });
      const dMult = perkMods.doorMult || 1;
      if (dMult !== 1) lines.push({ label: "Perk: merch / door bonus", amount: Math.round(withPerf * (dMult - 1)) });
      revenue = Math.round(withPerf * dMult);
    }

    // fans breakdown
    const fanBase = Math.round(shownAttend * CONV[result.grade]);
    const fanMult = (perkMods.fanConvMult || 1) * (highGrade ? (perkMods.highGradeFanBonus || 1) : 1);
    const newFans = Math.round(fanBase * fanMult) + (perkMods.flatFansPerGig || 0);

    setCash((v) => v + revenue);
    setFans((v) => v + newFans);
    const bombMoraleHit = perkMods.damageControl ? -6 : -12;
    setMorale((m) => applyMoraleFloor(Math.min(100, m + (highGrade ? 8 : result.grade === "F" ? bombMoraleHit : 0))));
    setCred((c) => updateRep(c, infamy, result.grade, perkMods).cred);
    setInfamy((inf) => updateRep(cred, inf, result.grade, perkMods).infamy);
    setHistory((h) => [...h, {
      city: city.name, song: plan.song.name, grade: result.grade,
      acc: Math.round(result.acc * 100), revenue, newFans,
      deltaMeanMs: result.deltaMeanMs, deltaStdMs: result.deltaStdMs,
    }]);
    setResult((r) => ({ ...r, settled: true, revenue, newFans, shownAttend, breakdown: lines }));
  }, [phase]); // eslint-disable-line

  // after viewing results: a B/A/S gig with perks still in the pool offers a perk
  const isFinalStop = () => stop + 1 >= TOTAL_STOPS;
  // A perk only makes sense if there's another gig left to use it on.
  const perkAvailable = () =>
    !isFinalStop() && cash >= 0 &&
    ["B", "A", "S"].includes(result?.grade) &&
    ownedPerks.length < PERKS.length;

  const afterResult = () => {
    if (cash < 0) { setPhase("end"); return; }
    if (perkAvailable()) {
      setPerkOffer(drawPerks(ownedPerks, 3));
      setPhase("perks");
    } else {
      advanceStop();
    }
  };

  const advanceStop = () => {
    if (cash < 0) { setPhase("end"); return; }
    if (stop + 1 >= TOTAL_STOPS) { setPhase("end"); return; }
    setStop((s) => s + 1);
    setRouteOptions(pickRoutes());   // fork the road: pick one of these next
    setChosenRoute(null);
    setPhase("route");
  };

  // player picks a road: roll that route's event (context-aware), then drive it
  const chooseRoute = (route) => {
    setChosenRoute(route);
    const ctx = { lastGrade: result?.grade, cred, infamy, cash, morale, repBand: rep.band };
    setTravelEvent(rollRouteEvent(route, ctx));  // may be null (uneventful drive)
    setPhase("travel");
  };

  // travel finished: apply the route's guaranteed effect AND the road event, plus
  // reputation upkeep (Publicist converts infamy to fans; infamy decays each drive).
  const finishTravel = (route, ev) => {
    let dCash = 0, dFans = 0, dMorale = 0;
    const gr = route?.guaranteed || {};
    dCash += gr.cash || 0; dFans += gr.fans || 0; dMorale += gr.morale || 0;
    if (ev) {
      const e = ev.effect || {};
      let ec = e.cash || 0, ef = e.fans || 0;
      // Tabloid Darling: viral "trainwreck" events pay more
      if (ev.viral && perkMods.infamyEventBonus > 1) {
        if (ec > 0) ec = Math.round(ec * perkMods.infamyEventBonus);
        if (ef > 0) ef = Math.round(ef * perkMods.infamyEventBonus);
      }
      dCash += ec; dFans += ef; dMorale += e.morale || 0;
      setEventsSeen((s) => [...s, ev.id]);
    }
    // Publicist / Cult Leader: infamy quietly becomes fans each drive
    if (perkMods.infamyToFans) dFans += Math.round(infamy * perkMods.infamyToFans);
    if (dCash) setCash((v) => v + dCash);
    if (dFans) setFans((v) => Math.max(0, v + dFans));
    if (dMorale) setMorale((m) => applyMoraleFloor(Math.max(0, Math.min(100, m + dMorale))));
    // reputation cools between stops
    setCred((c) => decayRep(c, infamy, perkMods).cred);
    setInfamy((inf) => decayRep(cred, inf, perkMods).infamy);
    setTravelEvent(null); setChosenRoute(null);
    setPhase("map");
  };

  const choosePerk = (id) => {
    if (id) setOwnedPerks((p) => (p.includes(id) ? p : [...p, id]));
    setPerkOffer([]);
    advanceStop();
  };

  // When a tour ends, score it once and see if it makes that difficulty's board.
  // `tourScored` is reset only by restart(), so returning to "end" after the
  // initials screen doesn't re-trigger the prompt.
  const tourScored = useRef(false);
  useEffect(() => {
    if (phase !== "end" || tourScored.current) return;
    tourScored.current = true;
    if (history.length === 0) return;          // nothing played, nothing to rank
    const score = scoreRun({ cash, fans, history });
    const rank = rankFor(boards[diffKey] || [], score);
    if (rank >= 0) { setPendingScore({ score, rank }); setPhase("highscore"); }
  }, [phase]); // eslint-disable-line

  const submitInitials = (name) => {
    const score = pendingScore.score;
    const grades = history.map((h) => h.grade).join("");
    const entry = { name, score, fans, cash, grades, ts: Date.now() };
    setBoards((b) => insertScore(b, diffKey, entry));
    setLbTab(diffKey);
    setLbHighlight({ key: diffKey, ts: entry.ts });
    setPendingScore(null);
    setPhase("end");
  };

  const restart = () => {
    setStop(0); setCash(600); setFans(120); setMorale(80);
    setHistory([]); setResult(null); setFeedback({ rating: 0, notes: "" });
    setOwnedPerks([]); setPerkOffer([]); setEventsSeen([]); setTravelEvent(null);
    setRouteOptions([]); setChosenRoute(null);
    setCred(0); setInfamy(0);            // reputation is per-tour; a new band starts unknown
    setPendingScore(null); setLbHighlight(null);
    tourScored.current = false;
    setPhase("map");
  };

  const exportPlaytestData = () => {
    const data = {
      exportedAt: new Date().toISOString(),
      calibrationOffsetMs: calOffsetMs,
      difficulty: diffKey,
      device: typeof navigator !== "undefined" ? navigator.userAgent : "unknown",
      finalCash: cash, finalFans: fans,
      tourScore: history.length ? scoreRun({ cash, fans, history }) : null,
      perks: ownedPerks,
      roadEvents: eventsSeen,
      reputation: { cred: Math.round(cred), infamy: Math.round(infamy), state: rep.id, label: rep.label, band: rep.band },
      runs: history,
      feedback,
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `encore-road-playtest-${Date.now()}.json`;
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
  };

  const StatBar = () => (
    <div className="statbar">
      <span className="stat"><b>{fmt$(cash)}</b> cash</span>
      <span className="stat"><b>{fans.toLocaleString()}</b> fans</span>
      <span className="stat">morale
        <span className="morale-pips">
          {[...Array(5)].map((_, i) => (
            <i key={i} className={i < Math.round(morale / 20) ? "pip on" : "pip"} />
          ))}
        </span>
      </span>
      <span className="stat dim">stop {Math.min(stop + 1, TOTAL_STOPS)}/{TOTAL_STOPS}</span>
      <span className="stat dim">{diff.label}</span>
      {rep.id !== "unknown" && (
        <span className={"rep-badge b-" + rep.band} title={rep.blurb}>{rep.label}</span>
      )}
    </div>
  );

  return (
    <div className="root">
      <style>{CSS}</style>

      {phase === "calibrate" && (
        <Calibration
          onDone={(ms) => {
            window.localStorage.setItem(CAL_KEY, String(ms));
            setCalOffsetMs(ms);
            setPhase("title");
          }}
          onSkip={() => {
            window.localStorage.setItem(CAL_KEY, "0");
            setCalOffsetMs(0);
            setPhase("title");
          }}
        />
      )}

      {phase === "title" && (
        <div className="panel center">
          <div className="kicker">A ROGUELITE TOUR</div>
          <h1 className="logo">ENCORE<br />ROAD</h1>
          <p className="lede">Route the tour. Structure the deals. Then walk on stage and earn it — every gig is a rhythm game.</p>
          <p className="hint">On desktop: keys D F J K. On mobile: tap the four lanes at the bottom.</p>

          <div className="diff-pick">
            <div className="sec-label" style={{ textAlign: "center", marginBottom: 8 }}>Difficulty</div>
            <div className="diff-row">
              {Object.values(DIFFICULTY).map((d) => (
                <button key={d.key}
                  className={"diff-btn" + (diffKey === d.key ? " sel" : "")}
                  onClick={() => setDifficulty(d.key)}>
                  <span className="diff-name">{d.label}</span>
                  <span className="diff-blurb">{d.blurb}</span>
                </button>
              ))}
            </div>
          </div>

          <button className="btn big" onClick={() => setPhase("map")}>Load the van →</button>
          <button className="relink" onClick={() => { setLbTab(diffKey); setPhase("boards"); }}>View high scores ▸</button>
          <button className="relink" onClick={() => setPhase("calibrate")}>
            {calOffsetMs === 0 ? "Calibrate audio timing ▸" : `Recalibrate audio (currently ${calOffsetMs}ms) ▸`}
          </button>
        </div>
      )}

      {phase === "route" && (
        <div className="panel center route-select">
          <div className="kicker">FORK IN THE ROAD</div>
          <h2 className="h2" style={{ marginTop: 2 }}>Which way to Stop {Math.min(stop + 1, TOTAL_STOPS)}?</h2>
          <p className="hint" style={{ marginBottom: 6 }}>Every road's a gamble. Pick your risk.</p>
          <div className="route-grid">
            {routeOptions.map((r) => {
              const g = r.guaranteed || {};
              const surprises = r.risk === "low" ? 1 : r.risk === "med" ? 2 : 3;
              return (
                <button key={r.id} className="route-card" style={{ "--rc": r.accent }} onClick={() => chooseRoute(r)}>
                  <RouteIcon kind={r.icon} color={r.accent} />
                  <div className="route-name">{r.name}</div>
                  <div className="route-blurb">{r.blurb}</div>
                  <div className="route-guar">
                    {(g.cash != null || g.fans != null || g.morale != null) ? (
                      <>
                        {g.cash != null && <span className={"fx " + (g.cash < 0 ? "neg" : "pos")}>{g.cash < 0 ? "−" : "+"}{fmt$(Math.abs(g.cash))}</span>}
                        {g.fans != null && <span className={"fx " + (g.fans < 0 ? "neg" : "pos")}>{g.fans < 0 ? "−" : "+"}{Math.abs(g.fans)} fans</span>}
                        {g.morale != null && <span className={"fx " + (g.morale < 0 ? "neg" : "pos")}>{g.morale < 0 ? "−" : "+"}{Math.abs(g.morale)} mrl</span>}
                      </>
                    ) : <span className="fx neutral">no bonus</span>}
                  </div>
                  <div className="route-risk">
                    <span className="rr-label">Surprises</span>
                    <span className="rr-dots">
                      {[0, 1, 2].map((i) => <span key={i} className={"rr-dot" + (i < surprises ? " on" : "")} />)}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {phase === "travel" && (
        <TravelScene
          fromLabel={history.length ? history[history.length - 1].city : "Home"}
          toLabel={`Stop ${Math.min(stop + 1, TOTAL_STOPS)}`}
          route={chosenRoute}
          event={travelEvent}
          onDone={finishTravel}
        />
      )}

      {phase === "map" && (
        <div className="panel">
          <StatBar />
          <div className="route">
            {[...Array(TOTAL_STOPS)].map((_, i) => (
              <React.Fragment key={i}>
                <div className={"node" + (i < stop ? " done" : i === stop ? " now" : "")}>
                  {i < stop ? history[i]?.grade : i === stop ? "▲" : "•"}
                </div>
                {i < TOTAL_STOPS - 1 && <div className={"leg" + (i < stop ? " done" : "")} />}
              </React.Fragment>
            ))}
          </div>
          {(cred > 0 || infamy > 0) && (
            <div className={"rep-line b-" + rep.band}>
              <div className="rep-head">
                <span className="rep-title">The scene calls you: <b>{rep.label}</b></span>
                <span className="rep-blurb">{rep.blurb}</span>
              </div>
              <div className="rep-meters">
                <div className="rep-meter">
                  <span className="rm-label">Cred</span>
                  <div className="rm-track"><div className="rm-fill cred" style={{ width: Math.round(cred) + "%" }} /></div>
                </div>
                <div className="rep-meter">
                  <span className="rm-label">Infamy</span>
                  <div className="rm-track"><div className="rm-fill inf" style={{ width: Math.round(infamy) + "%" }} /></div>
                </div>
              </div>
              {rep.band === "infamous" && (rep.viral
                ? <p className="rep-note">🔥 Infamy is pulling crowds now — the road throws you virality, not respect.</p>
                : <p className="rep-note dim-note">Keep bombing and infamy becomes its own kind of fame. ({Math.round(INFAMY_VIRAL_AT - infamy)} more to go viral.)</p>
              )}
            </div>
          )}
          <h2 className="h2">Next stop — pick your route</h2>
          <div className="cards">
            {cityOptions.map((c) => {
              const a = ARCH[c.arch];
              return (
                <button key={c.name} className="card city" onClick={() => pickCity(c)}>
                  <div className="card-title">{c.name}</div>
                  <div className="card-tag">{a.label}</div>
                  <div className="card-line">{a.flavor}</div>
                  <div className="card-meta">
                    <span>draw ~{c.draw}</span>
                    <span className="love">♥ {a.loves}</span>
                    <span className="hate">✕ {a.hates}</span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {phase === "plan" && city && (() => {
        const attend = projAttend(city, plan.promo, plan.song);
        const guarantee = Math.round((city.draw * 3 + tier * 200) * (perkMods.guaranteeMult || 1));
        const doorEst = Math.round(attend * ticket * 0.6 * (perkMods.doorMult || 1));
        const costs = gigCosts();
        const arch = ARCH[city.arch];
        // surface loved-genre songs first, hated last, so the long list stays navigable
        const affinity = (s) => (s.tag === arch.loves ? 0 : s.tag === arch.hates ? 2 : 1);
        const sortedSongs = [...SONGS].sort((a, b) => affinity(a) - affinity(b) || a.diff - b.diff);
        return (
          <div className="panel">
            <StatBar />
            <h2 className="h2">{city.name} · <span className="dim">{arch.label}</span></h2>

            {ownedPerks.length > 0 && (
              <div className="perk-strip">
                <span className="sec-label" style={{ margin: 0 }}>Active perks</span>
                {ownedPerks.map((id) => {
                  const p = PERKS.find((x) => x.id === id);
                  return p ? <span key={id} className="perk-tag" title={p.desc}>{p.emoji} {p.name}</span> : null;
                })}
              </div>
            )}

            <div className="section">
              <div className="sec-label">Setlist — one song tonight ({SONGS.length} in your catalog)</div>
              {isNarrow ? (
                <SongCarousel
                  songs={sortedSongs}
                  selectedId={plan.song.id}
                  onSelect={(s) => setPlan({ ...plan, song: s })}
                  arch={arch}
                />
              ) : (
                <div className="chips">
                  {sortedSongs.map((s) => {
                    const m = s.tag === arch.loves ? "♥" : s.tag === arch.hates ? "✕" : "";
                    return (
                      <button key={s.id}
                        className={"chip" + (plan.song.id === s.id ? " sel" : "")}
                        onClick={() => setPlan({ ...plan, song: s })}>
                        <b>{s.name}</b> {m && <span className={m === "♥" ? "love" : "hate"}>{m}</span>}
                        <span className="chip-sub">{s.tag} · {s.bpm} bpm · {"◆".repeat(s.diff)}{"◇".repeat(4 - s.diff)}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="section">
              <div className="sec-label">The deal</div>
              <div className="chips">
                <button className={"chip" + (plan.deal === "guarantee" ? " sel" : "")}
                  onClick={() => setPlan({ ...plan, deal: "guarantee" })}>
                  <b>Guarantee</b><span className="chip-sub">{fmt$(guarantee)} flat, win or bomb</span>
                </button>
                <button className={"chip" + (plan.deal === "door" ? " sel" : "")}
                  onClick={() => setPlan({ ...plan, deal: "door" })}>
                  <b>Door split</b><span className="chip-sub">~{fmt$(doorEst)} if you play a clean set</span>
                </button>
              </div>
            </div>

            <div className="section">
              <div className="sec-label">Promo spend</div>
              <div className="chips">
                {[0, 150, 400].map((p) => (
                  <button key={p} className={"chip" + (plan.promo === p ? " sel" : "")}
                    onClick={() => setPlan({ ...plan, promo: p })}>
                    <b>{p === 0 ? "Word of mouth" : fmt$(p)}</b>
                    <span className="chip-sub">crowd ×{p === 0 ? "1.0" : p === 150 ? "1.4" : "1.8"}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="section">
              <div className="sec-label">Travel plan</div>
              <div className="chips">
                <button className={"chip" + (plan.travel === "rest" ? " sel" : "")}
                  onClick={() => setPlan({ ...plan, travel: "rest" })}>
                  <b>Motel night</b><span className="chip-sub">−$120 · morale +{15 + (perkMods.moraleRestBonus || 0)}</span>
                </button>
                <button className={"chip" + (plan.travel === "drive" ? " sel" : "")}
                  onClick={() => setPlan({ ...plan, travel: "drive" })}>
                  <b>Drive overnight</b><span className="chip-sub">free · morale −{18 - (perkMods.moraleDriveReduction || 0)} (tighter timing!)</span>
                </button>
              </div>
            </div>

            <div className="proj">
              Projected crowd <b>~{attend}</b> · costs tonight <b>{fmt$(costs)}</b>
              {applyMoraleFloor(morale + (plan.travel === "drive" ? -(18 - (perkMods.moraleDriveReduction || 0)) : (15 + (perkMods.moraleRestBonus || 0)))) < 40 && (
                <span className="warn"> · low morale will shrink your hit windows</span>
              )}
            </div>
            <button className="btn big" onClick={startGig}>Doors open — play the gig →</button>
          </div>
        );
      })()}

      {phase === "gig" && city && (
        <Gig song={plan.song} tier={tier}
          morale={applyMoraleFloor(Math.max(0, Math.min(100, morale + (plan.travel === "rest" ? (15 + (perkMods.moraleRestBonus||0)) : -(18 - (perkMods.moraleDriveReduction||0))))))}
          calOffset={(calOffsetMs || 0) / 1000}
          perkMods={perkMods}
          afterBomb={result?.grade === "C" || result?.grade === "F"}
          diff={diff}
          seed={seed + stop * 977} onDone={onGigDone} />
      )}

      {phase === "result" && result?.settled && (() => {
        const g = result.grade;
        const celebrate = ["S", "A", "B"].includes(g) && !result.walked;
        const headline = result.walked ? "The crowd walked out"
          : g === "S" ? "ENCORE! They won't forget this."
          : g === "A" ? "Standing ovation!"
          : g === "B" ? "Solid set — they had a good night."
          : g === "C" ? "You got through it."
          : "Rough night on stage.";
        return (
          <div className="panel center result-splash">
            {celebrate && <Confetti count={g === "S" ? 110 : g === "A" ? 85 : 60} />}
            <div className="kicker">{city.name} — set complete</div>
            <div className={"grade g-" + g + (celebrate ? " pop" : "")}>{g}</div>
            <h2 className="splash-headline">{headline}</h2>

            <div className="payout-hero">
              <span className="payout-label">You earned</span>
              <span className="payout-cash"><CashCountUp to={result.revenue} prefix="$" /></span>
              {result.newFans > 0 && <span className="payout-fans">+{result.newFans} new fans 💞</span>}
            </div>

            {result.breakdown?.length > 0 && (
              <div className="breakdown">
                <div className="sec-label">Where it came from</div>
                {result.breakdown.map((ln, i) => (
                  <div className={"bd-row" + (ln.amount < 0 ? " neg" : "")} key={i}>
                    <span className="bd-label">{ln.label}</span>
                    <span className="bd-amt">{ln.amount < 0 ? "−" : "+"}{fmt$(Math.abs(ln.amount))}</span>
                  </div>
                ))}
                <div className="bd-row bd-total">
                  <span className="bd-label">Payout</span>
                  <span className="bd-amt">{fmt$(result.revenue)}</span>
                </div>
              </div>
            )}

            <div className="res-mini">
              <span>Grade <b>{g}</b></span>
              <span>Accuracy <b>{Math.round(result.acc * 100)}%</b></span>
              <span>Max combo <b>{result.maxCombo}×</b></span>
              <span>Crowd <b>~{result.shownAttend}</b></span>
            </div>

            {perkAvailable() && (
              <p className="perk-teaser">✦ Strong set — pick a tour perk next ✦</p>
            )}
            <button className="btn big" onClick={afterResult}>
              {isFinalStop() || cash < 0 ? "Wrap the tour →"
                : perkAvailable() ? "Choose a perk →"
                : "Back in the van →"}
            </button>
          </div>
        );
      })()}

      {phase === "perks" && (
        <div className="panel center">
          <div className="kicker">GREAT SET — GRAB A PERK</div>
          <h2 className="h2" style={{ marginTop: 2 }}>Pick one for the rest of the tour</h2>
          <p className="hint" style={{ marginBottom: 4 }}>Perks stack, and last until you start a new tour.</p>
          <div className="perk-grid">
            {perkOffer.map((id) => {
              const p = PERKS.find((x) => x.id === id);
              if (!p) return null;
              return (
                <button key={id} className="perk-card" onClick={() => choosePerk(id)}>
                  <div className="perk-emoji">{p.emoji}</div>
                  <div className="perk-name">{p.name}</div>
                  <div className="perk-desc">{p.desc}</div>
                </button>
              );
            })}
          </div>
          {ownedPerks.length > 0 && (
            <div className="perk-owned">
              <span className="dim">Active:</span>{" "}
              {ownedPerks.map((id) => {
                const p = PERKS.find((x) => x.id === id);
                return p ? <span key={id} className="perk-tag">{p.emoji} {p.name}</span> : null;
              })}
            </div>
          )}
          <button className="relink" onClick={() => choosePerk(null)}>Skip — take none this time</button>
        </div>
      )}

      {phase === "boards" && (
        <div className="panel center">
          <div className="kicker">HALL OF FAME</div>
          <h2 className="h2" style={{ marginTop: 2 }}>High scores</h2>
          <p className="hint" style={{ marginBottom: 6 }}>Saved in this browser. One board per difficulty.</p>
          <Leaderboard boards={boards} activeKey={lbTab} onSelect={setLbTab} highlight={lbHighlight} />
          <button className="btn big" onClick={() => setPhase("title")}>← Back</button>
        </div>
      )}

      {phase === "highscore" && pendingScore && (
        <InitialsEntry
          rank={pendingScore.rank}
          score={pendingScore.score}
          diffLabel={diff.label}
          onSubmit={submitInitials}
        />
      )}

      {phase === "end" && (
        <div className="panel center">
          <div className="kicker">TOUR OVER</div>
          <h1 className="logo sm">{
            cash < 0 ? "BANKRUPT\nIN A MOTEL"
            : rep.band === "infamous"
              ? (fans >= 1200 ? "FAMOUS\nFOR THE WRONG\nREASONS" : fans >= 600 ? "VIRAL\nTRAINWRECK" : "A CAUTIONARY\nTALE")
              : (fans >= 1200 ? "SIGNED." : fans >= 600 ? "BUZZ BAND" : "LOCAL LEGEND")
          }</h1>
          {rep.id !== "unknown" && (
            <p className={"end-rep b-" + rep.band}>
              {rep.band === "infamous"
                ? `They'll never forget you — ${fans.toLocaleString()} people follow the wreckage.`
                : rep.band === "good"
                  ? `${rep.label}. You earned every one of those ${fans.toLocaleString()} fans.`
                  : `${rep.label}. The road's still deciding what you are.`}
            </p>
          )}
          <div className="res-grid">
            <div><span className="dim">Final cash</span><b>{fmt$(cash)}</b></div>
            <div><span className="dim">Fanbase</span><b>{fans.toLocaleString()}</b></div>
          </div>
          {history.length > 0 && (
            <div className="tour-score">
              <span className="payout-label">Tour score · {diff.label}</span>
              <span className="tour-score-num">{scoreRun({ cash, fans, history }).toLocaleString()}</span>
            </div>
          )}
          <div className="hist">
            {history.map((h, i) => (
              <div key={i} className="hist-row">
                <span>{h.city}</span>
                <span className={"g-txt g-" + h.grade}>{h.grade}</span>
                <span>{fmt$(h.revenue)}</span>
                <span className="dim">+{h.newFans} fans</span>
              </div>
            ))}
          </div>
          <div className="section lb-section">
            <div className="sec-label">High scores</div>
            <Leaderboard boards={boards} activeKey={lbTab} onSelect={setLbTab} highlight={lbHighlight} />
          </div>

          <div className="fb-block">
            <div className="sec-label">Playtester feedback</div>
            <div className="fb-stars">
              {[1, 2, 3, 4, 5].map((n) => (
                <button key={n}
                  className={"fb-star" + (feedback.rating >= n ? " on" : "")}
                  onClick={() => setFeedback((f) => ({ ...f, rating: n }))}>★</button>
              ))}
            </div>
            <textarea
              className="fb-notes"
              placeholder="Anything feel off? Too hard, too easy, confusing screen, laggy taps — write it here."
              value={feedback.notes}
              onChange={(e) => setFeedback((f) => ({ ...f, notes: e.target.value }))}
            />
            <button className="btn big alt" onClick={exportPlaytestData}>Export playtest data ⬇</button>
            <p className="hint export-hint">Downloads a JSON file — send it back so runs from different testers can be compared.</p>
          </div>

          <button className="btn big" onClick={restart}>Book another tour ↺</button>
        </div>
      )}
    </div>
  );
}

/* ============================ STYLES ============================ */
const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Bungee&family=Space+Grotesk:wght@400;500;700&display=swap');
* { box-sizing: border-box; margin: 0; }
.root {
  min-height: 100vh; min-height: 100dvh; width: 100%;
  overscroll-behavior: none;
  background:
    radial-gradient(1200px 500px at 50% -10%, rgba(255,61,127,0.14), transparent 60%),
    radial-gradient(900px 400px at 85% 100%, rgba(87,224,232,0.08), transparent 60%),
    #17111f;
  color: #F4EDE0; font-family: 'Space Grotesk', sans-serif;
  display: flex; justify-content: center; padding: 20px 14px 48px;
}
.panel { width: 100%; max-width: 660px; }
.center { text-align: center; display:flex; flex-direction:column; align-items:center; gap:14px; padding-top: 6vh; }
.kicker { letter-spacing: 0.3em; font-size: 12px; color: #FFB03A; font-weight: 700; }
.logo { font-family: 'Bungee', 'Space Grotesk', sans-serif; font-size: clamp(52px, 12vw, 88px); line-height: 0.95; color: #F4EDE0; text-shadow: 4px 4px 0 #FF3D7F; }
.logo.sm { font-size: clamp(30px, 8vw, 48px); white-space: pre-line; }
.lede { max-width: 420px; color: #cfc6b8; line-height: 1.5; }
.hint { font-size: 13px; color: #8d8478; }
.h2 { font-size: 22px; margin: 18px 0 12px; font-weight: 700; }
.dim { color: #9a9086; font-weight: 400; }
.btn { cursor: pointer; border: none; font-family: inherit; font-weight: 700; border-radius: 12px; }
.btn.big { margin-top: 18px; margin-bottom: 8px; padding: 15px 26px; font-size: 17px; background: #FF3D7F; color: #17111f; box-shadow: 0 6px 0 #a11f4e; transition: transform .08s; width: 100%; max-width: 420px;}
.btn.big:active { transform: translateY(4px); box-shadow: 0 2px 0 #a11f4e; }
.statbar { display: flex; gap: 16px; flex-wrap: wrap; align-items: center; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.08); padding: 10px 14px; border-radius: 12px; font-size: 14px; }
.stat b { color: #FFB03A; }
.morale-pips { margin-left: 6px; }
.pip { display: inline-block; width: 8px; height: 12px; margin-right: 3px; background: rgba(255,255,255,0.12); border-radius: 2px; }
.pip.on { background: #57E0E8; }
.route { display: flex; align-items: center; margin: 20px 0 4px; }
.node { width: 34px; height: 34px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: 700; background: rgba(255,255,255,0.07); border: 2px solid rgba(255,255,255,0.15); flex-shrink: 0; }
.node.now { border-color: #FF3D7F; color: #FF3D7F; box-shadow: 0 0 14px rgba(255,61,127,0.5); }
.node.done { background: #FFB03A; color: #17111f; border-color: #FFB03A; }
.leg { flex: 1; height: 3px; background: repeating-linear-gradient(90deg, rgba(255,255,255,0.25) 0 8px, transparent 8px 16px); }
.leg.done { background: #FFB03A; }
.cards { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
@media (max-width: 520px) { .cards { grid-template-columns: 1fr; } }
.card { text-align: left; padding: 16px; border-radius: 14px; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); color: inherit; cursor: pointer; font-family: inherit; transition: border-color .15s, transform .1s; }
.card:hover { border-color: #FF3D7F; transform: translateY(-2px); }
.card-title { font-family: 'Bungee', sans-serif; font-size: 20px; }
.card-tag { color: #57E0E8; font-size: 13px; font-weight: 700; letter-spacing: 0.08em; margin: 2px 0 6px; }
.card-line { font-size: 13px; color: #cfc6b8; margin-bottom: 10px; }
.card-meta { display: flex; gap: 12px; font-size: 12.5px; color: #9a9086; }
.love { color: #FFB03A; } .hate { color: #FF5A5A; }
.section { margin: 16px 0; }
.sec-label { font-size: 12px; letter-spacing: 0.18em; text-transform: uppercase; color: #9a9086; margin-bottom: 8px; }
.chips { display: flex; flex-wrap: wrap; gap: 8px; }
.chip { font-family: inherit; color: inherit; text-align: left; padding: 10px 14px; border-radius: 10px; background: rgba(255,255,255,0.05); border: 1.5px solid rgba(255,255,255,0.12); cursor: pointer; display: flex; flex-direction: column; gap: 2px; min-width: 140px; }
.chip.sel { border-color: #FFB03A; background: rgba(255,176,58,0.12); }
.chip-sub { font-size: 12px; color: #9a9086; }
.proj { margin-top: 14px; font-size: 14.5px; background: rgba(87,224,232,0.08); border: 1px solid rgba(87,224,232,0.25); padding: 12px 14px; border-radius: 10px; }
.proj b { color: #57E0E8; }
.warn { color: #FF7A3D; }
.gig { width: 100%; max-width: 520px; display: flex; flex-direction: column; height: calc(100vh - 60px); height: calc(100dvh - 60px); }
.gig-hud { display: flex; align-items: center; gap: 14px; padding-bottom: 10px; }
.hud-label { font-size: 11px; letter-spacing: 0.15em; text-transform: uppercase; color: #9a9086; }
.hud-big { font-size: 24px; font-weight: 700; }
.crowd-wrap { flex: 1; }
.crowd-bar { height: 12px; background: rgba(255,255,255,0.08); border-radius: 6px; overflow: hidden; margin-top: 4px; }
.crowd-fill { height: 100%; transition: width .2s; }
.stage-wrap { position: relative; flex: 1; min-height: 300px; border-radius: 16px; overflow: hidden; border: 1px solid rgba(255,255,255,0.1); background: #100b18; }
.stage { width: 100%; height: 100%; display: block; }
.pads { position: absolute; bottom: 0; left: 0; right: 0; display: flex; touch-action: none; user-select: none; -webkit-user-select: none; }
.pad {
  flex: 1; height: 96px; position: relative;
  border: none; border-top: 3px solid var(--pc);
  background: linear-gradient(transparent, color-mix(in srgb, var(--pc) 20%, transparent));
  display: flex; flex-direction: column; align-items: center; justify-content: flex-end;
  padding-bottom: 12px; gap: 6px;
  cursor: pointer; touch-action: none;
  -webkit-tap-highlight-color: transparent; user-select: none; -webkit-user-select: none;
  transition: background 0.05s ease;
}
.pad.down { background: linear-gradient(transparent, color-mix(in srgb, var(--pc) 55%, transparent)); }
.pad-glyph {
  width: 34px; height: 34px; border-radius: 50%;
  border: 2.5px solid var(--pc);
  background: color-mix(in srgb, var(--pc) 18%, transparent);
  transition: transform 0.05s ease, background 0.05s ease;
}
.pad.down .pad-glyph { transform: scale(1.28); background: var(--pc); }
.pad-key { font-family: 'Bungee', sans-serif; font-size: 13px; color: var(--pc); opacity: 0.65; }
.gig-song { text-align: center; padding-top: 8px; font-size: 13px; color: #9a9086; }
/* Larger touch targets + hide the keyboard hint glyph text on small screens */
@media (max-width: 620px) {
  .root { padding: 10px 10px 12px; }
  .gig { height: calc(100vh - 22px); height: calc(100dvh - 22px); }
  .pad { height: 118px; padding-bottom: 16px; }
  .pad-glyph { width: 40px; height: 40px; }
  .pad-key { display: none; }
}
@media (hover: none) and (pointer: coarse) {
  .pad-key { display: none; }
}
.grade { font-family: 'Bungee', sans-serif; font-size: 110px; line-height: 1; }
.g-S { color: #FFB03A; text-shadow: 0 0 30px rgba(255,176,58,0.6); }
.g-A { color: #57E0E8; } .g-B { color: #B78CFF; } .g-C { color: #cfc6b8; } .g-F { color: #FF5A5A; }
.g-txt { font-weight: 700; }
.res-grid { display: flex; gap: 22px; flex-wrap: wrap; justify-content: center; margin-top: 8px; }
.res-grid > div { display: flex; flex-direction: column; gap: 2px; font-size: 15px; }
.res-grid b { font-size: 20px; }
.hist { width: 100%; max-width: 440px; margin-top: 14px; display: flex; flex-direction: column; gap: 6px; }
.hist-row { display: grid; grid-template-columns: 1.4fr 0.4fr 0.8fr 0.9fr; gap: 8px; background: rgba(255,255,255,0.05); padding: 9px 14px; border-radius: 9px; font-size: 14px; text-align: left; }
.relink { background: none; border: none; color: #57E0E8; font-family: inherit; font-size: 13px; cursor: pointer; margin-top: 14px; text-decoration: underline; text-underline-offset: 3px; }
.cal-dots { display: flex; gap: 8px; margin: 18px 0 6px; }
.cal-dot { width: 14px; height: 14px; border-radius: 50%; background: rgba(255,255,255,0.12); border: 2px solid rgba(255,255,255,0.2); display: inline-block; }
.cal-dot.on { background: #57E0E8; border-color: #57E0E8; }
.fb-block { width: 100%; max-width: 440px; margin-top: 22px; padding-top: 18px; border-top: 1px solid rgba(255,255,255,0.1); text-align: left; }
.fb-stars { display: flex; gap: 6px; margin: 6px 0 10px; }
.fb-star { background: none; border: none; font-size: 28px; line-height: 1; color: rgba(255,255,255,0.18); cursor: pointer; padding: 0; }
.fb-star.on { color: #FFB03A; }
.fb-notes { width: 100%; min-height: 70px; resize: vertical; background: rgba(255,255,255,0.05); border: 1.5px solid rgba(255,255,255,0.12); border-radius: 10px; color: #F4EDE0; font-family: inherit; font-size: 13.5px; padding: 10px 12px; margin-bottom: 12px; }
.fb-notes:focus { outline: none; border-color: #57E0E8; }
.btn.big.alt { background: #57E0E8; box-shadow: 0 6px 0 #1f8a94; }
.btn.big.alt:active { box-shadow: 0 2px 0 #1f8a94; }
.perk-teaser { color: #FFB03A; font-weight: 700; font-size: 14px; margin-top: 4px; }
.perk-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; width: 100%; max-width: 560px; margin-top: 8px; }
@media (max-width: 560px) { .perk-grid { grid-template-columns: 1fr; } }
.perk-card {
  display: flex; flex-direction: column; align-items: center; text-align: center; gap: 6px;
  padding: 18px 12px; border-radius: 14px; cursor: pointer;
  background: rgba(255,255,255,0.05); border: 1.5px solid rgba(255,255,255,0.14);
  color: inherit; font-family: inherit; transition: border-color .15s, transform .1s, background .15s;
}
.perk-card:hover, .perk-card:active { border-color: #FFB03A; background: rgba(255,176,58,0.10); transform: translateY(-3px); }
.perk-emoji { font-size: 30px; line-height: 1; }
.perk-name { font-family: 'Bungee', sans-serif; font-size: 14px; color: #F4EDE0; }
.perk-desc { font-size: 12.5px; color: #cfc6b8; line-height: 1.35; }
.perk-owned { margin-top: 14px; display: flex; flex-wrap: wrap; gap: 6px; justify-content: center; align-items: center; max-width: 520px; }
.perk-strip { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; margin: 4px 0 10px; padding: 10px 12px; background: rgba(255,176,58,0.08); border: 1px solid rgba(255,176,58,0.22); border-radius: 10px; }
.perk-tag { font-size: 12px; background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.14); border-radius: 20px; padding: 3px 10px; white-space: nowrap; }
.diff-pick { width: 100%; max-width: 440px; margin-top: 6px; }
.diff-row { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
.diff-btn { display: flex; flex-direction: column; gap: 3px; align-items: center; text-align: center; padding: 12px 8px; border-radius: 11px; cursor: pointer; background: rgba(255,255,255,0.05); border: 1.5px solid rgba(255,255,255,0.14); color: inherit; font-family: inherit; transition: border-color .12s, background .12s; }
.diff-btn.sel { border-color: #57E0E8; background: rgba(87,224,232,0.12); }
.diff-name { font-family: 'Bungee', sans-serif; font-size: 14px; color: #F4EDE0; }
.diff-blurb { font-size: 11px; color: #9a9086; line-height: 1.25; }

/* ---- celebration splash ---- */
.result-splash { position: relative; overflow: hidden; }
.grade.pop { animation: gradePop 0.6s cubic-bezier(.2,1.4,.4,1) both; }
@keyframes gradePop { 0% { transform: scale(0.3); opacity: 0; } 60% { transform: scale(1.15); } 100% { transform: scale(1); opacity: 1; } }
.splash-headline { font-size: 20px; text-align: center; margin: 2px 0 6px; color: #F4EDE0; }
.payout-hero { display: flex; flex-direction: column; align-items: center; gap: 2px; margin: 8px 0 14px; }
.payout-label { font-size: 12px; letter-spacing: 0.14em; text-transform: uppercase; color: #9a9086; }
.payout-cash { font-family: 'Bungee', sans-serif; font-size: 46px; line-height: 1; color: #8CFF9E; text-shadow: 0 0 24px rgba(140,255,158,0.35); }
.payout-fans { font-size: 14px; color: #FF9ec4; margin-top: 4px; }
.breakdown { width: 100%; max-width: 380px; background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.1); border-radius: 12px; padding: 12px 14px; }
.bd-row { display: flex; justify-content: space-between; gap: 12px; align-items: baseline; padding: 5px 0; font-size: 13.5px; }
.bd-label { color: #cfc6b8; text-align: left; }
.bd-amt { font-variant-numeric: tabular-nums; color: #8CFF9E; white-space: nowrap; font-weight: 600; }
.bd-row.neg .bd-amt { color: #ff9a9a; }
.bd-row.bd-total { border-top: 1px solid rgba(255,255,255,0.12); margin-top: 4px; padding-top: 9px; font-family: 'Bungee', sans-serif; font-size: 14px; }
.bd-row.bd-total .bd-label { color: #F4EDE0; }
.bd-row.bd-total .bd-amt { color: #F4EDE0; }
.res-mini { display: flex; flex-wrap: wrap; gap: 6px 16px; justify-content: center; margin: 14px 0 6px; font-size: 13px; color: #9a9086; }
.res-mini b { color: #F4EDE0; }
.confetti { position: absolute; inset: 0; pointer-events: none; overflow: hidden; z-index: 5; }
.confetti-piece { position: absolute; top: -20px; border-radius: 2px; opacity: 0.95; animation-name: confettiFall; animation-timing-function: linear; animation-iteration-count: 1; }
@keyframes confettiFall {
  0% { transform: translateY(-20px) translateX(0) rotate(0deg); opacity: 1; }
  100% { transform: translateY(115vh) translateX(var(--drift)) rotate(calc(var(--rot) * 4)); opacity: 0.9; }
}

/* ---- mobile song carousel ---- */
.carousel-wrap { width: 100%; }
.carousel-top { display: flex; align-items: center; justify-content: center; gap: 16px; margin-bottom: 8px; }
.car-arrow { width: 40px; height: 40px; border-radius: 50%; border: 1.5px solid rgba(255,255,255,0.18); background: rgba(255,255,255,0.06); color: #F4EDE0; font-size: 24px; line-height: 1; cursor: pointer; -webkit-tap-highlight-color: transparent; }
.car-arrow:disabled { opacity: 0.3; }
.car-count { font-size: 13px; color: #9a9086; font-variant-numeric: tabular-nums; min-width: 54px; text-align: center; }
.carousel { position: relative; display: flex; gap: 12px; overflow-x: auto; scroll-snap-type: x mandatory; -webkit-overflow-scrolling: touch; scrollbar-width: none; padding: 4px 2px 10px; }
.carousel::-webkit-scrollbar { display: none; }
.song-slide {
  scroll-snap-align: center; flex: 0 0 82%; max-width: 320px;
  display: flex; flex-direction: column; align-items: center; text-align: center; gap: 6px;
  padding: 18px 16px; border-radius: 16px; cursor: pointer;
  background: rgba(255,255,255,0.05); border: 2px solid rgba(255,255,255,0.12);
  transition: border-color .15s, background .15s;
}
.song-slide.sel { border-color: #FF3D7F; background: rgba(255,61,127,0.10); }
.slide-badge { font-size: 11px; letter-spacing: 0.04em; text-transform: uppercase; padding: 3px 10px; border-radius: 20px; }
.slide-badge.love { background: rgba(140,255,158,0.15); color: #8CFF9E; }
.slide-badge.hate { background: rgba(255,120,120,0.15); color: #ff9a9a; }
.slide-badge.neutral { background: rgba(255,255,255,0.08); color: #cfc6b8; }
.slide-name { font-family: 'Bungee', sans-serif; font-size: 20px; color: #F4EDE0; line-height: 1.1; }
.slide-meta { font-size: 13px; color: #9a9086; }
.slide-diff { color: #FFB03A; font-size: 15px; letter-spacing: 2px; }
.slide-blurb { font-size: 13px; color: #cfc6b8; min-height: 34px; }
.slide-pick { margin-top: 4px; font-size: 13px; font-weight: 700; color: #9a9086; }
.slide-pick.on { color: #FF3D7F; }

/* ---- travel / road-event screen ---- */
.travel { gap: 4px; }
.travel-canvas { width: 100%; max-width: 440px; image-rendering: pixelated; border-radius: 12px; border: 1px solid rgba(255,255,255,0.1); background: #14101c; touch-action: none; }
.route-ribbon { display: flex; align-items: center; gap: 8px; width: 100%; max-width: 440px; margin: 6px 0 10px; }
.route-end { font-size: 11px; color: #9a9086; white-space: nowrap; max-width: 84px; overflow: hidden; text-overflow: ellipsis; }
.route-end.next { color: #57E0E8; text-align: right; }
.route-line { position: relative; flex: 1; height: 4px; border-radius: 3px; background: repeating-linear-gradient(90deg, rgba(255,255,255,0.22) 0 5px, transparent 5px 10px); }
.route-fill { position: absolute; left: 0; top: 0; height: 100%; border-radius: 3px; background: #FF3D7F; }
.route-van { position: absolute; top: 50%; transform: translate(-50%, -60%); transition: left 0.05s linear; }
.event-card { display: flex; flex-direction: column; align-items: center; text-align: center; gap: 6px; width: 100%; max-width: 440px; margin-top: 8px; }
.event-kind { font-family: 'Bungee', sans-serif; font-size: 12px; letter-spacing: 0.1em; padding: 3px 12px; border-radius: 20px; }
.event-kind.k-good { background: rgba(140,255,158,0.15); color: #8CFF9E; }
.event-kind.k-bad { background: rgba(255,120,120,0.15); color: #ff9a9a; }
.event-kind.k-mix { background: rgba(255,176,58,0.15); color: #FFB03A; }
.event-title { font-size: 20px; color: #F4EDE0; margin: 2px 0; }
.event-desc { font-size: 14px; color: #cfc6b8; line-height: 1.45; max-width: 400px; }
.event-fx { display: flex; flex-wrap: wrap; gap: 8px; justify-content: center; margin: 6px 0 4px; }
.event-fx .fx { font-family: 'Bungee', sans-serif; font-size: 14px; padding: 4px 12px; border-radius: 10px; background: rgba(255,255,255,0.06); }
.event-fx .fx.pos { color: #8CFF9E; } .event-fx .fx.neg { color: #ff9a9a; }
.event-fx .fx.neutral { color: #9a9086; }
.route-fx { align-items: center; margin-top: 2px; }
.route-fx-label { font-size: 12px; color: #9a9086; }

/* ---- route selection (fork in the road) ---- */
.route-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; width: 100%; max-width: 620px; margin-top: 8px; }
@media (max-width: 620px) { .route-grid { grid-template-columns: 1fr; } }
.route-card {
  display: flex; flex-direction: column; align-items: center; text-align: center; gap: 6px;
  padding: 16px 12px 14px; border-radius: 14px; cursor: pointer; color: inherit; font-family: inherit;
  background: rgba(255,255,255,0.05); border: 2px solid rgba(255,255,255,0.12);
  transition: border-color .14s, transform .1s, background .14s;
}
.route-card:hover, .route-card:active { border-color: var(--rc); background: color-mix(in srgb, var(--rc) 10%, transparent); transform: translateY(-3px); }
.route-name { font-family: 'Bungee', sans-serif; font-size: 15px; color: #F4EDE0; }
.route-blurb { font-size: 12.5px; color: #cfc6b8; line-height: 1.35; min-height: 50px; }
.route-guar { display: flex; flex-wrap: wrap; gap: 6px; justify-content: center; min-height: 26px; align-items: center; }
.route-guar .fx { font-family: 'Bungee', sans-serif; font-size: 12px; padding: 3px 9px; border-radius: 8px; background: rgba(255,255,255,0.06); }
.route-risk { display: flex; align-items: center; gap: 8px; margin-top: 2px; }
.rr-label { font-size: 11px; letter-spacing: 0.08em; text-transform: uppercase; color: #9a9086; }
.rr-dots { display: flex; gap: 4px; }
.rr-dot { width: 9px; height: 9px; border-radius: 50%; background: rgba(255,255,255,0.14); }
.rr-dot.on { background: var(--rc); }

/* ---- reputation ---- */
.rep-badge { font-family: 'Bungee', sans-serif; font-size: 10px; letter-spacing: 0.06em; padding: 3px 9px; border-radius: 20px; white-space: nowrap; }
.rep-badge.b-good { background: rgba(87,224,232,0.16); color: #57E0E8; border: 1px solid rgba(87,224,232,0.45); }
.rep-badge.b-neutral { background: rgba(255,255,255,0.07); color: #9a9086; border: 1px solid rgba(255,255,255,0.16); }
.rep-badge.b-infamous { background: rgba(255,61,127,0.18); color: #FF6FA3; border: 1px solid rgba(255,61,127,0.5); }
.rep-line { width: 100%; border-radius: 12px; padding: 10px 14px; margin: 4px 0 10px; background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.1); }
.rep-line.b-infamous { background: rgba(255,61,127,0.07); border-color: rgba(255,61,127,0.3); }
.rep-line.b-good { background: rgba(87,224,232,0.06); border-color: rgba(87,224,232,0.26); }
.rep-head { display: flex; flex-wrap: wrap; gap: 2px 10px; align-items: baseline; }
.rep-title { font-size: 13.5px; color: #cfc6b8; }
.rep-title b { color: #F4EDE0; }
.rep-blurb { font-size: 12px; color: #8d8478; font-style: italic; }
.rep-meters { display: flex; gap: 14px; margin-top: 7px; }
.rep-meter { display: flex; align-items: center; gap: 6px; flex: 1; }
.rm-label { font-size: 10px; letter-spacing: 0.08em; text-transform: uppercase; color: #8d8478; min-width: 42px; }
.rm-track { flex: 1; height: 5px; border-radius: 3px; background: rgba(255,255,255,0.09); overflow: hidden; }
.rm-fill { height: 100%; border-radius: 3px; transition: width .35s ease; }
.rm-fill.cred { background: #57E0E8; }
.rm-fill.inf { background: #FF3D7F; }
.rep-note { font-size: 12px; color: #FF9ec4; margin: 7px 0 0; line-height: 1.35; }
.rep-note.dim-note { color: #b09a86; }
.end-rep { font-size: 14px; line-height: 1.45; text-align: center; margin: 2px 0 6px; max-width: 420px; }
.end-rep.b-infamous { color: #FF9ec4; }
.end-rep.b-good { color: #8FEAF0; }
.end-rep.b-neutral { color: #9a9086; }

/* ---- export hint spacing (button has a 6px drop shadow) ---- */
.export-hint { margin-top: 6px; text-align: center; line-height: 1.4; }

/* ---- tour score on the end screen ---- */
.tour-score { display: flex; flex-direction: column; align-items: center; gap: 2px; margin: 12px 0 4px; }
.tour-score-num { font-family: 'Bungee', sans-serif; font-size: 38px; line-height: 1; color: #FFB03A; text-shadow: 0 0 22px rgba(255,176,58,0.3); }

/* ---- arcade initials entry ---- */
.hs-entry { position: relative; overflow: hidden; }
.hs-rank { font-family: 'Bungee', sans-serif; font-size: 34px; color: #F4EDE0; margin: 2px 0; }
.hs-diff { font-size: 16px; color: #57E0E8; }
.hs-score { font-family: 'Bungee', sans-serif; font-size: 44px; color: #FFB03A; line-height: 1; margin-bottom: 4px; }
.reels { display: flex; gap: 14px; margin: 10px 0 4px; }
.reel { display: flex; flex-direction: column; align-items: center; gap: 4px; }
.reel-btn { width: 52px; height: 34px; border-radius: 8px; border: 1.5px solid rgba(255,255,255,0.18); background: rgba(255,255,255,0.06); color: #F4EDE0; font-size: 15px; cursor: pointer; -webkit-tap-highlight-color: transparent; }
.reel-btn:active { background: rgba(255,61,127,0.25); }
.reel-char { width: 52px; height: 58px; display: flex; align-items: center; justify-content: center; font-family: 'Bungee', sans-serif; font-size: 32px; color: #FF3D7F; background: rgba(255,61,127,0.08); border: 2px solid #FF3D7F; border-radius: 8px; }

/* ---- leaderboard ---- */
.lb { width: 100%; max-width: 440px; }
.lb-section { width: 100%; display: flex; flex-direction: column; align-items: center; }
.lb-tabs { display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px; margin-bottom: 10px; }
.lb-tab { padding: 8px 6px; border-radius: 9px; border: 1.5px solid rgba(255,255,255,0.14); background: rgba(255,255,255,0.05); color: #cfc6b8; font-family: inherit; font-size: 13px; font-weight: 700; cursor: pointer; }
.lb-tab.sel { border-color: #57E0E8; background: rgba(87,224,232,0.12); color: #F4EDE0; }
.lb-empty { text-align: center; padding: 14px 0; }
.lb-rows { display: flex; flex-direction: column; gap: 4px; }
.lb-row { display: grid; grid-template-columns: 30px 1fr auto auto; gap: 10px; align-items: baseline; padding: 8px 12px; border-radius: 9px; background: rgba(255,255,255,0.04); font-size: 14px; }
.lb-row.first { background: rgba(255,176,58,0.10); border: 1px solid rgba(255,176,58,0.3); }
.lb-row.me { background: rgba(255,61,127,0.16); border: 1px solid #FF3D7F; }
.lb-pos { font-family: 'Bungee', sans-serif; font-size: 13px; color: #9a9086; }
.lb-row.first .lb-pos { color: #FFB03A; }
.lb-name { font-family: 'Bungee', sans-serif; letter-spacing: 0.08em; color: #F4EDE0; }
.lb-meta { font-size: 11px; color: #8d8478; font-variant-numeric: tabular-nums; }
.lb-score { font-family: 'Bungee', sans-serif; font-size: 14px; color: #8CFF9E; font-variant-numeric: tabular-nums; }
`;
