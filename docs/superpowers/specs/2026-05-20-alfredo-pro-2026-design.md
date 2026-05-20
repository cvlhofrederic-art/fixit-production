# Alfredo Pro 2026 — Spec maître

**Date :** 2026-05-20
**Auteur :** Claude (worktree serene-brahmagupta-7f45a9, brainstorming + audit câblage)
**Statut :** Design validé, prêt pour plans d'implémentation
**Branche worktree :** `claude/serene-brahmagupta-7f45a9`
**Spec amont :** [2026-05-11-agents-ia-syndic-category-design.md](2026-05-11-agents-ia-syndic-category-design.md)

---

## 1. Objectif

Finir le câblage d'Alfredo (agent IA Syndic emails) jusqu'à la qualité production "pro 2026" : refonte de l'état vide pour matcher le pattern Léa, complétion des chaînes back-end laissées orphelines (envoi Gmail, webhook Pub/Sub, learning loop), durcissement sécurité OAuth, et instrumentation observabilité complète.

À l'issue : un syndic connecte sa boîte Gmail, voit ses brouillons générés en temps réel (latence < 60 s post-arrivée mail), valide/édite/envoie sans copier-coller, et chaque édition nourrit le corpus de fine-tune.

## 2. Périmètre

**Inclus :**
- Refonte UI : état vide Léa-style + état chargé SOTA (Superhuman/Shortwave-inspired) + mobile responsive
- Rename sidebar "Emails Fixy" → "Alfredo" (cohérence avec le code et avec Léa/Max/Fixy)
- Câblage envoi Gmail réel depuis UI Alfredo Inbox
- Webhook Pub/Sub fonctionnel (incluant `gmail.users.watch()` côté Google)
- Learning loop opérationnelle (INSERT `syndic_alfredo_learning` à chaque édition utilisateur)
- Sécurité : drop colonnes plain text tokens après backfill vérifié, audit RLS Realtime
- Observabilité : Langfuse `traceAgent` sur poll + send-response, Sentry `agent_type='alfredo'` partout

**Exclus (hors scope explicite) :**
- Autres agents syndic (Fixy, Max, Léa) — pas de modifs en dehors du rename "Emails Fixy"
- Reste du scope dormant syndic (Copro, Conciergerie, Gestionnaire) — strictement intouché
- Locales autres que FR/PT (cf. CLAUDE.md)
- Fine-tune effectif du modèle Llama (Plan E futur — on capture le corpus uniquement)

## 3. Découvertes de l'audit câblage

L'audit en lecture seule du worktree a établi l'état RÉEL (vs ce que la cartographie initiale annonçait) :

| Point | Code existe ? | Wiré end-to-end ? | Ce qui manque |
|---|---|---|---|
| 1. Envoi Gmail (`/api/email-agent/send-response`) | ✅ 225 lignes, `messages.send` ligne 178 | ❌ UI Alfredo Inbox ne l'appelle pas (comment ligne 33 `AlfredoInboxView.tsx`) | Le `handleSend()` doit POST `/api/email-agent/send-response` après le PATCH draft_status='sent' |
| 2. Webhook Pub/Sub (`/api/email-agent/webhook`) | ✅ 76 lignes, valide token + déclenche poll | ❌ Aucun appel à `gmail.users.watch()`, pas de topic Pub/Sub configuré, Google n'envoie rien | Endpoint `POST /api/email-agent/setup-watch` + config GCP Pub/Sub + secret `GMAIL_WEBHOOK_SECRET` + cron renouvellement watch (expire à 7j) |
| 3. Learning loop (`syndic_alfredo_learning`) | ✅ Table + RLS + index | ❌ Zéro INSERT dans le code applicatif | `lib/syndic/alfredo-learning.ts` (diff scoring) + appel dans flux `edited_sent` |
| 4. Sécurité tokens (`syndic_oauth_tokens`) | ✅ RPC chiffré AES-256 (`lib/oauth/tokens.ts`) | 🟡 Dual-write : `access_token`/`refresh_token` plain text **toujours présents** | Migration `DROP COLUMN` après backfill RPC vérifié + audit RLS Realtime pour `syndic_emails_analysed` |
| 5. UI Design | ✅ Pages + composants fonctionnels (`AlfredoAgentPage` 66 l, `AlfredoInboxView` 125 l, `AlfredoDraftEditor` 97 l) | 🟡 Manque état vide accueillant + mascotte + prompts suggérés + statut connexion | Composants `AlfredoEmptyState`, `AlfredoMascot`, `AlfredoStatusBadge`, `AlfredoSuggestedPrompts` + rename sidebar |
| 6. Tests | 🟡 Migration + chat module load + E2E chat OK | ❌ Zéro test Inbox/send, webhook todos vides | Suite Vitest unitaires + Playwright E2E inbox→send |
| 7. Observabilité | 🟡 Langfuse uniquement dans `/api/syndic/alfredo-chat` | ❌ Pas de trace sur poll/send-response/webhook, pas de Sentry tag | `traceAgent` partout + `Sentry.setTag('agent_type', 'alfredo')` global |

