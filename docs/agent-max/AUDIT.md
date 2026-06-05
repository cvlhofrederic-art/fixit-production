# AUDIT — État de l'agent Max et écarts vs architecture cible

**Date :** 2026-05-17
**Brief de référence :** [`prompt-claude-code-arquitetura-agente-max.md`](prompt-claude-code-arquitetura-agente-max.md) (Anthropic-aligned, méthode pro 2026)
**Auditeur :** Claude Code (lecture seule — aucune modification de code effectuée)
**Statut :** ⏸ POINT DE CONTRÔLE HUMAN-IN-THE-LOOP — STOP avant implémentation

---

## 0. Setup vérifié

| Action | Statut |
|---|---|
| `docs/agent-max/` créé | ✅ |
| `regime-juridico-condominio-portugal-2026.md` (corpus corrigé, 1109 lignes) placé dans `/docs/agent-max/` | ✅ |
| `prompt-sistema-agente-juridico-condominio-v1.1.md` (184 lignes) placé dans `/docs/agent-max/` | ✅ |
| `prompt-claude-code-arquitetura-agente-max.md` (ce brief) placé dans `/docs/agent-max/` | ✅ |
| `scripts/data/regime-juridico-condominio-portugal-2026.md` synchronisé avec la version corrigée (miroir parfait) | ✅ |
| Ancien `RAPPORT-AUDIT.md` à la racine supprimé | ✅ |
| Anciens prompts périmés à supprimer (`prompt-claude-code-chantier-max.md`, `prompt-claude-code-extraction-legislacao.md`) | ⚠️ Aucun dans le repo (seulement dans `~/Downloads/` côté utilisateur — hors scope) |
| `nota-tecnica-integracao-dre-plataforma.md` (4ᵉ fichier attendu par le brief) | ✅ Fourni dans v(3) — 138 lignes, vision long terme DRE/ELI/PDF sync. Hors scope Étapes 1-6 actuelles, conforme à la note finale du brief |

> **Confirmation périmètre :** uniquement la voie PT (Portugal — cabinet de condomínio). Aucun travail FR dans ce chantier.

---

## 1. Architecture actuelle de Max

### 1.1 Vue d'ensemble

| Composant | Localisation | Rôle |
|---|---|---|
| Route HTTP | [`app/api/syndic/max-ai/route.ts`](../../app/api/syndic/max-ai/route.ts) (263 lignes) | POST endpoint, auth syndic, orchestration pipeline |
| Constructeur prompt | [`lib/syndic/max-strict-prompt.ts`](../../lib/syndic/max-strict-prompt.ts) `buildPT()` lignes 32-164 | Template TS contenant le prompt **v1.0** PT |
| Retrieval | [`lib/syndic/max-legal-rag.ts`](../../lib/syndic/max-legal-rag.ts) (288 lignes) | Pipeline HyDE + Hybrid + Rerank + MMR |
| Embeddings | [`lib/syndic/embed.ts`](../../lib/syndic/embed.ts) | BGE-M3 1024 dims via binding Cloudflare AI |
| Rerank | [`lib/syndic/rerank.ts`](../../lib/syndic/rerank.ts) | BGE-reranker cross-encoder + MMR |
| Validation | [`lib/syndic/max-validate.ts`](../../lib/syndic/max-validate.ts) (200 lignes) | Vérification post-génération JSON + citations |
| Sanitization PII | [`lib/ai/sanitize-context.ts`](../../lib/ai/sanitize-context.ts) | Tokenization PII (défense en profondeur) |
| Tables DB | `syndic_legal_corpus_pt` (PT) / `syndic_legal_corpus_fr` (FR) | Isolation stricte par language CHECK CONSTRAINT |
| RPC SQL | `search_legal_corpus_hybrid_pt` | Hybrid search vector + BM25 portuguese fusionnés par RRF |
| Observabilité | `traceAgent` (Langfuse) + `logger` (Sentry tags) | Traces agent_id=max, user_id, prompt, conversation_id |
| Pipeline d'ingestion | [`app/api/admin/ingest-legal-corpus-pt/route.ts`](../../app/api/admin/ingest-legal-corpus-pt/route.ts) (343 lignes) | Parser .md → chunks → embeddings → insert (super_admin only, idempotent par `chunk_hash`) |
| Source `.md` ingérée | `lib/syndic/legal-corpus-pt-md.ts` (base64 embed du `.md`) | ⚠️ désormais **désynchronisé** du nouveau corpus corrigé |

