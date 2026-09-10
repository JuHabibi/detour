# Architecture Détour

Radar culturel local (Orléans et environs). Doc alignée sur le **code actuel** du dépôt, avec des **conventions normatives** pour guider les évolutions (§13).

Détour est un **monolithe modulaire pragmatique** : pas de microservices, pas de Clean Architecture cérémoniale, pas de DDD inutile.

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
createDetourSyncSources()     → OrleansEventAdapter, SaranEventAdapter, IngreAgendaEventAdapter
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
- **Fenêtre** : 180 jours (`runDetourEventSync` et `app/_server/load-home-page.ts`).

#### Intégrité des snapshots source

La désactivation des événements absents suppose que le fetch d’un adapter représente un snapshot complet de la fenêtre demandée.

Un adapter ne doit donc jamais retourner silencieusement un corpus partiel. En cas d’échec HTTP, pagination incomplète ou réponse incohérente, le sync doit échouer avant l’écriture / désactivation.

L’adapter Orléans vérifie la cohérence de `total_count` et refuse une pagination incomplète avant que le moteur de sync puisse effectuer des désactivations.

L’adapter `ingre-agenda` applique la même logique fail-closed sur le pager Drupal (`pager-last`, pages pleines sauf dernière, HTML inattendu, HTTP non OK).

#### Cas `empty_corpus` (Ingré)

Si un sync `ingre-agenda` a déjà publié des événements actifs (`previousActiveCount > 0`) et qu’un sync ultérieur retourne légitimement `[]` (agenda municipal temporairement vide hors saison), le moteur actuel refuse l’écriture avec `errorCode: empty_corpus` et **conserve** l’ancien corpus actif.

Effet : pas de wipe accidentel, mais des événements « fantômes » peuvent rester actifs jusqu’à un fetch non vide. **Le moteur de sync n’est pas modifié en phase 2A** ; ce contrat sera traité séparément si le cas devient réel en production.

Fichiers : `src/application/event-sync/*`, `src/infrastructure/create-detour-sync-sources.ts`, `src/infrastructure/db/*`, `src/app/api/cron|internal/event-sync/`.

### B. Lecture Home

```
app/page.tsx
  → loadHomePage()                   # app/_server/load-home-page.ts
       → createHomeEventSource()     # create-detour-event-source.ts
       → EventService.getUpcomingEvents
       → listExplorerEvents (week-end)
       → map* → props HomePage (+ debugMeta si exposé)
  → <HomePage {...props} />
```

`page.tsx` est un **point d’entrée minimal**. L’orchestration (fenêtre 180 jours, EventService, Explorer, mapping UI, debug) vit dans le **page loader** `loadHomePage`.

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

Tableau descriptif du **code actuel** (pas la convention cible). Pour les règles d’évolution : §13 ; pour les écarts connus : §11.

| Dossier | Rôle (état actuel) |
|---------|------|
| `src/app` | Routes Next (page, actions, API cron/sync). Composition root. Page loaders dans `app/_server/`. |
| `src/app/_server` | Préparation de données **propre à une page** (ex. `load-home-page.ts`) — pas un use case générique. |
| `src/application` | Use cases et orchestration (`EventService`, Explorer, sync). **Aujourd’hui** on y trouve aussi mapping UI et meta/debug — ce n’est **pas** un précédent pour le nouveau code (voir §11 / §13). |
| `src/application/ai` | Construction du corpus shortlist envoyé à l’IA. |
| `src/application/debug` | Audits Saran / couverture V1 — hors règles produit. |
| `src/application/ingestion` | Shape d’ingestion + stats par adapter. |
| `src/application/event-sync` | Moteur de sync PG (lease, upsert, multi-sources). |
| `src/domain/events` | Modèle `DetourEvent`, classif, dédup, fraîcheur. |
| `src/domain/editorial` | Highlights, planning, badges, type assessment IA. |
| `src/domain/time` | Filtres `WhenFilter` (Europe/Paris). |
| `src/domain/geo` | Distance / (aujourd’hui aussi ancre Orléans + fallbacks — dette §11). |
| `src/infrastructure` | Adapters, factories home/sync, caches, DB, AI providers, Mapado. |
| `src/infrastructure/ai` | Provider OpenAI, DTO, parse, cache assessments. |
| `src/infrastructure/db` | Pool `pg`, repositories events / source_syncs / explorer / availability. |
| `src/infrastructure/sources` | Orléans, Saran, Ingré agenda, lecture `database`. |
| `src/components` | UI React (HomePage, cartes, filtres, debug panel). |
| `src/config` | Flags AI, mode source, catégories, ville. |
| `src/data` | View models UI (`EventItem`, etc.) — **pas** de règles métier (nom historique, voir §11). |
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

Dette connue, non bloquante à ce stade : debug Saran encore composé dans `composeResult` ; options de cache IA (readThrough / invalidate) encore visibles sur le service — voir §11.

## 6. IA

| Couche | Contenu |
|--------|---------|
| `domain/editorial/` | `AiHighlightAssessment`, `selectAiDetourHighlights`, badges, planning |
| `application/ai/` | `buildAiHighlightShortlist` (+ tailles de buckets) |
| `infrastructure/ai/` | provider OpenAI, `highlight-assessment-input`, parser, cache |

