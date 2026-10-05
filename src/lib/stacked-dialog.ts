
export const EVENT_DETAIL_TRIGGER_ATTR = "data-event-detail-trigger";

function escapeAttrValue(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

export function eventDetailTriggerSelector(eventId: string): string {
  return `[${EVENT_DETAIL_TRIGGER_ATTR}="${escapeAttrValue(eventId)}"]`;
}

export function onStackedDialogEscape(
  e: KeyboardEvent,
  onClose: () => void,
): void {
  if (e.key !== "Escape") return;
  e.preventDefault();
  e.stopImmediatePropagation();
  onClose();
}

export function restoreDialogReturnFocus(
  returnFocusTo: HTMLElement | null | undefined,
  liveSelectors?: string | readonly string[] | null,
): boolean {
  if (typeof document === "undefined") return false;
  const selectors = Array.isArray(liveSelectors)
    ? liveSelectors
    : liveSelectors
      ? [liveSelectors]
      : [];
  for (const sel of selectors) {
    const live = document.querySelector(sel);
    if (live instanceof HTMLElement) {
      live.focus();
      return true;
    }
  }
  if (
    returnFocusTo &&
    typeof returnFocusTo.focus === "function" &&
    document.contains(returnFocusTo)
  ) {
    returnFocusTo.focus();
    return true;
  }
  return false;
}


export function restoreDialogFocusTriggerFirst(
  returnFocusTo: HTMLElement | null | undefined,
  fallbackSelectors?: string | readonly string[] | null,
): boolean {
  if (restoreDialogReturnFocus(returnFocusTo)) return true;
  return restoreDialogReturnFocus(null, fallbackSelectors);
}

let scrollLockCount = 0;
let originalBodyOverflow = "";

export function acquireBodyScrollLock(): void {
  if (typeof document === "undefined") return;
  if (scrollLockCount === 0) {
    originalBodyOverflow = document.body.style.overflow;
  }
  scrollLockCount += 1;
  document.body.style.overflow = "hidden";
}

export function releaseBodyScrollLock(): void {
  if (typeof document === "undefined") return;
  scrollLockCount = Math.max(0, scrollLockCount - 1);
  if (scrollLockCount === 0) {
    document.body.style.overflow = originalBodyOverflow;
  }
}

export function getBodyScrollLockCountForTests(): number {
  return scrollLockCount;
}

type StackedDialogLayer = {
  id: object;
  close: () => void;
};

const stackedLayers: StackedDialogLayer[] = [];

export function pushStackedDialogLayer(close: () => void): {
  id: object;
  pop: () => void;
} {
  const id = {};
  const layer: StackedDialogLayer = { id, close };
  stackedLayers.push(layer);
  return {
    id,
    pop() {
      const index = stackedLayers.findIndex((entry) => entry.id === id);
      if (index >= 0) stackedLayers.splice(index, 1);
    },
  };
}

export function isTopStackedDialogLayer(id: object): boolean {
  return stackedLayers[stackedLayers.length - 1]?.id === id;
}

export function getStackedDialogDepthForTests(): number {
  return stackedLayers.length;
}

/** Remise à zéro entre tests montés — ne pas utiliser en prod. */
export function resetStackedDialogStateForTests(): void {
  stackedLayers.length = 0;
  scrollLockCount = 0;
  originalBodyOverflow = "";
  if (typeof document !== "undefined") {
    document.body.style.overflow = "";
  }
}
