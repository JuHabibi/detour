/**
 * Runtime scroll frise — rAF + cache des marqueurs DOM.
 * Les lectures getBoundingClientRect ne se font qu’à l’invalidation
 * (contenu / taille), pas à chaque événement scroll.
 */

import {
  friseScrollProgress,
  resolveActiveFriseMark,
  type FriseActiveMark,
  type FriseScrollMark,
} from "@/features/frise/scroll/frise-scroll-mark";

export type FriseScrollOverlaySnapshot = {
  progress: number;
  wheelAngle: number;
  rolling: boolean;
  activeMonthLabel: string;
  activeDetail: string | null;
};

export type FriseScrollSessionMetrics = {
  /** Événements `scroll` reçus. */
  scrollEvents: number;
  /** Frames rAF exécutées. */
  frames: number;
  /** Recalculs complets des marqueurs (layout). */
  markScans: number;
  /** Lectures getBoundingClientRect (scroller + chaque marqueur). */
  layoutReads: number;
};

export function readScrollMarks(scroller: HTMLElement): FriseScrollMark[] {
  const scrollerRect = scroller.getBoundingClientRect();
  const nodes = scroller.querySelectorAll<HTMLElement>("[data-frise-mark]");
  const marks: FriseScrollMark[] = [];
  nodes.forEach((node) => {
    const monthKey = node.dataset.friseMonthKey?.trim() ?? "";
    const monthLabel = node.dataset.friseMonthLabel?.trim() ?? "";
    if (!monthKey || !monthLabel) return;
    const rect = node.getBoundingClientRect();
    const offsetLeft = rect.left - scrollerRect.left + scroller.scrollLeft;
    marks.push({
      offsetLeft,
      offsetWidth: Math.max(1, rect.width),
      monthKey,
      monthLabel,
      detailLabel: node.dataset.friseMark?.trim() || undefined,
    });
  });
  return marks;
}

/** Compte les lectures layout d’un scan (scroller + N marqueurs). */
export function countLayoutReadsForMarkScan(markCount: number): number {
  return 1 + Math.max(0, markCount);
}

type SessionOptions = {
  getScroller: () => HTMLElement | null;
  reducedMotion: boolean;
  initialMonthLabel: string;
  onOverlay: (snapshot: FriseScrollOverlaySnapshot) => void;
  /** Hooks de mesure (tests). */
  now?: () => number;
  requestFrame?: (cb: FrameRequestCallback) => number;
  cancelFrame?: (id: number) => void;
  setRollTimeout?: (cb: () => void, ms: number) => number;
  clearRollTimeout?: (id: number) => void;
};

/**
 * Clé de géométrie du track : change seulement si les marqueurs peuvent bouger.
 * Ignore favoris / métadonnées hors layout.
 */
export function friseTrackGeometryKey(model: {
  window: { fromKey: string; toKey: string };
  coverageStatus: string;
  chapters: readonly {
    monthKey: string;
    items: readonly (
      | { kind: "day"; dateKey: string; events: readonly unknown[] }
      | { kind: "quiet"; fromKey: string; toKey: string }
    )[];
  }[];
}): string {
  const parts: string[] = [
    model.window.fromKey,
    model.window.toKey,
    model.coverageStatus,
  ];
  for (const chapter of model.chapters) {
    parts.push(chapter.monthKey);
    for (const item of chapter.items) {
      if (item.kind === "day") {
        parts.push(`d:${item.dateKey}:${item.events.length}`);
      } else {
        parts.push(`q:${item.fromKey}:${item.toKey}`);
      }
    }
  }
  return parts.join("|");
}

/**
 * Session scroll : coalesce les events via rAF, cache les marks.
 */
