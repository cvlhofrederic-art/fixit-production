# Audit UX/UI — Vitfix.io

**Date** : 2026-04-13
**Perimetre** : 109 pages, 227 composants, 5 locales (FR/PT/EN/ES/NL), 4 dashboards
**Methode** : Analyse statique du code source (read-only, zero edit)
**Severites** : P0 (casse) | P1 (friction majeure) | P2 (moderee) | P3 (polish)

---

## 1. Cartographie du perimetre audite

| Section | Pages | Composants | Fichiers audites |
|---------|-------|------------|-----------------|
| Auth | 4 | — | login, register, reset-password, update-password |
| Transverses | — | 10 | Header, Footer, CookieConsent, LanguageSwitcher, Modal, Button, FormField, WhatsApp, SectionErrorBoundary, Providers |
| Global | 4 | — | layout.tsx, error.tsx, not-found.tsx, globals.css |
| Dashboard Artisan | 1 (3841L) | 20+ | page.tsx, V5Header, V5Sidebar, HomeSection, Calendar, Clients, Settings, Comptabilite, Materiaux, Messagerie, Stats, Rapports, BTP |
| Dashboard Syndic | 5 | 60+ | login, register, invite, dashboard, Header, Sidebar + sections financial/operations/governance/communication/residents/technical |
| Dashboard Client | 1 (1615L) | 7 | page.tsx, Overview, Bookings, Documents, Logement, Marches, Profile, Analyse |
| Dashboard Copro | 2 | 13 | dashboard, portail + sections |
| FR Marketing | 39 | 5+ | home, recherche, reserver, artisan/[id], services, blog, tarifs, simulateur, villes, urgence, copropriete, specialites |
| PT Marketing | 31 | — | home, servicos, blog, avaliacoes, cidades, perto-de-mim, condominio, precos, urgencia, privacidade |
| EN | 8 | 3 | home, [slug], emergency, terms, privacy, my-data, cookies, legal-notices + EmergencyBlock, QuoteRequestForm, TrustSignals |
| ES/NL | 4 | — | home + [slug] par locale |
| Legal FR | 5 | — | confidentialite, mes-donnees, cookies, contact, confirmation |
| Admin | 2 | — | login, dashboard (986L) |
| RFQ/Tracking | 2 | — | repondre/[token], tracking/[token] |
| AI Chat | 3 | — | AiChatBot (1101L), FixyChatGeneric, SimulateurChat |
| Marketplace | 1 | 1 | publier, BourseAuxMarchesSection |
| Pro | 5 | — | register, faq, tarifs, mobile, invite |
| Hooks | 5 | — | useNotifications, useScrollAnimation, useSignatureCanvas, usePermissions, useModulesConfig |
| Validation | 1 | — | lib/validation.ts (Zod schemas) |

---

## 2. Tableau des findings

### 2.1 P0 — Casse (4 findings)

| ID | Section | Categorie | Source | Description |
|----|---------|-----------|--------|-------------|
| SYND-001 | Syndic | Error | `sentry.client.config.ts:16-17` | Sentry Session Replay "blocs roses" : `replaysOnErrorSampleRate: 1.0` injecte des masques DOM sur erreur JS dans le dashboard syndic |
| CLI-001 | Client | Error | `app/client/dashboard/page.tsx:946-958` | Prop `setAnalyseFilename` manquante passee a `ClientDocumentsSection` — crash runtime quand l'utilisateur clique "Analyser" sur un devis non signe |
| FR-008 | FR Reserver | Error | `app/fr/reserver/page.tsx:38-43` | Aucune gestion des query params manquants — la page boucle sur un spinner infini si `?artisan=` ou `?service=` absent |
| PT-001 | PT Blog | i18n | `app/pt/blog/page.tsx:9` | Blog PT default a la locale FR quand aucun cookie n'est set — les nouveaux visiteurs portugais voient le blog francais |

### 2.2 P1 — Friction majeure (45 findings)

