# Mesure coût SQL Explorer

## Reproduction

```bash
node --conditions=react-server --import tsx scripts/measure-explorer-sql-cost.mts --database-url "$EXPLORER_SQL_BENCH_DATABASE_URL" --repeats 3 --timeout-ms 30000
```

## Environnement

- now figé : `2026-10-05T15:19:23.001Z`
- PostgreSQL : 18.6 (4e955f5)
- connexion : postgres-pooler (URL non journalisée)
- statement_timeout : 30000 ms ; transaction read-only
- volume events : total=1272, active=785, active∩upcoming=785
- page size Explorer : 12
- index events : events_active_city_key_idx, events_active_product_category_idx, events_active_start_at_id_idx, events_active_start_at_idx, events_adapter_last_seen_idx, events_pkey
- corpus choisi : city=`Orléans`, category=`Atelier`, when borné=`this-month`, search fréquente=`atelier`

## Mesures (ms)

La colonne **combiné** chronomètre `Promise.all([count, page])` comme l’app — ce n’est **pas** la somme count+page.

| Scénario | Étape | totalCount | count | page | combiné (parallèle) |
|---|---|---:|---|---|---|
| 1. À venir, sans autre filtre | page 1 | 778 | 1ʳᵉ=161.2ms · n=3 · médiane=155.2ms · min=149.3ms · max=161.2ms | 1ʳᵉ=160.5ms · n=3 · médiane=157.9ms · min=151.1ms · max=162ms | 1ʳᵉ=391.6ms · n=3 · médiane=322ms · min=282.8ms · max=496.2ms |
| 1. À venir, sans autre filtre | append (curseur `eyJzdGFydEF0…`) | 778 | 1ʳᵉ=146.6ms · n=3 · médiane=147.5ms · min=143.2ms · max=227.6ms | 1ʳᵉ=150.5ms · n=3 · médiane=178.3ms · min=170.6ms · max=186.3ms | 1ʳᵉ=278.4ms · n=3 · médiane=298.1ms · min=284ms · max=346.7ms |
| 1. À venir, sans autre filtre | page éloignée (~5) | 778 | 1ʳᵉ=154.1ms · n=3 · médiane=154.2ms · min=147.5ms · max=154.6ms | 1ʳᵉ=163.8ms · n=3 · médiane=160.4ms · min=158.1ms · max=161.4ms | 1ʳᵉ=374.9ms · n=3 · médiane=352ms · min=327ms · max=631.6ms |
| 2. Période bornée avec résultats (this-month) | page 1 | 379 | 1ʳᵉ=81.5ms · n=3 · médiane=82.3ms · min=81.1ms · max=83ms | 1ʳᵉ=87.7ms · n=3 · médiane=84.6ms · min=84.1ms · max=85.4ms | 1ʳᵉ=145.4ms · n=3 · médiane=143.9ms · min=143.1ms · max=144.6ms |
| 2. Période bornée avec résultats (this-month) | append (curseur `eyJzdGFydEF0…`) | 379 | 1ʳᵉ=82.1ms · n=3 · médiane=78.5ms · min=77ms · max=79.6ms | 1ʳᵉ=82.8ms · n=3 · médiane=83.3ms · min=81.7ms · max=85.2ms | 1ʳᵉ=146.7ms · n=3 · médiane=150.8ms · min=140.4ms · max=161.2ms |
| 2. Période bornée avec résultats (this-month) | page éloignée (~5) | 379 | 1ʳᵉ=80.6ms · n=3 · médiane=82.5ms · min=81.2ms · max=83ms | 1ʳᵉ=84.7ms · n=3 · médiane=85.2ms · min=81.7ms · max=86.4ms | 1ʳᵉ=167.2ms · n=3 · médiane=297.9ms · min=141.8ms · max=491.5ms |
| 3. Ville et/ou catégorie (Orléans / Atelier) | page 1 | 122 | 1ʳᵉ=65ms · n=3 · médiane=45ms · min=44.8ms · max=48.3ms | 1ʳᵉ=49.6ms · n=3 · médiane=53.7ms · min=51.5ms · max=56.2ms | 1ʳᵉ=73.4ms · n=3 · médiane=69.9ms · min=69.7ms · max=74ms |
| 3. Ville et/ou catégorie (Orléans / Atelier) | append (curseur `eyJzdGFydEF0…`) | 122 | 1ʳᵉ=46.2ms · n=3 · médiane=43.3ms · min=43.3ms · max=47.3ms | 1ʳᵉ=45.9ms · n=3 · médiane=49ms · min=45.4ms · max=53ms | 1ʳᵉ=73.2ms · n=3 · médiane=72.2ms · min=68.6ms · max=73ms |
| 3. Ville et/ou catégorie (Orléans / Atelier) | page éloignée (~5) | 122 | 1ʳᵉ=51ms · n=3 · médiane=47.1ms · min=46.4ms · max=49.9ms | 1ʳᵉ=50.5ms · n=3 · médiane=47.1ms · min=46.8ms · max=49.4ms | 1ʳᵉ=73ms · n=3 · médiane=197ms · min=75.6ms · max=280.7ms |
| 4. Recherche textuelle fréquente (« atelier ») | page 1 | 123 | 1ʳᵉ=40.5ms · n=3 · médiane=40.4ms · min=39ms · max=40.6ms | 1ʳᵉ=47ms · n=3 · médiane=45.1ms · min=44.2ms · max=48.9ms | 1ʳᵉ=66.7ms · n=3 · médiane=115.3ms · min=63.5ms · max=453.7ms |
| 4. Recherche textuelle fréquente (« atelier ») | append (curseur `eyJzdGFydEF0…`) | 123 | 1ʳᵉ=41.3ms · n=3 · médiane=43.8ms · min=40.3ms · max=47ms | 1ʳᵉ=43.8ms · n=3 · médiane=44.1ms · min=42.4ms · max=44.7ms | 1ʳᵉ=61.2ms · n=3 · médiane=68ms · min=67.1ms · max=69.6ms |
| 4. Recherche textuelle fréquente (« atelier ») | page éloignée (~5) | 123 | 1ʳᵉ=42.1ms · n=3 · médiane=41.5ms · min=40.3ms · max=42.8ms | 1ʳᵉ=45.5ms · n=3 · médiane=44.3ms · min=40.4ms · max=47.2ms | 1ʳᵉ=71.1ms · n=3 · médiane=66.4ms · min=63.5ms · max=71.5ms |
| 5. Recherche rare / sans résultat (« zzzxqdetourrare ») | page 1 | 0 | 1ʳᵉ=25ms · n=3 · médiane=23.9ms · min=22.9ms · max=26.9ms | 1ʳᵉ=23.9ms · n=3 · médiane=23.7ms · min=23.1ms · max=24.4ms | 1ʳᵉ=27ms · n=3 · médiane=29ms · min=26.8ms · max=29.4ms |
| 5. Recherche rare / sans résultat (« zzzxqdetourrare ») | append | — | (pas de page suivante) | — | — |

