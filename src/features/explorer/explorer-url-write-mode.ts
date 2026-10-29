/**
 * Intentions d’écriture URL Explorer.
 * `push` (filtre explicite) ne doit pas être rétrogradé en `replace`
 * si une recherche debouncée arrive dans la même fenêtre.
 */
export type ExplorerUrlWriteMode = "push" | "replace";

export function mergeExplorerUrlWriteMode(
  current: ExplorerUrlWriteMode | null,
  requested: ExplorerUrlWriteMode,
): ExplorerUrlWriteMode {
  if (requested === "push") return "push";
  if (current === "push") return "push";
  return "replace";
}