| ID | Section | Categorie | Source | Description |
|----|---------|-----------|--------|-------------|
| AUTH-001 | Auth | Responsive | `app/auth/login/page.tsx:101-111` | Nav login avec `padding: '0 48px'` en dur — overflow sur mobile 320px |
| AUTH-002 | Auth | Responsive | `app/auth/login/page.tsx:203-208` | Grille 3 colonnes selecteur espace sans breakpoint responsive — illisible sur mobile |
| AUTH-008 | Auth | Form | `app/auth/register/page.tsx:118-214` | Validation uniquement au submit sur 8+ champs — erreurs decouvertes apres scroll |
| GLOBAL-005 | Global | Responsive | `app/auth/login/page.tsx:164-173` | Padding inline `48px 40px` sur la card login — double compression avec AUTH-002 sur petit ecran |
| SHARED-001 | Transverse | Responsive | `components/common/Footer.tsx:26` | Inline `style` ecrase les classes Tailwind responsive du footer — grille 4 colonnes forcee sur mobile |
| DASH-001 | Artisan | Loading | `app/pro/dashboard/page.tsx:34-39` | 6 sections dynamiques sans `loading` fallback — zone blanche pendant le chargement des chunks |
| DASH-002 | Artisan | Loading | `app/pro/dashboard/page.tsx:67,85-87` | Sidebar et header aussi sans loading fallback — layout vide au premier chargement |
| DASH-003 | Artisan | Loading | `app/pro/dashboard/page.tsx:90-102` | 11 sections Conciergerie/Gestionnaire sans loading fallback |
| DASH-007 | Artisan | Responsive | `components/dashboard/HomeSection.tsx:228` | Grille inline `2fr 1.5fr 1.2fr` sans breakpoint — ecrasee sur mobile |
| DASH-008 | Artisan | Responsive | `components/dashboard/HomeSection.tsx:347,385` | Grilles 3 et 4 colonnes inline sans responsive |
| DASH-013 | Artisan | Error | `app/pro/dashboard/page.tsx:664-724` | 10 sections rendues sans `SectionErrorBoundary` — un crash dans une section tue tout le dashboard |
| DASH-014 | Artisan | Error | `app/pro/dashboard/page.tsx:249` | Pas de catch sur `getSession()` — spinner infini si Supabase inaccessible |
| DASH-021 | Artisan | Navigation | `app/pro/dashboard/page.tsx:1032-1097` | Sections Conciergerie/Gestionnaire sans error boundary ni animation |
| DASH-024 | Artisan | A11y | `components/dashboard/V5Sidebar.tsx` | Zero ARIA sur la sidebar — pas de `role="navigation"`, pas d'`aria-label` |
| DASH-033 | Artisan | Loading | `components/dashboard/DashboardShell.tsx:30` | Skeleton V22 affiche pour tous les users alors que V5 est actif — flash incohérent |
| SYND-002 | Syndic | Error | `app/syndic/dashboard/page.tsx:474-496` | "Ecran noir" Realtime : pas de feedback quand MAX_RETRIES atteint — updates silencieusement perdues |
| SYND-003 | Syndic | Navigation | `app/syndic/login/page.tsx` | Pas de "Mot de passe oublie" sur le login syndic |
| SYND-011 | Syndic | Responsive | `components/syndic-dashboard/layout/Sidebar.tsx:51` | Sidebar syndic sans breakpoint mobile — pas de hamburger, pas d'overlay |
| SYND-015 | Syndic | Responsive | `components/syndic-dashboard/financial/SaisieIAFacturesSection.tsx:1047,1297` | Tables sans `overflow-x: auto` — debordement sur tablette |
| SYND-029 | Syndic | Responsive | `app/syndic/dashboard/page.tsx:2479` | Layout racine `flex h-screen overflow-hidden` sans aucune adaptation mobile |
| SYND-030 | Syndic | Error | `app/syndic/dashboard/page.tsx` (30+ locations) | 30+ `catch {}` vides — erreurs silencieuses generalisees |
| SYND-031 | Syndic | A11y | Tous les composants section | Zero ARIA systematique sur les ~60 composants section |
| SYND-032 | Syndic | Responsive | Tous les composants section | Zero breakpoint responsive dans les styles inline — tout deborde sur mobile |
| CLI-002 | Client | Navigation | `app/client/dashboard/page.tsx:1033-1061` | Nav mobile manque 4 onglets (Documents, Analyse, Simulateur, Paiements) |
| CLI-003 | Client | Loading | `app/client/dashboard/page.tsx:19` | 10 imports dynamiques sans loading fallback |
| CLI-004 | Client | Error | `app/client/dashboard/page.tsx:120-152` | Auth failure : spinner infini si la redirection echoue |
| COPRO-001 | Copro | Responsive | `app/coproprietaire/dashboard/page.tsx:1254-1380` | Zero navigation mobile — pas de bottom nav, pas de hamburger |
| COPRO-002 | Copro | Loading | `app/coproprietaire/dashboard/page.tsx:17-33` | 14 imports dynamiques sans loading fallback |
| COPRO-003 | Copro | Error | `app/coproprietaire/dashboard/page.tsx:921-972` | Auth failure tombe silencieusement en mode demo avec fausses donnees |
| FR-003 | FR Recherche | Navigation | `app/fr/recherche/page.tsx:559` | `router.push('/recherche?...')` sans prefixe `/fr/` — sort du contexte locale |
| FR-009 | FR Reserver | Error | `app/fr/reserver/page.tsx:80-84` | Fetch artisan echoue → formulaire rendu avec donnees null |
| FR-013 | FR Artisan | Error | `app/fr/artisan/[id]/page.tsx:511-533` | Page "non trouve" avec entites HTML brutes et lien sans `/fr/` |
| FR-014 | FR Artisan | Navigation | `app/fr/artisan/[id]/page.tsx:840-853` | Breadcrumbs avec chemins hardcodes sans `/fr/` |
| FR-016 | FR Artisan | Responsive | `app/fr/artisan/[id]/page.tsx:1134-1185` | Boutons bottom bar debordent sur mobile 320px |
| FR-021 | FR Home | Navigation | `app/page.tsx:84-88` | Recherche bloquee par auth — les visiteurs non connectes ne peuvent pas chercher |
| FR-034 | FR Global | Navigation | Multiples fichiers | Pattern systematique de chemins sans `/fr/` — sort du contexte locale sur chaque CTA interne |
| FR-035 | FR Home | A11y | `app/page.tsx:122` | Pas de menu mobile sur la page d'accueil racine |
| PT-003 | PT Cidade | Navigation | `app/pt/cidade/[slug]/page.tsx:84` | Breadcrumb JSON-LD pointe vers `/pt/servicos/` au lieu de `/pt/cidade/` |
| PT-005 | PT Cidade | Empty State | `app/pt/cidade/[slug]/page.tsx:159` | Placeholder `{city}` non remplace dans les descriptions |
| PT-006 | PT Precos | Navigation | `app/pt/precos/[slug]/page.tsx:293-296` | Lien "Contactar-nos" vers `/contact` (route FR inexistante sous /pt/) |
| EN-001 | EN Legal | i18n | `app/en/terms/page.tsx:11` et 3 autres | Pages legales EN appellent `getServerTranslation()` sans locale → contenu FR |
| EN-002 | EN GDPR | i18n | `app/en/privacy/my-data/page.tsx:87` | Mot de confirmation "SUPPRIMER" en francais sur la page EN |
| ES-001 | ES | i18n | `app/es/page.tsx:138` | EmergencyBlock en anglais hardcode sur la page espagnole |
| NL-001 | NL | i18n | `app/nl/page.tsx:138` | EmergencyBlock en anglais hardcode sur la page neerlandaise |
| CONTACT-001 | Contact | Form | `app/contact/page.tsx:17-21` | Formulaire contact utilise `mailto:` au lieu d'un POST API — rien ne se passe sans client mail |
| CHAT-001 | AI Chat | A11y | `components/chat/AiChatBot.tsx:866-963` | Pas d'`aria-live` sur les 3 composants chat — messages invisibles aux screen readers |
| CHAT-002 | AI Chat | A11y | `components/chat/AiChatBot.tsx:844` | Pas de fermeture Escape sur les fenetres chat |
| FORM-001 | Validation | Form | `lib/validation.ts:14` | Messages Zod developer-facing montres aux utilisateurs (`'artisan_id must be a valid UUID'`) |
| FORM-003 | Pro Register | Form | `app/pro/register/page.tsx:327 vs 639` | `minLength={6}` HTML vs validation JS 8 chars + maj + min + chiffre |
| FORM-007 | Pro Invite | Form | `app/pro/invite/page.tsx:52-58` | Page invite 100% francais sans i18n |
| RFQ-001 | RFQ | Error | `app/rfq/repondre/[token]/page.tsx:29` | Erreur hardcodee en francais pour les utilisateurs PT |
| TRACK-001 | Tracking | i18n | `app/tracking/[token]/page.tsx` | Page tracking 100% francais — partagee avec des clients PT |
| CONTACT-002 | Contact | Form | `app/contact/page.tsx:21` | `setSent(true)` immediatement apres `mailto:` — fausse confirmation |

