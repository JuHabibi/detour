import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  assertOrmesListHtml,
  classifyOrmesListHtml,
  looksLikeOrmesEventsManagerListHtml,
} from "./ormes.list-html";

const FIXTURES = join(dirname(fileURLToPath(import.meta.url)), "fixtures");

function fixture(name: string): string {
  return readFileSync(join(FIXTURES, name), "utf8");
}

describe("ormes list html guard", () => {
  it("accepte une vraie liste Events Manager (fixture)", () => {
    const html = fixture("category-culture.html");
    expect(classifyOrmesListHtml(html)).toBe("events_manager_list");
    expect(looksLikeOrmesEventsManagerListHtml(html)).toBe(true);
    expect(() =>
      assertOrmesListHtml(html, "https://www.ville-ormes.fr/events/categories/culture/"),
    ).not.toThrow();
  });

  it("accepte une page EM vide (agenda sans événements)", () => {
    const html = `
      <!doctype html><html><body>
      <link href="/wp-content/themes/x/style.css" rel="stylesheet">
      <div class="em-category-single em-taxonomy-single">
        <h3>Évènement à venir</h3>
        <ul></ul>
      </div>
      <script src="/wp-content/plugins/events-manager/includes/js/events-manager.js"></script>
      </body></html>
    `;
    expect(classifyOrmesListHtml(html)).toBe("events_manager_list");
    expect(() =>
      assertOrmesListHtml(html, "https://www.ville-ormes.fr/events/categories/culture/"),
    ).not.toThrow();
  });

  it("détecte un challenge haphash HTTP 200", () => {
    const html = `<html><title>I Challenge Thee</title>
      <form action="/_challenge"></form>
      <div>Checking connection, please wait</div>
      protected by haphash</html>`;
    expect(classifyOrmesListHtml(html)).toBe("challenge");
    expect(() =>
      assertOrmesListHtml(html, "https://www.ville-ormes.fr/events/categories/culture/"),
    ).toThrow(/unexpected_list_html: challenge_haphash/);
  });

  it("rejette un HTML inattendu", () => {
    const html = `<html><body><h1>Maintenance</h1><p>Back soon</p></body></html>`;
    expect(classifyOrmesListHtml(html)).toBe("unexpected");
    expect(() =>
      assertOrmesListHtml(html, "https://www.ville-ormes.fr/events/categories/culture/"),
    ).toThrow(/unexpected_list_html: unexpected_html/);
  });
});
