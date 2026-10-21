# Keytone

[中文](README.zh-CN.md)

Play an electronic keyboard with your computer keyboard, right in the browser. No server, no install.

> Work in progress (milestone M1: grand piano, key mapping, octave keys, sustain, mouse playing).

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

You can also click and drag across the on-screen keys.

## Docs

- [Product spec](docs/spec.md)
- [Prior-art research](docs/research.md)

## License

Code: [MIT](LICENSE). Instrument samples are loaded from [smplr](https://github.com/danigb/smplr)'s hosts and keep their own licenses. The grand piano is Splendid Grand Piano, which is public domain.
