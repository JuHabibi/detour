import { describe, expect, it } from "vitest";
import { resolveExplicitFrenchDateList } from "./french-dates";

const sourceRange = {
  sourceStart: { year: 2027, month: 7, day: 10 },
  sourceEnd: { year: 2027, month: 7, day: 24 },
};

describe("listes de dates françaises — contrat partagé entre sources", () => {
  it.each([
    ["Europe/Paris", "+02:00"],
    ["America/Montreal", "-04:00"],
  ])("utilise le fuseau fourni par la source : %s", (timeZone, offset) => {
    const result = resolveExplicitFrenchDateList({
      ...sourceRange, timeZone,
      texts: ["Les 10 et 24 juillet", "Séances les 24, 10 et 24 juillet 2027."],
    });
    expect(result).toEqual({ kind: "resolved", occurrences: [
      { startAt: `2027-07-10T00:00:00${offset}`, endAt: `2027-07-11T00:00:00${offset}`, allDay: true },
      { startAt: `2027-07-24T00:00:00${offset}`, endAt: `2027-07-25T00:00:00${offset}`, allDay: true },
    ] });
  });

  it.each([null, "Du 10 au 24 juillet 2027", "Tous les samedis de juillet"])(
    "ne fabrique pas de séances sans liste explicite : %s", (text) => {
      expect(resolveExplicitFrenchDateList({
        ...sourceRange, timeZone: "Europe/Paris", texts: [text],
      })).toEqual({ kind: "absent" });
    },
  );

  it("distingue une liste contradictoire d'une absence de liste", () => {
    expect(resolveExplicitFrenchDateList({
      ...sourceRange, timeZone: "Europe/Paris",
      texts: ["Les 10 et 24 juillet 2027", "Les 10, 17 et 24 juillet 2027"],
    })).toEqual({ kind: "inconsistent" });
  });

  it("ne choisit pas une année pour une source à cheval sur deux années", () => {
    expect(resolveExplicitFrenchDateList({
      sourceStart: { year: 2026, month: 12, day: 10 },
      sourceEnd: { year: 2027, month: 12, day: 24 },
      timeZone: "Europe/Paris", texts: ["Les 10 et 24 décembre"],
    })).toEqual({ kind: "inconsistent" });
  });

  it("rejette un fuseau invalide sans retomber sur celui d'une autre source", () => {
    expect(resolveExplicitFrenchDateList({
      ...sourceRange, timeZone: "invalid-zone", texts: ["Les 10 et 24 juillet 2027"],
    })).toEqual({ kind: "inconsistent" });
  });

  it("conserve les fins exclusives civiles à travers un changement d'heure", () => {
    const result = resolveExplicitFrenchDateList({
      sourceStart: { year: 2027, month: 3, day: 21 },
      sourceEnd: { year: 2027, month: 3, day: 28 },
      timeZone: "Europe/Paris", texts: ["Les dimanches 21 et 28 mars 2027"],
    });
    expect(result).toMatchObject({ kind: "resolved", occurrences: [
      { startAt: "2027-03-21T00:00:00+01:00", endAt: "2027-03-22T00:00:00+01:00" },
      { startAt: "2027-03-28T00:00:00+01:00", endAt: "2027-03-29T00:00:00+02:00" },
    ] });
  });
});
