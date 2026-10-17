"use client";

import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState, type KeyboardEvent } from "react";
import { createPortal } from "react-dom";
import { cn } from "../lib/cn";
import { CheckIcon, ChevronDownIcon } from "./icons";
import {
  firstEnabledIndex,
  lastEnabledIndex,
  matchPrefix,
  nextEnabledIndex,
  type SelectOption,
} from "./select-logic";

export interface SelectProps {
  value: string;
  onChange: (value: string) => void;
  options: readonly SelectOption[];
  /** Shown while no option matches `value` (an empty value). */
  placeholder?: string;
  id?: string;
  /** Submits the value with a plain form. */
  name?: string;
  disabled?: boolean;
  invalid?: boolean;
  /** `field` for forms, `pill` for the compact pickers in headers and toolbars. */
  variant?: "field" | "pill";
  size?: "sm" | "md";
  className?: string;
  "aria-label"?: string;
  "aria-describedby"?: string | undefined;
}

interface MenuPosition {
  left: number;
  minWidth: number;
  maxHeight: number;
  top?: number;
  bottom?: number;
}

const MENU_MAX_HEIGHT = 288;
const TYPEAHEAD_RESET_MS = 600;

/**
 * Drop-down list in the style of the project: the native one cannot be styled. The focus stays on the
 * button (combobox pattern): arrows, Home/End, Enter/Space, Escape and typing the first letters all work.
 * The list is drawn above everything else, also inside modal dialogs, and flips upward near the screen bottom.
 */
