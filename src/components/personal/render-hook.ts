/**
 * Harness minimal pour monter un hook dans React (happy-dom).
 * Pas de Testing Library — `act` + `createRoot` uniquement.
 */
import { createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { act } from "react";

(
  globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

export type RenderedHook<T> = {
  result: { current: T };
  rerender: () => void;
  unmount: () => void;
};

export function renderHook<T>(useHook: () => T): RenderedHook<T> {
  const result: { current: T } = {
    current: undefined as T,
  };

  function HookProbe() {
    result.current = useHook();
    return null;
  }

  const container = document.createElement("div");
  document.body.appendChild(container);
  let root!: Root;

  const paint = () => {
    root.render(createElement(HookProbe));
  };

  act(() => {
    root = createRoot(container);
    paint();
  });

  return {
    result,
    rerender: () => {
      act(() => {
        paint();
      });
    },
    unmount: () => {
      act(() => {
        root.unmount();
      });
      container.remove();
    },
  };
}

/** Attend les queueMicrotask du hook + flush React. */
export async function flushMicrotasks(): Promise<void> {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}
