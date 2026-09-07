/** Teaser extrait de la liste agenda Ingré (HTML Drupal). */
export type IngreAgendaListItem = {
  nid: string;
  title: string;
  path: string;
  /** Accroche courte si présente. */
  teaser: string | null;
};

export type IngreAgendaListPage = {
  items: IngreAgendaListItem[];
  /** Index 0-based de la dernière page (href pager-last), ou 0 si une seule page. */
  lastPageIndex: number;
};

export type IngreAgendaDetail = {
  nid: string;
  title: string;
  path: string;
  canonicalUrl: string;
  teaser: string | null;
  bodyText: string | null;
  imageUrl: string | null;
  thematiques: string[];
  /** Texte brut du bloc date (pour diagnostics). */
  dateRaw: string | null;
  dateStartLabel: string | null;
  dateEndLabel: string | null;
  /** true si le libellé source contient « Jour entier ». */
  allDay: boolean;
  /** Heures HH:mm imbriquées dans date-display-single, si présentes. */
  singleDayStartTime: string | null;
  singleDayEndTime: string | null;
  gratuit: string | null;
  publicLabel: string | null;
};

export type IngreAgendaExclusionReason =
  | "ambiguous_program"
  | "unparseable_date"
  | "outside_window"
  | "missing_title"
  | "missing_nid";

export type IngreAgendaExclusion = {
  nid: string | null;
  path: string | null;
  title: string | null;
  reason: IngreAgendaExclusionReason;
  detail?: string;
};

export type IngreAgendaCollectStats = {
  discovered: number;
  detailsFetched: number;
  published: number;
  excluded: number;
};
