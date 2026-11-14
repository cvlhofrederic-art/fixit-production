import { isStorageReadable } from '@/lib/safe-storage'

// Synchronisation localStorage <-> table Supabase user_storage.
//
// Stratégie : les écritures du localStorage dont la clé commence par `fixit_` sont interceptées, puis envoyées par
// lots (debounce 1,5 s) à /api/user-storage. À la connexion, les entrées du compte sont rapportées du serveur dans
// le localStorage (« restauration », hydrateStorageFromServer) sans repasser par le miroir.
//
// Avantage : aucun refacto invasif des composants existants. Tout code qui appelle déjà
// `localStorage.setItem('fixit_xxx', ...)` est automatiquement synchronisé.
//
// Clés ignorées :
//  - clés ne commençant pas par `fixit_`, ou que /api/user-storage refuserait (caractères, longueur)
//  - valeurs trop volumineuses (> 5 Mo) pour rester sous la limite serveur
//  - drapeaux ponctuels type `fixit_clean_v6_*` (sans valeur métier)
//
// Quatre garanties (audit des fondations du 11/11/2026) — le serveur est la seule copie qui survit à un changement
// d'appareil, et le navigateur la seule qui contient ce qui n'est pas encore parti :
//  1. Rien n'est envoyé tant qu'une restauration n'a pas réussi pour le compte connecté. Avant, une restauration en
//     échec (réseau, 429, 500) laissait partir les écritures du montage — jeux par défaut compris — par-dessus les
//     vraies données du serveur. La restauration est retentée seule (5 s, 15 s, 1 min, puis toutes les 5 min).
//  2. Une modification locale pas encore confirmée par le serveur n'est plus effacée par la restauration suivante
//     (elle a lieu à chaque retour sur l'onglet), tant que le serveur détient encore la valeur d'avant cette
//     modification. S'il en détient une autre (écrite depuis un autre appareil), le serveur gagne, comme avant.
//     Ces modifications en attente sont notées dans le navigateur (CLE_ETAT) pour survivre à un rechargement.
//  3. Un envoi en échec (réseau ou réponse d'erreur) est retenté seul, et une valeur refusée par le serveur ne
//     bloque plus les autres valeurs du même envoi.
//  4. Ce qui attend l'envoi ne part jamais avec le jeton d'un autre compte, et un compte qui se connecte sur un
//     navigateur déjà utilisé par un autre ne reçoit pas d'office les données restées dans ce navigateur.
//
// Stockage du navigateur (lot 5 Sentry, lib/safe-storage.ts) : un stockage illisible (bloqué par le navigateur,
// SecurityError à la lecture de window.localStorage) coupe le miroir, la restauration et la migration. Un stockage
// plein (QuotaExceededError à l'écriture) reste lisible et les garde actifs : suppressions et réécritures qui ne
// l'agrandissent pas y réussissent encore et doivent atteindre le serveur.

// Client applicatif partagé (cookies SSR). NE PAS recréer ici un client
// @supabase/supabase-js : il lirait la session dans le localStorage (où elle
// n'est jamais présente — l'auth est en cookies), donc getToken() renverrait
// toujours null et AUCUNE donnée ne serait sauvegardée dans le cloud.
// Régression « base clients qui disparaît » (2026-06-01).
// Le jeton vient du cache tenu par les événements d'auth (lib/auth/jeton-acces.ts) : plus de getSession() à
// chaque flush, donc plus de prise du verrou d'auth partagé entre onglets (lot 1 Sentry du 28/10/2026).
import { jetonAcces } from '@/lib/auth/jeton-acces'

const FIXIT_PREFIX = 'fixit_'
// 5 MB max par cle pour absorber les cas legacy ou des fichiers sont
// stockes en base64 directement dans le localStorage : logo cabinet
// syndic, signature scannée, justificatifs Wallet (KBis, RC Pro, décennale).
// Une migration vers Supabase Storage (phase 2) est prevue pour ces cas
// afin de stocker l'URL au lieu du base64 ; en attendant, ce seuil
// genereux garantit qu'aucune donnee n'est silencieusement perdue.
const MAX_VALUE_BYTES = 5_000_000
// Lot 8 Sentry du 28/10/2026 : avec 500 ms, le chargement du dashboard pro produisait 20 POST en 10 s. Les
// écritures d'un même enchaînement partent maintenant ensemble, en un seul POST tant que la taille le permet.
const DEBOUNCE_MS = 1500
// Un POST regroupe jusqu'à FLUSH_BATCH_SIZE clés (= MAX_ENTRIES_PER_REQUEST de /api/user-storage) et
// FLUSH_BATCH_BYTES de valeurs (une clé peut peser 5 Mo : logo, signature, justificatifs en base64).
const FLUSH_BATCH_SIZE = 50
const FLUSH_BATCH_BYTES = 4_000_000
/** Règle des clés de /api/user-storage : une seule clé hors règle ferait refuser tout l'envoi qui la contient. */
const CLE_ACCEPTEE = /^fixit_[a-z0-9_-]+$/i
const LONGUEUR_MAX_CLE = 120
/** Attente avant un nouvel essai après un échec (restauration ou envoi) ; le dernier délai se répète. */
const DELAIS_REESSAI_MS = [5_000, 15_000, 60_000, 300_000]
/** État du miroir gardé dans le navigateur. Hors préfixe `fixit_` : jamais envoyé au serveur. */
const CLE_ETAT = 'vitfix_miroir_etat_v1'
/** Délai avant d'écrire l'état : un envoi normal est confirmé avant, et rien n'est alors écrit. */
const DELAI_ETAT_MS = 3_000
/** Empreinte d'une clé que le serveur ne détenait pas. */
const ABSENTE = ''

type Minuteur = ReturnType<typeof setTimeout>
type Issue = 'ok' | 'a-retenter' | 'refuse'
type EntreeAEnvoyer = { key: string; value: unknown; raw: string }

