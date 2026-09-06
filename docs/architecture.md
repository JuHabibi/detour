# Architecture Détour

Radar culturel local (Orléans et environs). Doc alignée sur le **code actuel** du dépôt.

## 1. Vue d’ensemble

En production ciblée (`DETOUR_EVENT_SOURCE=database`), les sources externes ne sont touchées que par le sync ; la home lit PostgreSQL puis applique le métier Détour / IA.

```
Sources externes (Opendatasoft Orléans / données OpenAgenda, iCal Saran, …)
        │
        ▼
  Sync planifié / manuel
  (cron Vercel ou POST interne)
        │
        ▼
    PostgreSQL
    (events, source_syncs)
        │
        ▼
  createHomeEventSource()  →  DatabaseEventSourceAdapter
        │
        ▼
     EventService
   (fraîcheur → classif → dédup → ranking → shortlist → IA → éditorial)
        │
        ▼
  mapDetourEventToEventItem  →  HomePage (EventItem)
```

Mode `live` (comportement par défaut lorsque `DETOUR_EVENT_SOURCE` est absent) : la home lit encore Orléans+Saran via composite + cache d’ingestion — voir §11. La production ciblée doit rester explicitement en `database`.

## 2. Les deux flux principaux

### A. Synchronisation

```
GET  /api/cron/event-sync      (CRON_SECRET, vercel.json → 0 5 * * * UTC)
POST /api/internal/event-sync  (EVENT_SYNC_SECRET)
        │
        ▼
runDetourEventSync()
        │
        ▼
createDetourSyncSources()     → OrleansEventAdapter, SaranEventAdapter
        │
        ▼
syncEventSources()            → une source après l’autre, erreurs isolées
        │
        ▼
syncEventSource(adapterId)
  1. ensureSourceRow
  2. tryAcquireLease (token UUID, TTL 20 min)
  3. fetchUpcomingEvents hors transaction  (HTTP source)
  4. garde empty_corpus si corpus déjà actif et fetch vide
  5. BEGIN → lockAndVerifyLease → upsertMany → deactivateNotSeenSince
     → markSuccess → COMMIT
```

Points clés :

- **Lease** : `source_syncs.sync_lock_token` + `sync_locked_until` ; vérifié à nouveau avant écriture (`lockAndVerifyLease`). Skip si busy / lost lease.
- **Isolation** : une source en erreur ne stoppe pas les suivantes (`syncEventSources` catch + `SyncResult`).
- **Upsert** : événements normalisés `DetourEvent` → table `events` (`adapter_id`, `last_seen_at` = marqueur de sync).
- **Désactivation** : `deactivateNotSeenSince` — actifs non revus dans ce sync → `is_active = false`.
- **Fenêtre** : 180 jours (`runDetourEventSync` et `app/page.tsx`).

#### Intégrité des snapshots source

La désactivation des événements absents suppose que le fetch d’un adapter représente un snapshot complet de la fenêtre demandée.

Un adapter ne doit donc jamais retourner silencieusement un corpus partiel. En cas d’échec HTTP, pagination incomplète ou réponse incohérente, le sync doit échouer avant l’écriture / désactivation.

L’adapter Orléans vérifie la cohérence de `total_count` et refuse une pagination incomplète avant que le moteur de sync puisse effectuer des désactivations.

Fichiers : `src/application/event-sync/*`, `src/infrastructure/create-detour-sync-sources.ts`, `src/infrastructure/db/*`, `src/app/api/cron|internal/event-sync/`.

### B. Lecture Home

```
app/page.tsx
  → createHomeEventSource()          # create-detour-event-source.ts
  → EventService.getUpcomingEvents
  → map* → HomePage + debugMeta
```

En mode **`database`** :

```
DatabaseEventSourceAdapter
  → listUpcomingActiveWithAdapter (PG, is_active)
  → EventService pipeline
  → UI
```

La home **ne contacte pas** OpenAgenda / Saran dans ce mode.

Pipeline `EventService` (détail §5) : ingestion → fraîcheur → classification → dédup → ranking → shortlist IA → assessment/cache (selon config) → sélection éditoriale → planning → résultat.

