/**
 * État URL Explorer — source de vérité des filtres (hors cursor pagination).
 * `when=range` exige `from`+`to` (overlap bounded). Presets n’embarquent pas de dates.
 */

import {
  EXPLORER_AUDIENCE_JEUNE_PUBLIC,
  type ExplorerAudienceId,
} from "@/domain/events/audience-jeune-public";
import type { DetourCategory } from "@/domain/events/classify-event-category";
import { V1_COMMUNES, type V1Commune } from "@/domain/geo/v1-communes";
import { isParisDateKey, type WhenFilter } from "@/domain/time/when-filter";
import {
  isExplorerAudience,
  isWhenFilter,
  parseExplorerCategoryParam,
} from "@/application/explorer/explorer-public-query";
import type { CategoryId } from "@/data/types";

export type ExplorerUrlState = {
  when: WhenFilter;
  from: string | null;
  to: string | null;
  q: string;
  city: V1Commune | null;
  category: CategoryId;
  /** Facette audience indépendante (`audience=jeune_public`). */
  audience: ExplorerAudienceId | null;
};

export const EXPLORER_URL_DEFAULTS: ExplorerUrlState = {
  when: "weekend",
  from: null,
  to: null,
  q: "",
  city: null,
  category: "tout",
  audience: null,
};

const PRESET_WHENS: readonly WhenFilter[] = [
  "today",
  "tomorrow",
  "weekend",
  "next-week",
  "this-month",
  "next-month",
  "upcoming",
] as const;

function firstParam(
  value: string | string[] | undefined | null,
): string | undefined {
  if (value == null) return undefined;
  const raw = Array.isArray(value) ? value[0] : value;
  if (raw == null || raw === "") return undefined;
  return raw;
}

export function parseExplorerUrlState(
  params: Record<string, string | string[] | undefined>,
): ExplorerUrlState {
  const rawWhen = firstParam(params.when);
  const rawFrom = firstParam(params.from)?.trim();
  const rawTo = firstParam(params.to)?.trim();
  const rawQ = firstParam(params.q)?.trim() ?? "";
  const rawCity = firstParam(params.city);
  const rawCategory = firstParam(params.category);
  const rawAudience = firstParam(params.audience);

  let when: WhenFilter = EXPLORER_URL_DEFAULTS.when;
  if (rawWhen && isWhenFilter(rawWhen)) {
    when = rawWhen;
  }

  let from: string | null = null;
  let to: string | null = null;

  if (when === "range") {
    if (
      rawFrom &&
      rawTo &&
      isParisDateKey(rawFrom) &&
      isParisDateKey(rawTo) &&
      rawFrom <= rawTo
    ) {
      from = rawFrom;
      to = rawTo;
    } else {
      // Plage invalide → fallback weekend (URL sera normalisée côté client).
      when = EXPLORER_URL_DEFAULTS.when;
    }
  }

  let city: V1Commune | null = null;
  if (rawCity && (V1_COMMUNES as readonly string[]).includes(rawCity)) {
    city = rawCity as V1Commune;
  }

  let category: CategoryId = "tout";
  const parsedCategory = parseExplorerCategoryParam(rawCategory);
  if (parsedCategory) {
    category = parsedCategory;
  }

  let audience: ExplorerAudienceId | null = null;
  if (rawAudience && isExplorerAudience(rawAudience)) {
    audience = rawAudience;
  }

  return { when, from, to, q: rawQ, city, category, audience };
}

/** Querystring canonique (omit les défauts). */
export function serializeExplorerUrlState(state: ExplorerUrlState): string {
  const params = new URLSearchParams();

  if (state.when === "range" && state.from && state.to) {
    params.set("when", "range");
    params.set("from", state.from);
    params.set("to", state.to);
  } else if (
    (PRESET_WHENS as readonly string[]).includes(state.when) &&
    state.when !== EXPLORER_URL_DEFAULTS.when
  ) {
    params.set("when", state.when);
  } else if (state.when !== EXPLORER_URL_DEFAULTS.when && state.when !== "range") {
    params.set("when", state.when);
  }
  // weekend (défaut) : omit `when`

  if (state.q) params.set("q", state.q);
  if (state.city) params.set("city", state.city);
  // Canon : libellé DetourCategory (`Jeune public`), jamais le slug audience.
  if (state.category !== "tout") {
    params.set("category", state.category as DetourCategory);
  }
  if (state.audience === EXPLORER_AUDIENCE_JEUNE_PUBLIC) {
    params.set("audience", EXPLORER_AUDIENCE_JEUNE_PUBLIC);
  }

  return params.toString();
}

export function explorerUrlHref(state: ExplorerUrlState): string {
  const qs = serializeExplorerUrlState(state);
  return qs ? `/explorer?${qs}` : "/explorer";
}

export function sameExplorerUrlState(
  a: ExplorerUrlState,
  b: ExplorerUrlState,
): boolean {
  return (
    a.when === b.when &&
    a.from === b.from &&
    a.to === b.to &&
    a.q === b.q &&
    a.city === b.city &&
    a.category === b.category &&
    a.audience === b.audience
  );
}