/**
 * Ce que le serveur détenait pour une clé avant une modification locale pas encore confirmée : la valeur telle
 * qu'elle était dans le navigateur (`brut`, null si la clé n'existait pas), ou seulement son empreinte quand la
 * note vient de l'état gardé dans le navigateur (rechargement, autre onglet).
 */
interface Base { brut?: string | null; empreinte?: string }

interface EtatMiroir {
  v: 1
  /** Dernier compte pour lequel le miroir a travaillé dans ce navigateur. */
  compte: string
  /** Tous les comptes vus dans ce navigateur depuis que cet état existe. */
  comptes: string[]
  /** Clés modifiées ici et pas encore confirmées par le serveur → empreinte de la valeur qu'il détenait. */
  attente: Record<string, string>
}

export interface ResultatHydratation {
  /** Valeurs rapportées du serveur dans le navigateur. */
  count: number
  /** true seulement si le serveur a répondu : un échec ne dit rien de ce qu'il contient. */
  ok: boolean
  /** Le serveur a répondu et ne détient rien pour ce compte. */
  vide: boolean
  /** Ce navigateur a déjà servi à un autre compte : ce qu'il contient n'appartient peut-être pas à celui-ci. */
  autreCompte: boolean
}

const SANS_RESTAURATION: ResultatHydratation = { count: 0, ok: false, vide: false, autreCompte: false }

const pendingWrites = new Map<string, string>()
const pendingDeletes = new Set<string>()
let flushTimer: Minuteur | null = null
let installed = false

// Dernière valeur envoyée au serveur (ou reçue de lui) par clé : une valeur identique n'est pas renvoyée.
const derniereValeurSynchronisee = new Map<string, string>()
// setItem d'origine, capturé à l'installation du miroir : l'hydratation écrit sans repasser par le miroir
// (avant, chaque valeur reçue du serveur repartait en POST 500 ms plus tard).
let ecrireSansMiroirRef: ((key: string, value: string) => void) | null = null
// Hydratations en cours : tant qu'il y en a une, flushNow n'envoie rien (voir flushNow). Un compteur plutôt qu'un
// booléen : Providers peut lancer deux hydratations qui se chevauchent (bootstrap immédiat puis INITIAL_SESSION).
let hydratationsEnCours = 0
// POST en vol par clé, avec leur nombre (deux flush peuvent se chevaucher pour une même clé) : renseigné au départ
// du POST, vidé à sa réponse, succès ou échec. Voir enregistrerEcritureMiroir.
const postsEnVol = new Map<string, number>()

// Modifications locales pas encore confirmées par le serveur (garantie 2).
const bases = new Map<string, Base>()
// Clés confirmées (ou reprises du serveur) depuis la dernière écriture de l'état : à retirer de ses notes.
const confirmees = new Set<string>()
// Valeurs que le serveur a refusées (trop volumineuses, invalides) : inutile de renvoyer la même.
const refusees = new Map<string, string>()
// Compte pour lequel le miroir travaille, lu dans le jeton d'accès ; null tant qu'aucun jeton lisible n'a été vu.
let compteCourant: string | null = null
// Une restauration a réussi pour ce compte depuis le chargement de la page : les envois sont permis (garantie 1).
let amorce = false
let echecsHydratation = 0
let hydratationARetenter = false
let minuteurHydratation: Minuteur | null = null
let echecsEnvoi = 0
let minuteurReessai: Minuteur | null = null
let minuteurEtat: Minuteur | null = null
const avertissementsFaits = new Set<string>()

function avertirUneFois(cle: string, message: string, detail?: unknown): void {
  if (avertissementsFaits.has(cle)) return
  avertissementsFaits.add(cle)
  if (detail === undefined) console.warn(message)
  else console.warn(message, detail)
}

function arreter(minuteur: Minuteur | null): null {
  if (minuteur) clearTimeout(minuteur)
  return null
}

function delaiDeReessai(echecs: number): number {
  return DELAIS_REESSAI_MS[Math.min(Math.max(echecs, 1), DELAIS_REESSAI_MS.length) - 1]
}

function marquerEnVol(keys: string[]): void {
  for (const k of keys) postsEnVol.set(k, (postsEnVol.get(k) ?? 0) + 1)
}

function libererEnVol(keys: string[]): void {
  for (const k of keys) {
    const restants = (postsEnVol.get(k) ?? 0) - 1
    if (restants > 0) postsEnVol.set(k, restants)
    else postsEnVol.delete(k)
  }
}

function ecrireSansMiroir(key: string, value: string): void {
  if (ecrireSansMiroirRef) ecrireSansMiroirRef(key, value)
  else window.localStorage.setItem(key, value)
}

/** Valeur actuelle de la clé dans le localStorage ; undefined s'il est illisible (stockage bloqué). */
function valeurLocale(key: string): string | null | undefined {
  try {
    return window.localStorage.getItem(key)
  } catch (error) {
    console.warn('[storage-sync] localStorage illisible :', error)
    return undefined
  }
}

async function getToken(): Promise<string | null> {
  try {
    return await jetonAcces()
  } catch {
    return null
  }
}

/**
 * Compte (identifiant d'utilisateur) inscrit dans un jeton d'accès Supabase, ou null s'il n'est pas lisible. Sert
 * seulement à savoir à qui appartient ce qui attend dans ce navigateur : le serveur, lui, vérifie le jeton.
 */
function compteDuJeton(jeton: string): string | null {
  try {
    const charge = jeton.split('.')[1]
    if (!charge) return null
    const donnees = JSON.parse(atob(charge.replaceAll('-', '+').replaceAll('_', '/'))) as { sub?: unknown }
    return typeof donnees.sub === 'string' && donnees.sub !== '' ? donnees.sub : null
  } catch {
    // Jeton sans charge lisible : le miroir fonctionne, sans suivi de compte.
    return null
  }
}

