/** Le résumé peut préciser le format ou la durée, absents du corps éditorial. */
export function resolveSourceDescription(
  summary: string | null | undefined,
  fullDescription: string | null | undefined,
): string | null {
  const short = sourceDescriptionToText(summary);
  const full = sourceDescriptionToText(fullDescription);
  if (!full) return short;
  if (!short || full.toLowerCase().includes(short.toLowerCase())) return full;
  const separator = /[.!?…]$/.test(short) ? " " : ". ";
  return `${short}${separator}${full}`;
}

/**
 * Texte éditorial issu d'un champ HTML de source, destiné au rendu texte React
 * et à l'évaluation IA. Ce n'est pas un sanitizer pour injection HTML.
 */
export function sourceDescriptionToText(value: string | null | undefined): string | null {
  if (!value) return null;
  const text = value
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, " ")
    .replace(/<\/?(?:p|div|br|li|ul|ol|h[1-6]|blockquote|table|tr|td|hr)\b[^>]*>/gi, " ")
    .replace(/<[^>]+>/g, "")
    // Décoder après retrait des balises pour conserver les signes littéraux.
    .replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (entity, code: string) => {
      if (code.startsWith("#")) {
        const point = code[1].toLowerCase() === "x"
          ? parseInt(code.slice(2), 16)
          : parseInt(code.slice(1), 10);
        return point > 0 && point <= 0x10ffff && !(point >= 0xd800 && point <= 0xdfff)
          ? String.fromCodePoint(point)
          : " ";
      }
      return TEXT_ENTITIES[code] ?? entity;
    })
    .replace(/\s+/g, " ")
    .trim();
  return text || null;
}

const TEXT_ENTITIES: Readonly<Record<string, string>> = {
  amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ",
  laquo: "«", raquo: "»", rsquo: "’", lsquo: "‘", rdquo: "”", ldquo: "“",
  ndash: "–", mdash: "—", hellip: "…", euro: "€", eacute: "é", Eacute: "É",
  egrave: "è", ecirc: "ê", agrave: "à", acirc: "â", ccedil: "ç", ocirc: "ô",
  ugrave: "ù", ucirc: "û", icirc: "î", iuml: "ï", euml: "ë", oelig: "œ",
};
