// @vitest-environment happy-dom

import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ForYouLoadingPlaceholder } from "./ForYouSection";

(
  globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

const VIEWPORT_WIDTHS = [375, 768, 1280, 1920] as const;

function trackMarkup(container: HTMLElement): string {
  const track = container.querySelector("[data-for-you-placeholder-track]");
  expect(track).not.toBeNull();
  return track!.innerHTML;
}

function cardWidthClasses(container: HTMLElement): string[] {
  const track = container.querySelector("[data-for-you-placeholder-track]");
  expect(track).not.toBeNull();
  return Array.from(track!.children).map((child) =>
    (child as HTMLElement).className,
  );
}

describe("ForYouLoadingPlaceholder", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    vi.useFakeTimers();
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
    vi.useRealTimers();
  });

  it("monte la géométrie aspect-[4/5] dès le départ, sans peindre avant ~200 ms", () => {
    act(() => {
      root.render(createElement(ForYouLoadingPlaceholder));
    });

    const section = container.querySelector("#pour-vous");
    expect(section).not.toBeNull();
    expect(section?.getAttribute("aria-busy")).toBe("true");
    expect(container.querySelectorAll("[class*='aspect-']")).toHaveLength(4);
    expect(container.innerHTML).not.toContain("h-[17.5rem]");
    expect(container.querySelector("[class*='bg-foam']")).toBeNull();

    act(() => {
      vi.advanceTimersByTime(199);
    });
    expect(container.querySelector("[class*='bg-foam']")).toBeNull();

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(container.querySelectorAll("[class*='bg-foam']").length).toBeGreaterThan(
      0,
    );
  });

  it("conserve la même structure de piste avant et après le délai", () => {
    act(() => {
      root.render(createElement(ForYouLoadingPlaceholder));
    });
    const before = trackMarkup(container);
    const widthsBefore = cardWidthClasses(container);

    act(() => {
      vi.advanceTimersByTime(200);
    });
    const after = trackMarkup(container);
    const widthsAfter = cardWidthClasses(container);

    // Même DOM structurel (aspect + barres) ; seuls les fonds changent.
    expect(after.replaceAll("bg-foam/70", "bg-transparent")
      .replaceAll("bg-foam/55", "bg-transparent")
      .replaceAll("bg-foam/40", "bg-transparent")).toBe(before);
    expect(widthsAfter).toEqual(widthsBefore);
    expect(widthsBefore).toHaveLength(4);
    expect(widthsBefore[0]).toContain("w-[64%]");
    expect(widthsBefore[0]).toContain("min-[1920px]:w-[18%]");
  });

  it.each(VIEWPORT_WIDTHS)(
    "garde une piste stable au viewport %spx (structure + largeurs carrousel)",
    (width) => {
      Object.defineProperty(window, "innerWidth", {
        configurable: true,
        writable: true,
        value: width,
      });
      container.style.width = `${width}px`;

      act(() => {
        root.render(createElement(ForYouLoadingPlaceholder));
      });
      const before = trackMarkup(container);
      const widthsBefore = cardWidthClasses(container);

      act(() => {
        vi.advanceTimersByTime(200);
      });
      const after = trackMarkup(container);
      const widthsAfter = cardWidthClasses(container);

      expect(widthsAfter).toEqual(widthsBefore);
      expect(after.replaceAll("bg-foam/70", "bg-transparent")
        .replaceAll("bg-foam/55", "bg-transparent")
        .replaceAll("bg-foam/40", "bg-transparent")).toBe(before);
      // Breakpoints du carrousel Home — pas de hauteur fixe viewport-dépendante.
      expect(widthsBefore[0]).toMatch(/w-\[64%\]/);
      expect(widthsBefore[0]).toMatch(/sm:w-\[36%\]/);
      expect(widthsBefore[0]).toMatch(/md:w-\[28%\]/);
      expect(widthsBefore[0]).toMatch(/lg:w-\[22%\]/);
    },
  );

  it("démonte sans prolonger si le parent retire le placeholder tôt", () => {
    act(() => {
      root.render(createElement(ForYouLoadingPlaceholder));
    });
    act(() => {
      root.render(null);
    });
    act(() => {
      vi.advanceTimersByTime(500);
    });
    expect(container.querySelector("#pour-vous")).toBeNull();
  });
});
