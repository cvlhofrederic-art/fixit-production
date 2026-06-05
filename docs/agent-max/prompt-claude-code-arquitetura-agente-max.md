# PROMPT POUR CLAUDE CODE — Architecture et mise en production de l'agent juridique « Max »

> **Comment utiliser ce fichier.** Ce document est un prompt destiné à Claude Code. Ouvre Claude Code à la racine du dépôt de la plateforme, puis copie-colle l'intégralité de la section « PROMPT » ci-dessous. Les sections « CONTEXTE POUR L'OPÉRATEUR HUMAIN » et « FICHIERS À FOURNIR » te sont destinées, à toi (Frédéric), pas à Claude Code.
>
> Ce prompt **remplace** les deux anciens prompts Claude Code produits précédemment : `prompt-claude-code-chantier-max.md` et `prompt-claude-code-extraction-legislacao.md`. Ils sont périmés — voir la consigne de remplacement dans le prompt.

---

## CONTEXTE POUR L'OPÉRATEUR HUMAIN (ne pas copier dans Claude Code)

### Ce que ce prompt fait et ne fait pas

Ce prompt demande à Claude Code d'**architecturer, indexer, instrumenter et tester** l'agent « Max ». Il s'appuie sur trois guides d'ingénierie publiés par Anthropic :
- *Building Effective Agents* (architecture : commencer simple, workflow vs agent, garde-fous, human-in-the-loop) ;
- *Effective Context Engineering for AI Agents* (le contexte est une ressource finie ; système prompt « à la bonne altitude » ; récupération hybride ; stratégie hybride recommandée explicitement pour le travail juridique) ;
- *Writing Effective Tools for Agents* (peu d'outils, bien définis ; namespacing ; réponses d'outils sobres ; processus piloté par les évaluations).

**Ce prompt ne prétend pas produire un agent « parfait ».** Les guides Anthropic sont clairs : l'objectif n'est pas la perfection immédiate mais un système dont la performance est *mesurée* et *améliorée par itérations*. La « performance » d'un agent n'a de sens que rapportée à une suite d'évaluations. C'est pourquoi la création de cette suite d'évaluations est la tâche centrale de ce prompt, et non un accessoire.

### Règle de sécurité absolue à connaître

Claude Code va toucher à l'indexation, au code de l'agent, aux outils, aux tests. Il ne doit **jamais modifier le contenu juridique** du fichier de connaissance (les articles de loi, leur texte, leurs sceaux de vérification). Cette interdiction est répétée dans le prompt ; elle est non négociable. Le contenu juridique a été confronté au Diário da República article par article ; seul un juriste peut le modifier.

### Avant de lancer Claude Code

Place dans le dépôt les fichiers listés à la section « FICHIERS À FOURNIR » ci-dessous. Sans eux, Claude Code travaillera à l'aveugle.

---

## FICHIERS À FOURNIR À CLAUDE CODE (à placer dans le dépôt avant de lancer)

Dépose ces fichiers à la racine du dépôt, dans un dossier `/docs/agent-max/` :

1. **`regime-juridico-condominio-portugal-2026.md`** — la base de connaissance juridique. C'est la matière que l'agent doit servir. **Contenu gelé** : Claude Code l'indexe, ne le réécrit pas.
2. **`prompt-sistema-agente-juridico-condominio-v1.1.md`** — le prompt système de Max, version 1.1. C'est le comportement de l'agent. Claude Code peut proposer des ajustements de *forme* (structuration en sections balisées), pas de *fond* (les règles juridiques de comportement).
3. **`nota-tecnica-integracao-dre-plataforma.md`** — la note technique sur l'alimentation de la base depuis les sources officielles (données ELI du DRE). Contexte pour la vision long terme.
4. Ce fichier-ci, `prompt-claude-code-arquitetura-agente-max.md`.

Si l'un de ces fichiers n'est pas fourni, Claude Code doit s'arrêter et le signaler, pas inventer son contenu.

---

═══════════════════════════════════════════════════════════════════
## PROMPT — copier tout ce qui suit dans Claude Code
═══════════════════════════════════════════════════════════════════

Tu es chargé d'architecturer, d'indexer, d'instrumenter et de tester un agent IA juridique de production nommé « Max ». Max est un assistant d'analyse juridique pour un cabinet de gestion de copropriétés (condomínios) au Portugal. Il répond à un juriste professionnel, à partir d'une base de connaissance vérifiée, en portugais du Portugal.

Ce travail suit des principes d'ingénierie d'agents publiés par Anthropic. Ils sont résumés dans ce prompt — applique-les, ne les contourne pas.

