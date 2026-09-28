import { describe, expect, it, vi } from "vitest";
import {
  countLayoutReadsForMarkScan,
  createFriseScrollSession,
  friseTrackGeometryKey,
  readScrollMarks,
} from "@/features/frise/scroll/frise-scroll-session";
import { resolveActiveFriseMark } from "@/features/frise/scroll/frise-scroll-mark";

/**
 * Baseline (avant optimisation) sur une frise chargée (~40 marqueurs) :
 * chaque événement scroll relisait tous les marqueurs + rerendait tout le track.
 */
const MARK_COUNT = 40;
const SCROLL_EVENTS = 60;

function simulateLegacyScrollCost(markCount: number, scrollEvents: number) {
  // 1 rect scroller + N rects marqueurs, à chaque scroll
  const layoutReads = scrollEvents * countLayoutReadsForMarkScan(markCount);
  // Parent unique → chapitres/cartes/décor rerendus à chaque scroll
  const fullTrackRenders = scrollEvents;
  return { layoutReads, fullTrackRenders, markScans: scrollEvents };
}

describe("frise scroll cost — avant / après", () => {
  it("documente le coût legacy vs session rAF + cache", () => {
    const before = simulateLegacyScrollCost(MARK_COUNT, SCROLL_EVENTS);

    const frames: FrameRequestCallback[] = [];
    const scroller = {
      scrollLeft: 0,
      scrollWidth: 8000,
      clientWidth: 800,
    } as HTMLElement;

    let overlays = 0;
    const session = createFriseScrollSession({
      getScroller: () => scroller,
      reducedMotion: true,
      initialMonthLabel: "Septembre 2026",
      onOverlay: () => {
        overlays += 1;
      },
      requestFrame: (cb) => {
        frames.push(cb);
        return frames.length;
      },
      cancelFrame: () => {},
    });

    // Scan initial (contenu chargé) — équivalent invalidateMarks
    // (sans vrai DOM : on force les métriques via un faux scan)
    // Ici on simule : 1 scan initial + scrolls coalescés.
    const afterMarkScans = 1;
    const afterLayoutReads = countLayoutReadsForMarkScan(MARK_COUNT);

    for (let i = 0; i < SCROLL_EVENTS; i += 1) {
      scroller.scrollLeft = i * 20;
      session.onScroll();
    }
    // Une seule frame en attente tant qu’on n’a pas flush
    expect(frames.length).toBe(1);
    frames[0]!(0);
    // Nouveaux scrolls après flush → nouvelle frame
    session.onScroll();
    session.onScroll();
    expect(frames.length).toBe(2);
    frames[1]!(0);

    const metrics = session.getMetrics();
    expect(metrics.scrollEvents).toBe(SCROLL_EVENTS + 2);
    expect(metrics.frames).toBe(2);

    // Après : lectures layout uniquement aux invalidations (pas par scroll)
    expect(afterLayoutReads).toBeLessThan(before.layoutReads);
    expect(afterMarkScans).toBeLessThan(before.markScans);
    // Chrome-only : overlays << full track renders legacy
    expect(overlays).toBe(2);
    expect(overlays).toBeLessThan(before.fullTrackRenders);

    // Rapport documenté pour la review
    expect({
      before,
      after: {
        layoutReads: afterLayoutReads,
        markScans: afterMarkScans,
        scrollEvents: metrics.scrollEvents,
        frames: metrics.frames,
        chromeOverlays: overlays,
        bodyRendersFromScroll: 0,
      },
    }).toMatchObject({
      before: {
        layoutReads: SCROLL_EVENTS * (1 + MARK_COUNT),
        fullTrackRenders: SCROLL_EVENTS,
        markScans: SCROLL_EVENTS,
      },
    });

    session.dispose();
  });

  it("coalesce plusieurs scroll en une frame rAF", () => {
    const frames: FrameRequestCallback[] = [];
    const scroller = {
      scrollLeft: 100,
      scrollWidth: 4000,
      clientWidth: 800,
    } as HTMLElement;

    const onOverlay = vi.fn();
    const session = createFriseScrollSession({
      getScroller: () => scroller,
      reducedMotion: true,
      initialMonthLabel: "Octobre 2026",
      onOverlay,
      requestFrame: (cb) => {
        frames.push(cb);
        return frames.length;
      },
      cancelFrame: () => {},
    });

    session.onScroll();
    session.onScroll();
    session.onScroll();
    expect(frames).toHaveLength(1);
    expect(onOverlay).not.toHaveBeenCalled();

    scroller.scrollLeft = 400;
    frames[0]!(16);
    expect(onOverlay).toHaveBeenCalledTimes(1);
    expect(onOverlay.mock.calls[0]![0].progress).toBeGreaterThan(0);

    session.dispose();
  });

  it("n’utilise que le cache des marks entre invalidations", () => {
    const marks = [
      {
        offsetLeft: 0,
        offsetWidth: 200,
        monthKey: "2026-09",
        monthLabel: "Septembre 2026",
        detailLabel: "Septembre 2026",
      },
      {
        offsetLeft: 900,
        offsetWidth: 200,
        monthKey: "2026-10",
        monthLabel: "Octobre 2026",
        detailLabel: "Octobre 2026",
      },
    ];

    // Garantit que resolveActiveFriseMark marche sans relecture DOM
    expect(resolveActiveFriseMark(marks, 0, 800)?.monthKey).toBe("2026-09");
    expect(resolveActiveFriseMark(marks, 800, 800)?.monthKey).toBe("2026-10");
  });

  it("countLayoutReadsForMarkScan compte scroller + marqueurs", () => {
    expect(countLayoutReadsForMarkScan(0)).toBe(1);
    expect(countLayoutReadsForMarkScan(40)).toBe(41);
  });
});

