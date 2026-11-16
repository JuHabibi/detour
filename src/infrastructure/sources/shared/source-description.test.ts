import { describe, expect, it } from "vitest";
import { resolveSourceDescription, sourceDescriptionToText } from "./source-description";

describe("sourceDescriptionToText", () => {
  it("conserve les mots en ligne et sépare paragraphes, sauts et listes", () => {
    expect(sourceDescriptionToText(
      '<p>Une déam<strong>bulation</strong>.</p><p>Écrire<br>ensemble</p><ul><li>Lire</li><li>Imaginer</li></ul>',
    )).toBe("Une déambulation. Écrire ensemble Lire Imaginer");
  });

  it("retire le contenu non éditorial et les attributs des liens", () => {
    expect(sourceDescriptionToText(
      '<!-- brouillon --><style>.x{}</style><script>alert(1)</script><p>Atelier <a href="https://example.com" onclick="x()">ouvert</a></p>',
    )).toBe("Atelier ouvert");
  });

  it("décode les entités typographiques et numériques sans interpréter le texte comme HTML", () => {
    expect(sourceDescriptionToText(
      '&laquo; L&#8217;&eacute;criture &amp; la ville &raquo;&nbsp;&#x1F3AD; &lt;fiction&gt;',
    )).toBe("« L’écriture & la ville » 🎭 <fiction>");
    expect(sourceDescriptionToText("&#99999999; &#0; &#xD800;")).toBeNull();
  });

  it.each([null, undefined, "", "  ", "<p>&nbsp;<br></p>"])("renvoie null pour un contenu vide : %s", (value) => {
    expect(sourceDescriptionToText(value)).toBeNull();
  });
});

describe("resolveSourceDescription", () => {
  it("conserve les informations du résumé absentes du corps", () => {
    expect(resolveSourceDescription("Cycle de six semaines", "<p>Écriture autour de la ville.</p>"))
      .toBe("Cycle de six semaines. Écriture autour de la ville.");
  });

  it("ne répète pas le résumé déjà contenu dans le texte complet", () => {
    expect(resolveSourceDescription("Atelier d’écriture", "<p>ATELIER D’ÉCRITURE autour de la ville.</p>"))
      .toBe("ATELIER D’ÉCRITURE autour de la ville.");
  });

  it("accepte un texte complet seul et n'ajoute pas une double ponctuation", () => {
    expect(resolveSourceDescription(null, "<p>Écriture autour de la ville.</p>"))
      .toBe("Écriture autour de la ville.");
    expect(resolveSourceDescription("Six semaines !", "<p>Écriture autour de la ville.</p>"))
      .toBe("Six semaines ! Écriture autour de la ville.");
  });
});
