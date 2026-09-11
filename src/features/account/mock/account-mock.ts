import type { EventItem } from "@/data/types";

/** Identité minimale — maquette uniquement, pas un modèle auth. */
export type AccountMockUser = {
  displayName: string;
  email: string;
};

export const MOCK_ACCOUNT_USER: AccountMockUser = {
  displayName: "Camille R.",
  email: "camille@exemple.fr",
};

/**
 * Favoris mock — shape `EventItem` existante.
 * Aucune persistence ; données de présentation seulement.
 */
export const MOCK_FAVORITE_EVENTS: EventItem[] = [
  {
    id: "mock-fav-1",
    title: "Eliades Ochoa",
    category: "Musique",
    genre: "Concert",
    venue: "Théâtre d'Orléans",
    city: "Orléans",
    date: "2026-10-13",
    dateLabel: "Mar. 13 oct.",
    startAt: "2026-10-13T20:30:00+02:00",
    time: "20h30",
    distanceKm: 1.2,
    image:
      "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=640&q=80",
    sourceUrl: "https://example.com/eliades",
    registrationUrl: "https://example.com/eliades/billets",
  },
  {
    id: "mock-fav-2",
    title: "Exposition — Un regard sur le vivant",
    category: "Exposition",
    genre: "Exposition",
    venue: "Maison de la culture",
    city: "Saran",
    date: "2026-09-04",
    dateLabel: "Du 4 au 27 sept.",
    startAt: "2026-09-04T10:00:00+02:00",
    endAt: "2026-09-27T18:00:00+02:00",
    allDay: true,
    distanceKm: 5.9,
    description:
      "La rencontre de deux expressions artistiques influencées par le vivant.",
    sourceUrl: "https://example.com/exposition",
  },
  {
    id: "mock-fav-3",
    title: "Ateliers d'écriture créative",
    category: "Atelier",
    genre: "Atelier",
    venue: "L'Invitation Librairie",
    city: "Orléans",
    date: "2026-09-12",
    dateLabel: "Sam. 12 sept.",
    startAt: "2026-09-12T10:45:00+02:00",
    time: "10h45",
    distanceKm: 0.7,
    price: 12,
    image:
      "https://images.unsplash.com/photo-1456513080880-7d93aaa172bb?w=640&q=80",
    registrationUrl: "https://example.com/ecriture",
  },
];
