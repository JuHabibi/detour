import { describe, expect, it } from "vitest";
import * as groups from "@/application/groups";

describe("application/groups", () => {
  it("expose l’API ownership-scopée pour DET-17/18 (actions)", () => {
    expect(typeof groups.createGroupForUser).toBe("function");
    expect(typeof groups.listGroupsForUser).toBe("function");
    expect(typeof groups.getGroupWithEventsForUser).toBe("function");
    expect(typeof groups.renameGroupForUser).toBe("function");
    expect(typeof groups.deleteGroupForUser).toBe("function");
    expect(typeof groups.addEventToGroupForUser).toBe("function");
    expect(typeof groups.addEventsToGroupForUser).toBe("function");
    expect(typeof groups.createGroupWithEventsForUser).toBe("function");
    expect(typeof groups.removeEventFromGroupForUser).toBe("function");
    expect(typeof groups.normalizeEventIds).toBe("function");
  });
});