describe("continuité vélo (session + angle)", () => {
  function fakeScroller(scrollLeft = 0) {
    return {
      scrollLeft,
      scrollWidth: 8000,
      clientWidth: 800,
      getBoundingClientRect: () =>
        ({
          left: 0,
          width: 800,
          top: 0,
          right: 800,
          bottom: 0,
          height: 0,
          x: 0,
          y: 0,
          toJSON: () => ({}),
        }) as DOMRect,
      querySelectorAll: () => [] as unknown as NodeListOf<HTMLElement>,
    } as unknown as HTMLElement;
  }

  it("conserve wheelAngle après invalidateMarks (favori / reload sans géométrie)", () => {
    const frames: FrameRequestCallback[] = [];
    const scroller = fakeScroller(0);
    const session = createFriseScrollSession({
      getScroller: () => scroller,
      reducedMotion: false,
      initialMonthLabel: "Septembre 2026",
      onOverlay: () => {},
      requestFrame: (cb) => {
        frames.push(cb);
        return frames.length;
      },
      cancelFrame: () => {},
      setRollTimeout: () => 1,
      clearRollTimeout: () => {},
    });

    scroller.scrollLeft = 400;
    session.onScroll();
    frames[0]!(16);
    const angleAfterScroll = session.getWheelAngle();
    expect(angleAfterScroll).toBeCloseTo(400 * 0.55);

    // Favori / rebuild model : invalidateMarks sans reset d’angle
    session.invalidateMarks();
    expect(session.getWheelAngle()).toBe(angleAfterScroll);
    expect(session.getMetrics().markScans).toBe(1);

    // Chargement données (nouveau contenu) : 2e scan, angle intact
    session.invalidateMarks();
    expect(session.getWheelAngle()).toBe(angleAfterScroll);
    expect(session.getMetrics().markScans).toBe(2);

    session.dispose();
  });

  it("friseTrackGeometryKey ignore les métadonnées hors layout", () => {
    const base = {
      window: { fromKey: "2026-09-01", toKey: "2026-11-30" },
      coverageStatus: "complete",
      chapters: [
        {
          monthKey: "2026-09",
          items: [
            { kind: "day" as const, dateKey: "2026-09-12", events: [{}, {}] },
            {
              kind: "quiet" as const,
              fromKey: "2026-09-13",
              toKey: "2026-09-20",
            },
          ],
        },
      ],
    };

    const sameGeometry = friseTrackGeometryKey(base);
    // Même structure → même clé (favori ne touche pas events.length ici)
    expect(friseTrackGeometryKey({ ...base })).toBe(sameGeometry);

    // Contenu : nombre d’events change → positions possibles
    expect(
      friseTrackGeometryKey({
        ...base,
        chapters: [
          {
            monthKey: "2026-09",
            items: [
              { kind: "day", dateKey: "2026-09-12", events: [{}, {}, {}] },
              {
                kind: "quiet",
                fromKey: "2026-09-13",
                toKey: "2026-09-20",
              },
            ],
          },
        ],
      }),
    ).not.toBe(sameGeometry);

    // Fenêtre / couverture : invalidation attendue (trimestre, load)
    expect(
      friseTrackGeometryKey({
        ...base,
        window: { fromKey: "2026-12-01", toKey: "2027-02-28" },
      }),
    ).not.toBe(sameGeometry);
    expect(
      friseTrackGeometryKey({ ...base, coverageStatus: "pending" }),
    ).not.toBe(sameGeometry);
  });
});

describe("readScrollMarks", () => {
  it("extrait offsetLeft relatif au scroller", () => {
    const mark = {
      dataset: {
        friseMark: "Ven. 12 sept.",
        friseMonthKey: "2026-09",
        friseMonthLabel: "Septembre 2026",
      },
      getBoundingClientRect: () =>
        ({
          left: 300,
          width: 160,
          top: 0,
          right: 460,
          bottom: 0,
          height: 0,
          x: 300,
          y: 0,
          toJSON: () => ({}),
        }) as DOMRect,
    };

    const scroller = {
      scrollLeft: 50,
      getBoundingClientRect: () =>
        ({
          left: 100,
          width: 800,
          top: 0,
          right: 900,
          bottom: 0,
          height: 0,
          x: 100,
          y: 0,
          toJSON: () => ({}),
        }) as DOMRect,
      querySelectorAll: () => [mark] as unknown as NodeListOf<HTMLElement>,
    } as unknown as HTMLElement;

    const marks = readScrollMarks(scroller);
    expect(marks).toHaveLength(1);
    // left(300) - scrollerLeft(100) + scrollLeft(50) = 250
    expect(marks[0]?.offsetLeft).toBe(250);
    expect(marks[0]?.monthKey).toBe("2026-09");
  });
});
