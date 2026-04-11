# Audit QA — Dashboard Pro BTP

**Date :** 11 avril 2026
**Scope :** Module dashboard professionnel BTP (composants, hooks, API, DB)
**Mode :** Lecture seule (aucune modification)

---

## Synthese

| Severite | Nombre |
|----------|--------|
| CRITICAL | 11 |
| HIGH     | 17 |
| MEDIUM   | 27 |
| LOW      | 16 |
| **Total** | **71** |

---

## CRITICAL (11)

### SEC-1 — rfq/offer : zero authentification sur GET et POST
- **Fichier :** `app/api/rfq/offer/[token]/route.ts:12-73`
- **Categorie :** securite / autorisation
- Toute personne connaissant un token peut lire l'offre complete (avec join `rfqs` + items) et soumettre une reponse prix au nom du fournisseur. Aucun appel `getAuthUser`.
- **Fix :** Ajouter `getAuthUser(request)` ; pour le lien public, verifier `expires_at` et lier le token a un `artisan_id`.

### SEC-2 — rfq/offer POST : le statut reste `'pending'` apres reponse
- **Fichier :** `app/api/rfq/offer/[token]/route.ts:47-51`
- **Categorie :** bug / logique
- Le guard verifie `status !== 'pending'` (ligne 45), mais l'update ecrit `status: 'pending'` — l'offre peut etre repondue indefiniment.
- **Fix :** Changer en `status: 'answered'`.

### SEC-3 — marketplace-btp GET [id] : fuite de toutes les `marketplace_demandes`
- **Fichier :** `app/api/marketplace-btp/[id]/route.ts:23-43`
- **Categorie :** securite / autorisation
- GET non authentifie. Le `select` inclut `marketplace_demandes(id, type_demande, status, created_at)` — toutes les demandes acheteurs visibles pour n'importe quel visiteur anonyme connaissant l'UUID.
- **Fix :** Retirer le join `marketplace_demandes` du GET public, ou gater derriere auth + filtre `buyer_user_id = user.id`.

### SEC-4 — rfq/offer POST : aucune validation des champs financiers
- **Fichier :** `app/api/rfq/offer/[token]/route.ts:36-37`
- **Categorie :** securite / validation
- `total_price`, `delivery_days`, `comment`, `items` pris bruts de `req.json()` et ecrits en DB sans Zod. Prix negatif, string pour `delivery_days`, cles injectees dans `items` passent directement.
- **Fix :** Ajouter schema Zod avec bornes numeriques et types stricts pour `items`.

### SEC-5 — Notification polling userId vs artisanId : potentielle fuite cross-user
- **Fichier :** `page.tsx` + `useNotifications.ts:57-84, 125-195`
- **Categorie :** securite
- Le poll HTTP utilise `artisan_id=${userId}` (UUID user), le Realtime filtre avec `artisan_id=eq.${artisanId}` (UUID profil artisan). Colonnes differentes — risque de fuite de notifications entre artisans.
- **Fix :** Auditer le backend pour confirmer quelle colonne est filtree, utiliser l'identifiant correct partout. Renommer les parametres.

### DATA-1 — seed-demo-localStorage s'active pour TOUS les nouveaux comptes
- **Fichier :** `lib/seed-demo-localStorage.ts:28-29`
- **Categorie :** bug / donnees
- La logique seed pour tout user sans documents existants en localStorage (pas seulement le compte demo). Un vrai artisan inscrit voit des faux devis (`DEV-2026-001`), faux clients (`Mme Dupont Catherine`), faux SIRET — comme s'ils etaient reels.
- **Fix :** Restreindre strictement a `artisanId === DEMO_ARTISAN_ID`. Supprimer le fallback `hasExistingDocs`.

