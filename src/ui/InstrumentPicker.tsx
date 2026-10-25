import { useEffect, useId, useLayoutEffect, useRef, useState, useSyncExternalStore, type KeyboardEvent } from "react";
import { createPortal } from "react-dom";
import { engine, keyboard, pointers, settings } from "../app/services";
import { FAMILIES, INSTRUMENTS, familyPlace, findInstrument, listMove, shownInstrumentId, stepInstrument } from "../audio/instruments";
import { useSettings, useT } from "../i18n/useT";

/** One column of the list per family, in display order. */
const COLUMNS = FAMILIES.map((family) => ({ family, items: INSTRUMENTS.filter((i) => i.family === family.id) }));
const COLUMN_SIZES = COLUMNS.map((c) => c.items.length);

const GAP = 6;
const MARGIN = 8;

interface Placement {
  left: number;
  top: number;
  maxWidth: number;
  maxHeight: number;
  above: boolean;
}

/** Where an instrument is in the list. */
function cellOf(id: string): { col: number; row: number } {
  for (let col = 0; col < COLUMNS.length; col++) {
    const row = COLUMNS[col].items.findIndex((i) => i.id === id);
    if (row >= 0) return { col, row };
  }
  return { col: 0, row: 0 };
}

/**
 * The instrument picker (spec §12.4): a small LCD like the one on the
 * keyboard, showing the family, the instrument's place in it and its name.
 * ▲ / ▼ step through every instrument; clicking the screen opens a list with
 * one column per family. While the list is open it has the focus, so the
 * computer keyboard neither plays nor triggers shortcuts.
 */
