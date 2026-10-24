# Keytone — Product Spec

> Status: versions 1, 2 and 3 (scores, §10) implemented and deployed (2026-10-24). Version 4 (score layout, lyrics and editor, §11) is agreed and being built. Chinese version: [spec.zh-CN.md](spec.zh-CN.md).

Keytone is a browser-only app that turns your computer keyboard into an electronic keyboard instrument with a small set of curated sounds.

## 1. Goals

- Personal use first. Published as an open-source repo so others can run or self-host it.
- Pure front end. Runs locally, and is deployed to GitHub Pages.
- Desktop browsers first; phones and tablets are supported in landscape.

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
- Light bars rising from pressed keys, like the "dreamy piano" visual
- Touch input
- Mobile layout
- GitHub Pages deploy

### Version 3
- Scores on the glass: jianpu and falling notes
- Practice mode
- Score editor and local library

### Version 4
- Equal-beat score layout
- Lyrics
- Two-column score editor with selection, copy and paste, and undo
- Toasts at the top of the screen

### Later
- Self-hosted samples
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
  | −2 octaves | `A` |
  | +2 octaves | `'` |

  `A` and `'` sit above the outer ends of the two Shifts, so the ±2 keys mirror the ±1 keys.

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

- Instruments are switched by clicking the instrument list, or with `[` / `]` for the previous / next one.
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
- CSS 3D perspective, shading and key thickness.
- Type is Barlow, self-hosted (OFL).

### Keys
- Show C1–E6.
- Highlight the keys reachable at the current octave offset.
- Pressed keys get visual feedback.
- Each key shows its computer key and note name (for example `Z` and `C3`) in low contrast.

### Effects layer
- Version 1 reserves a transparent canvas above the keys.
- Version 2 draws rising light bars on an upright glass panel, using Canvas 2D (see §9.1).

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

- Repository name: `keytone`.
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
3. **V2** (done)
   - Rising light-bar effect
   - GitHub Pages deploy
   - Touch input
   - Mobile layout
   - Phone audio, light-bar redesign, performance pass

## 9. Version 2 Spec

Agreed 2026-10-21.

### 9.1 Light-bar effect
- **Glass panel**
  - A highly transparent, frosted glass panel stands on the felt line between the keys and the control strip.
  - It looks truly upright in the picture: it is turned to face the viewer, parallel to the screen.
  - The LCD and speaker strip stay behind the glass and look soft and blurred through it.
- **Bars**
  - Bars live inside the glass panel.
  - While a key is held, a glowing bar grows upward from the bottom of the glass, above that key. The longer the key is held, the longer the bar.
  - On release, the bar detaches, keeps rising at a steady speed, and fades out near the glass's top edge. Bars never leave the glass.
- **Glow**: each bar is a soft beam with a bright core, a wide bloom and a fading top tail; a detached bar also softens at its lower end.
- **Atmosphere**
  - A held bar pools light where it meets the bottom of the glass.
  - Small motes burst on the press and keep drifting up while the key is held, swaying and fading.
  - A faint haze rises from the bottom of the glass with how many keys are held.
- **Colour**
  - Comes from one palette family, not a rainbow. Low notes are deep, high notes are bright, with a small per-pitch-class offset so neighbouring notes differ.
  - Two palettes: **Aurora** (cool: violet → blue → ice) and **Amber** (warm: orange → gold → cream).
  - Chosen in the control panel next to the effects switch. Default Aurora; saved with the settings.
- **Sustain** does not lengthen a bar. Bars follow how long the finger holds the key, not how long the sound lasts.
- **Speed** is fixed for now. A slider may come later.
- **Effects switch** in the control panel:
  - On by default.
  - Off by default when the system has "reduce motion" (`prefers-reduced-motion`) turned on.
  - Saved with the other settings.
- **Rendering**
  - Canvas 2D placed in the glass panel's own 3D plane, so the bars get perspective for free.
  - Key x positions come straight from the renderer-independent layout.
  - A released bar takes the same time to cross the glass on any screen size.
  - Drawing is driven by NoteHub key events and never adds audio latency.
  - The animation loop runs only while something is on screen.
