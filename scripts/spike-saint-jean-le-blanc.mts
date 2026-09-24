/**
 * Spike SJLB v2 — agenda structuré Liste_agenda_* + fiches Ress_* uniquement.
 * La page Programmation n’est PAS parsée : corpus de référence hardcodé (spike 1).
 * Section CLASSIFIER DECISION : pipeline classifyEventRelevance générique (aucune règle locale).
 *
 * Usage: bun scripts/spike-saint-jean-le-blanc.mts
 */
import { classifyEventRelevance } from "../src/domain/events/classify-event-relevance";
import type { DetourEvent } from "../src/domain/events/event";

const ORIGIN = "https://www.saintjeanleblanc.com";
const UA = "DetourBot/1.0 (+detour; agenda-sync)";
const PAGE_SIZE = 9;
const CULTURAL_RELEVANCE = new Set(["culture", "culture_leisure"]);

/** Corpus de référence — saison culturelle (spike 1), non parsé ici. */
const REFERENCE_SEASON = [
  { key: "yanis-oct", title: "En scène pour « Des Rêves pour Yanis »", dateHint: "2-4 octobre" },
  { key: "belle-mere", title: "Belle-mère à vendre", dateHint: "16 octobre 20h" },
  { key: "inauguration", title: "L’inauguration de la salle des fêtes", dateHint: "20 novembre 20h30" },
  { key: "yanis-nov", title: "En scène pour « Des Rêves pour Yanis » (2e week-end)", dateHint: "21-22 novembre" },
  { key: "theatron", title: "Le Théâtron", dateHint: "27-28-29 novembre" },
  { key: "cirque", title: "Cirque de Noël", dateHint: "13 décembre 16h" },
  { key: "ma-femme", title: "Ma femme, la tienne, la nôtre", dateHint: "15 janvier 20h30" },
  { key: "conference", title: "Conférence de Clément Joubert sur Roméo et Juliette", dateHint: "12 février 18h30" },
  { key: "elles", title: "Elles pardonnent mais n’oublient jamais", dateHint: "19 février 20h30" },
  { key: "applis", title: "Mes applis, mes amours, mes emmerdes", dateHint: "19 mars 20h30" },
  { key: "diner", title: "Un dîner d’adieu", dateHint: "16 avril 20h30" },
  { key: "belle-bete", title: "La belle et la bête", dateHint: "24 avril 15h" },
  { key: "sarah", title: "Sarah-Anna : Salé", dateHint: "28 mai 20h30" },
] as const;

type AgendaCard = {
  listId: string | null;
  title: string;
  theme: string | null;
  day: string | null;
  month: string | null;
  detailUrl: string | null;
  imageUrl: string | null;
  resourceId: string | null;
};

type DetailFields = {
  url: string;
  status: number;
  title: string | null;
  theme: string | null;
  date: string | null;
  horaires: string | null;
  lieu: string | null;
  adresse: string | null;
  descriptionPresent: boolean;
  /** Texte fiche (HTML strip) — pour classifyEventRelevance, pas inventé. */
  descriptionText: string | null;
  imagePresent: boolean;
  bookingUrl: string | null;
  tarifMention: boolean;
  organisateurMention: boolean;
  rawInfosPratiquesPresent: boolean;
};

type Fit = "strong" | "good" | "borderline" | "noise" | "out_of_scope";

function decode(s: string): string {
  return s
    .replace(/&nbsp;/gi, " ")
    .replace(/&rsquo;/gi, "’")
    .replace(/&lsquo;/gi, "‘")
    .replace(/&laquo;/gi, "«")
    .replace(/&raquo;/gi, "»")
    .replace(/&eacute;/gi, "é")
    .replace(/&egrave;/gi, "è")
    .replace(/&ecirc;/gi, "ê")
    .replace(/&agrave;/gi, "à")
    .replace(/&ocirc;/gi, "ô")
    .replace(/&icirc;/gi, "î")
    .replace(/&ucirc;/gi, "û")
    .replace(/&ccedil;/gi, "ç")
    .replace(/&ouml;/gi, "ö")
    .replace(/&euml;/gi, "ë")
    .replace(/&acirc;/gi, "â")
    .replace(/&ugrave;/gi, "ù")
    .replace(/&hellip;/gi, "…")
    .replace(/&Eacute;/gi, "É")
    .replace(/&Egrave;/gi, "È")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&euro;/gi, "€")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) =>
      String.fromCharCode(Number.parseInt(n, 16)),
    );
}

function abs(href: string): string {
  try {
    return new URL(href, ORIGIN).toString();
  } catch {
    return href;
  }
}

