# Mesure coût SQL Explorer

## Reproduction

```bash
npx tsx scripts/measure-explorer-sql-cost.mts --database-url "$EXPLORER_SQL_BENCH_DATABASE_URL" --repeats 3 --timeout-ms 30000
```

## Environnement

- now figé : `2026-10-05T13:06:17.829Z`
- PostgreSQL : 18.6 (4e955f5)
- connexion : postgres-direct (URL non journalisée)
- statement_timeout : 30000 ms ; transaction read-only
- volume events : total=1272, active=785, active∩upcoming=785
- page size Explorer : 12
- index events : events_active_city_key_idx, events_active_product_category_idx, events_active_start_at_id_idx, events_active_start_at_idx, events_adapter_last_seen_idx, events_pkey
- corpus choisi : city=`Orléans`, category=`Atelier`, when borné=`this-month`, search fréquente=`atelier`

## Mesures (ms)

La colonne **combiné** chronomètre `Promise.all([count, page])` comme l’app — ce n’est **pas** la somme count+page.

| Scénario | Étape | totalCount | count | page | combiné (parallèle) |
|---|---|---:|---|---|---|
| 1. À venir, sans autre filtre | page 1 | 778 | 1ʳᵉ=157.6ms · n=3 · médiane=145ms · min=143.6ms · max=151.1ms | 1ʳᵉ=149.7ms · n=3 · médiane=151.6ms · min=151.3ms · max=158.1ms | 1ʳᵉ=303.7ms · n=3 · médiane=320ms · min=289ms · max=493.5ms |
| 1. À venir, sans autre filtre | append (curseur `eyJzdGFydEF0…`) | 778 | 1ʳᵉ=159.1ms · n=3 · médiane=146ms · min=145.7ms · max=152.1ms | 1ʳᵉ=150.4ms · n=3 · médiane=157.4ms · min=151ms · max=160.3ms | 1ʳᵉ=288.8ms · n=3 · médiane=281.9ms · min=278.4ms · max=320.8ms |
| 1. À venir, sans autre filtre | page éloignée (~5) | 778 | 1ʳᵉ=146.2ms · n=3 · médiane=150.1ms · min=144.8ms · max=151ms | 1ʳᵉ=153.2ms · n=3 · médiane=166.3ms · min=149ms · max=174.4ms | 1ʳᵉ=356.3ms · n=3 · médiane=298.6ms · min=298.1ms · max=331.7ms |
| 2. Période bornée avec résultats (this-month) | page 1 | 379 | 1ʳᵉ=654.1ms · n=3 · médiane=83.3ms · min=80.5ms · max=84.1ms | 1ʳᵉ=98.6ms · n=3 · médiane=80.4ms · min=79.8ms · max=87.2ms | 1ʳᵉ=156.5ms · n=3 · médiane=145.7ms · min=138.4ms · max=145.8ms |
| 2. Période bornée avec résultats (this-month) | append (curseur `eyJzdGFydEF0…`) | 379 | 1ʳᵉ=82.3ms · n=3 · médiane=80.1ms · min=78ms · max=81.4ms | 1ʳᵉ=85ms · n=3 · médiane=84.2ms · min=81.6ms · max=85.5ms | 1ʳᵉ=140.8ms · n=3 · médiane=140ms · min=138.8ms · max=149.9ms |
| 2. Période bornée avec résultats (this-month) | page éloignée (~5) | 379 | 1ʳᵉ=80ms · n=3 · médiane=83.4ms · min=78.9ms · max=97.5ms | 1ʳᵉ=84.1ms · n=3 · médiane=82.7ms · min=79.7ms · max=85.4ms | 1ʳᵉ=155.8ms · n=3 · médiane=140.6ms · min=139.6ms · max=190.3ms |
| 3. Ville et/ou catégorie (Orléans / Atelier) | page 1 | 122 | 1ʳᵉ=45.6ms · n=3 · médiane=48.6ms · min=46.1ms · max=52ms | 1ʳᵉ=47.5ms · n=3 · médiane=48.5ms · min=46.7ms · max=48.7ms | 1ʳᵉ=74.5ms · n=3 · médiane=71ms · min=67.7ms · max=71.6ms |
| 3. Ville et/ou catégorie (Orléans / Atelier) | append (curseur `eyJzdGFydEF0…`) | 122 | 1ʳᵉ=45.1ms · n=3 · médiane=47.5ms · min=44.2ms · max=48ms | 1ʳᵉ=47.2ms · n=3 · médiane=46.1ms · min=44.8ms · max=47.9ms | 1ʳᵉ=68.9ms · n=3 · médiane=73.7ms · min=72.2ms · max=78.5ms |
| 3. Ville et/ou catégorie (Orléans / Atelier) | page éloignée (~5) | 122 | 1ʳᵉ=44.8ms · n=3 · médiane=45.4ms · min=43.3ms · max=48.7ms | 1ʳᵉ=49.9ms · n=3 · médiane=46.6ms · min=46.1ms · max=49.3ms | 1ʳᵉ=78ms · n=3 · médiane=74.4ms · min=70.6ms · max=76.4ms |
| 4. Recherche textuelle fréquente (« atelier ») | page 1 | 123 | 1ʳᵉ=39.2ms · n=3 · médiane=40.2ms · min=39.9ms · max=41.9ms | 1ʳᵉ=41.6ms · n=3 · médiane=42.8ms · min=40.8ms · max=43.4ms | 1ʳᵉ=124ms · n=3 · médiane=175ms · min=166.4ms · max=323ms |
| 4. Recherche textuelle fréquente (« atelier ») | append (curseur `eyJzdGFydEF0…`) | 123 | 1ʳᵉ=156.1ms · n=3 · médiane=41.9ms · min=41ms · max=106.5ms | 1ʳᵉ=44.2ms · n=3 · médiane=42.3ms · min=41.8ms · max=44.9ms | 1ʳᵉ=61.6ms · n=3 · médiane=60.9ms · min=60.8ms · max=63ms |
| 4. Recherche textuelle fréquente (« atelier ») | page éloignée (~5) | 123 | 1ʳᵉ=36.9ms · n=3 · médiane=40.7ms · min=40.3ms · max=46.6ms | 1ʳᵉ=38.2ms · n=3 · médiane=41.2ms · min=41ms · max=42.2ms | 1ʳᵉ=63.4ms · n=3 · médiane=60.7ms · min=60ms · max=64ms |
| 5. Recherche rare / sans résultat (« zzzxqdetourrare ») | page 1 | 0 | 1ʳᵉ=24.8ms · n=3 · médiane=23.2ms · min=23ms · max=24ms | 1ʳᵉ=22.7ms · n=3 · médiane=23ms · min=21.9ms · max=24ms | 1ʳᵉ=27.8ms · n=3 · médiane=28ms · min=26.7ms · max=28.1ms |
| 5. Recherche rare / sans résultat (« zzzxqdetourrare ») | append | — | (pas de page suivante) | — | — |

