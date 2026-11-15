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
// Quatre garanties (audit des fondations du 11/11/2026, relecture du 14/11/2026) — le serveur est la seule copie qui
// survit à un changement d'appareil, et le navigateur la seule qui contient ce qui n'est pas encore parti :
//  1. Rien n'est envoyé tant qu'une restauration n'a pas réussi pour le compte connecté. Avant, une restauration en
//     échec (réseau, 429, 500) laissait partir les écritures du montage — jeux par défaut compris — par-dessus les
//     vraies données du serveur. La restauration est retentée seule (5 s, 15 s, 1 min, puis toutes les 5 min). Une
//     réponse sans la liste des valeurs compte pour un échec, pas pour un serveur vide.
//  2. Une modification locale pas encore confirmée par le serveur n'est plus effacée par la restauration suivante
//     (elle a lieu à chaque retour sur l'onglet), tant que le serveur détient encore la valeur d'avant cette
//     modification. S'il en détient une autre (écrite depuis un autre appareil), le serveur gagne, comme avant.
//     Ces modifications en attente sont notées dans le navigateur (CLE_ETAT) pour survivre à un rechargement.
//     La même règle vaut pour un envoi en échec : il ne repart qu'après une nouvelle restauration, jamais à
//     l'aveugle — pas même à la fermeture de l'onglet. Quand deux envois de la même clé se chevauchent, la
//     confirmation du premier ne lève la note que si le navigateur détient encore la valeur confirmée.
//  3. Un envoi en échec (réseau ou réponse d'erreur) est retenté seul : le serveur est relu après 5 s, 15 s, 1 min,
//     puis toutes les 5 min, et ce qui attend repart. Une valeur que le serveur refuse (400, 413, 422) reste dans le
//     navigateur et ne bloque pas les autres. Une valeur qu'il ne parvient pas à enregistrer (500 à chaque envoi qui
//     la contient, alors que les autres passent) est mise à part : retentée seule au bout de 5 min, puis toutes les
//     30 min ; une autre valeur saisie pour la même clé repart avec les envois ordinaires. Tant que rien ne passe,
//     c'est le serveur qui est tenu pour en panne, et rien n'est mis à part.
//  4. Ce qui attend l'envoi ne part jamais avec le jeton d'un autre compte. « Tout envoyer » (premier passage d'un
//     compte dont le serveur ne détient rien) ne recopie que les clés qui portent l'identifiant du compte ou de sa
//     fiche, et seulement si le serveur en a donné la liste ; jamais celles qui portent un autre identifiant, et les
//     clés sans identifiant seulement si rien n'indique qu'un autre compte a utilisé ce navigateur. Ce qu'il ne
//     parvient pas à envoyer reste en attente dans le miroir, comme une saisie pas encore confirmée.
// Limites connues : les clés du navigateur ne sont pas rangées par compte, deux comptes sur le même navigateur y
// lisent les valeurs l'un de l'autre ; une valeur dont l'envoi échoue sans aucune réponse du serveur (connexion qui
// ne laisse pas passer un envoi volumineux) retient encore les valeurs du même envoi, comme avant : sans réponse,
// rien ne la distingue d'une coupure du réseau ; et « tout envoyer » ne part que tant que l'espace du compte est vide
// sur le serveur : la première écriture qui y est sauvegardée lui retire toute nouvelle occasion.
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
/** Attente avant de retenter, seule, une valeur mise à part (voir `isolees`) ; le dernier délai se répète. */
const DELAIS_VALEUR_ISOLEE_MS = [300_000, 1_800_000]
/** Envois un par un : après autant d'échecs sans un seul succès, c'est le serveur qui est en panne, la série s'arrête. */
const ECHECS_AVANT_ARRET = 3
/** État du miroir gardé dans le navigateur. Hors préfixe `fixit_` : jamais envoyé au serveur. */
const CLE_ETAT = 'vitfix_miroir_etat_v1'
/** Délai avant d'écrire l'état : un envoi normal est confirmé avant, et rien n'est alors écrit. */
const DELAI_ETAT_MS = 3_000
/** Empreinte d'une clé que le serveur ne détenait pas. */
const ABSENTE = ''
/** Identifiant de compte ou de fiche porté par une clé (`fixit_documents_<identifiant>`). */
const MOTIF_IDENTIFIANT = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/g

