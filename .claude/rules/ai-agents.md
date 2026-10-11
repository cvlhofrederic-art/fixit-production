# Agents IA — Architecture

## Stack LLM
- **Syndic, Administrateur judiciaire, Copropriétaire** : **Claude Sonnet 5.5** (`claude-sonnet-5-5`,
  `CLAUDE_MODEL_AGENTS`) via `lib/claude.ts` — API REST Anthropic en fetch direct, mêmes formes d'entrée
  et de sortie que `lib/groq.ts` (`callClaudeWithRetry`, `callClaudeStreaming`). Secret `ANTHROPIC_API_KEY`
  (`wrangler secret put`). Sans clé, ou si Claude échoue avant la première réponse : bascule sur Groq.
- **Artisan / BTP** : Groq (Llama 3.3 70B) via API REST directe (`lib/groq.ts`).
- Fallback Groq : Llama 3.1 8B (auto) + Cerebras + OpenRouter (matériaux)
- Pas de SDK tiers — tout via fetch + circuit breaker (lib/circuit-breaker.ts). Le Worker Cloudflare est
  proche de sa taille maximale : ne pas ajouter `@anthropic-ai/sdk`.
- Recherche web : Tavily API (matériaux AI)

## Claude Sonnet 5.5 — contraintes d'API (lib/claude.ts les applique)
- Pas de `temperature` (valeur non par défaut = erreur 400) ; réflexion adaptative + `output_config.effort`
  (`low` par défaut, `medium` pour Max dans l'Administrateur judiciaire).
- Pas de « prefill » : le dernier message doit venir de l'utilisateur ; messages système en tête seulement
  (un message système en cours de conversation est converti en tour utilisateur).
- Mode JSON : pas de `response_format` côté Anthropic — consigne ajoutée au prompt + nettoyage de la réponse.
- Réponses lues par type de bloc (la réponse peut commencer par un bloc de réflexion vide).

## Agents actifs
- Artisan / BTP (Groq) : Fixy AI artisan, Fixy Chat, Simulateur travaux, Matériaux AI, Email Agent,
  Analyse Devis client, Comptable AI.
- Syndic v54 (Claude) : Fixy Syndic, Max (juridique, RAG), Léa (comptable), Alfredo (e-mails), Tempo
  (automatisations), Analyse devis syndic, classification d'incidents, accessibilité / sécurité incendie.
- Administrateur judiciaire (Claude) : Fixy, Max, Léa, Tempo — `app/api/administrateur-judiciaire/agent`,
  contexte construit côté navigateur depuis la base locale (`lib/administrateur-judiciaire/ia/`).
- Copropriétaire (Claude) : Fixy copro — `app/api/copro-ai`.
Prompts dans `app/api/*/route.ts` ou `lib/**/prompts*`.

## Voix
Web Speech API navigateur (fr-FR). Pas de backend STT.
Composant : components/chat/AiChatBot.tsx.

## Règles
- Modifier un prompt → vérifier avec `ai-eval.yml` (DeepEval)
- Tout nouvel agent → instrumenter avec lib/langfuse.ts (traceAgent)
- Sentry taggue automatiquement les erreurs par agent_type
- Réponses IA affichées avec `components/common/MarkdownIA.tsx` (Markdown rendu en éléments React, jamais
  de HTML injecté)
- Commits IA : utiliser le préfixe `ai:` (changelog dédié)
- Commits voix : utiliser le préfixe `voice:`
