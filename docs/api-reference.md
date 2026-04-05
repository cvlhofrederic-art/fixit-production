# Vitfix API Reference

> Auto-generated on 2026-04-05 by `scripts/generate-api-docs.ts`
> 138 routes, 218 endpoints

## Legend

| Icon | Meaning |
|------|---------|
| `AUTH` | Requires authentication (getAuthUser) |
| `RL` | Rate limited |
| `ZOD` | Input validation (Zod schema) |

## Admin

| Method | Endpoint | Description | Guards |
|--------|----------|-------------|--------|
| `POST` | `/api/admin/init-team-table` | — | `AUTH` `ZOD` |
| `GET` | `/api/admin/kyc` | GET /api/admin/kyc — List artisans by KYC status (paginated) | `AUTH` `ZOD` |
| `PATCH` | `/api/admin/kyc` | PATCH /api/admin/kyc — Approve or reject an artisan's KYC | `AUTH` `ZOD` |
| `GET` | `/api/admin/setup` | ⚠️ SÉCURISÉ : nécessite authentification super_admin + vérification email | `AUTH` `RL` `ZOD` |
| `GET` | `/api/admin/stats` | No query params to validate — this route returns aggregate stats with no user input | `AUTH` `RL` |
| `GET` | `/api/admin/subscriptions` | — | `AUTH` `RL` `ZOD` |
| `GET` | `/api/admin/users` | — | `AUTH` `RL` `ZOD` |

## Agents IA

| Method | Endpoint | Description | Guards |
|--------|----------|-------------|--------|
| `POST` | `/api/comptable-ai` | — | `AUTH` `RL` `ZOD` |
| `POST` | `/api/email-agent/action` | Actions : 'archiver' | 'marquer_traite' | 'creer_mission' | 'ajouter_note' | `AUTH` `ZOD` |
| `GET` | `/api/email-agent/callback` | ── Reçoit le code OAuth Google, échange en tokens, stocke dans Supabase ───── | `ZOD` |
| `POST` | `/api/email-agent/classify` | — | `AUTH` `RL` `ZOD` |
| `GET` | `/api/email-agent/connect` | ── Initie le flux OAuth2 Gmail ────────────────────────────────────────────── | `ZOD` |
| `POST` | `/api/email-agent/ocr` | — | `AUTH` `RL` `ZOD` |
| `GET` | `/api/email-agent/poll` | ── GET : récupérer les emails analysés d'un syndic (authentifié) ──────────── | `AUTH` `ZOD` |
| `POST` | `/api/email-agent/poll` | ── Route principale : appelée par Vercel Cron ou manuellement ──────────────── | `AUTH` `ZOD` |
| `POST` | `/api/email-agent/send-response` | POST /api/email-agent/send-response — envoyer une réponse validée via Gmail API | `AUTH` `RL` `ZOD` |
| `POST` | `/api/fixy-ai` | ── Main POST handler ─────────────────────────────────────────────────────── | `AUTH` `RL` `ZOD` |
| `PUT` | `/api/fixy-ai` | Using GET with query params for simplicity (called from client) | `AUTH` `RL` `ZOD` |
| `POST` | `/api/fixy-chat` | — | `AUTH` `RL` `ZOD` |
| `POST` | `/api/materiaux-ai` | ─── POST Handler ───────────────────────────────────────────────────────────── | `AUTH` |

## Artisan

