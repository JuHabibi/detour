# Séances explicites — ingestion (PR A)

Les événements OpenAgenda peuvent avoir plusieurs séances, séparées de plusieurs
jours ou mois. `firstdate_begin` / `firstdate_end` décrivent la première séance ;
ce ne sont pas les bornes de toute la programmation.

## Contrat

- `events.id` reste l’identité stable : URLs, favoris et carnets ne changent pas.
- `event_occurrences` contient exclusivement des séances explicites avec début,
  fin et indicateur journée entière (fin exclusive quand `all_day = true`).
- `events.occurrences_synced_at IS NULL` signifie calendrier inconnu. Une date de
  synchronisation sans aucune séance signifie calendrier explicitement vide.
- Un calendrier absent préserve le dernier snapshot et sa date. Un calendrier
  valide le remplace entièrement, y compris les séances supprimées par la source.
  La date permet de distinguer la fraîcheur du calendrier de celle de l’événement.
- Un calendrier malformé fait échouer le fetch Orléans (`fetch_failed`) avant les
  écritures. Aucun sous-ensemble de séances n’est accepté silencieusement.
- Les écritures des parents, séances, désactivations et état de synchronisation
  partagent la transaction et le lease existants. Les insertions sont groupées,
  pas une requête par séance.

L’adapter Orléans sélectionne les événements dont l’enveloppe première/dernière
séance intersecte la fenêtre, qu’ils soient « à venir » ou « en cours ». Les
bornes transmises à ODS portent explicitement leur fuseau UTC. Il conserve le
calendrier `timings` complet : pas de sessions inventées dans les intervalles,
pas de développement de récurrences, pas d’IA.

Les autres adapters laissent le calendrier inconnu. Leur période actuelle ne
devient pas automatiquement une série de séances quotidiennes.

## Limite volontaire de cette PR

Les champs historiques `events.start_at` / `end_at` et les requêtes de lecture
restent inchangés. Les séries récupérées peuvent donc encore être absentes des
résultats si seule leur première séance est interrogée. L’enveloppe source peut
aussi couvrir des jours sans séance : elle sert uniquement à collecter le corpus.

La PR B devra choisir une séance réellement pertinente pour la fenêtre demandée,
avant comptage, déduplication et pagination, avec une seule carte par événement.
Explorer/week-end, Radar, détail, frise, favoris et données SEO devront partager
cette vérité temporelle. Un calendrier inconnu doit rester distinct d’un
calendrier explicitement vide ; la conservation d’un snapshot absent doit tenir
compte de sa date de synchronisation. Cette PR A ne corrige pas encore ces lectures.

## Déploiement

1. Appliquer `20261111120000_create_event_occurrences.sql` sur la base cible avec
   le processus dbmate existant (`npm run db:migrate`, environnement vérifié),
   **avant** de déployer ce code. La migration est additive et compatible avec
   l’ancienne version. Aucun backfill à partir de dates supposées.
2. Déployer l’application puis lancer la synchronisation existante (cron, ou
   `POST /api/internal/event-sync` avec `EVENT_SYNC_SECRET`).
3. Vérifier le succès de la source Orléans et les volumes ci-dessous. Le succès
   d’autres sources ne suffit pas à valider l’ingestion des séances Orléans.

```sql
SELECT adapter_id, count(*) AS events,
       count(occurrences_synced_at) AS calendars_known
FROM events
WHERE is_active = true
GROUP BY adapter_id;

SELECT e.adapter_id, count(*) AS occurrences
FROM event_occurrences o
JOIN events e ON e.id = o.event_id
WHERE e.is_active = true
GROUP BY e.adapter_id;
```

Retour arrière : redéployer l’ancienne application en conservant la migration
additive. Si le schéma doit aussi être retiré, arrêter d’abord les écritures de la
nouvelle version puis appliquer la section `down` (perte des séances collectées,
événements/favoris conservés). Ne pas retirer la table pendant une sync active.

## Validation

Tests du parsing (fuseaux, changement d’heure, nuit, doublons, trous entre séances,
absent/vide/invalide), de l’adapter (pagination et query ODS), et contrats PGlite
utilisant les migrations réelles : remplacement, idempotence, rollback parent et
séances, plusieurs lots, suppression en cascade, migration réversible.
