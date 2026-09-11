import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it, vi } from "vitest";
import { parseBouillonDetail } from "./bouillon.detail-parser";
import {
  BOUILLON_BANNER_ASPECT_RATIO_THRESHOLD,
  enrichBouillonDetailImage,
  isBannerLikeUniversityImage,
  parseBilletwebEventImageUrl,
  shouldEnrichBouillonImageFromBilletweb,
} from "./bouillon.image";
import { mapBouillonDetailToDetourEvent } from "./bouillon.mapper";
import type { BouillonDetail } from "./bouillon.types";

const FIXTURES = join(dirname(fileURLToPath(import.meta.url)), "fixtures");

function fixture(name: string): string {
  return readFileSync(join(FIXTURES, name), "utf8");
}

function detailStub(
  partial: Partial<BouillonDetail> & Pick<BouillonDetail, "nid" | "title">,
): BouillonDetail {
  return {
    nid: partial.nid,
    title: partial.title,
    path: partial.path ?? `/fr/culture/agenda-actualites/${partial.nid}`,
    canonicalUrl:
      partial.canonicalUrl ??
      `https://www.univ-orleans.fr/fr/culture/agenda-actualites/${partial.nid}`,
    bodyText: partial.bodyText ?? "Description",
    imageUrl: partial.imageUrl ?? null,
    imageWidth: partial.imageWidth ?? null,
    imageHeight: partial.imageHeight ?? null,
    startAt: partial.startAt ?? "2026-09-17T20:30:00Z",
    endAt: partial.endAt ?? "2026-09-17T23:30:00Z",
    latitude: partial.latitude ?? 47.84,
    longitude: partial.longitude ?? 1.93,
    registrationUrl: partial.registrationUrl ?? null,
    category: partial.category ?? "Spectacle / Concert",
  };
}

describe("bouillon university banner heuristic", () => {
  it(`ratio > ${BOUILLON_BANNER_ASPECT_RATIO_THRESHOLD} → banner-like`, () => {
    expect(
      isBannerLikeUniversityImage({
        imageUrl: "https://www.univ-orleans.fr/upload/public/x.png",
        imageWidth: 2800,
        imageHeight: 654,
      }),
    ).toBe(true);
  });

  it("photo portrait / 16:9 → pas banner-like", () => {
    expect(
      isBannerLikeUniversityImage({
        imageUrl: "https://www.univ-orleans.fr/upload/public/x.png",
        imageWidth: 1600,
        imageHeight: 900,
      }),
    ).toBe(false);
    expect(
      isBannerLikeUniversityImage({
        imageUrl: "https://www.univ-orleans.fr/upload/public/x.png",
        imageWidth: 800,
        imageHeight: 1000,
      }),
    ).toBe(false);
  });

  it("sans dimensions fiables → pas banner-like (pas d’enrichissement)", () => {
    expect(
      isBannerLikeUniversityImage({
        imageUrl: "https://www.univ-orleans.fr/upload/public/x.png",
        imageWidth: null,
        imageHeight: null,
      }),
    ).toBe(false);
    expect(
      shouldEnrichBouillonImageFromBilletweb(
        detailStub({
          nid: "1",
          title: "X",
          imageUrl: "https://www.univ-orleans.fr/x.png",
          imageWidth: null,
          imageHeight: null,
          registrationUrl: "https://www.billetweb.fr/x",
        }),
      ),
    ).toBe(false);
  });
});

describe("parseBilletwebEventImageUrl", () => {
  it("extrait l’image Event (pas le thumb page) depuis Mona", () => {
    const url = parseBilletwebEventImageUrl(fixture("billetweb-mona.html"));
    expect(url).toBe("https://www.billetweb.fr/files/event/150/1425665.jpg");
  });

  it("extrait l’image Event depuis Jesus", () => {
    const url = parseBilletwebEventImageUrl(fixture("billetweb-jesus.html"));
    expect(url).toBe("https://www.billetweb.fr/files/event/150/1428377.jpg");
  });

  it("sans image event exploitable → null", () => {
    expect(
      parseBilletwebEventImageUrl(fixture("billetweb-no-event-image.html")),
    ).toBeNull();
  });
});

