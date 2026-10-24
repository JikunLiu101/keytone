/**
 * The melody as text, next to the sheet in the editor (spec §11.4). It looks
 * like a text box but it is the score: one text line per sheet line, a token
 * per note, rest or `-`, and `|` at each bar's end. The cursor sits between
 * notes and selected notes are highlighted. Typing, clicks and drags are
 * handled by the editor, the same way as on the sheet.
 */
import type { Line, Slot } from "../score/jianpu-layout";
import { writeEventHead, type Score } from "../score/score";

interface MelodyTextProps {
  score: Score;
  lines: Line[];
  cursor: number;
  /** Selected events [start, end), or null. */
  selection: [number, number] | null;
  /** A slot to light up: the note the lyric under the cursor falls on. */
  highlight?: Slot | null;
  label: string;
  readOnly: boolean;
}

const Caret = () => <i className="mt-caret" aria-hidden="true" />;

export function MelodyText({ score, lines, cursor, selection, highlight, label, readOnly }: MelodyTextProps) {
  const count = score.events.length;
  return (
    <div className="melody-text" role="textbox" aria-multiline="true" aria-readonly={readOnly} aria-label={label} tabIndex={0}>
      {lines.map((line, li) => (
        <div key={li} className="mt-line">
          {/* A bar never breaks; a long line wraps only between bars. Real
              spaces keep the notes apart for copying and screen readers. */}
          {line.bars.map((bar, bi) => (
            <span key={bi}>
              <span className="mt-bar">
                {bar.groups.flat().map((g, k) => {
                  const dash = g.type === "dash";
                  const selected = !!selection && g.event >= selection[0] && g.event < selection[1];
                  const linked = !!highlight && !!g.slot && g.slot.event === highlight.event && g.slot.ext === highlight.ext;
                  const cls = `mt-tok${dash ? " mt-tok--dash" : ""}${selected ? " mt-tok--selected" : ""}${linked ? " mt-tok--linked" : ""}`;
                  return (
                    <span key={k}>
                      {k > 0 && " "}
                      <span className={cls} data-event={g.event} data-dash={dash || undefined}>
                        {!readOnly && g.event === cursor && !dash && <Caret />}
                        {dash ? "-" : writeEventHead(score.events[g.event])}
                      </span>
                    </span>
                  );
                })}{" "}
                <span className="mt-barline" aria-hidden="true">
                  |
                </span>
              </span>{" "}
            </span>
          ))}
          {!readOnly && li === lines.length - 1 && cursor === count && <Caret />}
        </div>
      ))}
      {!readOnly && count === 0 && <Caret />}
    </div>
  );
}