export function InstrumentPicker() {
  const t = useT();
  const id = useId();
  const { instrumentId } = useSettings();
  const status = useSyncExternalStore(engine.subscribe, engine.getStatus);
  const screenRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState({ col: 0, row: 0 });
  const [place, setPlace] = useState<Placement | null>(null);

  // The screen shows what is loading (blinking) until it is ready, then what plays.
  const shown = findInstrument(shownInstrumentId(status, instrumentId)) ?? INSTRUMENTS[0];
  const where = familyPlace(shown.id);
  const family = FAMILIES.find((f) => f.id === where.family) ?? FAMILIES[0];
  const loading = status.loadingId !== null;

  const pick = (pickId: string) => {
    engine.unlock();
    // Picking a failed instrument again retries it.
    if (pickId === status.errorId) void engine.setInstrument(pickId);
    settings.set({ instrumentId: pickId });
  };
  const close = (focusScreen = true) => {
    setOpen(false);
    setPlace(null);
    if (focusScreen) screenRef.current?.focus();
  };
  const openList = () => {
    // Like a dialog: let go of anything held before the keys go to the list.
    keyboard.reset();
    pointers.cancelAll();
    setActive(cellOf(instrumentId));
    setOpen(true);
  };

  // Place the list under the screen (above it when there's no room), inside the window.
  useLayoutEffect(() => {
    if (!open) return;
    const measure = () => {
      const box = screenRef.current?.getBoundingClientRect();
      if (!box) return;
      const below = innerHeight - box.bottom - GAP - MARGIN;
      const aboveSpace = box.top - GAP - MARGIN;
      const above = below < 220 && aboveSpace > below;
      const maxWidth = innerWidth - 2 * MARGIN;
      const width = Math.min(maxWidth, listRef.current?.offsetWidth ?? maxWidth);
      setPlace({
        left: Math.min(Math.max(MARGIN, box.left), innerWidth - width - MARGIN),
        top: above ? box.top - GAP : box.bottom + GAP,
        maxWidth,
        maxHeight: above ? aboveSpace : below,
        above,
      });
    };
    // Scrolling the list itself doesn't move the screen.
    const onScroll = (e: Event) => {
      if (!listRef.current?.contains(e.target as Node)) measure();
    };
    measure();
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", onScroll, true);
    // The panel can change under the open list (a "Couldn't load" row appears), moving the screen.
    const observer = new ResizeObserver(measure);
    const panel = screenRef.current?.closest("header");
    if (panel) observer.observe(panel);
    return () => {
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", onScroll, true);
      observer.disconnect();
    };
  }, [open]);

  // Focus the list once it is placed; close on a press anywhere else.
  const shownList = open && place !== null;
  useEffect(() => {
    if (!shownList) return;
    listRef.current?.focus();
    const onDown = (e: PointerEvent) => {
      const target = e.target as Node;
      if (!listRef.current?.contains(target) && !screenRef.current?.contains(target)) close(false);
    };
    window.addEventListener("pointerdown", onDown, true);
    return () => window.removeEventListener("pointerdown", onDown, true);
  }, [shownList]);

  const optionId = (col: number, row: number) => `${id}-${col}-${row}`;

  // Keep the highlighted option in view when the list scrolls (small windows).
  useEffect(() => {
    if (shownList) document.getElementById(optionId(active.col, active.row))?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [shownList, active]);

  const onListKey = (e: KeyboardEvent<HTMLDivElement>) => {
    switch (e.key) {
      case "ArrowUp":
      case "ArrowDown":
      case "ArrowLeft":
      case "ArrowRight":
        e.preventDefault();
        setActive(listMove(COLUMN_SIZES, active, e.key));
        return;
      case "Enter":
      case " ":
        e.preventDefault();
        pick(COLUMNS[active.col].items[active.row].id);
        return close();
      case "Escape":
        e.preventDefault();
        e.stopPropagation();
        return close();
      case "Tab":
        // Focus the screen before the browser moves on, so Tab goes on to ▲
        // (Shift+Tab back before the screen), not from the top of the page.
        return close();
    }
  };

  return (
    <div className="picker">
      <button
        ref={screenRef}
        type="button"
        className={`picker-screen ${loading ? "picker-screen--loading" : ""}`}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? `${id}-list` : undefined}
        aria-label={`${t("panel.instrument")}: ${t(shown.nameKey)}, ${t(family.nameKey)} ${where.index}/${where.count}`}
        aria-busy={loading || undefined}
        title={`${t("panel.chooseInstrument")} ([ / ])`}
        onClick={() => (open ? close() : openList())}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown" || e.key === "ArrowUp") {
            e.preventDefault();
            openList();
          }
        }}
      >
        <span className="picker-family">
          {t(family.nameKey)} · {where.index}/{where.count}
        </span>
        <span className="picker-name">{t(shown.nameKey)}</span>
      </button>
      <div className="picker-steps">
        <button type="button" className="picker-step" aria-label={t("panel.prevInstrument")} title={`${t("panel.prevInstrument")} ([)`} onClick={() => pick(stepInstrument(shown.id, -1).id)}>
          ▲
        </button>
        <button type="button" className="picker-step" aria-label={t("panel.nextInstrument")} title={`${t("panel.nextInstrument")} (])`} onClick={() => pick(stepInstrument(shown.id, 1).id)}>
          ▼
        </button>
      </div>
      {open &&
        createPortal(
          <div
            ref={listRef}
            id={`${id}-list`}
            className={`picker-list ${place?.above ? "picker-list--above" : ""}`}
            role="listbox"
            tabIndex={-1}
            aria-label={t("panel.chooseInstrument")}
            aria-activedescendant={optionId(active.col, active.row)}
            style={
              place
                ? {
                    left: place.left,
                    top: place.above ? undefined : place.top,
                    bottom: place.above ? innerHeight - place.top : undefined,
                    maxWidth: place.maxWidth,
                    maxHeight: place.maxHeight,
                  }
                : { visibility: "hidden" }
            }
            onKeyDown={onListKey}
          >
            {COLUMNS.map((column, col) => (
              <div key={column.family.id} className="picker-column" role="group" aria-label={t(column.family.nameKey)}>
                <span className="picker-column-name" aria-hidden="true">
                  {t(column.family.nameKey)}
                </span>
                {column.items.map((inst, row) => {
                  const state =
                    inst.id === status.loadingId ? "loading" : inst.id === status.errorId ? "error" : inst.id === status.currentId ? "on" : "off";
                  const isActive = active.col === col && active.row === row;
                  return (
                    <div
                      key={inst.id}
                      id={optionId(col, row)}
                      role="option"
                      aria-selected={inst.id === status.currentId}
                      aria-busy={state === "loading" || undefined}
                      className={`picker-option picker-option--${state}${isActive ? " picker-option--active" : ""}`}
                      // Only a move onto another option re-renders the list.
                      onPointerMove={() => setActive((a) => (a.col === col && a.row === row ? a : { col, row }))}
                      onClick={() => {
                        pick(inst.id);
                        // A mouse or touch pick gives the keys back to playing,
                        // not to the screen (where ↑ / ↓ / Enter would reopen the list).
                        close(false);
                      }}
                    >
                      <span className="led" aria-hidden="true" />
                      {t(inst.nameKey)}
                      {state === "loading" && <span className="visually-hidden">, {t("status.loading")}</span>}
                      {state === "error" && <span className="visually-hidden">, {t("status.failed")}</span>}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>,
          document.body,
        )}
    </div>
  );
}