async function identite(): Promise<{ jeton: string; compte: string | null } | null> {
  const jeton = await getToken()
  return jeton ? { jeton, compte: compteDuJeton(jeton) } : null
}

/**
 * Note le compte connecté. S'il remplace un autre compte dans la même page, tout ce qui attendait appartenait au
 * précédent : rien ne doit partir avec le nouveau jeton (garantie 4). Renvoie true dans ce cas.
 */
function adopterCompte(compte: string | null): boolean {
  if (compte === null || compte === compteCourant) return false
  const remplacement = compteCourant !== null
  if (remplacement) {
    pendingWrites.clear()
    pendingDeletes.clear()
    bases.clear()
    confirmees.clear()
    refusees.clear()
    derniereValeurSynchronisee.clear()
    flushTimer = arreter(flushTimer)
    minuteurEtat = arreter(minuteurEtat)
  }
  minuteurReessai = arreter(minuteurReessai)
  minuteurHydratation = arreter(minuteurHydratation)
  compteCourant = compte
  amorce = false
  echecsHydratation = 0
  echecsEnvoi = 0
  return remplacement
}

function shouldSync(key: string): boolean {
  if (!key.startsWith(FIXIT_PREFIX)) return false
  // On exclut quelques flags transitoires qui ne portent aucune valeur metier
  // et seraient juste du bruit DB (et causeraient des cycles entre devices
  // si le flag de migration etait synchronise).
  if (key.startsWith('fixit_clean_v')) return false
  if (key === 'fixit_btp_local_migrated_v1') return false
  if (key === 'fixit_user_storage_migrated_v1') return false
  if (key.length > LONGUEUR_MAX_CLE || !CLE_ACCEPTEE.test(key)) {
    avertirUneFois(`cle:${key}`, '[storage-sync] clé non sauvegardée en ligne (caractères ou longueur refusés par le serveur) :', key)
    return false
  }
  return true
}

// ── Empreintes : comparer ce que détient le serveur à ce que cet appareil en savait ──────────────────────────────

/** Valeur telle qu'elle part au serveur : le JSON lu, ou le texte brut s'il n'en est pas. */
function versServeur(brut: string): unknown {
  try { return JSON.parse(brut) } catch { return brut }
}

function comparerCles(a: string, b: string): number {
  if (a < b) return -1
  return a > b ? 1 : 0
}

/** JSON à clés triées : la base range les objets dans son propre ordre, deux écritures égales doivent se reconnaître. */
function canonique(valeur: unknown): string {
  if (Array.isArray(valeur)) return `[${valeur.map(canonique).join(',')}]`
  if (valeur !== null && typeof valeur === 'object') {
    const objet = valeur as Record<string, unknown>
    const champs = Object.keys(objet).sort(comparerCles).map(cle => `${JSON.stringify(cle)}:${canonique(objet[cle])}`)
    return `{${champs.join(',')}}`
  }
  return JSON.stringify(valeur) ?? 'null'
}

/** Condensé non cryptographique (cyrb53) : sert à reconnaître une valeur, pas à la protéger. */
function condenser(texte: string): string {
  let h1 = 0xdeadbeef
  let h2 = 0x41c6ce57
  for (let i = 0; i < texte.length; i++) {
    const code = texte.charCodeAt(i)
    h1 = Math.imul(h1 ^ code, 2654435761)
    h2 = Math.imul(h2 ^ code, 1597334677)
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909)
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909)
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36)
}

function empreinteDeValeur(valeur: unknown): string {
  const texte = canonique(valeur)
  return `${texte.length.toString(36)}.${condenser(texte)}`
}

function empreinteDeBase(base: Base): string {
  if (base.empreinte === undefined) base.empreinte = typeof base.brut === 'string' ? empreinteDeValeur(versServeur(base.brut)) : ABSENTE
  return base.empreinte
}

/** Le serveur détient-il encore la valeur que cet appareil lui connaissait avant la modification locale ? */
function serveurDetientEncore(base: Base, valeur: unknown, enTexte: string): boolean {
  if (base.brut === enTexte) return true
  const attendue = empreinteDeBase(base)
  return attendue !== ABSENTE && attendue === empreinteDeValeur(valeur)
}

// ── État gardé dans le navigateur : compte et modifications en attente ───────────────────────────────────────────

function lireEtat(): EtatMiroir | null {
  const brut = valeurLocale(CLE_ETAT)
  if (!brut) return null
  try {
    const lu = JSON.parse(brut) as Partial<EtatMiroir> | null
    if (!lu || lu.v !== 1 || typeof lu.compte !== 'string' || !Array.isArray(lu.comptes)) return null
    if (!lu.attente || typeof lu.attente !== 'object') return null
    const attente = Object.fromEntries(Object.entries(lu.attente).filter(([, empreinte]) => typeof empreinte === 'string'))
    return { v: 1, compte: lu.compte, comptes: lu.comptes.filter(c => typeof c === 'string'), attente }
  } catch {
    // État illisible : on repart sans notes, comme sur un navigateur neuf.
    return null
  }
}

/**
 * Écrit l'état si quelque chose a changé : le compte courant, et les clés encore en attente de confirmation. Les
 * notes d'un autre onglet du même compte sont conservées ; celles d'un autre compte sont abandonnées.
 */
