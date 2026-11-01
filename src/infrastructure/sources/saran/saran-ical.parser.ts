import type {
  SaranIcalDateValue,
  SaranIcalEvent,
} from "@/infrastructure/sources/saran/saran-ical.types";

const DEFAULT_TZ = "Europe/Paris";

export type SaranIcalBodyKind =
  | "valid_calendar"
  | "empty"
  | "html"
  | "truncated"
  | "unexpected";

/**
 * Distingue un VCALENDAR Saran valide (éventuellement sans VEVENT) d’une
 * réponse HTTP 200 non exploitable : HTML maintenance, corps tronqué, autre.
 */
export function classifySaranIcalBody(raw: string): SaranIcalBodyKind {
  const trimmed = raw.trim();
  if (!trimmed) return "empty";

  if (looksLikeHtmlBody(trimmed)) return "html";

  const lines = unfoldIcalLines(trimmed);
  const upperLines = lines.map((line) => line.toUpperCase());

  const beginIdx = upperLines.indexOf("BEGIN:VCALENDAR");
  if (beginIdx < 0) return "unexpected";

  const endIdx = upperLines.lastIndexOf("END:VCALENDAR");
  if (endIdx < 0 || endIdx < beginIdx) return "truncated";

  let veventDepth = 0;
  for (let i = beginIdx + 1; i < endIdx; i += 1) {
    const line = upperLines[i];
    if (line === "BEGIN:VEVENT") veventDepth += 1;
    else if (line === "END:VEVENT") {
      if (veventDepth === 0) return "truncated";
      veventDepth -= 1;
    }
  }
  if (veventDepth !== 0) return "truncated";

  return "valid_calendar";
}

/**
 * Fail-closed : calendrier vide mais bien formé OK ; HTML / tronqué / hors
 * format → throw (évite un corpus mensuel partiel pris pour un succès).
 */
export function assertSaranIcalBody(raw: string, url: string): void {
  const kind = classifySaranIcalBody(raw);
  if (kind === "valid_calendar") return;

  throw new Error(`Saran iCal invalid body: ${kind} (${url})`);
}

/**
 * Parse un flux iCal (VCALENDAR) et extrait les VEVENT.
 * Gère folded lines, escapes, TZID et VALUE=DATE.
 * Prérequis : corps déjà validé via assertSaranIcalBody (ou équivalent).
 */
export function parseSaranIcal(raw: string): SaranIcalEvent[] {
  const lines = unfoldIcalLines(raw);
  const events: SaranIcalEvent[] = [];
  let current: Record<string, string> | null = null;

  for (const line of lines) {
    const upper = line.toUpperCase();
    if (upper === "BEGIN:VEVENT") {
      current = {};
      continue;
    }
    if (upper === "END:VEVENT") {
      if (current) {
        const parsed = toSaranIcalEvent(current);
        if (parsed) events.push(parsed);
      }
      current = null;
      continue;
    }
    if (!current) continue;

    const parsedLine = parsePropertyLine(line);
    if (!parsedLine) continue;

    const { name, params, value } = parsedLine;
    if (name === "DTSTART" || name === "DTEND") {
      current[name] = serializeDateProperty(params, value);
    } else if (
      name === "UID" ||
      name === "SUMMARY" ||
      name === "DESCRIPTION" ||
      name === "LOCATION" ||
      name === "URL" ||
      name === "LAST-MODIFIED"
    ) {
      current[name] = unescapeIcalText(value);
    }
  }

  return events;
}

function looksLikeHtmlBody(raw: string): boolean {
  const head = raw.slice(0, 512);
  return (
    /<!DOCTYPE\s+html/i.test(head) ||
    /<html[\s>]/i.test(head) ||
    /<head[\s>]/i.test(head) ||
    /<body[\s>]/i.test(head) ||
    /<title[\s>]/i.test(head)
  );
}

/** Déplie les lignes iCal (continuation = espace/tab en tête). */
export function unfoldIcalLines(raw: string): string[] {
  const normalized = raw.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const lines = normalized.split("\n");
  const unfolded: string[] = [];

  for (const line of lines) {
    if (
      unfolded.length > 0 &&
      (line.startsWith(" ") || line.startsWith("\t"))
    ) {
      unfolded[unfolded.length - 1] += line.slice(1);
    } else if (line.length > 0) {
      unfolded.push(line);
    }
  }

  return unfolded;
}

export function unescapeIcalText(value: string): string {
  return value
    .replace(/\\n/gi, "\n")
    .replace(/\\,/g, ",")
    .replace(/\\;/g, ";")
    .replace(/\\\\/g, "\\");
}

function parsePropertyLine(
  line: string,
): { name: string; params: Record<string, string>; value: string } | null {
  const colon = line.indexOf(":");
  if (colon <= 0) return null;

  const left = line.slice(0, colon);
  const value = line.slice(colon + 1);
  const parts = left.split(";");
  const name = (parts[0] ?? "").toUpperCase();
  if (!name) return null;

  const params: Record<string, string> = {};
  for (const part of parts.slice(1)) {
    const eq = part.indexOf("=");
    if (eq <= 0) continue;
    params[part.slice(0, eq).toUpperCase()] = part.slice(eq + 1);
  }

  return { name, params, value };
}

function serializeDateProperty(
  params: Record<string, string>,
  value: string,
): string {
  const valueType = params.VALUE?.toUpperCase() ?? "";
  const tzid = params.TZID ?? "";
  return JSON.stringify({ valueType, tzid, value });
}

function toSaranIcalEvent(
  props: Record<string, string>,
): SaranIcalEvent | null {
  const uid = props.UID?.trim();
  const summary = props.SUMMARY?.trim();
  const dtStartRaw = props.DTSTART;
  if (!uid || !summary || !dtStartRaw) return null;

  const dtStart = parseStoredDate(dtStartRaw);
  if (!dtStart) return null;

  const dtEnd = props.DTEND ? parseStoredDate(props.DTEND) : null;

  return {
    uid,
    summary,
    description: emptyToNull(props.DESCRIPTION),
    location: emptyToNull(props.LOCATION),
    url: emptyToNull(props.URL),
    dtStart,
    dtEnd,
    lastModified: emptyToNull(props["LAST-MODIFIED"]),
  };
}

function parseStoredDate(stored: string): SaranIcalDateValue | null {
  try {
    const { valueType, tzid, value } = JSON.parse(stored) as {
      valueType: string;
      tzid: string;
      value: string;
    };
    return parseIcalDateValue(value, valueType, tzid);
  } catch {
    return null;
  }
}

export function parseIcalDateValue(
  value: string,
  valueType: string,
  tzid: string,
): SaranIcalDateValue | null {
  const trimmed = value.trim();
  if (!trimmed) return null;

  if (valueType === "DATE" || /^\d{8}$/.test(trimmed)) {
    const year = Number(trimmed.slice(0, 4));
    const month = Number(trimmed.slice(4, 6));
    const day = Number(trimmed.slice(6, 8));
    if (!year || !month || !day) return null;
    return {
      kind: "date",
      year,
      month,
      day,
      timeZone: tzid || DEFAULT_TZ,
    };
  }

  const match = trimmed.match(
    /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(Z)?$/,
  );
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const hour = Number(match[4]);
  const minute = Number(match[5]);
  const second = Number(match[6]);
  const isUtc = match[7] === "Z";

  return {
    kind: "date-time",
    year,
    month,
    day,
    hour,
    minute,
    second,
    timeZone: isUtc ? "UTC" : tzid || DEFAULT_TZ,
  };
}

function emptyToNull(value: string | null | undefined): string | null {
  if (value == null) return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}