### 2.3 P2 — Moderee (100+ findings)

<details>
<summary>Cliquer pour voir les 100+ findings P2</summary>

#### Auth + Transverses
| ID | Source | Description |
|----|--------|-------------|
| AUTH-003 | `app/auth/login/page.tsx:368-404` | Labels non associes aux inputs (pas de htmlFor/id) |
| AUTH-004 | `app/auth/login/page.tsx:447-459` | Toggle password `tabIndex={-1}` — invisible au clavier |
| AUTH-005 | `app/auth/login/page.tsx:135` | "Retour a l'accueil" hardcode en francais |
| AUTH-006 | `app/auth/login/page.tsx:372+` | Labels formulaire hardcodes FR |
| AUTH-007 | `app/auth/login/page.tsx:57-71` | Pas d'indicateur de redirection post-login |
| AUTH-009 | `app/auth/register/page.tsx:193` | Messages Supabase bruts en anglais montres a l'utilisateur |
| AUTH-010 | `app/auth/register/page.tsx:357-648` | Pas d'`aria-describedby`/`aria-invalid` sur les champs |
| AUTH-011 | `app/auth/register/page.tsx:267-298` | Cards type-selection utilisent `Link` au lieu de `LocaleLink` |
| AUTH-013 | `app/auth/update-password/page.tsx:136` | `minLength={6}` vs validation JS a 8 |
| AUTH-014 | `app/auth/update-password/page.tsx:103-118` | Spinner infini si token expire — pas de timeout |
| SHARED-002 | `components/common/Header.tsx:113` | Overlay dropdown user menu sans semantique |
| SHARED-003 | `components/common/Header.tsx:170-202` | Menu mobile sans focus trap ni Escape |
| SHARED-005 | `components/common/CookieConsent.tsx:147-238` | Cookie banner `role="dialog"` sans focus initial |
| SHARED-008 | `components/ui/Button.tsx:45-51` | Button en mode link ignore `disabled` |
| GLOBAL-001 | `app/error.tsx:62` | Bouton retry jaune avec texte blanc — contraste 1.4:1 (WCAG fail) |
| GLOBAL-004 | `app/layout.tsx:219` | `role="main"` redondant sur `<main>` |

#### Dashboard Artisan
| ID | Source | Description |
|----|--------|-------------|
| DASH-004 | `components/dashboard/SettingsSection.tsx:118` | Loading "Chargement..." sans spinner, pas localise |
| DASH-005 | `components/dashboard/HomeSection.tsx:228` | Empty state sans CTA quand zero bookings/devis/alertes |
| DASH-009 | `components/dashboard/SettingsSection.tsx:515` | Grille settings 2 colonnes inline sans responsive |
| DASH-010 | `components/dashboard/CalendarSection.tsx:109-132` | Boutons header calendrier wrappent mal sur tablette |
| DASH-011 | `app/pro/dashboard/dashboard-v5.css:382-398` | Sidebar V5 60px toujours visible sur mobile — pas d'overlay |
| DASH-012 | `components/dashboard/DashboardShell.tsx:41` | Skeleton `1fr 320px` deborde sur mobile |
| DASH-015 | `components/dashboard/SettingsSection.tsx:112` | `catch {}` silencieux sur save payment info |
| DASH-016 | `components/dashboard/ComptabiliteSection.tsx:137,588` | `catch {}` silencieux sur chat IA comptable |
| DASH-017 | `components/dashboard/ClientsSection.tsx:106-117` | Erreur API swallowed — empty state au lieu d'erreur |
| DASH-018 | `components/dashboard/ClientsSection.tsx:211` | Pas de validation email/phone/SIRET sur les clients |
| DASH-019 | `components/dashboard/btp/ChantiersBTPSection.tsx:55` | Pas de validation dates/budget sur les chantiers |
| DASH-022 | `components/dashboard/V5Sidebar.tsx:59` | Items sidebar `<div>` au lieu de `<button>` — pas au clavier |
| DASH-023 | `app/pro/dashboard/page.tsx:345-353` | `navigateTo` ne scroll pas en haut |
| DASH-025 | `components/dashboard/V5Header.tsx:136` | Badge notifications sans `aria-label` |
| DASH-026 | `components/dashboard/V5Header.tsx:148` | Overlay notifications sans Escape |
| DASH-027 | `components/dashboard/V5Header.tsx:153` | "Tout marquer comme lu" est un `<span>` pas un `<button>` |
| DASH-028 | `app/pro/dashboard/page.tsx:395` | Pas d'`aria-live` sur le conteneur de section — changements pas annonces |
| DASH-030 | `components/dashboard/HomeSection.tsx:244` | Noms clients longs debordent la table |
| DASH-031 | `components/dashboard/ClientsSection.tsx:419-420` | Headers table sans `white-space: nowrap` |
| DASH-032 | `components/dashboard/V5Header.tsx:149` | Dropdown notifications deborde sur mobile |
| DASH-034 | `components/dashboard/EntrepriseLayout.tsx:106-108` | Nav "Modules" navigue vers settings sans tab modules |

