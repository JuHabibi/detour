/** Champs réellement consommés dans la réponse Opendatasoft Orléans. */
export type OrleansRawEvent = {
  uid: string;
  title_fr: string | null;
  description_fr: string | null;
  image: string | null;
  firstdate_begin: string | null;
  firstdate_end: string | null;
  location_name: string | null;
  location_city: string | null;
  location_coordinates: {
    lat: number;
    lon: number;
  } | null;
  categorie_principale: string | null;
  conditions_fr: string | null;
  originagenda_title: string | null;
  canonicalurl: string | null;
  statut_evenement: string | null;
};

export type OrleansApiResponse = {
  total_count: number;
  results: OrleansRawEvent[];
};
