/** Teaser extrait de la liste agenda culture Bouillon. */
export type BouillonListItem = {
  title: string;
  /** Path canonique `/fr/culture/agenda-actualites/...`. */
  path: string;
  category: string | null;
  teaser: string | null;
};

export type BouillonListPage = {
  items: BouillonListItem[];
  /** Index 0-based de la dernière page (`pager__item--last`), ou 0 si une seule page. */
  lastPageIndex: number;
};

export type BouillonDetail = {
  nid: string;
  title: string;
  path: string;
  canonicalUrl: string;
  bodyText: string | null;
  startAt: string;
  endAt: string | null;
  latitude: number | null;
  longitude: number | null;
  registrationUrl: string | null;
  /** Catégorie issue du listing (souvent absente de la fiche). */
  category: string | null;
};

export type BouillonExclusionReason =
  | "outside_window"
  | "missing_title"
  | "missing_nid"
  | "unparseable_date";

export type BouillonExclusion = {
  nid: string | null;
  path: string | null;
  title: string | null;
  reason: BouillonExclusionReason;
  detail?: string;
};

export type BouillonCollectStats = {
  discovered: number;
  detailsFetched: number;
  published: number;
  excluded: number;
};
