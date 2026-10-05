# Mesure coût SQL Explorer

## Reproduction

```bash
npx tsx scripts/measure-explorer-sql-cost.mts --database-url "$EXPLORER_SQL_BENCH_DATABASE_URL" --repeats 5 --timeout-ms 30000
```

## Environnement

- now figé : `2026-10-05T13:58:46.812Z`
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
| 1. À venir, sans autre filtre | page 1 | 778 | 1ʳᵉ=161ms · n=5 · médiane=151ms · min=146.7ms · max=154.5ms | 1ʳᵉ=149.7ms · n=5 · médiane=152.8ms · min=148.3ms · max=158ms | 1ʳᵉ=315ms · n=5 · médiane=331.9ms · min=301.7ms · max=787.9ms |
| 1. À venir, sans autre filtre | append (curseur `eyJzdGFydEF0…`) | 778 | 1ʳᵉ=161.2ms · n=5 · médiane=151.6ms · min=145.9ms · max=152.2ms | 1ʳᵉ=150.4ms · n=5 · médiane=151.7ms · min=147.6ms · max=156.7ms | 1ʳᵉ=294.2ms · n=5 · médiane=315.2ms · min=278.5ms · max=345.2ms |
| 1. À venir, sans autre filtre | page éloignée (~5) | 778 | 1ʳᵉ=148.2ms · n=5 · médiane=147.1ms · min=142.1ms · max=152.8ms | 1ʳᵉ=164.7ms · n=5 · médiane=166.2ms · min=148.1ms · max=170.3ms | 1ʳᵉ=304.3ms · n=5 · médiane=290.6ms · min=282.5ms · max=304.2ms |
| 2. Période bornée avec résultats (this-month) | page 1 | 379 | 1ʳᵉ=75.2ms · n=5 · médiane=83.1ms · min=78.8ms · max=164ms | 1ʳᵉ=82.5ms · n=5 · médiane=87.7ms · min=84.7ms · max=204ms | 1ʳᵉ=168.5ms · n=5 · médiane=139.6ms · min=138ms · max=143.2ms |
| 2. Période bornée avec résultats (this-month) | append (curseur `eyJzdGFydEF0…`) | 379 | 1ʳᵉ=79.5ms · n=5 · médiane=83.5ms · min=78.3ms · max=149.7ms | 1ʳᵉ=81.4ms · n=5 · médiane=91ms · min=81.7ms · max=711.9ms | 1ʳᵉ=213.6ms · n=5 · médiane=106.7ms · min=84.2ms · max=157.3ms |
| 2. Période bornée avec résultats (this-month) | page éloignée (~5) | 379 | 1ʳᵉ=77.2ms · n=5 · médiane=79.5ms · min=77.3ms · max=83.1ms | 1ʳᵉ=85.1ms · n=5 · médiane=80.7ms · min=80.5ms · max=84.2ms | 1ʳᵉ=99ms · n=5 · médiane=85.5ms · min=81.3ms · max=365.7ms |
| 3. Ville et/ou catégorie (Orléans / Atelier) | page 1 | 122 | 1ʳᵉ=44.4ms · n=5 · médiane=44.1ms · min=43.2ms · max=65.7ms | 1ʳᵉ=45.7ms · n=5 · médiane=46.8ms · min=44.3ms · max=50.4ms | 1ʳᵉ=60.4ms · n=5 · médiane=50.1ms · min=45.5ms · max=54.7ms |
| 3. Ville et/ou catégorie (Orléans / Atelier) | append (curseur `eyJzdGFydEF0…`) | 122 | 1ʳᵉ=42.5ms · n=5 · médiane=44ms · min=43.7ms · max=46.5ms | 1ʳᵉ=45.5ms · n=5 · médiane=46.2ms · min=45.8ms · max=50.4ms | 1ʳᵉ=51.8ms · n=5 · médiane=50.2ms · min=48.5ms · max=55.5ms |
| 3. Ville et/ou catégorie (Orléans / Atelier) | page éloignée (~5) | 122 | 1ʳᵉ=44ms · n=5 · médiane=43.8ms · min=42.6ms · max=45.2ms | 1ʳᵉ=47.2ms · n=5 · médiane=46.9ms · min=46.2ms · max=47.6ms | 1ʳᵉ=51.2ms · n=5 · médiane=60.8ms · min=50.2ms · max=86.2ms |
| 4. Recherche textuelle fréquente (« atelier ») | page 1 | 123 | 1ʳᵉ=39.9ms · n=5 · médiane=40.4ms · min=39ms · max=41.9ms | 1ʳᵉ=42.6ms · n=5 · médiane=41.9ms · min=40.9ms · max=43.2ms | 1ʳᵉ=47.5ms · n=5 · médiane=44.5ms · min=43.5ms · max=46.6ms |
| 4. Recherche textuelle fréquente (« atelier ») | append (curseur `eyJzdGFydEF0…`) | 123 | 1ʳᵉ=42.8ms · n=5 · médiane=39.4ms · min=35.2ms · max=40.3ms | 1ʳᵉ=42.1ms · n=5 · médiane=41ms · min=38.7ms · max=42.6ms | 1ʳᵉ=46.7ms · n=5 · médiane=45.5ms · min=42ms · max=48.2ms |
| 4. Recherche textuelle fréquente (« atelier ») | page éloignée (~5) | 123 | 1ʳᵉ=39.1ms · n=5 · médiane=39.4ms · min=37.1ms · max=39.9ms | 1ʳᵉ=41.1ms · n=5 · médiane=41.6ms · min=40.8ms · max=74ms | 1ʳᵉ=220.5ms · n=5 · médiane=46.3ms · min=45.6ms · max=56ms |
| 5. Recherche rare / sans résultat (« zzzxqdetourrare ») | page 1 | 0 | 1ʳᵉ=23.8ms · n=5 · médiane=23.6ms · min=22ms · max=25.1ms | 1ʳᵉ=21.2ms · n=5 · médiane=23.5ms · min=21.9ms · max=24.1ms | 1ʳᵉ=26.1ms · n=5 · médiane=25.6ms · min=24.2ms · max=27.9ms |
| 5. Recherche rare / sans résultat (« zzzxqdetourrare ») | append | — | (pas de page suivante) | — | — |

