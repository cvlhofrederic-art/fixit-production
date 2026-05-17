# RAPPORT — Chantier d'architecture Max v1.1 (PT)

**Date :** 2026-05-17
**Brief :** [`prompt-claude-code-arquitetura-agente-max.md`](prompt-claude-code-arquitetura-agente-max.md) (méthode Anthropic pro 2026)
**Portée :** uniquement Max PT (cabinet de condomínio). FR dormant.
**Branche :** `claude/happy-hamilton-b8c23c`
**Statut :** Code livré, vérifié, prêt pour migration prod + lancement baseline éval.

---

## Sommaire exécutif

| Critère | Résultat |
|---|---|
| Audit livré (`AUDIT.md`) | ✅ |
| Code d'indexation/chunking patché | ✅ — 157 chunks vs ~38 avant |
| Prompt système v1.1 en sections XML balisées | ✅ — 14 sections |
| Garde-fous citation + anti-auto-certification | ✅ — 8 patterns rejetés |
| Observabilité évals (`X-Eval-Run-Id`, `chunk_ids`) | ✅ |
| Suite d'évaluations livrée | ✅ — 50 train + 19 held-out, 4 verifiers |
| Tests unitaires | ✅ — **79/79 passent** (parser 26 + prompt 16 + validate 15 + autres 22) |
| TypeScript | ✅ — 0 erreur introduite |
| Ingestion en prod | ⏳ — non lancée (destructive, exige credentials super_admin) |
| Baseline éval run | ⏳ — non lancée (exige JWT user syndic) |

**Aucun contenu juridique du corpus modifié — règle absolue respectée.**

---

## 1. Ce qui a été livré

### 1.1 Étapes 1-6 du plan d'exécution