### 1.2 Pipeline runtime (POST `/api/syndic/max-ai`)

```
1. Auth (getAuthUser + isSyndicRole)
2. Rate-limit IP (40 req/min)
3. Validation Zod (syndicMaxAiSchema)
4. Sanitization PII du syndic_context (jamais injecté dans le prompt)
5. HyDE rewrite (Groq Llama 3.1 8B, ~500ms)
6. retrieveLegalChunks() :
   a. Embed query + HyDE → moyenne des deux vecteurs
   b. RPC hybrid (vector + BM25 + RRF) → 30 candidats
   c. BGE-reranker → 10 candidats (seuil MIN_RERANK_SCORE = -2.0)
   d. MMR (λ=0.7) → 6 chunks finaux
7. Si 0 chunks → refusal "corpus gap"
8. buildMaxStrictSystemPrompt + injection des 6 chunks comme [FONT-1] à [FONT-6]
9. Groq Llama 3.3 70B (temperature 0.1, JSON mode, max 3500 tokens)
10. validateMaxResponse :
    - JSON valide ?
    - chaque font_id ∈ chunks réels ?
    - chaque exact_quote présent verbatim dans le content du chunk ?
    - couverture des claims ?
11. Si validation KO → 1 retry avec message d'erreur LLM
12. Si retry KO → refusal "validation_failed"
13. Réinjection PII tokens
14. Réponse JSON {response, citations, confidence, refusal, retrieval}
```

**Verdict général :** l'architecture est **déjà à 80 % alignée** avec la cible Anthropic. Trois écarts principaux à corriger (cf. §4).

---

## 2. Mécanisme de récupération actuel

### 2.1 Stratégie déjà en place

| Critère Anthropic | État actuel |
|---|---|
| RAG hybride (lexical + sémantique) | ✅ **Implémenté** — vector cosine HNSW + BM25 portuguese, fusion RRF (k=60) côté SQL, puis BGE-reranker côté Node |
| Recherche au-delà du plus simple | ⚠️ Brief recommande de commencer simple ; ici déjà sophistiqué (HyDE + dual embedding + rerank + MMR) — **gain à mesurer par évals** |
| Identifiants juridiques exacts gérés | ✅ Partiel — BM25 récupère les codes (DL 320/2002, art. 1424.º) ; pas de boost explicite sur les patterns d'articles |
| Chunk = au minimum 1 article entier (jamais coupé) | ✅ Parser respecte `### Artigo` comme limite atomique ; split overflow par paragraphes uniquement si chunk > 4000 chars |
| Métadonnées en tête de chunk | ⚠️ Présentes en DB (`source`, `article`, `title`, `theme`, `parent_path`) mais **pas explicitement rappelées en tête du `content`** injecté dans le prompt |
| Contexte pré-chargé (TOC) | ❌ **Absent** — pas d'injection de la table des matières dans le system prompt |
| Récupération à la demande | ✅ Implémenté (mais sans tool exposé au LLM — fait dans la route serveur) |

### 2.2 État du corpus corrigé vs parser actuel

Le corpus que tu viens de fournir résout *à la source* la plupart des bugs RAG que j'avais identifiés dans mon précédent audit :

| Ancien bug | Statut dans le nouveau corpus |
|---|---|
| Partie I trop dense, sans sous-sections numérotées | ✅ Restructurée I.1.1 à I.6.3 avec `### I.X.Y` |
| Code du diplôme absent du titre de section | ✅ Désormais `## I.3 — Ascensores e equipamentos afins (Decreto-Lei n.º 320/2002)` etc. |
| Pas de verbatim DL 320/2002, DL 220/2008, DL 97/2017, etc. | ✅ Verbatim ajoutés avec sceau ✅ DRE |
| Personnalité judiciaire du condomínio jamais traitée | ✅ Section F.0 ajoutée (CPC art. 11.º et 12.º verbatim) |
| RJUE art. 66.º manquant | ✅ Ajouté en I.1.5 |
| Glossaire pauvre | ✅ Enrichi : EI (double acception), RGPD, CNPD, EIG, SCIE, ANEPC, RJCE |

