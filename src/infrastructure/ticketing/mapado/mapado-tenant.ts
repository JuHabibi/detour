/** Configuration d’un portail Mapado (infra uniquement). */
export type MapadoTenantConfig = {
  id: string;
  /** Valeur stockée dans event_availability.provider. */
  provider: "mapado";
  portalUrl: string;
  cityHints: readonly string[];
  registrationHints: readonly string[];
  /** Bruits SSR de carte à ignorer lors de l’extraction du titre. */
  ignoredCatalogTitles: readonly string[];
};

export function isMapadoTenantCandidate(
  tenant: MapadoTenantConfig,
  event: {
    city: string | null;
    registrationUrl: string | null;
  },
): boolean {
  const city = normalizeCityHint(event.city);
  if (city && tenant.cityHints.some((hint) => city === hint)) {
    return true;
  }

  const url = (event.registrationUrl ?? "").toLowerCase();
  return tenant.registrationHints.some((hint) => url.includes(hint));
}

function normalizeCityHint(city: string | null): string {
  if (!city) return "";
  return city
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