#### Dashboard Syndic
| ID | Source | Description |
|----|--------|-------------|
| SYND-004 | `app/syndic/login/page.tsx:86-106` | Labels non associes aux inputs |
| SYND-005 | `app/syndic/register/page.tsx:176-252` | 12+ inputs sans id/htmlFor |
| SYND-006 | `app/syndic/register/page.tsx:242` | Grille 2 cols prenom/nom sans responsive |
| SYND-007 | `app/syndic/register/page.tsx:264` | Grille 3 cols ville/CP sans responsive |
| SYND-008 | `app/syndic/register/page.tsx:53-54` | Validation password faible — "aaaaaaaa" passe |
| SYND-012 | `components/syndic-dashboard/layout/Sidebar.tsx:49-153` | Zero ARIA sur la sidebar syndic |
| SYND-013 | `components/syndic-dashboard/layout/Header.tsx:62-152` | Panel notifications pas au clavier |
| SYND-016 | `components/syndic-dashboard/financial/SaisieIAFacturesSection.tsx` | Zero ARIA sur tabs/drop zone/indicateurs confiance |
| SYND-017 | `components/syndic-dashboard/financial/RecouvrementEnrichiFRSection.tsx:584` | Cards grille sans fallback responsive |
| SYND-018 | `components/syndic-dashboard/financial/RecouvrementEnrichiFRSection.tsx` | Zero ARIA pattern |
| SYND-019 | `components/syndic-dashboard/operations/SignalementsFRSection.tsx` | Zero ARIA sur pipeline et formulaires |
| SYND-020 | `components/syndic-dashboard/governance/VotacaoOnlineSection.tsx` | Composant PT-only montre a des utilisateurs FR |
| SYND-021 | `components/syndic-dashboard/governance/VoteCorrespondanceSection.tsx:1-98` | Zero ARIA |
| SYND-022 | `components/syndic-dashboard/communication/EmailsSection.tsx:186` | `grid-cols-4` sans responsive |
| SYND-023 | `components/syndic-dashboard/communication/EmailsSection.tsx:36-38` | Erreur Gmail confondue avec "pas connecte" |
| SYND-024 | `components/syndic-dashboard/communication/CanalCommunicationsPage.tsx` | Sidebar missions sans adaptation mobile |
| SYND-025 | `components/syndic-dashboard/residents/PortalCondominoSection.tsx:121-199` | Donnees demo hardcodees sans fetch reel |
| SYND-026 | `components/syndic-dashboard/residents/ExtranetEnrichiSection.tsx` | Meme probleme donnees demo |
| SYND-027 | `components/syndic-dashboard/technical/CarnetEntretienSection.tsx:28-35` | Validation silencieuse — submit bloque sans feedback |
| SYND-033 | `app/syndic/dashboard/page.tsx:2530` | Pas de breadcrumbs sur ~60 modules |
| SYND-034 | Dashboard syndic | Pas de loading fallback sur les imports dynamiques |
| SYND-035 | Multiple composants | Melange PT/FR — composants sans garde de langue |

#### Dashboard Client + Copro
| ID | Source | Description |
|----|--------|-------------|
| CLI-005 | `app/client/dashboard/page.tsx:161-175` | Erreur fetch bookings indistinguable de "zero bookings" |
| CLI-006 | `app/client/dashboard/page.tsx:810,854,1034` | Pas d'`aria-label` sur les 3 `<nav>` |
| CLI-007 | `app/client/dashboard/page.tsx:812,1045` | Tab actif non indique aux technologies d'assistance |
| CLI-008 | `app/client/dashboard/page.tsx:1065+` | 5 modals sans focus trap ni Escape |
| CLI-009 | `components/client-dashboard/pages/ClientDocumentsSection.tsx:210-239` | Boutons actions document debordent sur mobile |
| CLI-010 | `components/client-dashboard/pages/ClientProfileSection.tsx:59-66` | Validation telephone accepte "aaaaaaaaaa" |
| CLI-011 | `components/client-dashboard/pages/ClientBookingsSection.tsx:39` | Props `setRatingVal`/`setRatingComment` manquantes |
| COPRO-004 | `app/coproprietaire/dashboard/page.tsx:1276` | Sidebar largeur fixe pixel sans responsive |
| COPRO-005 | `app/coproprietaire/dashboard/page.tsx:1298-1362` | Sidebar sans ARIA, sans `aria-current` |
| COPRO-006 | `app/coproprietaire/dashboard/page.tsx:1276` | Sidebar inline styles, pas de focus-visible |
| COPRO-007 | `app/coproprietaire/dashboard/page.tsx:975-993` | 10 `localStorage.setItem()` sans debounce a chaque mutation |
| COPRO-008 | `app/coproprietaire/dashboard/page.tsx:1395-1407` | Bouton notifications navigue vers accueil au lieu d'ouvrir un panel |
| COPRO-009 | `components/coproprietaire-dashboard/pages/CoproSignalementSection.tsx:92` | Toggle "partie commune" sans `role="switch"` |
| COPRO-010 | `components/coproprietaire-dashboard/pages/CoproParametresSection.tsx:49-52` | Save profil sans validation — champs vides acceptes |

