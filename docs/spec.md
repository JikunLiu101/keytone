# Keytone — Product Spec

> Status: M1 and M2 (version 1) implemented (2026-10-21). Chinese version: [spec.zh-CN.md](spec.zh-CN.md).

Keytone is a browser-only app that turns your computer keyboard into an electronic keyboard instrument with a small set of curated sounds.

## 1. Goals

- Personal use first. Published as an open-source repo so others can run or self-host it.
- Pure front end. Runs locally first, cloud deploy later.
- Desktop browsers first. Mobile comes later.

## 2. Scope

### Version 1
- 17 curated instruments
- Computer-keyboard playing with fixed note keys
- Mouse playing on the on-screen keys, including dragging across keys (glissando)
- Momentary octave-shift keys
- Sustain pedal
- Volume and velocity sliders
- Reverb on/off
- Configurable octave and sustain keys
- English / Chinese UI
- Keyboard rendered with 3D depth
- Collapsible control panel
- Sound source credits

### Version 2
- Light bars or bubbles rising from pressed keys, like the "dreamy piano" visual
- Touch input
- Mobile layout

### Later
- Self-hosted samples
- Cloud deploy
- External MIDI keyboards
- Optional Three.js renderer

## 3. Keyboard Mapping

### Note keys

Note keys are fixed. They are matched by physical key (`KeyboardEvent.code`), so the mapping does not depend on the keyboard layout.

At the default octave (no octave key held):

| Key | Note | Key | Note |
|---|---|---|---|
| `Z` | C3 | `S` | C#3 |
| `X` | D3 | `D` | D#3 |
| `C` | E3 | | |
| `V` | F3 | `G` | F#3 |
| `B` | G3 | `H` | G#3 |
| `N` | A3 | `J` | A#3 |
| `M` | B3 | | |
| `,` | C4 | `L` | C#4 |
| `.` | D4 | `;` | D#4 |
| `/` | E4 | | |

`Z` is "1" (do) of the default octave, and `, . /` are high 1 2 3.

### Octave keys
- These are momentary: an octave key works only while it is held.
- There are four octave keys, and each can be rebound:

  | Action | Default key |
  |---|---|
  | −1 octave | Left Shift |
  | +1 octave | Right Shift |
  | −2 octaves | not bound |
  | +2 octaves | not bound |

- Offsets from all held octave keys are added together, and the total is clamped to the range −2…+2.
  - Left Shift + Right Shift = 0.
  - +1 held with +2 = +2.
- A note's pitch is fixed at the moment its key goes down. Pressing or releasing an octave key does not change notes that are already sounding.
- There is no persistent base-octave control. `Z` is always C3 when no octave key is held.

### Sustain
- Held key, default `Space`. It can be rebound.
- While sustain is held, key releases are deferred until sustain is released.

### Input handling rules
- Ignore auto-repeat `keydown` events.
- Call `preventDefault` on mapped keys. Otherwise `Space` scrolls the page and `/` opens quick find in Firefox.
- Release all notes and reset octave and sustain state when the window loses focus.
- Do not trigger notes while focus is in a text field, such as the key-binding dialog.

### Playable range
- C1 to E6: 38 white keys plus their black keys.

## 4. Sound

