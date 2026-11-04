import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("orleans/ce-week-end route", () => {
  it("force-dynamic pour basculer HTML/métadonnées dès le lundi (pas d’ISR 6h)", () => {
    const source = readFileSync(
      resolve(__dirname, "page.tsx"),
      "utf8",
    );
    expect(source).toMatch(/export const dynamic = "force-dynamic"/);
    expect(source).not.toMatch(/export const revalidate\s*=/);
  });
});
