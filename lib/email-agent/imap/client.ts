/**
 * Client IMAP minimal, en lecture seule, pour l'agent Alfredo (boîtes « autre
 * messagerie » : OVH, Infomaniak, Gandi, Ionos, iCloud, Yahoo, serveur du cabinet…).
 *
 * Sans dépendance (le Worker Cloudflare est proche de sa taille maximale) : TLS direct sur
 * le port 993 par les sockets TCP du Worker (cloudflare:sockets), puis
 * AUTHENTICATE PLAIN (ou LOGIN), EXAMINE INBOX (lecture seule : aucun indicateur
 * modifié), UID SEARCH SINCE, UID FETCH (en-têtes utiles + début du corps en
 * BODY.PEEK) et LOGOUT. Les réponses sont lues octet par octet avec les littéraux {n}.
 * Rien n'est jamais écrit dans la boîte ; le mot de passe n'est jamais journalisé.
 */

import type { Socket } from 'cloudflare:sockets'
import { logger } from '@/lib/logger'
import { analyserEntetes, decoderMotsEncodes, extraireCorpsTexte } from './mime'

export const PORT_IMAPS = 993
/** Délai global d'une session (connexion comprise). */
export const DELAI_SESSION_MS = 25_000
/** Octets lus au plus du corps de chaque e-mail. */
export const OCTETS_CORPS = 4000
const MAX_LITTERAL = 1_000_000
const MAX_OCTETS_SESSION = 4_000_000
const MAX_LIGNE = 200_000

// ── Transport ────────────────────────────────────────────────────────────────

/** Flux d'une connexion TLS établie (forme d'un Socket Cloudflare). */
export interface TransportImap {
  readable: ReadableStream<Uint8Array>
  writable: WritableStream<Uint8Array>
  /** Résolue une fois la connexion établie (Socket Cloudflare : opened). */
  opened?: Promise<unknown>
  close(): Promise<void>
}

export type OuvrirTransport = (hote: string, port: number) => Promise<TransportImap>

export type CodeErreurImap =
  /** Pas de sockets TCP (exécution hors Worker : next dev, tests). */
  | 'imap_indisponible'
  /** DNS, refus de connexion, échec TLS, connexion coupée. */
  | 'serveur_injoignable'
  | 'delai_depasse'
  | 'identifiants_refuses'
  /** Le serveur exige un mot de passe d'application (Gmail, iCloud, Yahoo…). */
  | 'mot_de_passe_application'
  /** Microsoft 365 / Outlook : l'IMAP par mot de passe est refusé → bouton Outlook. */
  | 'microsoft_oauth'
  /** Le serveur n'accepte aucune connexion par mot de passe (LOGINDISABLED sans AUTH=PLAIN). */
  | 'authentification_non_prise_en_charge'
  | 'boite_inaccessible'
  | 'protocole'

/** Erreur IMAP avec un code court ; detail (réponse du serveur, sans secret) pour les journaux. */
export class ErreurImap extends Error {
  readonly code: CodeErreurImap
  readonly detail: string

  constructor(code: CodeErreurImap, message: string, detail = '') {
    super(message)
    this.name = 'ErreurImap'
    this.code = code
    this.detail = detail.slice(0, 300)
  }
}

type Connect = (adresse: { hostname: string; port: number }, options: { secureTransport: 'on'; allowHalfOpen: boolean }) => Socket

async function chargerConnect(): Promise<Connect | null> {
  try {
    // Import dynamique dans un try, à garder tel quel : Turbopack le laisse natif
    // (commentaires d'exclusion), l'esbuild d'OpenNext tolère un import non résolu dans
    // un try et wrangler le reconnaît comme module intégré du Worker. Hors Worker (Node :
    // next dev, Vitest), l'import échoue → null.
    const mod = await import(/* webpackIgnore: true */ /* turbopackIgnore: true */ 'cloudflare:sockets')
    return typeof mod.connect === 'function' ? mod.connect : null
  } catch (err) {
    logger.warn('[email-agent/imap] sockets TCP indisponibles (exécution hors Worker)', {
      erreur: err instanceof Error ? err.message : String(err),
    })
    return null
  }
}

/** Connexion TLS directe (port 993) par les sockets TCP du Worker Cloudflare. */
export const ouvrirSocketTls: OuvrirTransport = async (hote, port) => {
  const connect = await chargerConnect()
  if (!connect) {
    throw new ErreurImap('imap_indisponible', 'Connexion IMAP indisponible dans cet environnement')
  }
  return connect({ hostname: hote, port }, { secureTransport: 'on', allowHalfOpen: false })
}

