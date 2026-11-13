# Séances explicites — ingestion et lectures

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

## Lectures (PR B)

- SQL : les séances qui correspondent à la fenêtre sont filtrées, puis une seule
  séance est retenue par événement, avant déduplication inter-sources, COUNT,
  curseur et LIMIT. Les listes de séances détaillées sont chargées après le LIMIT
  Explorer, uniquement pour les cartes retournées et dans la fenêtre demandée.
- La première séance encore active est utilisée pour les presets Explorer,
  Home/Radar et la sélection week-end. Une plage Explorer explicite peut consulter
  le passé ; la Frise conserve sa règle « début dans la fenêtre, encore actif ».
- Fin exclusive : une séance terminée à minuit ne déborde pas sur le lendemain.
  Les instants sans durée restent inclus à leur instant dans une plage explicite.
  Les heures sont comparées en UTC et affichées en Europe/Paris, comme le reste
  du produit, y compris pendant le changement d’heure.
- Les curseurs incluent l’horloge `asOf` de la première page : une séance qui expire
  entre deux pages ne déplace pas son événement derrière le curseur. Cela ne fige
  pas la base pendant une synchronisation concurrente ; la déduplication client
  par ID reste en place. Les anciens curseurs restent lisibles.
- Détail, favoris et carnets : prochaine séance, ou dernière séance pour un
  événement entièrement passé. Une liste dépliable expose les autres séances sur
  la fiche et la modale. URLs, IDs, favoris et memberships restent identiques.
- Si `occurrences_synced_at < last_seen_at`, le calendrier n’a pas été confirmé
  par le dernier snapshot source : il est traité comme indisponible, sans repli
  sur la première séance historique. Les anciennes lignes restent stockées pour
  diagnostic. Un calendrier explicitement vide a le même comportement produit.
- Calendrier indisponible : exclusion des recommandations et du sitemap ; fiche
  « Dates à confirmer », sans faux statut « terminé », sans JSON-LD Event ni
  incitation à réserver. Une source qui n’a jamais fourni de calendrier conserve
  sa période historique, sans invention de séances quotidiennes.
- Le sitemap conserve la fiche jusqu’à la dernière séance. Le JSON-LD reflète
  exactement la séance affichée sur la fiche, pas l’enveloppe de la série.
- Export ICS : un VEVENT par séance explicite à venir, UID distinct dérivé de
  l’ID événement et du début de séance. Les exports des sources sans calendrier
  restent inchangés. Un changement de début peut donc changer l’UID de la séance ;
  ce téléchargement reste un export ponctuel, pas un abonnement calendrier.

### Cache et coût

Les caches existants sont conservés et leurs clés versionnées pour écarter les
anciens snapshots sans séances. Home, détail et week-end réévaluent la séance
après lecture du cache, sans SQL supplémentaire ni nouvelle chaîne éditoriale.
La page week-end reste sur le corpus Explorer, sans IA.

La première page Explorer est indexée par samedi et revalidée toutes les 60 s.
Si SWR sert une carte dont la séance est terminée, la page entière est relue :
cartes, count et curseur proviennent ainsi de la même sélection temporelle.
Aucun nouveau cache ni nouveau service n’est introduit.

Mesure indicative locale PGlite, 1 000 événements / 6 000 séances, 3 échauffements
puis médiane de 7 mesures alternées, COUNT + page de 13 lignes : ancienne requête
288,6 ms, nouvelle 286,8 ms, résultat de page environ 18 Ko. Ce n’est pas une
mesure de production ; latence réseau et plan PostgreSQL réel restent à observer.
Les lecteurs effectuent un nombre fixe de requêtes, sans aller-retour par séance.

## Déploiement

**PR B : aucune nouvelle migration.** Prérequis : migration PR A appliquée et
synchronisation Orléans réussie. Déployer ensuite le code de lecture ; les clés de
cache versionnées prennent effet automatiquement. Aucun backfill supplémentaire.
Retour arrière PR B : redéployer la version PR A, en conservant les séances.

La procédure ci-dessous concerne l’installation initiale de PR A :

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

La PR B ajoute un contrat PostgreSQL de bout en bout : série passée/future, trous
entre séances, suppression/inactivité, calendrier vide/obsolète, filtres croisés,
déduplication inter-sources, pagination à horloge figée, Frise, week-end après cache,
détail/JSON-LD/sitemap, favoris/carnets et isolation utilisateur, ICS multi-séances,
frontières all-day/nocturnes/changement d’heure. Le rendu de la liste de séances et
le renouvellement d’une page Explorer périmée sont également testés.