### PRINCIPE FONDATEUR — lis ceci avant tout

« Commencer par la solution la plus simple possible, et n'augmenter la complexité que lorsqu'elle apporte une valeur mesurable. » Tu ne dois PAS construire un système multi-agent, ni une orchestration sophistiquée. Pour ce cas d'usage — répondre à des questions juridiques à partir d'un corpus documentaire stable — l'architecture correcte est **un agent unique avec récupération de contexte (RAG)**. C'est délibéré et ce n'est pas négociable sans preuve, par évaluation, qu'une architecture plus complexe fait mieux.

De même : la « performance » d'un agent n'existe pas dans l'absolu. Elle se mesure contre une suite d'évaluations. Tu ne dois jamais affirmer que l'agent est « performant » ou « prêt » sans chiffres d'évaluation à l'appui. Si on te demande un agent « 100 % performant », traduis cela en : « un agent dont la suite d'évaluations passe à un taux mesuré, avec les échecs résiduels documentés ».

### RÈGLE DE SÉCURITÉ ABSOLUE — contenu juridique intouchable

Le fichier `regime-juridico-condominio-portugal-2026.md` contient des textes de loi confrontés au Diário da República, article par article, et porteurs de sceaux de vérification (`✅ DRE`, `◆`). 

Tu ne dois **JAMAIS** modifier ce contenu juridique : ni le texte des articles, ni les références de loi, ni les sceaux, ni les notes de vérification. Tu peux le lire, l'indexer, le découper en chunks, en extraire des métadonnées. Tu ne peux pas le réécrire, le corriger, le compléter, le résumer en remplacement, ni « améliorer » une formulation. Si tu crois détecter une erreur juridique, tu la signales dans ton rapport final dans une section « À soumettre à un juriste » — tu ne la corriges pas. Seul un juriste portugais peut modifier ce contenu.

La même prudence vaut pour le fond du prompt système v1.1 : tu peux retoucher sa *structure* (balises de section), pas ses *règles juridiques de comportement*.

### CONSIGNE DE REMPLACEMENT DES ANCIENS FICHIERS

Deux fichiers de prompt produits précédemment sont périmés : `prompt-claude-code-chantier-max.md` et `prompt-claude-code-extraction-legislacao.md`. S'ils sont présents dans le dépôt :
1. supprime-les ;
2. ce prompt-ci les remplace intégralement et fait seul foi.

Ne touche pas aux fichiers de contenu (`regime-juridico-...md`, `prompt-sistema-...v1.1.md`, `nota-tecnica-...md`).

### ÉTAPE 0 — Reconnaissance, sans rien modifier

Avant d'écrire une ligne de code :
1. Lis l'intégralité des quatre fichiers fournis dans `/docs/agent-max/`.
2. Explore le dépôt : identifie le langage, le framework, comment l'agent est actuellement appelé (s'il existe déjà), où vivent les clés d'API, comment le front communique avec le back.
3. Produis un fichier `/docs/agent-max/AUDIT.md` qui décrit, en l'état : l'architecture actuelle de l'agent (ou son absence), le mécanisme de récupération actuel (ou son absence), le mécanisme de citation actuel, et les écarts par rapport à l'architecture cible décrite ci-dessous.
4. **Arrête-toi après l'AUDIT.md et présente-le.** N'enchaîne pas sur l'implémentation sans validation. C'est un point de contrôle human-in-the-loop délibéré.

### ARCHITECTURE CIBLE

Agent unique, en boucle, avec récupération de contexte. Cinq composants :

**1. Le prompt système.** C'est `prompt-sistema-agente-juridico-condominio-v1.1.md`. Principe Anthropic de « bonne altitude » : ni logique rigide codée en dur, ni vague généralité. Le v1.1 est déjà à cette altitude. Ta tâche : t'assurer qu'il est chargé correctement, et le structurer en sections balisées explicites (`<identidade>`, `<fonte_de_conhecimento>`, `<metodo>`, `<regime_de_citacao>`, `<limites>`, `<exemplos>`) si ce n'est pas déjà le cas — sans toucher au fond.

