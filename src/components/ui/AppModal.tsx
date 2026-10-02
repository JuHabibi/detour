"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";
import { cn } from "@/lib/cn";
import {
  onStackedDialogEscape,
  restoreDialogReturnFocus,
} from "@/lib/stacked-dialog";

export type AppModalProps = {
  eyebrow?: string;
  title: string;
  description?: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  size?: "md" | "lg";
  returnFocusTo?: HTMLElement | null;
  fallbackFocusSelector?: string;
  suspended?: boolean;
  className?: string;
  titleId?: string;
};

let openAppModals = 0;
let originalBodyOverflow = "";

export function AppModal({
  eyebrow,
  title,
  description,
  onClose,
  children,
  footer,
  size = "md",
  returnFocusTo,
  fallbackFocusSelector,
  suspended = false,
  className,
  titleId: titleIdProp,
}: AppModalProps) {
  const generatedTitleId = useId();
  const titleId = titleIdProp ?? generatedTitleId;
  const closeRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  const returnFocusToRef = useRef(returnFocusTo);
  const fallbackFocusSelectorRef = useRef(fallbackFocusSelector);

  useEffect(() => {
    onCloseRef.current = onClose;
    returnFocusToRef.current = returnFocusTo;
    fallbackFocusSelectorRef.current = fallbackFocusSelector;
  }, [onClose, returnFocusTo, fallbackFocusSelector]);

  useEffect(() => {
    if (openAppModals === 0) originalBodyOverflow = document.body.style.overflow;
    openAppModals += 1;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();

    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== "Escape") return;
      const dialogs = document.querySelectorAll("[data-app-modal-dialog]");
      if (dialogs[dialogs.length - 1] !== dialogRef.current) return;
      onStackedDialogEscape(e, () => onCloseRef.current());
    }
    window.addEventListener("keydown", onKeyDown, true);
    return () => {
      openAppModals -= 1;
      if (openAppModals === 0) document.body.style.overflow = originalBodyOverflow;
      window.removeEventListener("keydown", onKeyDown, true);
      if (!restoreDialogReturnFocus(returnFocusToRef.current)) {
        restoreDialogReturnFocus(null, fallbackFocusSelectorRef.current);
      }
    };
  }, []);

  return (
    <div
      inert={suspended}
      aria-hidden={suspended || undefined}
      className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-6"
    >
      <button
        type="button"
        aria-label="Fermer"
        className="absolute inset-0 bg-ink/40"
        onClick={onClose}
      />

      <div
        ref={dialogRef}
        data-app-modal-dialog
        role="dialog"
        aria-modal={suspended ? undefined : "true"}
        aria-labelledby={titleId}
        className={cn(
          "relative z-[1] flex w-full flex-col border border-line bg-foam",
          "max-h-[min(90vh,36rem)]",
          "px-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-5 sm:px-6 sm:pb-6 sm:pt-6",
          size === "md" && "max-w-md",
          size === "lg" && "max-w-lg",
          className,
        )}
      >
        <div className="flex items-start justify-between gap-4">
          {eyebrow ? (
            <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-sand">
              {eyebrow}
            </p>
          ) : (
            <span />
          )}
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label="Fermer la fenêtre"
            className="flex size-9 shrink-0 items-center justify-center text-sand transition-colors hover:text-ink"
          >
            <span aria-hidden className="text-lg leading-none">
              ×
            </span>
          </button>
        </div>

        <h2
          id={titleId}
          className="mt-3 font-display text-[1.55rem] font-semibold leading-[1.08] tracking-tight text-ink sm:text-[1.7rem]"
        >
          {title}
        </h2>
        {description ? (
          <p className="mt-2 text-sm leading-6 text-cream-dim">{description}</p>
        ) : null}

        <div className="mt-5 min-h-0 flex-1 overflow-y-auto">{children}</div>

        {footer ? <div className="mt-6 flex flex-wrap items-center justify-end gap-3">{footer}</div> : null}
      </div>
    </div>
  );
}