## EXPLAIN (ANALYZE, BUFFERS) — cas les plus coûteux

Plans distincts des chronométrages ordinaires (une exécution ANALYZE chacun).

### 1. À venir, sans autre filtre — COUNT

- planning=0.937 ms · execution=123.681 ms
- WindowAgg×1 · Seq Scan: events · Sort: quicksort
- buffers shared hit=905 read=0
- pas de temp blocks observés
- nœuds (ordre parcours): Aggregate → Subquery Scan → WindowAgg → Sort → Seq Scan

### 1. À venir, sans autre filtre — PAGE

- planning=1.137 ms · execution=129.69 ms
- WindowAgg×1 · Seq Scan: events, event_availability · Sort: top-N heapsort, quicksort
- buffers shared hit=1261 read=0
- pas de temp blocks observés
- nœuds (ordre parcours): Limit → Sort → Subquery Scan → WindowAgg → Hash Join → Seq Scan → Hash

### 4. Recherche textuelle fréquente (« atelier ») — COUNT

- planning=0.866 ms · execution=17.475 ms
- WindowAgg×1 · Seq Scan: events · Sort: quicksort
- buffers shared hit=905 read=0
- pas de temp blocks observés
- nœuds (ordre parcours): Aggregate → Subquery Scan → WindowAgg → Sort → Seq Scan

### 4. Recherche textuelle fréquente (« atelier ») — PAGE

- planning=1.233 ms · execution=18.331 ms
- WindowAgg×1 · Seq Scan: events, event_availability · Sort: top-N heapsort, quicksort
- buffers shared hit=1275 read=0
- pas de temp blocks observés
- nœuds (ordre parcours): Limit → Sort → Subquery Scan → WindowAgg → Hash Join → Seq Scan → Hash

## Lecture des résultats

- Upcoming append : count médiane **146 ms**, page **157.4 ms**, combiné parallèle **281.9 ms**.
- Rapport count/combiné (append) ≈ **52 %** — ce n’est pas directement la latence économisable.
- Facteur parallélisme combiné/max(count,page) ≈ **1.79** (≈1 = bon overlap, ≈2 = sérialisation CPU/I/O).
- Si on saute le count en append, latence attendue ≈ page seule (**157.4 ms**), gain estimé sur le combiné ≈ **124.5 ms** (44 %) — pas un ÷2 automatique du parcours utilisateur.

## Limites

- Banc unique, corpus existant, connexion éventuellement pooled ; **pas** un cache froid ni un p95 production.
- Première exécution isolée ; médiane sur répétitions bornées uniquement.
- Frise partage `loadExplorerEvents` (fenêtre `from`/`to` + pagination jusqu’au cap) : tout changement de contrat count/total doit rester compatible.

## Recommandation (une seule)

**Compter à la première page, conserver `totalCount` pendant les appends (mêmes filtres).** Sur ce banc, count et page coûtent à peu près autant et le `Promise.all` se comporte presque comme une somme (peu d’overlap) : retirer le count aux appends rapproche la latence de la page seule (~44 % du combiné mesuré), sans changer le SQL de dédup. Implications : total figé jusqu’au changement de filtres/reload ; recalcul dès reload/filtre ; frise, qui pagine déjà une fenêtre `from`/`to` via le même contrat, doit continuer à traiter `totalCount` comme un snapshot de première réponse (pas un compteur live à chaque page). Ne pas promettre une latence ÷2 côté UX globale.

_Note : cette itération ne modifie pas le SQL produit, les actions, les hooks ni les index._