- **Performance**
  - No `shadowBlur` and no per-frame gradients (except the one haze wash). All soft light comes from small glow textures, rendered once per palette and note, and stretched with `drawImage`.
  - The canvas resolution is capped at 1.5× device pixels.
  - Motes are capped at 48.
  - Key presses animate `transform` only; the glass uses no blend mode.
  - Each on-screen key is memoised, so a note re-renders one key, not all of them.

### 9.2 Touch input
- Multi-touch: several fingers can play a chord at once.
- Sliding a finger across keys plays them in turn, the same as dragging the mouse.
- Velocity uses the fixed velocity setting.

### 9.3 Mobile layout
- **When**: the compact layout turns on for a coarse (touch) pointer when fitting all 38 white keys would make each narrower than 32px. `?layout=compact` or `?layout=full` forces either layout.
- **Portrait**: a "please rotate your phone" prompt.
- **Landscape**
  - Shows a window of about 13 white keys (roughly 2 octaves). Key width is about (screen width − 72px) / 13; height is set separately, so keys are not squashed.
  - A thumbnail strip of all 38 keys above the keys; drag it to choose the visible range.
  - The control panel floats over the stage, so opening it does not resize the keys.
- **On phones**
  - The control panel starts collapsed.
  - Computer-key letters and the keyboard hint are hidden.

### 9.4 Deployment
- GitHub Pages at `jikunliu101.github.io/keytone`.
- Published automatically by GitHub Actions on every push to `main`: install, test, build, deploy.
- Vite builds with a relative base (`./`), so the same build works at any path.

### 9.4a Phone audio
- On iOS, Web Audio is muted by the silent switch by default. To play anyway:
  - set `navigator.audioSession.type = "playback"` where supported;
  - play a short silent `<audio>` once on the first gesture;
  - retry `AudioContext.resume()` on pointer, touch, click and key gestures until it runs.
- Until audio is running, the LCD shows a "tap to start" hint.

### 9.5 Order
Each step gets its own commit. All done.
1. Light-bar effect
2. GitHub Pages deploy
3. Touch input
4. Mobile layout

## 10. Version 3 Spec: Scores

Agreed 2026-10-23.

### 10.1 Two score views
Chosen in the control panel: **Jianpu / Falling / Off**. Default Off.
- **Jianpu** (numbered notation). The glass panel becomes a music stand holding a frosted, translucent sheet.
  - Each note takes about one white key's width, with digits sized to match. Bars per line and lines per page follow the glass size (about 5–8 bars and 4 lines on a laptop screen); lines are balanced so the last one is not left with a lone bar. The header shows title, key, time signature and tempo. (Version 4 replaces this layout: §11.2.)
  - A switch shows the computer key under each note.
  - Light bars still rise, dimmer, glowing through the sheet from behind.
  - Pages turn with ◀ ▶ buttons or PageUp / PageDown (automatic in practice mode).
- **Falling notes**. Inverted light bars fall from the top of the glass towards their keys, replacing the rising bars.
  - A bar's length follows the note's duration; colour follows the light palette. No key labels.
  - Every bar keeps falling and sinks into the bottom edge. Hit: light and motes burst up from the key as it does. Missed: it dims as it sinks. Wrong key: a faint flash at that key.
  - Only hit / wrong / missed are judged, never how long a key is held. A press within about ±0.25 s of the bar reaching the bottom edge counts as a hit.
  - Transport: start/pause, restart, speed 50–150 %, loop switch, one-bar count-in. The app never plays the notes itself.
  - At the end: "Complete" with `perfect: 42, missing: 3` (Chinese: 完美 / 失误). No grades.

