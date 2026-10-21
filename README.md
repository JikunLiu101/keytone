# Keytone

[中文](README.zh-CN.md)

Play an electronic keyboard with your computer keyboard, right in the browser. No server, no install.

## Features

- 17 curated sounds: grand piano, electric pianos, organs, harpsichord, strings, choir, flute, brass, guitar, mallets, music box and synths
- Play with the computer keyboard, or click and drag on the on-screen keys
- Hold-to-shift octave keys and a sustain pedal, all rebindable
- Volume, velocity and reverb controls
- English and Chinese UI
- Settings are remembered in your browser

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