| Method | Endpoint | Description | Guards |
|--------|----------|-------------|--------|
| `GET` | `/api/artisan-absences` | Fetch absences for an artisan (public — needed for client booking availability check) | `AUTH` `RL` `ZOD` |
| `POST` | `/api/artisan-absences` | ⚠️ SÉCURISÉ : auth obligatoire + vérification ownership artisan | `AUTH` `RL` `ZOD` |
| `DELETE` | `/api/artisan-absences` | ⚠️ SÉCURISÉ : auth obligatoire + vérification ownership via absence row → artisan → user_id | `AUTH` `RL` `ZOD` |
| `GET` | `/api/artisan-clients` | → Returns all clients for an artisan (unique client_ids from bookings) | `AUTH` `RL` |
| `GET` | `/api/artisan-company` | Used by DevisFactureForm to auto-fill and lock legal fields | `AUTH` `RL` |
| `GET` | `/api/artisan-marches-prefs` | GET /api/artisan-marches-prefs — retourne les préférences marchés de l'artisan | `AUTH` `RL` `ZOD` |
| `POST` | `/api/artisan-marches-prefs` | POST /api/artisan-marches-prefs — mettre à jour les préférences marchés | `AUTH` `RL` `ZOD` |
| `GET` | `/api/artisan-payment-info` | Récupérer les infos paiement de l'artisan | `AUTH` `RL` `ZOD` |
| `POST` | `/api/artisan-payment-info` | Sauvegarder les infos paiement | `AUTH` `RL` `ZOD` |
| `GET` | `/api/artisan-photos` | — | `AUTH` `RL` `ZOD` |
| `POST` | `/api/artisan-photos` | — | `AUTH` `RL` `ZOD` |
| `PATCH` | `/api/artisan-photos` | — | `AUTH` `RL` `ZOD` |
| `DELETE` | `/api/artisan-photos` | — | `AUTH` `RL` `ZOD` |
| `POST` | `/api/artisan-settings` | — | `AUTH` `RL` `ZOD` |
| `GET` | `/api/artisans-catalogue` | — |  |
| `GET` | `/api/artisans/nearby` | GET /api/artisans/nearby?lat=48.85&lng=2.35&radius=30&country=FR&category=plomberie | `RL` |
| `GET` | `/api/pro/channel` | GET /api/pro/channel?contact_id=xxx | `AUTH` `RL` `ZOD` |
| `POST` | `/api/pro/channel` | POST /api/pro/channel | `AUTH` `RL` `ZOD` |
| `GET` | `/api/pro/messagerie` | ═══ GET — Liste des conversations ou messages d'une conversation ═══ | `AUTH` `ZOD` |
| `POST` | `/api/pro/messagerie` | ═══ POST — Envoyer un message ou créer une conversation ═══ | `AUTH` `ZOD` |
| `PATCH` | `/api/pro/messagerie` | ═══ PATCH — Mettre à jour un ordre de mission (accepter/refuser) ═══ | `AUTH` `ZOD` |

## Authentification

| Method | Endpoint | Description | Guards |
|--------|----------|-------------|--------|
| `POST` | `/api/auth/log-attempt` | Appelé côté client après signInWithPassword | `RL` `ZOD` |
| `POST` | `/api/auth/reset-password` | — | `RL` `ZOD` |
| `POST` | `/api/auth/set-pro-role` | — | `ZOD` |

## Autre