**2. La récupération de contexte (RAG) — stratégie hybride.** Le guide Anthropic *Effective Context Engineering* recommande explicitement la **stratégie hybride** pour les domaines à contenu peu dynamique « comme le travail juridique ». Applique-la :
   - *Contexte chargé d'avance* : la table des matières du fichier de connaissance (les titres de Partie A à J et leurs sous-sections) est injectée en contexte à chaque requête. Légère, elle donne à Max une carte de ce qui existe — ce qui répond directement à un défaut connu : Max refusait à tort des sujets pourtant couverts.
   - *Récupération à la demande* : le corps des articles est découpé en chunks et récupéré par recherche au moment de la requête.
   - Découpage (chunking) : **un chunk par sous-section** du fichier (ex. « I.5.3 — Pontos de carregamento em edifícios já existentes »). Ne coupe jamais un article de loi en plein milieu : un article = au minimum un chunk entier. Chaque chunk porte en tête ses métadonnées : Partie, numéro et titre de section, diplômes et articles cités, sceau de vérification.
   - Recherche : commence par une **recherche hybride** (lexicale + sémantique). Le guide Anthropic conseille de commencer par la recherche la plus simple qui marche et de ne complexifier que si l'évaluation le justifie. La recherche lexicale est ici importante : les requêtes juridiques contiennent des identifiants exacts (« artigo 1430.º », « DL 268/94 ») qu'une recherche purement sémantique gère mal.

**3. Les outils.** Principe Anthropic : peu d'outils, chacun à but clair et distinct ; pas d'outils qui se chevauchent. Pour cet agent, l'ensemble minimal est :
   - `kb_search` — recherche dans la base de connaissance. Entrée : une requête en langage naturel ET/OU des identifiants juridiques exacts. Sortie : les chunks pertinents avec leurs métadonnées (section, articles, sceau). 
   - `kb_get_section` — récupère une section entière par son identifiant (ex. « I.5.3 »), pour quand Max a besoin du contexte complet autour d'un chunk.
   
   N'ajoute pas d'autres outils sans qu'une évaluation montre leur utilité. Respecte les règles Anthropic d'écriture des outils : noms sans ambiguïté ; descriptions rédigées « comme pour un nouvel arrivant dans l'équipe » ; namespacing par préfixe `kb_` ; réponses sobres et économes en tokens (renvoyer le contenu et les métadonnées utiles, pas d'identifiants techniques cryptiques) ; messages d'erreur actionnables, pas des codes opaques. Limite la taille des réponses d'outil (pagination ou troncature avec instruction de raffiner la recherche).

**4. Les garde-fous (guardrails).** 
   - *Citation* : c'est le défaut le plus grave observé en test (Max fabriquait des citations étiquetées « vérifié »). Le prompt système v1.1 cadre déjà le comportement. Côté code, ajoute une vérification : toute portion de réponse présentée entre guillemets comme citation littérale doit correspondre à une sous-chaîne réellement présente dans un chunk récupéré. Si la correspondance échoue, la réponse est renvoyée à l'agent pour reformulation (paraphrase sans guillemets) — elle n'est pas affichée telle quelle.
   - *Pas d'auto-certification* : le système ne doit jamais afficher de bandeau « citation vérifiée » ou de sceau généré par l'agent. Les sceaux appartiennent au fichier de connaissance. Si l'interface affiche actuellement un tel bandeau, signale-le dans l'AUDIT.md comme à retirer.
   - *Human-in-the-loop* : Max prépare, le juriste décide. Max n'émet pas de verdict de conformité, ne déclenche aucune action irréversible. Il n'a aucun outil d'écriture, d'envoi ou de suppression — uniquement les deux outils de lecture ci-dessus.

**5. L'observabilité.** Sans mesure, pas d'amélioration. Journalise pour chaque requête : la question, les chunks récupérés (identifiants), les appels d'outils, la réponse, la latence, le nombre de tokens. Ces journaux alimentent les évaluations et leur affinage.

### LA SUITE D'ÉVALUATIONS — tâche centrale, pas accessoire

C'est ici que se mesure la « performance ». Construis une suite d'évaluations dans `/docs/agent-max/evals/`.

Principes Anthropic à appliquer :
- Les tâches d'évaluation doivent être **ancrées dans des usages réels** et réalistes — pas un « bac à sable » superficiel. Inspire-toi du travail réel d'un juriste de cabinet de condomínios.
- Chaque tâche est un couple (question, résultat vérifiable attendu). Le vérificateur peut être une comparaison de chaîne, ou un jugement par LLM — mais évite les vérificateurs trop stricts qui rejettent une bonne réponse pour une virgule.
- Mesure, au-delà du taux de réussite : nombre d'appels d'outils, tokens consommés, latence, erreurs d'outil.
- Garde un **jeu de test tenu à l'écart** (held-out) pour ne pas suroptimiser sur le jeu d'entraînement.

