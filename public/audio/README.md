# Dropping your own music in

Every song ships with **procedural synth music** by default — no audio assets, no
loading, works offline. When you record real tracks, you can replace them one at a
time. Nothing else in the game has to change.

## The 3-step swap

1. Put your file here: `public/audio/gasoline-halo.mp3`
   (`.mp3`, `.ogg`, `.m4a`, `.wav` — anything the browser can decode.)

2. In `src/App.jsx`, find the song in the `SONGS` array and add `src`:

   ```js
   { id: "s1", name: "Gasoline Halo", tag: "punk", bpm: 168, diff: 3,
     feel: "syncopated", root: "Em", blurb: "2-min buzzsaw. Punk crowds lose it.",
     src: "/audio/gasoline-halo.mp3",   // <- add this
     srcOffset: 0.35,                   // <- seconds into the file where beat 1 lands
     gain: 0.9 },                       // <- optional, default 0.9
   ```

3. Push. That's it. The tappable chart, judging, scoring, difficulty modes, and
   the crowd meter all keep working, because notes are generated from the song's
   `bpm` and `feel` — not from the synth.

## Getting `srcOffset` right (the only fiddly part)

`srcOffset` is **how many seconds into your file the first downbeat happens**.
Almost every recording has a little silence or a count-in before the music starts;
this tells the game to skip it so beat 1 lines up with the chart.

- Open the file in any editor (Audacity works well).
- Find the exact start of the first downbeat.
- That timestamp, in seconds, is your `srcOffset`.

Off by even ~30ms and the notes will feel subtly wrong, so it's worth zooming in.
If the chart feels consistently *late*, increase `srcOffset`; if *early*, decrease it.

You can also use a negative `srcOffset` to delay the file, if the chart should
start before the audio does.

## `bpm` must be accurate and steady

The chart is generated from `bpm`, so:

- Set the song's `bpm` to your recording's **actual** tempo.
- The track needs a **steady tempo**. A song that drifts or rubatos will drift out
  of sync with the notes, because the chart is a rigid grid.
- If you record to a click, this is a non-issue.

## Safety net

If a file is missing, misspelled, or fails to decode, the game **falls back to the
synth automatically** and logs a warning to the console. A bad asset can never
leave a player with a silent gig. (This is tested — see `createTrack` in
`src/App.jsx`.)

## Notes on size

Audio is fetched during the 3.2-second countdown before each gig. Keep files
reasonably small (a 2-minute 128kbps mp3 is ~2MB) or the first play may start a
beat late — the engine handles this by seeking into the file to stay aligned
rather than drifting, but it's better to avoid it.

## Mixing to match

The synth kits are mastered to roughly **-21 dBFS RMS** with a limiter at -3 dB.
If you master your tracks near that, the game won't jump in volume between a
recorded song and a synth one while you're only part-way through replacing them.
