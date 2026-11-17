// ============================================================
// VITFIX — CONFORMIDADE (PORTUGAL)
// Documents d'une entreprise portugaise, distincts du jeu français de lib/walletConformite.ts : droit, organismes et
// délais portugais (rapport i18n PT-PT du 17/11/2026). Ne jamais calquer une règle d'un pays sur l'autre.
//
// Les identifiants « kbis », « urssaf », « attestation_fiscale », « rc_pro » et « statuts_societe » désignent ici leur
// équivalent portugais : un document déjà déposé dans l'une de ces cases (stockage local fixit_wallet_<id>, case
// synchronisée vers le syndic par /api/wallet-sync) reste à sa place, sous son nom portugais.
//
// Faits vérifiés le 17/11/2026 (sources officielles) :
// - déclaration de situation contributive de la Segurança Social : valable 4 mois (gov.pt) ;
// - certidão de situação tributária regularizada (AT) : valable 4 mois depuis le DL 49/2025 (art. 24.º du CPPT),
//   auparavant 3 mois ;
// - certidão permanente do registo comercial : code d'accès valable 1, 2, 3 ou 4 ans (gov.pt) ;
// - alvará et certificado d'entrepreneur (IMPIC, Lei 41/2015) : sans échéance, sous réserve des contrôles de l'IMPIC ;
// - assurance accidents du travail : obligatoire pour l'employeur et pour le travailleur indépendant (DL 159/99) ;
// - plan de sécurité et de santé : par chantier (DL 273/2003).
// L'assurance de responsabilité civile n'est pas obligatoire pour toute entreprise du bâtiment au Portugal :
// « recommandée » ici, à la différence du jeu français.
// ============================================================

import { categoryToWalletKey, type WalletDocConfig } from './walletConformite'

/** Forme juridique lue dans le texte libre `legal_form` (formes portugaises et françaises). */
export type FormeJuridiquePt = 'sociedade' | 'individual' | 'inconnue'

// Sociétés et entités inscrites au registre du commerce (l'EIRL y est inscrit, comme les sociétés).
const MOTS_REGISTO_COMERCIAL = new Set([
  'lda', 'limitada', 'unipessoal', 'quotas', 'sociedade', 'sa', 'anonima', 'snc', 'comandita', 'cooperativa',
  'eirl', 'estabelecimento', 'sarl', 'sas', 'sasu', 'eurl', 'sci', 'societe', 'scop', 'sca', 'scs',
])
// Entrepreneurs individuels : pas de registre du commerce, une déclaration de début d'activité auprès des Finances.
const MOTS_INDIVIDUAL = new Set([
  'eni', 'individual', 'independente', 'recibos', 'verdes', 'ei', 'auto', 'micro', 'individuel', 'individuelle',
  'entrepreneur',
])

