# Agents IA — Architecture

## Stack LLM
- **Syndic, Administrateur judiciaire, Copropriétaire** : **Claude Sonnet 5.5** (`claude-sonnet-5-5`,
  `CLAUDE_MODEL_AGENTS`) via `lib/claude.ts` — API REST Anthropic en fetch direct, mêmes formes d'entrée
  et de sortie que `lib/groq.ts` (`callClaudeWithRetry`, `callClaudeStreaming`). Secret `ANTHROPIC_API_KEY`
  (`wrangler secret put`). Sans clé, ou si Claude échoue avant la première réponse : bascule sur Groq.
- **Artisan / BTP** : Groq via API REST directe (`lib/groq.ts`) ; modèle par défaut `GROQ_MODEL_PRIMARY`
  (`lib/constants.ts`), encore Llama 3.3 70B, retiré (ci-dessous). L'Estimation matériaux a son propre modèle.
  **Modèles retirés par Groq** de ses offres gratuite et développeur (console.groq.com/docs/deprecations) :
  `llama-3.3-70b-versatile` et `llama-3.1-8b-instant` le 16/08/2026, `meta-llama/llama-4-scout-17b-16e-instruct`
  (vision) le 17/07/2026 ; remplaçants indiqués : `openai/gpt-oss-120b`, `openai/gpt-oss-20b`. Constaté en
  production le 14/11/2026 sur l'extraction d'Estimation matériaux (« Cerebras 404: Model does not exist ») :
  elle appelle désormais `openai/gpt-oss-120b`, sans le secours Cerebras (son modèle `llama-3.3-70b` n'existe
  plus), avec relais par Claude si Groq échoue ou rend une réponse inutilisable ; les échecs durables de Groq
  (4xx hors 429, clé absente, réponse inutilisable) partent dans Sentry (`lib/estimation-materiaux/ai/groq-extractor.ts`).
  Les autres agents qui nomment encore ces modèles (`lib/constants.ts` et les routes qui les écrivent en dur)
  restent à migrer.
- Fallback Groq des autres agents : Llama 3.1 8B (auto) + Cerebras + OpenRouter (matériaux) ; Llama 3.1 8B et
  le modèle Cerebras ont disparu eux aussi (ci-dessus).
- Pas de SDK tiers — tout via fetch + circuit breaker (lib/circuit-breaker.ts). Chaque dépendance alourdit
  le Worker Cloudflare (limite : 64 Mio non compressés, ligne « Total Upload » du déploiement ; plus de limite
  gzip depuis le 04/09/2026) : ne pas ajouter `@anthropic-ai/sdk`.
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
- Artisan / BTP (Claude, seul à lire les photos) : Dictionnaire matériaux — `app/api/dictionnaire-materiaux/analyse`,
  consignes et relecture de la réponse dans `lib/dictionnaire-materiaux/ia/`. La réponse ne cite que des matériaux
  du catalogue du pays : tout identifiant hors catalogue est écarté côté serveur. Secours sans photo : Groq
  `openai/gpt-oss-120b` nommé dans la route (les modèles par défaut de `lib/constants.ts` sont retirés), sans Cerebras.
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