export function createFriseScrollSession(options: SessionOptions) {
  const requestFrame =
    options.requestFrame ??
    ((cb: FrameRequestCallback) => requestAnimationFrame(cb));
  const cancelFrame =
    options.cancelFrame ?? ((id: number) => cancelAnimationFrame(id));
  const setRollTimeout =
    options.setRollTimeout ??
    ((cb: () => void, ms: number) => window.setTimeout(cb, ms));
  const clearRollTimeout =
    options.clearRollTimeout ?? ((id: number) => window.clearTimeout(id));

  let reducedMotion = options.reducedMotion;
  let marks: FriseScrollMark[] = [];
  let lastScrollLeft = 0;
  let wheelAngle = 0;
  let rolling = false;
  let activeMonthLabel = options.initialMonthLabel;
  let activeDetail: string | null = null;
  let rafId = 0;
  let rollTimeoutId = 0;
  let disposed = false;

  const metrics: FriseScrollSessionMetrics = {
    scrollEvents: 0,
    frames: 0,
    markScans: 0,
    layoutReads: 0,
  };

  function publish() {
    const el = options.getScroller();
    const progress = el
      ? friseScrollProgress(el.scrollLeft, el.scrollWidth, el.clientWidth)
      : 0;
    options.onOverlay({
      progress,
      wheelAngle,
      rolling,
      activeMonthLabel,
      activeDetail,
    });
  }

  function scanMarks() {
    const el = options.getScroller();
    if (!el) {
      marks = [];
      return;
    }
    marks = readScrollMarks(el);
    metrics.markScans += 1;
    metrics.layoutReads += countLayoutReadsForMarkScan(marks.length);
  }

  function applyActiveFromCache(scrollLeft: number, clientWidth: number) {
    const active: FriseActiveMark | null = resolveActiveFriseMark(
      marks,
      scrollLeft,
      clientWidth,
    );
    if (!active) return;
    activeMonthLabel = active.monthLabel;
    activeDetail = active.detailLabel;
  }

  function runFrame() {
    rafId = 0;
    if (disposed) return;
    metrics.frames += 1;
    const el = options.getScroller();
    if (!el) return;

    const left = el.scrollLeft;
    if (!reducedMotion) {
      const delta = left - lastScrollLeft;
      wheelAngle += delta * 0.55;
      if (Math.abs(delta) > 0.5) {
        rolling = true;
        if (rollTimeoutId) clearRollTimeout(rollTimeoutId);
        rollTimeoutId = setRollTimeout(() => {
          rolling = false;
          rollTimeoutId = 0;
          if (!disposed) publish();
        }, 140);
      }
    }
    lastScrollLeft = left;
    applyActiveFromCache(left, el.clientWidth);
    publish();
  }

  function onScroll() {
    if (disposed) return;
    metrics.scrollEvents += 1;
    if (rafId) return;
    rafId = requestFrame(runFrame);
  }

  function invalidateMarks() {
    if (disposed) return;
    scanMarks();
    const el = options.getScroller();
    if (el) {
      // Conserve wheelAngle / lastScrollLeft : seul le cache des marks est rafraîchi.
      lastScrollLeft = el.scrollLeft;
      applyActiveFromCache(el.scrollLeft, el.clientWidth);
    }
    publish();
  }

  function setReducedMotion(next: boolean) {
    reducedMotion = next;
  }

  function dispose() {
    disposed = true;
    if (rafId) cancelFrame(rafId);
    rafId = 0;
    if (rollTimeoutId) clearRollTimeout(rollTimeoutId);
    rollTimeoutId = 0;
  }

  function getMetrics(): FriseScrollSessionMetrics {
    return { ...metrics };
  }

  function getCachedMarkCount(): number {
    return marks.length;
  }

  function getWheelAngle(): number {
    return wheelAngle;
  }

  return {
    onScroll,
    invalidateMarks,
    setReducedMotion,
    dispose,
    getMetrics,
    getCachedMarkCount,
    getWheelAngle,
  };
}

export type FriseScrollSession = ReturnType<typeof createFriseScrollSession>;