### BUG-1 — SituationsTravaux : etat `selected` desynchronise apres `addPoste`
- **Fichier :** `components/dashboard/btp/SituationsTravaux.tsx:43, 119, 163`
- **Categorie :** bug / etat
- Apres `update(selected.id, { travaux: newTravaux })`, `setSelected(updated)` s'execute meme si `update` echoue silencieusement. `selected` n'est jamais resynchronise depuis le nouveau `items` array.
- **Fix :** Gater `setSelected(updated)` sur `ok === true`, ou synchroniser `selected` via un `useEffect` sur `items`.

### BUG-2 — RetenuesGarantie : montantMarche = 0 cree une retenue a 0 euros
- **Fichier :** `components/dashboard/btp/RetenuesGarantieSection.tsx:26-29`
- **Categorie :** bug / validation
- Aucune garde contre `montantMarche <= 0`. Document financier avec retenue a 0 euros persiste silencieusement.
- **Fix :** Ajouter `!form.montantMarche || form.montantMarche <= 0` au `disabled` du bouton sauvegarder.

### BUG-3 — DPGFSection : TVA toujours 20% quel que soit le pays ou regime
- **Fichier :** `components/dashboard/btp/DPGFSection.tsx:46`
- **Categorie :** bug / logique metier
- Export DPGF calcule `TVA 20%` en dur. Pour le marche PT (IVA 23% standard, 6% renovation) ou franchise TVA, le document legal est faux.
- **Fix :** Accepter un `tauxTVA` en prop ou deriver du locale.

### BUG-4 — Stale closure dans `onCreateRdv` (AiChatBot)
- **Fichier :** `app/pro/dashboard/page.tsx:1330-1348`
- **Categorie :** bug / closure
- `onCreateRdv` capture `bookings` au moment du render. `setBookings([newBooking, ...bookings])` utilise un snapshot potentiellement obsolete.
- **Fix :** `setBookings(prev => [newBooking, ...prev])`.

### BUG-5 — `loadDashboardData` : setState apres unmount
- **Fichier :** `app/pro/dashboard/page.tsx:263-330`
- **Categorie :** bug / memoire
- Fonction async non memoizee. Si le composant se demonte pendant les `await`, les `setState` continuent. Le flag `didLoad` ne protege pas contre ca.
- **Fix :** Ajouter un `isMounted` ref ou `AbortController` ; court-circuiter les `setState` dans le cleanup.

---

## HIGH (17)

### H-1 — `usePermissions` lit `fixit_pro_team_role` depuis localStorage stale
- **Fichier :** `page.tsx:272-281`, `usePermissions.ts:50-64`
- **Categorie :** bug / race condition
- Le hook lit localStorage avant que `loadDashboardData` l'ait ecrit. RBAC briefly incorrect au premier render.
- **Fix :** Deriver `proTeamRole` depuis `user.user_metadata` et passer en prop.

### H-2 — Notification Realtime : deps manquantes dans useEffect
- **Fichier :** `useNotifications.ts:123-215`
- **Categorie :** bug / closure
- `onNewBooking`, `onNavigate`, `t`, `isPt` captures au moment de la souscription, jamais mis a jour.
- **Fix :** Ajouter aux deps ou utiliser des refs stables.

### H-3 — `notifCallbacks` useMemo reconstruit le channel Realtime a chaque render
- **Fichier :** `page.tsx:221-226`
- **Categorie :** bug / perf
- L'identite de `callbacks` change a chaque render → teardown/rebuild du channel Realtime.
- **Fix :** Wrapper dans `useRef` et mettre a jour la ref sans declencher de re-souscription.

### H-4 — `onDataRefresh` dans AiChatBot non memoize
- **Fichier :** `page.tsx:1360-1381`
- **Categorie :** bug / closure
- Callback inline recreee a chaque render, closure potentiellement stale.
- **Fix :** `useCallback` avec deps correctes.

