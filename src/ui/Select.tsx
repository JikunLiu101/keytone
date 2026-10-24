import { useEffect, useId, useLayoutEffect, useRef, useState, type KeyboardEvent } from "react";
import { createPortal } from "react-dom";
import { ChevronDownIcon } from "./icons";

export interface SelectOption<T> {
  value: T;
  label: string;
  /** Options with the same group are listed under one heading. */
  group?: string;
}

interface SelectProps<T> {
  value: T;
  options: SelectOption<T>[];
  onChange: (value: T) => void;
  /** Accessible name (the visible label lives elsewhere, or there is none). */
  label: string;
  disabled?: boolean;
  className?: string;
  /** Shortcut shown in the tooltip, e.g. "Tab / Shift+Tab". */
  hint?: string;
  /**
   * Play a slow "open, slide to this option, choose it, close" animation
   * (for keyboard shortcuts). A new token starts a new run.
   */
  glide?: { value: T; token: number };
}

/** Glide timing (ms): open → start sliding → choose → close. Under 2 s in all. */
const GLIDE_SLIDE = 450;
const GLIDE_CHOOSE = 1150;
const GLIDE_CLOSE = 1750;

interface Placement {
  left: number;
  top: number;
  width: number;
  maxHeight: number;
  above: boolean;
}

const GAP = 6;
const MARGIN = 8;

/**
 * A dropdown drawn in the app's own style, replacing the browser's native
 * <select> menu (hard to read on dark pages, and different on every OS).
 *
 * The list opens in a layer on <body> placed under the button, so it is never
 * clipped by panels or the 3D glass. Keyboard: arrows, Home/End, Enter/Space,
 * Escape, Tab, and typing a letter to jump.
 */
