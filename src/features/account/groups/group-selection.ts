/** Helpers purs pour le mode sélection de la vue détail groupe. */

export function nextSelectedIds(
  current: ReadonlySet<string>,
  id: string,
): Set<string> {
  const next = new Set(current);
  if (next.has(id)) next.delete(id);
  else next.add(id);
  return next;
}

export function selectAllIds(eventIds: string[]): Set<string> {
  return new Set(eventIds);
}

export function selectAllToggleLabel(
  selectedCount: number,
  totalCount: number,
): "Tout sélectionner" | "Tout désélectionner" {
  return totalCount > 0 && selectedCount === totalCount
    ? "Tout désélectionner"
    : "Tout sélectionner";
}

export function shouldShowBulkBar(
  selectionMode: boolean,
  selectedCount: number,
): boolean {
  return selectionMode && selectedCount > 0;
}
