# Agents IA — Architecture

## Stack LLM
- **Syndic, Administrateur judiciaire, Copropriétaire** : **Claude Sonnet 5.5** (`claude-sonnet-5-5`,
  `CLAUDE_MODEL_AGENTS`) via `lib/claude.ts` — API REST Anthropic en fetch direct, mêmes formes d'entrée
  et de sortie que `lib/groq.ts` (`callClaudeWithRetry`, `callClaudeStreaming`). Secret `ANTHROPIC_API_KEY`
  (`wrangler secret put`). Sans clé, ou si Claude échoue avant la première réponse : bascule sur Groq.
- **Artisan / BTP** : Groq via API REST directe (`lib/groq.ts`), modèles `GROQ_MODEL_*` de `lib/constants.ts`
  (`openai/gpt-oss-120b` ; petits appels `openai/gpt-oss-20b`, aussi repli du principal), jamais en dur dans une
  route. Appels par `lib/ai/relais.ts` : `appelerIA` / `fluxIA` = Groq (principal, puis repli), puis **relais par
  Workers AI** (Gemma 4 26B puis Qwen 3.8 27B, `lib/workers-ai.ts`) si Groq échoue ou rend une réponse vide ; ni
  Cerebras ni Claude sur ces routes (sous-traitants non déclarés ; clé Anthropic refusée en production depuis le
  15/11/2026). `iaTexteDisponible()` pour le contrôle de configuration. Une échéance pour toute la chaîne
  (`budgetMs`, 28 s par défaut : l'écran de Fixy AI abandonne à 30 s ; Groq en prend la moitié quand le relais est
  possible). Relais possible : pas de nouvel essai Groq après un 429 ; demande de plus de 150 000 caractères : pas de
  relais. Pannes durables (clé refusée, modèle retiré, sortie inattendue) dans Sentry (module `ia-relais`), pannes
  passagères (quota, capacité, délai) en simple avertissement : un retrait de modèle ne doit plus passer inaperçu.
- **Documents** (pièce d'identité, Kbis, KYC, tickets, factures fournisseurs, OCR de l'agent e-mail) : images lues
  par Workers AI (Gemma 4 puis Qwen 3.8), PDF lus par leur couche de texte (unpdf, sans modèle) — `appelerVision`,
  `visionDisponible`, `typeDocument` / `dataUrlDocument` pour le vrai type d'un fichier. Groq n'a plus de modèle
  de vision hors préversion. 5 Mo par document, images seulement sauf `pdf: true` (verify-kbis), pages d'un PDF
  bornées (pdf.js) ; un PDF scanné (sans texte) n'est pas lu. Le KYC ne lit pas les PDF (une couche de texte se rédige
  à la main : l'approbation sur cette seule preuve reste à décider), ni la pièce d'identité sans nom à comparer.
  verify-id (publique) : images seulement, poids contrôlé avant lecture, 300 vérifications par jour au plus.
- **Modèles retirés** (console.groq.com/docs/deprecations, relu le 15/11/2026) : `llama-3.3-70b-versatile` et
  `llama-3.1-8b-instant` le 16/08/2026, `meta-llama/llama-4-scout-17b-16e-instruct` (vision) le 17/07/2026 ;
  Cerebras a retiré `llama-3.3-70b` (annonce du 16/02/2026) ; le modèle gratuit OpenRouter de Matériaux AI
  n'existe plus (secours supprimé). Avant d'écrire un nom de modèle : relire ces pages.
- gpt-oss raisonne avant de répondre et ce raisonnement compte dans `max_tokens` : `lib/ai/raisonnement.ts`
  (marge de 512 jetons, `reasoning_effort: 'low'` par défaut), appliqué par lib/groq et lib/cerebras. Offre
  gratuite de Groq : 8 000 jetons par minute pour gpt-oss ; une requête plus grosse passe au relais.
- Messages rendus au client : jamais de nom de fournisseur, de modèle ni de clé (détail dans les journaux).
- Pas de SDK tiers — tout via fetch + circuit breaker (lib/circuit-breaker.ts). Chaque dépendance alourdit
  le Worker Cloudflare (limite : 64 Mio non compressés, ligne « Total Upload » du déploiement ; plus de limite
  gzip depuis le 04/09/2026) : ne pas ajouter `@anthropic-ai/sdk`.
- Recherche web : Tavily API (matériaux AI)
- **Workers AI** (Cloudflare) : binding `AI` déclaré dans `wrangler.toml`, sans clé ni SDK. Embeddings et reranker
  du syndic (`lib/syndic/embed.ts`, `rerank.ts`) ; génération de texte par `lib/workers-ai.ts` (`callWorkersAI`,
  format de `lib/groq.ts`, réflexion coupée par `chat_template_kwargs.enable_thinking: false`, délai de 60 s).
  Gratuit : 10 000 neurones par jour pour tout le compte, remis à zéro à 00:00 UTC, puis facturé sur Workers Paid.
  Cloudflare retire souvent des modèles (24 le 20/11/2026, dont tout Nemotron) : nommer un relais. Absent de
  `next dev` et des tests (binding simulé par `getCfEnv`).

## Claude Sonnet 5.5 — contraintes d'API (lib/claude.ts les applique)
- Pas de `temperature` (valeur non par défaut = erreur 400) ; réflexion adaptative + `output_config.effort`
  (`low` par défaut, `medium` pour Max dans l'Administrateur judiciaire).
- Pas de « prefill » : le dernier message doit venir de l'utilisateur ; messages système en tête seulement
  (un message système en cours de conversation est converti en tour utilisateur).
- Mode JSON : pas de `response_format` côté Anthropic — consigne ajoutée au prompt + nettoyage de la réponse.
- Réponses lues par type de bloc (la réponse peut commencer par un bloc de réflexion vide).

## Agents actifs
- Artisan / BTP (Groq, relais Workers AI) : Fixy AI artisan, Fixy Chat, Matériaux AI, Analyse Devis client,
  Comptable AI, Analyse DCE, résumés des marchés, rapport d'intervention, Email Agent (classement réservé au syndic,
  OCR syndic et artisan) ; Simulateur travaux sur Groq seul (appels d'outils, secours Cerebras de lib/groq) ; lecture
  des documents (voir plus haut).
- Artisan / BTP, Estimation matériaux : `openai/gpt-oss-120b` sans Cerebras, relais par Claude si Groq échoue ou
  rend une réponse inutilisable ; échecs durables de Groq (4xx hors 429, clé absente, réponse inutilisable) dans
  Sentry (`lib/estimation-materiaux/ai/groq-extractor.ts`).
- Artisan / BTP (Workers AI gratuit d'abord) : Dictionnaire matériaux — `app/api/dictionnaire-materiaux/analyse`,
  consignes et relecture de la réponse dans `lib/dictionnaire-materiaux/ia/`. La réponse ne cite que des matériaux
  du catalogue du pays : tout identifiant hors catalogue est écarté côté serveur. Ordre d'essai, le suivant prenant
  la main sur un échec ou une réponse illisible : Workers AI Gemma 4 26B puis Qwen 3.8 27B (catalogue entier,
  photos comprises), Claude s'il a une clé, enfin Groq `openai/gpt-oss-120b` sans photo sur un catalogue réduit,
  sans Cerebras.
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
