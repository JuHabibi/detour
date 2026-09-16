import { describe, expect, it } from "vitest";
import { diagnoseOrmesHtml } from "./ormes.diagnostics";

describe("diagnoseOrmesHtml", () => {
  it("détecte une liste Events Manager", () => {
    const html = `
      <html><body class="wp-theme">
      <div class="em-category-single"></div>
      <h3>Évènement à venir</h3>
      <ul><li><a href="/events/concert-a/">A</a></li></ul>
      <script src="/wp-content/plugins/events-manager/includes/js/events-manager.js"></script>
      </body></html>
    `;
    const d = diagnoseOrmesHtml(html);
    expect(d.looksLikeEventsManagerList).toBe(true);
    expect(d.looksLikeChallenge).toBe(false);
    expect(d.eventHrefCount).toBe(1);
  });

  it("détecte un challenge haphash", () => {
    const html = `<html><title>I Challenge Thee</title>
      <form action="/_challenge"></form>
      <div>Checking connection, please wait</div>
      protected by haphash</html>`;
    const d = diagnoseOrmesHtml(html);
    expect(d.looksLikeChallenge).toBe(true);
    expect(d.looksLikeEventsManagerList).toBe(false);
  });
});
