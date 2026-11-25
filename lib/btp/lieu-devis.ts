// Lieu d'intervention d'un devis BTP, repris sans rien retaper dans la fiche chantier (bouton « Importer l'adresse
// depuis un devis ») et dans la Météo chantiers (prévisions d'un lieu de devis qui n'est pas encore un chantier).
//
// Le formulaire de devis BTP (components/DevisFactureFormBTP.tsx) écrit le lieu d'intervention en texte libre
// (« Résidence Le Mail, 15 rue des Lilas, 13001 Marseille ») dans le contenu enregistré du devis : colonne raw_data de
// la table devis (app/api/devis/sync/route.ts), lue par COLONNES_LIEU_DEVIS sans charger tout le devis. La colonne
// client_address n'est pas écrite par la synchronisation : l'adresse du client se lit aussi dans raw_data, et ne sert
// qu'à défaut d'un lieu d'intervention. Tests : tests/lib/btp-lieu-devis.test.ts.

import type { Pays } from '@/lib/btp/geocodage'

/** Colonnes PostgREST (sélection d'une requête sur la table devis) : lieu d'intervention et adresse du client. */
export const COLONNES_LIEU_DEVIS = 'lieu_intervention:raw_data->>interventionAddress, adresse_client_devis:raw_data->>clientAddress'

/** Champs d'une ligne de la table devis lue avec COLONNES_LIEU_DEVIS (client_address : ancienne colonne, souvent vide). */
export interface DevisAvecLieuBrut {
  lieu_intervention?: unknown
  adresse_client_devis?: unknown
  client_address?: unknown
}

export interface LieuDevis {
  /** Texte tel qu'écrit dans le devis (espaces et retours à la ligne réduits). */
  texte: string
  /** `intervention` : lieu d'intervention du devis ; `client` : à défaut, adresse du client. */
  source: 'intervention' | 'client'
}

export interface ChampsAdresse {
  adresse: string
  codePostal: string
  ville: string
}

const enTexte = (valeur: unknown) => (typeof valeur === 'string' ? valeur.replace(/\s+/g, ' ').trim() : '')

/** Nom de pays seul (« France », « Portugal ») : ni une ville ni une adresse. */
const NOM_DE_PAYS = /^(france|portugal)$/i

/** Parties d'un lieu (séparées par une virgule ou un « - » entre espaces), sans parties vides ni noms de pays. */
const partiesDuLieu = (texte: string) => texte.split(/,|\s+-\s+/).map(p => p.trim()).filter(p => p && !NOM_DE_PAYS.test(p))

/**
 * Texte utilisable comme adresse : autre chose qu'un nom de pays. Le formulaire de devis compose l'adresse du client à
 * partir de ses champs et y ajoute le pays : rue, code postal et ville vides donnent « Portugal » seul.
 */
const utilisable = (texte: string) => partiesDuLieu(texte).some(p => /[\p{L}\d]/u.test(p))

/** Lieu d'intervention du devis, sinon l'adresse de son client ; null sans l'un ni l'autre. */
export function lieuDuDevis(devis: DevisAvecLieuBrut): LieuDevis | null {
  const intervention = enTexte(devis.lieu_intervention)
  if (utilisable(intervention)) return { texte: intervention, source: 'intervention' }
  const client = [devis.adresse_client_devis, devis.client_address].map(enTexte).find(utilisable)
  return client ? { texte: client, source: 'client' } : null
}

/** Code postal ; au Portugal, seulement la forme complète (« 1974 » peut être une année : 25 de Abril). */
const CODE_POSTAL: Record<Pays, string> = { FR: String.raw`\d{5}`, PT: String.raw`\d{4}-\d{3}` }

/**
 * Code postal suivi de sa ville (« 13001 Marseille », « 4050-036 Porto »). Un nombre suivi d'une virgule n'en est pas
 * un (« BP 50012, », « Estrada Nacional 12345, Braga »).
 */
const codePostalVille = (pays: Pays) => new RegExp(String.raw`\b(${CODE_POSTAL[pays]})\s+(?=(\p{L}+))`, 'gu')