export function Select<T extends string | number>({
  value,
  options,
  onChange,
  label,
  disabled,
  className,
  hint,
  glide,
}: SelectProps<T>) {
  const id = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [place, setPlace] = useState<Placement | null>(null);
  const [gliding, setGliding] = useState(false);
  // The highlight is one element that slides between options.
  const [glow, setGlow] = useState<{ top: number; height: number } | null>(null);
  const selectedIndex = Math.max(0, options.findIndex((o) => o.value === value));
  const current = options[selectedIndex];

  const openList = () => {
    if (disabled) return;
    setActive(selectedIndex);
    setOpen(true);
  };
  const close = (focusTrigger = true) => {
    setOpen(false);
    setPlace(null);
    if (focusTrigger) triggerRef.current?.focus();
  };
  const choose = (index: number) => {
    const option = options[index];
    if (option && option.value !== value) onChange(option.value);
    close();
  };

  // Place the list under the button (or above it when there's no room).
  useLayoutEffect(() => {
    if (!open) return;
    const measure = () => {
      const box = triggerRef.current?.getBoundingClientRect();
      if (!box) return;
      const below = innerHeight - box.bottom - GAP - MARGIN;
      const aboveSpace = box.top - GAP - MARGIN;
      const above = below < 200 && aboveSpace > below;
      const width = Math.max(box.width, 180);
      setPlace({
        left: Math.min(Math.max(MARGIN, box.left), innerWidth - width - MARGIN),
        top: above ? box.top - GAP : box.bottom + GAP,
        width,
        maxHeight: Math.min(340, above ? aboveSpace : below),
        above,
      });
    };
    measure();
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    return () => {
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
    };
  }, [open]);

  // Focus the list once it is on screen (it appears after it has been placed);
  // close on a press anywhere else.
  const shown = open && place !== null;
  useEffect(() => {
    if (!shown) return;
    // A shortcut-driven glide leaves focus alone, so the next Tab still works.
    if (!gliding) listRef.current?.focus();
    const onDown = (e: PointerEvent) => {
      const target = e.target as Node;
      if (!listRef.current?.contains(target) && !triggerRef.current?.contains(target)) close(false);
    };
    window.addEventListener("pointerdown", onDown, true);
    return () => window.removeEventListener("pointerdown", onDown, true);
  }, [shown]);

  // Slide the highlight to the active option.
  useLayoutEffect(() => {
    if (!shown) return;
    const el = listRef.current?.querySelector<HTMLElement>(`[data-index="${active}"]`);
    if (el) setGlow({ top: el.offsetTop, height: el.offsetHeight });
  }, [shown, active, place]);

  // Shortcut glide: open, slide to the target, choose it, close.
  const lastGlide = useRef(glide?.token);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  useEffect(() => {
    if (!glide || glide.token === lastGlide.current) return;
    lastGlide.current = glide.token;
    const to = options.findIndex((o) => o.value === glide.value);
    if (to < 0) return;
    if (disabled) {
      onChangeRef.current(glide.value);
      return;
    }
    setGliding(true);
    setActive(selectedIndex);
    setOpen(true);
    const timers = [
      window.setTimeout(() => setActive(to), GLIDE_SLIDE),
      window.setTimeout(() => onChangeRef.current(glide.value), GLIDE_CHOOSE),
      window.setTimeout(() => {
        setOpen(false);
        setPlace(null);
        setGliding(false);
      }, GLIDE_CLOSE),
    ];
    return () => timers.forEach((id) => window.clearTimeout(id));
  }, [glide?.token]);

  // Keep the highlighted option in view.
  useEffect(() => {
    if (shown) listRef.current?.querySelector(`[data-index="${active}"]`)?.scrollIntoView({ block: "nearest" });
  }, [shown, active]);

  const onTriggerKey = (e: KeyboardEvent<HTMLButtonElement>) => {
    if (e.key === "ArrowDown" || e.key === "ArrowUp" || e.key === "Enter") {
      e.preventDefault();
      openList();
    }
  };

  const onListKey = (e: KeyboardEvent<HTMLUListElement>) => {
    const last = options.length - 1;
    const move = (to: number) => {
      e.preventDefault();
      setActive(Math.max(0, Math.min(last, to)));
    };
    switch (e.key) {
      case "ArrowDown":
        return move(active + 1);
      case "ArrowUp":
        return move(active - 1);
      case "Home":
        return move(0);
      case "End":
        return move(last);
      case "PageDown":
        return move(active + 8);
      case "PageUp":
        return move(active - 8);
      case "Enter":
      case " ":
        e.preventDefault();
        return choose(active);
      case "Escape":
        e.preventDefault();
        e.stopPropagation();
        return close();
      case "Tab":
        return close(false);
      default:
        // Type a letter to jump to the next option starting with it.
        if (e.key.length === 1 && /\S/.test(e.key)) {
          const ch = e.key.toLowerCase();
          for (let i = 1; i <= options.length; i++) {
            const j = (active + i) % options.length;
            if (options[j].label.toLowerCase().startsWith(ch)) return move(j);
          }
        }
    }
  };

  // Group headings appear before the first option of each group.
  const items = options.map((o, i) => ({ o, i, heading: o.group && o.group !== options[i - 1]?.group ? o.group : null }));

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className={`select ${open ? "select--open" : ""} ${className ?? ""}`}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? `${id}-list` : undefined}
        aria-label={label}
        title={hint ? `${current?.label ?? ""} (${hint})` : current?.label}
        disabled={disabled}
        onClick={() => (open ? close() : openList())}
        onKeyDown={onTriggerKey}
      >
        <span className="select-value">{current?.label ?? ""}</span>
        <ChevronDownIcon />
      </button>
      {open &&
        place &&
        createPortal(
          <ul
            ref={listRef}
            id={`${id}-list`}
            className={`select-list ${place.above ? "select-list--above" : ""} ${gliding ? "select-list--glide" : ""}`}
            role="listbox"
            tabIndex={-1}
            aria-label={label}
            aria-activedescendant={`${id}-opt-${active}`}
            style={{
              left: place.left,
              top: place.above ? undefined : place.top,
              bottom: place.above ? innerHeight - place.top : undefined,
              minWidth: place.width,
              maxHeight: place.maxHeight,
            }}
            onKeyDown={onListKey}
          >
            {glow && (
              <li
                className="select-glow"
                role="presentation"
                aria-hidden="true"
                style={{ transform: `translateY(${glow.top}px)`, height: glow.height }}
              />
            )}
            {items.map(({ o, i, heading }) => [
              heading && (
                <li key={`h-${i}`} className="select-heading" role="presentation">
                  {heading}
                </li>
              ),
              <li
                key={i}
                id={`${id}-opt-${i}`}
                data-index={i}
                role="option"
                aria-selected={i === selectedIndex}
                className={`select-option ${i === active ? "select-option--active" : ""}`}
                onPointerMove={() => setActive(i)}
                onClick={() => choose(i)}
              >
                <span className="select-check" aria-hidden="true">
                  {i === selectedIndex ? "✓" : ""}
                </span>
                {o.label}
              </li>,
            ])}
          </ul>,
          document.body,
        )}
    </>
  );
}
