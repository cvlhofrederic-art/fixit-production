# Registre des activités de traitement — Vitfix.io

> Article 30 du RGPD (UE 2016/679). Tenu et mis à jour par le responsable du traitement.
> Doit être mis à disposition de l'autorité de contrôle (CNIL) sur demande.

**Responsable du traitement** : SAS Kinnova Group, 951 819 010, 115 Rue Claude Nicolas Ledoux, 13290 Aix-en-Provence (FR)
**Représentant légal** : Frédéric Carvalho, Président
**Contact RGPD** : `rgpd@vitfix.io`

**Version** : 1.0 — 5 mai 2026

---

## Traitement #1 — Mise en relation client/artisan

| Item | Valeur |
|---|---|
| Finalité | Mettre en relation un consommateur (particulier ou pro) avec un artisan référencé sur la plateforme |
| Base légale | Art. 6.1.b RGPD — exécution d'un contrat (CGU acceptées) |
| Catégories de personnes | Visiteurs du site, clients, artisans |
| Catégories de données | Identité, contact, géolocalisation approximative (ville), motif de la demande |
| Destinataires | Artisans correspondant à la demande (matched), équipe Vitfix (support) |
| Transferts hors UE | Cloudflare (CDN, EU-US DPF), Supabase (Frankfurt EU) |
| Durée de conservation | 3 ans après dernière interaction puis suppression |
| Mesures de sécurité | RLS Supabase, TLS 1.3, MFA disponible |

## Traitement #2 — Émission de devis et factures par les artisans

| Item | Valeur |
|---|---|
| Finalité | Permettre aux artisans de générer des documents fiscaux conformes (FR + PT pro-forma) |
| Base légale | Art. 6.1.c RGPD — obligation légale (Code commerce, CGI) + 6.1.b (contrat artisan/client) |
| Catégories de personnes | Artisans (auteur), clients (destinataires des documents) |
| Catégories de données | Identité parties, adresses, montants HT/TTC, NIF/SIRET, signature électronique simple |
| Destinataires | Artisans, clients (via PDF), DGFiP/AT en cas de contrôle |
| Transferts hors UE | Stockage Supabase (Frankfurt), Cloudflare (CDN, DPF) |
| Durée de conservation | **10 ans** (Art. L. 123-22 Code commerce, L. 102 B LPF) puis anonymisation |
| Mesures de sécurité | Hash chain + chain_signature HMAC, RLS no-DELETE, audit_log 10 ans, PDF/A-3 archivage |

## Traitement #3 — Gestion des chantiers BTP

| Item | Valeur |
|---|---|
| Finalité | Suivi des chantiers : équipes, planning, photos, rapports d'intervention |
| Base légale | Art. 6.1.b RGPD — contrat artisan |
| Catégories de personnes | Artisans, salariés artisans, clients |
| Catégories de données | Adresses chantier, photos géolocalisées, plannings, pointages équipes |
| Destinataires | Artisans, équipe artisan, client (via portail client) |
| Transferts hors UE | Supabase Storage (Frankfurt), Cloudflare |
| Durée de conservation | 5 ans après fin chantier (prescription litige construction) |
| Mesures de sécurité | RLS par artisan, photos chiffrées at-rest |

## Traitement #4 — Communication artisan/client (messagerie)

| Item | Valeur |
|---|---|
| Finalité | Permettre l'échange de messages, devis et factures entre artisans et clients |
| Base légale | Art. 6.1.b RGPD — contrat |
| Catégories de personnes | Artisans, clients |
| Catégories de données | Texte des messages, métadonnées (timestamps, lu/non-lu) |
| Destinataires | Artisan et client de la conversation uniquement |
| Transferts hors UE | Supabase, Resend (notifications email) |
| Durée de conservation | 3 ans après dernier message |
| Mesures de sécurité | RLS Supabase, conversation isolée par paire participant |