function synchroniserEtat(): void {
  minuteurEtat = arreter(minuteurEtat)
  const compte = compteCourant
  if (compte === null || typeof window === 'undefined') return
  const actuel = lireEtat()
  const gardees = actuel?.compte === compte ? Object.entries(actuel.attente).filter(([cle]) => !confirmees.has(cle)) : []
  confirmees.clear()
  const attente = Object.fromEntries(gardees)
  for (const [cle, base] of bases) attente[cle] = empreinteDeBase(base)
  const suivant: EtatMiroir = { v: 1, compte, comptes: Array.from(new Set([...(actuel?.comptes ?? []), compte])), attente }
  if (actuel && JSON.stringify(actuel) === JSON.stringify(suivant)) return
  try {
    ecrireSansMiroir(CLE_ETAT, JSON.stringify(suivant))
  } catch (erreur) {
    // Stockage plein : les notes restent en mémoire pour cette page, elles ne survivront pas à un rechargement.
    avertirUneFois('etat', '[storage-sync] état du miroir non enregistré dans le navigateur :', erreur)
  }
}

function planifierEtat(): void {
  if (minuteurEtat || compteCourant === null) return
  minuteurEtat = setTimeout(() => { minuteurEtat = null; synchroniserEtat() }, DELAI_ETAT_MS)
}

function oublierBase(key: string): void {
  if (!bases.delete(key)) return
  confirmees.add(key)
  planifierEtat()
}

/**
 * Première modification non confirmée d'une clé : on retient ce que le serveur détenait alors, pour autant que cet
 * appareil le sache — la valeur du navigateur juste avant l'écriture (celle du serveur sur un appareil à jour),
 * sinon la dernière valeur synchronisée, sinon rien (clé tenue pour absente du serveur).
 */
function noterBase(key: string, avant: string | null | undefined): void {
  if (bases.has(key)) return
  const connue = avant === undefined ? derniereValeurSynchronisee.get(key) : avant
  bases.set(key, { brut: connue ?? null })
  planifierEtat()
}

// ── Envois ───────────────────────────────────────────────────────────────────────────────────────────────────────