### 10.2 Practice mode
Works with both views. Named "Practice" / 练习模式.
- The note to play is highlighted; played notes dim.
- Only a correct note advances; a wrong one does nothing.
- Rests and extensions are skipped (no timing). A chord needs all its notes. Repeated notes each need their own press.
- Jianpu turns the page as soon as the next note is on the next page. Falling bars stop at the bottom edge and wait.
- At the end it shows only "Complete" / 完成.

### 10.3 Editor
A large panel over the glass and control panel; the keys stay visible below. (Version 4 replaces the editor's layout and text view: §11.4.)
- Input works like playing: digits 1–7 enter notes, `0` a rest, `-` extends the previous note by one beat.
- Hold the octave keys (the user's bindings) for low / high octave dots.
- `/` halves the note (press twice for a quarter beat); `.` adds a dot.
- Arrow keys move the cursor; Backspace deletes. Every entered note is auditioned.
- Bar lines are drawn automatically from the time signature.
- Each score has a key (1=C … 1=B), time signature (2/4, 3/4, 4/4, 6/8) and tempo.
- Notes outside C1–E6 are refused.
- A text view, kept in sync, allows copy and paste. No triplets or ties.

### 10.4 Pitch and key hints
- Unshifted 1–7 in 1=C map to the Z–M row (C3–B3).
- Other keys transpose. Key hints follow, using black keys and Shift marks where needed.

### 10.5 Text format
```
title: Happy Birthday
key: C
time: 3/4
tempo: 100
pickup: 1
---
5./ 5// | 6 5 1' | 7 - - | 5./ 5// | 6 5 2' | 1' - - |
```
- `pickup:` (optional) beats before the first full bar, for songs that start on an upbeat.
- `1`–`7` notes, `0` rest, `-` extends the previous note by one beat.
- `/` halves, `//` quarters; `.` dots.
- `'` raises an octave, `,` lowers one; they stack (`1''`).
- `#` / `b` sharp / flat (`#4`).
- `[1 3 5]` chord (reserved; displayed only).
- `|` bar lines are optional; layout re-bars by the time signature.

### 10.6 Library
- Scores are stored in the browser: new, rename, duplicate, delete; import / export as `.txt`.
- Built-in, read-only: Twinkle Twinkle Little Star and Happy Birthday. Duplicate to edit. More songs come from the user later.
- The chosen score and score settings persist.

### 10.7 Mobile
- View only, no editing: the editor button and key hints are hidden.
- The keyboard (and its glass) slides sideways on phones, so the sheet and play controls sit on a screen-fixed layer placed over the lit part of the glass.
- The jianpu shows one row (narrower note slots than on desktop), with restart, page and hide buttons at the right; hidden, it leaves a small "Show score" pill.
- Falling mode makes the keys a little shorter so the glass has room, and shrinks the play controls to a pill in the top-right corner.
- In falling mode the keyboard window slides to the notes due in the next ~1.2 s. Dragging the thumbnail strip pauses this until the song is started again.

### 10.8 Not in this version
Staff notation, MIDI / MusicXML import, auto-play demo, grades, lyrics (added in version 4, §11.3), link sharing, editing on phones.

### 10.9 Order
Each step is shown, then committed after approval. All done.
1. Score format and jianpu display (glass music stand, pages, two built-in songs)
2. Editor (digit input, audition, text view, library, import / export)
3. Practice mode on jianpu
4. Falling notes (bars, judging, transport, count-in, loop, practice mode)
5. Mobile
6. Docs and deploy

## 11. Version 4 Spec: Score layout, lyrics and editor

Agreed 2026-10-24.

### 11.1 Why
- On the sheet, each bar is stretched to fill its line. The space between notes changes from line to line and inside a line: in Happy Birthday it goes from about 24 px to 85 px on a laptop screen. Some lines look small and crowded, others big and sparse.
- In the editor, lines re-wrap while you type, so you lose track of where you are typing.
- Lyrics are wanted for singing while playing, and for finding your place in a song by its words.
- The editor needs a way to enter both melody and lyrics without losing track of either.

Must not happen:
- A bar changes width, or a line wraps differently, because of what is in it.
- Editing the melody changes the lyrics, or editing the lyrics changes the melody.
- A word sung over several notes stops reading as one word.

### 11.2 Equal-beat layout
Replaces the note-width layout of §10.1, on the sheet and in the editor.
- The unit is the beat. As everywhere in this app, a beat is a quarter note, so a 6/8 bar has 3 beats. Every beat has the same width.
- A line holds N beats. N is a setting in the control panel's score row, default 16, saved with the other settings. The builder picks the control and its range.
- Beat width is the line width divided by N, leaving room for the bar-line gaps. Bar lines take a narrow fixed gap, not a beat. Every line of a score uses the same beat width.
- A line holds whole bars only, as many as fit in N beats: 4 bars of 4/4, 5 bars of 3/4, 8 bars of 2/4. Beats left over stay blank at the right end. Lines are never stretched, and a bar is never split across lines. A line always holds at least one bar.
- A pickup bar is drawn at its real length (for example 1 beat wide) and counts its real beats on the first line.
- Each note sits centred in its own time span, capped at one beat: a quarter note in the middle of its beat, two eighths in the two halves, four sixteenths in the four quarters. A note longer than a beat (for example a dotted quarter) sits in its first beat, followed by its dot. Each `-` fills one beat. A rest sits like a note of the same length.
- One digit size for the whole sheet, small enough that four sixteenth notes fit in one beat. All digits of a score look the same; a beat with a single note looks roomy.
- Underlines, octave dots, accidentals and augmentation dots are drawn as now. Underlines still join within a beat.
- Key hints stay under their notes. Where fast notes leave no room for them, the builder decides how to keep them readable.
- On phones (one row, §10.7) the builder picks an N that keeps digits readable.
- Pages, page turning and practice mode work as before.

### 11.3 Lyrics
One line of lyrics per score. When the same melody is sung twice with different words, the melody is written twice.

**Slots**
- Each melody note or chord is one lyric slot, and so is each `-` that holds a note or chord. Rests (`0`) are not slots, and neither is a `-` that holds a rest.
- Lyrics fill the slots in order, one item per slot.

**Writing lyrics**

| Written | Means | Slots |
|---|---|---|
| A Chinese character | One sung syllable | 1 |
| An English word | One sung word | 1 |
| `-` between two letters, as in `si-lence` | The word is split across notes | 1 per part |
| `-` on its own, or next to a Chinese character | Keep singing the previous word | 1 |
| `0` | This note is not sung | 1 |
| Punctuation | Stays with the previous word | 0 |

- Spaces separate English words. Between Chinese characters, spaces are ignored.
- Full-width `－` and `０`, as typed with a Chinese input method, count as `-` and `0`.
- How other scripts (Japanese kana, Korean) and characters such as apostrophes are split is left to the builder.

Example: Happy Birthday with an extra note in each half.
```
melody: 5./ 5// | 6 5 1' | 7 7 - 5./ 5// | 6 5 2' | 1' 1' -
lyrics: 祝你生日快乐--祝你生日快乐--
lyrics: hap-py birth-day to you -- hap-py birth-day to you --
```

**When they don't line up**
- More lyrics than slots: the extra lyrics wait after the last note, dimmed. This lets you write the lyrics first and add notes later.
- More slots than lyrics: the extra notes show no lyrics.
- Editing the melody never changes the lyrics, and editing the lyrics never changes the melody, even when a change throws them out of line. The player fixes the alignment by hand.

**Display**
- Lyrics sit in a row under the notes, below the key hints when those are on.
- A "Lyrics" switch next to "Key hints" hides them. It is on by default and saved with the settings.
- Each item is centred under its note. If it is too wide, it spreads into empty space next to it; if it is still too wide, that item is drawn smaller.
- A word split across notes: no hyphen is drawn; a thin bracket line under its parts ties them into one word. (Chosen from mockups.)
- Keep singing (`-`): a thin line runs from the end of the word to the end of the last held slot.
- Not sung (`0`): nothing is drawn.
- Practice mode: the lyric of the note to play lights up with it.
- Falling notes: no lyrics in this version.
- Phones: lyrics show in the one-row sheet.

**Text format** (extends §10.5). Lyrics follow a second `---` line:
```
title: Happy Birthday to You
key: C
time: 3/4
tempo: 100
pickup: 1
---
5./ 5// | 6 5 1' | 7 - 5./ 5// | 6 5 2' | 1' - - |
---
祝你生日快乐-祝你生日快乐--
```
- Line breaks in the lyrics part count as spaces.
- A score without a second `---` has no lyrics, so older files still load.

**Built-in songs** get lyrics in the UI language, like their titles.

### 11.4 Editor
Replaces the editor layout and text view of §10.3. The note-entry keys of §10.3 stay.

**Layout**
- The header (score menu and buttons) and the fields (title, key, time, tempo, pickup) stay at the top.
- Below them, two columns:
  - Left: the rendered sheet, melody and lyrics, laid out as in §11.2. All lines, scrolling.
  - Right, top: the melody as text. Right, bottom: the lyrics as text. The lyrics box can be collapsed.
- All of them update together as you type.
- The old text view goes away. Import and export of `.txt` files stay, and include lyrics.

**One cursor**
- A note and its `-`s are one unit, as in the score itself. The melody cursor stops only between notes, as in §10.3: clicking a `-` puts the cursor after its note, and Backspace after a held note removes one `-` first.
- Clicking a note on the left, or a place in the melody text, puts the cursor on that note in both.
- Clicking a lyric on the left puts the cursor on that item in the lyrics text.
- While the cursor is in the lyrics text, the note its item falls on is highlighted on the left and in the melody text.

**Melody text.** It looks like a text box, but it edits the score.
- It shows the melody in the text format, with bar lines and line breaks generated to match the lines on the left. A typed `|` is ignored.
- Typing works exactly as on the left (§10.3): digits, `0`, `-`, `/`, `.`, ↑ / ↓ for sharp / flat, held octave keys, ← / →, Backspace and Delete.
- `Ctrl/⌘+V` reads melody text in the text format and inserts it at the cursor. If the pasted text is a whole score, only its notes are used.
- Chords (`[1 3 5]`) and notes that need a third octave mark (D6 and E6 in 1=C) can't be typed; they come in only by pasting or importing.

**Selecting notes**
- Drag on the left or in the melody text, or hold `Shift` with ← / → or a click. The selection shows on both sides. It always covers whole notes, each with its `-`s.
- `Ctrl/⌘+C` copies the selected notes as melody text, `Ctrl/⌘+X` cuts them, and Backspace or Delete removes them.
- Typing a note or pasting replaces the selection.

**Lyrics text.** A plain text box: any language, any input method, normal selection, copy and paste. The rules are those of §11.3.

**Undo.** `Ctrl/⌘+Z` undoes and `Ctrl/⌘+Shift+Z` redoes. Melody, lyrics and the fields share one history.

**Warnings.** A word that falls under a melody `-`, and lyrics left over after the last slot, are marked on the left. The lyrics box says how many items are left over. The builder decides the exact look.

Auto-save, auditioning entered notes, and refusing notes outside the keyboard's range work as before. Phones still have no editing.

### 11.5 Toasts
All short messages (toasts) move from the bottom of the screen to its upper part, where the player is looking: below the control panel, over the top of the glass. The builder picks the exact spot and shows it before it is committed.

### 11.6 Not in this version
More than one line of lyrics (verses), repeat signs, lyrics in the falling-notes view, automatic splitting of English words.

### 11.7 Order
Each step is shown, then committed after approval.
1. Toasts at the top
2. Equal-beat layout on the sheet and in the editor, with the N setting
3. Lyrics: text format, slots, display on the sheet, practice highlight, built-in lyrics
4. Editor: two columns, melody text with one shared cursor, selection, copy and paste, undo
5. Editor: lyrics text, cursor link, warnings
6. Docs (READMEs) and deploy
