/**
 * Outils IA de la succursale Administrateur judiciaire (Claude Sonnet 5.5, via app/api/administrateur-judiciaire/outils) :
 * analyse d'un devis ou d'une facture collé(e) en texte, projet de procès-verbal d'assemblée générale, lecture d'une
 * facture fournisseur (image ou PDF). Constantes, formes et fonctions pures partagées entre les écrans et la route.
 */
import type { CoproprieteVue } from '@/lib/administrateur-judiciaire/domain/coproprietes'
import { dateVersIso } from '@/lib/administrateur-judiciaire/domain/dates'

export type TacheOutilAJ = 'analyse-devis' | 'redaction-pv' | 'saisie-facture'

/** Texte de devis ou de facture collé : au-delà, l'écran refuse l'envoi (la route aussi). */
export const TAILLE_MAX_TEXTE_DEVIS = 30_000

/** Facture fournisseur à lire : 4 Mo au plus (octets du fichier, avant encodage base64). */
export const TAILLE_MAX_FICHIER_FACTURE = 4 * 1024 * 1024

/** Formats lus par Claude (vision pour les images, bloc document pour le PDF). */
export const TYPES_FICHIER_FACTURE = ['image/png', 'image/jpeg', 'image/webp', 'application/pdf'] as const
export type TypeFichierFacture = (typeof TYPES_FICHIER_FACTURE)[number]

const TYPE_PAR_EXTENSION: Record<string, TypeFichierFacture> = {
  pdf: 'application/pdf',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
}

/**
 * Type d'une facture à lire : type MIME déclaré (« image/jpg » accepté pour « image/jpeg »), ou extension du nom
 * quand le navigateur ne fournit pas de type. Null : format non pris en charge.
 */
export function typeFichierFacture(type: string, nom: string): TypeFichierFacture | null {
  const declare = type.trim().toLowerCase() === 'image/jpg' ? 'image/jpeg' : type.trim().toLowerCase()
  if ((TYPES_FICHIER_FACTURE as readonly string[]).includes(declare)) return declare as TypeFichierFacture
  if (declare && declare !== 'application/octet-stream') return null
  const extension = /\.([a-z0-9]+)$/i.exec(nom.trim())?.[1]?.toLowerCase() ?? ''
  return TYPE_PAR_EXTENSION[extension] ?? null
}

export type VerificationFichierFacture =
  | { ok: true; type: TypeFichierFacture; octets: number }
  | { ok: false; raison: 'format' | 'taille' }

/**
 * Contrôle d'une facture reçue en data URL base64 (« data:<type>;base64,<données> ») sans la décoder : type accepté,
 * base64 bien formé, taille décodée de 4 Mo au plus.
 */
export function verifierDataUrlFacture(dataUrl: string): VerificationFichierFacture {
  const entete = /^data:([a-z]+\/[a-z0-9.+-]+);base64,/i.exec(dataUrl)
  const type = entete ? typeFichierFacture(entete[1], '') : null
  if (!entete || !type) return { ok: false, raison: 'format' }
  const donnees = dataUrl.slice(entete[0].length)
  const remplissage = donnees.endsWith('==') ? 2 : donnees.endsWith('=') ? 1 : 0
  const octets = Math.floor((donnees.length * 3) / 4) - remplissage
  if (octets > TAILLE_MAX_FICHIER_FACTURE) return { ok: false, raison: 'taille' }
  if (!donnees || donnees.length % 4 !== 0 || !/^[A-Za-z0-9+/]+={0,2}$/.test(donnees)) return { ok: false, raison: 'format' }
  // Le type déclaré vient du navigateur (extension du fichier) : on le vérifie sur les premiers octets.
  if (!signatureConforme(donnees.slice(0, 24), type)) return { ok: false, raison: 'format' }
  return { ok: true, type, octets }
}

/** Premiers octets (base64) conformes au type annoncé : %PDF, PNG, JPEG (FF D8 FF), RIFF….WEBP. */
function signatureConforme(debutBase64: string, type: TypeFichierFacture): boolean {
  let octets: string
  try {
    octets = atob(debutBase64)
  } catch {
    return false
  }
  const code = (i: number) => octets.charCodeAt(i)
  if (type === 'application/pdf') return octets.startsWith('%PDF')
  if (type === 'image/png') return code(0) === 0x89 && octets.slice(1, 4) === 'PNG'
  if (type === 'image/jpeg') return code(0) === 0xff && code(1) === 0xd8 && code(2) === 0xff
  return octets.startsWith('RIFF') && octets.slice(8, 12) === 'WEBP'
}

/** Informations lues sur une facture fournisseur (null : absente ou illisible). Montants en euros. */
export interface FactureExtraite {
  fournisseur: string | null
  siret: string | null
  numero: string | null
  /** Date d'émission, AAAA-MM-JJ quand le modèle respecte la consigne. */
  date: string | null
  montant_ht: number | null
  /** Montant total de la TVA. */
  tva: number | null
  montant_ttc: number | null
  copropriete_probable: string | null
  compte_charge_suggere: string | null
  libelle: string | null
}

