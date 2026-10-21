import { useSyncExternalStore } from "react";
import { engine, hub, keyboard, settings } from "../app/services";
import { FAMILIES, INSTRUMENTS, findInstrument, shortKey } from "../audio/instruments";
import { dynamicMark } from "../core/dynamics";
import { codeLabel } from "../core/keymap";
import { useSettings, useT } from "../i18n/useT";
import { ChevronDownIcon, ChevronUpIcon } from "./icons";

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
    <div className="indicators" aria-live="polite">
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
          {t("panel.expand")}
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
            {t("panel.collapse")}
            <ChevronUpIcon />
          </button>
        </div>
      </div>

      <div className="families" role="radiogroup" aria-label={t("panel.instrument")}>
        {FAMILIES.map((family) => (
          <div key={family.id} className="family" role="group" aria-label={t(family.nameKey)}>
            <span className="family-name" aria-hidden="true">
              {t(family.nameKey)}
            </span>
            <div className="family-pads">
              {INSTRUMENTS.filter((inst) => inst.family === family.id).map((inst) => {
                const active = inst.id === status.currentId;
                const loading = inst.id === status.loadingId;
                const failed = inst.id === status.errorId;
                const state = loading ? "loading" : failed ? "error" : active ? "on" : "off";
                return (
                  <button
                    key={inst.id}
                    role="radio"
                    aria-checked={active}
                    aria-busy={loading || undefined}
                    aria-label={t(inst.nameKey)}
                    title={t(inst.nameKey)}
                    className={`pad pad--${state}`}
                    onClick={() => {
                      engine.unlock();
                      // Re-selecting a failed instrument retries it; otherwise switch.
                      if (failed) void engine.setInstrument(inst.id);
                      settings.set({ instrumentId: inst.id });
                    }}
                  >
                    <span className="led" aria-hidden="true" />
                    {t(shortKey(inst))}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
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
        <label className="fader">
          <span className="control-label">{t("panel.volume")}</span>
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
          <span className="control-label">{t("panel.velocity")}</span>
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
            {t("panel.reverb")}
          </button>
          <button
            className={`latch ${s.effects ? "latch--on" : ""}`}
            role="switch"
            aria-checked={s.effects}
            onClick={() => settings.set({ effects: !s.effects })}
          >
            <span className="led" aria-hidden="true" />
            {t("panel.effects")}
          </button>
        </div>
        {indicators}
      </div>
    </header>
  );
}
