import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { onRouterTransitionStart } from "@/instrumentation-client";

describe("instrumentation-client (PostHog désactivé)", () => {
  it("n’importe ni n’initialise le SDK analytics", () => {
    const source = readFileSync(
      join(process.cwd(), "src/instrumentation-client.ts"),
      "utf8",
    );
    expect(source).not.toMatch(/from ["']posthog-js["']/);
    expect(source).not.toMatch(/\.init\s*\(/);
    expect(source).not.toMatch(/NEXT_PUBLIC_POSTHOG/);
  });

  it("expose un onRouterTransitionStart no-op", () => {
    expect(() => onRouterTransitionStart("/explorer")).not.toThrow();
  });
});