async function appeler(methode: 'POST' | 'DELETE', corps: string, jeton: string, keepalive: boolean): Promise<Issue> {
  try {
    const res = await fetch('/api/user-storage', {
      method: methode,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${jeton}` },
      body: corps,
      keepalive,
    })
    if (res.ok) return 'ok'
    // 400, 413, 422 : le serveur refuse le contenu, le renvoyer tel quel n'y changera rien. Le reste (401, 429, 5xx)
    // est passager.
    return res.status === 400 || res.status === 413 || res.status === 422 ? 'refuse' : 'a-retenter'
  } catch {
    // Erreur réseau : le localStorage reste la source opérationnelle, l'envoi sera retenté.
    return 'a-retenter'
  }
}

function poster(lot: EntreeAEnvoyer[], jeton: string, keepalive: boolean): Promise<Issue> {
  const corps = JSON.stringify({ entries: lot.map(e => ({ key: e.key, value: e.value })) })
  // keepalive: true survit au unload. Necessaire pour beforeunload + tablette
  // qui ferme la session avant la fin de la requete. Limite navigateur ~64 KB
  // par requete keepalive — au-dela on retire keepalive (le user verra ses
  // donnees au prochain login via hydrate).
  return appeler('POST', corps, jeton, keepalive && corps.length < 60_000)
}

/** Le serveur détient maintenant cette valeur. */
function confirmerEcriture(e: EntreeAEnvoyer): void {
  derniereValeurSynchronisee.set(e.key, e.raw)
  // Une valeur plus récente attend déjà : elle se mesurera à celle qui vient d'arriver au serveur.
  if (pendingWrites.has(e.key) || pendingDeletes.has(e.key)) bases.set(e.key, { brut: e.raw })
  else oublierBase(e.key)
}

function refuserEcriture(e: EntreeAEnvoyer): void {
  refusees.set(e.key, e.raw)
  avertirUneFois(`refus:${e.key}`, '[storage-sync] valeur refusée par le serveur, elle reste dans ce navigateur seulement :', e.key)
}

/**
 * Remet une écriture en attente après un envoi en échec, sauf si la clé a changé depuis (réécrite, supprimée, ou
 * remplacée par l'hydratation) : la valeur plus récente a son propre envoi, l'ancienne l'écraserait (aller-retour
 * A → B → A pendant un POST de B en échec).
 */
function remettreEnAttente(e: EntreeAEnvoyer): void {
  if (valeurLocale(e.key) === e.raw) pendingWrites.set(e.key, e.raw)
}

/** Envoie un lot ; renvoie true si une partie devra être retentée. */
async function envoyerLot(lot: EntreeAEnvoyer[], jeton: string, keepalive: boolean, compte: string | null): Promise<boolean> {
  const cles = lot.map(e => e.key)
  let aRetenter = false
  marquerEnVol(cles)
  try {
    const issue = await poster(lot, jeton, keepalive)
    const issues: Array<[EntreeAEnvoyer, Issue]> = []
    if (issue === 'refuse' && lot.length > 1) {
      // Une valeur refusée ne doit pas bloquer les autres : chacune repart seule, une fois.
      for (const e of lot) issues.push([e, await poster([e], jeton, keepalive)])
    } else {
      for (const e of lot) issues.push([e, issue])
    }
    // Un autre compte s'est connecté pendant l'envoi : plus rien de cet envoi ne le concerne.
    if (compteCourant !== compte) return false
    for (const [e, resultat] of issues) {
      if (resultat === 'ok') confirmerEcriture(e)
      else if (resultat === 'refuse') refuserEcriture(e)
      else {
        remettreEnAttente(e)
        aRetenter = true
      }
    }
  } finally {
    libererEnVol(cles)
  }
  return aRetenter
}

/** Envoie les suppressions en attente ; renvoie true si elles devront être retentées. */
async function envoyerSuppressions(jeton: string, keepalive: boolean, compte: string | null): Promise<boolean> {
  const cles = Array.from(pendingDeletes)
  pendingDeletes.clear()
  let aRetenter = false
  for (let debut = 0; debut < cles.length; debut += FLUSH_BATCH_SIZE) {
    const lot = cles.slice(debut, debut + FLUSH_BATCH_SIZE)
    const issue = await appeler('DELETE', JSON.stringify({ keys: lot }), jeton, keepalive)
    if (compteCourant !== compte) return false
    for (const cle of lot) {
      // La clé a été réécrite pendant l'appel : son écriture a son propre envoi.
      if (pendingWrites.has(cle)) {
        if (issue === 'ok') bases.set(cle, { brut: null })
        continue
      }
      if (issue === 'ok') oublierBase(cle)
      else if (issue === 'a-retenter') pendingDeletes.add(cle)
    }
    if (issue === 'a-retenter') aRetenter = true
    else if (issue === 'refuse') avertirUneFois('refus-suppression', '[storage-sync] suppression refusée par le serveur :', lot)
  }
  return aRetenter
}

function planifierReessai(): void {
  minuteurReessai = arreter(minuteurReessai)
  minuteurReessai = setTimeout(() => {
    minuteurReessai = null
    void flushNow()
  }, delaiDeReessai(echecsEnvoi))
}

function planifierNouvelleHydratation(): void {
  if (minuteurHydratation) return
  const delai = delaiDeReessai(echecsHydratation)
  if (echecsHydratation > 0) {
    console.warn(`[storage-sync] restauration depuis le serveur impossible, nouvel essai dans ${delai / 1000} s ; rien n'est envoyé d'ici là`)
  }
  minuteurHydratation = setTimeout(() => {
    minuteurHydratation = null
    void hydrateStorageFromServer()
  }, delai)
}

async function flushNow(opts: { keepalive?: boolean } = {}): Promise<void> {
  // Rien ne part pendant l'hydratation : une écriture faite au montage avant la réponse du serveur (jeu par défaut
  // de la bibliothèque ou des prestations, données de démo) écraserait la vraie valeur, saisie sur un autre appareil.
  // L'envoi keepalive de fermeture d'onglet est retenu lui aussi, par choix : si l'onglet se ferme avant la réponse,
  // ces écritures restent dans le localStorage et dans les notes du miroir, et repartiront à la prochaine visite.
  if (hydratationsEnCours > 0) return
  if (pendingWrites.size === 0 && pendingDeletes.size === 0) return
  // Un nouvel essai est déjà programmé après un échec : pas d'envoi à chaque frappe pendant une panne. L'envoi de
  // fermeture d'onglet, lui, tente sa chance.
  if (minuteurReessai && !opts.keepalive) return
  const qui = await identite()
  if (!qui) return
  if (adopterCompte(qui.compte)) return
  // Garantie 1 : tant que la restauration n'a pas réussi pour ce compte, on ne sait pas ce que détient le serveur.
  if (!amorce) {
    if (hydratationsEnCours === 0) planifierNouvelleHydratation()
    return
  }
  // Une hydratation a pu commencer pendant la lecture du jeton.
  if (hydratationsEnCours > 0) return

  const compte = compteCourant
  const ecritures: EntreeAEnvoyer[] = []
  for (const [key, raw] of pendingWrites) {
    const entree = { key, value: versServeur(raw), raw }
    let envoyable = false
    try { envoyable = JSON.stringify(entree.value).length <= MAX_VALUE_BYTES } catch { envoyable = false }
    if (envoyable) ecritures.push(entree)
    else refuserEcriture(entree)
  }
  // On vide IMMEDIATEMENT pour ne pas re-emettre les memes entrees si une
  // ecriture survient pendant l'await (perte d'idempotence sinon).
  pendingWrites.clear()

  let aRetenter = false
  // Un seul POST avec toutes les clés modifiées, tant que le nombre et la taille le permettent.
  for (const lot of grouperEnLots(ecritures)) {
    if (await envoyerLot(lot, qui.jeton, opts.keepalive === true, compte)) aRetenter = true
    if (compteCourant !== compte) return
  }
  if (pendingDeletes.size > 0) {
    if (await envoyerSuppressions(qui.jeton, opts.keepalive === true, compte)) aRetenter = true
    if (compteCourant !== compte) return
  }

  if (aRetenter) {
    echecsEnvoi++
    planifierReessai()
  } else {
    echecsEnvoi = 0
    minuteurReessai = arreter(minuteurReessai)
  }
}

function scheduleFlush() {
  if (flushTimer) clearTimeout(flushTimer)
  flushTimer = setTimeout(() => { flushNow() }, DEBOUNCE_MS)
}

/**
 * Cœur du miroir, appelé par le setItem intercepté. Une valeur identique à la dernière synchronisée n'est pas
 * renvoyée (lot 8 Sentry : réécritures à l'identique au montage du dashboard), sauf si une autre valeur de la clé
 * attend son envoi ou est en cours d'envoi : sinon l'aller-retour A → B → A (double-clic sur une bascule) enverrait
 * B, ou laisserait B au serveur au retour de son POST.
 * `avant` : valeur de la clé dans le navigateur juste avant l'écriture (null si elle n'existait pas) ; sans elle, la
 * clé est tenue pour inconnue du serveur. Exporté pour les tests.
 */
export function enregistrerEcritureMiroir(key: string, value: string, avant?: string | null): void {
  if (!shouldSync(key)) return
  if (derniereValeurSynchronisee.get(key) === value && !pendingWrites.has(key) && !postsEnVol.has(key) && !bases.has(key)) return
  noterBase(key, avant)
  if (refusees.get(key) !== value) refusees.delete(key)
  pendingWrites.set(key, value)
  pendingDeletes.delete(key) // annule un eventuel delete en attente
  scheduleFlush()
}

/** Cœur du miroir pour removeItem : la clé sera renvoyée si elle est réécrite ensuite. */
export function enregistrerSuppressionMiroir(key: string, avant?: string | null): void {
  if (!shouldSync(key)) return
  noterBase(key, avant)
  derniereValeurSynchronisee.delete(key)
  refusees.delete(key)
  pendingDeletes.add(key)
  pendingWrites.delete(key)
  scheduleFlush()
}

/** Lots d'envoi : jusqu'à FLUSH_BATCH_SIZE clés et FLUSH_BATCH_BYTES de valeurs par POST (un seul lot en général). */
function grouperEnLots(entries: EntreeAEnvoyer[]): EntreeAEnvoyer[][] {
  const lots: EntreeAEnvoyer[][] = []
  let tailleLot = 0
  for (const e of entries) {
    const dernier = lots[lots.length - 1]
    if (dernier && dernier.length < FLUSH_BATCH_SIZE && tailleLot + e.raw.length <= FLUSH_BATCH_BYTES) {
      dernier.push(e)
      tailleLot += e.raw.length
    } else {
      lots.push([e])
      tailleLot = e.raw.length
    }
  }
  return lots
}

// ── Restauration depuis le serveur ───────────────────────────────────────────────────────────────────────────────

/** Remet en attente d'envoi la valeur actuelle du navigateur pour cette clé (ou sa suppression). */
function remettreLaValeurLocaleEnAttente(key: string, locale: string | null | undefined = valeurLocale(key)): void {
  if (locale === undefined) return
  if (locale === null) {
    pendingWrites.delete(key)
    pendingDeletes.add(key)
    return
  }
  if (refusees.get(key) === locale) return
  pendingDeletes.delete(key)
  pendingWrites.set(key, locale)
}

/**
 * Garantie 2 : la valeur du navigateur est gardée (et renvoyée) si elle porte une modification pas encore confirmée
 * ET que le serveur détient toujours la valeur d'avant cette modification. `noteAilleurs` : empreinte notée par un
 * autre onglet, ou avant un rechargement.
 */
function garderLaValeurLocale(key: string, valeur: unknown, enTexte: string, noteAilleurs: string | undefined): boolean {
  const base = bases.get(key)
  if (!base && noteAilleurs === undefined) return false
  const locale = valeurLocale(key)
  // Stockage illisible, ou valeur déjà identique à celle du serveur : rien à garder ni à envoyer.
  if (locale === undefined || locale === enTexte) return false
  const inchange = (base !== undefined && serveurDetientEncore(base, valeur, enTexte))
    || (noteAilleurs !== undefined && noteAilleurs !== ABSENTE && noteAilleurs === empreinteDeValeur(valeur))
  // Le serveur détient autre chose que ce que cet appareil lui connaissait : écrit ailleurs entre-temps, il gagne.
  if (!inchange) return false
  if (!base) bases.set(key, { empreinte: noteAilleurs })
  remettreLaValeurLocaleEnAttente(key, locale)
  return true
}

/**
 * Hydrate le localStorage depuis la DB pour l'utilisateur connecte.
 * Providers l'appelle après installStorageSync() : les valeurs reçues sont écrites sans repasser par le miroir. Le
 * serveur gagne, sauf pour une clé modifiée ici dont il détient toujours l'ancienne valeur (voir
 * garderLaValeurLocale). Les envois sont retenus jusqu'à la fin ; ils ne commencent qu'après une restauration
 * réussie pour ce compte, et un échec (réseau, 429, 500) est retenté seul.
 */
export async function hydrateStorageFromServer(): Promise<ResultatHydratation> {
  // Lisible suffit : un stockage plein accepte encore toute valeur qui ne l'agrandit pas (entrées inchangées depuis la
  // dernière synchronisation, valeurs raccourcies sur un autre appareil) ; une écriture refusée est ignorée plus bas.
  if (typeof window === 'undefined' || !isStorageReadable('local')) return { ...SANS_RESTAURATION }
  hydratationsEnCours++
  try {
    return await hydraterDepuisLeServeur()
  } finally {
    hydratationsEnCours--
    if (hydratationsEnCours === 0) {
      if (amorce) {
        hydratationARetenter = false
        synchroniserEtat()
        // Clés absentes du serveur, modifications gardées : l'envoi retenu est relancé.
        if (pendingWrites.size > 0 || pendingDeletes.size > 0) scheduleFlush()
      } else {
        // Restauration en échec : ce qui a été modifié ici reste noté dans le navigateur, pour la prochaine visite.
        if (bases.size > 0) planifierEtat()
        if (hydratationARetenter) {
          hydratationARetenter = false
          planifierNouvelleHydratation()
        }
      }
    }
  }
}

function echecDeRestauration(): ResultatHydratation {
  echecsHydratation++
  hydratationARetenter = true
  return { ...SANS_RESTAURATION }
}

async function hydraterDepuisLeServeur(): Promise<ResultatHydratation> {
  // Pas de session : rien à restaurer, et rien à retenter.
  const qui = await identite()
  if (!qui) return { ...SANS_RESTAURATION }
  adopterCompte(qui.compte)
  const compte = compteCourant

  let entries: Record<string, unknown>
  try {
    const res = await fetch('/api/user-storage', {
      headers: { Authorization: `Bearer ${qui.jeton}` },
    })
    if (!res.ok) return echecDeRestauration()
    const json = await res.json() as { entries?: Record<string, unknown> }
    entries = json.entries || {}
  } catch {
    return echecDeRestauration()
  }
  // Un autre compte s'est connecté pendant l'appel : cette réponse ne le concerne pas.
  if (compteCourant !== compte) return { ...SANS_RESTAURATION }

  const etat = lireEtat()
  const autreCompte = compte !== null && (etat?.comptes ?? []).some(c => c !== compte)
  const notesAilleurs: Record<string, string> = compte !== null && etat?.compte === compte ? etat.attente : {}
  const noteDe = (key: string): string | undefined => (Object.prototype.hasOwnProperty.call(notesAilleurs, key) ? notesAilleurs[key] : undefined)

  let count = 0
  let ecrituresRefusees = 0
  for (const [key, value] of Object.entries(entries)) {
    // On ecrit la valeur en string. Si c'est deja une primitive (string),
    // on la stocke telle quelle ; sinon JSON.stringify.
    const enTexte = typeof value === 'string' ? value : JSON.stringify(value)
    if (garderLaValeurLocale(key, value, enTexte, noteDe(key))) continue
    // Le serveur gagne : une écriture faite au montage avant la réponse (jeu par défaut, données de démo) ne part
    // pas écraser la vraie valeur. Retirée avant l'écriture locale, qui peut échouer (quota).
    pendingWrites.delete(key)
    pendingDeletes.delete(key)
    bases.delete(key)
    confirmees.add(key)
    try {
      // setItem d'origine : une valeur reçue du serveur ne doit jamais repartir en POST (lot 8 Sentry :
      // Providers installe le miroir avant d'hydrater, chaque clé hydratée était renvoyée).
      ecrireSansMiroir(key, enTexte)
      derniereValeurSynchronisee.set(key, enTexte)
      count++
    } catch {
      // Stockage plein : la valeur du navigateur reste en place.
      ecrituresRefusees++
    }
  }
  if (ecrituresRefusees > 0) console.warn(`[storage-sync] ${ecrituresRefusees} valeur(s) du serveur non écrite(s) dans ce navigateur (stockage plein)`)

  // Modifications d'ici que le serveur ne détient pas du tout (clé créée dans ce navigateur, jamais partie) : elles
  // partent, comme avant.
  for (const key of new Set([...bases.keys(), ...Object.keys(notesAilleurs)])) {
    if (Object.prototype.hasOwnProperty.call(entries, key)) continue
    if (!bases.has(key)) bases.set(key, { empreinte: notesAilleurs[key] })
    remettreLaValeurLocaleEnAttente(key)
  }

  amorce = true
  echecsHydratation = 0
  minuteurHydratation = arreter(minuteurHydratation)
  // Le serveur répond : un envoi mis en attente après un échec peut repartir sans attendre son délai.
  echecsEnvoi = 0
  minuteurReessai = arreter(minuteurReessai)
  return { count, ok: true, vide: Object.keys(entries).length === 0, autreCompte }
}

// ── Interception des écritures ───────────────────────────────────────────────────────────────────────────────────

interface RegistreMiroir {
  prototype: Storage
  stockage: Storage
  setItem: Storage['setItem']
  removeItem: Storage['removeItem']
  getItem: Storage['getItem']
  surEcriture: ((key: string, value: string, avant: string | null | undefined) => void) | null
  surSuppression: ((key: string, avant: string | null | undefined) => void) | null
}

const CLE_REGISTRE = '__vitfixMiroirStockage'

function registreGlobal(): Record<string, RegistreMiroir | undefined> {
  return globalThis as unknown as Record<string, RegistreMiroir | undefined>
}

/** Faut-il lire la valeur d'avant l'écriture ? Seulement pour une clé suivie qui n'a pas déjà de modification notée. */
function valeurAvant(lire: () => string | null, key: string): string | null | undefined {
  if (bases.has(key) || !shouldSync(key)) return undefined
  try {
    return lire()
  } catch {
    // Lecture refusée : la clé sera tenue pour inconnue du serveur.
    return undefined
  }
}

/**
 * Remplace setItem / removeItem sur Storage.prototype, pour le seul localStorage. Affecter
 * `localStorage.setItem = …` ne marche que sur Chromium : la norme (suivie par Firefox et par jsdom) y voit
 * l'enregistrement d'une entrée nommée « setItem », et aucune écriture n'était alors sauvegardée en ligne.
 * Le remplacement n'est posé qu'une fois par page, même si le module est rechargé : seuls les rappels changent.
 */
function intercepterLePrototype(stockage: Storage): void {
  const prototype = Storage.prototype
  let registre = registreGlobal()[CLE_REGISTRE]
  if (!registre || registre.prototype !== prototype) {
    const neuf: RegistreMiroir = {
      prototype,
      stockage,
      setItem: prototype.setItem,
      removeItem: prototype.removeItem,
      getItem: prototype.getItem,
      surEcriture: null,
      surSuppression: null,
    }
    // Appel incomplet, autre stockage (sessionStorage) ou miroir débranché : la fonction d'origine, telle quelle.
    prototype.setItem = function setItem(this: Storage, ...args: string[]): void {
      if (this !== neuf.stockage || !neuf.surEcriture || args.length < 2) {
        neuf.setItem.apply(this, args as [string, string])
        return
      }
      const key = String(args[0])
      const value = String(args[1])
      const avant = valeurAvant(() => neuf.getItem.call(this, key), key)
      neuf.setItem.call(this, key, value)
      neuf.surEcriture(key, value, avant)
    }
    prototype.removeItem = function removeItem(this: Storage, ...args: string[]): void {
      if (this !== neuf.stockage || !neuf.surSuppression || args.length < 1) {
        neuf.removeItem.apply(this, args as [string])
        return
      }
      const key = String(args[0])
      const avant = valeurAvant(() => neuf.getItem.call(this, key), key)
      neuf.removeItem.call(this, key)
      neuf.surSuppression(key, avant)
    }
    registreGlobal()[CLE_REGISTRE] = neuf
    registre = neuf
  }
  const actif = registre
  actif.stockage = stockage
  actif.surEcriture = enregistrerEcritureMiroir
  actif.surSuppression = enregistrerSuppressionMiroir
  ecrireSansMiroirRef = (key, value) => { actif.setItem.call(stockage, key, value) }
}

/** Stockage qui n'est pas un vrai Storage (double de test) : le remplacement se fait sur l'objet lui-même. */
function intercepterLObjet(stockage: Storage): void {
  const origSet = stockage.setItem.bind(stockage)
  const origRemove = stockage.removeItem.bind(stockage)
  ecrireSansMiroirRef = origSet

  stockage.setItem = (key: string, value: string) => {
    const avant = valeurAvant(() => stockage.getItem(key), key)
    origSet(key, value)
    enregistrerEcritureMiroir(key, value, avant)
  }

  stockage.removeItem = (key: string) => {
    const avant = valeurAvant(() => stockage.getItem(key), key)
    origRemove(key)
    enregistrerSuppressionMiroir(key, avant)
  }
}

/** Fermeture ou mise en arrière-plan de l'onglet : dernière chance d'envoyer, et de noter ce qui n'est pas parti. */
function avantDeQuitter(): void {
  if (pendingWrites.size > 0 || pendingDeletes.size > 0) {
    try { void flushNow({ keepalive: true }) } catch { /* ignore */ }
  }
  if (bases.size > 0 || confirmees.size > 0) synchroniserEtat()
}

/** Le réseau revient : on n'attend pas le prochain essai programmé. */
function reprendre(): void {
  if (!amorce) {
    if (compteCourant === null && pendingWrites.size === 0 && pendingDeletes.size === 0) return
    minuteurHydratation = arreter(minuteurHydratation)
    void hydrateStorageFromServer()
    return
  }
  minuteurReessai = arreter(minuteurReessai)
  void flushNow()
}

/**
 * Installe le miroir : intercepte localStorage.setItem / removeItem pour
 * mirroir vers la DB en debounce. Idempotent (safe si rappele).
 */
export function installStorageSync(): void {
  if (typeof window === 'undefined') return
  if (installed) return
  installed = true

  // Stockage bloqué par le navigateur (réglage « bloquer les données des sites », iframe sandboxée, certaines
  // webviews) : la simple lecture de window.localStorage lève une SecurityError. Appelé sur chaque page par
  // Providers : sans ce garde, ces visiteurs tombaient sur une erreur (Sentry G, S). Pas de miroir possible, le site
  // reste utilisable. Un stockage plein ou en lecture seule reste lisible : le miroir est posé, car suppressions et
  // réécritures plus courtes y réussissent et doivent être répliquées ; une écriture refusée lève comme sans miroir
  // et n'est pas répliquée.
  if (!isStorageReadable('local')) {
    console.warn('[storage-sync] localStorage inaccessible, miroir désactivé :', 'lecture du stockage impossible (bloqué par le navigateur ou absent)')
    return
  }

  try {
    const stockage = window.localStorage
    if (typeof Storage !== 'undefined' && stockage instanceof Storage) intercepterLePrototype(stockage)
    else intercepterLObjet(stockage)
  } catch (error) {
    // Objet Storage non modifiable (navigateur exotique) : pas de miroir, mais aucune erreur pour le visiteur.
    console.warn('[storage-sync] miroir non installé :', error)
    return
  }

  // Flush a la fermeture de l'onglet pour ne pas perdre les pending writes.
  // Utilisation de fetch keepalive: true qui survit au unload (vs un POST
  // classique annule par le navigateur).
  window.addEventListener('beforeunload', avantDeQuitter)
  // Idem pour visibilitychange (mobile : l'onglet est mis en arriere-plan,
  // pas forcement de beforeunload).
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') avantDeQuitter()
  })
  window.addEventListener('online', reprendre)
}

/**
 * Push tout le localStorage `fixit_*` actuel vers la DB (one-shot).
 * Utile pour la migration des comptes existants : a la 1re hydration
 * apres deploy, si la DB renvoie 0 entrees mais le localStorage en a,
 * on remonte tout. Providers ne l'appelle que si le serveur a répondu « rien » et que ce navigateur n'a servi à
 * aucun autre compte.
 */
export async function pushAllLocalToServer(): Promise<{ count: number }> {
  // Lecture seule : un stockage plein (QuotaExceededError à l'écriture) se lit encore et doit pouvoir migrer.
  if (typeof window === 'undefined' || !isStorageReadable('local')) return { count: 0 }
  const qui = await identite()
  if (!qui) return { count: 0 }
  adopterCompte(qui.compte)
  const compte = compteCourant

  const keys: string[] = []
  for (let i = 0; i < window.localStorage.length; i++) {
    const k = window.localStorage.key(i)
    if (k && shouldSync(k)) keys.push(k)
  }
  if (keys.length === 0) return { count: 0 }

  const entries: EntreeAEnvoyer[] = keys.map(k => {
    const raw = window.localStorage.getItem(k) || ''
    return { key: k, value: versServeur(raw), raw }
  }).filter(e => {
    try { return JSON.stringify(e.value).length <= MAX_VALUE_BYTES } catch { return false }
  })

  let count = 0
  for (const lot of grouperEnLots(entries)) {
    const issue = await poster(lot, qui.jeton, false)
    if (compteCourant !== compte) break
    if (issue !== 'ok') continue
    count += lot.length
    for (const e of lot) confirmerEcriture(e)
  }
  return { count }
}

/** Tests : remet le miroir à neuf (files, notes, minuteurs, compte) et débranche l'interception du prototype. */
export function reinitialiserMiroirPourTests(): void {
  pendingWrites.clear()
  pendingDeletes.clear()
  bases.clear()
  confirmees.clear()
  refusees.clear()
  derniereValeurSynchronisee.clear()
  postsEnVol.clear()
  avertissementsFaits.clear()
  flushTimer = arreter(flushTimer)
  minuteurEtat = arreter(minuteurEtat)
  minuteurReessai = arreter(minuteurReessai)
  minuteurHydratation = arreter(minuteurHydratation)
  compteCourant = null
  amorce = false
  echecsHydratation = 0
  echecsEnvoi = 0
  hydratationARetenter = false
  hydratationsEnCours = 0
  installed = false
  ecrireSansMiroirRef = null
  const registre = registreGlobal()[CLE_REGISTRE]
  if (registre) {
    registre.surEcriture = null
    registre.surSuppression = null
  }
}
