import { mapLegalFormToCode } from '@/lib/devis-utils'

/** Libellés du statut juridique affichés par le formulaire de devis et facture BTP, par code interne. */
const LIBELLE_PAR_CODE: Record<string, string> = {
  ei: 'Entreprise Individuelle (EI)',
  eurl: 'EURL',
  sarl: 'SARL',
  sas: 'SAS',
  sasu: 'SASU',
  ae: 'Auto-entrepreneur',
  sa: 'SA',
}

const STATUT_PAR_DEFAUT = 'Entreprise Individuelle (EI)'

/** Forme juridique portugaise : motif reconnu, code interne du PDF, libellé affiché, capital social exigé. */
interface FormePortugaise {
  motif: RegExp
  code: string
  libelle: string
  capital: boolean
}

/**
 * Formes juridiques portugaises d'une société BTP, celles de l'inscription portugaise (lib/config/companyTypes.ts,
 * libellés portugais et français) et leurs abréviations : libellé affiché par le formulaire et code interne du PDF
 * (getStatusLabel). mapLegalFormToCode, partagé avec le côté artisan, ne les connaît pas et les rendait toutes en
 * 'ei' : une société par quotas s'affichait « Entreprise Individuelle (EI) ». Ordre : Unipessoal avant Lda
 * (« Unipessoal Lda. » contient « Lda »). Aucune forme française ne contient ces mots (la SNC, l'EIRL et la
 * coopérative françaises restent à mapLegalFormToCode : seuls les libellés « (Portugal) » de l'inscription sont pris).
 * Capital social exigé dans les mentions : sociétés par quotas et anonymes (art. 171.º du Código das Sociedades
 * Comerciais) ; pas la société en nom collectif, la commandite simple, la coopérative ni l'entrepreneur individuel.
 */
const FORMES_PORTUGAISES: ReadonlyArray<FormePortugaise> = [
  { motif: /\bunipessoal\b/, code: 'unipessoal', libelle: 'Sociedade Unipessoal por Quotas (Unipessoal Lda.)', capital: true },
  { motif: /\bquotas\b|\blda\b/, code: 'lda', libelle: 'Sociedade por Quotas (Lda.)', capital: true },
  { motif: /\banonima\b|^sa \(portugal\)$/, code: 'sa', libelle: 'Sociedade Anónima (SA)', capital: true },
  { motif: /\bestabelecimento individual\b|^eirl \(portugal\)$/, code: 'eirl_pt', libelle: 'Estabelecimento Individual de Responsabilidade Limitada (EIRL)', capital: false },
  { motif: /\bnome coletivo\b|^snc \(portugal\)$/, code: 'snc_pt', libelle: 'Sociedade em Nome Coletivo', capital: false },
  { motif: /\bcomandita\b/, code: 'comandita', libelle: 'Sociedade em Comandita', capital: false },
  { motif: /\bcooperativa\b|^cooperative \(portugal\)$/, code: 'cooperativa', libelle: 'Cooperativa', capital: false },
  { motif: /\bnome individual\b|\beni\b/, code: 'eni', libelle: 'Empresário em Nome Individual (ENI)', capital: false },
]

/** Sans accents, majuscules ni points, espaces simples (comme mapLegalFormToCode). */
function normaliserForme(forme: string): string {
  return forme.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/\./g, '').replace(/\s+/g, ' ').trim()
}

function formePortugaise(forme: string | null | undefined): FormePortugaise | undefined {
  const texte = normaliserForme(String(forme || ''))
  return texte ? FORMES_PORTUGAISES.find(({ motif }) => motif.test(texte)) : undefined
}

/**
 * Code interne (ei, sarl, lda…) du statut juridique d'un document BTP, pour le PDF : forme portugaise d'abord,
 * sinon mapLegalFormToCode. Les libellés français du formulaire (« SARL », « Entreprise Individuelle (EI) »…)
 * donnent exactement le même code qu'avant.
 */
export function codeStatutJuridiqueBtp(statut: string | null | undefined): string {
  return formePortugaise(statut)?.code ?? mapLegalFormToCode(String(statut || ''))
}

/** Libellés français du formulaire dont le capital social est exigé (liste d'origine, inchangée). */
const STATUTS_FRANCAIS_A_CAPITAL = ['SARL', 'EURL', 'SAS', 'SASU', 'SA']

/**
 * Capital social exigé dans les mentions : libellés français d'origine (SARL, EURL, SAS, SASU, SA), ou société
 * portugaise par quotas ou anonyme (Lda, Unipessoal Lda., SA).
 */
export function statutAvecCapitalSocial(statut: string | null | undefined): boolean {
  const portugaise = formePortugaise(statut)
  return portugaise ? portugaise.capital : STATUTS_FRANCAIS_A_CAPITAL.includes(String(statut || ''))
}

/** Forme juridique portugaise (Lda, SA portugaise, ENI…) : mentions de la société portugaise. */
export function statutPortugais(statut: string | null | undefined): boolean {
  return formePortugaise(statut) !== undefined
}