const CHAMPS_TEXTE = ['fournisseur', 'siret', 'numero', 'date', 'copropriete_probable', 'compte_charge_suggere', 'libelle'] as const
const CHAMPS_MONTANT = ['montant_ht', 'tva', 'montant_ttc'] as const

/** Montant lu : nombre, ou chaîne « 1 234,56 € », « 1234.56 », « 1.234,56 » ; null sinon. Arrondi au centime. */
export function lireMontant(valeur: unknown): number | null {
  if (typeof valeur === 'number') return Number.isFinite(valeur) ? Math.round(valeur * 100) / 100 : null
  if (typeof valeur !== 'string') return null
  let texte = valeur.replace(/[\s  €]/g, '').replace(/eur(os?)?$/i, '')
  if (texte.includes(',') && texte.includes('.')) {
    // Le dernier séparateur est le séparateur décimal ; l'autre sépare les milliers.
    texte = texte.lastIndexOf(',') > texte.lastIndexOf('.') ? texte.replace(/\./g, '').replace(',', '.') : texte.replace(/,/g, '')
  } else if ((texte.match(/,/g) ?? []).length === 1) {
    texte = texte.replace(',', '.')
  }
  if (!/^-?\d+(\.\d+)?$/.test(texte)) return null
  return Math.round(Number(texte) * 100) / 100
}

const lireTexte = (valeur: unknown): string | null => {
  if (typeof valeur === 'number' && Number.isFinite(valeur)) return String(valeur)
  if (typeof valeur !== 'string') return null
  const texte = valeur.trim()
  return texte && texte.toLowerCase() !== 'null' ? texte.slice(0, 300) : null
}

/**
 * Réponse JSON du modèle → facture extraite : champs attendus seulement, textes bornés, montants convertis.
 * Null si la réponse n'est pas un objet ou si aucune information n'a été lue.
 */
export function normaliserFactureExtraite(brut: unknown): FactureExtraite | null {
  if (!brut || typeof brut !== 'object' || Array.isArray(brut)) return null
  const objet = brut as Record<string, unknown>
  const facture = {} as FactureExtraite
  for (const champ of CHAMPS_TEXTE) facture[champ] = lireTexte(objet[champ])
  for (const champ of CHAMPS_MONTANT) facture[champ] = lireMontant(objet[champ])
  return Object.values(facture).some((valeur) => valeur !== null) ? facture : null
}

/** Vrai si HT + TVA s'écarte de TTC de plus d'un centime d'arrondi (faux si un des trois montants manque). */
export function montantsIncoherents(montants: Pick<FactureExtraite, 'montant_ht' | 'tva' | 'montant_ttc'>): boolean {
  const { montant_ht: ht, tva, montant_ttc: ttc } = montants
  if (ht === null || tva === null || ttc === null) return false
  return Math.abs(ht + tva - ttc) > 0.05
}

/**
 * Markdown rédigé par l'IA → texte brut à coller dans un courrier ou un traitement de texte : marques de titre, de
 * gras, d'italique, de code et de lien retirées ; puces, numéros et tableaux conservés tels quels.
 */
export function markdownVersTexteBrut(markdown: string): string {
  return markdown
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((ligne) =>
      ligne
        .replace(/^(\s*)#{1,6}\s+/, '$1')
        .replace(/\*\*([^*\n]+?)\*\*|__([^_\n]+?)__/g, (_, gras: string | undefined, souligne: string | undefined) => gras ?? souligne ?? '')
        .replace(/(^|[^*\w])\*([^*\s][^*\n]*?)\*(?!\*)/g, '$1$2')
        .replace(/(^|[\s(])_([^_\s][^_\n]*?)_(?=$|[\s).,;:!?])/g, '$1$2')
        .replace(/`([^`\n]+)`/g, '$1')
        .replace(/\[([^\]\n]+)\]\((https?:\/\/[^)\s]+)\)/g, '$1 ($2)'),
    )
    .join('\n')
}

/**
 * Contexte du projet de procès-verbal : la copropriété choisie et son mandat de justice tels qu'enregistrés dans la
 * base locale (null si le nom choisi n'y figure pas, ex. sélecteur de démonstration en mode réel). Fonction pure.
 */
export function construireContextePv(entree: {
  aujourdhui: string
  mode: 'demo' | 'reel'
  copropriete: string
  copros: readonly CoproprieteVue[]
}): Record<string, unknown> {
  const copro = entree.copros.find((candidate) => candidate.nom === entree.copropriete)
  return {
    dateDuJour: entree.aujourdhui,
    mode: entree.mode === 'demo' ? 'démonstration (données fictives)' : 'données réelles du cabinet',
    copropriete: copro
      ? {
          code: copro.code,
          nom: copro.nom,
          adresse: copro.adresse || null,
          lots: copro.lots,
          mandat: {
            fondement: copro.fondement || null,
            motif: copro.motif || null,
            tribunal: copro.tribunal || null,
            rg: copro.rg || null,
            ordonnance: dateVersIso(copro.ordonnance),
            dureeMois: copro.dureeMois || null,
            finDeMission: dateVersIso(copro.echeance),
            statut: copro.statut || null,
          },
        }
      : null,
  }
}
