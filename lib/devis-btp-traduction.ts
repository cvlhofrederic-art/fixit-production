import { REGIME_ERROR_MESSAGES, type TvaRegimeError } from '@/lib/tva-calculator'
import TEXTES_ECRAN_PT from '@/lib/devis-btp-traduction-pt.json'

/**
 * Formulaire de devis et facture BTP (components/DevisFactureFormBTP.tsx) et sa fenêtre « Rentabilité du devis »
 * (components/dashboard/btp/RentabiliteDevisModal.tsx) en portugais européen, sur /pt.
 *
 * Le formulaire était écrit en dur en français : sur /pt, toute la création de devis restait en français (constat
 * de Frédéric du 17/11/2026). Chaque texte de l'écran passe par `tx('texte français')` ; le dictionnaire
 * lib/devis-btp-traduction-pt.json donne sa version portugaise (JSON, comme locales/pt.json). En français, `tx` rend
 * le texte tel quel : l'écran français est inchangé.
 *
 * Règles :
 * - vocabulaire du devis artisan portugais déjà en ligne (locales/pt.json, devis.*) et des PDF portugais
 *   (« A combinar », « Na adjudicação », « dias de calendário ») ;
 * - les références au droit français (CGI, Code de commerce, Code de la consommation, loi Pinel, loi AGEC) ne sont pas
 *   traduites mot à mot : texte portugais déjà en ligne quand il existe, sinon la phrase sans l'article français ;
 *   une valeur vide retire la mention ;
 * - seuls les textes affichés changent : les valeurs enregistrées des listes (mode et délai de paiement, escompte,
 *   déclencheur d'acompte, unité, pays…) restent en français, les PDF et le calcul de l'échéance les lisent ainsi.
 */

export type TraducteurDevisBtp = (francais: string, valeurs?: Readonly<Record<string, string | number>>) => string

/** Messages du contrôle du régime de TVA (lib/tva-calculator.ts), par code d'erreur. */
const ERREURS_REGIME_PT: Readonly<Record<TvaRegimeError, string>> = {
  issuer_franchise_cannot_charge_tva: 'Empresa em regime de isenção — faturação com IVA não permitida.',
  issuer_franchise_cannot_autoliquidate: 'Empresa em regime de isenção — a autoliquidação exige estar sujeito a IVA.',
  client_particulier_cannot_autoliquidate: 'A autoliquidação só se aplica entre profissionais sujeitos a IVA.',
  autoliquidation_requires_client_siren: 'NIF do adquirente obrigatório para a autoliquidação.',
  autoliquidation_requires_emitter_tva_intra: 'N.º de IVA intracomunitário do emitente obrigatório para a autoliquidação.',
}

/** Texte français de l'écran → texte portugais (PT-PT). */
export const TEXTES_DEVIS_BTP_PT: Readonly<Record<string, string>> = {
  ...(TEXTES_ECRAN_PT as Readonly<Record<string, string>>),
  // Libellés calculés par d'autres modules et affichés par le formulaire
  'TOTAL NET': 'TOTAL LÍQUIDO',
  Autoliquidation: 'Autoliquidação',
  'Non applicable': 'Não aplicável',
  ...Object.fromEntries(
    (Object.keys(ERREURS_REGIME_PT) as TvaRegimeError[]).map((code) => [REGIME_ERROR_MESSAGES[code], ERREURS_REGIME_PT[code]]),
  ),
}

/** Remplace les variables {nom} par leur valeur ; une variable sans valeur reste telle quelle. */
function remplir(texte: string, valeurs: Readonly<Record<string, string | number>>): string {
  return texte.replace(/\{(\w+)\}/g, (motif, cle: string) =>
    Object.prototype.hasOwnProperty.call(valeurs, cle) ? String(valeurs[cle]) : motif)
}

/**
 * Traducteur des textes du formulaire BTP pour une langue d'interface : portugais sur 'pt', texte français tel quel
 * sinon. Un texte absent du dictionnaire reste en français (le test tests/i18n/devis-btp-pt.test.ts l'interdit).
 */
export function traducteurDevisBtp(locale: string): TraducteurDevisBtp {
  const portugais = locale === 'pt'
  return (francais, valeurs) => {
    const texte = portugais && Object.prototype.hasOwnProperty.call(TEXTES_DEVIS_BTP_PT, francais)
      ? TEXTES_DEVIS_BTP_PT[francais]
      : francais
    return valeurs ? remplir(texte, valeurs) : texte
  }
}

/** Photos jointes au document, en portugais (accord au singulier et au pluriel). */
export function phrasePhotosAnnexePt(nombre: number): string {
  return nombre > 1
    ? `${nombre} fotos selecionadas — serão anexadas ao PDF`
    : `${nombre} foto selecionada — será anexada ao PDF`
}
