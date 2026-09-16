import { getEventCalendarForId } from "@/application/calendar/get-event-calendar";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ eventId: string }>;
};

function normalizeEventIdParam(raw: string): string | null {
  let decoded = raw;
  try {
    decoded = decodeURIComponent(raw);
  } catch {
    return null;
  }
  const trimmed = decoded.trim();
  return trimmed.length > 0 ? trimmed : null;
}

/**
 * GET public — téléchargement .ics pour un événement Détour.
 * Auth non requise. Source de vérité = DB (eventId seul).
 */
export async function GET(
  _request: Request,
  context: RouteContext,
): Promise<Response> {
  const { eventId: rawId } = await context.params;
  const eventId = normalizeEventIdParam(rawId);
  if (!eventId) {
    return new Response("Not Found", { status: 404 });
  }

  try {
    const payload = await getEventCalendarForId(eventId);
    if (!payload) {
      return new Response("Not Found", { status: 404 });
    }

    const asciiName = payload.filename.replace(/[^\x20-\x7E]/g, "_");
    return new Response(payload.ics, {
      status: 200,
      headers: {
        "Content-Type": "text/calendar; charset=utf-8",
        "Content-Disposition": `attachment; filename="${asciiName}"`,
        "Cache-Control": "public, max-age=300",
      },
    });
  } catch (error) {
    console.error("[detour:calendar] GET failed", error);
    return new Response("Internal Server Error", { status: 500 });
  }
}
