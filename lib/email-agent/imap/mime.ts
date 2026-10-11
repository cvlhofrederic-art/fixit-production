/**
 * Décodage minimal des e-mails relevés en IMAP (sans dépendance) : en-têtes (repli des
 * lignes, mots encodés RFC 2047) et corps texte (multipart, quoted-printable, base64,
 * jeu de caractères). Le corps reçu est tronqué (BODY.PEEK[TEXT]<0.4000>) : chaque
 * étape tolère une fin coupée.
 */

import { logger } from '@/lib/logger'

/** Octets → « chaîne binaire » (un caractère par octet), pour découper la structure MIME. */
export function octetsVersBinaire(octets: Uint8Array): string {
  let s = ''
  for (let i = 0; i < octets.length; i += 8192) {
    s += String.fromCharCode(...octets.subarray(i, i + 8192))
  }
  return s
}

function binaireVersOctets(binaire: string): Uint8Array {
  const octets = new Uint8Array(binaire.length)
  for (let i = 0; i < binaire.length; i++) octets[i] = binaire.charCodeAt(i) & 0xff
  return octets
}

const LATIN = new Set(['us-ascii', 'ascii', 'iso-8859-1', 'iso-8859-15', 'latin1', 'windows-1252', 'cp1252'])

/** Octets → texte dans le jeu de caractères annoncé (UTF-8 si inconnu). */
export function decoderCharset(octets: Uint8Array, charset: string | undefined): string {
  const nom = (charset || 'utf-8').trim().toLowerCase()
  try {
    return new TextDecoder(nom).decode(octets)
  } catch (err) {
    // Jeu de caractères non pris en charge par le moteur : latin-1 octet par octet pour
    // la famille latine, UTF-8 sinon (le texte reste lisible).
    logger.debug('[email-agent/imap] jeu de caractères non pris en charge', { charset: nom, erreur: String(err) })
    if (LATIN.has(nom)) return octetsVersBinaire(octets)
    return new TextDecoder('utf-8').decode(octets)
  }
}

function decoderQuotedPrintableBinaire(texte: string): string {
  return texte
    .replace(/=\r?\n/g, '')
    .replace(/=([0-9A-Fa-f]{2})/g, (_, hex: string) => String.fromCharCode(Number.parseInt(hex, 16)))
}

function decoderBase64Binaire(texte: string): string {
  // Données éventuellement coupées (corps tronqué) : complétées ou raccourcies au bloc près.
  const propre = texte.replace(/[^A-Za-z0-9+/=]/g, '')
  const fin = propre.indexOf('=')
  const donnees = fin === -1 ? propre : propre.slice(0, fin)
  const reste = donnees.length % 4
  const utile = reste === 1 ? donnees.slice(0, -1) : donnees + '='.repeat(reste ? 4 - reste : 0)
  try {
    return atob(utile)
  } catch (err) {
    logger.debug('[email-agent/imap] base64 illisible', { erreur: String(err) })
    return ''
  }
}

/** Mots encodés RFC 2047 (=?charset?B|Q?…?=) d'une valeur d'en-tête. */
export function decoderMotsEncodes(valeur: string): string {
  return valeur
    // Espaces entre deux mots encodés adjacents : ignorés (RFC 2047 §6.2).
    .replace(/(\?=)\s+(=\?)/g, '$1$2')
    .replace(/=\?([^?\s]+)\?([BbQq])\?([^?]*)\?=/g, (_, charset: string, enc: string, texte: string) => {
      const binaire = enc.toUpperCase() === 'B'
        ? decoderBase64Binaire(texte)
        : decoderQuotedPrintableBinaire(texte.replace(/_/g, ' '))
      return decoderCharset(binaireVersOctets(binaire), charset.split('*')[0])
    })
}

/** En-têtes « Nom: valeur » (lignes repliées réunies), noms en minuscules. */
export function analyserEntetes(bloc: string): Record<string, string> {
  const entetes: Record<string, string> = {}
  const deplie = bloc.replace(/\r?\n[ \t]+/g, ' ')
  for (const ligne of deplie.split(/\r?\n/)) {
    const i = ligne.indexOf(':')
    if (i <= 0) continue
    const nom = ligne.slice(0, i).trim().toLowerCase()
    if (!(nom in entetes)) entetes[nom] = ligne.slice(i + 1).trim()
  }
  return entetes
}

/** Content-Type → type (minuscules) et paramètres (boundary, charset). */
export function analyserContentType(valeur: string | undefined): { type: string; params: Record<string, string> } {
  const [type, ...reste] = (valeur || 'text/plain').split(';')
  const params: Record<string, string> = {}
  for (const p of reste) {
    const i = p.indexOf('=')
    if (i <= 0) continue
    params[p.slice(0, i).trim().toLowerCase()] = p.slice(i + 1).trim().replace(/^"(.*)"$/, '$1')
  }
  return { type: type.trim().toLowerCase() || 'text/plain', params }
}