**Effort total estimé après audit** : 18–22 h de dev + 6–8 h de tests/observabilité = **~30 h** (vs 40 h estimés en cartographie initiale, qui sous-estimait le code déjà écrit).

## 4. Décisions design verrouillées

1. **Naming UI** : `Alfredo` partout (sidebar, header, mascot). Renommer label "Emails Fixy" dans la sidebar syndic.
2. **Layout** : empty state Léa-style + loaded state SOTA 3-zones + mobile stack responsive.
3. **Ordre d'exécution** : 5 → 1 → 4 → 2 → 3 (Design → Send → Sécurité → Webhook → Learning). Le design first permet validation visuelle rapide ; la sécurité avant l'ouverture aux vrais utilisateurs ; le webhook après le drop des colonnes plain (changement de chemin DB sensible).
4. **Méthode "pro 2026"** :
   - TDD strict (test rouge → code vert → refacto) pour toute modif lib/api
   - Une branche `feature/alfredo-lotN-<topic>` par lot, PR vers `main`, ultrareview avant merge
   - Migrations Supabase via branch DB Supabase (jamais `apply_migration` direct prod)
   - Langfuse `traceAgent()` instrumenté avant merge sur toute route IA touchée
   - Sentry `setTag('agent_type', 'alfredo')` au début de chaque handler
   - Commits préfixés `feat(syndic-alfredo)` / `fix(syndic-alfredo)` / `ai(alfredo)`

## 5. Architecture par lot

### Lot 5 — Refonte UI (PREMIER)

**Files créés :**
- `components/syndic-dashboard/agents-ia/alfredo/AlfredoEmptyState.tsx` — état vide Léa-style (mascotte + statut + paragraphe + prompts + CTA)
- `components/syndic-dashboard/agents-ia/alfredo/AlfredoMascot.tsx` — avatar/illustration robot
- `components/syndic-dashboard/agents-ia/alfredo/AlfredoStatusBadge.tsx` — badge "Boîte connectée — X emails analysés / X brouillons" ou "Boîte non connectée"
- `components/syndic-dashboard/agents-ia/alfredo/AlfredoSuggestedPrompts.tsx` — grille 8 chips de prompts d'amorçage
- `components/syndic-dashboard/agents-ia/alfredo/AlfredoChatSidebar.tsx` — sidebar droite collapsible avec chat conversationnel
- `components/syndic-dashboard/agents-ia/alfredo/AlfredoLoadedView.tsx` — layout 3 zones (drafts list / editor / chat sidebar) + mobile stack

**Files modifiés :**
- `components/syndic-dashboard/agents-ia/pages/AlfredoAgentPage.tsx` — branche empty vs loaded selon `connected && draftsCount`
- `components/syndic-dashboard/agents-ia/AlfredoInboxView.tsx` — devient le sous-composant "vue centrale" de `AlfredoLoadedView`, perte du wrapper plein écran
- `components/syndic-dashboard/agents-ia/configs.ts` — vérifier label `displayName.fr = 'Alfredo'` (et pas "Emails Fixy")
- Le fichier qui rend le label sidebar (`SidebarCategories.tsx` ou équivalent — à localiser) — vérifier que le label affiché est bien `Alfredo`