// ── Validation ───────────────────────────────────────────────────────────────

/** Nom d'hôte DNS complet (pas d'adresse IP, pas de nom court comme « localhost »). */
export function hoteImapValide(hote: string): boolean {
  return /^(?=.{4,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z][a-z0-9-]{0,61}[a-z0-9]$/i.test(hote)
}

const HOTES_MICROSOFT = /(^|\.)(office365\.com|outlook\.com|hotmail\.com|live\.com)$/i

// ── Lecture des réponses ─────────────────────────────────────────────────────

/** Une réponse du serveur : morceaux de texte et littéraux {n} (octets), dans l'ordre. */
type Reponse = Array<string | Uint8Array>

interface ResultatCommande {
  statut: 'OK' | 'NO' | 'BAD'
  texte: string
  nonEtiquetees: Reponse[]
}

const encodeur = new TextEncoder()
const decodeur = new TextDecoder('utf-8')

function concat(a: Uint8Array, b: Uint8Array): Uint8Array {
  const r = new Uint8Array(a.length + b.length)
  r.set(a)
  r.set(b, a.length)
  return r
}

class SessionImap {
  private readonly lecteur: ReadableStreamDefaultReader<Uint8Array>
  private readonly ecrivain: WritableStreamDefaultWriter<Uint8Array>
  private tampon: Uint8Array = new Uint8Array(0)
  private pos = 0
  private totalLu = 0
  private numero = 0

  constructor(transport: TransportImap, private readonly echeance: number) {
    this.lecteur = transport.readable.getReader()
    this.ecrivain = transport.writable.getWriter()
  }

  private async remplir(): Promise<void> {
    const lu = await avantEcheance(this.lecteur.read(), this.echeance)
    if (lu.done || !lu.value) throw new ErreurImap('serveur_injoignable', 'Connexion fermée par le serveur')
    this.totalLu += lu.value.length
    if (this.totalLu > MAX_OCTETS_SESSION) throw new ErreurImap('protocole', 'Réponse du serveur trop volumineuse')
    this.tampon = concat(this.tampon.subarray(this.pos), lu.value)
    this.pos = 0
  }

  private async lireLigne(): Promise<Uint8Array> {
    let depart = this.pos
    for (;;) {
      for (let i = depart; i + 1 < this.tampon.length; i++) {
        if (this.tampon[i] === 13 && this.tampon[i + 1] === 10) {
          const ligne = this.tampon.subarray(this.pos, i)
          this.pos = i + 2
          return ligne
        }
      }
      if (this.tampon.length - this.pos > MAX_LIGNE) throw new ErreurImap('protocole', 'Ligne IMAP trop longue')
      const dejaLus = this.tampon.length - this.pos
      await this.remplir()
      depart = Math.max(0, dejaLus - 1)
    }
  }

  private async lireOctets(n: number): Promise<Uint8Array> {
    while (this.tampon.length - this.pos < n) await this.remplir()
    const octets = this.tampon.subarray(this.pos, this.pos + n)
    this.pos += n
    return octets
  }

  /** Une réponse complète : ligne, et pour chaque littéral {n} en fin de ligne, ses n octets puis la suite. */
  async lireReponse(): Promise<Reponse> {
    const reponse: Reponse = []
    for (;;) {
      const ligne = decodeur.decode(await this.lireLigne())
      const m = /\{(\d{1,9})\+?\}$/.exec(ligne)
      if (!m) {
        reponse.push(ligne)
        return reponse
      }
      const n = Number(m[1])
      if (n > MAX_LITTERAL) throw new ErreurImap('protocole', 'Littéral IMAP trop volumineux')
      reponse.push(ligne.slice(0, m.index))
      reponse.push(await this.lireOctets(n))
    }
  }

  private async ecrire(octets: Uint8Array): Promise<void> {
    try {
      await avantEcheance(this.ecrivain.write(octets), this.echeance)
    } catch (err) {
      if (err instanceof ErreurImap) throw err
      throw new ErreurImap('serveur_injoignable', 'Écriture impossible sur la connexion IMAP', err instanceof Error ? err.message : String(err))
    }
  }

  /**
   * Commande étiquetée. morceaux[0] part tout de suite (précédé de l'étiquette) ; chaque
   * morceau suivant part sur une demande de suite « + » du serveur (AUTHENTICATE sans
   * SASL-IR, littéraux de LOGIN). Chaque morceau se termine par CRLF.
   */
  async executer(morceaux: Uint8Array[]): Promise<ResultatCommande> {
    const etiquette = `A${++this.numero}`
    const suites = morceaux.slice(1)
    await this.ecrire(concat(encodeur.encode(`${etiquette} `), morceaux[0]))
    const nonEtiquetees: Reponse[] = []
    for (;;) {
      const reponse = await this.lireReponse()
      const tete = typeof reponse[0] === 'string' ? reponse[0] : ''
      if (tete.startsWith('+')) {
        // Plus rien à envoyer : « * » annule l'échange (le serveur répond alors NO/BAD).
        await this.ecrire(suites.shift() ?? encodeur.encode('*\r\n'))
        continue
      }
      if (tete.startsWith(`${etiquette} `)) {
        const m = /^\S+ (OK|NO|BAD)\b ?(.*)$/i.exec(tete)
        if (!m) throw new ErreurImap('protocole', 'Réponse IMAP inattendue', tete)
        return { statut: m[1].toUpperCase() as ResultatCommande['statut'], texte: m[2], nonEtiquetees }
      }
      if (/^\* BYE\b/i.test(tete)) {
        throw new ErreurImap('serveur_injoignable', 'Le serveur IMAP a fermé la session', tete)
      }
      nonEtiquetees.push(reponse)
    }
  }

  commande(texte: string): Promise<ResultatCommande> {
    return this.executer([encodeur.encode(`${texte}\r\n`)])
  }
}

/** Promesse bornée par l'échéance de la session (sinon ErreurImap delai_depasse). */
async function avantEcheance<T>(promesse: Promise<T>, echeance: number): Promise<T> {
  const restant = echeance - Date.now()
  if (restant <= 0) throw new ErreurImap('delai_depasse', 'Le serveur IMAP ne répond pas à temps')
  let minuteur: ReturnType<typeof setTimeout> | undefined
  const delai = new Promise<never>((_, rejeter) => {
    minuteur = setTimeout(() => rejeter(new ErreurImap('delai_depasse', 'Le serveur IMAP ne répond pas à temps')), restant)
  })
  try {
    return await Promise.race([promesse, delai])
  } catch (err) {
    if (err instanceof ErreurImap) throw err
    throw new ErreurImap('serveur_injoignable', 'Connexion au serveur IMAP impossible', err instanceof Error ? err.message : String(err))
  } finally {
    clearTimeout(minuteur)
  }
}

// ── Analyse des réponses FETCH ───────────────────────────────────────────────

type Valeur = string | Uint8Array | null | Valeur[]

/** Lecteur de jetons sur une réponse (texte + littéraux). */
class Jetons {
  private i = 0
  private p = 0

  constructor(private readonly morceaux: Reponse) {}

  private courant(): string | Uint8Array | undefined {
    for (;;) {
      const m = this.morceaux[this.i]
      if (m === undefined) return undefined
      if (typeof m !== 'string' || this.p < m.length) return m
      this.i++
      this.p = 0
    }
  }

  private sauterEspaces(): void {
    for (let m = this.courant(); typeof m === 'string' && m[this.p] === ' '; m = this.courant()) this.p++
  }

  valeur(): Valeur {
    this.sauterEspaces()
    const m = this.courant()
    if (m === undefined) throw new ErreurImap('protocole', 'Réponse FETCH incomplète')
    if (typeof m !== 'string') {
      this.i++
      this.p = 0
      return m
    }
    const c = m[this.p]
    if (c === '(') {
      this.p++
      const liste: Valeur[] = []
      for (;;) {
        this.sauterEspaces()
        const suite = this.courant()
        if (suite === undefined) throw new ErreurImap('protocole', 'Liste FETCH non fermée')
        if (typeof suite === 'string' && suite[this.p] === ')') {
          this.p++
          return liste
        }
        liste.push(this.valeur())
      }
    }
    if (c === '"') {
      let s = ''
      for (this.p++; this.p < m.length && m[this.p] !== '"'; this.p++) {
        if (m[this.p] === '\\') this.p++
        s += m[this.p] ?? ''
      }
      this.p++
      return s
    }
    // Atome ; une section entre crochets (BODY[HEADER.FIELDS (FROM …)]) peut contenir
    // espaces et parenthèses, suivie d'une origine <0>.
    const debut = this.p
    let crochets = 0
    while (this.p < m.length) {
      const x = m[this.p]
      if (x === '[') crochets++
      else if (x === ']') crochets--
      else if (crochets === 0 && (x === ' ' || x === '(' || x === ')')) break
      this.p++
    }
    const atome = m.slice(debut, this.p)
    return atome.toUpperCase() === 'NIL' ? null : atome
  }
}

interface FetchBrut {
  uid?: number
  internalDate?: string
  entetes?: Uint8Array
  corps?: Uint8Array
}

function enOctets(v: Valeur): Uint8Array | undefined {
  if (v instanceof Uint8Array) return v
  if (typeof v === 'string') return encodeur.encode(v)
  return undefined
}

/** « * 12 FETCH (UID 345 INTERNALDATE "…" BODY[HEADER.FIELDS (…)] {n} … BODY[TEXT]<0> {n} …) ». */
export function analyserFetch(reponse: Reponse): { seq: number; donnees: FetchBrut } | null {
  const tete = typeof reponse[0] === 'string' ? reponse[0] : ''
  const m = /^\* (\d+) FETCH /i.exec(tete)
  if (!m) return null
  const liste = new Jetons([tete.slice(m[0].length), ...reponse.slice(1)]).valeur()
  if (!Array.isArray(liste)) throw new ErreurImap('protocole', 'Réponse FETCH illisible', tete)
  const donnees: FetchBrut = {}
  for (let i = 0; i + 1 < liste.length; i += 2) {
    const cle = typeof liste[i] === 'string' ? (liste[i] as string).toUpperCase() : ''
    const v = liste[i + 1]
    if (cle === 'UID' && typeof v === 'string') donnees.uid = Number(v)
    else if (cle === 'INTERNALDATE' && typeof v === 'string') donnees.internalDate = v
    else if (cle.startsWith('BODY[HEADER')) donnees.entetes = enOctets(v)
    else if (cle.startsWith('BODY[TEXT]')) donnees.corps = enOctets(v)
  }
  return { seq: Number(m[1]), donnees }
}

const MOIS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec']

/** INTERNALDATE « 17-Jul-1996 02:44:25 -0700 » → Date (null si illisible). */
export function analyserInternalDate(s: string | undefined): Date | null {
  const m = /^\s*(\d{1,2})-([A-Za-z]{3})-(\d{4}) (\d{2}):(\d{2}):(\d{2}) ([+-])(\d{2})(\d{2})\s*$/.exec(s ?? '')
  if (!m) return null
  const mois = MOIS.indexOf(m[2].toLowerCase())
  if (mois < 0) return null
  const decalage = (m[7] === '-' ? -1 : 1) * (Number(m[8]) * 60 + Number(m[9]))
  return new Date(Date.UTC(Number(m[3]), mois, Number(m[1]), Number(m[4]), Number(m[5]), Number(m[6])) - decalage * 60_000)
}

/** Date au format IMAP de SEARCH SINCE : « 1-Oct-2026 » (jour UTC). */
export function dateImap(d: Date): string {
  const mois = MOIS[d.getUTCMonth()]
  return `${d.getUTCDate()}-${mois[0].toUpperCase()}${mois.slice(1)}-${d.getUTCFullYear()}`
}

// ── Session complète ─────────────────────────────────────────────────────────

export interface ParametresConnexionImap {
  hote: string
  port: number
  utilisateur: string
  motDePasse: string
}

export interface OptionsSessionImap {
  /** Ouverture de la connexion (tests : transport simulé). Défaut : sockets du Worker. */
  ouvrir?: OuvrirTransport
  delaiMs?: number
}

/** E-mail relevé (même forme que MessageNormalise des fournisseurs). */
export interface MessageImap {
  id: string
  threadId: string | null
  from: string
  subject: string
  bodyText: string
  receivedAt: string
}

function base64Utf8(texte: string): string {
  let binaire = ''
  for (const o of encodeur.encode(texte)) binaire += String.fromCharCode(o)
  return btoa(binaire)
}

/** Chaîne IMAP entre guillemets, ou null si un littéral est nécessaire (non ASCII, CR/LF). */
function chaineEntreGuillemets(s: string): string | null {
  return /^[\x20-\x7e]*$/.test(s) ? `"${s.replace(/[\\"]/g, '\\$&')}"` : null
}

function capacitesDe(texte: string): Set<string> | null {
  const m = /\[CAPABILITY ([^\]]*)\]/i.exec(texte) ?? /^\* CAPABILITY (.*)$/i.exec(texte)
  return m ? new Set(m[1].trim().toUpperCase().split(/\s+/)) : null
}

