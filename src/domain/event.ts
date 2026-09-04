export type DetourEvent = {
  id: string;
  title: string;
  description: string | null;
  imageUrl: string | null;

  startAt: string;
  endAt: string | null;

  venue: string | null;
  city: string | null;

  latitude: number | null;
  longitude: number | null;

  category: string | null;
  conditions: string | null;

  source: string | null;
  sourceUrl: string | null;
  /** Lien de réservation / inscription extrait de registration, si présent. */
  registrationUrl: string | null;
};
