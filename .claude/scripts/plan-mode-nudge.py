#!/usr/bin/env python3
"""
UserPromptSubmit hook — plan-mode + decomposition nudge for Vitfix.io.

Aligned with official Anthropic guidance:
- https://www.anthropic.com/engineering/claude-code-best-practices (skip plan mode for trivial)
- https://www.anthropic.com/research/question-decomposition-improves-the-faithfulness-of-model-generated-reasoning
- https://code.claude.com/docs/en/agent-sdk/todo-tracking (cap at 6-7 tasks)

Strategy: do NOT block, only inject `additionalContext`. Trivial prompts pass through silently.
Non-trivial prompts get a reminder to enter plan mode + decompose via TodoWrite (cap 6).
Vitfix-specific addenda fire for BTP, artisan, paiement, Supabase, PDF, IA, Cloudflare, SEO.
"""

import json
import re
import sys

TRIVIAL_PREFIXES = re.compile(
    r"^(corrige|fix|renomme|rename|lance|run|exécute|execute|où|where|"
    r"explique|explain|montre|show|liste|list|cat|read|affiche|c'est quoi|what is)\b",
    re.IGNORECASE,
)

NONTRIVIAL_MARKERS = re.compile(
    r"\b(implémente|implemente|nouvelle feature|ajoute la feature|refactor|migre|"
    r"migration|audit|intègre|integre|crée le|cree le|build the|setup|configure|"
    r"met en place|architecture|conçois|design the)\b",
    re.IGNORECASE,
)

DOMAIN_RULES = [
    (
        r"\b(btp|chantier|équipe|equipe|pointage|retenue|garantie|sous-traitant|dpgf|cstb|marché|marche|customtable)\b",
        "[BTP] Lire .claude/rules/artisan-vs-btp.md — séparation stricte. NE PAS toucher au côté artisan sans demande explicite.",
    ),
    (
        r"\b(artisan|devis|prestation|fixy ai|micro-entrepreneur|franchise 293b)\b",
        "[Artisan] PDF V2 (lib/pdf/devis-generator-v2.ts), franchise 293B → mentions adaptées. NE PAS toucher V3 BTP.",
    ),
    (
        r"\b(stripe|paiement|payment|wallet|payout|kyc|webhook|escrow|tva)\b",
        "[Paiement] Zone sensible. Zod validation, rate limiting, jamais de détails internes au client. Logger via lib/logger.ts.",
    ),
    (
        r"\b(supabase|rls|realtime|policy|trigger|migration sql|postgres)\b",
        "[Supabase] Vérifier RLS avant tout. Bug récurrent Realtime : compteur erreurs + removeChannel après 3 échecs.",
    ),
    (
        r"\b(pdf|facturx|jspdf|liberation sans|rc pro|html2canvas)\b",
        "[PDF] 3 paths (download/aperçu/FacturX). Liberation Sans pour Unicode. Tester les 3 paths après modif.",
    ),
    (
        r"\b(simulateur( v2)?|prix 2026|tier 1|coefficient régional|estimation matériaux)\b",
        "[Simulateur V2] TDD obligatoire — couverture dense (10 fichiers tests/simulateur-v2-*). Refléter tout changement par un test.",
    ),
    (
        r"\b(groq|fixy|hallucination|prompt(s)? ia|langfuse|tavily|deepeval|llm)\b",
        "[IA] Modifier un prompt → vérifier ai-eval.yml (DeepEval). Tracer via lib/langfuse.ts. Préfixe commit `ai:`.",
    ),
    (
        r"\b(cloudflare|wrangler|opennext|workers|cf pages)\b",
        "[Cloudflare] Seul pipeline prod = .github/workflows/deploy-cloudflare.yml. Plus jamais Vercel. Secrets via `wrangler secret put`.",
    ),
    (
        r"\b(seo|sitemap|metadata|schema\.org|breadcrumb|h1|canonical)\b",
        "[SEO] Vérifier l'existant avant de créer. Title 50-60c, Description 150-160c, canonical vitfix.io. PT = portugais européen.",
    ),
    (
        r"\b(capacitor|mobile|ios|android|com\.fixit)\b",
        "[Mobile] App Capacitor 8.1 (com.fixit.artisan). Import dynamique obligatoire (SSR Next.js).",
    ),
]

PLAN_NUDGE = (
    "[plan-mode-nudge] Tâche non-triviale détectée. Avant d'écrire ou modifier du code :\n\n"
    "1. **EnterPlanMode** — aligner l'approche avec l'utilisateur.\n"
    "2. **TodoWrite** — décomposer en ≤ 6 sous-tâches (au-delà, le suivi se dégrade — guidance Anthropic).\n"
    "3. **Attendre validation** sur le plan avant exécution.\n\n"
    "Skip ces étapes si la tâche s'avère triviale malgré le pattern."
)


def main() -> int:
    try:
        payload = json.load(sys.stdin)
    except (json.JSONDecodeError, ValueError):
        return 0

    prompt = (payload.get("prompt") or "").strip()
    if not prompt:
        return 0

    if TRIVIAL_PREFIXES.match(prompt):
        return 0

    word_count = len(prompt.split())
    is_nontrivial = word_count > 30 or bool(NONTRIVIAL_MARKERS.search(prompt))

    addenda = []
    for pattern, message in DOMAIN_RULES:
        if re.search(pattern, prompt, re.IGNORECASE):
            addenda.append(message)
            is_nontrivial = True

    if not is_nontrivial:
        return 0

    context = PLAN_NUDGE
    if addenda:
        context += "\n\n" + "\n".join(addenda)

    json.dump(
        {
            "hookSpecificOutput": {
                "hookEventName": "UserPromptSubmit",
                "additionalContext": context,
            }
        },
        sys.stdout,
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
