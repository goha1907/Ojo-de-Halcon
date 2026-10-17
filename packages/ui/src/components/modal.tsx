"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { cn } from "../lib/cn";
import { CloseIcon } from "./icons";

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  closeLabel: string;
  children: ReactNode;
  className?: string;
}

// Several modals can be open at once (one over another): the page unlocks when the last one closes.
let scrollLocks = 0;
function lockPageScroll(): () => void {
  if (scrollLocks++ === 0) document.documentElement.style.overflow = "hidden";
  return () => {
    if (--scrollLocks === 0) document.documentElement.style.overflow = "";
  };
}

/** Accessible modal built on the native <dialog> (focus trap, Esc, backdrop). The page behind it does not scroll. */
export function Modal({ open, onClose, title, closeLabel, children, className }: ModalProps) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  useEffect(() => (open ? lockPageScroll() : undefined), [open]);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(event) => {
        // A click on the backdrop targets the dialog element itself.
        if (event.target === ref.current) onClose();
      }}
      className={cn(
        "m-auto w-[min(32rem,calc(100vw-2rem))] rounded-field border border-line bg-surface p-0 text-fg shadow-xl",
        "overscroll-contain backdrop:bg-black/40",
        className,
      )}
    >
      {open && (
        <div className="space-y-4 p-5">
          <div className="flex items-start justify-between gap-4">
            <h2 className="text-lg font-semibold">{title}</h2>
            <button
              type="button"
              onClick={onClose}
              aria-label={closeLabel}
              className="grid size-8 shrink-0 place-items-center rounded-full text-fg-muted transition-colors hover:bg-line/40 hover:text-fg focus-visible:outline-2 focus-visible:outline-ring"
            >
              <CloseIcon className="size-5" />
            </button>
          </div>
          {children}
        </div>
      )}
    </dialog>
  );
}
