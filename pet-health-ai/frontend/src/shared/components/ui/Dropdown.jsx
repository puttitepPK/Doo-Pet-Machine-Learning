import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown } from "lucide-react";
import "./Dropdown.css";

// The popup lines up with the visible field (the wrapping <label>) rather than the bare button.
const anchorOf = (element) => element?.closest("label") ?? element;

/*
 * Themed replacement for <select>: the option list is a rounded, animated popup that follows the site theme.
 * Keyboard: ↑/↓ Home End move, Enter/Space choose, Esc close, Tab leave. Focus stays on the trigger
 * (select-only combobox pattern), so screen readers announce the active option.
 * Works controlled (value + onChange) or uncontrolled in forms (name + defaultValue → hidden input).
 */
export default function Dropdown({
  value, defaultValue, onChange, options, name, disabled = false,
  ariaLabel, className = "", chevron = true, placeholder = "เลือก",
}) {
  const listId = useId();
  const triggerRef = useRef(null);
  const listRef = useRef(null);
  const [inner, setInner] = useState(defaultValue ?? options[0]?.value ?? "");
  const current = value !== undefined ? value : inner;
  const selectedIndex = Math.max(0, options.findIndex((option) => option.value === current));
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(selectedIndex);
  const [place, setPlace] = useState(null);

  const measure = useCallback(() => {
    const box = anchorOf(triggerRef.current)?.getBoundingClientRect();
    if (!box) return;
    const wanted = Math.min(280, options.length * 42 + 14);
    const below = window.innerHeight - box.bottom - 10;
    const up = below < wanted && box.top > below;
    const width = Math.max(box.width, 150);
    const left = Math.min(Math.max(8, box.left), window.innerWidth - width - 8);
    setPlace({ left, width, up, top: up ? undefined : box.bottom + 6, bottom: up ? window.innerHeight - box.top + 6 : undefined, max: Math.max(120, Math.min(280, (up ? box.top : below) - 12)) });
  }, [options.length]);

  const openList = (index = selectedIndex) => {
    if (disabled) return;
    setActive(index);
    measure();
    setOpen(true);
  };
  const close = () => setOpen(false);
  const choose = (index) => {
    const option = options[index];
    if (!option) return;
    if (value === undefined) setInner(option.value);
    if (option.value !== current) onChange?.(option.value);
    close();
  };

  useLayoutEffect(() => {
    if (!open) return undefined;
    const update = () => measure();
    const outside = (event) => {
      if (!triggerRef.current?.contains(event.target) && !listRef.current?.contains(event.target)) close();
    };
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    document.addEventListener("pointerdown", outside);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
      document.removeEventListener("pointerdown", outside);
    };
  }, [open, measure]);

  useEffect(() => {
    if (open) listRef.current?.querySelector(`[data-index="${active}"]`)?.scrollIntoView({ block: "nearest" });
  }, [open, active]);

  const onKeyDown = (event) => {
    const last = options.length - 1;
    const keys = {
      ArrowDown: () => (open ? setActive(Math.min(last, active + 1)) : openList()),
      ArrowUp: () => (open ? setActive(Math.max(0, active - 1)) : openList()),
      Home: () => open && setActive(0),
      End: () => open && setActive(last),
      Enter: () => (open ? choose(active) : openList()),
      " ": () => (open ? choose(active) : openList()),
      Escape: () => open && close(),
    };
    if (event.key === "Tab") { close(); return; }
    if (!keys[event.key]) {
      // Type-ahead: jump to the next option starting with the typed letter.
      if (open && event.key.length === 1) {
        const letter = event.key.toLowerCase();
        const order = [...options.keys()].map((step) => (active + 1 + step) % options.length);
        const hit = order.find((index) => options[index].label.toLowerCase().startsWith(letter));
        if (hit !== undefined) setActive(hit);
      }
      return;
    }
    if (event.key !== "Escape" || open) event.preventDefault();
    keys[event.key]();
  };

  return <>
    <button ref={triggerRef} type="button" className={`dd-trigger ${className}`} disabled={disabled}
      role="combobox" aria-haspopup="listbox" aria-expanded={open} aria-controls={listId} aria-label={ariaLabel}
      aria-activedescendant={open ? `${listId}-${active}` : undefined}
      onClick={() => (open ? close() : openList())} onKeyDown={onKeyDown}>
      <span className="dd-value">{options[selectedIndex]?.label ?? placeholder}</span>
      {chevron && <ChevronDown className="dd-chevron" size={16} aria-hidden="true" />}
    </button>
    {name && <input type="hidden" name={name} value={current} />}
    {open && place && createPortal(
      <ul ref={listRef} id={listId} role="listbox" aria-label={ariaLabel} className={`dd-list${place.up ? " up" : ""}`}
        style={{ left: place.left, top: place.top, bottom: place.bottom, minWidth: place.width, maxHeight: place.max }}>
        {options.map((option, index) => {
          const selected = index === selectedIndex;
          return (
            <li key={option.value} id={`${listId}-${index}`} data-index={index} role="option" aria-selected={selected}
              className={`dd-option${selected ? " selected" : ""}${index === active ? " active" : ""}`}
              style={{ "--n": index }}
              onPointerDown={(event) => event.preventDefault()}
              onPointerMove={() => index !== active && setActive(index)}
              onClick={() => { choose(index); triggerRef.current?.focus(); }}>
              <span>{option.label}</span>
              {selected && <Check size={15} strokeWidth={2.6} aria-hidden="true" />}
            </li>
          );
        })}
      </ul>,
      triggerRef.current?.closest("dialog[open]") ?? document.body,
    )}
  </>;
}
