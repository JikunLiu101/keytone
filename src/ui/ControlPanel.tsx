import { useSyncExternalStore } from "react";
import { engine, hub, keyboard, settings } from "../app/services";
import { INSTRUMENTS, findInstrument } from "../audio/instruments";
import { codeLabel } from "../core/keymap";
import { useSettings, useT } from "../i18n/useT";

interface ControlPanelProps {
  onOpenBindings: () => void;
  onOpenCredits: () => void;
}

export function ControlPanel({ onOpenBindings, onOpenCredits }: ControlPanelProps) {
  const t = useT();
  const s = useSettings();
  const status = useSyncExternalStore(engine.subscribe, engine.getStatus);
  const shift = useSyncExternalStore(keyboard.subscribe, keyboard.getOctaveShift);
  const sustain = useSyncExternalStore(hub.subscribe, hub.getSustain);

  const current = findInstrument(status.currentId ?? s.instrumentId);
  const indicators = (
    <div className="indicators">
      <span className={`indicator ${shift !== 0 ? "indicator--on" : ""}`}>
        {t("panel.octave")} {shift > 0 ? `+${shift}` : shift}
      </span>
      <span className={`indicator ${sustain ? "indicator--on" : ""}`}>
        {t("panel.sustain")}
        {s.bindings.sustain ? ` · ${codeLabel(s.bindings.sustain)}` : ""}
      </span>
    </div>
  );

  const languageToggle = (
    <button
      className="button button--ghost lang-toggle"
      onClick={() => settings.set({ language: s.language === "en" ? "zh" : "en" })}
      aria-label="Language / 语言"
    >
      {s.language === "en" ? "中文" : "EN"}
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
          {t("panel.expand")} ▾
        </button>
      </header>
    );
  }

  return (
    <header className="panel">
      <div className="panel-row">
        <div className="brand-block">
          <span className="brand">Keytone</span>
          <span className="tagline">{t("app.tagline")}</span>
        </div>
        <div className="panel-actions">
          <button className="button button--ghost" onClick={onOpenBindings}>
            {t("panel.keys")}
          </button>
          <button className="button button--ghost" onClick={onOpenCredits}>
            {t("panel.credits")}
          </button>
          {languageToggle}
          <button className="button button--ghost" onClick={() => settings.set({ panelCollapsed: true })}>
            {t("panel.collapse")} ▴
          </button>
        </div>
      </div>

      <div className="instrument-grid" role="radiogroup" aria-label={t("panel.instrument")}>
        {INSTRUMENTS.map((inst) => {
          const active = inst.id === status.currentId;
          const loading = inst.id === status.loadingId;
          const failed = inst.id === status.errorId;
          return (
            <button
              key={inst.id}
              role="radio"
              aria-checked={active}
              className={[
                "instrument",
                active ? "instrument--active" : "",
                loading ? "instrument--loading" : "",
                failed ? "instrument--error" : "",
              ].join(" ")}
              onClick={() => {
                engine.unlock();
                if (inst.id === s.instrumentId && failed) void engine.setInstrument(inst.id);
                else settings.set({ instrumentId: inst.id });
              }}
            >
              {t(inst.nameKey)}
              {loading && <span className="spinner" aria-label={t("status.loading")} />}
            </button>
          );
        })}
      </div>
      {status.errorId && <p className="panel-error">{t("status.error")}</p>}

      <div className="panel-row panel-row--controls">
        <label className="control">
          <span className="control-label">{t("panel.volume")}</span>
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={s.volume}
            onChange={(e) => settings.set({ volume: Number(e.target.value) })}
          />
          <span className="control-value">{Math.round(s.volume * 100)}</span>
        </label>
        <label className="control">
          <span className="control-label">{t("panel.velocity")}</span>
          <input
            type="range"
            min={1}
            max={127}
            step={1}
            value={s.velocity}
            onChange={(e) => settings.set({ velocity: Number(e.target.value) })}
          />
          <span className="control-value">{s.velocity}</span>
        </label>
        <button
          className={`toggle ${s.reverb ? "toggle--on" : ""}`}
          role="switch"
          aria-checked={s.reverb}
          onClick={() => settings.set({ reverb: !s.reverb })}
        >
          <span className="toggle-track">
            <span className="toggle-thumb" />
          </span>
          {t("panel.reverb")}
        </button>
        <button
          className={`toggle ${s.effects ? "toggle--on" : ""}`}
          role="switch"
          aria-checked={s.effects}
          onClick={() => settings.set({ effects: !s.effects })}
        >
          <span className="toggle-track">
            <span className="toggle-thumb" />
          </span>
          {t("panel.effects")}
        </button>
        {indicators}
      </div>
    </header>
  );
}