#### FR Marketing
| ID | Source | Description |
|----|--------|-------------|
| FR-002 | `app/fr/recherche/page.tsx:980-1006` | Empty state sans termes de recherche affiches |
| FR-004 | `app/fr/recherche/page.tsx:841-856` | Autocomplete sans pattern ARIA combobox |
| FR-005 | `app/fr/recherche/page.tsx:930` | Chips filtre sans indicateur scroll sur mobile |
| FR-007 | `components/recherche/FilterModal.tsx:62` | Overlay backdrop sans Escape |
| FR-010 | `app/fr/reserver/page.tsx:243-254` | Input tel sans validation format |
| FR-011 | `app/fr/reserver/page.tsx:260-267` | Email `readOnly` pour non-authentifies — champ vide non editable |
| FR-012 | `app/fr/reserver/page.tsx:143-149` | Etat `success` potentiellement inconsistant apres erreur |
| FR-018 | `components/artisan-profile/BookingForm.tsx:182-191` | Liens CGU sont des `<span>` non cliquables |
| FR-019 | `components/artisan-profile/AvisSection.tsx:32-33` | Loading reviews retourne `null` — layout shift |
| FR-024 | `app/fr/tarifs/page.tsx:33-40` | Badge GRATUIT peut pousser hors ecran sur mobile |
| FR-026 | `app/fr/blog/[slug]/page.tsx:115-119` | Breadcrumbs blog sans `/fr/` |
| FR-028 | `app/fr/comment-ca-marche/page.tsx:184` | CTAs liens sans `/fr/` |
| FR-030 | `app/fr/comment-ca-marche/page.tsx:289-295` | FAQ indicator `+` sans `aria-hidden` |
| FR-032 | `app/fr/copropriete/page.tsx:162` | Liens vers sous-pages qui n'existent peut-etre pas |
| FR-036 | `app/fr/reserver/page.tsx` | Spinners sans texte accessible |
| FR-037 | `app/fr/reserver/page.tsx:313-320` | Dropdown horaires vide sans explication |

#### PT Marketing
| ID | Source | Description |
|----|--------|-------------|
| PT-008 | `app/pt/condominio/page.tsx:32,136` | Abbreviation `24h/7j` francaise au lieu de `24h/7d` |
| PT-009 | `app/pt/perto-de-mim/[slug]/page.tsx:244` | Breadcrumb "Perto de Mim" non cliquable |
| PT-010 | `app/pt/precos/[slug]/page.tsx:321-342` | Table prix sans `<caption>` ni `aria-label` |
| PT-011 | `app/pt/avaliacoes/page.tsx:164-171` | Etoiles sans `aria-label` — screen readers lisent "star star star" |
| PT-012 | `app/pt/page.tsx:2` | Homepage PT re-exporte root — depend du cookie pour la locale |
| PT-013 | `app/pt/servicos/page.tsx:88` | 12 villes par service sans "voir plus" sur mobile |
| PT-014 | `app/pt/blog/page.tsx:115-332` | Blog server component sans Suspense boundary |
| PT-015 | `app/pt/privacidade/page.tsx:14-100` | Cles i18n brutes si locale mal resolue |

#### EN/ES/NL + Legal + Admin
| ID | Source | Description |
|----|--------|-------------|
| EN-003 | `app/en/page.tsx:117` | SVG fleches sans `aria-hidden` |
| EN-004 | `app/en/[slug]/page.tsx:256-264` | FAQ sans ARIA expanded |
| EN-005 | `app/en/page.tsx:227-232` | CTA "Request Quote" hardcode vers plombier |
| ES-002 | `app/es/[slug]/page.tsx:40` | EmergencyBlock anglais sur pages ES detail |
| NL-002 | `app/nl/[slug]/page.tsx:40` | EmergencyBlock anglais sur pages NL detail |
| LEGAL-001 | `app/confidentialite/mes-donnees/page.tsx:138` | Lien retour hardcode `/` — perd la locale PT |
| LEGAL-002 | `app/confidentialite/mes-donnees/page.tsx:19` | `dateFmtLocale` ignore la locale EN |
| LEGAL-003 | `app/confidentialite/mes-donnees/page.tsx:109` | `err.message` peut etre `undefined` si pas Error instance |
| CONFIRM-001 | `app/confirmation/page.tsx:124-125` | Toasts erreur hardcodes FR |
| ADMIN-002 | `app/admin/dashboard/page.tsx:218-219` | Pas de bouton retry quand stats echouent (catch-22 avec le refresh) |
| ADMIN-003 | `app/admin/dashboard/page.tsx:376-391` | 5 tabs admin debordent sur mobile |
| ADMIN-004 | `app/admin/dashboard/page.tsx:377-390` | Tabs admin sans ARIA tablist/tab/tabpanel |
| RFQ-002 | `app/rfq/repondre/[token]/page.tsx:146-188` | Formulaire RFQ sans validation client — prix NaN possible |
| RFQ-003 | `app/rfq/repondre/[token]/page.tsx:91-195` | Labels formulaire sans htmlFor/id |
| TRACK-002 | `app/tracking/[token]/page.tsx:33` | Pattern params legacy Next.js — warning possible |
| TRACK-003 | `app/tracking/[token]/page.tsx:187-194` | Iframe map sans alternative texte |
| CROSS-003 | Toutes locales | Pas de language switcher visible sur EN/ES/NL |