### H-5 — Sections gardees par `artisan!` crashent si `artisan` est null
- **Fichier :** `page.tsx:662+` (multiples lignes)
- **Categorie :** null safety / crash
- Non-null assertion bypass TypeScript. `pro_societe` sans `artisanData` genere un stub minimal qui peut crasher les enfants.
- **Fix :** Remplacer `artisan!` par `artisan` avec garde conditionnelle.

### H-6 — btp/route.ts POST import : aucune limite de taille sur batch insert
- **Fichier :** `app/api/btp/route.ts:138-147`
- **Categorie :** securite / perf
- Un client malveillant peut envoyer 100 000 lignes en un seul POST. Le rate limit IP ne protege pas contre un gros payload.
- **Fix :** Limiter `data.length > 500` → 400.

### H-7 — btp/route.ts POST : `data` type `z.unknown()` passe brut en DB
- **Fichier :** `app/api/btp/route.ts:10-15, 180-235`
- **Categorie :** securite / validation
- Apres parsing Zod, `data` est cast en `any` et spread dans `row = { ...data, owner_id }`. Seul `membres_btp` a une validation specifique. Les 9 autres tables acceptent des cles arbitraires.
- **Fix :** Definir des schemas Zod par table.

### H-8 — marketplace-btp GET : filtre `user_id` bypass le guard `status = active`
- **Fichier :** `app/api/marketplace-btp/route.ts:63-73`
- **Categorie :** securite / autorisation
- Avec `?user_id=UUID`, le filtre `status = active` saute. Toute personne peut enumerer les annonces inactives/supprimees d'un autre user.
- **Fix :** Exiger auth quand `user_id` fourni, verifier `user_id === user.id`.

### H-9 — marketplace-btp PUT : `ALLOWED_FIELDS` ne correspond pas aux colonnes reelles
- **Fichier :** `app/api/marketplace-btp/[id]/route.ts:56-63`
- **Categorie :** bug
- La whitelist utilise `titre`, `description` etc. mais le schema POST utilise `title`, `prix_vente`, `localisation`... Les updates ecrivent dans le vide.
- **Fix :** Aligner `ALLOWED_FIELDS` avec les vrais noms de colonnes.

### H-10 — rfq/offer POST : race condition status check + update
- **Fichier :** `app/api/rfq/offer/[token]/route.ts:40-51`
- **Categorie :** bug / race condition
- Check et update en 2 appels DB separes. Deux requetes concurrentes passent le guard.
- **Fix :** `UPDATE offers SET ... WHERE token = $1 AND status = 'pending' RETURNING *` en un seul appel.

### H-11 — GanttSection : acces `months[mi + 1]` hors bornes
- **Fichier :** `components/dashboard/btp/GanttSection.tsx:299`
- **Categorie :** bug / null-safety
- Le fallback `|| Infinity` dessine un losange parasite sur la derniere cellule.
- **Fix :** Check explicite `mi === months.length - 1`.

### H-12 — GanttSection : sous-taches orphelines silencieusement ignorees
- **Fichier :** `components/dashboard/btp/GanttSection.tsx:100-112`
- **Categorie :** bug / edge-case
- Sous-taches avec chantier inactif disparaissent du Gantt sans message.
- **Fix :** Filtrer et avertir l'utilisateur.

### H-13 — PointageEquipesSection : heures negatives clamped a 0 sans avertissement
- **Fichier :** `components/dashboard/btp/PointageEquipesSection.tsx:29`
- **Categorie :** bug / calcul
- Depart avant arrivee → 0h silencieux. Erreur de saisie invisible.
- **Fix :** Validation inline avec message d'erreur.

### H-14 — MeteoChantierSection : update Supabase direct fire-and-forget
- **Fichier :** `components/dashboard/btp/MeteoChantierSection.tsx:304`
- **Categorie :** bug / erreur
- Appel `supabase.from('chantiers_btp').update(...).then(() => {})` — erreurs completement avalees, coordonnees jamais persistees.
- **Fix :** Utiliser `update()` de `useBTPData`, gerer les erreurs.

