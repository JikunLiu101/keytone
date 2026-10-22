# Keytone

[中文](README.zh-CN.md)

Play an electronic keyboard with your computer keyboard, right in the browser. No server, no install.

**[▶ Play it online](https://jikunliu101.github.io/keytone/)**: best on a desktop browser (tested in Chromium). Click or press a key once to start the sound.

## Features

- 17 curated sounds in 5 families: pianos, organs and harpsichord, ensemble and winds, plucked and mallets, and synths
- A 3D keyboard with an upright frosted-glass panel where coloured light bars rise as you play, one colour per note
- Play with the computer keyboard, or click and drag on the on-screen keys
- Hold-to-shift octave keys and a sustain pedal, all rebindable
- Volume, velocity (shown as dynamics, pp to fff), reverb and light-bar controls
- English and Chinese UI; settings are remembered in your browser
- Respects "reduce motion" and works with keyboard and screen readers

## Run locally

Requires Node.js 20+.

```bash
npm install
npm run dev
```

Then open http://localhost:5173.

## How to play

| Keys | Notes |
|---|---|
| `Z X C V B N M` | C D E F G A B (C3–B3) |
| `S D G H J` | C# D# F# G# A# |
| `, . /` and `L ;` | C4 D4 E4 and C#4 D#4 |
| Hold `Left Shift` / `Right Shift` | −1 / +1 octave |
| Hold `Space` | Sustain pedal |

Octave and sustain keys can be changed under **Keys**. The ±2 octave keys are unbound by default.

You can also click and drag across the on-screen keys.

## Docs

- [Product spec](docs/spec.md)
- [Prior-art research](docs/research.md)

## License

Code: [MIT](LICENSE). Instrument samples are loaded at runtime from [smplr](https://github.com/danigb/smplr)'s hosts and keep their own licenses (public domain, CC0 and CC BY 3.0). See **Credits** in the app. An internet connection is needed to load sounds.

Typeface: [Barlow](https://github.com/jpt/barlow) by Jeremy Tribby, SIL Open Font License 1.1, bundled via Fontsource.
