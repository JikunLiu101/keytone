/**
 * Draws laid-out jianpu lines. Shared by the sheet on the glass and the
 * editor, which adds a cursor and click-to-place.
 */
import { codeLabel } from "../core/keymap";
import { keyHint, placeLine, placeLyrics, type Glyph, type Line, type PlacedLyrics, type SheetMetrics } from "../score/jianpu-layout";
import type { ScoreLyrics } from "../score/lyrics";
import type { KeyName, Pitch, Score } from "../score/score";

/** "Db" → "♭D", "F#" → "♯F": jianpu writes the accidental first (1=♭E). */
export function keyLabel(key: KeyName): string {
  if (key.length === 1) return key;
  return (key[1] === "b" ? "♭" : "♯") + key[0];
}

/** Key, time signature and tempo, as printed at the top of a score. */
export function ScoreMeta({ score }: { score: Score }) {
  const [top, bottom] = score.time.split("/");
  return (
    <span className="sheet-meta">
      <span>1={keyLabel(score.key)}</span>
      <span className="sheet-time">
        <span>{top}</span>
        <span>{bottom}</span>
      </span>
      <span>♩={score.tempo}</span>
    </span>
  );
}

/** Small arrow: hold the octave-up (or down) key. Drawn, since UI fonts lack a crisp ↑ at this size. */
function ShiftArrow({ up }: { up: boolean }) {
  return (
    <svg className="j-shift" viewBox="0 0 8 10" aria-hidden="true">
      <path d={up ? "M4 1v8M1 4l3-3 3 3" : "M4 9V1M1 6l3 3 3-3"} />
    </svg>
  );
}

function HintLabel({ midi }: { midi: number }) {
  const hint = keyHint(midi);
  if (!hint) return <span className="j-hint">–</span>;
  return (
    <span className="j-hint">
      {Array.from({ length: Math.abs(hint.shift) }, (_, i) => (
        <ShiftArrow key={i} up={hint.shift > 0} />
      ))}
      {codeLabel(hint.code)}
    </span>
  );
}

function Dots({ count }: { count: number }) {
  return <>{Array.from({ length: count }, (_, i) => <i key={i} className="j-octave-dot" />)}</>;
}

function Accidental({ value }: { value: number }) {
  if (!value) return null;
  return <span className="j-acc">{value > 0 ? "♯" : "♭"}</span>;
}

function PitchDigits({ pitches }: { pitches: Pitch[] }) {
  // A chord stacks its notes, lowest at the bottom.
  if (pitches.length > 1) {
    return (
      <span className="j-chord">
        {[...pitches].reverse().map((p, i) => (
          <span key={i} className="j-chord-note">
            <Accidental value={p.accidental} />
            {p.degree}
            {p.octave !== 0 && <sup className="j-chord-oct">{p.octave > 0 ? "'".repeat(p.octave) : ",".repeat(-p.octave)}</sup>}
          </span>
        ))}
      </span>
    );
  }
  const p = pitches[0];
  return (
    <>
      <Accidental value={p.accidental} />
      {p.degree}
    </>
  );
}

interface GlyphProps {
  glyph: Glyph;
  /** Box width in px: the glyph's share of its beat. */
  width: number;
  /** Practice: "current" is the note to play next, "played" is behind it. */
  practice?: "current" | "played" | "miss";
  /** Draw the editor cursor just before (or after) this glyph. */
  caretBefore?: boolean;
  caretAfter?: boolean;
  onPick?: (cursor: number) => void;
}

function GlyphView({ glyph, width, practice, caretBefore, caretAfter, onPick }: GlyphProps) {
  const single = glyph.type === "note" && glyph.pitches.length === 1 ? glyph.pitches[0] : null;
  const high = single && single.octave > 0 ? single.octave : 0;
  const low = single && single.octave < 0 ? -single.octave : 0;
  return (
    <span
      className={`j-glyph j-glyph--${glyph.type}${practice ? ` j-glyph--${practice}` : ""}`}
      style={{ width }}
      data-event={glyph.event}
      onPointerDown={
        onPick
          ? (e) => {
              e.preventDefault();
              // Left half of a note: cursor before it; right half: after it.
              const box = e.currentTarget.getBoundingClientRect();
              onPick(e.clientX < box.left + box.width / 2 && glyph.type !== "dash" ? glyph.event : glyph.event + 1);
            }
          : undefined
      }
    >
      {caretBefore && <i className="j-caret j-caret--before" />}
      <span className="j-high">
        <Dots count={high} />
      </span>
      <span className="j-main">
        <span className="j-digit">
          {glyph.type === "dash" ? "–" : glyph.type === "rest" ? "0" : <PitchDigits pitches={glyph.pitches} />}
          {glyph.dotted && <span className="j-aug">·</span>}
        </span>
      </span>
      <span className="j-lines">
        {Array.from({ length: glyph.underlines }, (_, i) => (
          <i key={i} className="j-underline" />
        ))}
      </span>
      <span className="j-low">
        <Dots count={low} />
      </span>
      <span className="j-key">{glyph.type === "note" && glyph.midi.map((m, i) => <HintLabel key={i} midi={m} />)}</span>
      {caretAfter && <i className="j-caret j-caret--after" />}
    </span>
  );
}

