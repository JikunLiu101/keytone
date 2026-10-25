import { useSyncExternalStore } from "react";
import { engine, hub, keyboard, settings } from "../app/services";
import { findInstrument } from "../audio/instruments";
import { dynamicMark } from "../core/dynamics";
import { PALETTE_IDS } from "../view/palettes";
import { BEATS_PER_LINE, SCORE_VIEWS } from "../app/settings";
import { listScores, userScores } from "../score/library";
import { codeLabel } from "../core/keymap";
import { useSettings, useT } from "../i18n/useT";
import { MESSAGES } from "../i18n/strings";
import { Both } from "./Both";
import { ChevronDownIcon, ChevronUpIcon } from "./icons";
import { InstrumentPicker } from "./InstrumentPicker";
import { Select } from "./Select";
import { songSwitch } from "../app/commands";

interface ControlPanelProps {
  onOpenBindings: () => void;
  onOpenCredits: () => void;
  onOpenEditor: () => void;
}

export function ControlPanel({ onOpenBindings, onOpenCredits, onOpenEditor }: ControlPanelProps) {
  const t = useT();
  const s = useSettings();
  // Re-render when the user's scores change, so the menu stays current.
  useSyncExternalStore(userScores.subscribe, userScores.get);
  const glide = useSyncExternalStore(songSwitch.subscribe, songSwitch.get);
  const status = useSyncExternalStore(engine.subscribe, engine.getStatus);
  const shift = useSyncExternalStore(keyboard.subscribe, keyboard.getOctaveShift);
  const sustain = useSyncExternalStore(hub.subscribe, hub.getSustain);

  const current = findInstrument(status.currentId ?? s.instrumentId);
  const indicators = (
    <div className="indicators" aria-live="polite">
      <span className={`indicator ${shift !== 0 ? "indicator--on" : ""}`}>
        <Both
          en={`${MESSAGES.en["panel.octave"]} ${shift > 0 ? `+${shift}` : shift}`}
          zh={`${MESSAGES.zh["panel.octave"]} ${shift > 0 ? `+${shift}` : shift}`}
        />
      </span>
      <span className={`indicator ${sustain ? "indicator--on" : ""}`}>
        <Both
          en={MESSAGES.en["panel.sustain"] + (s.bindings.sustain ? ` · ${codeLabel(s.bindings.sustain)}` : "")}
          zh={MESSAGES.zh["panel.sustain"] + (s.bindings.sustain ? ` · ${codeLabel(s.bindings.sustain)}` : "")}
        />
      </span>
    </div>
  );

  const languageToggle = (
    <button
      className="button button--ghost lang-toggle"
      onClick={() => settings.set({ language: s.language === "en" ? "zh" : "en" })}
      aria-label="Language / 语言"
    >
      <Both en="中文" zh="EN" textLang={{ en: "zh", zh: "en" }} />
    </button>
  );

  if (s.panelCollapsed) {
    return (
      <header className="panel panel--collapsed">
        <span className="brand">Keytone</span>
        <span className="current-instrument">
          {current ? t(current.nameKey) : ""}
          {status.loadingId && <span className="status status--loading">{t("status.loading")}</span>}
        </span>
        {indicators}
        <button className="button button--ghost" onClick={() => settings.set({ panelCollapsed: false })}>
          <Both k="panel.expand" />
          <ChevronDownIcon />
        </button>
      </header>
    );
  }

  return (
    <header className="panel">
      <div className="panel-row">
        <div className="brand-block">
          <span className="brand">Keytone</span>
          <span className="tagline">
            <Both k="app.tagline" />
          </span>
        </div>
        {indicators}
        <div className="panel-actions">
          <button className="button button--ghost" onClick={onOpenBindings} title={`${t("panel.keys")} (F1)`}>
            <Both k="panel.keys" />
          </button>
          <button className="button button--ghost" onClick={onOpenCredits}>
            <Both k="panel.credits" />
          </button>
          {languageToggle}
          <button className="button button--ghost" onClick={() => settings.set({ panelCollapsed: true })}>
            <Both k="panel.collapse" />
            <ChevronUpIcon />
          </button>
        </div>
      </div>

      {status.errorId && (
        <div className="panel-error" role="alert">
          <span>{t("status.error").replace("{name}", t(findInstrument(status.errorId)?.nameKey ?? "inst.grandPiano"))}</span>
          <button className="button" onClick={() => status.errorId && void engine.setInstrument(status.errorId)}>
            {t("status.retry")}
          </button>
        </div>
      )}

      <div className="panel-row panel-row--controls">
        <InstrumentPicker />
        <label className="fader" title={`${t("panel.volume")} (- / =)`}>
          <span className="control-label">
            <Both k="panel.volume" />
          </span>
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={s.volume}
            onChange={(e) => settings.set({ volume: Number(e.target.value) })}
          />
          <span className="control-value">{Math.round(s.volume * 100)}%</span>
        </label>
        <label className="fader" title={t("velocity.help")}>
          <span className="control-label">
            <Both k="panel.velocity" />
          </span>
          <input
            type="range"
            min={1}
            max={127}
            step={1}
            value={s.velocity}
            aria-valuetext={`${dynamicMark(s.velocity)} ${s.velocity}`}
            aria-description={t("velocity.help")}
            onChange={(e) => settings.set({ velocity: Number(e.target.value) })}
          />
          <span className="control-value">
            <em className="dynamic">{dynamicMark(s.velocity)}</em> {s.velocity}
          </span>
        </label>
        <div className="latches">
          <button
            className={`latch ${s.reverb ? "latch--on" : ""}`}
            role="switch"
            aria-checked={s.reverb}
            onClick={() => settings.set({ reverb: !s.reverb })}
          >
            <span className="led" aria-hidden="true" />
            <Both k="panel.reverb" />
          </button>
          <button
            className={`latch ${s.effects ? "latch--on" : ""}`}
            role="switch"
            aria-checked={s.effects}
            onClick={() => settings.set({ effects: !s.effects })}
          >
            <span className="led" aria-hidden="true" />
            <Both k="panel.effects" />
          </button>
          <div className="segmented" role="radiogroup" aria-label={t("panel.palette")}>
            {PALETTE_IDS.map((id) => (
              <button
                key={id}
                role="radio"
                aria-checked={s.lightPalette === id}
                className={`segment segment--${id} ${s.lightPalette === id ? "segment--on" : ""}`}
                onClick={() => settings.set({ lightPalette: id })}
              >
                <span className="swatch" aria-hidden="true" />
                <Both k={`palette.${id}`} />
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="panel-row panel-row--score">
        <span className="control-label">
          <Both k="panel.score" />
        </span>
        <div className="segmented segmented--plain" role="radiogroup" aria-label={t("panel.score")}>
          {SCORE_VIEWS.map((view) => (
            <button
              key={view}
              role="radio"
              aria-checked={s.scoreView === view}
              className={`segment ${s.scoreView === view ? "segment--on" : ""}`}
              title={`${t(`score.view.${view}`)} (\`)`}
              onClick={() => settings.set({ scoreView: view })}
            >
              <Both k={`score.view.${view}`} />
            </button>
          ))}
        </div>
        <Select
          className="score-select"
          label={t("score.choose")}
          hint="Tab / Shift+Tab"
          glide={glide.target ? { value: glide.target, token: glide.token } : undefined}
          value={s.scoreId}
          disabled={s.scoreView === "off"}
          onChange={(id) => settings.set({ scoreId: id })}
          options={listScores(s.language).map((e) => ({
              value: e.id,
              label: e.title,
              group: t(e.builtin ? "editor.builtins" : "editor.mine"),
            }))}
        />
        <Select
          className="beats-select"
          label={t("score.beatsPerLine")}
          value={s.beatsPerLine}
          disabled={s.scoreView !== "jianpu"}
          onChange={(beatsPerLine: number) => settings.set({ beatsPerLine })}
          options={BEATS_PER_LINE.map((n) => ({ value: n, label: t("score.beatsN").replace("{n}", String(n)) }))}
          sizeTo={BEATS_PER_LINE.flatMap((n) => [MESSAGES.en["score.beatsN"], MESSAGES.zh["score.beatsN"]].map((x) => x.replace("{n}", String(n))))}
        />
        <button
          className={`latch latch--key-hints ${s.scoreKeyHints ? "latch--on" : ""}`}
          role="switch"
          aria-checked={s.scoreKeyHints}
          disabled={s.scoreView !== "jianpu"}
          onClick={() => settings.set({ scoreKeyHints: !s.scoreKeyHints })}
        >
          <span className="led" aria-hidden="true" />
          <Both k="score.keyHints" />
        </button>
        <button
          className={`latch ${s.scoreLyrics ? "latch--on" : ""}`}
          role="switch"
          aria-checked={s.scoreLyrics}
          disabled={s.scoreView !== "jianpu"}
          onClick={() => settings.set({ scoreLyrics: !s.scoreLyrics })}
        >
          <span className="led" aria-hidden="true" />
          <Both k="score.lyrics" />
        </button>
        <button
          className={`latch ${s.practice ? "latch--on" : ""}`}
          role="switch"
          aria-checked={s.practice}
          disabled={s.scoreView === "off"}
          title={`${t("score.practiceHelp")} (P)`}
          onClick={() => settings.set({ practice: !s.practice })}
        >
          <span className="led" aria-hidden="true" />
          <Both k="score.practice" />
        </button>
        <button className="button button--ghost score-edit-btn" onClick={onOpenEditor} title={`${t("score.edit")} (E)`}>
          <Both k="score.edit" />
        </button>
      </div>
    </header>
  );
}
