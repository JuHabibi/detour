import type { MapadoTenantConfig } from "@/infrastructure/ticketing/mapado/mapado-tenant";

/**
 * Tenant Mapado Chécy — seule config locale V1.
 * L’ajout d’un autre tenant Mapado = nouvelle constante du même type.
 */
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
