// Lieu d'intervention d'un devis BTP, repris sans rien retaper dans la fiche chantier (bouton « Importer l'adresse
// depuis un devis ») et dans la Météo chantiers (prévisions d'un lieu de devis qui n'est pas encore un chantier).
//
// Le formulaire de devis BTP (components/DevisFactureFormBTP.tsx) écrit le lieu d'intervention en texte libre
// (« Résidence Le Mail, 15 rue des Lilas, 13001 Marseille ») dans le contenu enregistré du devis : colonne raw_data de
// la table devis (app/api/devis/sync/route.ts), lue par COLONNES_LIEU_DEVIS sans charger tout le devis. La colonne
// client_address n'est pas écrite par la synchronisation : l'adresse du client se lit aussi dans raw_data, et ne sert
// qu'à défaut d'un lieu d'intervention. Tests : tests/lib/btp-lieu-devis.test.ts.

import { decomposerAdresse, type Pays } from '@/lib/btp/geocodage'

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

/** Lieu d'intervention du devis, sinon l'adresse de son client ; null sans l'un ni l'autre. */
export function lieuDuDevis(devis: DevisAvecLieuBrut): LieuDevis | null {
  const intervention = enTexte(devis.lieu_intervention)
  if (intervention) return { texte: intervention, source: 'intervention' }
  const client = enTexte(devis.adresse_client_devis) || enTexte(devis.client_address)
  return client ? { texte: client, source: 'client' } : null
}

/** Pays « France » ou « Portugal » écrit en fin d'adresse : ce n'est pas la ville. */
const PAYS_EN_FIN = /^(france|portugal)$/i

/**
 * Rue, code postal et ville d'un lieu écrit en une ligne, pour les champs de la fiche chantier. Code postal du pays de la
 * société d'abord, puis de l'autre pays (chantier de l'autre côté de la frontière) ; la ville est ce qui suit le code
 * postal, jusqu'à la virgule suivante. Sans code postal, la dernière partie après une virgule (sans chiffre) est la ville.
 */
export function champsAdresseDuLieu(lieu: string, pays: Pays): ChampsAdresse {
  const texte = enTexte(lieu)
  for (const essai of [pays, pays === 'PT' ? 'FR' : 'PT'] as const) {
    const { rue, codePostal, ville } = decomposerAdresse({ adresse: texte }, essai)
    if (codePostal) {
      const villeSeule = ville.split(',').map(p => p.trim()).find(p => p && !PAYS_EN_FIN.test(p)) ?? ''
      return { adresse: rue, codePostal, ville: villeSeule }
    }
  }
  const parties = texte.split(',').map(p => p.trim()).filter(p => p && !PAYS_EN_FIN.test(p))
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
  const client = lieu.source === 'client'
    ? (isPt ? ' Sem local de intervenção no orçamento: é a morada do cliente.' : ' Pas de lieu d’intervention sur ce devis : c’est l’adresse du client.')
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
