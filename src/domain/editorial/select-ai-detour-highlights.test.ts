import { describe, expect, it } from "vitest";
import type { AiHighlightAssessment } from "@/domain/editorial/highlight-assessment";
import type { DetourEvent } from "@/domain/events/event";
import {
  applyLightDiversity,
  buildAiDetourSlotSequence,
  buildRadarDiscoveryKey,
  easyToMissScore,
  rareLocalScore,
  selectAiDetourHighlights,
  strongEventScore,
  wildcardSlotScore,
  worthPlanningScore,
  type AssessedCandidate,
} from "@/domain/editorial/select-ai-detour-highlights";
import type { EventHighlight } from "@/domain/editorial/select-detour-highlights";
import { deduplicateEvents } from "@/domain/events/deduplicate-events";

function event(id: string, title = id): DetourEvent {
  return {
    id,
    title,
    description: null,
    imageUrl: null,
    startAt: "2026-11-12T20:00:00+02:00",
    endAt: null,
    venue: "Salle",
    city: "Orléans",
    latitude: null,
    longitude: null,
    category: "Spectacle",
    genre: null,
    conditions: null,
    source: "Agenda",
    sourceUrl: null,
    registrationUrl: "https://example.com/book",
    relevance: "culture",
  };
}

function candidate(id: string, title?: string): EventHighlight {
  return {
    event: event(id, title),
    score: 5,
    planningScore: 1,
    reasons: ["headline-appeal"],
  };
}

function assessment(
  eventId: string,
  scores: Partial<
    Pick<
      AiHighlightAssessment,
      | "appeal"
      | "missRisk"
      | "planningNeed"
      | "localRarity"
      | "likelyDemand"
      | "confidence"
    >
  >,
): AiHighlightAssessment {
  return {
    eventId,
    appeal: scores.appeal ?? 0,
    missRisk: scores.missRisk ?? 0,
    planningNeed: scores.planningNeed ?? 0,
    localRarity: scores.localRarity ?? 0,
    likelyDemand: scores.likelyDemand ?? 0,
    confidence: scores.confidence ?? 0.8,
    reasons: ["test"],
  };
}

