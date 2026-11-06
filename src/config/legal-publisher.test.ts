import { describe, expect, it } from "vitest";
import {
  isLegalPublisherReady,
  legalPublisher,
  type LegalPublisher,
} from "@/config/legal-publisher";

describe("legalPublisher", () => {
  it("est configuré pour la confidentialité (identité + contact)", () => {
    expect(legalPublisher.name).toBe("Julien Habibi");
    expect(legalPublisher.email).toBe("detour.orleans@gmail.com");
    expect(isLegalPublisherReady()).toBe(true);
  });

  it("exige un nom et un e-mail non vides", () => {
    const incomplete: LegalPublisher = {
      name: "  ",
      email: "a@b.fr",
    };
    expect(isLegalPublisherReady(incomplete)).toBe(false);

    const ready: LegalPublisher = {
      name: "Éditeur Confirmé",
      email: "hello@detour.website",
    };
    expect(isLegalPublisherReady(ready)).toBe(true);
  });
});