**Bugs résiduels** (cause-racine = parser, pas corpus) :

| Bug résiduel | Localisation corpus | Cause | Impact |
|---|---|---|---|
| **B1 — Partie H non chunkée** | Ligne 613 → 625 directement, aucun H2/H3 | Parser exige `^## ` ou `^### `, bullets `- **...**` ignorés | Toute la matière sur l'enquadramento profissional du syndic invisible du RAG |
| **B2 — Partie J non chunkée** | Ligne 1043 → 1109, idem | Idem B1 | Glossaire entier invisible — Max ne peut définir EMA, IAS, ANEPC, etc. |
| **B3 — `deriveSource()` mappe toute la Partie I sur `"Legislação conexa"`** | [`route.ts:71`](../../app/api/admin/ingest-legal-corpus-pt/route.ts:71) | `deriveSource()` lit le titre de la `# PARTE`, pas le titre `## I.X` | Le code du diplôme reste dans `content`, pas dans `source` indexé |
| **B4 — Préambule et ÍNDICE perdus** | Lignes 1-44 | Parser exige une `# PARTE` parente | Le brief Anthropic demande **TOC injectée pre-loaded** — donc cette zone doit être lue autrement (cf. §4) |
| **B5 — `lib/syndic/legal-corpus-pt-md.ts` désynchronisé** | Base64 embed | N'est plus le miroir du `.md` corrigé | Tant que la base64 n'est pas régénérée + ingestion relancée, la base prod sert l'ancien corpus |

---

## 3. Mécanisme de citation actuel

### 3.1 Garde-fou de citation déjà implémenté

[`max-validate.ts`](../../lib/syndic/max-validate.ts) effectue, post-génération, **les vérifications exigées par le brief Anthropic** :

| Vérif demandée par brief §4 (Garde-fous) | État actuel |
|---|---|
| Toute citation entre guillemets doit être sous-chaîne **réellement présente** dans un chunk | ✅ `validateMaxResponse` vérifie `chunk.content.includes(citation.exact_quote)` |
| Si match KO → renvoyer à l'agent pour reformuler | ✅ 1 retry avec message d'erreur, sinon refusal |
| Chaque `font_id` doit exister dans les chunks injectés | ✅ Set check |
| Sortie en JSON strict | ✅ Groq `response_format: { type: 'json_object' }` + parsing strict |

### 3.2 Pas d'auto-certification

Le commit récent `d3f935c chore(syndic/max): retirer les badges Confiança et Fora do corpus` indique que des badges d'auto-certification ont été retirés côté UI. À vérifier exhaustivement (un grep côté composants syndic) si tous les bandeaux du type « citation vérifiée » ont bien été nettoyés — pas vérifié dans cet audit.

Le prompt v1.0 actuel **ne mentionne pas explicitement** l'interdiction d'auto-certification. Le v1.1 fourni l'**ajoute** explicitement (§REGIME DE CITAÇÃO règle 5) :

> *« Não acrescentes às tuas respostas selos, etiquetas ou menções do tipo "citação verificada", "fonte confirmada", "✅", nem qualquer fórmula que sugira que tu validaste a exatidão da citação. »*

→ basculer en v1.1 corrigera cette lacune côté prompt.

### 3.3 Human-in-the-loop

✅ Aucun outil d'écriture, d'envoi, de suppression, d'action externe. La route ne fait que `SELECT` (et `INSERT` côté ingestion admin, derrière super_admin auth).

---

## 4. Écarts vs architecture cible (les 3 vrais chantiers)

### Écart E1 — Prompt système : v1.0 inline en TS, sections non balisées

**Cible Anthropic** : prompt structuré en sections balisées XML explicites `<identidade>`, `<fonte_de_conhecimento>`, `<metodo>`, `<regime_de_citacao>`, `<limites>`, `<exemplos>`. Et v1.1, pas v1.0.

