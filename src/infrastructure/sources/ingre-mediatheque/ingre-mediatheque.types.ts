export type IngreMediathequeRssItem = {
  title: string;
  description: string | null;
  /** Instant de séance (RFC 2822 `pubDate`). */
  pubDateRaw: string;
  startAt: string;
  /** Clé murale Paris `YYYY-MM-DDTHH:mm` pour jointure listing. */
  startKey: string;
};

export type IngreMediathequeListingSession = {
  nid: string;
  detailPath: string;
  detailUrl: string;
  startKey: string;
  endAt: string | null;
  dateRaw: string;
};

export type IngreMediathequeExclusionReason =
  | "missing_title"
  | "unparseable_pub_date"
  | "outside_window";

export type IngreMediathequeExclusion = {
  title: string | null;
  nid: string | null;
  reason: IngreMediathequeExclusionReason;
  detail?: string;
};

export type IngreMediathequeCollectStats = {
  rssItems: number;
  listingSessions: number;
  published: number;
  excluded: number;
};