describe("selectAiDetourHighlights", () => {
  it("événement très connu mais peu rare localement → strong-event, pas rare-local", () => {
    const knownBigVenue = assessment("star", {
      appeal: 5,
      likelyDemand: 5,
      planningNeed: 2,
      localRarity: 1,
      missRisk: 1,
    });
    // localRarity haute, missRisk basse → survit jusqu’au slot rare-local
    const rare = assessment("rare", {
      appeal: 4,
      localRarity: 5,
      likelyDemand: 3,
      missRisk: 0,
      planningNeed: 0,
    });

    const highlights = selectAiDetourHighlights(
      [
        candidate("star"),
        candidate("miss"),
        candidate("miss2"),
        candidate("plan"),
        candidate("rare"),
        candidate("wild"),
      ],
      [
        knownBigVenue,
        assessment("miss", { appeal: 3, missRisk: 5, localRarity: 2 }),
        assessment("miss2", { appeal: 3, missRisk: 4, localRarity: 2 }),
        assessment("plan", { appeal: 2, planningNeed: 5, likelyDemand: 2 }),
        rare,
        assessment("wild", {
          appeal: 2,
          missRisk: 2,
          planningNeed: 2,
          localRarity: 2,
          likelyDemand: 2,
        }),
      ],
      { limit: 6 },
    );

    expect(highlights[0]?.slot).toBe("strong-event");
    expect(highlights[0]?.event.id).toBe("star");
    expect(highlights[0]?.score).toBe(strongEventScore(knownBigVenue));

    const rareSlot = highlights.find((item) => item.slot === "rare-local");
    expect(rareSlot?.event.id).toBe("rare");
    expect(rareSlot?.score).toBe(rareLocalScore(rare));
    expect(rareLocalScore(rare)).toBeGreaterThan(
      rareLocalScore(knownBigVenue),
    );
  });

  it("artiste connu dans une petite commune → localRarity élevée gagne rare-local", () => {
    // missRisk volontairement basse pour ne pas être pris en easy-to-miss
    const checy = assessment("checy", {
      appeal: 5,
      localRarity: 5,
      likelyDemand: 4,
      planningNeed: 1,
      missRisk: 1,
    });
    const orleansHall = assessment("orleans", {
      appeal: 5,
      localRarity: 1,
      likelyDemand: 5,
      planningNeed: 2,
      missRisk: 1,
    });

    const highlights = selectAiDetourHighlights(
      [
        candidate("orleans"),
        candidate("checy"),
        candidate("m1"),
        candidate("m2"),
        candidate("plan"),
        candidate("wild"),
      ],
      [
        orleansHall,
        checy,
        assessment("m1", { appeal: 3, missRisk: 5, localRarity: 2 }),
        assessment("m2", { appeal: 3, missRisk: 5, localRarity: 1 }),
        assessment("plan", { appeal: 2, planningNeed: 5, likelyDemand: 1 }),
        assessment("wild", {
          appeal: 1,
          missRisk: 1,
          planningNeed: 1,
          localRarity: 1,
          likelyDemand: 1,
        }),
      ],
      { limit: 6 },
    );

    expect(highlights[0]?.event.id).toBe("orleans");
    const rareSlot = highlights.find((item) => item.slot === "rare-local");
    expect(rareSlot?.event.id).toBe("checy");
    expect(rareLocalScore(checy)).toBeGreaterThan(rareLocalScore(orleansHall));
  });

  it("petit événement peu connu mais fort missRisk → easy-to-miss", () => {
    const hidden = assessment("hidden", {
      appeal: 4,
      missRisk: 5,
      localRarity: 3,
      likelyDemand: 0,
      planningNeed: 1,
    });

    const highlights = selectAiDetourHighlights(
      [
        candidate("star"),
        candidate("hidden"),
        candidate("plan"),
        candidate("rare"),
        candidate("w1"),
        candidate("w2"),
      ],
      [
        assessment("star", {
          appeal: 5,
          likelyDemand: 5,
          planningNeed: 1,
          missRisk: 0,
        }),
        hidden,
        assessment("plan", { appeal: 2, planningNeed: 5, likelyDemand: 2 }),
        assessment("rare", { appeal: 2, localRarity: 5, likelyDemand: 1 }),
        assessment("w1", { appeal: 2, missRisk: 2 }),
        assessment("w2", { appeal: 1, missRisk: 1 }),
      ],
      { limit: 6 },
    );

    const easyMiss = highlights.filter((item) => item.slot === "easy-to-miss");
    expect(easyMiss.some((item) => item.event.id === "hidden")).toBe(true);
    expect(easyToMissScore(hidden)).toBe(5 * 2 + 4 + 3);
  });

  it("événement à forte planningNeed → worth-planning", () => {
    const plan = assessment("plan", {
      appeal: 3,
      planningNeed: 5,
      likelyDemand: 3,
      missRisk: 1,
      localRarity: 1,
    });

    const highlights = selectAiDetourHighlights(
      [
        candidate("star"),
        candidate("miss"),
        candidate("miss2"),
        candidate("plan"),
        candidate("rare"),
        candidate("w1"),
      ],
      [
        assessment("star", { appeal: 5, likelyDemand: 5, planningNeed: 1 }),
        assessment("miss", { appeal: 3, missRisk: 5, localRarity: 2 }),
        assessment("miss2", { appeal: 2, missRisk: 4, localRarity: 1 }),
        plan,
        assessment("rare", { appeal: 2, localRarity: 5, likelyDemand: 1 }),
        assessment("w1", { appeal: 2, missRisk: 2 }),
      ],
      { limit: 6 },
    );

    const planning = highlights.find((item) => item.slot === "worth-planning");
    expect(planning?.event.id).toBe("plan");
    expect(planning?.score).toBe(worthPlanningScore(plan));
  });

  it("aucun doublon dans les 6 slots", () => {
    const highlights = selectAiDetourHighlights(
      ["a", "b", "c", "d", "e", "f"].map((id) => candidate(id)),
      [
        assessment("a", {
          appeal: 5,
          likelyDemand: 5,
          planningNeed: 5,
          missRisk: 5,
          localRarity: 5,
        }),
        assessment("b", {
          appeal: 4,
          likelyDemand: 4,
          planningNeed: 4,
          missRisk: 4,
          localRarity: 4,
        }),
        assessment("c", {
          appeal: 3,
          likelyDemand: 3,
          planningNeed: 3,
          missRisk: 3,
          localRarity: 3,
        }),
        assessment("d", {
          appeal: 2,
          likelyDemand: 2,
          planningNeed: 2,
          missRisk: 2,
          localRarity: 2,
        }),
        assessment("e", {
          appeal: 2,
          likelyDemand: 2,
          planningNeed: 2,
          missRisk: 2,
          localRarity: 2,
        }),
        assessment("f", {
          appeal: 1,
          likelyDemand: 1,
          planningNeed: 1,
          missRisk: 1,
          localRarity: 1,
        }),
      ],
      { limit: 6 },
    );

    const ids = highlights.map((item) => item.event.id);
    expect(ids).toHaveLength(6);
    expect(new Set(ids).size).toBe(6);
  });

  it("aucun assessment → [] (fallback appelant)", () => {
    expect(
      selectAiDetourHighlights([candidate("a")], [], { limit: 6 }),
    ).toEqual([]);
  });

  it("ignore les candidats sans assessment", () => {
    const highlights = selectAiDetourHighlights(
      [candidate("only"), candidate("missing")],
      [assessment("only", { appeal: 4, likelyDemand: 4, planningNeed: 2 })],
      { limit: 6 },
    );

    expect(highlights).toHaveLength(1);
    expect(highlights[0]?.event.id).toBe("only");
    expect(highlights[0]?.slot).toBe("strong-event");
  });

  it("limit 6 → 1 strong / 2 easy-to-miss / 1 planning / 1 rare-local / 1 wildcard", () => {
    expect(buildAiDetourSlotSequence(6)).toEqual([
      "strong-event",
      "easy-to-miss",
      "easy-to-miss",
      "worth-planning",
      "rare-local",
      "wildcard",
    ]);

    const pool = ["a", "b", "c", "d", "e", "f", "g"].map((id) => candidate(id));
    const assessments = [
      assessment("a", { appeal: 5, likelyDemand: 5, planningNeed: 1 }),
      assessment("b", { appeal: 3, missRisk: 5, localRarity: 2 }),
      assessment("c", { appeal: 3, missRisk: 4, localRarity: 2 }),
      assessment("d", { appeal: 2, planningNeed: 5, likelyDemand: 2 }),
      assessment("e", { appeal: 2, localRarity: 5, likelyDemand: 2 }),
      assessment("f", {
        appeal: 2,
        missRisk: 2,
        planningNeed: 2,
        localRarity: 2,
        likelyDemand: 2,
      }),
      assessment("g", { appeal: 1, missRisk: 1 }),
    ];

    const highlights = selectAiDetourHighlights(pool, assessments, {
      limit: 6,
    });

    expect(highlights).toHaveLength(6);
    expect(new Set(highlights.map((item) => item.event.id)).size).toBe(6);
    expect(highlights.map((item) => item.slot)).toEqual([
      "strong-event",
      "easy-to-miss",
      "easy-to-miss",
      "worth-planning",
      "rare-local",
      "wildcard",
    ]);
  });

  it("limit 10 → 2 de chaque slot (sans doublon)", () => {
    expect(buildAiDetourSlotSequence(10)).toEqual([
      "strong-event",
      "strong-event",
      "easy-to-miss",
      "easy-to-miss",
      "worth-planning",
      "worth-planning",
      "rare-local",
      "rare-local",
      "wildcard",
      "wildcard",
    ]);

    const ids = Array.from({ length: 12 }, (_, i) => `e${i}`);
    const assessments = ids.map((id, index) =>
      assessment(id, {
        appeal: 5 - Math.min(index, 4),
        likelyDemand: 5 - Math.min(index, 4),
        missRisk: index % 2 === 0 ? 4 : 3,
        planningNeed: index % 3 === 0 ? 4 : 3,
        localRarity: index % 2 === 1 ? 4 : 3,
      }),
    );

    const highlights = selectAiDetourHighlights(
      ids.map((id) => candidate(id)),
      assessments,
      { limit: 10 },
    );

    expect(highlights).toHaveLength(10);
    expect(new Set(highlights.map((item) => item.event.id)).size).toBe(10);

    const counts = highlights.reduce(
      (acc, item) => {
        const slot = item.slot ?? "unknown";
        acc[slot] = (acc[slot] ?? 0) + 1;
        return acc;
      },
      {} as Record<string, number>,
    );

    expect(counts["strong-event"]).toBe(2);
    expect(counts["easy-to-miss"]).toBe(2);
    expect(counts["worth-planning"]).toBe(2);
    expect(counts["rare-local"]).toBe(2);
    expect(counts.wildcard).toBe(2);
  });

  it("slot thématique faible → remplissage wildcard plutôt que quota forcé", () => {
    const highlights = selectAiDetourHighlights(
      ["star", "weak-rare", "w1", "w2"].map((id) => candidate(id)),
      [
        assessment("star", { appeal: 5, likelyDemand: 5, planningNeed: 1 }),
        // localRarity trop bas pour rare-local (floor = 2)
        assessment("weak-rare", {
          appeal: 4,
          localRarity: 1,
          likelyDemand: 4,
          missRisk: 1,
          planningNeed: 1,
        }),
        assessment("w1", {
          appeal: 3,
          missRisk: 3,
          planningNeed: 3,
          localRarity: 1,
          likelyDemand: 3,
        }),
        assessment("w2", {
          appeal: 3,
          missRisk: 2,
          planningNeed: 2,
          localRarity: 1,
          likelyDemand: 2,
        }),
      ],
      { limit: 4 },
    );

    expect(highlights.map((item) => item.slot)).not.toContain("rare-local");
    expect(highlights.some((item) => item.slot === "wildcard")).toBe(true);
    expect(new Set(highlights.map((item) => item.event.id)).size).toBe(
      highlights.length,
    );
  });

  it("aucune dépendance avec relevance ou taxonomy (scores seuls)", () => {
    const outOfScope = candidate("x");
    outOfScope.event = {
      ...outOfScope.event,
      relevance: "out_of_scope",
      category: "Autre",
    };

    const highlights = selectAiDetourHighlights(
      [outOfScope],
      [assessment("x", { appeal: 5, likelyDemand: 4, planningNeed: 2 })],
      { limit: 1 },
    );

    expect(highlights).toHaveLength(1);
    expect(highlights[0]?.event.relevance).toBe("out_of_scope");
    expect(highlights[0]?.event.category).toBe("Autre");
  });

  it("diversité : 3e event même venue écarté si alternative proche", () => {
    const a = poolItem("a", "Passerelle", "Fleury", {
      appeal: 4,
      missRisk: 4,
      planningNeed: 4,
      localRarity: 4,
      likelyDemand: 4,
    }, 0);
    const b = poolItem("b", "Passerelle", "Fleury", {
      appeal: 4,
      missRisk: 3,
      planningNeed: 3,
      localRarity: 3,
      likelyDemand: 3,
    }, 1);
    const c = poolItem("c", "Passerelle", "Fleury", {
      appeal: 3,
      missRisk: 3,
      planningNeed: 3,
      localRarity: 3,
      likelyDemand: 3,
    }, 2);
    const alt = poolItem("alt", "Autre salle", "Orléans", {
      appeal: 3,
      missRisk: 3,
      planningNeed: 3,
      localRarity: 3,
      likelyDemand: 2,
    }, 3);

    const selected = [
      selectedHighlight(a, "wildcard"),
      selectedHighlight(b, "wildcard"),
      selectedHighlight(c, "wildcard"),
    ];

    const diversified = applyLightDiversity(selected, [a, b, c, alt]);
    expect(diversified.map((item) => item.event.id)).toEqual([
      "a",
      "b",
      "alt",
    ]);
    expect(diversified[2]?.event.venue).toBe("Autre salle");
  });

  it("diversité : candidat nettement meilleur conservé malgré concentration", () => {
    const a = poolItem("a", "Passerelle", "Fleury", {
      appeal: 5,
      missRisk: 5,
      planningNeed: 5,
      localRarity: 5,
      likelyDemand: 5,
    }, 0);
    const b = poolItem("b", "Passerelle", "Fleury", {
      appeal: 4,
      missRisk: 4,
      planningNeed: 4,
      localRarity: 4,
      likelyDemand: 4,
    }, 1);
    // Score combiné 25 vs alt 12 → écart > tolérance (2)
    const c = poolItem("c", "Passerelle", "Fleury", {
      appeal: 5,
      missRisk: 5,
      planningNeed: 5,
      localRarity: 5,
      likelyDemand: 5,
    }, 2);
    const weakAlt = poolItem("weak", "Autre salle", "Orléans", {
      appeal: 2,
      missRisk: 2,
      planningNeed: 2,
      localRarity: 2,
      likelyDemand: 2,
    }, 3);

    const selected = [
      selectedHighlight(a, "wildcard"),
      selectedHighlight(b, "wildcard"),
      selectedHighlight(c, "wildcard"),
    ];

    const diversified = applyLightDiversity(selected, [a, b, c, weakAlt]);
    expect(diversified.map((item) => item.event.id)).toEqual(["a", "b", "c"]);
  });

  it("diversité : pas de doublon si l’alternative existe déjà plus loin dans selected", () => {
    const a = poolItem(
      "a",
      "Passerelle",
      "Fleury",
      {
        appeal: 4,
        missRisk: 4,
        planningNeed: 4,
        localRarity: 4,
        likelyDemand: 4,
      },
      0,
    );
    const b = poolItem(
      "b",
      "Passerelle",
      "Fleury",
      {
        appeal: 4,
        missRisk: 3,
        planningNeed: 3,
        localRarity: 3,
        likelyDemand: 3,
      },
      1,
    );
    // 3e même venue → remplacé par "dup" qui est aussi plus loin dans selected
    const c = poolItem(
      "c",
      "Passerelle",
      "Fleury",
      {
        appeal: 3,
        missRisk: 3,
        planningNeed: 3,
        localRarity: 3,
        likelyDemand: 3,
      },
      2,
    );
    const dup = poolItem(
      "dup",
      "Autre salle",
      "Orléans",
      {
        appeal: 3,
        missRisk: 3,
        planningNeed: 3,
        localRarity: 3,
        likelyDemand: 2,
      },
      3,
    );
    // Remplissage quand on saute le doublon plus loin
    const filler = poolItem(
      "filler",
      "Troisième lieu",
      "Saran",
      {
        appeal: 3,
        missRisk: 3,
        planningNeed: 2,
        localRarity: 3,
        likelyDemand: 2,
      },
      4,
    );

    const selected = [
      selectedHighlight(a, "wildcard"),
      selectedHighlight(b, "wildcard"),
      selectedHighlight(c, "wildcard"),
      selectedHighlight(dup, "wildcard"),
    ];

    const diversified = applyLightDiversity(selected, [a, b, c, dup, filler]);
    const ids = diversified.map((item) => item.event.id);

    expect(ids.filter((id) => id === "dup")).toHaveLength(1);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toHaveLength(4);
    expect(ids).toEqual(["a", "b", "dup", "filler"]);
  });
});

