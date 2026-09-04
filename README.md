# Détour

POC Next.js — découverte culturelle locale (Orléans Métropole).

## Dev

```bash
npm install
cp .env.example .env.local   # renseigner DETOUR_AI_API_KEY
npm run dev
```

Par défaut en local : `DETOUR_AI_MODE=manual` → **0 appel IA** au refresh.  
Ouvrir le panneau debug → **Run AI assessment** (ou Re-run pour forcer, ignore le cache).

## IA (modes)

| Mode | Comportement |
|---|---|
| `manual` | Highlights déterministes au load ; IA via bouton debug |
| `auto` | Pipeline IA pour « Faites un détour » + cache |
| disabled (pas de clé) | Fallback déterministe |

`DETOUR_AI_MODE` prime s’il est défini. Sinon : production → `auto`, preview Vercel / development → `manual`.

## Vercel

Variables (Production) :

- `DETOUR_AI_MODE=auto`
- `DETOUR_AI_API_KEY` (secret, **pas** `NEXT_PUBLIC_*`)

Preview : laisser `manual` ou ne pas mettre de clé (évite les coûts IA).

## Cache IA

- Clé déterministe sur le contenu de la shortlist (6h).
- Couches : Map mémoire (instance) + `unstable_cache` Next (Data Cache).
- Pas de DB / Redis. Sur Vercel serverless le cache n’est pas une garantie absolue entre cold starts / instances.

## Tests

```bash
npm test
```
