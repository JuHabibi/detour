import type { MapadoTenantConfig } from "@/infrastructure/ticketing/mapado/mapado-tenant";

export const MAPADO_CHECY_TENANT: MapadoTenantConfig = {
  id: "checy",
  provider: "mapado",
  portalUrl: "https://billetterie-checy.mapado.com/",
  cityHints: ["checy"],
  registrationHints: [
    "billetterie-checy.mapado.com",
    "checy.fr/billetterie",
  ],
  ignoredCatalogTitles: ["CHÉCY"],
};
