# Agents IA — Architecture

## Stack LLM
- Provider principal : **Groq** (Llama 3.3 70B) via API REST directe (lib/groq.ts)
- Fallback : Llama 3.1 8B (auto) + OpenRouter (matériaux)
- Pas de SDK tiers — tout via fetch + circuit breaker (lib/circuit-breaker.ts)
- Recherche web : Tavily API (matériaux AI)

## 10 agents actifs
Fixy AI artisan, Fixy Chat, Simulateur travaux, Matériaux AI,
Email Agent, Max Syndic, Analyse Devis (x2), Comptable AI, Copro AI.
Tous dans app/api/*/route.ts. Prompts inline (pas de fichiers séparés).

## Voix
Web Speech API navigateur (fr-FR). Pas de backend STT.
Composant : components/chat/AiChatBot.tsx.

## Règles
- Modifier un prompt → vérifier avec `ai-eval.yml` (DeepEval)
- Tout nouvel agent → instrumenter avec lib/langfuse.ts (traceAgent)
- Sentry taggue automatiquement les erreurs par agent_type
- Commits IA : utiliser le préfixe `ai:` (changelog dédié)
- Commits voix : utiliser le préfixe `voice:`