**Prompts suggérés (chips, 8 items)** :
- FR : "Résume mes emails du jour" · "Quels emails sont urgents ?" · "Brouillon pour le sinistre du lot X" · "Cherche les emails de Mme Y" · "Archive tous les spams" · "Quels emails attendent réponse ?" · "Rédige une relance amiable" · "Combien d'emails à traiter ?"
- PT : équivalents traduits

**Status badge logique** :
- Boîte non connectée → `🔴 Boîte non connectée`
- Connectée + 0 draft → `🟢 Boîte connectée · 0 email en attente`
- Connectée + N drafts → `🟡 N brouillons à valider · X emails analysés`

**Branche** : `feature/alfredo-lot5-design`

**Tests** :
- Vitest snapshots : `AlfredoEmptyState`, `AlfredoLoadedView` (3 zones)
- Playwright E2E `e2e/syndic-alfredo-ui.spec.ts` : ouvre page, vérifie empty state quand non connecté, vérifie loaded state quand drafts présents

### Lot 1 — Envoi Gmail réel

**Comportement attendu** : quand l'utilisateur clique "Envoyer" dans `AlfredoDraftEditor`, le brouillon est réellement envoyé via Gmail API. Si l'utilisateur a édité le brouillon avant envoi, on capture la diff pour le learning loop (Lot 3 ; pour le moment on stocke la diff même si l'INSERT learning est ajouté en Lot 3).

**Files modifiés :**
- `components/syndic-dashboard/agents-ia/hooks/useAlfredoDrafts.ts` — `updateDraft(id, { draft_status: 'sent' | 'edited_sent' })` doit aussi POST `/api/email-agent/send-response` après le PATCH réussi
- `app/api/email-agent/drafts/[id]/route.ts` — option B (recommandée) : PATCH route déclenche elle-même l'envoi server-side si `draft_status='sent'|'edited_sent'`, pour ne pas dépendre du client. Si serveur déclenche : retourne 200 quand mail envoyé, 5xx si Gmail API a échoué (rollback `draft_status` en `pending_review` + Sentry capture)
- `app/api/email-agent/send-response/route.ts` — ajouter `traceAgent` Langfuse + `Sentry.setTag('agent_type', 'alfredo')` + RBAC check explicite (le syndic appelant doit posséder l'email_id)

**Décision arch** : option B (serveur déclenche, transactionnel). Évite que le client doive faire 2 appels et garantit atomicité.

**Branche** : `feature/alfredo-lot1-send`

**Tests** :
- `tests/api/email-agent-send-response.test.ts` : mock Gmail API, vérifie payload RFC 2822, vérifie rollback si Gmail répond 4xx/5xx
- `tests/api/email-agent-drafts-patch-sent.test.ts` : vérifie qu'un PATCH `draft_status='sent'` déclenche bien `send-response` côté serveur
- E2E `e2e/syndic-alfredo-send.spec.ts` : flow complet inbox → édit → envoi → vérification que `statut='repondu'` en DB

### Lot 4 — Sécurité tokens + RLS Realtime

**Files créés :**
- `supabase/migrations/<date>_drop_oauth_plain_tokens.sql` — DROP COLUMN access_token, refresh_token sur `syndic_oauth_tokens` après backfill RPC vérifié
- `supabase/migrations/<date>_realtime_rls_emails_analysed.sql` — policy Realtime sur `syndic_emails_analysed` pour que `useAlfredoNotifications` fonctionne

**Files modifiés :**
- `lib/oauth/tokens.ts` — suppression du fallback plain text (retourne erreur si RPC échoue plutôt que de dual-write)
- `app/api/email-agent/poll/route.ts` — uniquement `getDecryptedToken()`, plus de `.select('access_token, refresh_token')` direct
- `app/api/email-agent/send-response/route.ts` — idem
- `components/syndic-dashboard/agents-ia/hooks/useAlfredoNotifications.ts` — vérifier que la subscription Realtime ne plante pas (smoke test post-migration RLS)

**Procédure de bascule** (critique, à valider en branche Supabase avant prod) :
1. Vérifier que TOUTES les lignes `syndic_oauth_tokens` ont des `access_token_encrypted` / `refresh_token_encrypted` non-NULL
2. Tester `getDecryptedToken()` sur 100% des lignes (script de validation)
3. Si OK : `ALTER TABLE syndic_oauth_tokens DROP COLUMN access_token, DROP COLUMN refresh_token`
4. Si pas OK : backfill manuel via RPC `set_encrypted_oauth_token` pour les lignes manquantes, puis re-tester

**Audit RBAC** : revoir matrice `lib/syndic/alfredo-data-access-policy.ts` vs sources réellement chargées dans `alfredo-load-client-context.ts`. Documenter dans la PR.

**Branche** : `feature/alfredo-lot4-security`

**Tests** :
- `tests/lib/oauth-tokens-no-plain.test.ts` : mock RPC, vérifier que `setEncryptedToken` ne write plus rien dans `access_token`/`refresh_token`
- `tests/migrations/drop-oauth-plain-tokens.test.ts` : vérifier que les colonnes sont absentes après migration
- E2E sécu : tenter un poll après bascule, doit fonctionner sans dépendre des colonnes plain

### Lot 2 — Webhook Pub/Sub

**Comportement attendu** : Gmail Push Notifications via Cloud Pub/Sub → `/api/email-agent/webhook` → trigger poll ciblé sur le syndic concerné. Latence email reçu → brouillon prêt < 60 s.

**Files créés :**
- `app/api/email-agent/setup-watch/route.ts` — POST endpoint qui appelle `gmail.users.watch({ topicName, labelIds, labelFilterAction })` pour un syndic donné (créé à la connexion Gmail + renouvelé via cron)
- `app/api/email-agent/renew-watches/route.ts` — endpoint cron quotidien qui renouvelle tous les watches expirant dans < 24 h (watch Gmail expire à 7j max)
- `supabase/migrations/<date>_syndic_gmail_watches.sql` — table `syndic_gmail_watches(syndic_id, history_id, expiration, topic, created_at, updated_at)` pour suivre l'état du watch

**Files modifiés :**
- `app/api/email-agent/callback/route.ts` — après stockage du token initial, POST automatique vers `/api/email-agent/setup-watch`
- `app/api/email-agent/webhook/route.ts` — ajouter `traceAgent` Langfuse + Sentry tags + update du `history_id` dans `syndic_gmail_watches`
- `wrangler.toml` — ajouter cron pour `/api/email-agent/renew-watches` (daily 6 AM UTC)
- `app/api/email-agent/poll/route.ts` — accepter `history_id` en input (poll incrémental via `users.history.list` au lieu de `users.messages.list` full)

**Config GCP requise** (documenter dans runbook) :
- Créer topic Pub/Sub `gmail-alfredo-push` dans projet GCP
- Subscription push vers `https://vitfix.io/api/email-agent/webhook`
- Service account avec rôle `roles/pubsub.publisher` sur le topic
- Permission `gmail.googleapis.com` au service account (ou délégation domain-wide)
- `GMAIL_WEBHOOK_SECRET` partagé entre Pub/Sub et notre webhook (header `x-gmail-webhook-token`)

**Feature flag** : `ALFREDO_WEBHOOK_ENABLED` (default `false`). Si false → le polling cron reste actif comme avant. Si true → le polling devient un fallback hebdomadaire (au cas où le webhook manque un event).

**Branche** : `feature/alfredo-lot2-webhook`

**Tests** :
- `tests/api/email-agent-webhook.test.ts` (remplir les `it.todo` actuels) : POST avec/sans token, payload valide/invalide, déclenche poll
- `tests/api/email-agent-setup-watch.test.ts` : mock Gmail API, vérifie payload `users.watch`
- E2E watch lifecycle : pas testable end-to-end sans GCP, on documente le test manuel dans runbook

### Lot 3 — Learning loop

**Files créés :**
- `lib/syndic/alfredo-learning.ts` — `recordCorrection(emailId, proposed, final): Promise<void>`, calcule `diff_score` (Levenshtein normalisé) + extrait `metadata` (delta de tonalité, longueur, structure)

**Files modifiés :**
- `app/api/email-agent/drafts/[id]/route.ts` — quand `draft_status='edited_sent'` ET `draft_body_text` reçu diffère de la version stockée, appeler `recordCorrection()`
- `lib/syndic/alfredo-draft.ts` — option (Plan E préparatoire) : injecter `learning_hints` du syndic dans le prompt si > N corrections historisées. Pour ce lot on se contente de capturer ; l'injection est out-of-scope (sera dans Plan E).

**Branche** : `feature/alfredo-lot3-learning`

**Tests** :
- `tests/lib/alfredo-learning-diff-score.test.ts` : diff_score 0 pour identique, ~0.3 pour léger reformulation, ~0.9 pour réécriture totale
- `tests/api/email-agent-drafts-edited-sent.test.ts` : PATCH avec body différent → INSERT dans `syndic_alfredo_learning`

## 6. Méthodologie pro 2026 (transverse aux 5 lots)

### TDD strict
- Pour chaque feature : commencer par un test rouge (Vitest unitaire ou Playwright E2E selon couche), puis code minimal pour passer vert, puis refacto.
- Aucun merge sans `npm run test` et `npm run test:e2e` au vert (workflow `tests.yml` bloquant).

### Branches & PR
- Une branche `feature/alfredo-lotN-<topic>` par lot, jamais de push direct sur `main`.
- PR ouverte dès le premier test rouge (draft PR), passe en "ready for review" quand tests verts.
- Code review : `/ultrareview` avant merge (multi-agent cloud review).
- Squash merge par défaut.

### Migrations Supabase
- Toute migration testée en branch Supabase (`supabase__create_branch`) avant merge.
- Pas de `apply_migration` direct sur prod (sauf rollback urgent).
- Tester migrations destructives (DROP COLUMN du Lot 4) avec un snapshot DB préalable.

### Observabilité
- `traceAgent('alfredo-<context>', async () => { ... }, { syndic_id, agent_type: 'alfredo' })` enveloppe chaque appel LLM ou Gmail API.
- `Sentry.setTag('agent_type', 'alfredo')` en début de chaque handler route Alfredo.
- Logs structurés via `logger` (jamais `console.log`).

### Commits
- Préfixes : `feat(syndic-alfredo)`, `fix(syndic-alfredo)`, `ai(alfredo)` (pour prompts), `voice(alfredo)` (si voix ajoutée plus tard).
- Pas de `--no-verify` (CLAUDE.md règle dure).

### Scope dormant : réactivation tracée
- Ajouter au début de la PR du Lot 5 : un commit qui met à jour `MEMORY.md` (auto-memory) pour indiquer que le scope syndic Alfredo est réactivé ; le reste du dormant (Copro, Conciergerie, Gestionnaire) reste explicitement dormant.

## 7. Risques & mitigations

| # | Risque | Sévérité | Mitigation |
|---|---|---|---|
| 1 | Réactivation scope dormant → surface attaque accrue | 🔴 | Lot 4 (sécurité) avant Lot 2 (webhook qui expose endpoint public). Aucune route Alfredo n'est exposée à utilisateur final sans auth syndic. |
| 2 | DROP COLUMN access_token/refresh_token sur prod = perte de session | 🔴 | Branche Supabase + script de validation backfill ; rollback prêt (re-CREATE COLUMN + repopulate via RPC). |
| 3 | Webhook Pub/Sub : config GCP complexe, risque d'avoir un webhook qui ne reçoit rien | 🟡 | Feature flag `ALFREDO_WEBHOOK_ENABLED=false` par défaut, polling reste actif. On bascule par syndic ou par cohort. |
| 4 | Refonte UI casse parcours existant (tabs Inbox/Discussion actuels) | 🟡 | Tests Playwright E2E avant refacto, garder l'option de basculer entre vue "loaded" (3 zones) et vue "classique" (tabs) via flag user-side si besoin. |
| 5 | Send Gmail server-side déclenché par PATCH : timeout ou erreur Gmail laisse `draft_status` incohérent | 🟡 | Transactionnel : si Gmail API rejette, rollback `draft_status` vers `pending_review` + Sentry capture + retour 5xx au client. |
| 6 | Watch Gmail expire à 7j, oubli de renouvellement → silence webhook | 🟡 | Cron quotidien `renew-watches` + alerte Sentry si watch expiré non renouvelé. |
| 7 | Learning loop introduit lentement un biais dans les prompts (si réinjection future) | 🟢 | Le lot 3 ne réinjecte pas, capture uniquement. La réinjection (Plan E) sera derrière un flag + revue qualité. |

## 8. Critères de succès

- ✅ Sidebar syndic affiche "Alfredo" (et pas "Emails Fixy")
- ✅ État vide identique au pattern Léa (mascotte + statut + prompts + CTA Gmail)
- ✅ Layout chargé : drafts list + editor + chat sidebar, responsive mobile
- ✅ Clic "Envoyer" sur un brouillon → mail réellement envoyé via Gmail API → vérifiable dans la boîte test
- ✅ Aucune colonne plain text `access_token`/`refresh_token` dans `syndic_oauth_tokens` (vérifiable via `\d` Postgres)
- ✅ Mail reçu sur boîte test → brouillon dans Alfredo en < 60 s (via webhook, mesuré sur 10 envois successifs)
- ✅ Édition d'un brouillon avant envoi → ligne dans `syndic_alfredo_learning` avec `diff_score` cohérent
- ✅ Langfuse dashboard montre traces pour poll + send-response + webhook + alfredo-chat (100% couverture)
- ✅ Sentry : tous les events Alfredo taggés `agent_type='alfredo'`
- ✅ Coverage tests `lib/syndic/alfredo-*` ≥ 80 %
- ✅ Playwright E2E : 3 specs nouveaux/enrichis passent en CI (`alfredo-ui`, `alfredo-send`, `agents-ia` enrichi)

## 9. Plans d'exécution

Cinq plans séquentiels seront créés par la skill `superpowers:writing-plans`, dans l'ordre 5 → 1 → 4 → 2 → 3. Chaque plan a sa propre branche, ses tests, son PR et son merge avant qu'on enchaîne le suivant.

| Ordre | Lot | Branche | Effort estimé |
|---|---|---|---|
| 1 | Lot 5 — Refonte design UI | `feature/alfredo-lot5-design` | 6–8 h |
| 2 | Lot 1 — Envoi Gmail réel | `feature/alfredo-lot1-send` | 3–4 h |
| 3 | Lot 4 — Sécurité tokens + RLS Realtime | `feature/alfredo-lot4-security` | 4–5 h |
| 4 | Lot 2 — Webhook Pub/Sub | `feature/alfredo-lot2-webhook` | 6–8 h (config GCP incluse) |
| 5 | Lot 3 — Learning loop | `feature/alfredo-lot3-learning` | 3–4 h |

**Total** : 22–29 h dev. Premier plan (Lot 5) sera produit immédiatement après validation de ce spec.

## 10. Pré-requis & questions résiduelles

**À confirmer avant Lot 2 (webhook)** :
- Disposes-tu d'un projet GCP utilisable ou faut-il en créer un dédié à Vitfix ?
- Le compte Google d'admin pour la délégation domain-wide est-il disponible ?

**À confirmer avant Lot 4 (drop tokens plain)** :
- OK pour faire la bascule en heures creuses (forcera tous les syndics connectés à re-OAuth si jamais le backfill avait des trous) ?

**Mascotte Alfredo** : on réutilise un visual existant ou on commande une illustration (style robot cohérent avec Léa) ? Pour Lot 5 on peut partir d'un placeholder emoji 📧 + glow, puis remplacer par illustration finale en patch ultérieur.

Ces points peuvent être traités au début du plan correspondant, pas bloquants pour le démarrage du Lot 5.