## 3. Responsabilité des dossiers

| Dossier | Rôle |
|---------|------|
| `src/app` | Routes Next (page, actions, API cron/sync). Composition root UI. |
| `src/application` | Cas d’usage : `EventService`, mapping UI, meta debug. |
| `src/application/ai` | Construction du corpus shortlist envoyé à l’IA. |
| `src/application/debug` | Audits Saran / couverture V1 — hors règles produit. |
| `src/application/ingestion` | Shape d’ingestion + stats par adapter. |
| `src/application/event-sync` | Moteur de sync PG (lease, upsert, multi-sources). |
| `src/domain/events` | Modèle `DetourEvent`, classif, dédup, fraîcheur. |
| `src/domain/editorial` | Highlights, planning, badges, type assessment IA. |
| `src/domain/time` | Filtres `WhenFilter` (Europe/Paris). |
| `src/domain/geo` | Distance / fallbacks de coordonnées. |
| `src/infrastructure` | Adapters, factories home/sync, caches d’ingestion. |
| `src/infrastructure/ai` | Provider OpenAI, DTO, parse, cache assessments. |
| `src/infrastructure/db` | Pool `pg`, repositories events / source_syncs. |
| `src/infrastructure/sources` | Orléans, Saran, lecture `database`. |
| `src/components` | UI React (HomePage, cartes, filtres, debug panel). |
| `src/config` | Flags AI, mode source, catégories, ville. |
| `src/data` | View models UI (`EventItem`, etc.) — pas de règles métier. |
| `src/lib` | Utilitaires UI (`cn`). |

## 4. Modèle central

`DetourEvent` (`src/domain/events/event.ts`) est le modèle normalisé unique :

- **adapters** (Orléans, Saran, …) → `DetourEvent`
- **DB** stocke les champs normalisés (+ `adapter_id`, `is_active`, `last_seen_at`)
- **domaine** (classif, dédup, ranking, …) travaille sur `DetourEvent`
- **UI** reçoit `EventItem` via `mapDetourEventToEventItem` / highlights

`relevance` / `relevanceReason` sont calculés par le métier, pas fournis comme vérité par la source.

## 5. Pipeline métier EventService

`EventService` (`src/application/event.service.ts`) **orchestre** ; il ne contient pas les algorithmes (scores, seuils, matching).

1. **ingestion** — `ingestRaw` (API riche ou `fetch` + `ingestionFromPlainEvents`)
2. **freshness** — `filterStillActiveEvents`
3. **classification** — `classifyEventRelevance`
4. **dedup** — `deduplicateEvents`
5. **deterministic ranking** — `rankDetourHighlightCandidates`
6. **AI shortlist** — `buildAiHighlightShortlist`
7. **assessment / cache** — `assessHighlightsCached` + provider (modes auto/manual/disabled)
8. **editorial selection** — `selectAiDetourHighlights` ou fallback `selectDetourHighlights`
9. **planning** — `selectPlanningEvents`
10. **result** — `UpcomingEventsResult` (+ stats / debug)

Dette connue, non bloquante à ce stade : debug Saran encore composé dans `composeResult` ; options de cache IA (readThrough / invalidate) encore visibles sur le service.

## 6. IA

| Couche | Contenu |
|--------|---------|
| `domain/editorial/` | `AiHighlightAssessment`, `selectAiDetourHighlights`, badges, planning |
| `application/ai/` | `buildAiHighlightShortlist` (+ tailles de buckets) |
| `infrastructure/ai/` | provider OpenAI, `highlight-assessment-input`, parser, cache |

`EventService` ne connaît **pas** : system prompt, parsing JSON brut, batch size HTTP, shape DTO provider.

Entrée page : `createHighlightAssessmentProvider()` + cache Next (`next-ai-assessment-cache`). Sans clé → noop → fallback déterministe.

## 7. Base de données

Migrations : `db/migrations/` (dbmate). Client : `pg` standard (`infrastructure/db/postgres.ts`) — **pas** de SDK Neon dans le métier ; `DATABASE_URL` (souvent pooled Neon en prod).