## Traitement #5 — Paiement et abonnement Stripe

| Item | Valeur |
|---|---|
| Finalité | Encaisser l'abonnement Vitfix Pro auprès des artisans |
| Base légale | Art. 6.1.b RGPD — contrat |
| Catégories de personnes | Artisans payants |
| Catégories de données | Carte bancaire (tokenisée, jamais stockée en clair par Vitfix), facturation Stripe |
| Destinataires | Stripe (sous-traitant PCI-DSS), DGFiP via Stripe Atlas |
| Transferts hors UE | Stripe (USA + EU subsidiaries, DPF) |
| Durée de conservation | 10 ans pour les factures Stripe (cohérence Code commerce) |
| Mesures de sécurité | Tokenisation Stripe, webhook HMAC vérifié, idempotency keys |

## Traitement #6 — Logs techniques et monitoring

| Item | Valeur |
|---|---|
| Finalité | Détecter les anomalies, débugger, prouver la sécurité du système |
| Base légale | Art. 6.1.f RGPD — intérêt légitime (sécurité, qualité de service) |
| Catégories de personnes | Toute personne interagissant avec la plateforme |
| Catégories de données | Adresse IP, user-agent, timestamps, stack traces |
| Destinataires | Sentry (sous-traitant), équipe technique Vitfix |
| Transferts hors UE | Sentry (USA, EU region disponible et activée — Frankfurt) |
| Durée de conservation | 1 an (cleanup auto via cron `audit_logs_cleanup` migration 042) |
| Mesures de sécurité | Anonymisation des données personnelles dans les logs, agrégation |

## Traitement #7 — IA assistante (Fixy AI, Materiaux AI, etc.)

| Item | Valeur |
|---|---|
| Finalité | Assister l'artisan dans la création de devis, l'estimation matériaux, la conversation client |
| Base légale | Art. 6.1.b RGPD (contrat) + 6.1.f (intérêt légitime) |
| Catégories de personnes | Artisans (utilisateurs des assistants IA) |
| Catégories de données | Prompts utilisateur (peuvent contenir noms client, descriptifs travaux) |
| Destinataires | Groq (LLM Llama 3.3 70B), Tavily (recherche web), Langfuse (traçage) |
| Transferts hors UE | Groq (USA, DPF non garanti — to verify) |
| Durée de conservation | Prompts non stockés long-terme par Vitfix ; conservation Groq selon leur politique (typiquement 30 jours) |
| Mesures de sécurité | Anonymisation par prompt template (pas d'envoi automatique de NIF/IBAN), rate limiting |

## Sous-traitants — registre des DPA signés

| Sous-traitant | Localisation | DPA | Certification |
|---|---|---|---|
| Supabase | USA + EU (Frankfurt) | ✅ signé | SOC2 Type II, GDPR, HIPAA |
| Cloudflare | USA + UE | ✅ signé | SOC2 Type II, ISO 27001, EU-US DPF |
| Sentry | USA + UE (Frankfurt) | ✅ signé | SOC2 Type II, EU-US DPF |
| Stripe | USA + EU subsidiaries | ✅ signé | PCI-DSS Level 1, EU-US DPF |
| Resend | USA | ✅ signé | EU-US DPF |
| Groq | USA | ⚠️ à vérifier | — |
| Tavily | USA | ⚠️ à vérifier | — |
| Langfuse | USA / self-hosted | ⚠️ à vérifier | — |

**Action plan court terme** :
- Vérifier les DPA Groq, Tavily, Langfuse
- Documenter dans `docs/conformite/dpa/` chaque DPA signé avec date

---

## Politique de mise à jour

Ce registre est mis à jour :
- À l'ajout d'une nouvelle finalité de traitement
- À l'ajout d'un nouveau sous-traitant
- À chaque modification substantielle d'un traitement existant
- Annuellement au minimum (revue formelle)

**Prochaine revue programmée** : 5 mai 2027.