La suite **doit obligatoirement inclure** des cas reproduisant les quatre défauts déjà observés sur Max — ce sont des tests de non-régression :
1. *Comparaison numérique* — une question où une valeur du cas doit être comparée à un seuil légal (un délai, une majorité, une percentagem). Vérifie que Max identifie si le seuil est un plancher ou un plafond, fait la comparaison, et ne rend pas de verdict de conformité à la place du juriste.
2. *Contrôle de périmètre* — une question hors périmètre (droit du travail, fiscalité…). Vérifie que Max refuse proprement et ne fabrique pas de procédure.
3. *Sujet couvert refusé à tort* — une question sur un sujet réellement présent dans la base (ex. ascenseurs, bruit, protection des données). Vérifie que Max le traite à partir de la base et ne répond pas « non couvert ».
4. *Citation* — vérifie qu'aucune citation entre guillemets ne contient un texte absent des chunks récupérés.

Ajoute au-delà de ces quatre des tâches couvrant le cœur du fichier : recouvrement de quotes-parts (Partie F), impugnação de deliberações (jurisprudence Partie G), répartition des charges, personnalité judiciaire du condomínio, etc.

### MÉTHODE DE TRAVAIL — itérative et pilotée par les évaluations

1. Étape 0 : AUDIT.md, puis point de contrôle.
2. Implémente l'indexation/chunking, puis les deux outils, puis le câblage du prompt système, puis les garde-fous, puis l'observabilité.
3. Construis la suite d'évaluations.
4. Lance les évaluations. Lis les traces — y compris le raisonnement de l'agent et les transcriptions brutes. Le guide Anthropic insiste : ce que l'agent *omet* est souvent plus parlant que ce qu'il dit.
5. Améliore à partir des échecs : descriptions d'outils, paramètres de chunking, structuration du prompt. **Sans jamais modifier le contenu juridique.**
6. Réitère jusqu'à ce que la suite passe à un taux stable, jeu held-out compris.
7. N'ajoute de complexité (nouvel outil, recherche sémantique avancée, sous-agent) que si une évaluation prouve un gain mesurable. Sinon, t'en abstenir est la bonne décision.

### CE QUE TU NE DOIS PAS FAIRE

- Ne modifie aucun contenu juridique ni aucun sceau de vérification.
- Ne construis pas d'architecture multi-agent ni d'orchestration complexe.
- N'ajoute pas d'outils au-delà des deux outils de lecture sans preuve par évaluation.
- Ne donne à Max aucun outil d'écriture, d'envoi, de suppression ou d'action externe.
- N'affirme jamais que l'agent est « performant » ou « prêt » sans chiffres d'évaluation.
- Supprime les deux anciens fichiers de prompt périmés (`prompt-claude-code-chantier-max.md`, `prompt-claude-code-extraction-legislacao.md`).

### LIVRABLES ATTENDUS

1. `/docs/agent-max/AUDIT.md` — l'état des lieux initial.
2. Le code de l'indexation, des deux outils, des garde-fous, de l'observabilité.
3. `/docs/agent-max/evals/` — la suite d'évaluations, jeu held-out inclus.
4. `/docs/agent-max/RAPPORT.md` — résultats d'évaluation chiffrés ; échecs résiduels documentés ; section « À soumettre à un juriste » pour tout doute juridique repéré (sans correction) ; liste explicite de ce que tu n'as pas fait et pourquoi.
5. Les deux anciens prompts périmés supprimés du dépôt.

Commence par l'Étape 0. Produis l'AUDIT.md et arrête-toi pour validation avant d'implémenter.

═══════════════════════════════════════════════════════════════════
## FIN DU PROMPT
═══════════════════════════════════════════════════════════════════

---

## NOTE FINALE POUR L'OPÉRATEUR HUMAIN

Ce prompt demande délibérément à Claude Code de s'arrêter après l'AUDIT.md. C'est un point de contrôle : tu valides l'état des lieux avant qu'il implémente. C'est conforme au principe Anthropic du human-in-the-loop, et ça t'évite de découvrir un malentendu d'architecture à la fin.

Ce que ce prompt **ne** règle **pas**, et qui reste de ton ressort :
- La base de connaissance reste un **fichier statique**. Ce prompt rend Max capable de bien l'exploiter ; il ne rend pas le fichier auto-actualisé. Pour ça, c'est la voie décrite dans `nota-tecnica-integracao-dre-plataforma.md` (données ELI du DRE).
- Deux réserves de sceau subsistent dans le fichier de connaissance : la grille SCIE (`◆ ANEPC`) et la Portaria 128/2026/1 (`◆ por confirmar`). Elles ne se règlent pas côté code.
- La **validation par un juriste portugais** avant la mise en production reste indispensable. Aucun travail d'ingénierie ne la remplace.