/** Société (pessoa coletiva ou EIRL), par opposition à l'entrepreneur individuel : forme portugaise autre que l'ENI. */
function societePortugaise(statut: string): boolean {
  const portugaise = formePortugaise(statut)
  return portugaise !== undefined && portugaise.code !== 'eni'
}

/**
 * Mention d'identification du bloc « mentions légales » du formulaire BTP.
 * - Sur /pt : toute société dont le capital est exigé (Lda, SA, mais aussi SARL, SAS… d'une société française) lit
 *   sa forme, son capital, son registre et sa sede ; une autre société portugaise (SNC, coopérative…) sa forme, son
 *   registre et sa sede ; sinon la mention de l'entrepreneur individuel, inchangée. Avant, toute société y lisait
 *   « Empresário em Nome Individual (ENI) ».
 * - Sur /fr : une société portugaise lit sa forme (sans RCS français) ; null pour une forme française, dont les
 *   mentions d'origine restent dans le formulaire.
 */
export function mentionIdentificationBtp(p: {
  statut: string
  capital: string
  registre: string
  adresse: string
  langue: 'fr' | 'pt'
}): string | null {
  const registre = p.registre.trim() ? ` — ${p.registre.trim()}` : ''
  if (p.langue === 'pt') {
    const sede = `Sede: ${p.adresse || '[morada a indicar]'}.`
    if (statutAvecCapitalSocial(p.statut)) return `${p.statut} com capital social de ${p.capital || '[capital a indicar]'} €${registre}. ${sede}`
    if (societePortugaise(p.statut)) return `${p.statut}${registre}. ${sede}`
    return 'Empresário em Nome Individual (ENI) — Código Comercial Português.'
  }
  if (!statutPortugais(p.statut)) return null
  const siege = `Siège social : ${p.adresse || '[adresse à renseigner]'}.`
  if (statutAvecCapitalSocial(p.statut)) return `${p.statut} au capital de ${p.capital || '[capital à renseigner]'} €${registre}. ${siege}`
  return `${p.statut}${registre}. ${siege}`
}

/**
 * Un document est émis quand il porte un numéro légal (DEV-, FACT-, AV-, AC-…). Un brouillon n'a pas de
 * numéro, ou un numéro provisoire BR- : le numéro légal n'est tiré qu'à l'émission (saveAndSend).
 */
export function documentEmis(numero: string | null | undefined): boolean {
  const n = String(numero || '').trim()
  return n !== '' && !n.toUpperCase().startsWith('BR-')
}

/**
 * Document déjà enregistré (brouillon ou émis) : il a un identifiant, un horodatage d'enregistrement ou un numéro
 * légal. Un document tiré d'un autre est neuf : l'avoir perd identifiant et horodatage, et le duplicata BTP reçoit
 * un nouvel identifiant marqué `isDuplicate` (DevisSection), sans être encore enregistré.
 */
export function documentExistant(
  document: { id?: unknown; savedAt?: unknown; docNumber?: string | null; isDuplicate?: unknown } | null | undefined,
): boolean {
  if (!document || document.isDuplicate) return false
  return Boolean(document.savedAt) || Boolean(document.id) || documentEmis(document.docNumber)
}

/**
 * Forme juridique d'un document BTP déjà enregistré : la sienne. Exception, une société portugaise (forme
 * portugaise au profil) n'a jamais de forme française : ses documents enregistrés avant la reconnaissance des
 * formes portugaises (17/11/2026) portent « Entreprise Individuelle (EI) », repli de mapLegalFormToCode, et
 * prennent la forme portugaise du profil, à l'ouverture comme au téléchargement (demande de Frédéric du
 * 20/11/2026). Un document portant déjà une forme portugaise la garde ; une société française garde exactement
 * la forme de ses documents.
 */
export function statutJuridiqueDocumentBtp(statutDocument: string | null | undefined, formeProfil: string | null | undefined): string {
  const duDocument = String(statutDocument || '')
  const profilPortugais = formePortugaise(formeProfil)
  return profilPortugais && !formePortugaise(duDocument) ? profilPortugais.libelle : duDocument
}

/**
 * Statut juridique initial du formulaire de devis et facture BTP. Le champ est verrouillé, « défini à
 * l'inscription ». Un document déjà enregistré garde le sien : le formulaire réenregistre un brouillon dès son
 * ouverture, et un document existant ne doit pas être modifié à son insu. Seule exception, voulue par Frédéric le
 * 20/11/2026 : la forme française d'un document d'une société portugaise (statutJuridiqueDocumentBtp), qu'un
 * brouillon réenregistre donc corrigée. Un nouveau document, même tiré d'un plus ancien (facture depuis un devis,
 * avoir, duplication), prend la forme du profil : avant, il recopiait celle du document source, restée en EI quand
 * le profil n'avait pas encore de forme juridique.
 */
