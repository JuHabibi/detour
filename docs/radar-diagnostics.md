# Diagnostic temporaire du Radar

But : comparer deux matérialisations Home sans persister une sélection ni journaliser
les visiteurs. Ce diagnostic ne démontre pas à lui seul la cause historique du
remplacement d'Oud Indigo par David Lopez.

## Activation

Définir côté serveur `DETOUR_RADAR_DIAGNOSTICS_UNTIL` sur une date ISO UTC future,
à moins de 24 heures, puis déployer la configuration Vercel. Variable absente,
invalide, expirée ou à plus de 24 heures : aucun log, aucun calcul d'empreinte.
Ne pas utiliser de variable `NEXT_PUBLIC_*`.

Filtrer les logs Vercel sur `[detour:radar-diagnostic]`. Une ligne est produite par
matérialisation serveur réussie ; les vues servies par le Full Route Cache ISR
ne produisent pas de ligne. L'ISR 6h et les invalidations après sync restent
inchangés. Aucun polling, aucune Map globale, aucun nouveau cache.

La date coupe automatiquement les logs. Retirer ensuite la variable. Après le
constat en production, supprimer `radar-diagnostics.ts`, son test et son unique
appel dans `materializePublicHomeData` : aucune dépendance fonctionnelle au diagnostic.

## Lecture des traces

| Champ | Interprétation |
| --- | --- |
| `deployment`, `businessNow` | Commit Vercel et instant métier de la projection. |
| `snapshotFingerprint` | SHA-256 du snapshot complet ordonné ; identifie le corpus et sa shortlist. |
| `assessmentInputFingerprint` | SHA-256 des entrées exactes évaluées, dates source incluses. |
| `assessmentFingerprint` | SHA-256 des assessments effectivement utilisés, triés par ID. |
| `projectionFingerprint` | SHA-256 des IDs, séances et disponibilités projetés. |
| `eligibleCount`, `assessedCount`, `missingCount` | Taille de shortlist, couverture réelle et assessments manquants. |
| `cacheHits`, `cacheMisses`, `cacheSource` | Observations du read-through IA ; `partial` peut être un mélange hits/fresh avec couverture complète. |
| `changedSessionCount`, `changedSessionIds`, `removedCount` | Séances différentes du snapshot (20 IDs maximum) et événements retirés par la fenêtre. |
| `finalIds`, `planningIds` | Ordre final, 10 IDs maximum par liste ; IDs limités à 128 caractères. |

Comparer d'abord le déploiement puis les empreintes. Une modification de séance
peut modifier les scores temporels et Planning sans modifier l'entrée IA. Une
couverture IA incomplète déclenche toujours le complément déterministe existant.
Des empreintes identiques avec un instant métier identique doivent produire les
mêmes IDs ordonnés. Les traces ne contiennent ni titres/descriptions/reasons,
ni prompts, ni URLs, ni cookies, ni identité de visiteur. Elles ne sont pas
transmises au client. Les listes bornées gardent une ligne de quelques Ko.

## Déploiement et limites

Aucune migration ni commande interne requise. La version v4 de la clé Home
reconstruit un snapshot avec `sourceDates`. Les évaluations dont l'entrée diffère
réellement (notamment dates source vs ancienne séance projetée) seront recalculées
une première fois. Ensuite le simple passage de séance réutilise la même clé.
TTL Home/ISR 6h, IA 7j, tags, invalidations et batching inchangés.

Le cache partagé Next fait autorité. Son stale-while-revalidate peut encore servir
un assessment précédent puis un assessment renouvelé. Deux calculs à froid
concurrents peuvent aussi appeler le fournisseur ; ce changement n'ajoute ni verrou
ni garantie de sélection immuable. Le déterminisme demandé porte sur les mêmes
données, les mêmes assessments et le même état temporel, pas sur des réponses IA
nouvelles identiques à chaque appel.