describe("buildRadarDiscoveryKey", () => {
  it("regroupe titre spécifique + même venue", () => {
    const a = event("r1", "Les règles du jeu");
    a.venue = "Espace Béraire";
    const b = event("r2", "Les règles du jeu");
    b.venue = "Espace Béraire";
    expect(buildRadarDiscoveryKey(a)).toBe(buildRadarDiscoveryKey(b));
    expect(buildRadarDiscoveryKey(a)).toBe(
      "les regles du jeu::espace beraire",
    );
  });

  it("sépare Duo Zéphyr CD Live et Floréales", () => {
    const cd = event(
      "z1",
      "Duo Zéphyr - 2 concerts dans le cadre de l'enregistrement d'un CD Live",
    );
    cd.venue = "Maison des Jeunes et de la Culture d'Olivet (MJC)";
    const flor = event(
      "z2",
      'Duo Zéphyr à la résidence sociale "Les Floréales"',
    );
    flor.venue = 'Résidence sociale "Les Floréales"';
    expect(buildRadarDiscoveryKey(cd)).not.toBe(buildRadarDiscoveryKey(flor));
  });

  it("titre générique / court → clé singleton par id", () => {
    const a = event("i1", "Imagine");
    a.venue = "Salle A";
    const b = event("i2", "Imagine");
    b.venue = "Salle A";
    expect(buildRadarDiscoveryKey(a)).toBe("id:i1");
    expect(buildRadarDiscoveryKey(b)).toBe("id:i2");
  });
});

