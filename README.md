# Keytone

[中文](README.zh-CN.md)

Play an electronic keyboard with your computer keyboard, right in the browser. No server, no install.

**[▶ Play it online](https://jikunliu101.github.io/keytone/)**: works on desktop browsers and on phones in landscape (tested in Chromium and on iPhone). Click, tap or press a key once to start the sound.

## Features

- 17 curated sounds in 5 families: pianos, organs and harpsichord, ensemble and winds, plucked and mallets, and synths
- A 3D keyboard with an upright frosted-glass panel where soft light bars rise as you play, in a cool (Aurora) or warm (Amber) palette
- Scores on the glass: read along in jianpu (numbered notation), or play along with falling notes that drop onto their keys
- Practice mode: the score waits for the right note. Without it, falling notes keep time and count perfect / missing
- A score editor: type notes with the digit keys, keep your scores in the browser, import and export them as text
- Play with the computer keyboard, click and drag on the on-screen keys, or use touch (multi-finger)
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
| Hold `A` / `'` | −2 / +2 octaves |
| Hold `Space` | Sustain pedal |

Octave and sustain keys can be changed under **Keys**, which also lists the fixed shortcuts (press `F1`): Backspace to go back a phrase in practice (hold to start over), Tab / Shift+Tab for the next / previous score, Enter to play falling notes, and more.

You can also click and drag across the on-screen keys.

## Scores

Open **Score** in the control panel and pick **Jianpu** or **Falling**. Two songs are built in; **Edit scores…** opens the editor.

| In the editor | Does |
|---|---|
| `1`–`7` | Note (do re mi…) |
| `0` | Rest |
| `-` | Hold the previous note one beat longer |
| `/` | Halve the note you just typed (twice: a quarter) |
| `.` | Add a dot |
| `↑` / `↓` | Sharp / flat |
| Hold an octave key + digit | Low / high octave |
| `←` `→`, `Backspace` | Move, delete |

Bar lines follow the time signature automatically. The text view (and exported `.txt` files) use a small plain-text format described in the [spec](docs/spec.md#105-text-format).

On phones (landscape) scores are view-only: the jianpu shows one row and the keyboard slides to follow falling notes.

## Docs

- [Product spec](docs/spec.md)
- [Prior-art research](docs/research.md)

## License

Code: [MIT](LICENSE). Instrument samples are loaded at runtime from [smplr](https://github.com/danigb/smplr)'s hosts and keep their own licenses (public domain, CC0 and CC BY 3.0). See **Credits** in the app. An internet connection is needed to load sounds.

Typeface: [Barlow](https://github.com/jpt/barlow) by Jeremy Tribby, SIL Open Font License 1.1, bundled via Fontsource.
