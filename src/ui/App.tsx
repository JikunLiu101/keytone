import { useEffect, useState, useSyncExternalStore } from "react";
import { engine, hub, keyboard, settings } from "../app/services";
import { DEFAULT_INSTRUMENT_ID, INSTRUMENTS } from "../audio/instruments";
import { codeLabel } from "../core/keymap";
import { attachKeyboardInput } from "../input/keyboard-input";
import { KeyboardView } from "./KeyboardView";

export function App() {
  const status = useSyncExternalStore(engine.subscribe, engine.getStatus);
  const shift = useSyncExternalStore(keyboard.subscribe, keyboard.getOctaveShift);
  const sustain = useSyncExternalStore(hub.subscribe, hub.getSustain);
  const [volume, setVolume] = useState(settings.volume);
  const [velocity, setVelocity] = useState(settings.velocity);

  useEffect(() => attachKeyboardInput(keyboard, () => engine.unlock()), []);
  useEffect(() => {
    void engine.setInstrument(DEFAULT_INSTRUMENT_ID);
  }, []);

  const instrument = INSTRUMENTS.find((i) => i.id === status.instrumentId);
  const sustainKey = settings.bindings.sustain;

  return (
    <div className="app">
      <header className="panel">
        <h1 className="brand">Keytone</h1>

        <div className="panel-group">
          <span className="panel-label">Instrument</span>
          <span className="instrument-name">{instrument?.name ?? "—"}</span>
          <span className={`status status--${status.state}`}>
            {status.state === "loading" && "Loading…"}
            {status.state === "ready" && "Ready"}
            {status.state === "error" && "Failed to load"}
          </span>
        </div>

        <label className="panel-group">
          <span className="panel-label">Volume</span>
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={volume}
            onChange={(e) => {
              const v = Number(e.target.value);
              setVolume(v);
              settings.volume = v;
              engine.setVolume(v);
            }}
          />
          <span className="panel-value">{Math.round(volume * 100)}</span>
        </label>

        <label className="panel-group">
          <span className="panel-label">Velocity</span>
          <input
            type="range"
            min={1}
            max={127}
            step={1}
            value={velocity}
            onChange={(e) => {
              const v = Number(e.target.value);
              setVelocity(v);
              settings.velocity = v;
            }}
          />
          <span className="panel-value">{velocity}</span>
        </label>

        <div className="panel-group indicators">
          <span className={`indicator ${shift !== 0 ? "indicator--on" : ""}`}>
            Octave {shift > 0 ? `+${shift}` : shift}
          </span>
          <span className={`indicator ${sustain ? "indicator--on" : ""}`}>
            Sustain{sustainKey ? ` (${codeLabel(sustainKey)})` : ""}
          </span>
        </div>
      </header>

      <main className="main">
        <KeyboardView />
        <p className="hint">
          Play with <kbd>Z</kbd>–<kbd>/</kbd> and <kbd>S</kbd> <kbd>D</kbd> <kbd>G</kbd> <kbd>H</kbd>{" "}
          <kbd>J</kbd> <kbd>L</kbd> <kbd>;</kbd> · hold <kbd>L Shift</kbd> / <kbd>R Shift</kbd> for
          −1 / +1 octave · hold <kbd>Space</kbd> to sustain · or click and drag on the keys
        </p>
      </main>
    </div>
  );
}