**Actuel** : v1.0 inline dans `buildPT()`, sections en `##` Markdown, **manque 4 sections [v1.1]** :
- TRATAMENTO DE VALORES, PRAZOS E QUANTIDADES (correctif A — défaut numérique)
- CONTROLO DE ÂMBITO — O QUE NÃO RESPONDES (correctif B — hors-périmètre)
- O QUE A BASE COBRE — NÃO RECUSES MATÉRIA QUE CONSTA DA BASE (correctif C — refus injustifié)
- REGIME DE CITAÇÃO (correctif transverse — anti-faux-verbatim)

**Action proposée :**
1. Charger le `.md` v1.1 comme source-of-truth versionnée.
2. Refondre `buildPT()` pour générer le prompt en sections balisées XML (en respectant le contenu v1.1).
3. La fonction reste TS (pas d'I/O au runtime — perf), mais elle reflète byte-à-byte le `.md`.
4. Ajouter en tête du prompt une **section `<base_de_conhecimento_indice>` injectée pre-loaded** contenant la TOC du corpus (Partes A à J avec sous-sections). Cible la solution au défaut C : Max sait toujours ce qui existe.

### Écart E2 — Pas de TOC injectée + parser ne couvre pas Partes H et J + `deriveSource` trop pauvre pour Partie I

**Cible Anthropic** : contexte hybride = TOC pré-chargée + chunks à la demande, 1 chunk par sous-section, métadonnées en tête de chunk.

**Actuel** : pas de TOC injectée ; bugs B1, B2, B3 décrits §2.2.

**Action proposée :**
1. **Extraire la TOC** une fois à l'ingestion (parser lit `#`, `##`, `###`) et la sérialiser en `_legal_toc_pt` (KV ou row spéciale en base).
2. **Injecter la TOC** dans le prompt système (dans `<base_de_conhecimento_indice>`) — coût ~500 tokens, payé une fois par requête.
3. **Patcher le parser** ([`route.ts:101-180`](../../app/api/admin/ingest-legal-corpus-pt/route.ts:101)) pour découper **les bullets de la Partie H** comme chunks (1 chunk par bullet `- **Topic.**`), et **les entrées du Glossaire** (Partie J) comme chunks séparés (1 chunk par terme).
4. **Enrichir `deriveSource()`** ([`route.ts:60-75`](../../app/api/admin/ingest-legal-corpus-pt/route.ts:60)) pour la Partie I : extraire le code du diplôme depuis le titre `## I.X — Theme (Decreto-Lei n.º Y/Z)` et l'assigner comme `source`.
5. **Préfixer chaque chunk content** par un en-tête metadata explicite (Anthropic : *« Chaque chunk porte en tête ses métadonnées »*) :
   ```
   [Partie I > I.3 — Ascensores | DL 320/2002 | ✅ DRE]
   <texte du chunk>
   ```
6. **Régénérer la base64** dans `lib/syndic/legal-corpus-pt-md.ts` à partir du nouveau `.md`.
7. **Relancer l'ingestion** via `POST /api/admin/ingest-legal-corpus-pt`. **À décider : purger les anciens chunks avant ?** (cf. Q1 plus bas)

### Écart E3 — Outils non exposés au LLM (`kb_search` / `kb_get_section`)

**Cible Anthropic** : 2 outils nommés, namespacés `kb_`, descriptions claires, réponses sobres.

**Actuel** : le retrieval est fait par la route serveur **avant** l'appel au LLM ; aucun outil n'est exposé via Groq tool-calling. Le LLM répond avec un contexte déjà fourni.

**Décision architecturale à valider :**

| Option | Pour | Contre |
|---|---|---|
| (a) **Status quo : retrieval pré-LLM** | Simple, latence faible, validation prouvée | Le LLM ne peut pas raffiner sa recherche ; pas alignement strict avec « 2 outils » |
| (b) **Exposer `kb_search` + `kb_get_section` via Groq tool-calling** | Aligné Anthropic ; LLM peut chercher plusieurs fois si besoin | Latence x2-3, complexité, test plus lourd, perte du contrôle pré-LLM |
| (c) **Hybride : retrieval initial pré-LLM + `kb_search` exposé pour raffinement optionnel** | Garde la simplicité + ouvre la possibilité de précision | Plus complexe à valider, doit être prouvé par évals (per brief « Sans preuve par évaluation, on ne complexifie pas ») |

Le brief Anthropic dit explicitement : *« N'ajoute de complexité que si une évaluation prouve un gain mesurable »*. Donc :
→ **Recommandation : (a) status quo en premier**, puis **(c) si les évals montrent un gain** sur les questions de Partie I (où le rerank peut manquer le bon chunk au premier tour).

**Action minimale obligatoire** : documenter cette décision dans `RAPPORT.md` final, avec les chiffres d'éval à l'appui. Pas d'implémentation d'outils sans preuve.

---

## 5. Suite d'évaluations — état + plan

### 5.1 État actuel des évaluations Max

| Existant | Localisation | Limite |
|---|---|---|
| Test unitaire « hallucination » | [`tests/hallucination-eval.test.ts`](../../tests/hallucination-eval.test.ts) | Probablement générique, pas spécifique au corpus PT du condomínio |
| Workflow GitHub `ai-eval.yml` | `.github/workflows/ai-eval.yml` | DeepEval sur modifications IA, déclenchement à la PR |
| Workflow `langfuse-eval.yml` | `.github/workflows/langfuse-eval.yml` | Éval nocturne globale, crée issue si qualité < 0.7 |

→ **Pas de suite spécifique Max** avec les 4 cas de non-régression du brief, ni de jeu held-out.

### 5.2 Cible — `docs/agent-max/evals/`

Structure proposée :

```
docs/agent-max/evals/
├── README.md                       # Méthodologie + comment lancer
├── train/                           # Jeu visible pendant le tuning
│   ├── 01-comparison-numerique.jsonl   # 8-10 cas (défaut A)
│   ├── 02-controle-perimetre.jsonl     # 8-10 cas (défaut B)
│   ├── 03-matiere-couverte.jsonl       # 12-15 cas (défaut C — la Partie I)
│   ├── 04-citation-verbatim.jsonl      # 8-10 cas (anti-faux verbatim)
│   ├── 05-cobranca-quotas.jsonl        # 5-8 cas (Partie F)
│   ├── 06-impugnacao.jsonl             # 5-8 cas (Partie G, art. 1433.º)
│   ├── 07-reparticao-encargos.jsonl    # 5-8 cas (art. 1424.º + Partie G)
│   └── 08-personalidade-judiciaria.jsonl  # 4-6 cas (F.0 nouvelle)
├── held-out/                        # Jeu tenu à l'écart, jamais regardé pendant tuning
│   └── *.jsonl                      # ~30 % de la taille du train
├── run-evals.ts                     # Script de lancement (Vitest ? Tsx ?)
└── results/                         # Résultats horodatés (gitignore? OU commitable pour traçabilité)
```

### 5.3 Vérificateurs envisagés (par cas)

| Type de cas | Vérificateur | Strictness |
|---|---|---|
| Comparaison numérique | Regex sur réponse cherchant le pattern « `\d+\s*[<>=]+\s*\d+` » + présence du verdict de non-conformité | Modérée |
| Contrôle de périmètre | Présence d'une phrase de refus explicite (« fora do âmbito », « fora da base ») + absence de procédure inventée (LLM-judge) | Stricte |
| Matière couverte | Présence d'au minimum 1 citation `[FONT-X]` valide pointant vers un chunk de Partie I | Stricte |
| Citation verbatim | `validateMaxResponse` réussit (déjà existant) | Automatique |
| Jurisprudence | LLM-judge : citation d'au moins 1 acórdão avec n° de processo de la base | Modérée |

### 5.4 Métriques au-delà du taux de réussite

Conformément au brief : journaliser pour chaque éval **chunks récupérés (ids)**, **appels d'outils** (s'il y en a en option (c)), **réponse**, **latence**, **tokens consommés**. Source : déjà disponible via Langfuse (`traceAgent`).