#### AI Chat + Formulaires + Patterns transversaux
| ID | Source | Description |
|----|--------|-------------|
| CHAT-003 | `components/chat/AiChatBot.tsx:202-208` | Micro disparait sans feedback si browser incompatible |
| CHAT-004 | `components/chat/AiChatBot.tsx:255-261` | Permission micro refusee → bouton disparait sans explication |
| CHAT-005 | `components/chat/AiChatBot.tsx:319-334` | Closure stale dans voice auto-send useEffect |
| CHAT-006 | `components/chat/AiChatBot.tsx:951-961` | "Fixy reflechit..." toujours en FR meme locale PT |
| CHAT-007 | `components/chat/AiChatBot.tsx:1005` | Placeholder chat toujours FR |
| CHAT-008 | `components/chat/AiChatBot.tsx:1059-1063` | Texte aide micro FR uniquement |
| CHAT-011 | `components/chat/FixyChatGeneric.tsx:273-366` | Pas de timeout sur streaming — peut bloquer indefiniment |
| FORM-002 | `lib/validation.ts` | Langues messages erreur inconsistantes (FR/EN/PT melanges) |
| FORM-004 | `app/pro/register/page.tsx:318-329` | Erreurs sequentielles — une seule erreur montree a la fois |
| FORM-005 | `app/fr/marches/publier/PublierMarcheClient.tsx:371-399` | Pas de `maxLength` sur les inputs vs Zod max(200)/max(5000) |
| SIM-001 | `components/simulateur/SimulateurChat.tsx:58-63` | Lien rate limit rendu en texte brut (pas cliquable) |
| SIM-003 | `components/simulateur/SimulateurChat.tsx:91-93` | Pas de gestion specifique erreur 429 |
| MKT-001 | `components/marches/BourseAuxMarchesSection.tsx:149-151` | Erreur fetch marches swallowed — liste vide sans explication |
| MKT-002 | `components/marches/BourseAuxMarchesSection.tsx:224+` | Multiple silent `catch {}` sur messages et bids |
| MKT-003 | `components/marches/BourseAuxMarchesSection.tsx:421-463` | `parseFloat(bidPrice)` sans validation — NaN possible |
| HOOK-001 | `hooks/useNotifications.ts:48-51` | Permission notification browser demandee sans contexte UI |
| HOOK-005 | `hooks/usePermissions.ts:86-89` | Permissions fail-open sur erreur reseau — securite |
| PRO-002 | `app/pro/faq/page.tsx:186-195` | FAQ non collapsible — long scroll mobile |
| PRO-003 | `app/pro/tarifs/page.tsx:145-169` | Table comparaison avec emoji check/cross inconsistant |
| PRO-004 | `app/pro/invite/page.tsx:52-70` | Validation password sans feedback temps reel |

</details>

### 2.4 P3 — Polish (35+ findings)

<details>
<summary>Cliquer pour voir les findings P3</summary>

| ID | Source | Description |
|----|--------|-------------|
| AUTH-012 | `app/auth/register/page.tsx:641-647` | Bouton submit sans spinner (contrairement au bouton SIRET) |
| AUTH-015 | `app/auth/update-password/page.tsx:120-167` | Pas d'indicateurs force password (alors que register en a) |
| SHARED-004 | `components/common/Header.tsx:170-171` | Gap 4px entre header et menu mobile |
| SHARED-006 | `components/common/WhatsAppFloatingButton.tsx:26` | `aria-label` hardcode en portugais |
| SHARED-007 | `components/common/SectionErrorBoundary.tsx:44` | Texte erreur hardcode FR |
| GLOBAL-002 | `app/not-found.tsx:15,31` | Lien recherche EN pointe vers `/recherche/` (FR) |
| GLOBAL-003 | `app/not-found.tsx` + `app/error.tsx` | `Link` au lieu de `LocaleLink` |
| DASH-006 | `components/dashboard/ChantiersSection.tsx:22-28` | Donnees MOCK hardcodees au lieu de vraies donnees |
| DASH-020 | `components/dashboard/btp/EquipesBTPSection.tsx:54-63` | Email/phone membres equipe non valides |
| DASH-029 | `components/dashboard/V5Header.tsx:125-130` | Caractere Unicode `☰` pour hamburger au lieu de SVG |
| DASH-035 | `app/pro/dashboard/loading.tsx:7` | "Chargement du tableau de bord..." FR uniquement |
| SYND-009 | `app/syndic/register/page.tsx:19` | State `company` type `any` |
| SYND-010 | `app/syndic/dashboard/loading.tsx:7` | Loading text FR uniquement |
| SYND-014 | `components/syndic-dashboard/layout/Header.tsx:78-81` | Bouton alertes sans aria-label |
| SYND-028 | `components/syndic-dashboard/technical/CarnetEntretienSection.tsx:35` | `contratForm` type `any` |
| CLI-012 | `app/client/dashboard/loading.tsx` | "Chargement..." FR uniquement |
| CLI-013 | `components/client-dashboard/pages/ClientDashboardOverview.tsx:129` | "Historique" hardcode FR |
| CLI-014 | `components/client-dashboard/pages/ClientDashboardOverview.tsx:179` | "Voir tout" hardcode FR |
| CLI-015 | `components/client-dashboard/pages/ClientDashboardOverview.tsx:235` | "Metiers populaires" hardcode FR |
| CLI-016 | `app/client/dashboard/page.tsx:655-657` | `window.alert()` au lieu de toast |
| CLI-017 | `components/client-dashboard/pages/ClientAnalyseSection.tsx:247` | Non-null assertion `prix!` — crash possible |
| COPRO-011 | `app/coproprietaire/dashboard/page.tsx:1385` | Padding header inline clip sur mobile |
| COPRO-012 | `app/coproprietaire/portail/page.tsx:327-335` | Loading FR uniquement |
| COPRO-013 | `app/coproprietaire/portail/page.tsx:112-177` | Profile fallback "Geraldine Xavier" demo |
| FR-006 | `components/recherche/FilterModal.tsx:60` | Modal filtre sans focus trap |
| FR-015 | `app/fr/artisan/[id]/page.tsx:857-863` | Entites HTML `&eacute;` au lieu de caracteres directs |
| FR-017 | `app/fr/artisan/[id]/page.tsx:1565` | `return null` fallback silencieux |
| FR-020 | `app/fr/artisan/[id]/page.tsx:597` | Favori redirige vers `/fr/login` au lieu de `/auth/login` |
| FR-023 | `app/page.tsx:108` | Logo link sans `aria-label` |
| FR-025 | `app/fr/tarifs/page.tsx:62` | CTA liens sans `/fr/` |
| FR-031 | `app/fr/urgence/page.tsx:51` | Contraste `text-white/70` sur fond sombre |
| PT-016 | `app/pt/urgencia/page.tsx:121-127` | `animate-ping` sans `motion-reduce` |
| PT-017 | `app/pt/precos/[slug]/page.tsx:466-483` | Liens blog derives du slug — titres mal formates, 404 potentiels |
| PT-018 | Multiples fichiers PT | SVG decoratifs sans `aria-hidden` |
| EN-006 | `app/en/[slug]/page.tsx:76-82` | Rating 4.9/127 avis hardcode — potentiellement trompeur |
| EN-007 | `app/en/emergency-home-repair-porto/page.tsx:63-86` | Numero tel cache sur mobile pour page urgence |
| NL-003 | `app/nl/page.tsx:175-177` | CTA NL hardcode vers renovation au lieu de generique |
| TRACK-004 | `app/tracking/[token]/page.tsx:113-145` | Branding "Fixit" au lieu de "VITFIX" |

