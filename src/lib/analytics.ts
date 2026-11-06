/**
 * Capture produit UI — désactivée (PostHog retiré).
 * Les appels existants restent sans effet et sans dépendances navigateur.
 *
 * Limite : d’anciens cookies / localStorage PostHog (`ph_*`) peuvent encore
 * exister chez des visiteurs ayant chargé une version antérieure ; Détour
 * ne les lit ni ne les réécrit. Purge éventuelle côté dashboard PostHog =
 * action manuelle hors code.
 */
export function captureProductEvent(
  ..._args: [
    string,
    Record<string, string | number | boolean | null | undefined>?,
  ]
): void {
  void _args;
}