## EXPLAIN (ANALYZE, BUFFERS) — cas les plus coûteux

Plans distincts des chronométrages ordinaires (une exécution ANALYZE chacun).

### 1. À venir, sans autre filtre — COUNT

- planning=0.702 ms · execution=123.741 ms
- WindowAgg×1 · Seq Scan: events · Sort: quicksort
- buffers shared hit=181 read=0
- pas de temp blocks observés
- nœuds (ordre parcours): Aggregate → Subquery Scan → WindowAgg → Sort → Seq Scan

### 1. À venir, sans autre filtre — PAGE

- planning=0.79 ms · execution=125.622 ms
- WindowAgg×1 · Seq Scan: events, event_availability · Sort: top-N heapsort, quicksort
- buffers shared hit=182 read=0
- pas de temp blocks observés
- nœuds (ordre parcours): Limit → Sort → Subquery Scan → WindowAgg → Hash Join → Seq Scan → Hash

### 2. Période bornée avec résultats (this-month) — COUNT

- planning=0.719 ms · execution=56.754 ms
- WindowAgg×1 · Seq Scan: events · Sort: quicksort
- buffers shared hit=173 read=0
- pas de temp blocks observés
- nœuds (ordre parcours): Aggregate → Subquery Scan → WindowAgg → Sort → Seq Scan