### Instruments
All instruments come from [smplr](https://github.com/danigb/smplr).

| # | Instrument | smplr source | Sample license |
|---|---|---|---|
| 1 | Grand Piano (default) | `SplendidGrandPiano` | Public domain |
| 2 | Electric Piano – Wurlitzer | `ElectricPiano` WurlitzerEP200 | CC BY 3.0 (Greg Sullivan) |
| 3 | Electric Piano – CP80 | `ElectricPiano` CP80 | CC BY 3.0 (Greg Sullivan) |
| 4 | FM Electric Piano | `ElectricPiano` TX81Z | CC0 (VCSL) |
| 5 | Drawbar Organ | `Soundfont` FluidR3_GM | CC BY 3.0 |
| 6 | Church Organ | `Soundfont` FluidR3_GM | CC BY 3.0 |
| 7 | Harpsichord | `Soundfont` FluidR3_GM | CC BY 3.0 |
| 8 | String Ensemble | `Soundfont` FluidR3_GM | CC BY 3.0 |
| 9 | Choir | `Soundfont` FluidR3_GM | CC BY 3.0 |
| 10 | Flute | `Soundfont` FluidR3_GM | CC BY 3.0 |
| 11 | Brass Section | `Soundfont` FluidR3_GM | CC BY 3.0 |
| 12 | Nylon Guitar | `Soundfont` FluidR3_GM | CC BY 3.0 |
| 13 | Vibraphone | `Mallet` | CC0 (VCSL) |
| 14 | Xylophone | `Mallet` | CC0 (VCSL) |
| 15 | Music Box | `Soundfont` FluidR3_GM | CC BY 3.0 |
| 16 | Synth Lead | `Soundfont` FluidR3_GM | CC BY 3.0 |
| 17 | Synth Pad | `Soundfont` FluidR3_GM | CC BY 3.0 |

- Instruments are switched only by clicking the instrument list. They have no keyboard shortcuts.
- Samples load on demand when an instrument is first selected. While they load, a loading state is shown and the previous instrument stays playable. Playing switches to the new instrument once it is ready.
- Version 1 loads samples from smplr's default hosts, so it needs a network connection. The sample base URL must be configurable so it can move to self-hosted files later.
- A credits panel lists every sample source and its license. CC BY requires attribution.

### Controls
- **Volume**: master gain slider.
- **Velocity**: a fixed velocity is used for both keyboard and mouse, because neither can sense how hard a key is pressed. A slider sets it, with a default around 100/127.
- **Reverb**: a fixed, light reverb with an on/off switch.

## 5. Interface

### Layout
- The controls sit at the top of the page, and the panel can collapse:
  - instrument list
  - volume
  - velocity
  - reverb
  - key bindings
  - language
  - credits
- The keyboard fills the rest of the page.

### Look
- The keyboard should have depth and a 3D feel, as if you were playing a real electronic keyboard through a limited field of view.
- Version 1 uses CSS 3D perspective, shading and key thickness.
- Detailed visual polish comes later.

### Keys
- Show C1–E6.
- Highlight the keys reachable at the current octave offset.
- Pressed keys get visual feedback.
- Each key shows its computer key and note name (for example `Z` and `C3`) in low contrast.

### Effects layer
- Version 1 reserves a transparent canvas above the keys.
- Version 2 draws rising light bars or bubbles there, using Canvas 2D.

### Language
- English and Chinese.
- On the first visit, the language follows the browser: Chinese if `navigator.language` starts with `zh`, otherwise English.
- After that, the choice saved in `localStorage` wins.

### Persistence
These are saved in `localStorage`:
- instrument
- volume
- velocity
- reverb on/off
- language
- key bindings

Every read and write is wrapped in try/catch, and the app falls back to defaults.

## 6. Architecture

TypeScript, React and Vite, with smplr for audio and Vitest for unit tests.

```
input/      keyboard (code → action), pointer (mouse; touch in v2)
   │           emits: noteOn(midi, velocity), noteOff(midi), octave/sustain changes
core/       pure state: key map, octave offset, active notes, sustain logic
   │
   ├─▶ audio/   AudioEngine (AudioContext unlock, master gain, reverb)
   │            Instrument interface + registry of the 17 instruments
   │
   └─▶ view/    renderer-agnostic keyboard layout (key geometry, labels)
                KeyboardView (CSS 3D, v1) │ EffectsLayer (Canvas 2D, v2)
ui/         React control panel, settings, i18n
```

Design rules:
- **One event stream.** Keyboard, mouse and later touch or MIDI all produce the same note events. Audio and visuals subscribe to these events and never read input devices directly.
- **Pure core.** Key mapping, octave math and sustain logic have no DOM or audio dependencies, so they can be unit-tested.
- **Swappable instrument back end.** The `Instrument` interface is `load`, `start(midi, velocity)`, `stop(midi)` and `stopAll`. Sustain is handled in core, not inside smplr, so it works the same for every back end, including Tone.js later.
- **Swappable renderer, so Three.js stays possible.** Key geometry is computed in a renderer-independent module. Views only read state and note events. A Three.js view can then replace the CSS view without touching input, core or audio.
- **Audio unlock.** Browsers start audio only after a user gesture, so the first click or key press resumes the `AudioContext`.

## 7. Repository

- Repository name: `keytone`. Git is initialized in the local folder `music-instrument`.
- License: MIT for code. Sample licenses are listed in the credits.
- READMEs: `README.md` in English and `README.zh-CN.md` in Chinese.
- Code comments and docs are English-first.

## 8. Milestones

1. **M1 – Playable core**
   - Scaffold
   - Audio engine with the grand piano
   - Key mapping, octave keys and sustain
   - On-screen keys with mouse playing
   - Volume and velocity
2. **M2 – Version 1 complete**
   - All 17 instruments with loading state
   - Reverb toggle
   - Credits
   - Persistence
   - Key-binding settings
   - i18n
   - Collapsible panel
   - 3D styling
   - READMEs and LICENSE
3. **V2**
   - Rising light-bar effect
   - Touch input
   - Mobile layout
