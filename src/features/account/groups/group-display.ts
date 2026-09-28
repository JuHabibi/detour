import type { GroupSummary } from "@/application/groups";

export function formatGroupDateRange(group: GroupSummary): string | null {
  if (!group.earliestStartAt) return null;
  const start = new Date(group.earliestStartAt);
  const end = group.latestStartAt
    ? new Date(group.latestStartAt)
    : start;
  const fmt = new Intl.DateTimeFormat("fr-FR", {
    day: "numeric",
    month: "short",
  });
  if (start.toDateString() === end.toDateString()) {
    return fmt.format(start);
  }
  return `${fmt.format(start)} – ${fmt.format(end)}`;
}

export function groupEventCountLabel(n: number): string {
  if (n === 0) return "Aucun événement";
  return `${n} événement${n > 1 ? "s" : ""}`;
}
