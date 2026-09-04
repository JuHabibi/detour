export type DetourEvent = {
  id: string;
  title: string;
  description: string | null;
  imageUrl: string | null;

  startAt: string;
  endAt: string | null;

  venue: string | null;
  city: string;

  latitude: number | null;
  longitude: number | null;

  category: string | null;
  conditions: string | null;

  source: string;
  sourceUrl: string;
};
