import { describe, expect, it } from "vitest";
import {
  isLegalPublisherReady,
  legalPublisher,
  type LegalPublisher,
} from "@/config/legal-publisher";

describe("legalPublisher", () => {
  it("reste non configuré tant que l’éditeur n’a pas fourni d’identité", () => {
    expect(legalPublisher).toBeNull();
    expect(isLegalPublisherReady()).toBe(false);
  });

  it("exige un nom et un e-mail non vides", () => {
    const incomplete: LegalPublisher = {
      name: "  ",
      legalStatus: null,
      registrationNumber: null,
      addressLines: null,
      email: "a@b.fr",
      publicationDirector: null,
    };
    expect(isLegalPublisherReady(incomplete)).toBe(false);

    const ready: LegalPublisher = {
      name: "Éditeur Confirmé",
      legalStatus: null,
      registrationNumber: null,
      addressLines: null,
      email: "hello@detour.website",
      publicationDirector: null,
    };
    expect(isLegalPublisherReady(ready)).toBe(true);
  });
});