function practiceClass(g: Glyph, current: number | undefined, miss?: boolean): GlyphProps["practice"] {
  if (current === undefined) return undefined;
  // Complete (−1): everything has been played.
  if (current < 0 || g.event < current) return "played";
  if (g.event === current && g.type !== "dash") return miss ? "miss" : "current";
  return undefined;
}

interface LinesProps {
  lines: Line[];
  /** Pixel sizes of this sheet: every beat is `metrics.beat` wide (spec §11.2). */
  metrics: SheetMetrics;
  /** True when the last of `lines` ends the score (gets the closing double bar). */
  endsScore: boolean;
  /** Practice: the event to play next (−1 when complete), and whether to flash a wrong press. */
  current?: number;
  miss?: boolean;
  /** Editor cursor (insertion point between events); omit on the sheet. */
  cursor?: number;
  eventCount?: number;
  onPick?: (cursor: number) => void;
  /** Lyrics drawn under the notes (spec §11.3); omit to draw none. */
  lyrics?: ScoreLyrics | null;
}

/** Lyrics font, as a share of the digit size. */
export const LYRIC_EM = 0.75;

function lyricClass(word: PlacedLyrics["words"][number], current: number | undefined): string {
  let c = "j-lyric";
  if (word.misplaced) c += " j-lyric--misplaced";
  if (current === undefined) return c;
  if (current < 0 || word.slot.event < current) return `${c} j-lyric--played`;
  if (word.slot.event === current && word.slot.ext === 0) return `${c} j-lyric--current`;
  return c;
}

/** The lyrics row of one line, drawn over the room kept free under its notes. */
function LyricsRow({ placed, current }: { placed: PlacedLyrics; current?: number }) {
  return (
    <div className="j-lyrics" aria-hidden="true">
      {placed.brackets.map((b, i) => (
        <i key={`b${i}`} className="j-lyric-bracket" style={{ left: b.x1, width: Math.max(0, b.x2 - b.x1) }} />
      ))}
      {placed.holds.map((h, i) => (
        <i key={`h${i}`} className="j-lyric-hold" style={{ left: h.x1, width: Math.max(0, h.x2 - h.x1) }} />
      ))}
      {placed.words.map((w, i) => (
        <span key={i} className={lyricClass(w, current)} style={{ left: w.x, fontSize: w.scale === 1 ? undefined : `${w.scale}em` }}>
          {w.text}
          {w.tail && <span className="j-lyric-tail">{w.tail}</span>}
        </span>
      ))}
    </div>
  );
}

/** Below this many px a gap before a group is rounding noise, not a rest in time. */
const MIN_LEAD = 0.5;

export function JianpuLines({ lines, metrics, endsScore, current, miss, cursor, eventCount = 0, onPick, lyrics }: LinesProps) {
  const extra = endsScore && lyrics ? lyrics.extra.flatMap((item) => (item.kind === "word" ? [item.text] : [])) : [];
  return (
    <>
      {lines.map((line, li) => {
        const isLast = li === lines.length - 1;
        const lyricsRow = lyrics ? placeLyrics(placeLine(line, metrics), lyrics.itemAt, metrics.font * LYRIC_EM) : null;
        return (
          <div key={li} className={`j-line${lyrics ? " j-line--lyrics" : ""}`}>
            {line.bars.map((bar, bi) => {
              // Bars are a fixed number of beats wide, whatever is in them. The
              // bar line sits in the middle of the gap after the bar.
              let end = 0; // beats: where the previous group's boxes end
              return (
                <div
                  key={bi}
                  className={`j-bar ${endsScore && isLast && bi === line.bars.length - 1 ? "j-bar--final" : ""}`}
                  style={{ width: bar.beats * metrics.beat + metrics.gap / 2, paddingRight: metrics.gap / 2, marginRight: metrics.gap / 2 }}
                >
                  {bar.groups.map((group, gi) => {
                    // Each note sits in its own time span, so a group starts where its time starts.
                    const lead = (group[0].start - end) * metrics.beat;
                    const tail = group[group.length - 1];
                    end = tail.start + tail.span;
                    return (
                      <span key={gi} className="j-beam" style={lead > MIN_LEAD ? { marginLeft: lead } : undefined}>
                        {group.map((g, k) => {
                          // The cursor sits before its event's note or rest (dashes follow it)…
                          const caretBefore = cursor !== undefined && g.event === cursor && g.type !== "dash";
                          // …or after the very last glyph when it is at the end.
                          const caretAfter =
                            cursor !== undefined &&
                            cursor === eventCount &&
                            g.event === eventCount - 1 &&
                            isLast &&
                            bi === line.bars.length - 1 &&
                            gi === bar.groups.length - 1 &&
                            k === group.length - 1;
                          return (
                            <GlyphView
                              key={k}
                              glyph={g}
                              width={g.span * metrics.beat}
                              practice={practiceClass(g, current, miss)}
                              caretBefore={caretBefore}
                              caretAfter={caretAfter}
                              onPick={onPick}
                            />
                          );
                        })}
                      </span>
                    );
                  })}
                </div>
              );
            })}
            {lyricsRow && <LyricsRow placed={lyricsRow} current={current} />}
          </div>
        );
      })}
      {/* Lyrics with no note left to sit on wait here, dimmed. */}
      {extra.length > 0 && <p className="j-lyrics-extra">{extra.join(" ")}</p>}
    </>
  );
}
