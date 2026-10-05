import { describe, expect, it, vi } from "vitest";
import {
  hangingFetch,
  headersThenHangingBody,
} from "@/infrastructure/http/http-timeout.test-helpers";
import { SaranEventAdapter } from "@/infrastructure/sources/saran/saran-event.adapter";

const SHORT_TIMEOUT_MS = 40;
const from = new Date("2026-09-01T00:00:00+02:00");
const to = new Date("2026-10-01T00:00:00+02:00");

describe("SaranEventAdapter HTTP timeout", () => {
  it("annule un iCal bloqué et fait échouer la collecte", async () => {
    const fetchImpl = vi.fn(hangingFetch);
    const adapter = new SaranEventAdapter({
      fetchImpl: fetchImpl as unknown as typeof fetch,
      httpTimeoutMs: SHORT_TIMEOUT_MS,
    });

    await expect(
      adapter.fetchUpcomingEvents({ from, to }),
    ).rejects.toMatchObject({ name: "TimeoutError" });
  });

  it("soumet un corps iCal bloqué au délai", async () => {
    const fetchImpl = vi.fn(headersThenHangingBody);
    const adapter = new SaranEventAdapter({
      fetchImpl: fetchImpl as unknown as typeof fetch,
      httpTimeoutMs: SHORT_TIMEOUT_MS,
    });

    await expect(
      adapter.fetchUpcomingEvents({ from, to }),
    ).rejects.toMatchObject({ name: "TimeoutError" });
  });
});