function erreurAuthentification(texte: string, hote: string): ErreurImap {
  if (/application-specific password|app(lication)? password|mot de passe d.application|WEBLOGINREQUIRED/i.test(texte)) {
    return new ErreurImap('mot_de_passe_application', 'Le serveur exige un mot de passe d\'application', texte)
  }
  if (HOTES_MICROSOFT.test(hote)) {
    return new ErreurImap('microsoft_oauth', 'Microsoft refuse la connexion IMAP par mot de passe', texte)
  }
  return new ErreurImap('identifiants_refuses', 'Identifiant ou mot de passe refusé', texte)
}

async function authentifier(session: SessionImap, p: ParametresConnexionImap, capacites: Set<string>): Promise<void> {
  let resultat: ResultatCommande
  if (capacites.has('AUTH=PLAIN')) {
    const jeton = base64Utf8(`\u0000${p.utilisateur}\u0000${p.motDePasse}`)
    resultat = capacites.has('SASL-IR')
      ? await session.commande(`AUTHENTICATE PLAIN ${jeton}`)
      : await session.executer([encodeur.encode('AUTHENTICATE PLAIN\r\n'), encodeur.encode(`${jeton}\r\n`)])
  } else if (capacites.has('LOGINDISABLED')) {
    // Microsoft 365 / Outlook.com (relevé le 11/10/2026) : ni AUTH=PLAIN ni LOGIN, OAuth seulement.
    if (HOTES_MICROSOFT.test(p.hote)) {
      throw new ErreurImap('microsoft_oauth', 'Microsoft refuse la connexion IMAP par mot de passe', [...capacites].join(' '))
    }
    throw new ErreurImap('authentification_non_prise_en_charge', 'Le serveur IMAP refuse la connexion par mot de passe', [...capacites].join(' '))
  } else {
    // LOGIN : chaînes entre guillemets, littéraux synchronisés si nécessaire.
    const morceaux: Uint8Array[] = []
    let courant: Uint8Array = encodeur.encode('LOGIN')
    for (const v of [p.utilisateur, p.motDePasse]) {
      const q = chaineEntreGuillemets(v)
      if (q !== null) {
        courant = concat(courant, encodeur.encode(` ${q}`))
      } else {
        const octets = encodeur.encode(v)
        morceaux.push(concat(courant, encodeur.encode(` {${octets.length}}\r\n`)))
        courant = octets
      }
    }
    morceaux.push(concat(courant, encodeur.encode('\r\n')))
    resultat = await session.executer(morceaux)
  }
  if (resultat.statut !== 'OK') throw erreurAuthentification(resultat.texte, p.hote)
}

