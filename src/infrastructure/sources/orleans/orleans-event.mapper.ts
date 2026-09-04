import type { DetourEvent } from "@/domain/event";
import type { OrleansRawEvent } from "./orleans-event.types";

export function mapOrleansEventToDetourEvent(
  rawEvent: OrleansRawEvent,
): DetourEvent | null {
  if (!rawEvent.uid || !rawEvent.title_fr || !rawEvent.firstdate_begin) {
    return null;
  }

  return {
    id: rawEvent.uid,
    title: rawEvent.title_fr.trim(),
    description: emptyToNull(rawEvent.description_fr),
    imageUrl: emptyToNull(rawEvent.image),
    startAt: rawEvent.firstdate_begin,
    endAt: emptyToNull(rawEvent.firstdate_end),
    venue: emptyToNull(rawEvent.location_name),
    city: emptyToNull(rawEvent.location_city),
    latitude: rawEvent.location_coordinates?.lat ?? null,
    longitude: rawEvent.location_coordinates?.lon ?? null,
    category: emptyToNull(rawEvent.categorie_principale),
    genre: null,
    conditions: emptyToNull(rawEvent.conditions_fr),
    source: emptyToNull(rawEvent.originagenda_title),
    sourceUrl: emptyToNull(rawEvent.canonicalurl),
    registrationUrl: extractRegistrationUrl(rawEvent.registration),
  };
}

function emptyToNull(value: string | null | undefined): string | null {
  if (value == null) return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

type OrleansRegistrationEntry = {
  type?: string;
  value?: string;
};

/** Extrait la première URL de type `link` depuis le JSON registration OpenAgenda. */
function extractRegistrationUrl(
  registration: string | null,
): string | null {
  if (!registration) return null;

  try {
    const parsed = JSON.parse(registration) as unknown;
    if (!Array.isArray(parsed)) return null;

    for (const entry of parsed) {
      if (!entry || typeof entry !== "object") continue;
      const { type, value } = entry as OrleansRegistrationEntry;
      if (type !== "link" || typeof value !== "string") continue;
      const url = value.trim();
      if (url.startsWith("http://") || url.startsWith("https://")) {
        return url;
      }
    }
  } catch {
    return null;
  }

  return null;
}
