# Déploiement — vérification email

Aucune migration de schéma. Aucun `UPDATE` massif de `"emailVerified"`. Aucun `DELETE` de sessions lancé par l’application au déploiement.

## Prérequis

- `RESEND_API_KEY` + `RESEND_FROM_EMAIL` opérationnels (même config que le reset mot de passe)
- `BETTER_AUTH_URL=https://detour.website` (prod)
- `BETTER_AUTH_SECRET` inchangé

## Ordre

1. Déployer la PR (Vercel).
2. Smoke Google OAuth (login existant) — doit rester inchangé.
3. Parcours Resend bout en bout (ci-dessous).
4. Optionnel **manuel** (ops seulement, si UX sessions historiques trop confuse) :

```sql
-- Ciblé, réversible en se reconnectant après vérif. Ne touche pas user/favoris/carnets.
DELETE FROM "session"
WHERE "userId" IN (
  SELECT id FROM "user" WHERE "emailVerified" = false
);
```

Ne pas exécuter ce SQL pendant le déploiement automatique.

## Vérifications manuelles (prod / preview)

1. **Inscription email** avec `?next=/explorer?addFavorite=<id>`  
   → page `/account/verify-email` (pas d’accès compte).  
   → recevoir le mail Resend (pas de jeton dans les logs app).
2. **Clic lien** → page « Adresse confirmée » → **Se connecter**.
3. **Login** → retour sur `next` avec `addFavorite` ; favori applicable seulement après session.
4. **Compte historique non vérifié** → login → message explicite + lien « Renvoyer le lien ».
5. **Lien expiré** → message d’erreur + renvoi possible.
6. **Resend down / 503** → pas de message « email envoyé ».
7. **Google** → signup/login inchangés.
8. **Accès privé** : session cookie avec `emailVerified=false` ne doit pas lister/muter favoris ou carnets (`getAccountAuthState`).

## Cookie cache (5 min)

`getAccountAuthState` utilise `disableCookieCache: true`. Les actions serveur restent sûres même si le cookie cache client est périmé. Le client ignore aussi les users non vérifiés via `verifiedAuthUserId`.

## Échec de révocation après confirmation

`afterEmailVerification` **propage** l’erreur si le `DELETE` des sessions du user échoue (log `SESSION_REVOKE_FAILED`). Better Auth a déjà passé `emailVerified` à `true` : l’utilisateur peut se connecter classiquement. Sans révocation réussie, une **ancienne** session cookie pourrait encore authentifier jusqu’à expiration — le gate app n’y change rien une fois l’email vérifié. Surveiller les logs au smoke test ; en dernier recours, révocation manuelle ciblée (SQL ops ci-dessus).
