// @vitest-environment happy-dom
/**
 * Cycle de vie empilé — hook monté (scroll, Échap, focus, callbacks).
 */
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import {
  StrictMode,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createRoot, type Root } from "react-dom/client";
import { act } from "react";
import {
  getBodyScrollLockCountForTests,
  getStackedDialogDepthForTests,
  resetStackedDialogStateForTests,
} from "@/lib/stacked-dialog";
import { useStackedDialogLifecycle } from "@/lib/use-stacked-dialog-lifecycle";

(
  globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

function dispatchEscape(): void {
  window.dispatchEvent(
    new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
  );
}

function mount(node: ReactNode): { unmount: () => void } {
  const container = document.createElement("div");
  document.body.appendChild(container);
  let root!: Root;
  act(() => {
    root = createRoot(container);
    root.render(node);
  });
  return {
    unmount: () => {
      act(() => {
        root.unmount();
      });
      container.remove();
    },
  };
}

function Probe(props: {
  onClose: () => void;
  returnFocusTo?: HTMLElement | null;
  label: string;
}) {
  const closeRef = useRef<HTMLButtonElement>(null);
  useStackedDialogLifecycle({
    onClose: props.onClose,
    initialFocusRef: closeRef,
    returnFocusTo: props.returnFocusTo,
    focusRestore: "trigger-first",
  });
  return (
    <div data-probe={props.label}>
      <button ref={closeRef} type="button" aria-label={`close-${props.label}`} />
    </div>
  );
}

describe("useStackedDialogLifecycle monté", () => {
  beforeEach(() => {
    resetStackedDialogStateForTests();
    document.body.style.overflow = "scroll";
  });

  afterEach(() => {
    resetStackedDialogStateForTests();
  });

  it("ouverture simple : scroll bloqué et focus initial", () => {
    const onClose = vi.fn();
    const { unmount } = mount(<Probe onClose={onClose} label="solo" />);

    expect(document.body.style.overflow).toBe("hidden");
    expect(getBodyScrollLockCountForTests()).toBe(1);
    expect(document.activeElement?.getAttribute("aria-label")).toBe(
      "close-solo",
    );

    unmount();
    expect(document.body.style.overflow).toBe("scroll");
    expect(getBodyScrollLockCountForTests()).toBe(0);
  });

  it("empilement : Échap ne ferme que le sommet ; scroll reste bloqué", () => {
    const closeBottom = vi.fn();
    const closeTop = vi.fn();
    const trigger = document.createElement("button");
    trigger.id = "day-trigger";
    document.body.appendChild(trigger);

    function Stack() {
      const [topOpen, setTopOpen] = useState(true);
      return (
        <div>
          <Probe
            label="panel"
            onClose={closeBottom}
            returnFocusTo={trigger}
          />
          {topOpen ? (
            <Probe
              label="detail"
              onClose={() => {
                closeTop();
                setTopOpen(false);
              }}
              returnFocusTo={trigger}
            />
          ) : null}
        </div>
      );
    }

    const { unmount } = mount(<Stack />);
    expect(getStackedDialogDepthForTests()).toBe(2);
    expect(document.body.style.overflow).toBe("hidden");

    act(() => {
      dispatchEscape();
    });

    expect(closeTop).toHaveBeenCalledOnce();
    expect(closeBottom).not.toHaveBeenCalled();
    expect(getStackedDialogDepthForTests()).toBe(1);
    expect(document.body.style.overflow).toBe("hidden");
    expect(getBodyScrollLockCountForTests()).toBe(1);

    act(() => {
      dispatchEscape();
    });
    expect(closeBottom).toHaveBeenCalledOnce();

    unmount();
    trigger.remove();
  });

  it("fermeture du sommet restaure le focus déclencheur ; panneau conserve le lock", () => {
    const trigger = document.createElement("button");
    trigger.id = "card-trigger";
    document.body.appendChild(trigger);
    trigger.focus();

    function Stack() {
      const [topOpen, setTopOpen] = useState(true);
      return (
        <div>
          <Probe
            label="panel"
            onClose={() => undefined}
            returnFocusTo={document.createElement("button")}
          />
          {topOpen ? (
            <Probe
              label="detail"
              onClose={() => setTopOpen(false)}
              returnFocusTo={trigger}
            />
          ) : null}
        </div>
      );
    }

    const { unmount } = mount(<Stack />);

    act(() => {
      dispatchEscape();
    });

    expect(document.activeElement).toBe(trigger);
    expect(document.body.style.overflow).toBe("hidden");

    unmount();
    trigger.remove();
  });

  it("callback onClose actualisé sans remonter le cycle ni reprendre le focus", () => {
    const first = vi.fn();
    const second = vi.fn();
    const focusSpy = vi.spyOn(HTMLElement.prototype, "focus");

    function Harness() {
      const [closeFn, setCloseFn] = useState(() => first);
      return (
        <div>
          <Probe label="harness" onClose={closeFn} />
          <button
            type="button"
            data-swap="1"
            onClick={() => setCloseFn(() => second)}
          />
        </div>
      );
    }

    const { unmount } = mount(<Harness />);
    const focusesAfterOpen = focusSpy.mock.calls.length;
    expect(focusesAfterOpen).toBeGreaterThanOrEqual(1);

    act(() => {
      document.querySelector<HTMLButtonElement>("[data-swap]")?.click();
    });
    expect(focusSpy.mock.calls.length).toBe(focusesAfterOpen);

    act(() => {
      dispatchEscape();
    });
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledOnce();

    focusSpy.mockRestore();
    unmount();
  });

  it("Strict Mode : un seul lock / couche après double montage", () => {
    const onClose = vi.fn();
    const { unmount } = mount(
      <StrictMode>
        <Probe onClose={onClose} label="strict" />
      </StrictMode>,
    );

    expect(getBodyScrollLockCountForTests()).toBe(1);
    expect(getStackedDialogDepthForTests()).toBe(1);
    expect(document.body.style.overflow).toBe("hidden");

    unmount();
    expect(getBodyScrollLockCountForTests()).toBe(0);
    expect(getStackedDialogDepthForTests()).toBe(0);
    expect(document.body.style.overflow).toBe("scroll");
  });

  it("fermeture complète restaure le scroll d’origine", () => {
    document.body.style.overflow = "auto";
    const onClose = vi.fn();

    function Harness() {
      const [open, setOpen] = useState(true);
      if (!open) return null;
      return (
        <Probe
          label="one"
          onClose={() => {
            onClose();
            setOpen(false);
          }}
        />
      );
    }

    const { unmount } = mount(<Harness />);
    expect(document.body.style.overflow).toBe("hidden");

    act(() => {
      dispatchEscape();
    });
    expect(onClose).toHaveBeenCalledOnce();
    expect(document.body.style.overflow).toBe("auto");

    unmount();
  });
});