`EventService` ne connaît **pas** : system prompt, parsing JSON brut, batch size HTTP, shape DTO provider.

Composition home : `createHighlightAssessmentProvider()` + cache Next (`next-ai-assessment-cache`) dans `loadHomePage` / actions. Sans clé → noop → fallback déterministe.

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

1. Adapter + mapper dans `src/infrastructure/sources/ingre-agenda/` → `DetourEvent`
2. Enregistrer dans `createDetourSyncSources()`
3. Label DB dans `DatabaseEventSourceAdapter` (`ADAPTER_LABELS`)
4. Tests mapper / adapter (+ fixtures)
5. Sync DB (cron ou POST interne)
6. Vérifier classif / dédup sur le corpus
7. **Aucun** changement requis dans `EventService`

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
| Distance (règle) | `domain/geo/geo` |
| Shortlist IA | `application/ai/build-ai-highlight-shortlist` |
| Provider / parse / cache IA | `infrastructure/ai/` |
| Sync | `application/event-sync/` |
| Schéma / SQL | `infrastructure/db/` + `db/migrations/` |
| Source spécifique | `infrastructure/sources/<source>/` |
| Chargement home | `app/_server/load-home-page.ts` |
| UI | `components/` |

## 11. Dette / écarts code actuel ↔ conventions

Points **connus**, à traiter opportunément — **pas** dans ce document comme patch à appliquer.

Ce sont des **écarts au modèle cible** (§13). Ils **ne constituent pas** des précédents architecturaux pour le nouveau code : ne pas les étendre ni les reproduire.

- **`ORLEANS_CENTER`** et fallbacks Saran/Ingré dans `domain/geo/geo.ts` — ancre territoire dans le domaine générique.
- **`V1_COMMUNES`** dans `domain/geo/v1-communes.ts` — référentiel produit V1 dans le domaine.
- **Prompt IA** hardcodé « autour d’Orléans » (`infrastructure/ai/openai-highlight-assessment.provider.ts`).
- **Mapado Chécy** — tenant / job availability V1 (`mapado-config`, enrichment).
- **Debug Saran** encore branché dans `EventService` / `UpcomingEventsResult` (+ panneau debug UI).
- **Ports** (`EventSourceAdapter`, providers IA, …) encore placés sous `infrastructure/` — cible §13.4 : cœur applicatif.
- **`src/data`** = view models UI (`EventItem`, …) malgré le nom « data ».
- Chemin home **`live`** encore supporté (`DETOUR_EVENT_SOURCE` absent/`live`) : composite Orléans+Saran + cache ingestion. Production = `database`.
- `createHomeEventSource` vit dans `create-detour-event-source.ts` (pas de fichier `create-home-event-source.ts` dédié).
- Scripts `scripts/*.mts` et audits V1 : outils internes/debug, hors chemin produit.

## 12. Fichiers clés

| Fichier | Rôle |
|---------|------|
| `src/app/page.tsx` | Point d’entrée home minimal |
| `src/app/_server/load-home-page.ts` | Page loader : fenêtre 180j, EventService, Explorer, mapping, debug |
| `src/app/actions/load-explorer-events.ts` | Server action Explorer (filtres + pagination) |
| `src/application/event.service.ts` | Orchestrateur métier / IA |
| `src/application/event-sync/run-detour-event-sync.ts` | Entrée sync Detour |
| `src/application/event-sync/sync-event-source.ts` | Sync une source → PG |
| `src/application/explorer/list-explorer-events.ts` | Use case Explorer |
| `src/infrastructure/create-detour-event-source.ts` | `createHomeEventSource` + live composite |
| `src/infrastructure/create-detour-sync-sources.ts` | Liste adapters sync |
| `src/infrastructure/sources/database/database-event-source.adapter.ts` | Lecture PG home |
| `src/domain/events/event.ts` | Modèle `DetourEvent` |
| `src/config/event-source-config.ts` | Flag `live` \| `database` |
| `db/migrations/20260906120000_create_events_and_source_syncs.sql` | Schéma |
| `vercel.json` | Cron sync 05:00 UTC |

---

## 13. Conventions normatives — monolithe modulaire

Ces règles guident **toute évolution future**. Elles décrivent la direction ; le code actuel peut encore diverger (écarts listés §11).

### 13.1 Forme du produit

- **Un** monolithe Next.js modulaire.
- **Pas** de microservices.
- **Pas** de Clean Architecture cérémoniale (pas de couches pour le plaisir).
- **Pas** de DDD inutile (ubiquitous language utile ; agrégats/bounded contexts cérémoniels non requis).

### 13.2 Direction des dépendances

```
components ──► data / config / domain (fonctions pures utiles au rendu)
     │
app (composition root) ──► application + infrastructure + components
     │
application ──► domain
     │            ▲
     │            │
infrastructure ───┘  (implémente les contrats du cœur)
```

