/** Initiales affichées dans l’avatar header — client-safe. */
export function userInitials(name: string, email: string): string {
  const trimmed = name.trim();
  if (trimmed) {
    const parts = trimmed.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) {
      const first = parts[0]?.[0];
      const last = parts[parts.length - 1]?.[0];
      if (first && last) return `${first}${last}`.toUpperCase();
    }
    return trimmed.slice(0, 2).toUpperCase();
  }

  const local = email.trim().split("@")[0] ?? "";
  if (local.length >= 2) return local.slice(0, 2).toUpperCase();
  if (local.length === 1) return local.toUpperCase();
  return "?";
}
