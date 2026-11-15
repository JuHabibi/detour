import { describe, expect, it } from "vitest";
import { ingestionFromPlainEvents } from "@/application/ingestion/event-ingestion-result";
import { mapOrleansEventToDetourEvent } from "@/infrastructure/sources/orleans/orleans-event.mapper";
import type { OrleansRawEvent } from "@/infrastructure/sources/orleans/orleans-event.types";
import { mapSaranIcalEventToDetourEvent } from "@/infrastructure/sources/saran/saran-ical.mapper";
import type { SaranIcalEvent } from "@/infrastructure/sources/saran/saran-ical.types";
import { toAiHighlightEventInput } from "@/application/ai/highlight-assessment-input";
import { buildAiAssessmentEventCacheKey } from "@/application/ai/ai-assessment-cache-key";
import {
  AI_ASSESSMENT_DEFAULT_MODEL,
  AI_ASSESSMENT_DEFAULT_TEMPERATURE,
  AI_ASSESSMENT_PROMPT_VERSION,
} from "@/infrastructure/ai/openai-highlight-assessment.provider";

function rawOrleans(uid: string): OrleansRawEvent {
  return {
    uid,
    title_fr: "Concert test",
    description_fr: "Desc",
    image: null,
    firstdate_begin: "2026-11-12T20:00:00+02:00",
    firstdate_end: null,
    location_name: "Salle",
    location_city: "Orléans",
    location_coordinates: null,
    categorie_principale: "Concert",
    conditions_fr: null,
    originagenda_title: "Agenda Orléans",
    canonicalurl: "https://openagenda.com/example",
    registration: null,
    statut_evenement: null,
  };
}

function rawSaran(uid: string): SaranIcalEvent {
  return {
    uid,
    summary: "Événement Saran",
    description: null,
    location: "Mairie",
    url: null,
    dtStart: {
      kind: "date-time",
      year: 2026,
      month: 11,
      day: 12,
      hour: 20,
      minute: 0,
      second: 0,
      timeZone: "Europe/Paris",
    },
    dtEnd: null,
    lastModified: null,
  };
}

describe("mapOrleansEventToDetourEvent IDs namespacés", () => {
  it("importe le texte complet et lie l'évaluation à ce texte, indépendamment de la séance", () => {
    const raw = {
      ...rawOrleans("55237041"),
      title_fr: "Une ville de mots",
      description_fr: "cycle d'écriture hebdomadaire sur 6 semaines",
      conditions_fr: "70€ le cycle de 6 semaines, dégressif à partir de 3 ateliers",
    };
    const short = mapOrleansEventToDetourEvent(raw)!;
    const full = mapOrleansEventToDetourEvent({
      ...raw,
      longdescription_fr: "<p>Bertrand Runtz propose un atelier d’écriture en forme de déambulation autour du thème de la ville.</p>",
    })!;
    const description = "cycle d'écriture hebdomadaire sur 6 semaines. Bertrand Runtz propose un atelier d’écriture en forme de déambulation autour du thème de la ville.";
    expect(full.description).toBe(description);
    expect(full.conditions).toBe(raw.conditions_fr);
    const key = (event: typeof full) => buildAiAssessmentEventCacheKey({
      event,
      model: AI_ASSESSMENT_DEFAULT_MODEL,
      promptVersion: AI_ASSESSMENT_PROMPT_VERSION,
      generation: { temperature: AI_ASSESSMENT_DEFAULT_TEMPERATURE },
    });
    expect(toAiHighlightEventInput(full).description).toBe(description);
    expect(key(full)).not.toBe(key(short));
    const nextSession = {
      ...full,
      sourceDates: { startAt: full.startAt, endAt: full.endAt },
      startAt: "2027-05-13T12:00:00Z",
      endAt: "2027-05-13T14:00:00Z",
    };
    expect(toAiHighlightEventInput(nextSession)).toEqual(toAiHighlightEventInput(full));
    expect(key(nextSession)).toBe(key(full));
  });

  it.each([undefined, null, "", "<p>&nbsp;</p>"])("conserve le résumé si le texte complet est vide : %s", (longdescription_fr) => {
    expect(mapOrleansEventToDetourEvent({
      ...rawOrleans("fallback"),
      description_fr: "<p>Atelier d’écriture &amp; lecture.</p>",
      longdescription_fr,
    })?.description).toBe("Atelier d’écriture & lecture.");
  });

  it("ajoute le calendrier complet sans modifier l’identité ni la période historique", () => {
    const raw = rawOrleans("series");
    raw.timings = JSON.stringify([
      { begin: "2026-11-12T20:00:00+01:00", end: "2026-11-12T22:00:00+01:00" },
      { begin: "2026-11-27T20:00:00+01:00", end: "2026-11-27T22:00:00+01:00" },
    ]);
    const event = mapOrleansEventToDetourEvent(raw)!;
    expect(event.id).toBe("openagenda:series");
    expect(event.startAt).toBe(raw.firstdate_begin);
    expect(event.endAt).toBe(raw.firstdate_end);
    expect(event.occurrences).toHaveLength(2);
  });

  it("préfixe l’ID OpenAgenda : openagenda:<externalId>", () => {
    const event = mapOrleansEventToDetourEvent(rawOrleans("7937057"));
    expect(event).not.toBeNull();
    expect(event!.id).toBe("openagenda:7937057");
  });

  it("même externalId brut Orléans vs Saran → DetourEvent.id distincts", () => {
    const orleans = mapOrleansEventToDetourEvent(rawOrleans("shared-uid"));
    const saran = mapSaranIcalEventToDetourEvent(rawSaran("shared-uid"));

    expect(orleans).not.toBeNull();
    expect(saran).not.toBeNull();
    expect(orleans!.id).toBe("openagenda:shared-uid");
    expect(saran!.id).toBe("saran:shared-uid");
    expect(orleans!.id).not.toBe(saran!.id);
  });

  it("provenance adapterByEventId suit l’ID préfixé", () => {
    const event = mapOrleansEventToDetourEvent(rawOrleans("42"))!;
    const ingestion = ingestionFromPlainEvents(
      [event],
      "orleans",
      "Orléans / OpenAgenda",
    );

    expect(ingestion.adapterByEventId.get("openagenda:42")).toBe("orleans");
    expect(ingestion.adapterByEventId.has("42")).toBe(false);
  });
});