| Couche | Peut dépendre de | Ne dépend jamais de |
|--------|------------------|---------------------|
| **domain** | (stdlib / types purs) | `app`, `components`, `infrastructure`, Next |
| **application** | `domain` ; ports du cœur ; (pragmatiquement aujourd’hui : infra — à réduire via ports §13.4) | `components`, React/Next runtime dans les use cases |
| **infrastructure** | `domain`, `application` (contrats / types d’orchestration) | `components` |
| **app** | `application`, `infrastructure`, `components`, `config` | — (composition root) |
| **components** | types / view-models UI (`data`), config d’affichage, **fonctions métier pures** du domain lorsqu’elles sont réellement utiles au rendu | **`infrastructure`** ; **use cases** application (pas d’appel direct) |

**Important — `infrastructure → application/domain` n’est pas une violation.**  
C’est une dépendance **vers l’intérieur** : l’infra implémente ou consomme des contrats du cœur. Ne pas la traiter comme une inversion à « corriger ».

**`app` a le droit** d’assembler application + infrastructure (composition root) : factories, providers, page loaders, routes.

**Couche = responsabilité**, pas la taille du fichier ni le fait qu’une fonction soit pure. Une fonction pure peut être domain, application ou utilitaire UI selon son rôle produit.

### 13.3 Vocabulaire Détour

| Terme | Définition | Exemples Détour |
|-------|------------|-----------------|
| **Domain function** | Règle métier pure, sans I/O | `classifyEventRelevance`, `deduplicateEvents`, `selectDetourHighlights` |
| **Use case** | Opération applicative (souvent I/O + orchestration ciblée) | `listExplorerEvents`, `syncEventSource` |
| **Service** | Orchestrateur avec plusieurs dépendances / opérations cohérentes | `EventService` |
| **Page loader** | Prépare les données **propres à une page Next** ; composition pour le rendu | `app/_server/load-home-page.ts` — **ce n’est pas un use case** |
| **Server action / API route** | Frontière HTTP / Next | `loadExplorerEvents`, `GET /api/cron/event-sync` |
| **Adapter** | Implémentation technique d’une source externe → `DetourEvent` | `OrleansEventAdapter`, `SaranEventAdapter` |
| **Provider** | Implémentation technique d’un service externe (IA, …) | `OpenAIHighlightAssessmentProvider` |
| **Repository** | Accès persistance | `event.repository`, `explorer-events.repository` |

Règle pratique : un fichier qui n’existe **que** pour brancher une page Next reste près de `app/` (ex. `_server/`), pas dans `application/`.

### 13.4 Ports (convention cible)

Les interfaces qui expriment un **besoin du cœur applicatif** doivent **à terme** vivre dans le cœur, idéalement :

```
application/ports/
```

On **ne crée pas** systématiquement une interface pour chaque repository ou provider. Un port s’introduit lorsqu’il exprime un **contrat stable** dont le cœur a réellement besoin **indépendamment** d’une implémentation technique.

Exemples de candidats (quand le découplage le justifie) :

- source d’événements (`EventSource` / équivalent de `EventSourceAdapter`)
- `HighlightAssessmentProvider`
- interfaces repository **seulement** lorsqu’un vrai découplage devient utile

**Aujourd’hui** : plusieurs ports vivent encore sous `infrastructure/` (voir §11).  
**Cible** : les y laisser n’est plus la convention pour le *nouveau* code ; migration massive **non** demandée maintenant — déplacer opportunément quand on touche la zone.

### 13.5 Territoires / multi-région (convention cible)

Détour doit pouvoir servir **plusieurs territoires** (ex. Orléans, Tours) en 2027 **sans dupliquer** Radar, Explorer, ni `EventService`.

Règles :

- **Aucune** copie du produit par région.
- Le métier **générique** ne doit pas contenir de constantes Orléans / Tours / etc.
- **Territory** (domain) est un concept générique : identifiant, nom d’affichage, villes du périmètre, timezone / ancre géographique.
- Le **copywriting UI** (« autour d’Orléans », hero, textes marketing, metadata SEO, etc.) **ne fait pas** partie du modèle domain Territory — il vit en config / présentation.
- Les **valeurs** d’un territoire (config) peuvent vivre dans `config/territories/` (fichiers de config, pas de logique métier).
- Sources externes (OpenAgenda, iCal, Drupal, …) et providers de billetterie (Mapado, …) restent dans **`infrastructure/`**, branchés par wiring — **pas** mélangés dans le modèle métier Territory.

Direction conceptuelle future (ne **pas** créer ces fichiers tant qu’un seul territoire est réel) :

```
domain/territory/          → Territory, TerritoryId, TerritoryCity (concepts)
config/territories/        → orleans.ts, tours.ts, … (valeurs + copy UI si besoin)
infrastructure/            → wiring sources / providers par territoire
```

### 13.6 Règle d’introduction du deuxième territoire

**Tant qu’Orléans est le seul territoire réel :**

- pas de migration DB spéculative ;
- pas de `territory_id` « au cas où ».

**Quand un deuxième territoire devient réel :**

- introduire alors un **scope territoire explicite** ;
- revoir en conséquence events / source_syncs / Explorer / Radar / availability ;
- **zéro** duplication du produit (un monolithe, N configs / wirings).