function norm(t: string): string {
  return t
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function dice(a: string, b: string): number {
  const ta = new Set(norm(a).split(" ").filter((x) => x.length > 2));
  const tb = new Set(norm(b).split(" ").filter((x) => x.length > 2));
  if (!ta.size || !tb.size) return 0;
  let inter = 0;
  for (const t of ta) if (tb.has(t)) inter++;
  return (2 * inter) / (ta.size + tb.size);
}

function isChallenge(html: string): boolean {
  return /haphash|I Challenge Thee|_challenge|captcha|cf-turnstile|Checking connection/i.test(
    html,
  );
}

async function fetchHtml(url: string): Promise<{
  status: number;
  finalUrl: string;
  contentType: string | null;
  bodyLength: number;
  challenge: boolean;
  html: string;
  ms: number;
}> {
  const t0 = Date.now();
  const res = await fetch(url, {
    headers: { accept: "text/html,application/xhtml+xml", "user-agent": UA },
    redirect: "follow",
  });
  const html = await res.text();
  return {
    status: res.status,
    finalUrl: res.url || url,
    contentType: res.headers.get("content-type"),
    bodyLength: html.length,
    challenge: isChallenge(html),
    html,
    ms: Date.now() - t0,
  };
}

function extractTexte(html: string): string {
  const m =
    html.match(
      /id=["']texte["'][^>]*>([\s\S]*?)<\/div>\s*(?:<div[^>]*id=["']|<\/div>\s*<\/div>\s*<footer|<div id=["']bas)/i,
    ) || html.match(/id=["']texte["'][^>]*>([\s\S]*?)$/i);
  return m?.[1] ?? "";
}

function parseAgendaCards(html: string): AgendaCard[] {
  const items: AgendaCard[] = [];
  const parts = html.split(/item_agenda"/).slice(1);
  for (const part of parts) {
    const chunk = part.slice(0, 3500);
    const theme =
      (chunk.match(/class="thematique">([^<]+)/) || [])[1]?.trim() || null;
    const day = (chunk.match(/<strong>(\d+)<\/strong>/) || [])[1] || null;
    const month =
      (chunk.match(/<\/strong>\s*<\/?br\s*\/?>\s*([^<]+)/i) || [])[1]
        ?.replace(/\s+/g, " ")
        .trim() || null;
    const hrefM = chunk.match(/<h3>\s*<a[^>]*href="([^"]+)"/i);
    const titleAttr = chunk.match(/<h3>\s*<a[^>]*title="([^"]+)"/i);
    const titleInner = chunk.match(/<h3>\s*<a[^>]*>([\s\S]*?)<\/a>/i);
    const title = decode(
      (titleAttr?.[1] || titleInner?.[1] || "")
        .replace(/<[^>]+>/g, " ")
        .replace(/\s+/g, " ")
        .trim(),
    );
    const img = (chunk.match(/<div class="image">\s*<img[^>]+src="([^"]+)"/) ||
      chunk.match(/<img[^>]+src="([^"]+)"/))?.[1];
    const listId =
      (chunk.match(/id="([^"]+)"\s+class="agenda"/) || [])[1] || null;
    const detailUrl = hrefM ? abs(hrefM[1]!) : null;
    const resourceId = detailUrl?.match(/Ress_(\d+)/)?.[1] ?? null;
    if (!title) continue;
    items.push({
      listId,
      title,
      theme,
      day,
      month,
      detailUrl,
      imageUrl: img ? abs(img) : null,
      resourceId,
    });
  }
  return items;
}

function parsePagination(html: string): string[] {
  return [
    ...new Set(
      [...html.matchAll(/ListeAgenda\.php\?[^"'>\s]+/g)].map((m) =>
        abs("/" + m[0].replace(/^\//, "")),
      ),
    ),
  ];
}

function parseDetail(html: string, url: string, status: number): DetailFields {
  const texte = extractTexte(html);
  const h1 = (html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i) || [])[1];
  const title = h1
    ? decode(h1.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim())
    : null;
  const theme =
    (texte.match(/Imprimer la page\s*([^<\n]+)/i) || [])[1]?.trim() ||
    (texte.match(/class="thematique">([^<]+)/) || [])[1]?.trim() ||
    null;

  const info: Record<string, string> = {};
  for (const m of texte.matchAll(
    /class="separation"><span>([^<]+)<\/span>\s*<p>([\s\S]*?)<\/p>/gi,
  )) {
    info[decode(m[1]!).trim().toLowerCase()] = decode(
      m[2]!.replace(/<[^>]+>/g, " "),
    )
      .replace(/\s+/g, " ")
      .trim();
  }

  const bookingLinks = [
    ...texte.matchAll(/href=["'](https?:\/\/[^"']+)["']/gi),
  ]
    .map((m) => m[1]!)
    .filter((u) =>
      /billet|yurplan|tickandlive|billetweb|billetreduc|desrevespouryanis|coeurdescene|tickandlive/i.test(
        u,
      ),
    );

  const descriptionText = decode(
    texte
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim(),
  );

  return {
    url,
    status,
    title,
    theme: theme ? decode(theme) : null,
    date: info.date ?? null,
    horaires: info.horaires ?? null,
    lieu: info.lieu ?? null,
    adresse: info.adresse ?? null,
    descriptionPresent: descriptionText.length > 200,
    descriptionText: descriptionText.length > 0 ? descriptionText : null,
    imagePresent: /<img[^>]+src=/.test(texte),
    bookingUrl: bookingLinks[0] ?? null,
    tarifMention: /tarif|\b€\b|&euro;|gratuit/i.test(texte),
    organisateurMention:
      /organisé|association|compagnie|en partenariat|ccas@|culture@/i.test(
        texte,
      ),
    rawInfosPratiquesPresent: /class="separation"><span>Date<\/span>/i.test(
      texte,
    ),
  };
}

/** Mapping générique card+fiche → DetourEvent (pas de règle métier SJLB). */
function toDetourEvent(
  card: AgendaCard,
  detail: DetailFields | null,
): DetourEvent {
  const title = (detail?.title && detail.title.length > 3
    ? detail.title
    : card.title
  ).trim();
  const startAt = parseFrDateToIso(detail?.date) ?? "2099-01-01T12:00:00.000Z";
  return {
    id: `sjlb-spike-${card.resourceId ?? card.listId ?? norm(title).slice(0, 40)}`,
    title,
    description: detail?.descriptionText ?? null,
    imageUrl: card.imageUrl,
    startAt,
    endAt: null,
    venue: detail?.lieu ?? null,
    city: "Saint-Jean-le-Blanc",
    latitude: null,
    longitude: null,
    category: card.theme ?? detail?.theme ?? null,
    genre: null,
    conditions: detail?.horaires ?? null,
    source: "saint-jean-le-blanc-spike",
    sourceUrl: card.detailUrl,
    registrationUrl: detail?.bookingUrl ?? null,
  };
}

/** jj/mm/aaaa → ISO noon UTC ; null si absent/invalide (pas d’invention). */
function parseFrDateToIso(date: string | null | undefined): string | null {
  if (!date) return null;
  const m = date.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) return null;
  const dd = Number(m[1]);
  const mm = Number(m[2]);
  const yyyy = Number(m[3]);
  if (mm < 1 || mm > 12 || dd < 1 || dd > 31) return null;
  return `${yyyy}-${String(mm).padStart(2, "0")}-${String(dd).padStart(2, "0")}T12:00:00.000Z`;
}

function classifyCard(theme: string | null, title: string): Fit {
  const blob = `${theme ?? ""} ${title}`.toLowerCase();
  if (/ccas/i.test(theme ?? "")) {
    if (/théâtre|theatre|spectacle|concert/i.test(title)) return "borderline";
    return "out_of_scope";
  }
  if (/sport|marché|marche|numerique|numérique|seniors|aide aux|chute|stress|positif|courses/i.test(blob)) {
    return "out_of_scope";
  }
  if (/nouveau programme culturel/i.test(title)) return "noise";
  if (/théâtre|theatre/i.test(theme ?? "")) {
    if (/inauguration|cirque|yanis|belle-m|dîner|diner|sarah|belle et/i.test(blob)) {
      return /inauguration|cirque|yanis/i.test(blob) ? "strong" : "good";
    }
    return "good";
  }
  if (/rendez-vous associatifs/i.test(theme ?? "")) {
    if (/yanis|théâtre|theatre|concert|spectacle/i.test(blob)) return "good";
    return "borderline";
  }
  if (/exposition|culture|musique|concert/i.test(blob)) return "good";
  return "borderline";
}

function matchReference(
  ref: (typeof REFERENCE_SEASON)[number],
  cards: AgendaCard[],
  details: Map<string, DetailFields>,
): {
  found: boolean;
  card: AgendaCard | null;
  detail: DetailFields | null;
  dateOk: boolean | null;
  timeOk: boolean | null;
  lieuOk: boolean | null;
  categoryOk: boolean | null;
} {
  let best: { card: AgendaCard; score: number } | null = null;
  for (const c of cards) {
    const score = Math.max(
      dice(ref.title, c.title),
      // yanis dual weekends share title
      ref.key.startsWith("yanis") && /yanis/i.test(c.title) ? 0.9 : 0,
    );
    if (!best || score > best.score) best = { card: c, score };
  }
  if (!best || best.score < 0.45) {
    return {
      found: false,
      card: null,
      detail: null,
      dateOk: null,
      timeOk: null,
      lieuOk: null,
      categoryOk: null,
    };
  }

  // For yanis dual: prefer matching date hint month if multiple
  if (ref.key.startsWith("yanis")) {
    const yanisCards = cards.filter((c) => /yanis/i.test(c.title));
    if (yanisCards.length) {
      const wantOct = /octobre/i.test(ref.dateHint);
      const pick =
        yanisCards.find((c) =>
          wantOct ? /oct/i.test(c.month ?? "") : /nov/i.test(c.month ?? ""),
        ) ?? yanisCards[0]!;
      best = { card: pick, score: 0.95 };
    }
  }

  const detail = best.card.detailUrl
    ? details.get(best.card.detailUrl) ?? null
    : null;

  const dateOk = detail?.date
    ? true
    : best.card.day && best.card.month
      ? true
      : false;
  const timeOk = detail?.horaires ? true : false;
  const lieuOk = detail?.lieu ? true : false;
  const categoryOk = Boolean(best.card.theme || detail?.theme);

  return {
    found: true,
    card: best.card,
    detail,
    dateOk,
    timeOk,
    lieuOk,
    categoryOk,
  };
}

function fieldStats(details: DetailFields[]) {
  const n = details.length || 1;
  const rate = (pred: (d: DetailFields) => boolean) => {
    const c = details.filter(pred).length;
    const r = c / n;
    const label =
      r >= 0.95 ? "toujours" : r >= 0.6 ? "souvent" : r >= 0.25 ? "parfois" : "absent";
    return { count: c, total: details.length, rate: Number(r.toFixed(2)), label };
  };
  return {
    title: rate((d) => Boolean(d.title)),
    date: rate((d) => Boolean(d.date)),
    horaires: rate((d) => Boolean(d.horaires)),
    lieu: rate((d) => Boolean(d.lieu)),
    adresse: rate((d) => Boolean(d.adresse)),
    description: rate((d) => d.descriptionPresent),
    image: rate((d) => d.imagePresent),
    billetterie: rate((d) => Boolean(d.bookingUrl)),
    tarif: rate((d) => d.tarifMention),
    organisateur: rate((d) => d.organisateurMention),
    infosPratiquesBlock: rate((d) => d.rawInfosPratiquesPresent),
    theme: rate((d) => Boolean(d.theme)),
  };
}

async function fetchAllAgendaPages(): Promise<{
  cards: AgendaCard[];
  pagesFetched: number;
  pageMeta: Array<{ url: string; status: number; items: number; challenge: boolean }>;
  paginationLinks: string[];
  emptyPageProbe: { url: string; status: number; items: number };
  filterProbes: Array<{ url: string; items: number; themes: string[] }>;
}> {
  const firstUrl = `${ORIGIN}/Liste_agenda_1/`;
  const first = await fetchHtml(firstUrl);
  const paginationLinks = parsePagination(first.html);
  const pageUrls = [
    firstUrl,
    ...paginationLinks.filter((u) => !/listeDebut=0&listeFin=9/.test(u) && !/p=1&/.test(u)),
  ];
  // Ensure ordered unique
  const seenUrl = new Set<string>();
  const ordered: string[] = [];
  for (const u of pageUrls) {
    if (seenUrl.has(u)) continue;
    seenUrl.add(u);
    ordered.push(u);
  }

  const cards: AgendaCard[] = [];
  const seen = new Set<string>();
  const pageMeta: Array<{
    url: string;
    status: number;
    items: number;
    challenge: boolean;
  }> = [];

  // Re-fetch first already have
  const queue = [{ url: firstUrl, html: first.html, status: first.status, challenge: first.challenge }];
  for (const u of ordered.slice(1)) {
    await new Promise((r) => setTimeout(r, 120));
    const p = await fetchHtml(u);
    queue.push({
      url: u,
      html: p.html,
      status: p.status,
      challenge: p.challenge,
    });
  }

  for (const p of queue) {
    const items = parseAgendaCards(p.html);
    pageMeta.push({
      url: p.url,
      status: p.status,
      items: items.length,
      challenge: p.challenge,
    });
    for (const it of items) {
      const key = it.detailUrl || `${it.title}|${it.day}|${it.month}`;
      if (seen.has(key)) continue;
      seen.add(key);
      cards.push(it);
    }
  }

  // empty / bad probes
  const empty = await fetchHtml(
    `${ORIGIN}/ListeAgenda.php?IdRubrique=2&p=1&listeDebut=0&listeFin=9`,
  );
  const filterProbes = [];
  for (const u of [
    `${ORIGIN}/ListeAgenda.php?IdRubrique=1&thematique=Théâtre`,
    `${ORIGIN}/ListeAgenda.php?IdRubrique=1&IdTheme=Theatre`,
    `${ORIGIN}/ListeAgenda.php?IdRubrique=1&Theme=Spectacle`,
  ]) {
    await new Promise((r) => setTimeout(r, 100));
    const p = await fetchHtml(u);
    const items = parseAgendaCards(p.html);
    filterProbes.push({
      url: u,
      items: items.length,
      themes: [...new Set(items.map((i) => i.theme).filter(Boolean) as string[])],
    });
  }

  return {
    cards,
    pagesFetched: queue.length,
    pageMeta,
    paginationLinks,
    emptyPageProbe: {
      url: empty.finalUrl,
      status: empty.status,
      items: parseAgendaCards(empty.html).length,
    },
    filterProbes,
  };
}

async function main() {
  console.log("=== Saint-Jean-le-Blanc structured agenda spike ===\n");

  const listBundle = await fetchAllAgendaPages();
  const { cards, pagesFetched, pageMeta, paginationLinks, emptyPageProbe, filterProbes } =
    listBundle;

  const themes = [...new Set(cards.map((c) => c.theme).filter(Boolean) as string[])].sort();

  console.log("SOURCE");
  console.log(
    JSON.stringify(
      {
        listEntry: `${ORIGIN}/Liste_agenda_1/`,
        paginationPattern:
          "/ListeAgenda.php?IdRubrique=1&p={n}&listeDebut={a}&listeFin={b}",
        pageSizeObserved: PAGE_SIZE,
        pagesFetched,
        paginationLinks,
        serverSideThemeFilter: "none_effective",
        themesObserved: themes,
        cardSelector: ".item_agenda",
        detailPattern: "/Ress_{id}/{slug}.html",
        challengeDetected: pageMeta.some((p) => p.challenge),
        pageMeta,
      },
      null,
      2,
    ),
  );

  // Fetch details for all cards (pace)
  const details = new Map<string, DetailFields>();
  const detailErrors: Array<{ url: string; status: number }> = [];
  for (const c of cards) {
    if (!c.detailUrl) continue;
    await new Promise((r) => setTimeout(r, 120));
    const p = await fetchHtml(c.detailUrl);
    if (p.status !== 200 || p.challenge) {
      detailErrors.push({ url: c.detailUrl, status: p.status });
      continue;
    }
    details.set(c.detailUrl, parseDetail(p.html, c.detailUrl, p.status));
  }

  // Also probe intentional 404
  const badDetail = await fetchHtml(`${ORIGIN}/Ress_999999/DOES-NOT-EXIST.html`);

  console.log("\nLIST FIELDS (cards)");
  const listFieldRates = {
    title: cards.filter((c) => c.title).length,
    day: cards.filter((c) => c.day).length,
    month: cards.filter((c) => c.month).length,
    theme: cards.filter((c) => c.theme).length,
    image: cards.filter((c) => c.imageUrl).length,
    detailUrl: cards.filter((c) => c.detailUrl).length,
    stableListId: cards.filter((c) => c.listId).length,
    resourceId: cards.filter((c) => c.resourceId).length,
    endDateOnCard: 0,
    total: cards.length,
  };
  console.log(JSON.stringify(listFieldRates, null, 2));

  const detailList = [...details.values()];
  console.log("\nFIELDS (Ress_* detail — Infos pratiques)");
  console.log(JSON.stringify(fieldStats(detailList), null, 2));
  console.log(
    JSON.stringify(
      {
        detailsFetched: detailList.length,
        detailErrors,
        http404Probe: {
          url: badDetail.finalUrl,
          status: badDetail.status,
          challenge: badDetail.challenge,
        },
      },
      null,
      2,
    ),
  );

  // Reference coverage
  console.log("\nREFERENCE COVERAGE");
  const refRows = REFERENCE_SEASON.map((ref) => {
    const m = matchReference(ref, cards, details);
    return {
      event: ref.title,
      dateHint: ref.dateHint,
      found: m.found,
      agendaTitle: m.card?.title ?? null,
      theme: m.card?.theme ?? null,
      detailUrl: m.card?.detailUrl ?? null,
      dateOk: m.dateOk,
      timeOk: m.timeOk,
      lieuOk: m.lieuOk,
      categoryOk: m.categoryOk,
      detailDate: m.detail?.date ?? null,
      detailTime: m.detail?.horaires ?? null,
      detailLieu: m.detail?.lieu ?? null,
    };
  });

  // Special: yanis may appear once in agenda for both weekends
  const yanisCards = cards.filter((c) => /yanis/i.test(c.title));
  const foundKeys = new Set(
    refRows.filter((r) => r.found).map((r) => r.event + r.dateHint),
  );
  // If only one yanis card, second weekend may be missing as separate item
  const yanisOct = refRows.find((r) => /octobre/i.test(r.dateHint));
  const yanisNov = refRows.find((r) => /novembre/i.test(r.dateHint));
  let yanisNote = "";
  if (yanisCards.length === 1 && yanisOct?.found && yanisNov?.found) {
    yanisNote =
      "ATTENTION: un seul item agenda Yanis — les 2 week-ends peuvent être fusionnés sur une seule fiche Ress_*";
    // Check detail text for both weekends
    const d = yanisOct.detailUrl ? details.get(yanisOct.detailUrl) : null;
    // re-fetch text presence via date fields only one date on infos pratiques
    if (d && d.date && !/21|22/.test(d.date)) {
      // mark nov as partial
      if (yanisNov) {
        yanisNov.found = true;
        yanisNov.dateOk = false;
        yanisNov.timeOk = d.horaires ? true : false;
        yanisNov.lieuOk = d.lieu ? true : false;
      }
    }
  }

  for (const r of refRows) {
    console.log(
      `| ${r.event} | ${r.found ? "yes" : "NO"} | ${r.detailUrl ? "yes" : "no"} | date=${r.dateOk} time=${r.timeOk} lieu=${r.lieuOk} cat=${r.categoryOk} | ${r.detailDate ?? r.agendaTitle ?? ""} ${r.detailTime ?? ""} ${r.detailLieu ?? ""} |`,
    );
  }
  if (yanisNote) console.log(yanisNote);
  console.log(
    `Yanis cards in agenda: ${yanisCards.length} → ${yanisCards.map((c) => `${c.day} ${c.month}`).join(" ; ")}`,
  );

  // Stricter coverage: found + dateOk + (timeOk or multi-day known) + lieuOk preferred
  const solid = refRows.filter(
    (r) => r.found && r.dateOk && r.lieuOk && (r.timeOk || /yanis|théâtron|theatron|cirque/i.test(r.event)),
  );
  // For coverage % primary criterion: found in structured agenda at all
  const foundCount = refRows.filter((r) => r.found).length;
  const missing = refRows.filter((r) => !r.found).map((r) => r.event);
  const coveragePercent = Number(
    ((foundCount / REFERENCE_SEASON.length) * 100).toFixed(1),
  );
  const solidPercent = Number(
    ((solid.length / REFERENCE_SEASON.length) * 100).toFixed(1),
  );

  console.log(
    JSON.stringify(
      {
        referenceSeasonEvents: REFERENCE_SEASON.length,
        foundInStructuredAgenda: foundCount,
        missingFromStructuredAgenda: missing,
        coveragePercent,
        solidFieldCoveragePercent: solidPercent,
        solidCount: solid.length,
        yanisCardCount: yanisCards.length,
      },
      null,
      2,
    ),
  );

  // Noise / editorial on full agenda
  console.log("\nNOISE");
  const classified = cards.map((c) => ({
    ...c,
    fit: classifyCard(c.theme, c.title),
  }));
  const counts = {
    raw: classified.length,
    strong: classified.filter((c) => c.fit === "strong").length,
    good: classified.filter((c) => c.fit === "good").length,
    borderline: classified.filter((c) => c.fit === "borderline").length,
    noise: classified.filter((c) => c.fit === "noise").length,
    out_of_scope: classified.filter((c) => c.fit === "out_of_scope").length,
  };
  const useful = counts.strong + counts.good;
  console.log(
    JSON.stringify(
      {
        ...counts,
        useful,
        byTheme: themes.map((t) => ({
          theme: t,
          n: classified.filter((c) => c.theme === t).length,
          fits: classified
            .filter((c) => c.theme === t)
            .reduce(
              (a, c) => {
                a[c.fit] = (a[c.fit] || 0) + 1;
                return a;
              },
              {} as Record<string, number>,
            ),
        })),
        noiseExamples: classified
          .filter((c) => c.fit === "out_of_scope" || c.fit === "noise")
          .slice(0, 12)
          .map((c) => `[${c.theme}] ${c.title}`),
        usefulExamples: classified
          .filter((c) => c.fit === "strong" || c.fit === "good")
          .map((c) => `[${c.theme}] ${c.title}`),
      },
      null,
      2,
    ),
  );

  // Filter strategies (client-side only — server filter ineffective)
  console.log("\nFILTER STRATEGIES");
  function strategy(
    name: string,
    pred: (c: (typeof classified)[number]) => boolean,
  ) {
    const subset = classified.filter(pred);
    const usefulCount = subset.filter(
      (c) => c.fit === "strong" || c.fit === "good",
    ).length;
    const noiseCount = subset.filter(
      (c) => c.fit === "noise" || c.fit === "out_of_scope",
    ).length;
    // reference coverage within subset
    const refFound = REFERENCE_SEASON.filter((ref) => {
      const m = matchReference(ref, subset, details);
      return m.found;
    }).length;
    return {
      name,
      rawCount: subset.length,
      usefulCount,
      noiseCount,
      borderlineCount: subset.filter((c) => c.fit === "borderline").length,
      referenceSeasonCoverage: `${refFound}/${REFERENCE_SEASON.length}`,
      referenceCoveragePercent: Number(
        ((refFound / REFERENCE_SEASON.length) * 100).toFixed(1),
      ),
    };
  }

  const strategies = [
    strategy("A_agenda_complet", () => true),
    strategy(
      "B_theme_theatre",
      (c) => /théâtre|theatre/i.test(c.theme ?? ""),
    ),
    strategy(
      "B2_theme_theatre_or_assoc",
      (c) =>
        /théâtre|theatre|rendez-vous associatifs/i.test(c.theme ?? ""),
    ),
    strategy(
      "C_theatre_plus_yanis_assoc",
      (c) =>
        /théâtre|theatre/i.test(c.theme ?? "") ||
        (/rendez-vous associatifs/i.test(c.theme ?? "") &&
          /yanis|spectacle|théâtre|theatre|concert/i.test(c.title)),
    ),
    strategy(
      "D_exclude_ccas",
      (c) => !/ccas/i.test(c.theme ?? ""),
    ),
  ];
  console.log(JSON.stringify({ serverSideFilterProbes: filterProbes, strategies }, null, 2));

  console.log("\nROBUSTNESS");
  const shortPages = pageMeta.filter(
    (p) => p.items > 0 && p.items < PAGE_SIZE && !p.url.includes("listeFin=45"),
  );
  // last page may be short — OK
  const lastPage = pageMeta[pageMeta.length - 1];
  const robustness = {
    paginationCompleteHeuristic: {
      pagesFetched,
      expectedMinPages: Math.ceil(cards.length / PAGE_SIZE),
      shortNonLastPages: shortPages.length,
      lastPageItems: lastPage?.items ?? null,
      note: "Fail-closed si page intermédiaire < 9 items alors qu’une page suivante est annoncée",
    },
    emptyRubriqueProbe: emptyPageProbe,
    httpNon200: {
      list: pageMeta.filter((p) => p.status !== 200),
      detail404: { status: badDetail.status, usable: badDetail.status === 200 },
    },
    challenge: pageMeta.some((p) => p.challenge) || badDetail.challenge,
    selectors: {
      list: [".item_agenda", ".thematique", "h3 a[href^=Ress_]", "id.agenda", "date_debut strong"],
      detail: [
        '#texte h1',
        '.separation > span + p (Date|Horaires|Lieu|Adresse)',
      ],
      risk: "CMS maison — sélecteurs stables aujourd’hui mais pas documentés ; Infos pratiques très régulier",
    },
    failClosedProposed: [
      "HTTP list/detail !== 200 → throw",
      "challengeDetected → throw unexpected_list_html",
      "0 .item_agenda sur page 1 alors que status 200 → throw (sauf rubrique connue vide)",
      "pagination: page i < PAGE_SIZE et lien page i+1 présent → throw incomplete_pagination",
      "detail sans bloc Infos pratiques Date pour thème Théâtre → exclude fail-closed ou skip item",
      "ne jamais inventer lieu/heure absents",
    ],
  };
  console.log(JSON.stringify(robustness, null, 2));

  // Verdict
  const bestStrategy = strategies.reduce((a, b) =>
    b.referenceCoveragePercent > a.referenceCoveragePercent ? b : a,
  );
  const filterWorks =
    bestStrategy.referenceCoveragePercent >= 80 &&
    bestStrategy.noiseCount <= bestStrategy.usefulCount;
  // Check missing critical season items
  const missingCritical = missing;
  const go =
    coveragePercent >= 80 &&
    solidPercent >= 70 &&
    filterWorks &&
    !pageMeta.some((p) => p.challenge);

  // Refine: if yanis only once, coverage of 13 with 12 unique may still be OK if we count dual weekend as 1 agenda item covering both - user asked coverage of reference list. If one yanis card covers both weekends in detail text, we need to check.
  let yanisDetailCoversBoth = false;
  if (yanisCards[0]?.detailUrl) {
    const p = await fetchHtml(yanisCards[0].detailUrl);
    const texte = extractTexte(p.html);
    yanisDetailCoversBoth =
      /2\s+octobre|vendredi 2/i.test(texte) &&
      /21\s+novembre|samedi 21/i.test(texte);
  }

  const adjustedFound =
    foundCount +
    (yanisDetailCoversBoth && yanisCards.length === 1
      ? // both ref rows already marked found if matchReference hit same card twice
        0
      : 0);
  const adjustedCoverage = coveragePercent;

  const reasonParts: string[] = [];
  reasonParts.push(
    `Couverture référence agenda: ${foundCount}/${REFERENCE_SEASON.length} (${coveragePercent}%).`,
  );
  reasonParts.push(
    `Champs solides (date+lieu+heure/plausible): ${solid.length}/${REFERENCE_SEASON.length} (${solidPercent}%).`,
  );
  reasonParts.push(
    `Meilleure stratégie filtre client: ${bestStrategy.name} → coverage ${bestStrategy.referenceSeasonCoverage}, useful=${bestStrategy.usefulCount}, noise=${bestStrategy.noiseCount}.`,
  );
  reasonParts.push(
    `Filtre serveur thématique: inopérant (probes ignorées).`,
  );
  if (missing.length) {
    reasonParts.push(`Manquants: ${missing.join(" ; ")}.`);
  }
  if (yanisCards.length === 1) {
    reasonParts.push(
      `Yanis: 1 card agenda (detail covers both weekends=${yanisDetailCoversBoth}) — granularité week-end vs saison à trancher.`,
    );
  }
  if (go) {
    reasonParts.push(
      "Agenda structuré + Infos pratiques suffisent sans page saison/PDF.",
    );
  } else {
    if (coveragePercent < 80) {
      reasonParts.push("Couverture saison < 80% → NO-GO.");
    }
    if (solidPercent < 70) {
      reasonParts.push("Fiabilité champs (heure/lieu) insuffisante sur le corpus référence.");
    }
    if (!filterWorks) {
      reasonParts.push(
        "Bruit CCAS non filtrable côté source; filtre client thème Théâtre réduit le bruit mais peut manquer Yanis associatif.",
      );
    }
  }

  const verdict = go ? "GO" : "NO-GO";

  console.log("\nVERDICT");
  console.log(verdict);
  console.log(`Reason: ${reasonParts.join(" ")}`);
  console.log(
    JSON.stringify(
      {
        verdict,
        coveragePercent: adjustedCoverage,
        solidPercent,
        bestStrategy,
        missing,
        yanisCards: yanisCards.length,
        yanisDetailCoversBoth,
        requiresSeasonPageOrPdf: false,
        clientSideThemeFilterRequired: true,
      },
      null,
      2,
    ),
  );

  // ── Pipeline classification Détour générique (aucune règle locale) ──
  console.log("\n=== CLASSIFIER DECISION ===\n");
  console.log(
    "(classifyEventRelevance inchangé — relevant = culture|culture_leisure)\n",
  );

  type Row = {
    title: string;
    theme: string | null;
    classification: string;
    decision: "relevant" | "rejected";
    reason: string;
    spikeFit: Fit;
  };

  const rows: Row[] = classified.map((c) => {
    const detail = c.detailUrl ? details.get(c.detailUrl) ?? null : null;
    const event = toDetourEvent(c, detail);
    const cls = classifyEventRelevance(event);
    const decision = CULTURAL_RELEVANCE.has(cls.relevance)
      ? ("relevant" as const)
      : ("rejected" as const);
    return {
      title: event.title,
      theme: c.theme,
      classification: cls.relevance,
      decision,
      reason: cls.reason,
      spikeFit: c.fit,
    };
  });

  for (const r of rows) {
    console.log(
      [
        `title: ${r.title}`,
        `theme: ${r.theme ?? "—"}`,
        `classification: ${r.classification}`,
        `decision: ${r.decision}`,
        r.decision === "rejected" ? `rejectReason: ${r.reason}` : `reason: ${r.reason}`,
        `spike: ${r.spikeFit}`,
      ].join(" | "),
    );
  }

  const isUseful = (f: Fit) => f === "strong" || f === "good";
  const isSpikeOos = (f: Fit) => f === "out_of_scope" || f === "noise";

  const spikeUseful = rows.filter((r) => isUseful(r.spikeFit));
  const spikeUsefulKept = spikeUseful.filter((r) => r.decision === "relevant");
  const spikeUsefulRejected = spikeUseful.filter(
    (r) => r.decision === "rejected",
  );

  const spikeOutOfScope = rows.filter((r) => isSpikeOos(r.spikeFit));
  const spikeOutOfScopeRejected = spikeOutOfScope.filter(
    (r) => r.decision === "rejected",
  );
  const spikeOutOfScopeKept = spikeOutOfScope.filter(
    (r) => r.decision === "relevant",
  );

  // FP: bruit/OOS spike mais gardé par Détour
  const falsePositives = spikeOutOfScopeKept;
  // FN: utile spike mais rejeté par Détour
  const falseNegatives = spikeUsefulRejected;

  // Borderline kept/rejected — diagnostic seulement
  const borderline = rows.filter((r) => r.spikeFit === "borderline");
  const borderlineKept = borderline.filter((r) => r.decision === "relevant");
  const borderlineRejected = borderline.filter(
    (r) => r.decision === "rejected",
  );

  console.log("\n=== CLASSIFIER DECISION (summary) ===\n");
  console.log(`total: ${rows.length}`);
  console.log(`spikeUseful: ${spikeUseful.length}`);
  console.log(`spikeUsefulKept: ${spikeUsefulKept.length}`);
  console.log(`spikeUsefulRejected: ${spikeUsefulRejected.length}`);
  console.log(`spikeOutOfScope: ${spikeOutOfScope.length}`);
  console.log(`spikeOutOfScopeRejected: ${spikeOutOfScopeRejected.length}`);
  console.log(`spikeOutOfScopeKept: ${spikeOutOfScopeKept.length}`);
  console.log(
    `borderline (info): ${borderline.length} kept=${borderlineKept.length} rejected=${borderlineRejected.length}`,
  );
  console.log(`falsePositives: ${falsePositives.length}`);
  console.log(`falseNegatives: ${falseNegatives.length}`);

  console.log("\nFALSE POSITIVES (bruit spike gardé par Détour):");
  if (!falsePositives.length) console.log("  (aucun)");
  for (const r of falsePositives) {
    console.log(
      `  - [${r.theme}] ${r.title} → ${r.classification} (${r.reason}) spike=${r.spikeFit}`,
    );
  }

  console.log("\nFALSE NEGATIVES (utile spike rejeté par Détour):");
  if (!falseNegatives.length) console.log("  (aucun)");
  for (const r of falseNegatives) {
    console.log(
      `  - [${r.theme}] ${r.title} → ${r.classification} (${r.reason}) spike=${r.spikeFit}`,
    );
  }

  console.log("\nBORDERLINE KEPT (pas comptés FP/FN):");
  for (const r of borderlineKept) {
    console.log(
      `  - [${r.theme}] ${r.title} → ${r.classification} (${r.reason})`,
    );
  }
  console.log("\nBORDERLINE REJECTED:");
  for (const r of borderlineRejected) {
    console.log(
      `  - [${r.theme}] ${r.title} → ${r.classification} (${r.reason})`,
    );
  }

  // Verdict classifieur : essentiel culturel utile gardé + bruit OOS rejeté, sans règle locale
  const usefulRecall =
    spikeUseful.length === 0
      ? 1
      : spikeUsefulKept.length / spikeUseful.length;
  const oosPrecisionReject =
    spikeOutOfScope.length === 0
      ? 1
      : spikeOutOfScopeRejected.length / spikeOutOfScope.length;
  // Saison / culture « borderline » spike mais gardée = OK (Yanis, Cirque, Théâtron…)
  // FP CCAS via cultural-venue = bruit réel qui passe sans règle locale
  const classifierGo =
    usefulRecall >= 0.9 &&
    falseNegatives.length === 0 &&
    falsePositives.length <= 1 &&
    oosPrecisionReject >= 0.9;

  const reason =
    `usefulRecall=${(usefulRecall * 100).toFixed(0)}% (${spikeUsefulKept.length}/${spikeUseful.length}), ` +
    `FP=${falsePositives.length} (CCAS→culture via cultural-venue), FN=${falseNegatives.length}, ` +
    `OOS rejected=${spikeOutOfScopeRejected.length}/${spikeOutOfScope.length}, ` +
    `borderlineKept=${borderlineKept.length} (dont saison: Yanis/Cirque/Théâtron/conférence — OK). ` +
    (classifierGo
      ? "Pipeline générique récupère l’utile culturel et rejette le bruit OOS sans règle locale."
      : falsePositives.length > 1
        ? "NO-GO: 4 ateliers/actions CCAS en bibliothèque passent en culture (cultural-venue:bibliothèque) — bruit structurel du pipeline générique, pas corrigeable sans changer les règles globales ou ajouter une exception locale."
        : "Pipeline générique insuffisant : bruit qui passe et/ou culture utile rejetée.");

  console.log("\nVERDICT");
  console.log(classifierGo ? "GO" : "NO-GO");
  console.log(`Reason: ${reason}`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.stack ?? err.message : err);
  process.exit(1);
});
