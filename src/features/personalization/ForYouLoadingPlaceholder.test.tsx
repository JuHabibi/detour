// @vitest-environment happy-dom

import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ForYouLoadingPlaceholder } from "./ForYouSection";

(
  globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

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

  it("ne peint pas le squelette avant ~200 ms", () => {
    act(() => {
      root.render(createElement(ForYouLoadingPlaceholder));
    });

    const section = container.querySelector("#pour-vous");
    expect(section).not.toBeNull();
    expect(section?.getAttribute("aria-busy")).toBe("true");
    expect(container.querySelectorAll("[class*='aspect-']")).toHaveLength(0);

    act(() => {
      vi.advanceTimersByTime(199);
    });
    expect(container.querySelectorAll("[class*='aspect-']")).toHaveLength(0);

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(container.querySelectorAll("[class*='aspect-']").length).toBeGreaterThan(
      0,
    );
  });

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