| Method | Endpoint | Description | Guards |
|--------|----------|-------------|--------|
| `GET` | `/api/availability-services` | Fetch dayServices config from artisan's bio marker | `AUTH` |
| `POST` | `/api/availability-services` | Save dayServices config into artisan's bio marker | `AUTH` |
| `GET` | `/api/availability` | Fetch availability for an artisan (public — nécessaire pour la réservation) | `AUTH` `RL` `ZOD` |
| `POST` | `/api/availability` | ⚠️ SÉCURISÉ : auth obligatoire + vérification ownership artisan | `AUTH` `RL` `ZOD` |
| `PUT` | `/api/availability` | ⚠️ SÉCURISÉ : auth obligatoire + vérification ownership via availability row | `AUTH` `RL` `ZOD` |
| `GET` | `/api/btp` | Query params: ?table=chantiers|membres|equipes|pointages|depenses|settings|all | `AUTH` `RL` `ZOD` |
| `POST` | `/api/btp` | Body: { table: string, action: 'insert'|'update'|'delete'|'upsert_settings'|'import', data: unknown (varies per table), id?: string } | `AUTH` `RL` `ZOD` |
| `GET` | `/api/companies/search` | — |  |
| `POST` | `/api/dce-analyse` | ── POST handler ───────────────────────────────────────────────────────────── | `AUTH` `RL` |
| `GET` | `/api/debug/conversations` | Exposait les conversations complètes, remplacé par 404 permanent. |  |
| `GET` | `/api/declaration-sociale` | Charger les données de déclaration | `RL` `ZOD` |
| `POST` | `/api/declaration-sociale` | Configurer le profil ou marquer comme déclaré | `RL` `ZOD` |
| `POST` | `/api/devis-sign` | — | `AUTH` `RL` `ZOD` |
| `POST` | `/api/doc-number` | Utilise la fonction DB next_doc_number() pour garantir l'atomicité (art. L441-3 C. com.) | `AUTH` `ZOD` |
| `POST` | `/api/facturx/generate` | — | `ZOD` |
| `GET` | `/api/favorites` | GET /api/favorites — liste des artisans favoris du client | `AUTH` `RL` `ZOD` |
| `POST` | `/api/favorites` | POST /api/favorites — ajouter un artisan aux favoris | `AUTH` `RL` `ZOD` |
| `DELETE` | `/api/favorites` | DELETE /api/favorites — retirer un artisan des favoris | `AUTH` `RL` `ZOD` |
| `GET` | `/api/health` | GET /api/health — Health check endpoint pour monitoring |  |
| `POST` | `/api/kyc-orchestrate` | --------------------------------------------------------------------------- | `AUTH` `RL` |
| `GET` | `/api/marketplace-btp/[id]/demande` | — |  |
| `POST` | `/api/marketplace-btp/[id]/demande` | — |  |
| `PATCH` | `/api/marketplace-btp/[id]/demande` | — |  |
| `GET` | `/api/marketplace-btp/[id]` | — |  |
| `PUT` | `/api/marketplace-btp/[id]` | — |  |
| `DELETE` | `/api/marketplace-btp/[id]` | — |  |
| `GET` | `/api/marketplace-btp` | — | `RL` `ZOD` |
| `POST` | `/api/marketplace-btp` | — | `RL` `ZOD` |
| `POST` | `/api/profile/specialties` | — | `ZOD` |
| `POST` | `/api/rapport-ia` | — | `RL` `ZOD` |
| `POST` | `/api/receipt-scan` | — | `AUTH` `RL` |
| `POST` | `/api/referral/click` | — | `RL` `ZOD` |
| `POST` | `/api/referral/generate-code` | — | `AUTH` |
| `GET` | `/api/referral/history` | — | `AUTH` |
| `POST` | `/api/referral/signup` | — | `RL` `ZOD` |
| `GET` | `/api/referral/stats` | — | `AUTH` |
| `GET` | `/api/reviews` | GET /api/reviews?artisan_id=xxx — liste publique des avis d'un artisan | `AUTH` `RL` `ZOD` |
| `POST` | `/api/reviews` | POST /api/reviews — soumettre un avis | `AUTH` `RL` `ZOD` |
| `GET` | `/api/rfq/offer/[token]` | — |  |
| `POST` | `/api/rfq/offer/[token]` | — |  |
| `GET` | `/api/rfq` | — | `ZOD` |
| `POST` | `/api/rfq` | — | `ZOD` |
| `POST` | `/api/save-logo` | — | `AUTH` `ZOD` |
| `POST` | `/api/seed-motifs` | — | `RL` |
| `POST` | `/api/send-kyc-email` | POST /api/send-kyc-email — Internal endpoint (protected by x-internal-secret) | `ZOD` |
| `GET` | `/api/service-etapes` | Lister les étapes d'un service | `ZOD` |
| `POST` | `/api/service-etapes` | Créer une étape ou réordonner | `ZOD` |
| `PATCH` | `/api/service-etapes` | Modifier une étape | `ZOD` |
| `DELETE` | `/api/service-etapes` | Supprimer une étape | `ZOD` |
| `GET` | `/api/setup-storage` | — | `AUTH` |
| `POST` | `/api/setup-storage` | — | `AUTH` |
| `GET` | `/api/simulateur-artisans` | — |  |
| `POST` | `/api/simulateur-travaux` | — | `ZOD` |
| `GET` | `/api/specialties` | — |  |
| `GET` | `/api/stats/resume` | — |  |
| `GET` | `/api/tracking/[token]` | — | `AUTH` |
| `DELETE` | `/api/tracking/[token]` | Suppression propre en fin de session (appelé par l'artisan — auth requise) | `AUTH` |
| `POST` | `/api/tracking/update` | — | `AUTH` `RL` `ZOD` |
| `POST` | `/api/tva/check` | — | `ZOD` |
| `GET` | `/api/tva/settings` | — | `ZOD` |
| `PATCH` | `/api/tva/settings` | — | `ZOD` |
| `POST` | `/api/upload` | — | `AUTH` `RL` |
| `POST` | `/api/verify-id` | — | `RL` `ZOD` |
| `POST` | `/api/verify-kbis` | ─── Handler ────────────────────────────────────────────────────────────────── | `RL` `ZOD` |
| `GET` | `/api/verify-nif` | — | `RL` `ZOD` |
| `GET` | `/api/verify-siret` | — | `RL` `ZOD` |
| `POST` | `/api/wallet-scan` | ═══════════════════════════════════════════════════════════════════════════ | `AUTH` `RL` `ZOD` |
| `POST` | `/api/wallet-sync` | Met à jour automatiquement les fiches syndic_artisans liées | `AUTH` `RL` `ZOD` |

## Client

| Method | Endpoint | Description | Guards |
|--------|----------|-------------|--------|
| `POST` | `/api/client/analyse-devis` | — | `AUTH` `RL` |
| `POST` | `/api/client/extract-pdf` | — | `AUTH` `RL` |

## Copropriétaire

| Method | Endpoint | Description | Guards |
|--------|----------|-------------|--------|
| `POST` | `/api/copro-ai` | — | `AUTH` `RL` `ZOD` |
| `GET` | `/api/coproprietaire/signalement` | Requiert email exact (pas de wildcard) + rate limiting | `RL` `ZOD` |
| `POST` | `/api/coproprietaire/signalement` | Rate-limité pour éviter le spam (pas d'auth car copropriétaires non-inscrits) | `RL` `ZOD` |

## Cron & Sync

| Method | Endpoint | Description | Guards |
|--------|----------|-------------|--------|
| `GET` | `/api/cron/booking-reminder` | — |  |
| `GET` | `/api/cron/devis-reminder` | — |  |
| `GET` | `/api/cron/referral` | 60 secondes max |  |
| `GET` | `/api/cron/scan-marches` | — |  |
| `GET` | `/api/sync/base-gov-pt` | Vercel cron sends GET — delegate to POST handler |  |
| `POST` | `/api/sync/base-gov-pt` | — |  |
| `GET` | `/api/sync/decp-13` | Vercel cron sends GET — delegate to POST handler |  |
| `POST` | `/api/sync/decp-13` | data.economie.gouv.fr/api/explore/v2.1/catalog/datasets/decp_augmente/records' |  |
| `GET` | `/api/sync/mairies-13` | Vercel cron sends GET — delegate to POST handler |  |
| `POST` | `/api/sync/mairies-13` | — |  |
| `GET` | `/api/sync/obras-porto` | Vercel cron sends GET — delegate to POST handler |  |
| `POST` | `/api/sync/obras-porto` | opendata.cm-porto.pt' |  |
| `GET` | `/api/sync/sitadel-13` | Vercel cron sends GET — delegate to POST handler |  |
| `POST` | `/api/sync/sitadel-13` | — |  |
| `GET` | `/api/sync/ted-porto` | Vercel cron sends GET — delegate to POST handler |  |
| `POST` | `/api/sync/ted-porto` | ted.europa.eu/api/v3.0/notices/search' |  |
| `GET` | `/api/tenders/scan` | Vercel cron sends GET — same auth logic | `AUTH` |
| `POST` | `/api/tenders/scan` | — | `AUTH` |
| `GET` | `/api/tenders/search` | — | `RL` |

## Marketplace

| Method | Endpoint | Description | Guards |
|--------|----------|-------------|--------|
| `PATCH` | `/api/marches/[id]/candidature/[cid]` | ── PATCH /api/marches/[id]/candidature/[cid] — Accept or reject a bid ────── | `AUTH` `RL` `ZOD` |
| `GET` | `/api/marches/[id]/candidature` | GET /api/marches/[id]/candidature — lister les candidatures | `AUTH` `RL` `ZOD` |
| `POST` | `/api/marches/[id]/candidature` | POST /api/marches/[id]/candidature — soumettre une candidature (artisan pro uniquement) | `AUTH` `RL` `ZOD` |
| `GET` | `/api/marches/[id]/evaluation` | GET /api/marches/[id]/evaluation — lister les evaluations d'un marche | `AUTH` `RL` `ZOD` |
| `POST` | `/api/marches/[id]/evaluation` | POST /api/marches/[id]/evaluation — soumettre une evaluation | `AUTH` `RL` `ZOD` |
| `GET` | `/api/marches/[id]/messages` | GET /api/marches/[id]/messages — lister les messages d'un marche | `AUTH` `RL` `ZOD` |
| `POST` | `/api/marches/[id]/messages` | POST /api/marches/[id]/messages — envoyer un message | `AUTH` `RL` `ZOD` |
| `GET` | `/api/marches/[id]` | GET /api/marches/[id] — détail d'un appel d'offres | `AUTH` `RL` `ZOD` |
| `PATCH` | `/api/marches/[id]` | PATCH /api/marches/[id] — modifier le statut (publisher uniquement) | `AUTH` `RL` `ZOD` |
| `GET` | `/api/marches` | GET /api/marches — liste publique des appels d'offres ouverts | `RL` `ZOD` |
| `POST` | `/api/marches` | POST /api/marches — créer un appel d'offres (public, pas d'auth requise) | `RL` `ZOD` |
| `POST` | `/api/marches/scan` | Retourne les marchés scannés, scorés et filtrés | `AUTH` `RL` |
| `GET` | `/api/marches/sous-traitance` | ?mode=browse         → toutes les offres ouvertes (pour artisans) | `AUTH` `RL` `ZOD` |
| `POST` | `/api/marches/sous-traitance` | ── POST /api/marches/sous-traitance — BTP company publishes an offer ──────── | `AUTH` `RL` `ZOD` |

## Paiements (Stripe)

| Method | Endpoint | Description | Guards |
|--------|----------|-------------|--------|
| `POST` | `/api/stripe/checkout` | — | `AUTH` `RL` `ZOD` |
| `POST` | `/api/stripe/portal` | — | `AUTH` |
| `GET` | `/api/stripe/subscription` | — | `AUTH` `ZOD` |
| `POST` | `/api/stripe/subscription` | — | `AUTH` `ZOD` |
| `POST` | `/api/stripe/webhook` | — |  |

## Portugal Fiscal

| Method | Endpoint | Description | Guards |
|--------|----------|-------------|--------|
| `POST` | `/api/portugal-fiscal/register-document` | — | `AUTH` `RL` `ZOD` |
| `GET` | `/api/portugal-fiscal/saft-export` | — | `AUTH` |
| `GET` | `/api/portugal-fiscal/series` | GET /api/portugal-fiscal/series — List artisan's document series | `AUTH` `ZOD` |
| `POST` | `/api/portugal-fiscal/series` | POST /api/portugal-fiscal/series — Create or update a series | `AUTH` `ZOD` |

## Réservations

| Method | Endpoint | Description | Guards |
|--------|----------|-------------|--------|
| `GET` | `/api/booking-detail` | Fetch a single booking by ID | `AUTH` `RL` |
| `GET` | `/api/booking-messages` | Fetch messages for a booking | `AUTH` `RL` `ZOD` |
| `POST` | `/api/booking-messages` | Send a message | `AUTH` `RL` `ZOD` |
| `GET` | `/api/bookings` | Fetch future bookings for an artisan (public — only slot data, no personal info) | `AUTH` `RL` `ZOD` |
| `POST` | `/api/bookings` | Create a new booking | `AUTH` `RL` `ZOD` |

## Syndic

| Method | Endpoint | Description | Guards |
|--------|----------|-------------|--------|
| `POST` | `/api/syndic/analyse-devis` | — | `AUTH` `RL` |
| `GET` | `/api/syndic/artisans` | ── GET /api/syndic/artisans — Lister les artisans liés au cabinet ──────────── | `AUTH` `RL` `ZOD` |
| `POST` | `/api/syndic/artisans` | ── POST /api/syndic/artisans — Ajouter un artisan (existant ou nouveau) ────── | `AUTH` `RL` `ZOD` |
| `PATCH` | `/api/syndic/artisans` | ── PATCH /api/syndic/artisans — Modifier un artisan ───────────────────────── | `AUTH` `RL` `ZOD` |
| `DELETE` | `/api/syndic/artisans` | ── DELETE /api/syndic/artisans — Retirer un artisan du cabinet ─────────────── | `AUTH` `RL` `ZOD` |
| `GET` | `/api/syndic/artisans/search` | ── GET /api/syndic/artisans/search?email=xxx ───────────────────────────────── | `AUTH` `RL` |
| `GET` | `/api/syndic/assemblees` | ══════════════════════════════════════════════════════════════════════════════ | `AUTH` `RL` `ZOD` |
| `POST` | `/api/syndic/assemblees` | ══════════════════════════════════════════════════════════════════════════════ | `AUTH` `RL` `ZOD` |
| `PATCH` | `/api/syndic/assemblees` | ══════════════════════════════════════════════════════════════════════════════ | `AUTH` `RL` `ZOD` |
| `DELETE` | `/api/syndic/assemblees` | ══════════════════════════════════════════════════════════════════════════════ | `AUTH` `RL` `ZOD` |
| `POST` | `/api/syndic/assign-mission` | Résolution multi-stratégie : user_id → email → nom (tolérant accents) | `AUTH` `RL` `ZOD` |
| `GET` | `/api/syndic/canal-interne` | GET /api/syndic/canal-interne — récupérer les messages internes du cabinet | `AUTH` `RL` `ZOD` |
| `POST` | `/api/syndic/canal-interne` | POST /api/syndic/canal-interne — envoyer un message interne | `AUTH` `RL` `ZOD` |
| `PATCH` | `/api/syndic/canal-interne` | PATCH /api/syndic/canal-interne — marquer tout comme lu | `AUTH` `RL` `ZOD` |
| `POST` | `/api/syndic/chatbot-whatsapp` | api.groq.com/openai/v1/chat/completions' |  |
| `GET` | `/api/syndic/coproprios` | Retourne tous les copropriétaires du cabinet | `AUTH` `RL` `ZOD` |
| `POST` | `/api/syndic/coproprios` | Créer un ou plusieurs copropriétaires (supporte batch pour migration) | `AUTH` `RL` `ZOD` |
| `PATCH` | `/api/syndic/coproprios` | Modifier un copropriétaire | `AUTH` `RL` `ZOD` |
| `DELETE` | `/api/syndic/coproprios` | Supprimer un copropriétaire | `AUTH` `RL` `ZOD` |
| `POST` | `/api/syndic/extract-pdf` | Retourne le texte extrait — utilise unpdf (Vercel/Node.js compatible, sans binaires natifs) | `AUTH` `RL` |
| `POST` | `/api/syndic/fixy-syndic` | ── Route principale ────────────────────────────────────────────────────────── | `AUTH` `RL` |
| `GET` | `/api/syndic/immeubles` | GET /api/syndic/immeubles — récupérer les immeubles du cabinet | `AUTH` `RL` `ZOD` |
| `POST` | `/api/syndic/immeubles` | POST /api/syndic/immeubles — créer un immeuble | `AUTH` `RL` `ZOD` |
| `PATCH` | `/api/syndic/immeubles` | PATCH /api/syndic/immeubles — mettre à jour un immeuble | `AUTH` `RL` `ZOD` |
| `DELETE` | `/api/syndic/immeubles` | DELETE /api/syndic/immeubles — supprimer un immeuble | `AUTH` `RL` `ZOD` |
| `POST` | `/api/syndic/import-gecond` | ══════════════════════════════════════════════════════════════════════════════ | `AUTH` `ZOD` |
| `GET` | `/api/syndic/invite` | Valider un token d'invitation (pour afficher la page d'accueil) | `RL` `ZOD` |
| `POST` | `/api/syndic/invite` | Accepter une invitation (crée le compte ou lie un compte existant) | `RL` `ZOD` |
| `POST` | `/api/syndic/lea-comptable` | ── Route principale ────────────────────────────────────────────────────────── | `AUTH` `RL` |
| `POST` | `/api/syndic/max-ai` | ── Route principale ────────────────────────────────────────────────────────── | `AUTH` `RL` `ZOD` |
| `GET` | `/api/syndic/messages` | ── GET /api/syndic/messages?artisan_id=xxx — Canal de communication ────────── | `AUTH` `RL` `ZOD` |
| `POST` | `/api/syndic/messages` | ── POST /api/syndic/messages — Envoyer un message ─────────────────────────── | `AUTH` `RL` `ZOD` |
| `POST` | `/api/syndic/mission-report` | Stocke dans syndic_emails_analysed + syndic_notifications + Supabase Storage | `ZOD` |
| `GET` | `/api/syndic/missions` | GET /api/syndic/missions — récupérer les missions du cabinet | `AUTH` `RL` `ZOD` |
| `POST` | `/api/syndic/missions` | POST /api/syndic/missions — créer une mission | `AUTH` `RL` `ZOD` |
| `PATCH` | `/api/syndic/missions` | PATCH /api/syndic/missions — mettre à jour une mission | `AUTH` `RL` `ZOD` |
| `DELETE` | `/api/syndic/missions` | DELETE /api/syndic/missions?id=xxx — supprimer une mission | `AUTH` `RL` `ZOD` |
| `GET` | `/api/syndic/notify-artisan` | ⚠️ SÉCURISÉ : auth obligatoire | `AUTH` `RL` `ZOD` |
| `POST` | `/api/syndic/notify-artisan` | ⚠️ SÉCURISÉ : auth obligatoire + vérification rôle syndic | `AUTH` `RL` `ZOD` |
| `PATCH` | `/api/syndic/notify-artisan` | ── Marquer une notification comme lue ─────────────────────────────────────── | `AUTH` `RL` `ZOD` |
| `GET` | `/api/syndic/planning-events` | GET /api/syndic/planning-events — récupérer les événements du cabinet | `AUTH` `RL` `ZOD` |
| `POST` | `/api/syndic/planning-events` | POST /api/syndic/planning-events — créer un événement | `AUTH` `RL` `ZOD` |
| `DELETE` | `/api/syndic/planning-events` | DELETE /api/syndic/planning-events?id=xxx | `AUTH` `RL` `ZOD` |
| `POST` | `/api/syndic/send-email` | Envoyer un ou plusieurs emails via Resend | `AUTH` `RL` `ZOD` |
| `GET` | `/api/syndic/signalements` | GET /api/syndic/signalements — récupérer les signalements du cabinet | `AUTH` `ZOD` |
| `POST` | `/api/syndic/signalements` | POST /api/syndic/signalements/message — ajouter un message (via query param action=message) | `AUTH` `ZOD` |
| `PATCH` | `/api/syndic/signalements` | PATCH /api/syndic/signalements — mettre à jour un signalement | `AUTH` `ZOD` |
| `GET` | `/api/syndic/team` | Retourne tous les membres de l'équipe du cabinet connecté | `AUTH` `RL` `ZOD` |
| `POST` | `/api/syndic/team` | Crée un nouveau membre (invitation) avec modules personnalisés optionnels | `AUTH` `RL` `ZOD` |
| `PATCH` | `/api/syndic/team` | Modifier un membre (rôle, statut actif, modules personnalisés) | `AUTH` `RL` `ZOD` |
| `DELETE` | `/api/syndic/team` | Supprimer un membre | `AUTH` `RL` `ZOD` |

## Utilisateur

| Method | Endpoint | Description | Guards |
|--------|----------|-------------|--------|
| `DELETE` | `/api/user/delete-account` | Couvre TOUTES les tables : artisan, syndic, client, booking, fiscal, etc. | `AUTH` `RL` `ZOD` |
| `GET` | `/api/user/export-csv` | — | `AUTH` `RL` |
| `GET` | `/api/user/export-data` | Retourne TOUTES les données personnelles de l'utilisateur en JSON | `AUTH` `RL` |

---

*Regenerate: `npx tsx scripts/generate-api-docs.ts`*