type Minuteur = ReturnType<typeof setTimeout>
/**
 * Issue d'un appel au serveur :
 *  - `refuse` (400, 413, 422) : il refuse ce contenu, le renvoyer tel quel n'y changera rien ;
 *  - `indisponible` : pas de réponse (réseau), jeton refusé (401) ou limite de débit (429) — le contenu n'est pas en cause ;
 *  - `erreur` : toute autre réponse (5xx surtout) — panne passagère, ou valeur qu'il ne parvient pas à enregistrer.
 */
type Issue = 'ok' | 'refuse' | 'erreur' | 'indisponible'
type EntreeAEnvoyer = { key: string; value: unknown; raw: string }
interface Envoi { jeton: string; keepalive: boolean; compte: string | null }
/** Bilan d'un envoi complet (flushNow). */
interface Bilan {
  /** Valeurs que le serveur a enregistrées pendant cet envoi : la preuve qu'il répond. */
  reussies: number
  /** Quelque chose a été remis en attente : un nouvel essai est à programmer. */
  panne: boolean
  /**
   * Valeurs en erreur alors qu'elles étaient seules dans leur envoi. La fin de l'envoi tranche : si d'autres valeurs
   * sont passées, ce sont elles que le serveur ne parvient pas à enregistrer ; sinon c'est lui qui est en panne.
   */
  seulesEnErreur: EntreeAEnvoyer[]
}

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
// Le serveur a été relu avec succès pour ce compte et aucun envoi n'a échoué depuis : les envois sont permis
// (garanties 1 et 2). Remis à faux par un envoi en échec : le nouvel essai commence par une restauration.
let amorce = false
let echecsHydratation = 0
let hydratationARetenter = false
let minuteurHydratation: Minuteur | null = null
let echecsEnvoi = 0
let minuteurReessai: Minuteur | null = null
let minuteurEtat: Minuteur | null = null
// Clés dont un envoi a reçu une réponse d'erreur du serveur → nombre d'échecs de suite. Un lot qui échoue de nouveau
// avec l'une d'elles repart valeur par valeur : si c'est elle que le serveur ne parvient pas à enregistrer, elle ne
// bloque pas les autres (garantie 3).
const echecsServeur = new Map<string, number>()
// Parmi elles, celles qui ont échoué seules alors que d'autres valeurs passaient → la valeur en cause : mises à part,
// elles ne partent plus avec les envois ordinaires et sont retentées de loin en loin (planifierIsolees). Une autre
// valeur saisie pour la même clé n'est plus en cause : elle repart avec les envois ordinaires.
const isolees = new Map<string, string>()
// Le prochain envoi peut tenter les valeurs mises à part : leur délai est écoulé et le serveur va être relu.
let isoleesPermises = false
let essaisIsolees = 0
let minuteurIsolees: Minuteur | null = null
// Ce que la dernière restauration réussie a appris, pour « tout envoyer » (pushAllLocalToServer) : le serveur ne
// détenait rien, un autre compte est déjà passé par ce navigateur, et les identifiants (compte, fiche) sous lesquels
// ce compte range ses clés — si le serveur en a donné la liste (identifiantsDonnes).
let serveurVide = false
let autreCompteVu = false
const identifiantsDuCompte = new Set<string>()
let identifiantsDonnes = false
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
    echecsServeur.clear()
    isolees.clear()
    isoleesPermises = false
    essaisIsolees = 0
    flushTimer = arreter(flushTimer)
    minuteurEtat = arreter(minuteurEtat)
    minuteurIsolees = arreter(minuteurIsolees)
  }
  minuteurReessai = arreter(minuteurReessai)
  minuteurHydratation = arreter(minuteurHydratation)
  compteCourant = compte
  // Rien de ce qu'une restauration a appris ne vaut pour un autre compte.
  amorce = false
  serveurVide = false
  autreCompteVu = false
  identifiantsDuCompte.clear()
  identifiantsDonnes = false
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
    if (res.status === 400 || res.status === 413 || res.status === 422) return 'refuse'
    if (res.status === 401 || res.status === 429) return 'indisponible'
    return 'erreur'
  } catch {
    // Erreur réseau : le localStorage reste la source opérationnelle, l'envoi sera retenté.
    return 'indisponible'
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

/** La clé n'est plus tenue pour en échec : sa prochaine valeur repartira avec les envois groupés. */
function oublierEchecs(key: string): void {
  echecsServeur.delete(key)
  isolees.delete(key)
}

function compterUnEchec(key: string): void {
  echecsServeur.set(key, (echecsServeur.get(key) ?? 0) + 1)
}

/** Le serveur détient maintenant cette valeur. */
function confirmerEcriture(e: EntreeAEnvoyer): void {
  oublierEchecs(e.key)
  derniereValeurSynchronisee.set(e.key, e.raw)
  // Le navigateur détient déjà une valeur plus récente — en attente, ou partie dans un autre envoi dont la réponse
  // n'est pas arrivée : elle se mesurera à celle qui vient d'arriver au serveur. Lever la note ici la ferait perdre
  // contre celle-ci à la relecture suivante du serveur (relecture du 15/11/2026).
  if (pendingWrites.has(e.key) || pendingDeletes.has(e.key) || valeurLocale(e.key) !== e.raw) {
    bases.set(e.key, { brut: e.raw })
    planifierEtat()
  } else {
    oublierBase(e.key)
  }
}

function refuserEcriture(e: EntreeAEnvoyer): void {
  oublierEchecs(e.key)
  refusees.set(e.key, e.raw)
  avertirUneFois(`refus:${e.key}`, '[storage-sync] valeur refusée par le serveur, elle reste dans ce navigateur seulement :', e.key)
}

/**
 * Remet une écriture en attente après un envoi en échec, sauf si la clé a changé depuis (réécrite, supprimée, ou
 * remplacée par l'hydratation) : la valeur plus récente a son propre envoi, l'ancienne l'écraserait (aller-retour
 * A → B → A pendant un POST de B en échec).
 */
function remettreEnAttente(e: EntreeAEnvoyer): void {
  if (valeurLocale(e.key) !== e.raw) return
  pendingWrites.set(e.key, e.raw)
  // Valeur sans note (envoyée par « tout envoyer ») : on note ce que le serveur en détenait, pour autant que cet
  // appareil le sache. La note la protège à la relecture qui précède le nouvel essai, et après un rechargement.
  noterBase(e.key, undefined)
}

/** Range l'issue d'un envoi pour une de ses valeurs. */
function conclure(e: EntreeAEnvoyer, issue: Issue, bilan: Bilan): void {
  if (issue === 'ok') {
    confirmerEcriture(e)
    bilan.reussies++
    return
  }
  if (issue === 'refuse') {
    refuserEcriture(e)
    return
  }
  if (issue === 'erreur') compterUnEchec(e.key)
  remettreEnAttente(e)
  bilan.panne = true
}

/**
 * Une valeur envoyée seule a reçu une réponse d'erreur du serveur. Est-ce elle qu'il ne parvient pas à enregistrer,
 * ou est-il en panne ? La fin de l'envoi tranche, selon que d'autres valeurs sont passées ou non (voir flushNow).
 */
function echouerSeule(e: EntreeAEnvoyer, bilan: Bilan): void {
  compterUnEchec(e.key)
  remettreEnAttente(e)
  bilan.seulesEnErreur.push(e)
}

/**
 * Envoie des valeurs une par une : celles d'un lot refusé en bloc, ou en erreur pour la deuxième fois. Tant que rien
 * ne passe, c'est le serveur qui est tenu pour en panne : la série s'arrête pour ne pas le marteler, et tout reste
 * en attente du nouvel essai.
 * `dejaIsolees` : valeurs déjà mises à part, retentées à leur tour — leur échec ne dit rien de l'état du serveur.
 * Renvoie false si la série a été interrompue : toutes les valeurs n'ont pas eu leur essai.
 */
async function envoyerUneParUne(entrees: EntreeAEnvoyer[], envoi: Envoi, bilan: Bilan, dejaIsolees = false): Promise<boolean> {
  // Les moins souvent en échec d'abord : une valeur que le serveur n'enregistre jamais ne doit pas, en tête de série,
  // faire prendre le serveur pour indisponible.
  const ordre = [...entrees].sort((a, b) => (echecsServeur.get(a.key) ?? 0) - (echecsServeur.get(b.key) ?? 0))
  let arret = false
  for (const e of ordre) {
    if (arret) {
      // Le nouvel essai leur est dû même si un autre lot du même envoi passe ensuite (relecture du 15/11/2026).
      remettreEnAttente(e)
      bilan.panne = true
      continue
    }
    marquerEnVol([e.key])
    let issue: Issue
    try {
      issue = await poster([e], envoi.jeton, envoi.keepalive)
    } finally {
      libererEnVol([e.key])
    }
    // Un autre compte s'est connecté pendant l'envoi : plus rien de cet envoi ne le concerne.
    if (compteCourant !== envoi.compte) return false
    if (issue !== 'erreur') {
      conclure(e, issue, bilan)
      // Pas de réponse, jeton refusé ou limite de débit : inutile d'adresser la suite de la série au serveur.
      if (issue === 'indisponible') arret = true
      continue
    }
    // Déjà à part : elle y reste, son échec ne dit rien du serveur.
    if (dejaIsolees) {
      compterUnEchec(e.key)
      remettreEnAttente(e)
      continue
    }
    echouerSeule(e, bilan)
    if (bilan.reussies === 0 && bilan.seulesEnErreur.length >= ECHECS_AVANT_ARRET) arret = true
  }
  return !arret
}

/**
 * Envoie un lot groupé. Refusé en bloc, ou en erreur alors qu'une de ses valeurs l'était déjà à l'envoi précédent, il
 * repart aussitôt valeur par valeur : une seule valeur ne doit pas bloquer les autres. Un lot en échec n'empêche pas
 * les suivants de partir : une valeur volumineuse qui ne passe pas ne retient pas celles des autres lots.
 */
async function envoyerLot(lot: EntreeAEnvoyer[], envoi: Envoi, bilan: Bilan): Promise<void> {
  const cles = lot.map(e => e.key)
  marquerEnVol(cles)
  try {
    const issue = await poster(lot, envoi.jeton, envoi.keepalive)
    // Un autre compte s'est connecté pendant l'envoi : plus rien de cet envoi ne le concerne.
    if (compteCourant !== envoi.compte) return
    const deuxiemeErreur = issue === 'erreur' && lot.some(e => echecsServeur.has(e.key))
    if (lot.length > 1 && (issue === 'refuse' || deuxiemeErreur)) await envoyerUneParUne(lot, envoi, bilan)
    // Seule dans son envoi (par sa taille, ou parce que rien d'autre n'attendait) : c'est déjà un envoi « une par une ».
    else if (deuxiemeErreur) echouerSeule(lot[0], bilan)
    else for (const e of lot) conclure(e, issue, bilan)
  } finally {
    libererEnVol(cles)
  }
}

/**
 * Fin d'un envoi : tranche le sort des valeurs en erreur alors qu'elles étaient seules dans leur envoi. Si d'autres
 * valeurs sont passées, le serveur répond : ce sont elles qu'il ne parvient pas à enregistrer, elles sont mises à
 * part et ne bloquent plus rien. Si rien n'est passé, c'est lui qui est en panne : tout attend le nouvel essai.
 */
function trancher(bilan: Bilan): void {
  if (bilan.seulesEnErreur.length === 0) return
  if (bilan.reussies === 0) {
    bilan.panne = true
    return
  }
  for (const e of bilan.seulesEnErreur) {
    isolees.set(e.key, e.raw)
    avertirUneFois(`isolee:${e.key}`, '[storage-sync] valeur que le serveur ne parvient pas à enregistrer, mise à part : elle reste dans ce navigateur et sera retentée seule :', e.key)
  }
}

/**
 * Fin d'un envoi (flushNow, pushAllLocalToServer) : tranche le sort des valeurs en erreur, programme le nouvel essai
 * de ce qui a été remis en attente, puis l'essai suivant des valeurs mises à part.
 */
function terminerEnvoi(bilan: Bilan): void {
  trancher(bilan)
  if (bilan.panne) {
    echecsEnvoi++
    // Garantie 2 : ce qui a été remis en attente ne repartira qu'après une nouvelle lecture du serveur.
    amorce = false
    planifierReessai()
  } else if (amorce) {
    echecsEnvoi = 0
  }
  planifierIsolees()
}

/** Envoie les suppressions en attente. */
async function envoyerSuppressions(envoi: Envoi, bilan: Bilan): Promise<void> {
  const cles = Array.from(pendingDeletes)
  pendingDeletes.clear()
  for (let debut = 0; debut < cles.length; debut += FLUSH_BATCH_SIZE) {
    const lot = cles.slice(debut, debut + FLUSH_BATCH_SIZE)
    const issue = await appeler('DELETE', JSON.stringify({ keys: lot }), envoi.jeton, envoi.keepalive)
    if (compteCourant !== envoi.compte) return
    if (issue === 'refuse') avertirUneFois('refus-suppression', '[storage-sync] suppression refusée par le serveur :', lot)
    for (const cle of lot) {
      // La clé a été réécrite pendant l'appel : son écriture a son propre envoi.
      if (pendingWrites.has(cle)) {
        if (issue === 'ok') bases.set(cle, { brut: null })
        continue
      }
      if (issue === 'ok') oublierBase(cle)
      // Remise en attente seulement si la clé est toujours absente du navigateur : recréée et enregistrée entre-temps,
      // la supprimer effacerait du serveur une valeur présente ici.
      else if (issue !== 'refuse' && valeurLocale(cle) === null) {
        pendingDeletes.add(cle)
        bilan.panne = true
      }
    }
  }
}

/**
 * Programme le nouvel essai d'un envoi en échec. Il commence par une restauration (garantie 2) : ce qui attend ne
 * repart que si le serveur détient toujours la valeur d'avant ; s'il en détient une autre, il gagne.
 */
function planifierReessai(): void {
  minuteurReessai = arreter(minuteurReessai)
  minuteurReessai = setTimeout(() => {
    minuteurReessai = null
    // Une restauration déjà en cours ou déjà programmée fera le même travail.
    if (hydratationsEnCours === 0 && !minuteurHydratation) void hydrateStorageFromServer()
  }, delaiDeReessai(echecsEnvoi))
}

/** Reste-t-il des valeurs mises à part en attente ? Oublie celles qui n'attendent plus (reprises du serveur, modifiées dans un autre onglet). */
function resteDesIsolees(): boolean {
  for (const cle of Array.from(isolees.keys())) {
    if (!pendingWrites.has(cle) && !postsEnVol.has(cle)) oublierEchecs(cle)
  }
  return isolees.size > 0
}

/**
 * Programme l'essai suivant des valeurs mises à part : seules, de loin en loin, et comme tout nouvel essai après une
 * nouvelle lecture du serveur (garantie 2). Un seul minuteur, qui s'arrête quand plus rien n'est à part.
 */
function planifierIsolees(): void {
  if (!resteDesIsolees()) {
    essaisIsolees = 0
    minuteurIsolees = arreter(minuteurIsolees)
    return
  }
  if (minuteurIsolees) return
  minuteurIsolees = setTimeout(() => {
    minuteurIsolees = null
    if (!resteDesIsolees()) return
    essaisIsolees++
    isoleesPermises = true
    amorce = false
    void hydrateStorageFromServer()
  }, DELAIS_VALEUR_ISOLEE_MS[Math.min(essaisIsolees, DELAIS_VALEUR_ISOLEE_MS.length - 1)])
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
  const qui = await identite()
  if (!qui) return
  if (adopterCompte(qui.compte)) return
  // Garanties 1 et 2 : sans restauration réussie depuis le chargement de la page ou depuis le dernier envoi en échec,
  // on ne sait pas ce que détient le serveur. Après un échec, le nouvel essai est déjà programmé et commencera par
  // relire le serveur (planifierReessai) : d'ici là rien ne part, ni à chaque frappe, ni à la fermeture de l'onglet.
  // Ce qui attend reste dans le navigateur et dans les notes du miroir.
  if (!amorce) {
    if (hydratationsEnCours === 0 && !minuteurReessai) planifierNouvelleHydratation()
    return
  }
  // Une hydratation a pu commencer pendant la lecture du jeton.
  if (hydratationsEnCours > 0) return

  const compte = compteCourant
  const avecLesIsolees = isoleesPermises
  isoleesPermises = false
  const groupees: EntreeAEnvoyer[] = []
  const aPart: EntreeAEnvoyer[] = []
  for (const [key, raw] of Array.from(pendingWrites)) {
    // Une autre valeur que celle mise à part pour cette clé (saisie depuis, même pendant l'envoi qui l'a mise à part)
    // n'est plus en cause : elle part avec les envois ordinaires. Réécrite à l'identique (montage du tableau de bord),
    // la valeur en cause reste à part (relecture du 15/11/2026).
    if (isolees.has(key) && isolees.get(key) !== raw) oublierEchecs(key)
    const isolee = isolees.has(key)
    // Valeur mise à part : elle reste en file jusqu'à son propre essai (planifierIsolees).
    if (isolee && !avecLesIsolees) continue
    // Retirée IMMÉDIATEMENT de la file, pour ne pas réémettre la même entrée si une écriture survient pendant
    // l'envoi (perte d'idempotence sinon).
    pendingWrites.delete(key)
    const entree = { key, value: versServeur(raw), raw }
    let envoyable = false
    try { envoyable = JSON.stringify(entree.value).length <= MAX_VALUE_BYTES } catch { envoyable = false }
    if (!envoyable) refuserEcriture(entree)
    else if (isolee) aPart.push(entree)
    else groupees.push(entree)
  }

  const bilan: Bilan = { reussies: 0, panne: false, seulesEnErreur: [] }
  const envoi: Envoi = { jeton: qui.jeton, keepalive: opts.keepalive === true, compte }
  // Un seul POST avec toutes les clés modifiées, tant que le nombre et la taille le permettent.
  for (const lot of grouperEnLots(groupees)) {
    await envoyerLot(lot, envoi, bilan)
    if (compteCourant !== compte) return
  }
  const isoleesTentees = await envoyerUneParUne(aPart, envoi, bilan, true)
  if (compteCourant !== compte) return
  await envoyerSuppressions(envoi, bilan)
  if (compteCourant !== compte) return

  // Série interrompue (le serveur ne répondait plus) : l'essai des valeurs mises à part leur reste dû.
  if (avecLesIsolees && !isoleesTentees) isoleesPermises = true
  terminerEnvoi(bilan)
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
  // La valeur que le serveur n'enregistrait pas n'existe plus : la suppression part avec les envois ordinaires.
  oublierEchecs(key)
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
        // Clés absentes du serveur, modifications gardées : l'envoi retenu est relancé. Plus rien n'attend (le
        // serveur a gagné partout) : la série d'échecs d'envoi est close.
        if (pendingWrites.size > 0 || pendingDeletes.size > 0) scheduleFlush()
        else echecsEnvoi = 0
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
  let identifiants: unknown
  try {
    const res = await fetch('/api/user-storage', {
      headers: { Authorization: `Bearer ${qui.jeton}` },
    })
    if (!res.ok) return echecDeRestauration()
    const json = await res.json() as { entries?: unknown; identifiants?: unknown } | null
    // Réponse sans la liste des valeurs : elle ne dit pas ce que détient le serveur. La tenir pour « rien » ouvrirait
    // la voie à « tout envoyer » (garantie 1).
    const recues = json?.entries
    if (recues === null || typeof recues !== 'object' || Array.isArray(recues)) return echecDeRestauration()
    entries = recues as Record<string, unknown>
    identifiants = json?.identifiants
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
    oublierEchecs(key)
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
  // Le serveur vient d'être relu : ce qui attendait un nouvel essai peut repartir sans attendre son délai. Le compte
  // des échecs d'envoi, lui, court jusqu'au prochain envoi réussi : sinon un serveur qui répond aux lectures mais
  // refuse les envois serait sollicité toutes les 5 s.
  minuteurReessai = arreter(minuteurReessai)
  // Ce que « tout envoyer » a le droit de faire pour ce compte (pushAllLocalToServer).
  serveurVide = Object.keys(entries).length === 0
  autreCompteVu = autreCompte
  identifiantsDuCompte.clear()
  // Sans la liste du serveur (fiche du compte illisible), on ne sait pas sous quels identifiants ce compte range ses
  // clés : « tout envoyer » attend une restauration qui la donne (relecture du 15/11/2026).
  identifiantsDonnes = Array.isArray(identifiants)
  const donnes: unknown[] = Array.isArray(identifiants) ? identifiants : []
  for (const identifiant of [compte, ...donnes]) {
    if (typeof identifiant === 'string' && identifiant !== '') identifiantsDuCompte.add(identifiant.toLowerCase())
  }
  return { count, ok: true, vide: serveurVide, autreCompte }
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
  if (pendingWrites.size > 0 || pendingDeletes.size > 0) void flushNow({ keepalive: true })
  if (bases.size > 0 || confirmees.size > 0) synchroniserEtat()
}

/**
 * Le réseau revient : on n'attend pas. Si une restauration est due — première lecture du serveur, ou relecture avant
 * le nouvel essai d'un envoi en échec — elle part tout de suite ; sinon, ce qui attend est envoyé.
 */
function reprendre(): void {
  if (amorce) {
    void flushNow()
    return
  }
  if (compteCourant === null && pendingWrites.size === 0 && pendingDeletes.size === 0) return
  minuteurHydratation = arreter(minuteurHydratation)
  minuteurReessai = arreter(minuteurReessai)
  void hydrateStorageFromServer()
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
 * Parmi les clés du navigateur, celles que « tout envoyer » peut recopier dans l'espace du compte connecté :
 *  - une clé qui porte l'identifiant du compte ou de sa fiche : toujours ;
 *  - une clé qui porte un autre identifiant : jamais — elle appartient à un autre compte passé par ce navigateur ;
 *  - une clé sans identifiant : seulement si rien n'indique qu'un autre compte a utilisé ce navigateur.
 * Rien n'est retiré du navigateur : le tri ne porte que sur ce qui part.
 */
function clesDuCompte(cles: string[]): string[] {
  const siennes: string[] = []
  const communes: string[] = []
  let cleDUnAutre = false
  for (const cle of cles) {
    const identifiants = cle.toLowerCase().match(MOTIF_IDENTIFIANT)
    if (!identifiants) communes.push(cle)
    else if (identifiants.some(identifiant => identifiantsDuCompte.has(identifiant))) siennes.push(cle)
    else cleDUnAutre = true
  }
  return cleDUnAutre || autreCompteVu ? siennes : [...siennes, ...communes]
}

/**
 * « Tout envoyer » : recopie vers le serveur les clés `fixit_*` que ce navigateur détient pour le compte connecté
 * (une seule fois). Utile au premier passage d'un compte dont le serveur ne détient rien alors que le navigateur a
 * déjà des données (compte antérieur au miroir).
 * La fonction porte elle-même ses conditions : une restauration a réussi pour ce compte, le serveur a répondu qu'il
 * ne détenait rien (garantie 1) et a donné la liste des identifiants du compte, et seules les clés du compte partent
 * (garantie 4, voir clesDuCompte).
 * Les valeurs partent comme un envoi ordinaire : un lot refusé en bloc repart valeur par valeur, et ce qui ne passe pas
 * (réseau, panne) reste en attente dans le miroir, noté dans le navigateur, pour le nouvel essai qui suit une relecture
 * du serveur. Renvoie le nombre de valeurs que le serveur a enregistrées.
 */
export async function pushAllLocalToServer(): Promise<{ count: number }> {
  // Lecture seule : un stockage plein (QuotaExceededError à l'écriture) se lit encore et doit pouvoir migrer.
  if (typeof window === 'undefined' || !isStorageReadable('local')) return { count: 0 }
  const qui = await identite()
  if (!qui) return { count: 0 }
  adopterCompte(qui.compte)
  // Pas de restauration réussie pour ce compte (ou un envoi en échec depuis), ou serveur qui détient déjà des
  // valeurs : on ne sait pas ce que cet envoi écraserait. Sans la liste des identifiants du compte, on ne sait pas
  // lesquelles de ces clés sont les siennes.
  if (!amorce || !serveurVide || !identifiantsDonnes) return { count: 0 }
  const compte = compteCourant

  const presentes: string[] = []
  for (let i = 0; i < window.localStorage.length; i++) {
    const k = window.localStorage.key(i)
    if (k && shouldSync(k)) presentes.push(k)
  }
  const keys = clesDuCompte(presentes)
  if (keys.length === 0) return { count: 0 }

  const entries: EntreeAEnvoyer[] = keys.map(k => {
    const raw = window.localStorage.getItem(k) || ''
    return { key: k, value: versServeur(raw), raw }
  }).filter(e => {
    try { return JSON.stringify(e.value).length <= MAX_VALUE_BYTES } catch { return false }
  })

  // Relecture du 15/11/2026 : un lot refusé ou en échec était abandonné en entier, et une seule valeur que la base
  // refuse privait toutes les autres du lot de leur copie en ligne.
  const bilan: Bilan = { reussies: 0, panne: false, seulesEnErreur: [] }
  const envoi: Envoi = { jeton: qui.jeton, keepalive: false, compte }
  for (const lot of grouperEnLots(entries)) {
    await envoyerLot(lot, envoi, bilan)
    // Un autre compte s'est connecté pendant l'envoi : la suite ne part pas, et rien de cet envoi ne le concerne.
    if (compteCourant !== compte) return { count: bilan.reussies }
  }
  terminerEnvoi(bilan)
  return { count: bilan.reussies }
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
  echecsServeur.clear()
  isolees.clear()
  identifiantsDuCompte.clear()
  avertissementsFaits.clear()
  flushTimer = arreter(flushTimer)
  minuteurEtat = arreter(minuteurEtat)
  minuteurReessai = arreter(minuteurReessai)
  minuteurHydratation = arreter(minuteurHydratation)
  minuteurIsolees = arreter(minuteurIsolees)
  compteCourant = null
  amorce = false
  serveurVide = false
  autreCompteVu = false
  identifiantsDonnes = false
  isoleesPermises = false
  essaisIsolees = 0
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
