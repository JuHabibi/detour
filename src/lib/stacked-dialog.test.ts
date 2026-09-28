import { describe, expect, it, vi } from "vitest";
import {
  EVENT_DETAIL_TRIGGER_ATTR,
  eventDetailTriggerSelector,
  onStackedDialogEscape,
} from "@/lib/stacked-dialog";

describe("stacked-dialog", () => {
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
});
