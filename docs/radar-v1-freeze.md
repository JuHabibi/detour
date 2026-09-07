# Radar engine V1 frozen — 2026-09-07

Baseline éditoriale figée. **Ne pas retuner le moteur** sur un cas isolé.

## Baseline

| Élément | Valeur |
|--------|--------|
| Prompt | `detour-ai-assess-v3.1` |
| Golden | `scripts/editorial-golden-set-v2.json` — 20 unités éditoriales |
| Snapshot de référence | `scripts/audit-detour-editorial-v3.1.json` (local / gitignored) |
| MUST recall@10 | **1.000** (6/6) |
| nDCG@10 | **0.851** |
| Top10 vs golden v2 | 6 MUST / 2 MAYBE / 2 NO |

Évaluation offline :

```bash
npm run audit:evaluate -- --golden scripts/editorial-golden-set-v2.json scripts/audit-detour-editorial-v3.1.json
```

## Limites connues

- **Les Vamps** et **Premiers printemps** sont des faux positifs de frontière (NO dans le Radar).
- Certains événements restent **UNJUDGEABLE** lorsque la fiche source est insuffisante (ex. description tronquée).
- Ne pas retuner le moteur sur un cas isolé.

## Réouvrir le moteur uniquement si

- bug réel ;
- nouveau pattern observé sur **plusieurs** événements ;
- golden set significativement enrichi ;
- nouvelle évolution produit du Radar.

## Hors périmètre de ce freeze

Pas de changement de poids, floors, slots, prompt, ni labels golden dans cette fermeture.