### 2. Période bornée avec résultats (this-month) — PAGE

- planning=1.07 ms · execution=56.82 ms
- WindowAgg×1 · Seq Scan: events, event_availability · Sort: top-N heapsort, quicksort
- buffers shared hit=174 read=0
- pas de temp blocks observés
- nœuds (ordre parcours): Limit → Sort → Subquery Scan → WindowAgg → Hash Join → Seq Scan → Hash

## Parcours produit — listExplorerEvents (observé)

Appels réels à `listExplorerEvents` via client injectable. **Durées** = uniquement l’appel applicatif (requêtes métier) : acquisition, SET, BEGIN READ ONLY, ROLLBACK et release sont **hors** chrono. Comptage des requêtes métier sur la même exécution chronométrée ; SET/BEGIN/ROLLBACK exclus du compteur.

| Variante | requêtes métier observées | totalCount | 1ʳᵉ (ms) | n | médiane | min | max |
|---|---:|---|---:|---:|---:|---:|---:|
| listExplorerEvents 1ʳᵉ page | 2 | 778 | 281.8 | 3 | 350.7 | 299.5 | 392.2 |
| listExplorerEvents append (curseur `eyJzdGFydEF0…`) | 1 | null | 334.3 | 3 | 297.4 | 160 | 339.6 |
| scénario SQL historique count+page (témoin, même curseur) | 2 | — | 348.3 | 3 | 347.6 | 274 | 347.9 |

- Contrôle banc : 1ʳᵉ page = **2** requêtes + total numérique ; append = **1** requête + `totalCount: null` (échec dur si divergence).
- Append : variantes **alternées** (app ↔ historique) sous même cible, filtres upcoming, limite, curseur et `now`.
- Connexion de **cette** exécution : **postgres-pooler** (ne pas croiser avec un rapport AVANT sur un autre endpoint).
- Delta médiane append (historique SQL − listExplorerEvents) ≈ **50.2 ms** — latence observée sur ce banc uniquement, pas un gain UX extrapolé.

## Lecture des résultats

- Parcours app (upcoming) : 1ʳᵉ page médiane **350.7 ms** (2 req), append médiane **297.4 ms** (1 req) — hors setup/teardown de session.
- Témoin SQL historique append : médiane **347.6 ms** (2 req) — mêmes frontières de chrono.
- Section Mesures SQL (builders, hors listExplorerEvents) — append upcoming : count médiane **147.5 ms**, page **178.3 ms**, combiné **298.1 ms**.
- Le ratio des médianes ne prouve pas à lui seul une saturation CPU ; pas d’extrapolation UX.

## Limites

- Banc unique, corpus existant ; **pas** un cache froid ni un p95 production.
- Première exécution isolée ; médiane sur répétitions bornées uniquement.
- Parcours produit : deux connexions READ ONLY pré-ouvertes pour ne pas sérialiser count+page ; le chrono n’inclut pas connect / SET / BEGIN / ROLLBACK / release.
- Ne pas comparer en % un rapport AVANT (souvent endpoint direct) et une mesure pooler sans le préciser.

## Contrat produit (observé)

- Première page / filtres / reload : **2 requêtes** métier, `totalCount: number`.
- Append (curseur valide) : **1 requête** métier, `totalCount: null` ; le client conserve le total.

_Note : rapport APRES — parcours mesuré via `listExplorerEvents` ; le témoin « scénario SQL historique » rejoue count+page sans l’action applicative._
