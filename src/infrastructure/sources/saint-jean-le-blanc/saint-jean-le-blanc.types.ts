/** Teaser extrait de la liste agenda CMS Saint-Jean-le-Blanc. */
export type SjlbListItem = {
  resourceId: string;
  /** Ancre / id.agenda sur la card, si présent. */
  listAnchor: string | null;
  title: string;
  theme: string | null;
  /** Jour affiché sur la card (ex. "25"), pas une date ISO. */
  dayLabel: string | null;
  /** Mois abrégé affiché (ex. "Sept."), diagnostic uniquement. */
  monthLabel: string | null;
  detailPath: string;
  detailUrl: string;
  imageUrl: string | null;
};

export type SjlbListPage = {
  items: SjlbListItem[];
  /**
   * Indices 1-based des pages annoncées par les liens ListeAgenda.php.
   * Inclut toujours au moins 1 si la page courante a des items.
   */
  pageNumbers: number[];
  /** Dernier index 1-based annoncé (max de pageNumbers), ou 1. */
  lastPageNumber: number;
};

export type SjlbDetail = {
  resourceId: string;
  detailPath: string;
  detailUrl: string;
  title: string;
  theme: string | null;
  /** Infos pratiques Date, brut (ex. "16/10/2026"). */
  dateRaw: string | null;
  /** Infos pratiques Horaires, brut (ex. "20H00"), null si absent. */
  horairesRaw: string | null;
  lieu: string | null;
  adresse: string | null;
  descriptionText: string | null;
  imageUrl: string | null;
  bookingUrl: string | null;
  organisateurMention: boolean;
};

export type SjlbExclusionReason =
  | "missing_resource_id"
  | "missing_title"
  | "unparseable_date"
  | "outside_window"
  | "http_error"
  | "detail_parse_error";

export type SjlbExclusion = {
  resourceId: string | null;
  detailPath: string | null;
  title: string | null;
  reason: SjlbExclusionReason;
  detail?: string;
};

export type SjlbCollectStats = {
  listPagesFetched: number;
  discovered: number;
  detailsFetched: number;
  detailsFailed: number;
  published: number;
  excluded: number;
};