const ENTITES: Record<string, string> = {
  nbsp: ' ', amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", rsquo: '’', lsquo: '‘', ldquo: '“', rdquo: '”',
  laquo: '«', raquo: '»', hellip: '…', ndash: '–', mdash: '—', euro: '€', deg: '°', oelig: 'œ',
  agrave: 'à', acirc: 'â', ccedil: 'ç', eacute: 'é', egrave: 'è', ecirc: 'ê', euml: 'ë', icirc: 'î', iuml: 'ï',
  ocirc: 'ô', ugrave: 'ù', ucirc: 'û', Eacute: 'É', Agrave: 'À',
}

/** HTML → texte brut (balises, styles et scripts retirés, entités courantes décodées). */
export function htmlVersTexte(html: string): string {
  return html
    .replace(/<(style|script|head)[\s\S]*?(<\/\1>|$)/gi, ' ')
    .replace(/<br\s*\/?>|<\/(p|div|tr|li|h\d)>/gi, '\n')
    // Balises de mise en forme dans le texte : retirées sans espace (« <b>bloqué</b>. »).
    .replace(/<\/?(a|b|i|u|em|strong|span|font|small|sup|sub)\b[^>]*>/gi, '')
    .replace(/<[^>]*>?/g, ' ')
    .replace(/&#(\d{1,7});/g, (_, n: string) => caractere(Number(n)))
    .replace(/&#x([0-9a-f]{1,6});/gi, (_, n: string) => caractere(Number.parseInt(n, 16)))
    .replace(/&([a-z]+);/gi, (m, nom: string) => ENTITES[nom] ?? ENTITES[nom.toLowerCase()] ?? m)
}

function caractere(code: number): string {
  return code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : ''
}

interface Partie {
  entetes: Record<string, string>
  /** Corps en chaîne binaire, encore encodé (Content-Transfer-Encoding). */
  corps: string
}

function decoderPartie(partie: Partie): { type: string; texte: string } {
  const { type, params } = analyserContentType(partie.entetes['content-type'])
  const cte = (partie.entetes['content-transfer-encoding'] || '').trim().toLowerCase()
  const binaire = cte === 'base64'
    ? decoderBase64Binaire(partie.corps)
    : cte === 'quoted-printable' ? decoderQuotedPrintableBinaire(partie.corps) : partie.corps
  return { type, texte: decoderCharset(binaireVersOctets(binaire), params.charset) }
}

function separerPartie(brut: string): Partie {
  const m = /\r?\n\r?\n/.exec(brut)
  if (!m) return { entetes: analyserEntetes(brut), corps: '' }
  return { entetes: analyserEntetes(brut.slice(0, m.index)), corps: brut.slice(m.index + m[0].length) }
}

/** Texte lisible d'une partie (récursif sur multipart) : text/plain, sinon text/html nettoyé. */
function texteDePartie(partie: Partie, profondeur = 0): { plain: string | null; html: string | null } {
  const { type, params } = analyserContentType(partie.entetes['content-type'])
  if (type.startsWith('multipart/') && params.boundary && profondeur < 5) {
    const delimiteur = `--${params.boundary}`
    let plain: string | null = null
    let html: string | null = null
    // Le préambule (avant le premier délimiteur) est ignoré ; la dernière partie peut être coupée.
    for (const brut of partie.corps.split(delimiteur).slice(1)) {
      if (brut.startsWith('--')) break
      const sous = texteDePartie(separerPartie(brut.replace(/^[ \t]*\r?\n/, '')), profondeur + 1)
      plain ??= sous.plain
      html ??= sous.html
      if (plain) break
    }
    return { plain, html }
  }
  if (type === 'text/plain') return { plain: decoderPartie(partie).texte, html: null }
  if (type === 'text/html') return { plain: null, html: htmlVersTexte(decoderPartie(partie).texte) }
  return { plain: null, html: null }
}

/**
 * Corps texte d'un e-mail à partir de ses en-têtes MIME (Content-Type,
 * Content-Transfer-Encoding) et de BODY[TEXT] (éventuellement tronqué).
 */
export function extraireCorpsTexte(entetes: Record<string, string>, corps: Uint8Array, longueurMax: number): string {
  const { plain, html } = texteDePartie({ entetes, corps: octetsVersBinaire(corps) })
  return (plain ?? html ?? '')
    .replace(/\r\n?/g, '\n')
    .replace(/[ \t ]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
    .slice(0, longueurMax)
}