/** Code postal seul, suivi d'une virgule, d'un « - » ou de la fin du texte. */
const codePostalSeul = (pays: Pays) => new RegExp(String.raw`\b(${CODE_POSTAL[pays]})(?=\s*(?:,|-|$))`, 'gu')

/** Numéro de boîte postale juste avant (sans assertion arrière : absente des anciens Safari d'iPhone). */
const BOITE_POSTALE_AVANT = /\b(?:BP|CS|Apartado)\s?$/i

/** Premier code postal seul qui n'est pas un numéro de boîte postale. */
function codePostalSansVille(texte: string, pays: Pays): { index: number; longueur: number; codePostal: string } | null {
  const retenu = [...texte.matchAll(codePostalSeul(pays))].find(t => !BOITE_POSTALE_AVANT.test(texte.slice(0, t.index)))
  return retenu ? { index: retenu.index, longueur: retenu[0].length, codePostal: retenu[1] } : null
}

/** Mot qui suit un numéro de rue à cinq chiffres (numérotation métrique : « 12500 route de Grasse »), pas une ville. */
const VOIE = /^(?:route|rue|avenue|av|boulevard|bd|chemin|impasse|all[ée]e|place|quai|cours|rua|avenida|estrada|travessa|largo|pra[çc]a)$/iu

/** Code postal suivi de sa ville : le dernier qui n'est pas un numéro de rue (« 12500 route de Grasse, 06130 Grasse »). */
function codePostalAvecVille(texte: string, pays: Pays): { index: number; longueur: number; codePostal: string } | null {
  const trouves = [...texte.matchAll(codePostalVille(pays))]
  const retenu = trouves.findLast(t => !VOIE.test(t[2])) ?? trouves.at(-1)
  return retenu ? { index: retenu.index, longueur: retenu[0].length, codePostal: retenu[1] } : null
}

/** Découpe autour du code postal trouvé : la ville est la partie qui le suit, tout le reste va dans l'adresse. */
function autourDuCodePostal(texte: string, t: { index: number; longueur: number; codePostal: string }): ChampsAdresse {
  const avant = partiesDuLieu(texte.slice(0, t.index))
  const [ville = '', ...complements] = partiesDuLieu(texte.slice(t.index + t.longueur))
  return { adresse: [...avant, ...complements].join(', '), codePostal: t.codePostal, ville }
}

/**
 * Rue, code postal et ville d'un lieu écrit en une ligne, pour les champs de la fiche chantier. Code postal suivi de sa
 * ville, du pays de la société d'abord, puis de l'autre pays (chantier de l'autre côté de la frontière) ; à défaut, code
 * postal seul du pays de la société (« 13001, Marseille », « Lieu-dit Les Granges, 84000 »). La ville est la partie qui
 * suit le code postal ; tout le reste (résidence, rue, bâtiment, étage, avant ou après) va dans l'adresse, rien ne se
 * perd. Sans code postal, la dernière partie (sans chiffre) est la ville.
 */
export function champsAdresseDuLieu(lieu: string, pays: Pays): ChampsAdresse {
  const texte = enTexte(lieu)
  for (const essai of [pays, pays === 'PT' ? 'FR' : 'PT'] as const) {
    const trouve = codePostalAvecVille(texte, essai)
    if (trouve) return autourDuCodePostal(texte, trouve)
  }
  const seul = codePostalSansVille(texte, pays)
  if (seul) return autourDuCodePostal(texte, seul)
  const parties = partiesDuLieu(texte)
  const derniere = parties.at(-1) ?? ''
  if (parties.length >= 2 && !/\d/.test(derniere)) return { adresse: parties.slice(0, -1).join(', '), codePostal: '', ville: derniere }
  return { adresse: parties.join(', '), codePostal: '', ville: '' }
}

/** Lieu abrégé pour une liste de choix (le texte entier reste dans le titre de l'option). */
export function lieuAbrege(texte: string, longueurMax = 60): string {
  return texte.length <= longueurMax ? texte : `${texte.slice(0, longueurMax - 1).trimEnd()}…`
}

