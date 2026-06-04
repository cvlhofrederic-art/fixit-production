# Suite d'évaluations Max v1.1 (PT)

> **Méthode pro 2026 — Anthropic-aligned.** La performance d'un agent IA n'existe
> pas dans l'absolu : elle se mesure contre une suite d'évaluations ancrée dans
> des usages réels. Cette suite couvre les 4 défauts observés sur Max + le cœur
> de la base juridique du condomínio PT.

## Structure

```
docs/agent-max/evals/
├── README.md                                  # Ce fichier
├── train/                                     # Jeu visible pendant le tuning
│   ├── 01-comparison-numerique.jsonl          # Défaut A — comparaison de seuils
│   ├── 02-controle-perimetre.jsonl            # Défaut B — refus hors-périmètre
│   ├── 03-matiere-couverte.jsonl              # Défaut C — Partie I et autres
│   ├── 04-citation-verbatim.jsonl             # Anti-faux verbatim
│   ├── 05-cobranca-quotas.jsonl               # Cœur : Partie F + G.1
│   ├── 06-impugnacao.jsonl                    # Cœur : art. 1433.º + Partie G.2
│   ├── 07-reparticao-encargos.jsonl           # Cœur : art. 1424.º + Partie G.3
│   └── 08-personalidade-judiciaria.jsonl      # Nouveau : Partie F.0 (CPC art. 12.º)
├── held-out/                                  # Jeu tenu à l'écart pendant le tuning
│   ├── 01-comparison-numerique.jsonl
│   ├── 02-controle-perimetre.jsonl
│   ├── 03-matiere-couverte.jsonl
│   ├── 04-citation-verbatim.jsonl
│   ├── 05-cobranca-quotas.jsonl
│   ├── 06-impugnacao.jsonl
│   ├── 07-reparticao-encargos.jsonl
│   └── 08-personalidade-judiciaria.jsonl
├── run-evals.ts                               # CLI tsx — lance la suite
└── results/                                   # Sorties horodatées (gitignored)
```

## Format d'un cas (JSONL — 1 ligne JSON par cas)

```json
{
  "id": "cmp-001",
  "category": "comparison-numerique",
  "question": "A convocatória da assembleia foi enviada 6 dias antes. Está bem?",
  "verifier": "regex",
  "expected_refusal": false,
  "must_contain_regex": ["6\\s*<\\s*10", "1432"],
  "must_not_contain_regex": ["[Cc]onforme", "v[áa]lida\\.?\\s*$"],
  "expected_sources": ["Código Civil"],
  "notes": "Le délai légal de convocation est de 10 jours minimum (art. 1432.º n.º 1)."
}
```

### Champs

| Champ | Type | Description |
|---|---|---|
| `id` | string | Identifiant unique du cas (préfixe = catégorie courte) |
| `category` | string | Une des 8 catégories listées plus haut |
| `question` | string | La question posée à Max, en portugais européen |
| `verifier` | enum | `regex` \| `citation_count` \| `llm_judge` \| `refusal_pattern` |
| `expected_refusal` | boolean | Si `true`, on attend `refusal=true` dans la réponse |
| `must_contain_regex` | string[] | Patterns regex qui DOIVENT matcher (verifier `regex`) |
| `must_not_contain_regex` | string[] | Patterns regex qui NE DOIVENT PAS matcher |
| `min_citations` | number | Nombre minimum de citations valides (verifier `citation_count`) |
| `expected_sources` | string[] | Sources attendues dans `retrieval.chunks` (informatif, soft) |
| `judge_criteria` | string | Critère textuel pour `llm_judge` (en portugais) |
| `notes` | string | Note du concepteur du cas (jamais vue par Max) |

## Verifiers disponibles

### `regex`

Vérifie que `must_contain_regex` matchent tous ET que `must_not_contain_regex` ne matchent aucun. Strict.

### `citation_count`

Vérifie que la réponse contient au moins `min_citations` citations valides (avec `quote_verified=true`). Bon pour les cas « matière couverte » où on veut s'assurer qu'au moins une citation est produite.

### `refusal_pattern`

Vérifie que :
- `refusal === expected_refusal`
- Si `expected_refusal=true`, la réponse contient une phrase de refus standard ET NE contient PAS de procédure inventée (`must_not_contain_regex`).

### `llm_judge`

Demande à un LLM (Groq Llama 3.1 8B) de noter la réponse de 0 à 1 sur `judge_criteria`. Utilisé pour les cas qualitatifs (jurisprudence, articulation des normes). Seuil de passage : ≥ 0.7.

## Critères de succès (D2 du plan)

Baseline acceptable : **≥ 85 %** sur les 4 catégories de non-régression (1-4) ET **≥ 80 %** sur le cœur (5-8). Train ET held-out. Si non atteint après tuning paramétrique, échecs résiduels documentés dans `docs/agent-max/RAPPORT.md`.

## Utilisation

### Lancer une passe complète

```bash
# Train (visible)
EVAL_RUN_ID=baseline-$(git rev-parse --short HEAD) \
MAX_AI_ENDPOINT=https://vitfix.io/api/syndic/max-ai \
SUPER_ADMIN_TOKEN=<token> \
  npx tsx docs/agent-max/evals/run-evals.ts --set=train

# Held-out (à ne pas regarder pendant le tuning)
EVAL_RUN_ID=heldout-$(git rev-parse --short HEAD) \
MAX_AI_ENDPOINT=https://vitfix.io/api/syndic/max-ai \
SUPER_ADMIN_TOKEN=<token> \
  npx tsx docs/agent-max/evals/run-evals.ts --set=held-out
```

### Filtrer par catégorie

```bash
npx tsx docs/agent-max/evals/run-evals.ts --set=train --category=02-controle-perimetre
```

### Sortie

Le runner écrit `results/<timestamp>-<eval_run_id>.json` avec :

```json
{
  "eval_run_id": "baseline-dc1e6c5",
  "started_at": "2026-05-17T15:30:00Z",
  "endpoint": "https://vitfix.io/api/syndic/max-ai",
  "set": "train",
  "summary": {
    "total": 52,
    "passed": 47,
    "failed": 5,
    "pass_rate": 0.904
  },
  "by_category": {
    "01-comparison-numerique": { "passed": 8, "failed": 0, "pass_rate": 1.0, "latency_p50_ms": 4200, "latency_p95_ms": 7800 },
    ...
  },
  "failures": [
    { "id": "cmp-005", "category": "comparison-numerique", "reason": "must_contain_regex /6\\s*<\\s*10/ did not match", "response_excerpt": "..." }
  ]
}
```

Code de sortie : `0` si tous les seuils passent, `1` sinon.

## Méthodologie d'amélioration (per brief Anthropic)

Lire les traces — y compris le raisonnement de l'agent et les transcriptions brutes :

```bash
# Filtrer les traces Langfuse par eval_run_id
# (header X-Eval-Run-Id passé automatiquement par le runner)
```

Améliorer à partir des échecs. Le tuning est **paramétrique uniquement** :
- Description du prompt v1.1 (forme, pas fond — pas de modification du contenu juridique)
- Seuils du rerank (`MIN_RERANK_SCORE`, `MATCH_COUNT`)
- Paramètres du chunking (parser)

**Jamais** modifier le contenu du `.md` du corpus.

Réitérer jusqu'à atteinte des seuils sur le held-out.

## Hors scope de cette suite

- Tests E2E UI (Playwright) — couverts par `e2e/`
- Tests de performance sous charge — peuvent être ajoutés ultérieurement
- Audit juridique de la base — relève d'un jurista portugais, jamais de cette suite
