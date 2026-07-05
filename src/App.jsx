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
];

// combine rules by modifier key
const MULT_KEYS = ["hitWindowMult", "missDrainMult", "scoreMult", "doorMult", "guaranteeMult", "fanConvMult", "promoCostMult", "fanPullMult", "highGradeFanBonus"];
const ADD_KEYS = ["crowdStartBonus", "perfectCrowdBonus", "loveBonus", "moraleRestBonus", "moraleDriveReduction", "costReduction", "ticketBonus", "flatFansPerGig"];

function aggregatePerks(ownedIds) {
  const m = {
    hitWindowMult: 1, missDrainMult: 1, scoreMult: 1, doorMult: 1, guaranteeMult: 1,
    fanConvMult: 1, promoCostMult: 1, fanPullMult: 1, highGradeFanBonus: 1,
    crowdStartBonus: 0, perfectCrowdBonus: 0, loveBonus: 0, moraleRestBonus: 0,
    moraleDriveReduction: 0, costReduction: 0, ticketBonus: 0, flatFansPerGig: 0,
    hatePenaltyReduction: 0, moraleFloor: 0, reviveOnce: false,
  };
  for (const id of ownedIds) {
    const perk = PERKS.find((p) => p.id === id);
    if (!perk) continue;
    for (const [k, v] of Object.entries(perk.mods)) {
      if (MULT_KEYS.includes(k)) m[k] *= v;
      else if (ADD_KEYS.includes(k)) m[k] += v;
      else if (k === "hatePenaltyReduction") m[k] = 1 - (1 - m[k]) * (1 - v); // stack toward 1, never over
      else if (k === "moraleFloor") m[k] = Math.max(m[k], v);
      else if (k === "reviveOnce") m[k] = m[k] || v;
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
    case "driving": // busy: kick doubles, extra ghost snare
      return { kick: s % 4 === 0 || s === 6 || (s === 14 && rng() < 0.7), snare: s === 4 || s === 12, hat: true };
    case "syncopated": // off-beat kicks, backbeat snare
      return { kick: s === 0 || s === 3 || s === 6 || s === 10, snare: s === 4 || s === 12, hat: s % 2 === 1 };
    default: // straight
      return { kick: s % 4 === 0 || (s === 14 && rng() < 0.4), snare: s === 4 || s === 12, hat: s % 2 === 0 };
  }
}

function buildChart(song, tier, seed) {
  const rng = mulberry32(seed);
  const spb = 60 / song.bpm;          // seconds per beat
  const step = spb / 4;               // 16th notes
  const bars = 16;
  const density = Math.min(0.9, 0.3 + song.diff * 0.1 + tier * 0.05);
  const notes = [];   // {t, lane}
  const audio = [];   // {t, inst, freq}
  const bassLine = ROOTS[song.root] || ROOTS.Am;
  // syncopated/driving feels put bass on off-beats; others on strong beats
  const bassSteps = (song.feel === "syncopated")
    ? [0, 3, 6, 8, 11, 14]
    : (song.feel === "halftime")
    ? [0, 8]
    : [0, 4, 8, 12, 6];

  for (let bar = 0; bar < bars; bar++) {
    const bt = bar * 16 * step;
    for (let s = 0; s < 16; s++) {
      const t = bt + s * step;
      const p = feelPattern(song.feel, s, bar, rng);
      const isKick = p.kick, isSnare = p.snare, isHat = p.hat;
      const isBass = bassSteps.includes(s) && rng() < 0.82;
      if (isKick) audio.push({ t, inst: "kick" });
      if (isSnare) audio.push({ t, inst: "snare" });
      if (isHat) audio.push({ t, inst: "hat" });
      if (isBass) audio.push({ t, inst: "bass", freq: bassLine[bar % 4] * (s >= 8 ? 2 : 1) });

      // map instrument hits to note lanes, thinned by density
      const cand = [];
      if (isKick) cand.push(0);
      if (isSnare) cand.push(1);
      if (isHat && rng() < density * 0.55) cand.push(2);
      if (isBass && rng() < density * 0.7) cand.push(3);
      let placed = 0;
      for (const lane of cand) {
        if (placed >= 2) break;                      // max 2-note chords
        if (lane >= 2 && bar < 2) continue;          // gentle intro
        if (rng() < (lane < 2 ? density + 0.25 : density)) {
          notes.push({ t, lane, hit: false, judged: null });
          placed++;
        }
      }
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
function Gig({ song, tier, morale, calOffset, perkMods, seed, onDone }) {
  const canvasRef = useRef(null);
  const stateRef = useRef(null);
  const padsRef = useRef(null);
  const [hud, setHud] = useState({ score: 0, combo: 0, crowd: 60, acc: 1, count: 3 });
  const [padDown, setPadDown] = useState([false, false, false, false]);
  const [flash, setFlash] = useState(null);

  const pm = perkMods || {};
  const effMorale = pm.moraleFloor ? Math.max(morale, pm.moraleFloor) : morale;
  const winScale = effMorale < 20 ? 0.75 : effMorale < 40 ? 0.85 : 1;
  const hitMult = pm.hitWindowMult || 1;
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
    const chart = buildChart(song, tier, seed);
    const t0 = ctx.currentTime + 3.2; // countdown
    const startCrowd = Math.min(100, 60 + (pm.crowdStartBonus || 0));
    const S = {
      ctx, synth, chart, t0, audioIdx: 0, started: false, finished: false,
      score: 0, combo: 0, maxCombo: 0, crowd: startCrowd, pts: 0, total: 0,
      pressFx: [-9, -9, -9, -9], judgeFx: null, deltas: [],
      missDrainMult: pm.missDrainMult || 1, canRevive: !!pm.reviveOnce, revived: false,
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
  }, [song, tier, seed, onDone, W_GOOD, calOffset, doHit, lightPad, pm]); // eslint-disable-line

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

const loadCalOffsetMs = () => {
  if (typeof window === "undefined") return null;
  const saved = window.localStorage.getItem(CAL_KEY);
  return saved !== null ? parseFloat(saved) : null;
};

/* ============================ APP ============================ */
export default function App() {
  const [seed] = useState(() => (Math.random() * 1e9) | 0);
  const [calOffsetMs, setCalOffsetMs] = useState(loadCalOffsetMs);
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

  const perkMods = React.useMemo(() => aggregatePerks(ownedPerks), [ownedPerks]);

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
    setPlan({ deal: "door", promo: 0, song: SONGS[1], travel: "rest" });
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
    const guarantee = Math.round((city.draw * 3 + tier * 200) * (perkMods.guaranteeMult || 1));
    const door = Math.round(shownAttend * ticket * 0.6 * PERF[result.grade] * (perkMods.doorMult || 1));
    const revenue = plan.deal === "guarantee" ? guarantee : door;
    const highGrade = result.grade === "S" || result.grade === "A";
    const newFans = Math.round(
      shownAttend * CONV[result.grade] * (perkMods.fanConvMult || 1) * (highGrade ? (perkMods.highGradeFanBonus || 1) : 1)
    ) + (perkMods.flatFansPerGig || 0);
    setCash((v) => v + revenue);
    setFans((v) => v + newFans);
    setMorale((m) => applyMoraleFloor(Math.min(100, m + (result.grade === "S" || result.grade === "A" ? 8 : result.grade === "F" ? -12 : 0))));
    setHistory((h) => [...h, {
      city: city.name, song: plan.song.name, grade: result.grade,
      acc: Math.round(result.acc * 100), revenue, newFans,
      deltaMeanMs: result.deltaMeanMs, deltaStdMs: result.deltaStdMs,
    }]);
    setResult({ ...res_merge(result), settled: true, revenue, newFans, shownAttend });
    function res_merge(r) { return r; }
  }, [phase]); // eslint-disable-line

  // after viewing results: a B/A/S gig with perks still in the pool offers a perk
  const afterResult = () => {
    if (cash < 0) { setPhase("end"); return; }
    const qualifies = ["B", "A", "S"].includes(result?.grade);
    const poolLeft = PERKS.length - ownedPerks.length;
    if (qualifies && poolLeft > 0) {
      setPerkOffer(drawPerks(ownedPerks, 3));
      setPhase("perks");
    } else {
      advanceStop();
    }
  };

  const advanceStop = () => {
    if (cash < 0) { setPhase("end"); return; }
    if (stop + 1 >= TOTAL_STOPS) setPhase("end");
    else { setStop((s) => s + 1); setPhase("map"); }
  };

  const choosePerk = (id) => {
    if (id) setOwnedPerks((p) => (p.includes(id) ? p : [...p, id]));
    setPerkOffer([]);
    advanceStop();
  };

  const restart = () => {
    setStop(0); setCash(600); setFans(120); setMorale(80);
    setHistory([]); setResult(null); setFeedback({ rating: 0, notes: "" });
    setOwnedPerks([]); setPerkOffer([]); setPhase("map");
  };

  const exportPlaytestData = () => {
    const data = {
      exportedAt: new Date().toISOString(),
      calibrationOffsetMs: calOffsetMs,
      device: typeof navigator !== "undefined" ? navigator.userAgent : "unknown",
      finalCash: cash, finalFans: fans,
      perks: ownedPerks,
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
          <button className="btn big" onClick={() => setPhase("map")}>Load the van →</button>
          <button className="relink" onClick={() => setPhase("calibrate")}>
            {calOffsetMs === 0 ? "Calibrate audio timing ▸" : `Recalibrate audio (currently ${calOffsetMs}ms) ▸`}
          </button>
        </div>
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
          seed={seed + stop * 977} onDone={onGigDone} />
      )}

      {phase === "result" && result?.settled && (
        <div className="panel center">
          <div className="kicker">{city.name} — set complete</div>
          <div className={"grade g-" + result.grade}>{result.grade}</div>
          {result.walked && <p className="warn">The crowd walked out. Brutal night.</p>}
          <div className="res-grid">
            <div><span className="dim">Accuracy</span><b>{Math.round(result.acc * 100)}%</b></div>
            <div><span className="dim">Max combo</span><b>{result.maxCombo}×</b></div>
            <div><span className="dim">Crowd</span><b>~{result.shownAttend}</b></div>
            <div><span className="dim">Payout</span><b>{fmt$(result.revenue)}</b></div>
            <div><span className="dim">New fans</span><b>+{result.newFans}</b></div>
          </div>
          {["B", "A", "S"].includes(result.grade) && ownedPerks.length < PERKS.length && cash >= 0 && (
            <p className="perk-teaser">✦ Strong set — pick a tour perk next ✦</p>
          )}
          <button className="btn big" onClick={afterResult}>
            {stop + 1 >= TOTAL_STOPS || cash < 0 ? "Wrap the tour →"
              : ["B", "A", "S"].includes(result.grade) && ownedPerks.length < PERKS.length ? "Choose a perk →"
              : "Back in the van →"}
          </button>
        </div>
      )}

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

      {phase === "end" && (
        <div className="panel center">
          <div className="kicker">TOUR OVER</div>
          <h1 className="logo sm">{cash < 0 ? "BANKRUPT\nIN A MOTEL" : fans >= 1200 ? "SIGNED." : fans >= 600 ? "BUZZ BAND" : "LOCAL LEGEND"}</h1>
          <div className="res-grid">
            <div><span className="dim">Final cash</span><b>{fmt$(cash)}</b></div>
            <div><span className="dim">Fanbase</span><b>{fans.toLocaleString()}</b></div>
          </div>
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
            <p className="hint">Downloads a JSON file — send it back so runs from different testers can be compared.</p>
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
.btn.big { margin-top: 18px; padding: 15px 26px; font-size: 17px; background: #FF3D7F; color: #17111f; box-shadow: 0 6px 0 #a11f4e; transition: transform .08s; width: 100%; max-width: 420px;}
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
`;