</details>

---

## 3. Top risques

### Risque 1 — Dashboards inutilisables sur mobile
**Impact** : Artisan (3841L), Syndic (2479L+60 sections), Copro (1532L) — aucun n'a de layout mobile fonctionnel.
**Findings** : DASH-007/008, SYND-011/029/032, COPRO-001/004, CLI-002
**Utilisateurs touches** : Artisans BTP sur chantier (mobile-first), syndics en deplacement

### Risque 2 — Accessibilite (a11y) systemiquement absente
**Impact** : Zero ARIA sur ~60 composants syndic, zero sur les sidebars artisan/copro, chat IA sans aria-live, modals sans focus trap.
**Findings** : SYND-031, DASH-022/024, CHAT-001/002, CLI-006/007/008, + 20 autres
**Risque legal** : Non-conformite WCAG 2.1 AA — obligation EAA 2025

### Risque 3 — Erreurs silencieuses generalisees
**Impact** : 30+ `catch {}` vides dans le dashboard syndic, erreurs Supabase/API non signalees, spinners infinis.
**Findings** : SYND-030, DASH-013/014/015/016/017, CLI-004, FR-008/009, COPRO-003
**Consequence** : Perte de donnees invisible, utilisateurs bloques sans recours

### Risque 4 — Navigation casse par chemins sans prefixe locale
**Impact** : Liens internes FR sortent du contexte `/fr/`, breadcrumbs pointent vers `/recherche` au lieu de `/fr/recherche`. Meme probleme PT.
**Findings** : FR-003/013/014/021/034, PT-003/004/006
**Consequence** : Perte de contexte locale, metriques SEO fracturees

### Risque 5 — i18n defaillant sur EN/ES/NL
**Impact** : Pages legales EN affichent du francais, EmergencyBlock anglais sur ES/NL, mot "SUPPRIMER" sur GDPR anglais, blog PT default FR.
**Findings** : EN-001/002, ES-001, NL-001, PT-001, TRACK-001
**Consequence** : Non-conformite RGPD potentielle, experience utilisateur degradee pour les marches non-FR

---

## 4. Plan de remediation ordonne

### Phase 1 — Critiques (P0 + P1 bloquants) — Semaine 1-2

| Priorite | Action | Findings | Effort |
|----------|--------|----------|--------|
| 1 | Fixer les 4 P0 (crash client, spinner reserver, blog PT locale, Sentry replay) | CLI-001, FR-008, PT-001, SYND-001 | 2h |
| 2 | Ajouter `{ loading: SectionLoader }` a TOUS les dynamic imports (artisan, syndic, client, copro) | DASH-001/002/003, CLI-003, COPRO-002, SYND-034 | 3h |
| 3 | Wrapper toutes les sections dans `SectionErrorBoundary` | DASH-013/021 | 2h |
| 4 | Supprimer les inline `style` qui ecrasent les classes responsive (Footer, HomeSection) | SHARED-001, DASH-007/008 | 1h |
| 5 | Corriger les chemins sans `/fr/` et `/pt/` (recherche, breadcrumbs, CTAs) | FR-003/013/014/034, PT-003/004/006 | 4h |
| 6 | Fixer le formulaire contact (POST API au lieu de mailto) | CONTACT-001/002 | 3h |

### Phase 2 — Mobile (responsive dashboards) — Semaine 2-3

| Priorite | Action | Findings | Effort |
|----------|--------|----------|--------|
| 7 | Layout mobile syndic (sidebar overlay + hamburger) | SYND-011/029/032 | 8h |
| 8 | Layout mobile copro (bottom nav + sidebar toggle) | COPRO-001/004 | 4h |
| 9 | Completer la nav mobile client (4 onglets manquants) | CLI-002 | 2h |
| 10 | Migrer les grilles inline du dashboard artisan vers Tailwind responsive | DASH-007/008/009/012 | 4h |
| 11 | Responsive forms (login, register, syndic register) | AUTH-001/002, SYND-006/007 | 2h |

### Phase 3 — Error handling + feedback — Semaine 3-4