export function statutJuridiqueInitialBtp(
  document: { companyStatus?: string | null; docNumber?: string | null; id?: unknown; savedAt?: unknown; isDuplicate?: unknown } | null | undefined,
  formeProfil: string | null | undefined,
): string {
  const duDocument = document?.companyStatus || ''
  const forme = String(formeProfil || '').trim()
  if (duDocument && (documentExistant(document) || !forme)) return statutJuridiqueDocumentBtp(duDocument, forme)
  if (forme) return formePortugaise(forme)?.libelle ?? (LIBELLE_PAR_CODE[mapLegalFormToCode(forme)] || STATUT_PAR_DEFAUT)
  return duDocument || STATUT_PAR_DEFAUT
}

/**
 * Couverture géographique d'assurance d'un document ou d'une fiche BTP : celle saisie, sauf, pour une société
 * portugaise, « France métropolitaine » (défaut de la colonne insurance_coverage de profiles_artisan, recopié dans
 * ses documents) : chaîne vide, pour passer à la source suivante ou au défaut portugais. Une société française lit
 * exactement la valeur enregistrée, comme avant.
 */
export function couvertureAssuranceBtp(couverture: string | null | undefined, formeProfil: string | null | undefined): string {
  const saisie = String(couverture ?? '')
  return statutPortugais(formeProfil) && normaliserForme(saisie) === 'france metropolitaine' ? '' : saisie
}

/** Type d'assurance d'un document BTP (champ insuranceType). */
export type TypeAssuranceBtp = 'rc_pro' | 'decennale' | 'both'

function typeAssuranceBtp(type: string | null | undefined): TypeAssuranceBtp | undefined {
  return type === 'rc_pro' || type === 'decennale' || type === 'both' ? type : undefined
}

/**
 * Assurance d'un document BTP enregistré, au téléchargement depuis la liste et dans le ZIP. Une société française
 * lit exactement celle du document, comme avant. Une société portugaise lit celle que le formulaire affiche à
 * l'ouverture (demande de Frédéric du 21/11/2026). Un document enregistré sans nom d'assureur, comme ses orçamentos
 * émis avant que la fiche ne soit complétée, reprend l'assureur de la fiche, nom et numéro de police (sans nom, les
 * modèles n'impriment aucune mention). Un document qui a un nom d'assureur garde le sien, numéro compris. Écart
 * voulu avec le formulaire, qui complète chaque champ séparément : le nom d'un assureur n'est jamais imprimé avec le
 * numéro de police d'un autre. La couverture est celle du document, sinon celle de la fiche, sinon « Portugal
 * continental » ; « France métropolitaine », défaut de la colonne, n'est jamais la sienne.
 */
export function assuranceDocumentBtp(
  document: { insuranceName?: string | null; insuranceNumber?: string | null; insuranceType?: TypeAssuranceBtp | null; insuranceCoverage?: string | null },
  fiche: { legal_form?: string | null; insurance_name?: string | null; insurance_number?: string | null; insurance_type?: string | null; insurance_coverage?: string | null },
): { insuranceName: string; insuranceNumber: string; insuranceType: TypeAssuranceBtp; insuranceCoverage: string } {
  const duDocument = {
    insuranceName: document.insuranceName || '',
    insuranceNumber: document.insuranceNumber || '',
    insuranceType: document.insuranceType || 'rc_pro',
    insuranceCoverage: couvertureAssuranceBtp(document.insuranceCoverage, fiche.legal_form),
  }
  if (!statutPortugais(fiche.legal_form)) return duDocument
  const insuranceCoverage = duDocument.insuranceCoverage
    || couvertureAssuranceBtp(fiche.insurance_coverage, fiche.legal_form) || 'Portugal continental'
  const nomFiche = String(fiche.insurance_name || '').trim()
  if (String(duDocument.insuranceName).trim() !== '' || !nomFiche) return { ...duDocument, insuranceCoverage }
  return {
    insuranceName: nomFiche,
    insuranceNumber: String(fiche.insurance_number || '').trim(),
    insuranceType: document.insuranceType || typeAssuranceBtp(fiche.insurance_type) || 'rc_pro',
    insuranceCoverage,
  }
}

/**
 * Document BTP émis en un clic, sans repasser par le formulaire (facture totale, acompte par taux) : forme juridique
 * du profil au jour de l'émission, comme le RIB (`appliquerRibCourant`), au lieu de celle recopiée du devis. Le
 * document est neuf : rien d'enregistré n'est modifié. Sans forme au profil, celle du devis reste. Société
 * portugaise : « France métropolitaine » recopiée du devis est retirée (couvertureAssuranceBtp), la couverture de la
 * fiche la remplace à l'ouverture.
 */
export function appliquerFormeProfil<T extends Record<string, unknown>>(payload: T, formeProfil: string | null | undefined): T {
  if (!String(formeProfil || '').trim()) return payload
  const avecForme = { ...payload, companyStatus: statutJuridiqueInitialBtp(undefined, formeProfil) }
  const couverture = payload.insuranceCoverage
  return typeof couverture === 'string' && couverture && !couvertureAssuranceBtp(couverture, formeProfil)
    ? { ...avecForme, insuranceCoverage: '' }
    : avecForme
}