/** Ligne d'une liste de choix de devis : numéro (ou brouillon), client, lieu, et la mention d'une adresse du client. */
export function libelleChoixDevis(
  devis: { numero?: string | null; client_name?: string | null },
  lieu: LieuDevis,
  isPt: boolean,
): string {
  const numero = devis.numero?.trim() || (isPt ? 'Rascunho' : 'Brouillon')
  const parties = [numero, devis.client_name?.trim(), lieuAbrege(lieu.texte)].filter(Boolean)
  const mention = lieu.source === 'client' ? (isPt ? ' (morada do cliente)' : ' (adresse du client)') : ''
  return `${parties.join(' · ')}${mention}`
}

/** Message affiché après l'import d'une adresse : d'où elle vient, et ce qui reste à vérifier. */
export function messageAdresseImportee(numero: string | null | undefined, lieu: LieuDevis, champs: ChampsAdresse, isPt: boolean): string {
  const ref = numero?.trim() || (isPt ? 'rascunho' : 'brouillon')
  const base = isPt ? `Morada importada do orçamento ${ref}.` : `Adresse reprise du devis ${ref}.`
  // L'adresse du client peut être celle d'un siège : elle n'est pas géocodée d'office (la position déclenche le pointage).
  const client = lieu.source === 'client'
    ? (isPt
      ? ' Sem local de intervenção no orçamento: é a morada do cliente. Verifique-a e use o botão GPS.'
      : ' Pas de lieu d’intervention sur ce devis : c’est l’adresse du client. Vérifiez-la, puis utilisez le bouton GPS.')
    : ''
  const ville = champs.ville ? '' : (isPt ? ' Indique a cidade.' : ' Indiquez la ville.')
  return `${base}${client}${ville}`
}

// ── Météo chantiers : lieux de devis suivis, gardés sur l'appareil ──

/** Lieu d'un devis ajouté à la Météo chantiers (instantané pris à l'import : un devis modifié se réimporte). */
export interface LieuMeteoDevis {
  devisId: string
  numero: string
  client: string
  lieu: string
  source: LieuDevis['source']
}

/** Au plus vingt lieux suivis : au-delà, les plus anciens partent. */
export const LIEUX_METEO_MAX = 20

/** Clé de stockage des lieux suivis d'une fiche (hors préfixe `fixit_` : propre à l'appareil, jamais envoyée au serveur). */
export const cleLieuxMeteo = (ficheId: string) => `vitfix_btp_meteo_devis_${ficheId}`

/** Lieux suivis relus du stockage : toute entrée incomplète ou en double est écartée. */
export function lieuxMeteoValides(lu: unknown): LieuMeteoDevis[] {
  if (!Array.isArray(lu)) return []
  const vus = new Set<string>()
  const lieux: LieuMeteoDevis[] = []
  for (const e of lu) {
    if (!e || typeof e !== 'object') continue
    const { devisId, numero, client, lieu, source } = e as Record<string, unknown>
    if (typeof devisId !== 'string' || !devisId || vus.has(devisId)) continue
    if (typeof lieu !== 'string' || !lieu.trim()) continue
    vus.add(devisId)
    lieux.push({
      devisId,
      numero: typeof numero === 'string' ? numero : '',
      client: typeof client === 'string' ? client : '',
      lieu: lieu.trim(),
      source: source === 'client' ? 'client' : 'intervention',
    })
  }
  return lieux.slice(-LIEUX_METEO_MAX)
}

/** Ajoute (ou remplace, s'il est déjà suivi) le lieu d'un devis, en dernier. */
export function ajouterLieuMeteo(lieux: readonly LieuMeteoDevis[], nouveau: LieuMeteoDevis): LieuMeteoDevis[] {
  return [...lieux.filter(l => l.devisId !== nouveau.devisId), nouveau].slice(-LIEUX_METEO_MAX)
}

/** Préfixe de l'identifiant d'une carte météo de devis (distinct de l'identifiant d'un chantier). */
export const PREFIXE_CARTE_DEVIS = 'devis:'