/**
 * Ouvre une session authentifiée sur INBOX (EXAMINE, lecture seule), exécute travail
 * puis LOGOUT ; la connexion est toujours fermée.
 */
async function avecSession<T>(
  p: ParametresConnexionImap,
  options: OptionsSessionImap,
  travail: (session: SessionImap, uidValidity: string) => Promise<T>,
): Promise<T> {
  const echeance = Date.now() + (options.delaiMs ?? DELAI_SESSION_MS)
  const transport = await (options.ouvrir ?? ouvrirSocketTls)(p.hote, p.port)
  try {
    if (transport.opened) await avantEcheance(transport.opened, echeance)
    const session = new SessionImap(transport, echeance)

    const accueil = await session.lireReponse()
    const texteAccueil = typeof accueil[0] === 'string' ? accueil[0] : ''
    if (!/^\* (OK|PREAUTH)\b/i.test(texteAccueil)) {
      throw new ErreurImap('serveur_injoignable', 'Accueil du serveur IMAP refusé', texteAccueil)
    }

    if (!/^\* PREAUTH\b/i.test(texteAccueil)) {
      let capacites = capacitesDe(texteAccueil)
      if (!capacites) {
        const cap = await session.commande('CAPABILITY')
        capacites = new Set<string>()
        for (const r of cap.nonEtiquetees) {
          for (const c of capacitesDe(typeof r[0] === 'string' ? r[0] : '') ?? []) capacites.add(c)
        }
      }
      await authentifier(session, p, capacites)
    }

    const boite = await session.commande('EXAMINE INBOX')
    if (boite.statut !== 'OK') throw new ErreurImap('boite_inaccessible', 'Boîte de réception inaccessible', boite.texte)
    let uidValidity = ''
    for (const r of boite.nonEtiquetees) {
      const m = /\[UIDVALIDITY (\d+)\]/i.exec(typeof r[0] === 'string' ? r[0] : '')
      if (m) uidValidity = m[1]
    }

    const resultat = await travail(session, uidValidity)
    try {
      await session.commande('LOGOUT')
    } catch (err) {
      // Le serveur peut couper juste après BYE : la relève est déjà faite.
      logger.debug('[email-agent/imap] LOGOUT sans réponse', { erreur: err instanceof Error ? err.message : String(err) })
    }
    return resultat
  } finally {
    await transport.close().catch((err: unknown) => {
      logger.debug('[email-agent/imap] fermeture de la connexion', { erreur: err instanceof Error ? err.message : String(err) })
    })
  }
}