---

## 6. À soumettre à un juriste portugais

Conformément au brief : je SIGNALE, je ne corrige rien.

| # | Élément | Constat | Décision attendue d'un jurista |
|---|---|---|---|
| J1 | Partie H sans `## H.X` (bug B1) | La structure markdown actuelle ne permet pas au parser de chunker les 6 sujets professionnels. **Question** : peut-on ajouter des `## H.1`, `## H.2`, … autour des bullets existants ? C'est une intervention de **forme** (titres) sans modification de texte juridique — mais formellement c'est ajouter du contenu. | (a) OK pour titres ; (b) garder en 1 chunk unique géré côté parser ; (c) ne pas chunker |
| J2 | Partie J sans découpe (bug B2) | Idem J1 pour le glossaire. Découper en `### EMA`, `### IAS`, etc. autour des bullets existants ? | (a) OK ; (b) 1 chunk unique ; (c) ne pas chunker |
| J3 | Section A.2 (Lei 8/2022) | Présentée comme « lei de réforme » mais sans verbatim de ses articles, juste un résumé consolidé en Parties B/C. Une question « que dispose précisément la Lei 8/2022 dans son article X ? » devra être renvoyée à la consolidation B/C. | Confirmer que ce comportement est acceptable, ou demander un chunk dédié `source = "Lei 8/2022"` avec verbatim de la lei. |
| J4 | Section A.3 (DL 10/2024) | Idem A.2 — résumé sans verbatim de tous les articles du DL 10/2024 (seul l'art. 25.º et 26.º apparaissent en verbatim en I.1.2). | Idem J3 |
| J5 | Acórdão TC 408/2015 | Mentionné en F.1 mais sans n° de processo identifiable structuré (juste « Acórdão n.º 408/2015 »). | Confirmer que la référence telle quelle suffit, ou ajouter le n° de processo si connu |
| J6 | Qualification du condomínio en matière de RGPD/CNPD | La nouvelle section I.6.3.4 du corpus *signale elle-même* que la qualification du condomínio en « pessoa singular », « PME » etc. pour la moldure de coima est à confirmer par un jurista. Cohérent avec la posture du prompt v1.1 (« si la base signale une dúvida, Max la mentionne »). | Aucune action immédiate — c'est documenté dans le corpus comme à confirmer |
| J7 | DL 39/2010 (mobilidade elétrica) | Indiqué comme **revogado** dans le nouveau corpus (par DL 93/2025). Le statut formel de revogação à confirmer si pas déjà confronté DRE. | Si le sceau ✅ DRE est apposé sur DL 93/2025 (corpus le confirme), c'est OK |
| J8 | Réserves de sceau résiduelles selon le brief | Le brief mentionne en note finale : *« Deux réserves de sceau subsistent dans le fichier : la grille SCIE `◆ ANEPC` et la Portaria 128/2026/1 `◆ por confirmar` »*. Or, le nouveau corpus apposé ✅ DRE sur ces deux éléments (cf. §I.2.2 ligne 716 « grelha das categorias de risco… selo: ✅ DRE » et §I.5 « confrontada com fonte oficial »). | **Le jurista doit confirmer si ces ✅ DRE sont défendables**, ou si le corpus a été trop optimiste sur ces deux points et qu'il faut rétrograder à `◆`. Le brief est postérieur au corpus selon mes vérifications — c'est l'audit attendu |

---

## 7. Liste explicite de ce que je n'ai PAS fait dans cet audit (et pourquoi)

Conformément au brief livrable 4 (transparence sur l'inaction) :

| Action non faite | Raison |
|---|---|
| Implémenter le service de sync DRE/ELI décrit dans `nota-tecnica-integracao-dre-plataforma.md` | Hors scope Étapes 1-6 du brief — vision moyen terme, exige décision produit et un jurista responsable (cf. §8 du document) |
| Régénérer la base64 du `.md` corrigé dans `lib/syndic/legal-corpus-pt-md.ts` | Modification de code — interdite avant validation de l'audit |
| Patcher le parser pour Partes H/J | Idem |
| Enrichir `deriveSource()` pour la Partie I | Idem |
| Relancer l'ingestion en prod | Action irréversible (mais idempotente) — exige validation explicite |
| Vérifier exhaustivement l'absence de badges « citation vérifiée » côté UI | Hors scope brief ; à faire dans Tâche d'instrumentation (`Étape : garde-fous`) |
| Écrire la suite d'évals `docs/agent-max/evals/` | Tâche centrale dédiée (livrable 3 du brief) — exige validation du périmètre des cas |
| Implémenter les outils `kb_search` / `kb_get_section` | Décision architecturale en attente (cf. E3) ; le brief impose de prouver par éval qu'on en a besoin |
| Compter combien de chunks sont actuellement en prod (GET `/api/admin/ingest-legal-corpus-pt`) | Action API admin — exige ton accord explicite et tes credentials super_admin |
| Lire `nota-tecnica-integracao-dre-plataforma.md` | Fichier non fourni |
| Toucher au contenu juridique du corpus | RÈGLE ABSOLUE |

---

## 8. Décisions attendues avant Étape suivante

| # | Question | Recommandation |
|---|---|---|
| Q1 | Lors de la re-ingestion : **supprime-t-on les anciens chunks** (issus de l'ancien corpus) avant d'insérer les nouveaux ? | **Oui** — sinon on aura les deux générations en base, et le rerank pourra remonter d'anciens chunks obsolètes. Risque acceptable car la table n'est pas partagée avec d'autres features |
| Q2 | Décision sur l'**Écart E3** (outils `kb_search`/`kb_get_section`) : (a) status quo, (b) tool-calling complet, (c) hybride | **(a) status quo + (c) si les évals le demandent** — conforme au principe Anthropic « commencer simple » |
| Q3 | **Validation des Partes H et J par jurista** (cf. J1, J2) : on attend son OK pour ajouter des `## H.X` et `### Glossário > terme` ? | **Oui** par défaut — règle absolue de prudence. Sinon, alternative : laisser le parser créer 1 chunk monolithique par Partie H et J (parser-side, sans toucher au .md) |
| Q4 | `nota-tecnica-integracao-dre-plataforma.md` : reçu en v(3). Vision long terme. **À implémenter dans le cadre des Étapes 1-6 ?** | **Non** — hors scope du brief Anthropic. À traiter comme chantier séparé après stabilisation Max. Brief le confirme en note finale. |
| Q5 | **Périmètre des évals** : 8 catégories proposées (cf. §5.2) — tu valides ces 8 ou tu en veux plus/moins ? | **Valider ces 8** comme base, ajustable à la marge |
| Q6 | **Suppression des anciens prompts périmés** (`prompt-claude-code-chantier-max.md`, `prompt-claude-code-extraction-legislacao.md`) — aucun dans le repo. Je signale et je laisse | OK |
| Q7 | Le brief mentionne en note finale que *« deux réserves de sceau subsistent : grille SCIE `◆ ANEPC` et Portaria 128/2026/1 `◆ por confirmar` »* — or le corpus corrigé que tu m'as fourni les marque ✅ DRE. Conflit. Le brief est antérieur au corpus corrigé ? | **À confirmer par toi** — si oui, le brief est désormais inexact sur ce point et le corpus prime |

---

## 9. Prochaine étape (uniquement après ta validation)

Selon le brief §MÉTHODE DE TRAVAIL, l'ordre d'implémentation est :

1. **Indexation/chunking** : patcher le parser (B1, B2, B3, B4), régénérer la base64, relancer l'ingestion
2. **Câblage du prompt système** : refondre `buildPT()` en sections balisées XML + injection de la TOC
3. **Garde-fous** : v1.1 active la règle « pas d'auto-certification » ; pas de badge UI ; validation citation déjà OK
4. **Observabilité** : déjà présente (Langfuse + Sentry), à étendre éventuellement avec des tags `eval_run_id`
5. **Suite d'évals** : construire `docs/agent-max/evals/` avec les 8 catégories
6. **Lancer les évals + lire les traces**
7. **Améliorer à partir des échecs** sans modifier le contenu juridique
8. **Réitérer jusqu'au taux stable** (held-out compris)
9. **Ajouter de la complexité (outil `kb_search` runtime ?) uniquement si l'éval prouve un gain mesurable**

---

**🛑 STOP — Point de contrôle human-in-the-loop**

J'attends tes réponses aux Q1-Q7 (§8) et ta validation/correction de cet audit avant de toucher au code. Aucune modification de code effectuée. Aucune ligne ajoutée en base.