describe("diversité découverte éditoriale", () => {
  const strongScores = {
    appeal: 4,
    missRisk: 4,
    planningNeed: 4,
    localRarity: 4,
    likelyDemand: 4,
  } as const;

  it("Les règles du jeu ×2 même venue → max 1 dans le Radar", () => {
    const s1 = poolItem(
      "regles-1",
      "Espace Béraire",
      "La Chapelle-Saint-Mesmin",
      strongScores,
      0,
      { title: "Les règles du jeu", startAt: "2026-11-28T20:30:00+01:00" },
    );
    const s2 = poolItem(
      "regles-2",
      "Espace Béraire",
      "La Chapelle-Saint-Mesmin",
      strongScores,
      1,
      { title: "Les règles du jeu", startAt: "2026-11-29T15:00:00+01:00" },
    );
    const other = poolItem(
      "other",
      "Autre salle",
      "Orléans",
      {
        appeal: 3,
        missRisk: 3,
        planningNeed: 3,
        localRarity: 3,
        likelyDemand: 3,
      },
      2,
      { title: "Autre spectacle distinct" },
    );

    const selected = [
      selectedHighlight(s1, "worth-planning"),
      selectedHighlight(s2, "worth-planning"),
    ];
    const diversified = applyLightDiversity(selected, [s1, s2, other]);
    const ids = diversified.map((item) => item.event.id);

    expect(ids).toHaveLength(2);
    expect(ids).toContain("regles-1");
    expect(ids).toContain("other");
    expect(ids).not.toContain("regles-2");
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("même découverte sans saturation venue → toujours max 1", () => {
    const s1 = poolItem(
      "regles-1",
      "Espace Béraire",
      "La Chapelle-Saint-Mesmin",
      strongScores,
      0,
      { title: "Les règles du jeu", startAt: "2026-11-28T20:30:00+01:00" },
    );
    const s2 = poolItem(
      "regles-2",
      "Espace Béraire",
      "La Chapelle-Saint-Mesmin",
      strongScores,
      1,
      { title: "Les règles du jeu", startAt: "2026-11-29T15:00:00+01:00" },
    );

    const diversified = applyLightDiversity(
      [
        selectedHighlight(s1, "worth-planning"),
        selectedHighlight(s2, "worth-planning"),
      ],
      [s1, s2],
    );

    expect(diversified).toHaveLength(1);
    expect(diversified[0]?.event.id).toBe("regles-1");
  });

  it("Duo Zéphyr CD Live vs Floréales → les deux peuvent rester", () => {
    const cd = poolItem(
      "zephyr-cd",
      "Maison des Jeunes et de la Culture d'Olivet (MJC)",
      "Olivet",
      strongScores,
      0,
      {
        title:
          "Duo Zéphyr - 2 concerts dans le cadre de l'enregistrement d'un CD Live",
      },
    );
    const flor = poolItem(
      "zephyr-flor",
      'Résidence sociale "Les Floréales"',
      "Olivet",
      strongScores,
      1,
      { title: 'Duo Zéphyr à la résidence sociale "Les Floréales"' },
    );

    const diversified = applyLightDiversity(
      [selectedHighlight(cd, "wildcard"), selectedHighlight(flor, "wildcard")],
      [cd, flor],
    );

    expect(diversified.map((item) => item.event.id).sort()).toEqual([
      "zephyr-cd",
      "zephyr-flor",
    ]);
  });

  it("même titre spécifique, venues différentes → restent distincts", () => {
    const a = poolItem(
      "tour-a",
      "Salle Alpha",
      "Orléans",
      strongScores,
      0,
      { title: "Les règles du jeu" },
    );
    const b = poolItem(
      "tour-b",
      "Salle Beta",
      "Orléans",
      strongScores,
      1,
      { title: "Les règles du jeu" },
    );

    const diversified = applyLightDiversity(
      [selectedHighlight(a, "wildcard"), selectedHighlight(b, "wildcard")],
      [a, b],
    );

    expect(diversified.map((item) => item.event.id).sort()).toEqual([
      "tour-a",
      "tour-b",
    ]);
  });

  it("titre générique identique → ne fusionne pas automatiquement", () => {
    const a = poolItem("img-1", "Espace Béraire", "Chapelle", strongScores, 0, {
      title: "Imagine",
    });
    const b = poolItem("img-2", "Espace Béraire", "Chapelle", strongScores, 1, {
      title: "Imagine",
    });

    const diversified = applyLightDiversity(
      [selectedHighlight(a, "wildcard"), selectedHighlight(b, "wildcard")],
      [a, b],
    );

    expect(diversified.map((item) => item.event.id).sort()).toEqual([
      "img-1",
      "img-2",
    ]);
  });

  it("Explorer / deduplicateEvents : deux séances Règles restent distinctes", () => {
    const result = deduplicateEvents([
      {
        ...event("regles-1", "Les règles du jeu"),
        venue: "Espace Béraire",
        city: "La Chapelle-Saint-Mesmin",
        startAt: "2026-11-28T20:30:00+01:00",
      },
      {
        ...event("regles-2", "Les règles du jeu"),
        venue: "Espace Béraire",
        city: "La Chapelle-Saint-Mesmin",
        startAt: "2026-11-29T15:00:00+01:00",
      },
    ]);

    expect(result.events).toHaveLength(2);
    expect(result.duplicates).toHaveLength(0);
  });

  it("selectAiDetourHighlights : eventIds uniques et max 1 découverte Règles", () => {
    const fillers = Array.from({ length: 8 }, (_, i) => {
      const id = `f${i}`;
      return {
        cand: candidate(id, `Spectacle filler numéro ${i} unique`),
        assess: assessment(id, {
          appeal: 3,
          missRisk: 3,
          planningNeed: 2,
          localRarity: 2,
          likelyDemand: 2,
        }),
      };
    });

    const regles1 = {
      ...candidate("regles-1", "Les règles du jeu"),
      event: {
        ...event("regles-1", "Les règles du jeu"),
        venue: "Espace Béraire",
        city: "La Chapelle-Saint-Mesmin",
        startAt: "2026-11-28T20:30:00+01:00",
      },
    };
    const regles2 = {
      ...candidate("regles-2", "Les règles du jeu"),
      event: {
        ...event("regles-2", "Les règles du jeu"),
        venue: "Espace Béraire",
        city: "La Chapelle-Saint-Mesmin",
        startAt: "2026-11-29T15:00:00+01:00",
      },
    };

    // Scores élevés sur worth-planning pour forcer les deux séances en pré-diversité
    const reglesAssess = {
      appeal: 3,
      missRisk: 2,
      planningNeed: 5,
      localRarity: 2,
      likelyDemand: 3,
    };

    const highlights = selectAiDetourHighlights(
      [regles1, regles2, ...fillers.map((f) => f.cand)],
      [
        assessment("regles-1", reglesAssess),
        assessment("regles-2", reglesAssess),
        ...fillers.map((f) => f.assess),
      ],
      { limit: 10 },
    );

    const ids = highlights.map((h) => h.event.id);
    expect(new Set(ids).size).toBe(ids.length);

    const reglesCount = ids.filter((id) => id.startsWith("regles-")).length;
    expect(reglesCount).toBeLessThanOrEqual(1);
  });
});

function poolItem(
  id: string,
  venue: string,
  city: string,
  scores: Partial<
    Pick<
      AiHighlightAssessment,
      | "appeal"
      | "missRisk"
      | "planningNeed"
      | "localRarity"
      | "likelyDemand"
      | "confidence"
    >
  >,
  index: number,
  extras?: { title?: string; startAt?: string },
): AssessedCandidate {
  const base = candidate(id, extras?.title);
  return {
    candidate: {
      ...base,
      event: {
        ...base.event,
        venue,
        city,
        ...(extras?.startAt ? { startAt: extras.startAt } : {}),
      },
    },
    assessment: assessment(id, scores),
    index,
  };
}

function selectedHighlight(
  item: AssessedCandidate,
  slot: "wildcard" | "worth-planning",
): EventHighlight {
  const score =
    slot === "worth-planning"
      ? worthPlanningScore(item.assessment)
      : wildcardSlotScore(item.assessment);
  return {
    ...item.candidate,
    score,
    slot,
    selectionSource: "ai",
    aiSelection: {
      formula: slot === "worth-planning" ? "worth-planning" : "wildcard",
      slotScore: score,
      appeal: item.assessment.appeal,
      missRisk: item.assessment.missRisk,
      planningNeed: item.assessment.planningNeed,
      localRarity: item.assessment.localRarity,
      likelyDemand: item.assessment.likelyDemand,
      confidence: item.assessment.confidence,
      aiReasons: item.assessment.reasons,
    },
  };
}