/** Vérifie les paramètres : connexion, authentification et accès à la boîte de réception. */
export async function testerConnexionImap(p: ParametresConnexionImap, options: OptionsSessionImap = {}): Promise<void> {
  await avecSession(p, options, async () => undefined)
}

export interface OptionsReleveImap {
  /** E-mails reçus depuis cette date (jour près, comme SEARCH SINCE). */
  depuis: Date
  /** Nombre maximal d'e-mails (les plus récents). */
  max: number
  /** Longueur conservée du corps texte. */
  longueurCorps: number
}

/** Derniers e-mails de la boîte de réception, lus ou non, du plus récent au plus ancien. */
export async function releverBoiteImap(
  p: ParametresConnexionImap,
  releve: OptionsReleveImap,
  options: OptionsSessionImap = {},
): Promise<MessageImap[]> {
  return avecSession(p, options, async (session, uidValidity) => {
    const recherche = await session.commande(`UID SEARCH SINCE ${dateImap(releve.depuis)}`)
    if (recherche.statut !== 'OK') throw new ErreurImap('protocole', 'Recherche IMAP refusée', recherche.texte)
    const uids = new Set<number>()
    for (const r of recherche.nonEtiquetees) {
      const m = /^\* SEARCH\b(.*)$/i.exec(typeof r[0] === 'string' ? r[0] : '')
      for (const n of m?.[1].trim().split(/\s+/) ?? []) if (/^\d+$/.test(n)) uids.add(Number(n))
    }
    const choisis = [...uids].sort((a, b) => a - b).slice(-releve.max)
    if (choisis.length === 0) return []

    const fetch = await session.commande(
      `UID FETCH ${choisis.join(',')} (UID INTERNALDATE BODY.PEEK[HEADER.FIELDS (FROM SUBJECT MESSAGE-ID CONTENT-TYPE CONTENT-TRANSFER-ENCODING)] BODY.PEEK[TEXT]<0.${OCTETS_CORPS}>)`,
    )
    if (fetch.statut !== 'OK') throw new ErreurImap('protocole', 'Lecture des e-mails refusée', fetch.texte)

    // Un serveur peut répartir les éléments d'un même message sur plusieurs réponses FETCH.
    const parSeq = new Map<number, FetchBrut>()
    for (const r of fetch.nonEtiquetees) {
      const f = analyserFetch(r)
      if (f) parSeq.set(f.seq, { ...parSeq.get(f.seq), ...f.donnees })
    }

    const messages: MessageImap[] = []
    for (const brut of parSeq.values()) {
      if (!brut.uid) continue
      const entetes = analyserEntetes(decodeur.decode(brut.entetes ?? new Uint8Array(0)))
      const recu = analyserInternalDate(brut.internalDate) ?? new Date()
      const messageId = (entetes['message-id'] || '').replace(/[<>\s]/g, '').slice(0, 300)
      messages.push({
        id: messageId || `imap-${uidValidity || '0'}-${brut.uid}`,
        threadId: null,
        from: decoderMotsEncodes(entetes.from || ''),
        subject: decoderMotsEncodes(entetes.subject || ''),
        bodyText: extraireCorpsTexte(entetes, brut.corps ?? new Uint8Array(0), releve.longueurCorps),
        receivedAt: recu.toISOString(),
      })
    }
    return messages.sort((a, b) => b.receivedAt.localeCompare(a.receivedAt))
  })
}
