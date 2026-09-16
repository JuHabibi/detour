/** Types source Ville d'Ormes (Events Manager / WordPress). */

export type OrmesListItem = {
  /** Identifiant provisoire depuis le slug URL (confirmé au détail). */
  slug: string;
  title: string;
  url: string;
  /** Texte date brut de la liste (diagnostic). */
  dateHint: string | null;
};

export type OrmesListPage = {
  items: OrmesListItem[];
  /** URL absolue page suivante, si pagination EM. */
  nextPageUrl: string | null;
};

export type OrmesDetail = {
  eventId: string;
  slug: string;
  title: string;
  canonicalUrl: string;
  bodyText: string | null;
  imageUrl: string | null;
  venue: string | null;
  categories: string[];
  latitude: number | null;
  longitude: number | null;
  registrationUrl: string | null;
  conditions: string | null;
  /** Bloc Date/heure brut. */
  dateRaw: string | null;
  dateStartLabel: string | null;
  dateEndLabel: string | null;
  startTime: string | null;
  endTime: string | null;
};

export type OrmesExclusionReason =
  | "ambiguous_program"
  | "unparseable_date"
  | "outside_window"
  | "missing_title"
  | "missing_id"
  | "complete"
  | "http_error";

export type OrmesExclusion = {
  id: string | null;
  slug: string | null;
  title: string | null;
  reason: OrmesExclusionReason;
  detail?: string;
};

export type OrmesCollectStats = {
  discovered: number;
  detailsFetched: number;
  published: number;
  excluded: number;
};
