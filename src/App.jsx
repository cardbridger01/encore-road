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
const SONGS = [
  { id: "s1", name: "Gasoline Halo", tag: "punk",   bpm: 168, diff: 3, blurb: "2-min buzzsaw. Punk crowds lose it." },
  { id: "s2", name: "Neon Mile",     tag: "synth",  bpm: 122, diff: 1, blurb: "Synthwave cruiser. Easy hands." },
  { id: "s3", name: "Cathedral Amp", tag: "anthem", bpm: 138, diff: 2, blurb: "Big-room singalong anthem." },
  { id: "s4", name: "Rust & Roses",  tag: "ballad", bpm: 96,  diff: 1, blurb: "Lighters up. Slow, forgiving." },
  { id: "s5", name: "Blackout Fret", tag: "metal",  bpm: 182, diff: 4, blurb: "Riff avalanche. Experts only." },
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

// ---------- chart + audio generation ----------
function buildChart(song, tier, seed) {
  const rng = mulberry32(seed);
  const spb = 60 / song.bpm;          // seconds per beat
  const step = spb / 4;               // 16th notes
  const bars = 16;
  const density = Math.min(0.9, 0.3 + song.diff * 0.1 + tier * 0.05);
  const notes = [];   // {t, lane}
  const audio = [];   // {t, inst, freq}
  const bassLine = [55, 55, 65.4, 49]; // A, A, C, G per bar cycle

  for (let bar = 0; bar < bars; bar++) {
    const bt = bar * 16 * step;
    for (let s = 0; s < 16; s++) {
      const t = bt + s * step;
      const isKick = s % 4 === 0 || (s === 14 && rng() < 0.5);
      const isSnare = s === 4 || s === 12;
      const isHat = s % 2 === 0;
      const isBass = [0, 3, 6, 8, 11, 14].includes(s) && rng() < 0.8;
      if (isKick) audio.push({ t, inst: "kick" });
      if (isSnare) audio.push({ t, inst: "snare" });
      if (isHat) audio.push({ t, inst: "hat" });
      if (isBass) audio.push({ t, inst: "bass", freq: bassLine[bar % 4] * (s === 8 ? 2 : 1) });

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

/* ============================ GIG SCENE ============================ */
function Gig({ song, tier, morale, seed, onDone }) {
  const canvasRef = useRef(null);
  const stateRef = useRef(null);
  const [hud, setHud] = useState({ score: 0, combo: 0, crowd: 60, acc: 1, count: 3 });
  const [flash, setFlash] = useState(null);

  const winScale = morale < 20 ? 0.75 : morale < 40 ? 0.85 : 1;
  const W_PERF = 0.055 * winScale, W_GOOD = 0.125 * winScale;

  const doHit = useCallback((lane) => {
    const S = stateRef.current;
    if (!S || S.finished || !S.started) return;
    const now = S.ctx.currentTime - S.t0;
    S.pressFx[lane] = now;
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
      S.judgeFx = { text: perfect ? "PERFECT" : "GOOD", t: now, lane };
      S.combo++;
      S.maxCombo = Math.max(S.maxCombo, S.combo);
      const mult = 1 + Math.min(3, Math.floor(S.combo / 10) * 0.5);
      S.score += Math.round((perfect ? 100 : 55) * mult);
      S.pts += perfect ? 1 : 0.6; S.total++;
      S.crowd = Math.min(100, S.crowd + (perfect ? 2 : 1));
    }
  }, [W_PERF, W_GOOD]);

  useEffect(() => {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const synth = makeSynth(ctx);
    const chart = buildChart(song, tier, seed);
    const t0 = ctx.currentTime + 3.2; // countdown
    const S = {
      ctx, synth, chart, t0, audioIdx: 0, started: false, finished: false,
      score: 0, combo: 0, maxCombo: 0, crowd: 60, pts: 0, total: 0,
      pressFx: [-9, -9, -9, -9], judgeFx: null,
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

      // miss sweep
      for (const n of chart.notes) {
        if (!n.judged && n.t < now - W_GOOD) {
          n.judged = "miss";
          S.combo = 0; S.total++;
          S.crowd = Math.max(0, S.crowd - 6);
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

      // end conditions
      const crowdWalked = S.crowd <= 0 && now > 2;
      if ((now > chart.length + 1.2 || crowdWalked) && !S.finished) {
        S.finished = true;
        const acc = S.total ? S.pts / Math.max(S.total, chart.notes.length * 0.4) : 0;
        const finalAcc = chart.notes.length ? S.pts / chart.notes.length : 0;
        onDone({
          grade: crowdWalked ? "F" : gradeOf(finalAcc),
          acc: finalAcc, score: S.score, maxCombo: S.maxCombo, walked: crowdWalked,
        });
        return;
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    const onKey = (e) => {
      const i = LANE_KEYS.indexOf(e.key.toLowerCase());
      if (i >= 0 && !e.repeat) doHit(i);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      clearInterval(schedTimer);
      cancelAnimationFrame(raf);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", resize);
      ctx.close();
    };
  }, [song, tier, seed, onDone, W_GOOD]); // eslint-disable-line

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
        <div className="pads">
          {LANE_COLORS.map((c, i) => (
            <button key={i} className="pad" style={{ "--pc": c }}
              onPointerDown={(e) => { e.preventDefault(); doHit(i); }}>
              {LANE_KEYS[i].toUpperCase()}
            </button>
          ))}
        </div>
      </div>
      <div className="gig-song">♪ {song.name} — {song.bpm} BPM</div>
    </div>
  );
}

/* ============================ APP ============================ */
export default function App() {
  const [seed] = useState(() => (Math.random() * 1e9) | 0);
  const [phase, setPhase] = useState("title"); // title | map | plan | gig | result | end
  const [stop, setStop] = useState(0);
  const [cash, setCash] = useState(600);
  const [fans, setFans] = useState(120);
  const [morale, setMorale] = useState(80);
  const [city, setCity] = useState(null);
  const [plan, setPlan] = useState({ deal: "door", promo: 0, song: SONGS[1], travel: "rest" });
  const [result, setResult] = useState(null);
  const [history, setHistory] = useState([]);

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
  const ticket = 12 + tier * 8;

  const projAttend = (c, promo, song) => {
    const promoMult = promo === 0 ? 1 : promo === 150 ? 1.4 : 1.8;
    const arch = ARCH[c.arch];
    const match = song.tag === arch.loves ? 1.3 : song.tag === arch.hates ? 0.75 : 1;
    const fanPull = 1 + fans / 500;
    return Math.min(c.draw * 1.6, Math.round(c.draw * promoMult * match * Math.min(2.2, fanPull)));
  };

  const pickCity = (c) => {
    setCity(c);
    setPlan({ deal: "door", promo: 0, song: SONGS[1], travel: "rest" });
    setPhase("plan");
  };

  const startGig = () => {
    const costs = plan.promo + 80 + (plan.travel === "rest" ? 120 : 0);
    setCash((v) => v - costs);
    setMorale((m) => Math.max(0, Math.min(100, m + (plan.travel === "rest" ? 15 : -18))));
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
    const guarantee = Math.round(city.draw * 3 + tier * 200);
    const door = Math.round(shownAttend * ticket * 0.6 * PERF[result.grade]);
    const revenue = plan.deal === "guarantee" ? guarantee : door;
    const newFans = Math.round(shownAttend * CONV[result.grade]);
    setCash((v) => v + revenue);
    setFans((v) => v + newFans);
    setMorale((m) => Math.min(100, m + (result.grade === "S" || result.grade === "A" ? 8 : result.grade === "F" ? -12 : 0)));
    setHistory((h) => [...h, { city: city.name, grade: result.grade, revenue, newFans }]);
    setResult({ ...res_merge(result), settled: true, revenue, newFans, shownAttend });
    function res_merge(r) { return r; }
  }, [phase]); // eslint-disable-line

  const nextStop = () => {
    if (cash < 0) { setPhase("end"); return; }
    if (stop + 1 >= TOTAL_STOPS) setPhase("end");
    else { setStop((s) => s + 1); setPhase("map"); }
  };

  const restart = () => {
    setStop(0); setCash(600); setFans(120); setMorale(80);
    setHistory([]); setResult(null); setPhase("map");
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

      {phase === "title" && (
        <div className="panel center">
          <div className="kicker">A ROGUELITE TOUR</div>
          <h1 className="logo">ENCORE<br />ROAD</h1>
          <p className="lede">Route the tour. Structure the deals. Then walk on stage and earn it — every gig is a rhythm game.</p>
          <p className="hint">Keys D F J K, or tap the pads on mobile.</p>
          <button className="btn big" onClick={() => setPhase("map")}>Load the van →</button>
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
        const guarantee = Math.round(city.draw * 3 + tier * 200);
        const doorEst = Math.round(attend * ticket * 0.6);
        const costs = plan.promo + 80 + (plan.travel === "rest" ? 120 : 0);
        const arch = ARCH[city.arch];
        return (
          <div className="panel">
            <StatBar />
            <h2 className="h2">{city.name} · <span className="dim">{arch.label}</span></h2>

            <div className="section">
              <div className="sec-label">Setlist — one song tonight</div>
              <div className="chips">
                {SONGS.map((s) => {
                  const m = s.tag === arch.loves ? "♥" : s.tag === arch.hates ? "✕" : "";
                  return (
                    <button key={s.id}
                      className={"chip" + (plan.song.id === s.id ? " sel" : "")}
                      onClick={() => setPlan({ ...plan, song: s })}>
                      <b>{s.name}</b> {m && <span className={m === "♥" ? "love" : "hate"}>{m}</span>}
                      <span className="chip-sub">{s.bpm} bpm · {"◆".repeat(s.diff)}{"◇".repeat(4 - s.diff)}</span>
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
                  <b>Motel night</b><span className="chip-sub">−$120 · morale +15</span>
                </button>
                <button className={"chip" + (plan.travel === "drive" ? " sel" : "")}
                  onClick={() => setPlan({ ...plan, travel: "drive" })}>
                  <b>Drive overnight</b><span className="chip-sub">free · morale −18 (tighter timing!)</span>
                </button>
              </div>
            </div>

            <div className="proj">
              Projected crowd <b>~{attend}</b> · costs tonight <b>{fmt$(costs)}</b>
              {morale - (plan.travel === "drive" ? 18 : -15) < 40 && (
                <span className="warn"> · low morale will shrink your hit windows</span>
              )}
            </div>
            <button className="btn big" onClick={startGig}>Doors open — play the gig →</button>
          </div>
        );
      })()}

      {phase === "gig" && city && (
        <Gig song={plan.song} tier={tier}
          morale={Math.max(0, Math.min(100, morale + (plan.travel === "rest" ? 15 : -18)))}
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
          <button className="btn big" onClick={nextStop}>
            {stop + 1 >= TOTAL_STOPS || cash < 0 ? "Wrap the tour →" : "Back in the van →"}
          </button>
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
  min-height: 100vh; width: 100%;
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
.gig { width: 100%; max-width: 520px; display: flex; flex-direction: column; height: calc(100vh - 60px); }
.gig-hud { display: flex; align-items: center; gap: 14px; padding-bottom: 10px; }
.hud-label { font-size: 11px; letter-spacing: 0.15em; text-transform: uppercase; color: #9a9086; }
.hud-big { font-size: 24px; font-weight: 700; }
.crowd-wrap { flex: 1; }
.crowd-bar { height: 12px; background: rgba(255,255,255,0.08); border-radius: 6px; overflow: hidden; margin-top: 4px; }
.crowd-fill { height: 100%; transition: width .2s; }
.stage-wrap { position: relative; flex: 1; min-height: 340px; border-radius: 16px; overflow: hidden; border: 1px solid rgba(255,255,255,0.1); background: #100b18; }
.stage { width: 100%; height: 100%; display: block; }
.pads { position: absolute; bottom: 0; left: 0; right: 0; display: flex; }
.pad { flex: 1; height: 76px; border: none; border-top: 3px solid var(--pc); background: linear-gradient(transparent, color-mix(in srgb, var(--pc) 22%, transparent)); color: var(--pc); font-family: 'Bungee', sans-serif; font-size: 18px; cursor: pointer; touch-action: manipulation; -webkit-tap-highlight-color: transparent; }
.pad:active { background: color-mix(in srgb, var(--pc) 35%, transparent); }
.gig-song { text-align: center; padding-top: 8px; font-size: 13px; color: #9a9086; }
.grade { font-family: 'Bungee', sans-serif; font-size: 110px; line-height: 1; }
.g-S { color: #FFB03A; text-shadow: 0 0 30px rgba(255,176,58,0.6); }
.g-A { color: #57E0E8; } .g-B { color: #B78CFF; } .g-C { color: #cfc6b8; } .g-F { color: #FF5A5A; }
.g-txt { font-weight: 700; }
.res-grid { display: flex; gap: 22px; flex-wrap: wrap; justify-content: center; margin-top: 8px; }
.res-grid > div { display: flex; flex-direction: column; gap: 2px; font-size: 15px; }
.res-grid b { font-size: 20px; }
.hist { width: 100%; max-width: 440px; margin-top: 14px; display: flex; flex-direction: column; gap: 6px; }
.hist-row { display: grid; grid-template-columns: 1.4fr 0.4fr 0.8fr 0.9fr; gap: 8px; background: rgba(255,255,255,0.05); padding: 9px 14px; border-radius: 9px; font-size: 14px; text-align: left; }
`;