| Priorite | Action | Findings | Effort |
|----------|--------|----------|--------|
| 12 | Remplacer les `catch {}` vides par `toast.error()` (syndic : 30+, artisan : 5+) | SYND-030, DASH-015/016/017, MKT-001/002 | 4h |
| 13 | Ajouter des etats erreur avec retry (booking, auth, stats admin) | FR-009, CLI-004/005, ADMIN-002, COPRO-003 | 4h |
| 14 | Timeout sur les spinners infinis (update-password, auth) | AUTH-014, DASH-014 | 2h |
| 15 | Messages Zod user-friendly en FR/PT | FORM-001/002, VAL-001/002/003/004 | 4h |

### Phase 4 — i18n + locale — Semaine 4-5

| Priorite | Action | Findings | Effort |
|----------|--------|----------|--------|
| 16 | Forcer locale EN sur pages legales EN | EN-001/002 | 2h |
| 17 | Rendre EmergencyBlock locale-aware (ES/NL) | ES-001, NL-001 | 2h |
| 18 | Traduire les textes hardcodes FR dans les composants PT (chat, loading, labels) | CHAT-006/007/008, DASH-035, PT-008 | 4h |
| 19 | Fixer la detection locale PT (blog, homepage) | PT-001/012 | 2h |
| 20 | Ajouter language switcher sur EN/ES/NL | CROSS-003 | 3h |

### Phase 5 — Accessibilite — Semaine 5-7

| Priorite | Action | Findings | Effort |
|----------|--------|----------|--------|
| 21 | Creer un composant Tab accessible reutilisable (ARIA tablist/tab/tabpanel) | SYND-031, ADMIN-004, MKT-004 | 4h |
| 22 | `role="navigation"` + `aria-label` sur toutes les sidebars | DASH-024, SYND-012, COPRO-005, CLI-006 | 2h |
| 23 | Focus trap + Escape sur modals et chat | CHAT-002, CLI-008, SHARED-003/005 | 4h |
| 24 | `aria-live` sur les composants chat + sections dashboard | CHAT-001, DASH-028 | 2h |
| 25 | `htmlFor`/`id` sur tous les formulaires | AUTH-003, SYND-004/005, RFQ-003, CONTACT-004 | 3h |
| 26 | Sidebar items : `<button>` au lieu de `<div>` | DASH-022 | 1h |

### Phase 6 — Formulaires + validation — Semaine 7-8

| Priorite | Action | Findings | Effort |
|----------|--------|----------|--------|
| 27 | Validation inline temps reel sur register (password strength, email, tel) | AUTH-008, FORM-003/004 | 4h |
| 28 | Validation client-side sur RFQ, marketplace, client profil | RFQ-002, MKT-003, CLI-010 | 3h |
| 29 | Harmoniser `minLength` HTML avec la validation JS | AUTH-013, FORM-003 | 1h |
| 30 | Voice: fallback UI quand micro non supporte | CHAT-003/004 | 2h |

---

## 5. Questions ouvertes

| # | Question | Contexte |
|---|----------|----------|
| 1 | **Le dashboard syndic doit-il supporter le mobile ?** Les ~60 sections sont 100% desktop. Un refactor mobile est un chantier majeur (~40h). A confirmer comme priorite. | SYND-029/032 |
| 2 | **L'admin est-il volontairement FR-only ?** Si oui, ADMIN-001 descend en P3. | ADMIN-001 |
| 3 | **Les donnees demo (Portal Condomino, Chantiers) sont-elles temporaires ?** Elles causent de la confusion utilisateur. Roadmap pour le remplacement par Supabase ? | SYND-025/026, DASH-006 |
| 4 | **La recherche doit-elle etre accessible sans auth ?** Actuellement FR-021 bloque les visiteurs non connectes. Decision produit a confirmer. | FR-021 |
| 5 | **Quel niveau WCAG visez-vous ?** Le site a des bases (skip-to-content, focus-visible, reduced-motion) mais les composants metier n'ont zero ARIA. AA minimum requis par l'EAA 2025. | SYND-031, DASH-024 |
| 6 | **Les pages legales EN doivent-elles etre traduites ?** Actuellement elles affichent du francais via `getServerTranslation()` sans locale. | EN-001 |
| 7 | **Le branding est Vitfix ou Fixit ?** Le tracking dit "Fixit", le reste dit "VITFIX". A harmoniser. | TRACK-004 |
| 8 | **Les sous-pages `/fr/copropriete/plomberie/`, `/espaces-verts/`, `/nettoyage-encombrants/` existent-elles ?** Des liens pointent vers elles mais leur existence n'a pas ete verifiee dans le scope de cet audit. | FR-032 |

---

## Statistiques globales

| Severite | Count | % |
|----------|-------|---|
| P0 (casse) | 4 | 2% |
| P1 (friction majeure) | 52 | 28% |
| P2 (moderee) | 100+ | 55% |
| P3 (polish) | 35+ | 19% |
| **Total** | **~190** | |

| Categorie | Count | Top sections touchees |
|-----------|-------|----------------------|
| Responsive | 35+ | Syndic, Artisan, Copro, Auth |
| A11y | 40+ | Syndic (systemique), Chat, Sidebars, Modals |
| Error | 25+ | Syndic (catch vides), Artisan, Client |
| Form | 20+ | Register, Validation Zod, RFQ, Marketplace |
| Navigation | 20+ | Chemins sans locale, breadcrumbs, mobile nav |
| i18n | 15+ | EN legal, ES/NL emergency, PT blog, Chat |
| Loading | 15+ | Dynamic imports, spinners infinis |
| Empty State | 10+ | Dashboards, recherche, demo data |

---

*Audit genere par analyse statique du code source. Aucun test navigateur execute. Les severites refletent l'impact utilisateur estime, pas la difficulte technique du fix.*