| Étape | Description | Commit | Lignes |
|---|---|---|---|
| Setup | `docs/agent-max/` + 4 fichiers source + AUDIT.md | [`a6d0a1d`](https://github.com) | +1919 |
| 1 | Chunking v1.1, parser extrait dans `lib/syndic/max-parser.ts`, TOC chunk, RPC filter `__TOC__`, 26 tests | [`dc1e6c5`](https://github.com) | +1174 / −221 |
| 2 | Prompt v1.1 PT en sections XML balisées (14 sections), TOC pré-chargée en `<base_de_conhecimento_indice>`, 16 tests | [`32030e1`](https://github.com) | +399 / −67 |
| 3+4 | Filtre TOC fontMap + 8 patterns anti-auto-certification + `chunk_ids` + `eval_run_id`, 15 tests | [`6b01c2d`](https://github.com) | +288 / −2 |
| 6 | Suite évals 50 train + 19 held-out, runner CLI 4 verifiers | [`08ef13b`](https://github.com) | +727 |

**Total : 5 commits, +4507 / −290 lignes nettes.**

### 1.2 Couverture des 4 défauts du brief

| Défaut | Adressé par |
|---|---|
| **A — Comparaison numérique** (« 6 jours < 10 jours min ») | `<tratamento_de_valores>` (5 règles + exemple) + 8 cas eval `01-comparison-numerique` |
| **B — Refus hors-périmètre** (concierge, fiscalité…) | `<controlo_de_ambito>` (liste exhaustive : trabalho, fiscalidade, contabilidade, penal, arrendamento, técnico) + 7 cas eval `02-controle-perimetre` |
| **C — Refus injustifié de matière couverte** (ascensores DL 320/2002…) | (1) Parser enrichi : code du diplôme dans `source` côté Partie I, (2) bullets Partes H et J désormais chunkés, (3) `<base_de_conhecimento_indice>` pré-chargé + `<o_que_a_base_cobre>` (liste explicite), (4) 12 cas eval `03-matiere-couverte` |
| **D — Faux verbatim entre guillemets** | `<regime_de_citacao>` (6 règles dont distinction littéral/paraphrase/référence) + 8 patterns anti-auto-cert dans `max-validate.ts` + 4 cas eval `04-citation-verbatim` |

### 1.3 Couverture du brief Anthropic §ARCHITECTURE CIBLE

| Exigence brief | État |
|---|---|
| 1 agent unique + RAG (pas multi-agent) | ✅ inchangé |
| Prompt système chargé proprement | ✅ refondu en sections XML |
| Stratégie hybride : TOC pré-chargée + chunks à la demande | ✅ TOC chunk créé à l'ingestion, pré-chargé via `loadTocPt()` cache module-level |
| Chunking par sous-section ; 1 article = 1 chunk min | ✅ parser respecte `### Artigo` comme limite atomique |
| Métadonnées en tête de chunk | ✅ via `formatChunkPT()` au runtime + colonnes DB (source, article, parent_path) |
| Recherche hybride (lexical + sémantique) | ✅ déjà en place (HyDE + vector + BM25 + RRF + rerank + MMR) |
| 2 outils `kb_search` / `kb_get_section` | ⚠️ **non exposés** — décision Anthropic-aligned : *« n'augmenter la complexité que si l'éval prouve un gain »*. Retrieval pré-LLM actuel marche. À reconsidérer après baseline. |
| Citation verbatim vérifiée | ✅ `validateMaxResponse` rejette les paraphrases entre guillemets |
| Pas d'auto-certification | ✅ 8 patterns regex rejetés (`[verificado]`, `citação verificada`, `eu validei`…) |
| Human-in-the-loop / pas d'outils d'écriture | ✅ structurellement (route ne fait que `SELECT`) |
| Observabilité (logs question/chunks/latence/tokens) | ✅ étendue avec `chunk_ids` + tag `eval_run_id` |

---

## 2. Évaluations — résultats chiffrés

### 2.1 Statut : baseline pas encore exécuté

Le brief Anthropic exige : *« Lance les évaluations. Lis les traces… »*. Le runner est **livré et vérifié en dry-run** ; le lancement réel est conditionné à la fourniture par l'utilisateur d'un **JWT user syndic** (ou exécution déléguée).

**Aucun chiffre de pass_rate ne figure dans ce rapport.** Je refuse d'inventer des résultats — le brief interdit explicitement les affirmations de performance sans mesure.

### 2.2 Critères de succès D2 retenus

Per plan §D2 (Anthropic-aligned baseline durable) :
- **≥ 85 %** sur les 4 catégories de non-régression (1-4) — train ET held-out
- **≥ 80 %** sur le cœur de base (5-8) — train ET held-out
- Si non atteint après tuning paramétrique → échecs résiduels documentés ci-dessous

### 2.3 Comment lancer la baseline

```bash
# Variables d'environnement requises :
export MAX_AI_ENDPOINT=https://vitfix.io/api/syndic/max-ai
export MAX_AI_BEARER_TOKEN="<JWT d'un user authentifié avec orgRole=syndic>"
export EVAL_RUN_ID="baseline-pre-migration-$(git rev-parse --short HEAD)"
export GROQ_API_KEY="<clef Groq>"  # uniquement si verifier llm_judge utilisé

# Lancer train + held-out
npx tsx docs/agent-max/evals/run-evals.ts --set=train
npx tsx docs/agent-max/evals/run-evals.ts --set=held-out

# Rapports écrits dans docs/agent-max/evals/results/
# Code de sortie : 0 si seuils D2 atteints, 1 sinon.
```

**Important — temps de mesure :**
- Si on lance la baseline AVANT l'Étape 5 (ingestion prod), on mesure l'ancien Max (corpus de 704 lignes, prompt v1.0). Utile pour quantifier le gain.
- Si on lance APRÈS l'Étape 5, on mesure le nouveau Max (corpus de 1109 lignes, prompt v1.1). Utile pour valider que les seuils sont atteints.
- **Idéal pro 2026** : lancer dans les deux états et joindre les deux rapports dans ce document.

---

## 3. À soumettre à un juriste portugais

Conformément à la règle absolue : je SIGNALE, je ne corrige rien. Voici les points relevés pendant le chantier qui exigent un arbitrage juridique avant la mise en production définitive :

| # | Point | Impact si non traité |
|---|---|---|
| J1 | **Selos résiduels** : le brief mentionne en note finale que la grille SCIE (Quadro I do Anexo III do DL 220/2008) porte le selo `◆ ANEPC` et la Portaria 128/2026/1 le selo `◆ por confirmar`. Or **le corpus corrigé fourni en v(3) les marque ✅ DRE**. Conflit à arbitrer : le corpus est postérieur au brief ; à confirmer si la double-vérification a réellement eu lieu. | Si non vérifié, Max citera comme « ✅ DRE » des éléments en réalité ◆ → vice de confiance |
| J2 | **Lei 8/2022 art. 6.º** dans le seed SQL initial (`supabase/migrations/20260519_max_legal_corpus.sql:114-118`) attribue à « Lei 8/2022 » un texte qui est en réalité l'Art. 6.º du DL 268/94 modifié par la Lei 8/2022. Incohérence formelle. **Suggestion** : retirer ce seed (il sera remplacé par les chunks issus du corpus). | Cohabitation possible de 2 entries (« Lei 8/2022 Art. 6.º » + « DL 268/94 Art. 6.º ») → confusion citations |
| J3 | **Acórdão TC 408/2015** mentionné dans la Partie F.1 sans numéro de processo identifiable (juste « Acórdão n.º 408/2015 »). | Recherche difficile pour vérification |
| J4 | **Verbatim Lei 8/2022 et DL 10/2024** : le corpus présente ces lois en mode « consolidé dans les Partes B/C » mais sans verbatim de leurs articles propres. Une question pointue sur « que dispose précisément la Lei 8/2022 art. X ? » n'aura pas de chunk dédié. | Refus inattendus sur questions législatives directes — défaut C secondaire |
| J5 | **Qualification du condomínio pour RGPD/CNPD** : la section I.6.3.4 signale elle-même que la qualification du condomínio en « pessoa singular » / « PME » pour la moldura de coima est à confirmer par un jurista. Comportement correct du corpus (signale la doute). Aucune action côté code. | Aucun — c'est l'esprit voulu |

**Aucun de ces points ne bloque la mise en production fonctionnelle.** Ils relèvent du domaine juridique et seul un jurista portugais peut les trancher.

---

## 4. Ce que je n'ai PAS fait et pourquoi

Conformément au brief livrable §4 « liste explicite de ce que tu n'as pas fait et pourquoi » :

| Action non faite | Raison |
|---|---|
| **Étape 5 — TRUNCATE prod + re-ingestion** | Action **destructive** + **exige Bearer super_admin**. Per plan §Étape 5 et brief §human-in-the-loop : autorisation explicite obligatoire. Backup MCP préalable obligatoire. Décision déléguée à l'utilisateur. |
| **Baseline éval run sur prod** | Exige **JWT user syndic**. Pas de credential stocké dans le repo, pas de credential reçu de l'utilisateur à ce stade. |
| **Exposition de tools natifs Groq** `kb_search` / `kb_get_section` | Anthropic §brief : *« n'augmenter la complexité que si l'éval prouve un gain mesurable »*. Sans baseline run, pas de preuve → on s'abstient. À reconsidérer si la baseline montre que le retrieval pré-LLM rate des chunks. |
| **Implémentation du service de sync DRE/ELI** ([`nota-tecnica-...md`](nota-tecnica-integracao-dre-plataforma.md)) | Hors scope des Étapes 1-6 du brief. Vision moyen terme exigeant produit + jurista responsable. Chantier séparé. |
| **Réserves de sceau résiduelles** (J1) | Règle absolue : pas modifier le contenu juridique. Le jurista tranche, pas moi. |
| **Migration Max FR** | Scope confirmé PT only. FR dormant (cf. CLAUDE.md global). |
| **Re-test des autres agents IA** (Fixy, Léa, Alfredo) | Hors scope ; leur prompt n'est pas modifié. Vérification : `npm run test -- tests/lib/syndic/` passe sur les 8 fichiers (79 tests), aucune régression détectée. |
| **Suppression des 2 anciens prompts périmés** (`prompt-claude-code-chantier-max.md`, `prompt-claude-code-extraction-legislacao.md`) | Aucun des deux n'est dans le repo. Présents uniquement dans `~/Downloads/` côté utilisateur (privé, hors-scope). |
| **Modification du contenu juridique du corpus** | **Règle absolue.** Toute proposition est en §3 « À soumettre à un juriste ». |

---

## 5. Prochaines étapes (action utilisateur)

### Path A — Pro recommended (avec baseline avant migration)

```bash
# 1. Lancer la baseline éval contre le Max actuel en prod (ancien corpus + v1.0)
export MAX_AI_ENDPOINT=https://vitfix.io/api/syndic/max-ai
export MAX_AI_BEARER_TOKEN="<JWT user syndic>"
export EVAL_RUN_ID="baseline-old-$(git rev-parse --short HEAD)"
npx tsx docs/agent-max/evals/run-evals.ts --set=train

# 2. Lire le rapport (docs/agent-max/evals/results/...) — capture du baseline

# 3. Backup prod (via Supabase MCP ou SQL editor) :
#    SELECT * FROM syndic_legal_corpus_pt → JSON snapshot
#    Garder sous docs/agent-max/backups/<date>.json

# 4. Merge + déploie cette branche claude/happy-hamilton-b8c23c

# 5. TRUNCATE + re-ingest :
psql -c "TRUNCATE TABLE syndic_legal_corpus_pt RESTART IDENTITY CASCADE;"
curl -X POST https://vitfix.io/api/admin/ingest-legal-corpus-pt \
     -H "Authorization: Bearer <super_admin_token>"

# 6. Vérification : GET retourne ~157 chunks (156 avec embedding + 1 TOC sans)
curl https://vitfix.io/api/admin/ingest-legal-corpus-pt \
     -H "Authorization: Bearer <super_admin_token>"

# 7. Re-run éval sur le nouveau Max
export EVAL_RUN_ID="post-migration-$(git rev-parse --short HEAD)"
npx tsx docs/agent-max/evals/run-evals.ts --set=train
npx tsx docs/agent-max/evals/run-evals.ts --set=held-out

# 8. Comparer baseline vs post — quantifier le gain
```

### Path B — Plus rapide (migration directe sans baseline)

Skip étape 1-2 de Path A. Migre immédiatement (étapes 3-6), évalue le résultat. Plus rapide mais on perd le comparatif.

### Path C — Tuning local avant déploiement

Lance le dev server (`npm run dev`), ingère localement, lance les évals sur `localhost:3000`. Permet de tuner avant de toucher la prod.

---

## 6. Garanties de non-régression

- **Tests unitaires** : 79/79 passent (parser 26 + prompt v1.1 16 + validate 15 + autres syndic 22). Aucun autre suite touchée.
- **TypeScript** : `npx tsc --noEmit` — 0 erreur introduite (1 erreur pré-existante `cron-parser` sans rapport).
- **Pas de modification des autres agents IA** : `lib/syndic/max-parser.ts`, `max-strict-prompt.ts`, `max-validate.ts`, `max-legal-rag.ts`, `legal-corpus-pt-md.ts` sont scope Max exclusivement. `lib/groq.ts` non modifié. `lib/langfuse.ts` non modifié.
- **Migration SQL** [`20260521_max_v11_toc_filter.sql`](../../supabase/migrations/20260521_max_v11_toc_filter.sql) : `CREATE OR REPLACE FUNCTION` idempotent. Aucune destruction de schéma.
- **Pas de breaking change côté API** : la réponse JSON de `/api/syndic/max-ai` est strictement étendue (`retrieval.chunk_ids` et `retrieval.eval_run_id` optionnels ajoutés ; tout le reste inchangé).

---

## 7. Métriques pour Langfuse / dashboard d'observabilité

Le commit [`6b01c2d`](https://github.com) ajoute les tags Langfuse suivants à chaque trace `agent:max` :

| Tag/metadata | Source | Utilisation |
|---|---|---|
| `locale` | request body | filtrer PT vs FR |
| `chunks_found` | retrieval | distribution de la couverture |
| `hyde_used` | HyDE generator | A/B tests HyDE on/off |
| `attempt` | retry count | détecter les retries fréquents (signal de validation échouée) |
| `eval_run_id` | header `X-Eval-Run-Id` | isoler les traces d'une passe d'éval |

Et dans la réponse HTTP `retrieval.chunk_ids` : permet le replay d'un cas (récupérer le même set de chunks pour debug).

---

## 8. Liens utiles

- [AUDIT.md](AUDIT.md) — état des lieux initial
- [Brief Anthropic](prompt-claude-code-arquitetura-agente-max.md) — méthode pro 2026
- [Prompt v1.1 PT (source)](prompt-sistema-agente-juridico-condominio-v1.1.md) — byte-à-byte dans `buildPT()`
- [Corpus juridique PT v2026](regime-juridico-condominio-portugal-2026.md) — 1109 lignes, ne pas modifier
- [Note technique DRE/ELI](nota-tecnica-integracao-dre-plataforma.md) — vision moyen terme
- [evals/README.md](evals/README.md) — méthodologie de la suite

---

**Fin du rapport. Le chantier d'ingénierie est complet ; le passage en prod et la mesure du gain sont les deux dernières étapes humaines.**