describe("enrichBouillonDetailImage", () => {
  it("image Université normale → Billetweb non fetché", async () => {
    const fetchImpl = vi.fn();
    const detail = detailStub({
      nid: "10",
      title: "Concert normal",
      imageUrl: "https://www.univ-orleans.fr/upload/public/normal.png",
      imageWidth: 800,
      imageHeight: 1000,
      registrationUrl: "https://www.billetweb.fr/concert-normal",
    });

    const enriched = await enrichBouillonDetailImage(detail, {
      fetchImpl,
      httpTimeoutMs: 5_000,
    });

    expect(fetchImpl).not.toHaveBeenCalled();
    expect(enriched.imageUrl).toBe(detail.imageUrl);
  });

  it("image banner-like + Billetweb → meilleure image retenue", async () => {
    const univUrl = "https://www.univ-orleans.fr/upload/public/banner.png";
    const fetchImpl = vi.fn(async () => {
      return new Response(fixture("billetweb-mona.html"), { status: 200 });
    });

    const detail = detailStub({
      nid: "18149",
      title: "Mona Guba + Imparfait",
      imageUrl: univUrl,
      imageWidth: 2800,
      imageHeight: 654,
      registrationUrl: "https://www.billetweb.fr/mona-guba-imparfait",
      bodyText: "corps",
      category: "Spectacle / Concert",
    });

    const enriched = await enrichBouillonDetailImage(detail, {
      fetchImpl,
      httpTimeoutMs: 5_000,
    });

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(fetchImpl).toHaveBeenCalledWith(
      expect.stringContaining("mona-guba-imparfait"),
      expect.objectContaining({
        headers: expect.any(Object),
      }),
    );
    expect(enriched.imageUrl).toBe(
      "https://www.billetweb.fr/files/event/150/1425665.jpg",
    );

    const before = mapBouillonDetailToDetourEvent(detail);
    const after = mapBouillonDetailToDetourEvent(enriched);
    expect(before.ok && after.ok).toBe(true);
    if (!before.ok || !after.ok) return;

    expect(after.event.imageUrl).toBe(enriched.imageUrl);
    expect(after.event).toEqual({
      ...before.event,
      imageUrl: enriched.imageUrl,
    });
  });

  it("Billetweb indisponible → fallback image Université", async () => {
    const univUrl = "https://www.univ-orleans.fr/upload/public/banner.png";
    const fetchImpl = vi.fn(async () => new Response("nope", { status: 503 }));
    const detail = detailStub({
      nid: "2",
      title: "Banner",
      imageUrl: univUrl,
      imageWidth: 2800,
      imageHeight: 654,
      registrationUrl: "https://www.billetweb.fr/x",
    });

    const enriched = await enrichBouillonDetailImage(detail, {
      fetchImpl,
      httpTimeoutMs: 5_000,
    });

    expect(enriched.imageUrl).toBe(univUrl);
  });

  it("Billetweb sans image exploitable → fallback image Université", async () => {
    const univUrl = "https://www.univ-orleans.fr/upload/public/banner.png";
    const fetchImpl = vi.fn(
      async () =>
        new Response(fixture("billetweb-no-event-image.html"), { status: 200 }),
    );
    const detail = detailStub({
      nid: "3",
      title: "Banner",
      imageUrl: univUrl,
      imageWidth: 2800,
      imageHeight: 654,
      registrationUrl: "https://www.billetweb.fr/x",
    });

    const enriched = await enrichBouillonDetailImage(detail, {
      fetchImpl,
      httpTimeoutMs: 5_000,
    });

    expect(enriched.imageUrl).toBe(univUrl);
  });

  it("timeout / erreur réseau → ne fait pas échouer, fallback Université", async () => {
    const univUrl = "https://www.univ-orleans.fr/upload/public/banner.png";
    const fetchImpl = vi.fn(async () => {
      throw new Error("timeout");
    });
    const detail = detailStub({
      nid: "4",
      title: "Banner",
      imageUrl: univUrl,
      imageWidth: 2800,
      imageHeight: 654,
      registrationUrl: "https://www.billetweb.fr/x",
    });

    await expect(
      enrichBouillonDetailImage(detail, { fetchImpl, httpTimeoutMs: 5_000 }),
    ).resolves.toMatchObject({ imageUrl: univUrl });
  });
});

describe("detail parser expose les dimensions Université", () => {
  it("Mona : 2800×654 banner-like", () => {
    const detail = parseBouillonDetail(fixture("detail-mona.html"), {
      category: "Spectacle / Concert",
    });
    expect(detail.imageWidth).toBe(2800);
    expect(detail.imageHeight).toBe(654);
    expect(isBannerLikeUniversityImage(detail)).toBe(true);
    expect(shouldEnrichBouillonImageFromBilletweb(detail)).toBe(true);
  });
});
