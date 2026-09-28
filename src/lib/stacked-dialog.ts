/** Attribut sur le déclencheur d’une fiche — survit aux re-renders React. */
export const EVENT_DETAIL_TRIGGER_ATTR = "data-event-detail-trigger";

function escapeAttrValue(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

export function eventDetailTriggerSelector(eventId: string): string {
  return `[${EVENT_DETAIL_TRIGGER_ATTR}="${escapeAttrValue(eventId)}"]`;
}

/** Escape du dialogue du dessus : ne laisse pas remonter aux dialogues empilés. */
export function onStackedDialogEscape(
  e: KeyboardEvent,
  onClose: () => void,
): void {
  if (e.key !== "Escape") return;
  e.preventDefault();
  e.stopImmediatePropagation();
  onClose();
}

/**
 * Restaure le focus sur le premier sélecteur vivant qui matche,
 * sinon sur la référence d’origine si elle est encore dans le document.
 */
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