**`events`** : id, adapter_id, champs DetourEvent, `is_active`, `last_seen_at`, timestamps.

**`source_syncs`** : une ligne par adapter — `last_attempt_at`, `last_success_at`, status, `fetched_count`, erreurs safe, `sync_lock_token` / `sync_locked_until`.

## 8. Sécurité / invariants

- `DATABASE_URL` server-only (`import "server-only"` sur le pool) — jamais `NEXT_PUBLIC_`.
- SQL paramétré dans les repositories.
- Home en mode `database` : pas d’HTTP vers les agendas.
- **Aucun** fallback automatique `database` → `live` ; valeur invalide de `DETOUR_EVENT_SOURCE` → throw.
- Sync : fetch HTTP **hors** transaction ; écritures après re-vérification du lease.
- Une source en échec n’empêche pas les autres.
- Produit / IA : pas d’invention de rareté/scarcity « inventée » (contraintes prompt + badges basés sur scores/raisons explicites).

Auth sync : Bearer timing-safe (`CRON_SECRET` / `EVENT_SYNC_SECRET`).

## 9. Ajouter une nouvelle source

Exemple Ingré :

1. Adapter + mapper dans `src/infrastructure/sources/ingre/` → `DetourEvent`
2. Enregistrer dans `createDetourSyncSources()`
3. Tests mapper / adapter
4. Sync DB (cron ou POST interne)
5. Vérifier classif / dédup sur le corpus
6. **Aucun** changement requis dans `EventService`

Les nouvelles sources **alimentent la DB**. La home ne doit pas appeler leur API directement (mode `database`).

## 10. Où modifier quoi ?

| Besoin | Emplacement |
|--------|-------------|
| Classification culturelle | `domain/events/classify-event-relevance` |
| Catégorie produit | `domain/events/classify-event-category` |
| Dédup | `domain/events/deduplicate-events` |
| « Faites un détour » | `domain/editorial/select-detour-highlights` / `select-ai-detour-highlights` |
| « À prévoir » | `domain/editorial/select-planning-events` |
| Badges éditoriaux | `domain/editorial/resolve-editorial-badge` |
| Filtres temporels | `domain/time/when-filter` |
| Distance | `domain/geo/geo` |
| Shortlist IA | `application/ai/build-ai-highlight-shortlist` |
| Provider / parse / cache IA | `infrastructure/ai/` |
| Sync | `application/event-sync/` |
| Schéma / SQL | `infrastructure/db/` + `db/migrations/` |
| Source spécifique | `infrastructure/sources/<source>/` |
| UI | `components/` |

## 11. Dette / transition connue

- Chemin home **`live`** encore supporté (`DETOUR_EVENT_SOURCE` absent/`live`) : composite Orléans+Saran + cache ingestion. Production checklist = `database`.
- `createHomeEventSource` vit dans `create-detour-event-source.ts` (pas de fichier `create-home-event-source.ts` dédié).
- Debug Saran encore exposé par `EventService` / `UpcomingEventsResult`.
- Scripts `scripts/*.mts` et audits V1 : outils internes/debug, hors chemin produit.

## 12. Fichiers clés

| Fichier | Rôle |
|---------|------|
| `src/app/page.tsx` | Entrée home + fenêtre 180j |
| `src/application/event.service.ts` | Orchestrateur métier / IA |
| `src/application/event-sync/run-detour-event-sync.ts` | Entrée sync Detour |
| `src/application/event-sync/sync-event-source.ts` | Sync une source → PG |
| `src/infrastructure/create-detour-event-source.ts` | `createHomeEventSource` + live composite |
| `src/infrastructure/create-detour-sync-sources.ts` | Liste adapters sync |
| `src/infrastructure/sources/database/database-event-source.adapter.ts` | Lecture PG home |
| `src/domain/events/event.ts` | Modèle `DetourEvent` |
| `src/config/event-source-config.ts` | Flag `live` \| `database` |
| `db/migrations/20260906120000_create_events_and_source_syncs.sql` | Schéma |
| `vercel.json` | Cron sync 05:00 UTC |
