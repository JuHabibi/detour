/**
 * Après `router.refresh()`, Next renvoie de nouvelles props (nouvelle référence).
 * Si la référence serveur a changé, remplacer le state local (ex. eventCount).
 * Sinon null → conserver les mises à jour optimistes en cours.
 */
export function takeServerListIfChanged<T>(
  serverList: T[],
  lastSeenServerList: T[],
): T[] | null {
  return serverList !== lastSeenServerList ? serverList : null;
}
