import { EventService } from "@/application/event.service";
import { mapDetourEventToEventItem } from "@/application/map-detour-event-to-ui";
import { HomePage } from "@/components/HomePage";
import { OrleansEventAdapter } from "@/infrastructure/sources/orleans/orleans-event.adapter";

const UPCOMING_WINDOW_DAYS = 60;

const eventService = new EventService(new OrleansEventAdapter());

export default async function Page() {
  const from = new Date();
  const to = new Date(from);
  to.setDate(to.getDate() + UPCOMING_WINDOW_DAYS);

  const detourEvents = await eventService.getUpcomingEvents({ from, to });
  const events = detourEvents.map((event) => mapDetourEventToEventItem(event));

  return <HomePage events={events} />;
}