## EXPLAIN (ANALYZE, BUFFERS) — cas les plus coûteux

Plans distincts des chronométrages ordinaires (une exécution ANALYZE chacun).

### 1. À venir, sans autre filtre — COUNT

- planning=1.149 ms · execution=130.838 ms
- WindowAgg×1 · Seq Scan: events · Sort: quicksort
- buffers shared hit=181 read=0
- pas de temp blocks observés
- nœuds (ordre parcours): Aggregate → Subquery Scan → WindowAgg → Sort → Seq Scan

### 1. À venir, sans autre filtre — PAGE

- planning=1.059 ms · execution=123.957 ms
- WindowAgg×1 · Seq Scan: events, event_availability · Sort: top-N heapsort, quicksort
- buffers shared hit=182 read=0
- pas de temp blocks observés
- nœuds (ordre parcours): Limit → Sort → Subquery Scan → WindowAgg → Hash Join → Seq Scan → Hash

### 2. Période bornée avec résultats (this-month) — COUNT

- planning=0.703 ms · execution=58.145 ms
- WindowAgg×1 · Seq Scan: events · Sort: quicksort
- buffers shared hit=173 read=0
- pas de temp blocks observés
- nœuds (ordre parcours): Aggregate → Subquery Scan → WindowAgg → Sort → Seq Scan

### 2. Période bornée avec résultats (this-month) — PAGE

- planning=1.053 ms · execution=59.733 ms
- WindowAgg×1 · Seq Scan: events, event_availability · Sort: top-N heapsort, quicksort
- buffers shared hit=174 read=0
- pas de temp blocks observés
- nœuds (ordre parcours): Limit → Sort → Subquery Scan → WindowAgg → Hash Join → Seq Scan → Hash

## Parcours produit (AFTER) — append historique vs optimisé

Même cible, `now`, filtres upcoming, curseur et limite. Compte le **nombre de requêtes SQL** du parcours applicatif (pas seulement la page seule).

| Variante append | requêtes SQL | 1ʳᵉ | n | médiane | min | max |
|---|---:|---:|---:|---:|---:|---:|
| historique count+page | 2 | 153.1 | 5 | 156.2 | 147.7 | 160.7 |
| optimisé page seule | 1 | 149.2 | 5 | 149.5 | 146.3 | 153.3 |

- Connexion de **cette** exécution : **postgres-pooler** (ne pas croiser avec un rapport AVANT sur un autre endpoint).
- Delta médiane (historique − optimisé) ≈ **6.7 ms** sur le même endpoint.
- Pour référence locale append upcoming (section Mesures) : count=151.6ms, page=151.7ms, combiné=315.2ms.

## Lecture des résultats

- Upcoming append : count médiane **151.6 ms**, page **151.7 ms**, combiné **315.2 ms**.
- Si append = page seule, latence attendue ≈ **151.7 ms** (gain observé vs combiné ≈ **163.5 ms**). Le ratio des médianes ne prouve pas à lui seul une saturation CPU.

## Limites

- Banc unique, corpus existant ; **pas** un cache froid ni un p95 production.
- Première exécution isolée ; médiane sur répétitions bornées uniquement.
- Frise / Explorer : total capturé en 1ʳᵉ page ; append ne recalcule plus le count.
- Ne pas comparer en % un rapport AVANT (souvent endpoint direct) et une mesure pooler sans le préciser.

## Contrat produit (AFTER)

- Première page / filtres / reload : **2 requêtes** (count + page), `totalCount: number`.
- Append (curseur valide) : **1 requête** (page), `totalCount: null` ; le client conserve le total.

_Note : rapport APRES du levier « skip count » sur append. SQL de page inchangé ; le parcours produit n’exécute plus le count avec un curseur valide._