export function formeJuridiquePt(legalForm: string | null | undefined): FormeJuridiquePt {
  const mots = (legalForm ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    // « S.A. », « Lda. » : les points des sigles ne coupent pas le mot.
    .replace(/\./g, '')
    .split(/[^a-z]+/)
    .filter(Boolean)
  if (mots.some(m => MOTS_REGISTO_COMERCIAL.has(m))) return 'sociedade'
  if (mots.some(m => MOTS_INDIVIDUAL.has(m))) return 'individual'
  return 'inconnue'
}

// Métiers du bâtiment (clés de lib/walletConformite.ts) : l'habilitation IMPIC et le plan de sécurité les concernent.
// Les autres (jardins, nettoyage, nuisibles, déménagement, diagnostic, ramonage, débouchage) n'en relèvent pas.
const METIERS_CONSTRUCTION = new Set([
  'plomberie', 'electricite', 'serrurerie', 'chauffage', 'climatisation', 'peinture', 'maconnerie', 'menuiserie',
  'toiture', 'carrelage', 'renovation', 'amenagement_exterieur', 'vitrerie', 'petits_travaux', 'ferronnerie',
  'plaquiste', 'piscine', 'store_banne',
])

const LIEN_REGISTO_COMERCIAL = 'https://www.gov.pt/servicos/pedir-a-certidao-permanente-do-registo-comercial'
const LIEN_PORTAL_FINANCAS = 'https://www.portaldasfinancas.gov.pt'
const LIEN_SITUACAO_CONTRIBUTIVA = 'https://www.gov.pt/servicos/situacao-contributiva-perante-a-seguranca-social-declaracao'
const LIEN_IMPIC = 'https://www.impic.pt'
const OBTER = 'Obter este documento'

// Nommée sans « cert » : CodeQL prend tout identifiant en « cert… » pour un certificat (donnée sensible), alors qu'il
// s'agit ici d'une simple fiche de document (nom, description, lien officiel).
function docRegistoComercial(obrigatorio: boolean): WalletDocConfig {
  return {
    id: 'kbis',
    nom: 'Certidão permanente do registo comercial',
    description: 'Prova da existência legal da empresa (sociedades e EIRL)',
    obligatoire: obrigatorio,
    recommande: !obrigatorio,
    validite: '1 a 4 anos (código de acesso)',
    icon: '🏢',
    obtenir: { label: OBTER, lien: LIEN_REGISTO_COMERCIAL, note: 'Pedido online no gov.pt (registo comercial)' },
  }
}

function inicioAtividade(obrigatorio: boolean): WalletDocConfig {
  return {
    id: 'inicio_atividade',
    nom: 'Declaração de início de atividade',
    description: 'Empresário em nome individual ou trabalhador independente: comprovativo das Finanças',
    obligatoire: obrigatorio,
    recommande: !obrigatorio,
    validite: 'Permanente',
    icon: '🧾',
    obtenir: { label: OBTER, lien: LIEN_PORTAL_FINANCAS, note: 'Portal das Finanças, área da atividade' },
  }
}

const SITUACAO_CONTRIBUTIVA: WalletDocConfig = {
  id: 'urssaf',
  nom: 'Declaração de situação contributiva (Segurança Social)',
  description: 'Comprova que a situação perante a Segurança Social está regularizada',
  obligatoire: true,
  validite: '4 meses',
  icon: '📋',
  obtenir: { label: OBTER, lien: LIEN_SITUACAO_CONTRIBUTIVA, note: 'Segurança Social Direta, gratuita' },
}

const SITUACAO_TRIBUTARIA: WalletDocConfig = {
  id: 'attestation_fiscale',
  nom: 'Certidão de situação tributária regularizada (Finanças)',
  description: 'Certidão de não dívida emitida pela Autoridade Tributária e Aduaneira',
  obligatoire: true,
  validite: '4 meses',
  icon: '🏛️',
  obtenir: { label: OBTER, lien: LIEN_PORTAL_FINANCAS, note: 'Portal das Finanças, pedido de certidão, gratuita' },
}

const ACIDENTES_TRABALHO: WalletDocConfig = {
  id: 'seguro_acidentes_trabalho',
  nom: 'Seguro de acidentes de trabalho',
  description: 'Obrigatório para quem tem trabalhadores e para o trabalhador independente',
  obligatoire: true,
  validite: '1 ano',
  icon: '🦺',
  obtenir: { label: OBTER, note: 'Apólice emitida pela sua seguradora' },
}

const RESPONSABILIDADE_CIVIL: WalletDocConfig = {
  id: 'rc_pro',
  nom: 'Seguro de responsabilidade civil',
  description: 'Profissional ou de exploração: cobre os danos causados a terceiros durante os trabalhos',
  obligatoire: false,
  recommande: true,
  validite: '1 ano',
  icon: '⚖️',
  obtenir: { label: OBTER, note: 'Apólice emitida pela sua seguradora' },
}

const ALVARA_IMPIC: WalletDocConfig = {
  id: 'alvara_impic',
  nom: 'Alvará ou certificado de empreiteiro (IMPIC)',
  description: 'Habilitação para a atividade da construção, com as classes e subcategorias',
  obligatoire: true,
  validite: 'Sem prazo fixo',
  icon: '🏗️',
  obtenir: { label: OBTER, lien: LIEN_IMPIC, note: 'Pedido e consulta no portal do IMPIC' },
}

const APTIDAO_MEDICA: WalletDocConfig = {
  id: 'aptidao_medica',
  nom: 'Fichas de aptidão médica (medicina do trabalho)',
  description: 'Empresas com trabalhadores: uma ficha por trabalhador',
  obligatoire: false,
  recommande: true,
  validite: '1 a 2 anos (exame periódico)',
  icon: '🩺',
  obtenir: { label: OBTER, note: 'Emitidas pelo serviço de medicina do trabalho' },
}

const PLANO_SEGURANCA: WalletDocConfig = {
  id: 'plano_seguranca_saude',
  nom: 'Plano de segurança e saúde (PSS)',
  description: 'Elaborado para cada obra, quando exigido',
  obligatoire: false,
  recommande: true,
  validite: 'Por obra',
  icon: '📐',
  obtenir: { label: OBTER, note: 'Desenvolvido pela entidade executante a partir do plano do dono de obra' },
}

const PACTO_SOCIAL: WalletDocConfig = {
  id: 'statuts_societe',
  nom: 'Pacto social (estatutos)',
  description: 'Documento constitutivo da sociedade',
  obligatoire: true,
  validite: 'Permanente',
  icon: '📜',
  obtenir: { label: OBTER, lien: LIEN_REGISTO_COMERCIAL, note: 'Incluído na certidão permanente com documentos' },
}

export interface ContexteWalletPt {
  /** Slugs des métiers (artisan.categories) : décident de l'habilitation IMPIC et du plan de sécurité. */
  categories: readonly string[]
  /** Texte libre `legal_form` de la fiche. */
  legalForm: string | null | undefined
  /** Société BTP (orgRole « pro_societe ») : toujours dans le bâtiment, toujours une société inscrite. */
  societeBtp: boolean
}

/**
 * Documents de conformité d'un professionnel au Portugal. `fallback` : un artisan sans métier connu ne voit pas encore
 * les documents propres au bâtiment (même message qu'en France : compléter le profil).
 */
export function getWalletDocumentsPt({ categories, legalForm, societeBtp }: ContexteWalletPt): { docs: WalletDocConfig[]; fallback: boolean } {
  const metiers = new Set(categories.map(c => categoryToWalletKey(c)).filter((k): k is string => !!k))
  const construction = societeBtp || [...metiers].some(m => METIERS_CONSTRUCTION.has(m))
  const forme = societeBtp ? 'sociedade' : formeJuridiquePt(legalForm)

  const existenceLegale: WalletDocConfig[] = []
  if (forme !== 'individual') existenceLegale.push(docRegistoComercial(forme === 'sociedade'))
  if (forme !== 'sociedade') existenceLegale.push(inicioAtividade(forme === 'individual'))

  const docs: WalletDocConfig[] = [
    ...existenceLegale,
    SITUACAO_CONTRIBUTIVA,
    SITUACAO_TRIBUTARIA,
    ACIDENTES_TRABALHO,
    ...(construction ? [ALVARA_IMPIC] : []),
    RESPONSABILIDADE_CIVIL,
    APTIDAO_MEDICA,
    ...(construction ? [PLANO_SEGURANCA] : []),
    ...(societeBtp ? [PACTO_SOCIAL] : []),
  ]
  return { docs, fallback: !societeBtp && metiers.size === 0 }
}

// Toutes les cases portugaises, pour retrouver un nom à partir de l'identifiant enregistré.
const DOCUMENTS_PT: readonly WalletDocConfig[] = [
  docRegistoComercial(true), inicioAtividade(true), SITUACAO_CONTRIBUTIVA, SITUACAO_TRIBUTARIA, ACIDENTES_TRABALHO,
  ALVARA_IMPIC, RESPONSABILIDADE_CIVIL, APTIDAO_MEDICA, PLANO_SEGURANCA, PACTO_SOCIAL,
]

/** Nom portugais d'une case de document (alertes d'échéance de l'accueil) ; null si l'identifiant est inconnu. */
export function nomDocumentPt(id: string): string | null {
  return DOCUMENTS_PT.find(d => d.id === id)?.nom ?? null
}

/**
 * Case d'un document déjà déposé dont l'identifiant n'existe pas dans la liste portugaise (un document déposé sous une
 * case française, par exemple) : il reste visible, consultable et supprimable, sous son nom de fichier.
 */
export function caseDocumentDejaDepose(id: string, nomFichier: string | undefined): WalletDocConfig {
  return {
    id,
    nom: `Outro documento carregado: ${nomFichier || id}`,
    description: 'Documento carregado anteriormente',
    obligatoire: false,
    validite: '',
    icon: '📄',
    obtenir: { label: '', note: '' },
  }
}
