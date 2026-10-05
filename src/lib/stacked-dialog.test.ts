// @vitest-environment happy-dom
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import {
  EVENT_DETAIL_TRIGGER_ATTR,
  acquireBodyScrollLock,
  eventDetailTriggerSelector,
  getBodyScrollLockCountForTests,
  getStackedDialogDepthForTests,
  isTopStackedDialogLayer,
  onStackedDialogEscape,
  pushStackedDialogLayer,
  releaseBodyScrollLock,
  resetStackedDialogStateForTests,
  restoreDialogFocusTriggerFirst,
  restoreDialogReturnFocus,
} from "@/lib/stacked-dialog";

describe("stacked-dialog", () => {
  beforeEach(() => {
    resetStackedDialogStateForTests();
  });

  afterEach(() => {
    resetStackedDialogStateForTests();
  });

  it("eventDetailTriggerSelector échappe les guillemets", () => {
    expect(eventDetailTriggerSelector('a"b')).toBe(
      `[${EVENT_DETAIL_TRIGGER_ATTR}="a\\"b"]`,
    );
  });

  it("Escape appelle onClose et stopImmediatePropagation", () => {
    const onClose = vi.fn();
    const preventDefault = vi.fn();
    const stopImmediatePropagation = vi.fn();
    onStackedDialogEscape(
      {
        key: "Escape",
        preventDefault,
        stopImmediatePropagation,
      } as unknown as KeyboardEvent,
      onClose,
    );
    expect(preventDefault).toHaveBeenCalledOnce();
    expect(stopImmediatePropagation).toHaveBeenCalledOnce();
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("ignore les autres touches", () => {
    const onClose = vi.fn();
    onStackedDialogEscape(
      {
        key: "Enter",
        preventDefault: vi.fn(),
        stopImmediatePropagation: vi.fn(),
      } as unknown as KeyboardEvent,
      onClose,
    );
    expect(onClose).not.toHaveBeenCalled();
  });

  it("scroll lock : refcount puis restauration de la valeur initiale", () => {
    document.body.style.overflow = "auto";
    acquireBodyScrollLock();
    expect(document.body.style.overflow).toBe("hidden");
    expect(getBodyScrollLockCountForTests()).toBe(1);

    acquireBodyScrollLock();
    expect(getBodyScrollLockCountForTests()).toBe(2);
    expect(document.body.style.overflow).toBe("hidden");

    releaseBodyScrollLock();
    expect(getBodyScrollLockCountForTests()).toBe(1);
    expect(document.body.style.overflow).toBe("hidden");

    releaseBodyScrollLock();
    expect(getBodyScrollLockCountForTests()).toBe(0);
    expect(document.body.style.overflow).toBe("auto");
  });

  it("pile : seul le sommet est top", () => {
    const a = pushStackedDialogLayer(() => undefined);
    const b = pushStackedDialogLayer(() => undefined);
    expect(isTopStackedDialogLayer(a.id)).toBe(false);
    expect(isTopStackedDialogLayer(b.id)).toBe(true);
    expect(getStackedDialogDepthForTests()).toBe(2);
    b.pop();
    expect(isTopStackedDialogLayer(a.id)).toBe(true);
    a.pop();
    expect(getStackedDialogDepthForTests()).toBe(0);
  });

  it("restoreDialogFocusTriggerFirst préfère le déclencheur au sélecteur", () => {
    const trigger = document.createElement("button");
    trigger.id = "trigger";
    document.body.appendChild(trigger);
    const fallback = document.createElement("button");
    fallback.id = "fallback";
    document.body.appendChild(fallback);

    const focused = restoreDialogFocusTriggerFirst(trigger, "#fallback");
    expect(focused).toBe(true);
    expect(document.activeElement).toBe(trigger);

    trigger.remove();
    fallback.remove();
  });

  it("restoreDialogReturnFocus : sélecteurs avant déclencheur", () => {
    const trigger = document.createElement("button");
    document.body.appendChild(trigger);
    const live = document.createElement("button");
    live.setAttribute("data-live", "1");
    document.body.appendChild(live);

    restoreDialogReturnFocus(trigger, '[data-live="1"]');
    expect(document.activeElement).toBe(live);

    trigger.remove();
    live.remove();
  });
});
