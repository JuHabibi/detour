import { getAccountAuthState } from "@/app/_server/get-account-auth-state";
import { exportGroupCalendarForUser } from "@/application/calendar/export-group-calendar";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ groupId: string }>;
};

function normalizeGroupIdParam(raw: string): string | null {
  let decoded = raw;
  try {
    decoded = decodeURIComponent(raw);
  } catch {
    return null;
  }
  const trimmed = decoded.trim();
  return trimmed.length > 0 ? trimmed : null;
}

/** Lit `eventId` répétés (et alias `eventIds` CSV) depuis la query. */
function parseEventIdsFromRequest(request: Request): string[] | undefined {
  const url = new URL(request.url);
  const repeated = url.searchParams.getAll("eventId");
  const csv = url.searchParams.get("eventIds");
  const fromCsv = csv
    ? csv.split(",").map((part) => part.trim()).filter(Boolean)
    : [];
  const ids = [...repeated, ...fromCsv];
  return ids.length > 0 ? ids : undefined;
}

/**
 * GET authentifié — ICS d’un groupe (complet ou sélection via ?eventId=).
 * Ownership : session userId + groupId (jamais groupId seul).
 */
export async function GET(
  request: Request,
  context: RouteContext,
): Promise<Response> {
  const auth = await getAccountAuthState();
  if (auth.status !== "authenticated") {
    return new Response("Unauthorized", { status: 401 });
  }

  const { groupId: rawId } = await context.params;
  const groupId = normalizeGroupIdParam(rawId);
  if (!groupId) {
    return new Response("Not Found", { status: 404 });
  }

  const eventIds = parseEventIdsFromRequest(request);

  try {
    const result = await exportGroupCalendarForUser({
      userId: auth.user.id,
      groupId,
      eventIds,
    });

    if (result.status === "not_found") {
      return new Response("Not Found", { status: 404 });
    }
    if (result.status === "empty") {
      return new Response("No events", { status: 404 });
    }

    const asciiName = result.payload.filename.replace(/[^\x20-\x7E]/g, "_");
    return new Response(result.payload.ics, {
      status: 200,
      headers: {
        "Content-Type": "text/calendar; charset=utf-8",
        "Content-Disposition": `attachment; filename="${asciiName}"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    console.error("[detour:group-calendar] GET failed", error);
    return new Response("Internal Server Error", { status: 500 });
  }
}
