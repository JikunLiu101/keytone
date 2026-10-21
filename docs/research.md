# Keytone — Prior-Art Research

> Researched 2026-10-21. Stars, licenses and last-push dates come from the GitHub API on that day. Chinese version: [research.zh-CN.md](research.zh-CN.md).

Goal: a browser-only app that plays an electronic keyboard and other instrument sounds from a piano-style keyboard.

## 1. Summary

- No mature open-source project matches the goal. Existing projects are either:
  - audio libraries that make sound but provide no UI, or
  - demo-grade piano pages.
- The best route is to build our own UI on top of a mature audio library and free sample sets. We don't need to fork any existing app.
- It is a static site, so hosting costs are effectively zero on the free tiers of Cloudflare Pages, GitHub Pages or Vercel. The only things to plan are sample size and where the samples are hosted.

## 2. Projects Reviewed

### 2.1 Audio engines (the core reusable part)

| Project | Stars | License | Last push | Notes |
|---|---|---|---|---|
| [danigb/smplr](https://github.com/danigb/smplr) | 328 | MIT | 2026-09 | **Chosen.** Ready-made sampled instruments: GM soundfonts, a Steinway with 4 velocity layers, 4 electric pianos, drum machines, mallets, Mellotron and double bass. It also reads `.sf2` files. It has built-in reverb, CacheStorage and sustain (CC64). Samples are hosted on GitHub by default, and the URLs can be overridden. It is v1.x, and the API may still change. |
| [Tonejs/Tone.js](https://github.com/Tonejs/Tone.js) | 14.8k | MIT | 2026-10 | The main Web Audio framework: synths, effects, sampler and scheduling. A good fit for synth-style sounds and effect chains. It ships no instrument samples. |
| [spessasus/spessasynth_lib](https://github.com/spessasus/spessasynth_lib) | 53 (app: 413) | Apache-2.0 | 2026-10 | A full SF2/SF3/DLS synth running in an AudioWorklet. One GM bank gives 128 instruments plus drums. The cost is downloading a bank of tens of MB. |
| [surikov/webaudiofont](https://github.com/surikov/webaudiofont) | 991 | **GPL-3.0** | 2026-09 | A huge instrument catalog. Its code is GPL, so using it would make the whole project GPL. |
| [g200kg/webaudio-tinysynth](https://github.com/g200kg/webaudio-tinysynth) | 270 | Apache-2.0 | 2022-12 | A GM synth with no samples. It is tiny, but the sound quality is average. |
| [jet2jet/js-synthesizer](https://github.com/jet2jet/js-synthesizer) | 79 | BSD-3 | 2026-08 | FluidSynth compiled to WASM. Powerful but heavy. |
| [danigb/soundfont-player](https://github.com/danigb/soundfont-player) | 476 | MIT | archived | Replaced by smplr. |

### 2.2 Free sample sets

| Source | License | Notes |
|---|---|---|
| [gleitz/midi-js-soundfonts](https://github.com/gleitz/midi-js-soundfonts) – FluidR3_GM | CC BY 3.0 | 128 GM instruments, each loadable on its own. This is smplr's default GM source. |
| Same repo – MusyngKite / FatBoy | CC BY-SA 3.0 | Better quality, but the share-alike terms apply. Avoid. |
| [smpldsnds](https://github.com/smpldsnds) org | Mostly CC0, public domain or CC BY 3.0 | Includes Splendid Grand Piano (public domain), Rhodes (CC0), Greg Sullivan e-pianos (CC BY 3.0) and VCSL (CC0). smplr uses these directly. |
| [GeneralUser GS](https://github.com/mrbumpy409/GeneralUser-GS) | Custom; commercial use and redistribution allowed | A compact, good-quality GM SoundFont. Host your own copy rather than hotlinking. |
| [Salamander Grand Piano](https://github.com/sfzinstruments/SalamanderGrandPiano) | CC BY 3.0 | A high-quality piano. [tambien/Piano](https://github.com/tambien/Piano) (MIT) wraps it for Tone.js. |
| [nbrosowsky/tonejs-instruments](https://github.com/nbrosowsky/tonejs-instruments) | Not declared | About 20 instruments for Tone.js. Its license is unclear, so treat it with caution. |

### 2.3 Keyboard UI and input

| Project | Stars | License | Notes |
|---|---|---|---|
| [kevinsqi/react-piano](https://github.com/kevinsqi/react-piano) | 318 | MIT | A React piano component with mouse, touch and keyboard support. Inactive since 2023. |
| [tigranpetrossian/klavier](https://github.com/tigranpetrossian/klavier) | — | — | A newer, lightweight React keyboard. |
| [stuartmemo/qwerty-hancock](https://github.com/stuartmemo/qwerty-hancock) | 275 | MIT | A framework-agnostic keyboard UI that is still maintained. |
| [kylestetz/AudioKeys](https://github.com/kylestetz/AudioKeys) | 243 | MIT | Maps the QWERTY keyboard to notes and handles key repeat and polyphony. |
| [djipco/webmidi](https://github.com/djipco/webmidi) | 1.7k | Apache-2.0 | The standard library for external MIDI keyboards. |

### 2.4 Complete apps (references for architecture and interaction, not for code reuse)

| Project | Stars | License | Takeaways |
|---|---|---|---|
| [ryohey/signal](https://github.com/ryohey/signal) | 2.4k | MIT | A mature online MIDI editor built with TypeScript and React. Good separation between the audio engine and the UI. |
| [googlecreativelab/chrome-music-lab](https://github.com/googlecreativelab/chrome-music-lab) | 2.4k | Apache-2.0 | The benchmark for interaction and visual feedback. Older code. |
| [johnnesky/beepbox](https://github.com/johnnesky/beepbox) | 1.2k | MIT | A static site with purely synthesized sounds. |
| [SpessaSynth](https://spessasus.github.io/SpessaSynth/) | 413 | Apache-2.0 | Its demo has a virtual keyboard and instrument switching, which is the closest to our feature set. |
| [Klavier (Vict1111-code)](https://github.com/Vict1111-code/klavier-Virtual_Keyboard) | small | — | Plain HTML/JS with 10 synth voices. Demo-grade. |
| Online-Piano, webaudiofont-piano, Open-Web-Piano, etc. | 0–32 | Mostly no license | Demo-grade. Code with no license cannot be reused. |

## 3. Common Architecture

```
input     mouse/touch   QWERTY   MIDI device
   ↓        (normalised to noteOn / noteOff / CC events)
control   instrument, octave, velocity, sustain, volume
   ↓
engine    samples (smplr) | SoundFont (SpessaSynth) | synth (Tone.js)
   ↓
effects   reverb / EQ / master → AudioContext.destination
```

Key points:
- **Normalize input to MIDI-style events.** Recording or playback can be added later.
- **Put a swappable `Instrument` interface over different engines.**
- **Load samples lazily and cache them** with the Cache API or a Service Worker.
- **Audio starts only after a user gesture,** so the app needs an `AudioContext` unlock.
- **Latency of about 10–30 ms is acceptable.**
- **On the QWERTY side, handle key repeat and ghosting.** Ghosting is the hardware limit on how many keys can be held at once.

## 4. Hosting Cost

| Option | Cost | Limits |
|---|---|---|
| Cloudflare Pages | Free | Files of at most 25 MiB each, up to 20,000 files per site, 500 builds per month. Static traffic is not billed. |
| GitHub Pages | Free | Repos of about 1 GB or less are recommended. There is a soft bandwidth cap. |
| Vercel / Netlify free tier | Free | About 100 GB of bandwidth per month. |
| Cloudflare R2 for samples | Free up to 10 GB, with free egress | For when the samples grow. |
| smplr default GitHub-hosted samples | Free | Rate-limited, and not under our control. Fine for a prototype. |

Size estimates:
- One sampled mp3 instrument is about 0.5–3 MB.
- A GM SoundFont (sf3) is about 10–30 MB. Files over 25 MiB need R2.

Conclusion: hosting is free from prototype to production. A custom domain costs about $10 a year.

## 5. Reuse Recommendations

| Purpose | Choice |
|---|---|
| Audio engine | **smplr** |
| Synth sounds and effects | Tone.js, when needed |
| Full 128-sound GM set (optional) | SpessaSynth + GeneralUser GS |
| Keyboard UI | Our own, using react-piano as a reference |
| QWERTY mapping | Ideas from AudioKeys |
| MIDI keyboards | WEBMIDI.js, when needed |
| Avoid | WebAudioFont (GPL), unlicensed small projects, soundfont-player (archived) |

Sample licenses: prefer CC0, public domain and CC BY. CC BY requires attribution, and CC BY-SA should be avoided.
