/**
 * État URL de la frise — view / category / notebookId.
 * Compatible avec les anciennes URL `?category=Musique`.
 */

import {
  DETOUR_CATEGORIES,
  type DetourCategory,
} from "@/domain/events/classify-event-category";
import type { CategoryId } from "@/data/types";

export type FriseView = "all" | "favorites" | "notebook";

export type FriseUrlState = {
  view: FriseView;
  /** null = pas encore choisi (mode all uniquement). */
  category: CategoryId | null;
  notebookId: string | null;
  preview: boolean;
};

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function parseFriseView(
  raw: string | string[] | undefined | null,
): FriseView {
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (value === "favorites" || value === "notebook") return value;
  return "all";
}

export function parseFriseCategory(
  raw: string | string[] | undefined | null,
): CategoryId | null {
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (!value) return null;
  if (value === "tout") return "tout";
  if ((DETOUR_CATEGORIES as readonly string[]).includes(value)) {
    return value as DetourCategory;
  }
  return null;
}

export function parseFriseNotebookId(
  raw: string | string[] | undefined | null,
): string | null {
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (!value || typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!UUID_RE.test(trimmed)) return null;
  return trimmed;
}

export function parseFrisePreview(
  raw: string | string[] | undefined | null,
): boolean {
  const value = Array.isArray(raw) ? raw[0] : raw;
  return value === "1";
}

export function parseFriseUrlState(params: {
  view?: string | string[];
  category?: string | string[];
  notebookId?: string | string[];
  preview?: string | string[];
}): FriseUrlState {
  const view = parseFriseView(params.view);
  let category = parseFriseCategory(params.category);
  let notebookId = parseFriseNotebookId(params.notebookId);

  if (view === "favorites" || view === "notebook") {
    // Les parcours personnels mélangent toujours toutes les catégories.
    // Une ancienne URL contenant `category` reste valide mais ce filtre est ignoré.
    category = "tout";
  }
  if (view !== "notebook") {
    notebookId = null;
  }

  return {
    view,
    category,
    notebookId,
    preview: parseFrisePreview(params.preview),
  };
}

export function buildFriseSearchParams(state: {
  view: FriseView;
  category: CategoryId | null;
  notebookId?: string | null;
  preview?: boolean;
}): URLSearchParams {
  const params = new URLSearchParams();
  if (state.view !== "all") {
    params.set("view", state.view);
  }
  if (state.view === "all") {
    if (state.category) {
      params.set("category", state.category);
    }
  }

  if (state.view === "notebook" && state.notebookId) {
    params.set("notebookId", state.notebookId);
  }
  if (state.preview) {
    params.set("preview", "1");
  }
  return params;
}

export function buildFriseHref(state: {
  view: FriseView;
  category: CategoryId | null;
  notebookId?: string | null;
  preview?: boolean;
}): string {
  const params = buildFriseSearchParams(state);
  const qs = params.toString();
  return qs ? `/frise?${qs}` : "/frise";
}

/** Cible post-login : préserve view/category/notebookId. */
export function friseReturnPath(state: {
  view?: FriseView;
  category?: CategoryId | null;
  notebookId?: string | null;
}): string {
  return buildFriseHref({
    view: state.view ?? "all",
    category: state.category ?? null,
    notebookId: state.notebookId ?? null,
  });
}

export function filterEventsByFriseCategory(
  events: readonly { category: string }[],
  category: CategoryId | null,
): typeof events {
  if (!category || category === "tout") return events;
  return events.filter((event) => event.category === category);
}