export function Select({
  value,
  onChange,
  options,
  placeholder,
  id,
  name,
  disabled = false,
  invalid = false,
  variant = "field",
  size = "md",
  className,
  "aria-label": ariaLabel,
  "aria-describedby": describedBy,
}: SelectProps) {
  const uid = useId();
  const listId = `${uid}-list`;
  const trigger = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLUListElement>(null);
  const typed = useRef({ text: "", at: 0 });
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [position, setPosition] = useState<MenuPosition | null>(null);

  const selected = options.findIndex((option) => option.value === value);
  const label = selected >= 0 ? options[selected]!.label : (placeholder ?? "");

  const openMenu = useCallback(() => {
    if (disabled) return;
    setActive(selected >= 0 && !options[selected]!.disabled ? selected : firstEnabledIndex(options));
    setOpen(true);
  }, [disabled, options, selected]);

  const close = useCallback((refocus: boolean) => {
    setOpen(false);
    setPosition(null);
    if (refocus) trigger.current?.focus();
  }, []);

  const choose = useCallback(
    (index: number) => {
      const option = options[index];
      if (!option || option.disabled) return;
      if (option.value !== value) onChange(option.value);
      close(true);
    },
    [close, onChange, options, value],
  );

  // place the list under the button, or above it when there is no room below
  useLayoutEffect(() => {
    if (!open || !trigger.current) return;
    const rect = trigger.current.getBoundingClientRect();
    const below = window.innerHeight - rect.bottom - 12;
    const above = rect.top - 12;
    const flip = below < 200 && above > below;
    const maxHeight = Math.min(MENU_MAX_HEIGHT, flip ? above : below);
    setPosition(
      flip
        ? { left: rect.left, minWidth: rect.width, maxHeight, bottom: window.innerHeight - rect.top + 6 }
        : { left: rect.left, minWidth: rect.width, maxHeight, top: rect.bottom + 6 },
    );
  }, [open]);

  // keep the highlighted option in view
  useEffect(() => {
    if (open && position && active >= 0) {
      document.getElementById(`${uid}-opt-${active}`)?.scrollIntoView({ block: "nearest" });
    }
  }, [open, position, active, uid]);

  // a click elsewhere, scrolling the page or resizing the window closes the list
  useEffect(() => {
    if (!open) return;
    const onPointer = (event: MouseEvent) => {
      const target = event.target as Node;
      if (!trigger.current?.contains(target) && !menu.current?.contains(target)) close(false);
    };
    const onScroll = (event: Event) => {
      if (!menu.current?.contains(event.target as Node)) close(false);
    };
    const onResize = () => close(false);
    document.addEventListener("mousedown", onPointer);
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onResize);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onResize);
    };
  }, [open, close]);

  function onKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (disabled) return;
    const key = event.key;
    if (key.length === 1 && key !== " " && !event.ctrlKey && !event.metaKey && !event.altKey) {
      const now = Date.now();
      const text = now - typed.current.at < TYPEAHEAD_RESET_MS ? typed.current.text + key : key;
      typed.current = { text, at: now };
      const from = open ? active : selected;
      // one letter, or the same letter again, moves on to the next option with it; a longer word narrows the match
      const repeated = text.length > 1 && [...text].every((char) => char === text[0]);
      const found =
        text.length === 1 || repeated ? matchPrefix(options, text[0]!, from) : matchPrefix(options, text, from - 1);
      if (found >= 0) {
        if (open) setActive(found);
        else if (options[found]!.value !== value) onChange(options[found]!.value);
      }
      return;
    }
    if (!open) {
      if (key === "ArrowDown" || key === "ArrowUp" || key === "Enter" || key === " ") {
        event.preventDefault();
        openMenu();
      }
      return;
    }
    switch (key) {
      case "ArrowDown":
        event.preventDefault();
        setActive((current) => nextEnabledIndex(options, current, 1));
        break;
      case "ArrowUp":
        event.preventDefault();
        setActive((current) => nextEnabledIndex(options, current, -1));
        break;
      case "Home":
        event.preventDefault();
        setActive(firstEnabledIndex(options));
        break;
      case "End":
        event.preventDefault();
        setActive(lastEnabledIndex(options));
        break;
      case "Enter":
      case " ":
        event.preventDefault();
        choose(active);
        break;
      case "Escape":
        event.preventDefault();
        event.stopPropagation();
        close(true);
        break;
      case "Tab":
        close(false);
        break;
    }
  }

  const container = typeof document === "undefined" ? null : (trigger.current?.closest("dialog") ?? document.body);

  return (
    <>
      <button
        ref={trigger}
        id={id}
        type="button"
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-activedescendant={open && active >= 0 ? `${uid}-opt-${active}` : undefined}
        aria-label={ariaLabel}
        aria-describedby={describedBy}
        aria-invalid={invalid || undefined}
        disabled={disabled}
        onClick={() => (open ? close(false) : openMenu())}
        onKeyDown={onKeyDown}
        className={cn(
          "flex items-center justify-between gap-2 border bg-surface text-left text-fg shadow-sm transition",
          // full width unless the caller sets its own (two width classes on one element fight by stylesheet order)
          !/(^|\s)(sm:|md:|lg:)?w-/.test(className ?? "") && "w-full",
          "hover:border-fg-subtle focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-ring",
          "disabled:cursor-not-allowed disabled:opacity-60",
          variant === "pill" ? "rounded-full" : "rounded-field",
          size === "sm" ? "h-10 px-3 text-sm" : "h-11 px-3 text-sm",
          invalid ? "border-error" : "border-line",
          className,
        )}
      >
        <span className={cn("truncate", (selected < 0 || value === "") && "text-fg-muted")}>{label || " "}</span>
        <ChevronDownIcon className={cn("size-4 text-fg-muted transition-transform", open && "rotate-180")} />
      </button>
      {name && <input type="hidden" name={name} value={value} />}
      {open &&
        container &&
        createPortal(
          <ul
            ref={menu}
            id={listId}
            role="listbox"
            aria-label={ariaLabel}
            style={position ?? { visibility: "hidden", left: 0, top: 0 }}
            className="select-menu fixed z-[80] w-max max-w-[min(26rem,calc(100vw-1.5rem))] overflow-auto rounded-field border border-line bg-surface p-1 text-fg shadow-xl"
          >
            {options.map((option, index) => (
              <li
                key={option.value}
                id={`${uid}-opt-${index}`}
                role="option"
                aria-selected={index === selected}
                aria-disabled={option.disabled || undefined}
                onMouseDown={(event) => event.preventDefault()}
                onMouseEnter={() => !option.disabled && setActive(index)}
                onClick={() => choose(index)}
                className={cn(
                  "flex cursor-pointer items-center justify-between gap-3 rounded-[calc(var(--radius-field)-0.25rem)] px-3 py-2 text-sm",
                  index === active && "bg-line/50",
                  index === selected && "font-semibold",
                  option.disabled && "cursor-not-allowed opacity-50",
                )}
              >
                <span className="whitespace-nowrap">{option.label}</span>
                {index === selected && <CheckIcon className="size-4 text-fg" />}
              </li>
            ))}
          </ul>,
          container,
        )}
    </>
  );
}
