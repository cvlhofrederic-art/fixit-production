# Syndic v54 — Visual regression policy

## Pourquoi

Le redesign syndic V5.4 (Phase 1) cible un rendu **pixel-perfect** vs le
bundle source `VitFix_Dashboard_V5_7 (13).html`. Threshold acceptable :
`< 0.5 %` de pixels différents par viewport (1440 desktop + 375 mobile).

Au-dessus de 0.5 %, considéré comme régression. Bloque le merge de la PR
correspondante.

## Outils

Trois mécanismes complémentaires :

### 1. Playwright `toHaveScreenshot()` (CI auto)

Playwright utilise `pixelmatch` en interne pour comparer les screenshots
aux baselines (`*-darwin-chromium.png` dans le repo). Threshold configuré
par test.

Activé via les tests dans `e2e/syndic-v54-*.spec.ts`. Tournent sur :
- `tests.yml` job E2E Playwright (chromium / firefox / webkit en CI)
- Local : `npm run test:e2e`

Les baselines sont versionnées dans le repo (commit dédié `chore(syndic):
baseline screenshots v54 étape X`).

### 2. Artifacts CI (validation Frédéric)

Chaque test attache son screenshot final via `testInfo.attach()`. Sur la
PR GitHub, l'onglet "Artifacts" liste les PNG téléchargeables pour
review humaine sans cloner la branche.

### 3. Script standalone `scripts/visual-regression-v54.mjs` (ad-hoc)

Compare deux PNG localement (ex. screenshot live vs render du mockup
V5.7 dans un autre onglet) :

```bash
node scripts/visual-regression-v54.mjs \
  --live ./tokens-live-1440.png \
  --baseline ./tokens-v57-1440.png \
  --diff ./tokens-diff-1440.png \
  --threshold 0.005
```

Output : `✅ PASS  diff = 1234/2073600 pixels (0.060%) — threshold 0.500%`

Exit code 0 si pass, 1 si fail. Utile pour les Frédéric checks manuels et
les itérations rapides avant de commit la baseline officielle.

## Workflow par étape

1. Implémenter la primitive / shell / dashboard de l'étape
2. Lancer `npm run dev`, ouvrir `/syndic/dev/<sub-route>` au 2 viewports
3. Comparer côté-à-côté avec le mockup V5.7 décodé (`.claude/v57-decoded.html`)
4. Itérer sur le code jusqu'à parité visuelle
5. Capture les baselines via `npm run test:e2e --update-snapshots`
6. Commit les `.png` baselines avec un commit dédié
7. Re-run les tests : doivent passer avec threshold 0.5 %
8. PR review humaine + comparison artifact CI vs mockup

## Maintenance

- Les baselines vivent dans `e2e/<spec>-snapshots/`
- Mise à jour autorisée uniquement après validation visuelle Frédéric +
  Claude Chat (process strict)
- Force-overwrite jamais : toujours en commit séparé avec justification
- Si une PR change un token visuel sciemment (ex. tweak hex couleur), le
  commit doit inclure la baseline regen ET référencer la décision

## Dépendances

- `pixelmatch` ^7 (visualregression standalone)
- `pngjs` ^7 (read/write PNG buffers)
- `@playwright/test` ^1 (déjà installé, utilise pixelmatch en interne)
