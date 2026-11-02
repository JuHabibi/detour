import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { loadPublicEventPage } from "@/app/_server/load-public-event-page";
import { EventPublicPage } from "@/features/event-page/components/EventPublicPage";
import { buildEventPageMetadata } from "@/features/event-page/event-page-seo";
import { normalizeEventIdParam } from "@/lib/event-public-path";

type EventRouteProps = {
  params: Promise<{ id: string }>;
};

async function loadForRoute(rawId: string) {
  const eventId = normalizeEventIdParam(rawId);
  if (!eventId) return { status: "not_found" as const };
  return loadPublicEventPage(eventId);
}

export async function generateMetadata({
  params,
}: EventRouteProps): Promise<Metadata> {
  const { id } = await params;
  const result = await loadForRoute(id);
  if (result.status !== "ok") {
    return { robots: { index: false, follow: false } };
  }
  return buildEventPageMetadata(result.data);
}

export default async function PublicEventRoutePage({ params }: EventRouteProps) {
  const { id } = await params;
  const result = await loadForRoute(id);
  if (result.status !== "ok") {
    notFound();
  }
  return <EventPublicPage data={result.data} />;
}
