import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { EventGrid } from "@/features/explorer/components/EventGrid";

describe("EventGrid — titre page Explorer", () => {
  it("expose un seul h1 « Explorer les sorties »", () => {
    const html = renderToStaticMarkup(
      createElement(EventGrid, {
        title: "Explorer les sorties",
        events: [],
        favorites: new Set<string>(),
        onToggleFavorite: () => {},
      }),
    );

    const h1OpenTags = html.match(/<h1\b/g) ?? [];
    expect(h1OpenTags).toHaveLength(1);
    expect(html).toMatch(/<h1\b[^>]*>Explorer les sorties<\/h1>/);
    expect(html).not.toMatch(/<h2\b[^>]*>Explorer les sorties<\/h2>/);
  });
});