### H-15 — RFQSection : stale state apres reload async
- **Fichier :** `components/dashboard/RFQSection.tsx:188-191`
- **Categorie :** bug / logique
- `rfqs.find(...)` utilise l'ancien state apres `loadRFQs()`. Le `setSelectedRFQ(updated)` est du dead code.
- **Fix :** Supprimer lignes 189-190, garder `setSelectedRFQ(null)`.

### H-16 — PhotosChantierSection : aucune validation MIME cote client
- **Fichier :** `components/dashboard/PhotosChantierSection.tsx:119-153`
- **Categorie :** securite / upload
- `accept="image/*"` est un hint navigateur trivial a contourner. Un `.php` renomme en `.jpg` passe.
- **Fix :** Guard `if (!file.type.startsWith('image/'))` avant upload.

### H-17 — ClientsSection : `/api/artisan-clients` appele sans token auth
- **Fichier :** `components/dashboard/ClientsSection.tsx:104-111`
- **Categorie :** securite / autorisation
- Aucun header `Authorization` envoye. Si l'API ne force pas le RLS via cookie, n'importe quel `artisan_id` est requetable.
- **Fix :** Recuperer la session Supabase et envoyer le Bearer token.

---

## MEDIUM (27)

| # | Fichier | Description |
|---|---------|-------------|
| M-1 | `page.tsx:235-236` | `DAY_NAMES`/`DAY_SHORT` recreees a chaque render (perf) |
| M-2 | `page.tsx:791-927` | ~130 lignes de messagerie legacy dans `{false && (...)}` (dead code) |
| M-3 | `page.tsx:197` | `commTab` / `setCommTab` utilises uniquement dans le dead code |
| M-4 | `page.tsx:1593-1608` | `SidebarItem` defini mais jamais utilise |
| M-5 | `page.tsx:1625-1635` | `V5SidebarItem` defini mais jamais utilise |
| M-6 | `page.tsx:243-247` | Double auth check `getSession` + `getUser` sans deduplication |
| M-7 | `useBookings.ts:113-129` | `updateBookingStatus` Supabase sans gestion d'erreur |
| M-8 | `page.tsx:519` | `JSON.parse(n.data_json)` sans try/catch dans click handler |
| M-9 | `page.tsx:474` | "Mark all read" envoie `artisan_id: undefined` si artisan null |
| M-10 | `SituationsTravaux.tsx:29` | `numero` calcule sur state local — doublon possible entre onglets |
| M-11 | `GanttSection.tsx:169` | Annee `2026` en dur dans le sous-titre |
| M-12 | `DPGFSection.tsx:45` | `padEnd(40)` desaligne les longues designations dans l'export |
| M-13 | `RetenuesGarantieSection.tsx:36` | `imminentRetenue` retourne seulement la premiere retenue imminente |
| M-14 | `MeteoChantierSection.tsx:355-364` | `chantiersAvecLocalisation` exclue des deps useEffect via eslint-disable |
| M-15 | `EquipesBTPSection.tsx:80-87` | `openEditEquipe` inconsistant avec pattern `openEditMembre` |
| M-16 | `PortailClientSection.tsx:32-38` | `CLIENT_CONTACTS` hardcode en production, jamais matche |
| M-17 | `use-btp-data.ts:457-509` | Toutes les erreurs CRUD silencieusement avalees (pas de log) |
| M-18 | `use-btp-data.ts:385-402` | `refresh` erreur retourne `[]` — declenche faux import localStorage |
| M-19 | `use-btp-data.ts:346-361` | `prefetchBTPTables` catch vide — aucun log |
| M-20 | `use-btp-data.ts:620-631` | Settings : update optimiste sans rollback en cas d'echec |
| M-21 | `dce-analyse/route.ts:45-72` | `projectDescription` sans limite de longueur — consomme tout le contexte Groq |
| M-22 | `marketplace-btp/[id]/route.ts:37` | Compteur `vues` read-modify-write (race condition, perte de vues) |
| M-23 | `auth-helpers.ts:23` | Cache token par 16 derniers chars JWT — collision possible |
| M-24 | `RapportsSection.tsx:310-313` | Numero rapport collision entre onglets navigateur |
| M-25 | `RapportsSection.tsx:255-258` | `artisanKey` change si `company_name` change → missions perdues |
| M-26 | `HomeSection.tsx:94-95` | `conversionRate` inclut pending dans le denominateur |
| M-27 | `ComptabiliteSection.tsx:508` | Seuil micro-entrepreneur 77 700 EUR au lieu de 188 700 EUR pour BTP |

