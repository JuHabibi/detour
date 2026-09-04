/**
 * Types bruts issus du parseur iCal Saran — pas de DetourEvent ici.
 */
export type SaranIcalDateValue =
  | {
      kind: "date-time";
      /** Composants muraux dans le fuseau indiqué. */
      year: number;
      month: number;
      day: number;
      hour: number;
      minute: number;
      second: number;
      /** Ex. Europe/Paris, ou "UTC" si suffixe Z. */
      timeZone: string;
    }
  | {
      kind: "date";
      year: number;
      month: number;
      day: number;
      /** DATE all-day — interprété en Europe/Paris. */
      timeZone: string;
    };

export type SaranIcalEvent = {
  uid: string;
  summary: string;
  description: string | null;
  location: string | null;
  url: string | null;
  dtStart: SaranIcalDateValue;
  dtEnd: SaranIcalDateValue | null;
  lastModified: string | null;
};
