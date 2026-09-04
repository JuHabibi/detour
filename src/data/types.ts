export type CategoryId =
  | "tout"
  | "musique"
  | "spectacles"
  | "expos"
  | "cinema"
  | "famille"
  | "ateliers";

export type WhenFilter =
  | "today"
  | "tomorrow"
  | "weekend"
  | "next-week"
  | "this-month"
  | "next-month"
  | "pick-date";

export type RadiusFilter = 5 | 15 | 30 | 50;

export type EventSignal = "discover" | "nearby" | "free" | "intimate";

export type EventItem = {
  id: string;
  title: string;
  category: CategoryId;
  genre: string;
  venue: string;
  city: string;
  date: string;
  dateLabel: string;
  time?: string;
  distanceKm: number;
  price: number | "free";
  image?: string;
  imageAlt?: string;
  description?: string;
  detour?: boolean;
  weekend?: boolean;
  upcoming?: boolean;
  signal?: EventSignal;
};