---

## LOW (16)

| # | Fichier | Description |
|---|---------|-------------|
| L-1 | `page.tsx:374-376` | `initials` crash sur espaces dans `company_name` |
| L-2 | `page.tsx:1080-1090` | `onNewDevis`/`onNewRdv` callbacks non memoises |
| L-3 | `page.tsx:259` | `loadDashboardData` non `useCallback` + eslint-disable |
| L-4 | `page.tsx:1094-1158` | Sections BTP sans garde `orgRole` — acces via URL direct |
| L-5 | `page.tsx:162-166` | `document.title` mute sans cleanup |
| L-6 | `ChantiersBTPSection.tsx:61` | `Date.now().toString()` comme ID — collision sur double-clic |
| L-7 | `ChantiersBTPSection.tsx:80` | Filtre `'Termines'` ne matche jamais `'Termine'` |
| L-8 | `GanttSection.tsx:63-65` | Sous-taches en localStorage, chantiers en Supabase |
| L-9 | `MeteoChantierSection.tsx:528` | Ternaire identique des deux cotes `'v5-al'` |
| L-10 | `PointageEquipesSection.tsx:14-18` | Interface `Pointage` dans le corps de la fonction |
| L-11 | `btp/route.ts:46-85` | `table` invalide retourne 200 + objet vide |
| L-12 | `use-btp-data.ts:283,324,334` | `JSON.parse` sans try/catch sur colonnes JSON |
| L-13 | `use-btp-data.ts:648` | `watchPosition` error handler silencieux |
| L-14 | `rfq/offer/[token]/route.ts:54-62` | `offer_items` insert non await, erreur perdue |
| L-15 | `marketplace-btp/[id]/demande/route.ts:54-55` | `message` et `prix_propose` non valides |
| L-16 | Multiples fichiers | Accessibilite : 0 `aria-label` sur boutons icone, 0 `role="tablist"`, `<div onClick>` non focusables |

---

## Top 5 a corriger en priorite

1. **SEC-1 + SEC-2 + SEC-4** — rfq/offer completement ouvert sans auth ni validation → risque exploitation immediate
2. **DATA-1** — seed demo qui pollue les vrais comptes utilisateurs → experience premier login cassee
3. **SEC-3 + H-8** — marketplace fuite de donnees + bypass filtre status → donnees commerciales exposees
4. **BUG-3 + M-27** — TVA 20% en dur + seuil micro incorrect → documents legaux faux, responsabilite fiscale
5. **SEC-5** — confusion userId/artisanId dans notifications → potentielle fuite cross-user

---

## Metriques structurelles

- **Dead code identifie :** ~150 lignes (messagerie legacy, composants sidebar, etats inutilises)
- **Fichiers sans aucun test :** Tous les composants BTP (0/11 testes), toutes les API BTP (0/6 testees)
- **localStorage comme stockage primaire :** Rapports, depenses, clients manuels, sous-taches Gantt — perte silencieuse au changement de navigateur
- **Pagination absente :** Photos, clients, RFQ — pas de virtualisation pour grandes listes

---

*Audit genere automatiquement — lecture seule, aucun fichier modifie.*
