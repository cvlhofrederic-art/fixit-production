# Agents IA — Architecture

## Stack LLM
- **Syndic, Administrateur judiciaire, Copropriétaire** : **Claude Sonnet 5.5** (`claude-sonnet-5-5`,
  `CLAUDE_MODEL_AGENTS`) via `lib/claude.ts` — API REST Anthropic en fetch direct, mêmes formes d'entrée
  et de sortie que `lib/groq.ts` (`callClaudeWithRetry`, `callClaudeStreaming`). Secret `ANTHROPIC_API_KEY`
  (`wrangler secret put`). Sans clé, ou si Claude échoue avant la première réponse : bascule sur Groq.
- **Artisan / BTP** : Groq (`openai/gpt-oss-120b`, `GROQ_MODEL_PRIMARY`) via API REST directe (`lib/groq.ts`).
  Llama 3.3 70B / 3.1 8B arrêtés par Groq le 16/08/2026 (404). gpt-oss raisonne : la réflexion compte
  dans `max_tokens` ; `parametresRaisonnementGroq` (lib/groq.ts) envoie `reasoning_effort: 'low'` et
  `include_reasoning: false` — à reprendre dans tout appel Groq en fetch direct.
- Fallback Groq : `openai/gpt-oss-20b` (`GROQ_MODEL_FALLBACK`, auto) + Cerebras + OpenRouter (matériaux)
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
- Syndic v54 (Claude) : Fixy Syndic (actions exécutées après confirmation), Max (juridique, RAG ; hors base :
  réponse générale « à vérifier »), Léa (comptable), Alfredo (e-mails), Tempo (automatisations), Analyse devis
  syndic, classification d'incidents, accessibilité / sécurité incendie.
- Administrateur judiciaire (Claude) : Fixy, Max, Léa, Tempo, Alfredo — `app/api/administrateur-judiciaire/agent`,
  contexte construit côté navigateur depuis la base locale (`lib/administrateur-judiciaire/ia/`) ; outils
  analyse de devis / factures, rédaction de PV, saisie de factures (vision) — `app/api/administrateur-judiciaire/outils`.
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
