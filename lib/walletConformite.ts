// ============================================================
// VITFIX — WALLET CONFORMITÉ
// Configuration complète par corps de métier
// ============================================================

export interface WalletDocObtenir {
  label: string
  lien?: string
  lien_societe?: string
  lien_artisan?: string
  lien_independant?: string
  lien_autoentrepreneur?: string
  note: string
}

export interface WalletDocConfig {
  id: string
  nom: string
  description: string
  obligatoire: boolean
  recommande?: boolean
  condition?: string
  validite: string
  obtenir: WalletDocObtenir
  icon?: string
}

export interface MetierConfig {
  label: string
  documents: WalletDocConfig[]
}

// ── Icônes par id de document ────────────────────────────────
const DOC_ICONS: Record<string, string> = {
  kbis: '🏢',
  urssaf: '📋',
  rc_pro: '⚖️',
  decennale: '🛡️',
  decennale_paysage: '🛡️',
  qualibat: '🏅',
  qualigaz: '🔵',
  quali_eau: '💧',
  fluides_frigorigenes: '❄️',
  rge: '🌿',
  rge_qualifelec: '🌿',
  carte_btp: '🪪',
  habilitation_elec: '⚡',
  qualifelec: '🏅',
  irve: '🔌',
  amiante_ss4: '⚠️',
  certiphyto: '🌱',
  certiphyto_nuisibles: '🌱',
  qualipaysage: '🌳',
  labels_ecocert_paysage: '♻️',
  certibiocide: '🧪',
  certibiocide_nuisibles: '🧪',
  nf_proprete: '🏅',
  agrement_3d: '📜',
  cepa: '🏅',
  licence_transport: '🚛',
  nf_demenagement: '🏅',
  qualitoit: '🏠',
  qualipv: '☀️',
  qualibat_rge: '🌿',
  // ─── Diagnostic immobilier ───
  cofrac_dpe: '🔍',
  cofrac_amiante: '⚠️',
  cofrac_plomb: '🧪',
  cofrac_gaz: '🔥',
  cofrac_elec: '⚡',
  cofrac_termites: '🐜',
  cofrac_erp: '📊',
  carte_diagnostiqueur: '🪪',
  // ─── Plaquiste ───
  qualibat_platrerie: '🏅',
  // ─── Piscine ───
  qualipiscine: '🏊',
  rge_qualipv: '☀️',
  // ─── Ramonage ───
  carte_ramoneur: '🪪',
  qualifumisterie: '🔥',
  // ─── Store / banne ───
  qualibat_menuiserie_ext: '🏅',
}

const icon = (id: string) => DOC_ICONS[id] || '📄'

// ── Documents communs ────────────────────────────────────────
export const DOCUMENTS_COMMUNS: WalletDocConfig[] = [
  {
    id: 'kbis',
    nom: 'Extrait Kbis / RNE',
    description: "Preuve d'existence légale de l'entreprise",
    obligatoire: true,
    validite: '3 mois',
    icon: icon('kbis'),
    obtenir: {
      label: 'Obtenir ce document',
      lien_societe: 'https://www.monidenum.fr',
      lien_artisan: 'https://annuaire-entreprises.data.gouv.fr',
      note: 'Sociétés : MonIdenum (gratuit) — Artisans / EI : Annuaire des entreprises (gratuit)',
    },
  },
  {
    id: 'urssaf',
    nom: 'Attestation de vigilance URSSAF',
    description: 'Déclaration de conformité sociale',
    obligatoire: true,
    validite: '6 mois',
    icon: icon('urssaf'),
    obtenir: {
      label: 'Obtenir ce document',
      lien_independant: 'https://www.urssaf.fr/accueil/independant/gerer-developper-activite/obtenir-attestation.html',
      lien_autoentrepreneur: 'https://www.autoentrepreneur.urssaf.fr',
      note: 'Indépendant / artisan : urssaf.fr — Auto-entrepreneur : autoentrepreneur.urssaf.fr',
    },
  },
  {
    id: 'rc_pro',
    nom: 'RC Professionnelle',
    description: 'Responsabilité civile professionnelle',
    obligatoire: true,
    validite: '1 an',
    icon: icon('rc_pro'),
    obtenir: {
      label: 'Obtenir ce document',
      lien: 'https://www.comparateur-assurances.net/rc-pro/',
      note: "Délivrée par votre assureur — téléchargeable depuis votre espace client",
    },
  },
]

// ── Wallet par métier ────────────────────────────────────────
export const WALLET_PAR_METIER: Record<string, MetierConfig> = {

  plomberie: {
    label: 'Plomberie',
    documents: [
      ...DOCUMENTS_COMMUNS,
      { id: 'decennale', nom: 'Assurance Décennale', description: 'Obligatoire pour tous travaux de construction', obligatoire: true, validite: '1 an', icon: icon('decennale'), obtenir: { label: 'Obtenir ce document', lien: 'https://reassurez-moi.fr/guide/pro/garantie-decennale', note: 'Délivrée par votre assureur — comparer sur reassurez-moi.fr' } },
      { id: 'qualibat', nom: 'Qualification Qualibat', description: "Certification qualité artisan — souvent exigée marchés publics", obligatoire: false, recommande: true, validite: '1 an', icon: icon('qualibat'), obtenir: { label: 'Obtenir ce document', lien: 'https://www.qualibat.com/nos-qualifications-certifications', note: 'Demande en ligne sur qualibat.com' } },
      { id: 'qualigaz', nom: 'Certification QualiGaz', description: 'Obligatoire pour toute intervention sur installation gaz', obligatoire: true, condition: 'Si intervention sur installations gaz', validite: '5 ans', icon: icon('qualigaz'), obtenir: { label: 'Obtenir ce document', lien: 'https://www.qualigaz.com', note: 'Délivrée par Qualigaz après formation agréée' } },
      { id: 'quali_eau', nom: "Quali'Eau", description: "Maîtrise sanitaire du réseau d'eau potable (légionellose, pollution croisée)", obligatoire: false, recommande: true, validite: '5 ans', icon: icon('quali_eau'), obtenir: { label: 'Obtenir ce document', lien: 'https://www.qualibat.com', note: 'Délivrée par Qualibat' } },
      { id: 'fluides_frigorigenes', nom: 'Attestation fluides frigorigènes', description: 'Obligatoire pour manipulation de fluides frigorigènes (PAC, climatisation)', obligatoire: true, condition: 'Si intervention sur PAC ou équipements thermodynamiques', validite: '5 ans', icon: icon('fluides_frigorigenes'), obtenir: { label: 'Obtenir ce document', lien: 'https://entreprendre.service-public.gouv.fr/vosdroits/F39033', note: 'Demande via service-public.fr après formation agréée' } },
      { id: 'rge', nom: "Certification RGE", description: "Reconnu Garant de l'Environnement — permet aux clients d'obtenir MaPrimeRénov'", obligatoire: false, recommande: true, condition: 'Si travaux de rénovation énergétique', validite: '4 ans', icon: icon('rge'), obtenir: { label: 'Obtenir ce document', lien: 'https://www.qualibat.com/comment-devenir-qualibat-RGE', note: "Délivrée par Qualibat, Qualit'EnR selon spécialité" } },
      { id: 'carte_btp', nom: 'Carte Pro BTP', description: 'Obligatoire pour tout salarié du BTP sur chantier', obligatoire: true, condition: 'Si salariés sur chantier', validite: 'Durée du contrat', icon: icon('carte_btp'), obtenir: { label: 'Obtenir ce document', lien: 'https://www.cartebtp.fr', note: 'Demande employeur sur cartebtp.fr' } },
    ],
  },

  electricite: {
    label: 'Électricité',
    documents: [
      ...DOCUMENTS_COMMUNS,
      { id: 'decennale', nom: 'Assurance Décennale', description: "Obligatoire pour tous travaux d'installation électrique", obligatoire: true, validite: '1 an', icon: icon('decennale'), obtenir: { label: 'Obtenir ce document', lien: 'https://reassurez-moi.fr/guide/pro/garantie-decennale', note: 'Délivrée par votre assureur' } },
      { id: 'habilitation_elec', nom: 'Habilitation électrique NF C18-510', description: "Obligatoire pour toute intervention sur ou au voisinage d'installations électriques", obligatoire: true, validite: '3 ans', icon: icon('habilitation_elec'), obtenir: { label: 'Obtenir ce document', lien: 'https://habilitations-electrique.fr', note: "Formation agréée + délivrance par l'employeur. Niveaux : BR, B1, B2, BC selon activité" } },
      { id: 'qualifelec', nom: 'Qualification Qualifelec', description: 'Référence qualité pour électriciens — exigée marchés publics', obligatoire: false, recommande: true, validite: '1 an', icon: icon('qualifelec'), obtenir: { label: 'Obtenir ce document', lien: 'https://www.qualifelec.fr', note: 'Demande sur qualifelec.fr' } },
      { id: 'irve', nom: 'Certification IRVE', description: 'Obligatoire pour installer des bornes de recharge véhicules électriques', obligatoire: true, condition: 'Si installation bornes IRVE', validite: '3 ans', icon: icon('irve'), obtenir: { label: 'Obtenir ce document', lien: 'https://www.qualifelec.fr/certification-irve', note: 'Formation certifiante Qualifelec ou AFNOR' } },
      { id: 'rge_qualifelec', nom: 'Certification RGE Qualifelec', description: "Permet aux clients d'obtenir MaPrimeRénov' pour travaux électriques", obligatoire: false, recommande: true, condition: 'Si rénovation énergétique', validite: '4 ans', icon: icon('rge_qualifelec'), obtenir: { label: 'Obtenir ce document', lien: 'https://www.qualifelec.fr', note: 'Délivrée par Qualifelec' } },
      { id: 'carte_btp', nom: 'Carte Pro BTP', description: 'Obligatoire pour tout salarié du BTP sur chantier', obligatoire: true, condition: 'Si salariés sur chantier', validite: 'Durée du contrat', icon: icon('carte_btp'), obtenir: { label: 'Obtenir ce document', lien: 'https://www.cartebtp.fr', note: 'Demande employeur sur cartebtp.fr' } },
    ],
  },

  serrurerie: {
    label: 'Serrurerie',
    documents: [
      ...DOCUMENTS_COMMUNS,
      { id: 'decennale', nom: 'Assurance Décennale', description: 'Obligatoire pour travaux structurels (blindage, installation serrure encastrée...)', obligatoire: true, validite: '1 an', icon: icon('decennale'), obtenir: { label: 'Obtenir ce document', lien: 'https://reassurez-moi.fr/guide/pro/garantie-decennale', note: 'Délivrée par votre assureur' } },
      { id: 'qualibat', nom: 'Qualification Qualibat', description: 'Certification qualité artisan', obligatoire: false, recommande: true, validite: '1 an', icon: icon('qualibat'), obtenir: { label: 'Obtenir ce document', lien: 'https://www.qualibat.com/nos-qualifications-certifications', note: 'Demande en ligne sur qualibat.com' } },
    ],
  },

  chauffage: {
    label: 'Chauffage',
    documents: [
      ...DOCUMENTS_COMMUNS,
      { id: 'decennale', nom: 'Assurance Décennale', description: 'Obligatoire pour installation de systèmes de chauffage', obligatoire: true, validite: '1 an', icon: icon('decennale'), obtenir: { label: 'Obtenir ce document', lien: 'https://reassurez-moi.fr/guide/pro/garantie-decennale', note: 'Délivrée par votre assureur' } },
      { id: 'fluides_frigorigenes', nom: 'Attestation fluides frigorigènes', description: 'Obligatoire pour manipulation de fluides frigorigènes (PAC, climatisation)', obligatoire: true, condition: 'Si PAC ou équipements thermodynamiques', validite: '5 ans', icon: icon('fluides_frigorigenes'), obtenir: { label: 'Obtenir ce document', lien: 'https://entreprendre.service-public.gouv.fr/vosdroits/F39033', note: 'Demande via service-public.fr après formation agréée' } },
      { id: 'qualigaz', nom: 'Certification QualiGaz', description: 'Obligatoire pour toute intervention sur installation gaz', obligatoire: true, condition: 'Si chaudière gaz ou installation gaz', validite: '5 ans', icon: icon('qualigaz'), obtenir: { label: 'Obtenir ce document', lien: 'https://www.qualigaz.com', note: 'Délivrée par Qualigaz après formation' } },
      { id: 'qualibat', nom: 'Qualification Qualibat', description: 'Certification qualité — exigée marchés publics', obligatoire: false, recommande: true, validite: '1 an', icon: icon('qualibat'), obtenir: { label: 'Obtenir ce document', lien: 'https://www.qualibat.com/nos-qualifications-certifications', note: 'Demande en ligne sur qualibat.com' } },
      { id: 'rge', nom: 'Certification RGE', description: "Obligatoire pour que vos clients bénéficient de MaPrimeRénov'", obligatoire: false, recommande: true, condition: 'Si PAC, chaudière biomasse, solaire thermique', validite: '4 ans', icon: icon('rge'), obtenir: { label: 'Obtenir ce document', lien: 'https://www.qualibat.com/comment-devenir-qualibat-RGE', note: "Qualibat, Qualit'EnR selon spécialité" } },
      { id: 'carte_btp', nom: 'Carte Pro BTP', description: 'Obligatoire pour tout salarié du BTP sur chantier', obligatoire: true, condition: 'Si salariés sur chantier', validite: 'Durée du contrat', icon: icon('carte_btp'), obtenir: { label: 'Obtenir ce document', lien: 'https://www.cartebtp.fr', note: 'Demande employeur sur cartebtp.fr' } },
    ],
  },

  climatisation: {
    label: 'Climatisation',
    documents: [
      ...DOCUMENTS_COMMUNS,
      { id: 'decennale', nom: 'Assurance Décennale', description: 'Obligatoire pour installation de climatisation', obligatoire: true, validite: '1 an', icon: icon('decennale'), obtenir: { label: 'Obtenir ce document', lien: 'https://reassurez-moi.fr/guide/pro/garantie-decennale', note: 'Délivrée par votre assureur' } },
      { id: 'fluides_frigorigenes', nom: 'Attestation fluides frigorigènes', description: 'OBLIGATOIRE — sans exception pour tout technicien manipulant des fluides frigorigènes', obligatoire: true, validite: '5 ans', icon: icon('fluides_frigorigenes'), obtenir: { label: 'Obtenir ce document', lien: 'https://entreprendre.service-public.gouv.fr/vosdroits/F39033', note: 'Demande via service-public.fr — formation agréée obligatoire' } },
      { id: 'qualibat', nom: 'Qualification Qualibat', description: 'Certification qualité artisan', obligatoire: false, recommande: true, validite: '1 an', icon: icon('qualibat'), obtenir: { label: 'Obtenir ce document', lien: 'https://www.qualibat.com/nos-qualifications-certifications', note: 'Demande en ligne sur qualibat.com' } },
      { id: 'rge', nom: 'Certification RGE', description: "Permet aux clients d'obtenir MaPrimeRénov' pour PAC et climatisation réversible", obligatoire: false, recommande: true, validite: '4 ans', icon: icon('rge'), obtenir: { label: 'Obtenir ce document', lien: 'https://www.qualibat.com/comment-devenir-qualibat-RGE', note: "Qualibat ou Qualit'EnR selon équipements" } },
    ],
  },

  peinture: {
    label: 'Peinture',
    documents: [
      ...DOCUMENTS_COMMUNS,
      { id: 'decennale', nom: 'Assurance Décennale', description: 'Obligatoire pour travaux de ravalement de façade et peinture extérieure', obligatoire: true, validite: '1 an', icon: icon('decennale'), obtenir: { label: 'Obtenir ce document', lien: 'https://reassurez-moi.fr/guide/pro/garantie-decennale', note: 'Délivrée par votre assureur' } },
      { id: 'amiante_ss4', nom: 'Certification amiante SS4', description: "Obligatoire pour intervention sur bâtiments construits avant 1997", obligatoire: true, condition: 'Si intervention sur bâtiment avant 1997', validite: '5 ans', icon: icon('amiante_ss4'), obtenir: { label: 'Obtenir ce document', lien: 'https://entreprendre.service-public.gouv.fr/vosdroits/F32355', note: "Formation auprès d'un organisme certifié COFRAC" } },
      { id: 'qualibat', nom: 'Qualification Qualibat', description: 'Certification qualité artisan peinture', obligatoire: false, recommande: true, validite: '1 an', icon: icon('qualibat'), obtenir: { label: 'Obtenir ce document', lien: 'https://www.qualibat.com/nos-qualifications-certifications', note: 'Demande en ligne sur qualibat.com' } },
    ],
  },

  maconnerie: {
    label: 'Maçonnerie',
    documents: [
      ...DOCUMENTS_COMMUNS,
      { id: 'decennale', nom: 'Assurance Décennale', description: 'Obligatoire — travaux de gros œuvre', obligatoire: true, validite: '1 an', icon: icon('decennale'), obtenir: { label: 'Obtenir ce document', lien: 'https://reassurez-moi.fr/guide/pro/garantie-decennale', note: 'Délivrée par votre assureur' } },
      { id: 'amiante_ss4', nom: 'Certification amiante SS4', description: "Obligatoire pour démolition ou travaux sur bâtiments construits avant 1997", obligatoire: true, condition: 'Si bâtiment avant 1997', validite: '5 ans', icon: icon('amiante_ss4'), obtenir: { label: 'Obtenir ce document', lien: 'https://entreprendre.service-public.gouv.fr/vosdroits/F32355', note: "Formation auprès d'un organisme certifié COFRAC" } },
      { id: 'qualibat', nom: 'Qualification Qualibat', description: 'Certification qualité artisan maçon — exigée marchés publics', obligatoire: false, recommande: true, validite: '1 an', icon: icon('qualibat'), obtenir: { label: 'Obtenir ce document', lien: 'https://www.qualibat.com/nos-qualifications-certifications', note: 'Demande en ligne sur qualibat.com' } },
      { id: 'rge', nom: 'Certification RGE', description: "Obligatoire pour isolation thermique par l'extérieur (ITE)", obligatoire: false, recommande: true, condition: 'Si ITE ou isolation', validite: '4 ans', icon: icon('rge'), obtenir: { label: 'Obtenir ce document', lien: 'https://www.qualibat.com/comment-devenir-qualibat-RGE', note: 'Qualibat RGE' } },
      { id: 'carte_btp', nom: 'Carte Pro BTP', description: 'Obligatoire pour tout salarié du BTP sur chantier', obligatoire: true, condition: 'Si salariés sur chantier', validite: 'Durée du contrat', icon: icon('carte_btp'), obtenir: { label: 'Obtenir ce document', lien: 'https://www.cartebtp.fr', note: 'Demande employeur sur cartebtp.fr' } },
    ],
  },

  menuiserie: {
    label: 'Menuiserie',
    documents: [
      ...DOCUMENTS_COMMUNS,
      { id: 'decennale', nom: 'Assurance Décennale', description: 'Obligatoire pour pose de menuiseries extérieures, parquet, dressing', obligatoire: true, validite: '1 an', icon: icon('decennale'), obtenir: { label: 'Obtenir ce document', lien: 'https://reassurez-moi.fr/guide/pro/garantie-decennale', note: 'Délivrée par votre assureur' } },
      { id: 'qualibat', nom: 'Qualification Qualibat', description: 'Certification qualité menuisier — exigée marchés publics', obligatoire: false, recommande: true, validite: '1 an', icon: icon('qualibat'), obtenir: { label: 'Obtenir ce document', lien: 'https://www.qualibat.com/nos-qualifications-certifications', note: 'Demande en ligne sur qualibat.com' } },
      { id: 'rge', nom: 'Certification RGE', description: "Obligatoire pour remplacement fenêtres avec aide MaPrimeRénov'", obligatoire: false, recommande: true, condition: 'Si remplacement fenêtres / isolation', validite: '4 ans', icon: icon('rge'), obtenir: { label: 'Obtenir ce document', lien: 'https://www.qualibat.com/comment-devenir-qualibat-RGE', note: 'Qualibat RGE' } },
      { id: 'carte_btp', nom: 'Carte Pro BTP', description: 'Obligatoire pour tout salarié du BTP sur chantier', obligatoire: true, condition: 'Si salariés sur chantier', validite: 'Durée du contrat', icon: icon('carte_btp'), obtenir: { label: 'Obtenir ce document', lien: 'https://www.cartebtp.fr', note: 'Demande employeur sur cartebtp.fr' } },
    ],
  },

  toiture: {
    label: 'Toiture',
    documents: [
      ...DOCUMENTS_COMMUNS,
      { id: 'decennale', nom: 'Assurance Décennale', description: "Obligatoire — travaux de couverture et étanchéité", obligatoire: true, validite: '1 an', icon: icon('decennale'), obtenir: { label: 'Obtenir ce document', lien: 'https://reassurez-moi.fr/guide/pro/garantie-decennale', note: 'Délivrée par votre assureur' } },
      { id: 'amiante_ss4', nom: 'Certification amiante SS4', description: "Obligatoire pour toiture fibrociment ou bâtiment avant 1997", obligatoire: true, condition: 'Si toiture fibrociment / bâtiment avant 1997', validite: '5 ans', icon: icon('amiante_ss4'), obtenir: { label: 'Obtenir ce document', lien: 'https://entreprendre.service-public.gouv.fr/vosdroits/F32355', note: "Formation auprès d'un organisme certifié COFRAC" } },
      { id: 'qualibat', nom: 'Qualification Qualibat', description: 'Certification qualité couvreur', obligatoire: false, recommande: true, validite: '1 an', icon: icon('qualibat'), obtenir: { label: 'Obtenir ce document', lien: 'https://www.qualibat.com/nos-qualifications-certifications', note: 'Demande en ligne sur qualibat.com' } },
      { id: 'qualitoit', nom: 'Label Qualitoit', description: 'Label spécifique couvreurs — valorise compétences et ancienneté', obligatoire: false, recommande: true, validite: '4 ans', icon: icon('qualitoit'), obtenir: { label: 'Obtenir ce document', lien: 'https://qualitoit.fr', note: 'Demande sur qualitoit.fr' } },
      { id: 'rge', nom: 'Certification RGE', description: "Obligatoire pour isolation toiture avec aide MaPrimeRénov'", obligatoire: false, recommande: true, condition: 'Si isolation combles / toiture', validite: '4 ans', icon: icon('rge'), obtenir: { label: 'Obtenir ce document', lien: 'https://www.qualibat.com/comment-devenir-qualibat-RGE', note: 'Qualibat RGE' } },
      { id: 'qualipv', nom: 'QualiPV / QualiSol', description: 'Obligatoire pour installation solaire photovoltaïque ou thermique en toiture', obligatoire: true, condition: 'Si installation panneaux solaires', validite: '4 ans', icon: icon('qualipv'), obtenir: { label: 'Obtenir ce document', lien: 'https://www.qualit-enr.org', note: "Délivrée par Qualit'EnR" } },
      { id: 'carte_btp', nom: 'Carte Pro BTP', description: 'Obligatoire pour tout salarié du BTP sur chantier', obligatoire: true, condition: 'Si salariés sur chantier', validite: 'Durée du contrat', icon: icon('carte_btp'), obtenir: { label: 'Obtenir ce document', lien: 'https://www.cartebtp.fr', note: 'Demande employeur sur cartebtp.fr' } },
    ],
  },

  carrelage: {
    label: 'Carrelage',
    documents: [
      ...DOCUMENTS_COMMUNS,
      { id: 'decennale', nom: 'Assurance Décennale', description: 'Obligatoire pour pose de carrelage, faïence, mosaïque', obligatoire: true, validite: '1 an', icon: icon('decennale'), obtenir: { label: 'Obtenir ce document', lien: 'https://reassurez-moi.fr/guide/pro/garantie-decennale', note: 'Délivrée par votre assureur' } },
      { id: 'qualibat', nom: 'Qualification Qualibat', description: 'Certification qualité carreleur', obligatoire: false, recommande: true, validite: '1 an', icon: icon('qualibat'), obtenir: { label: 'Obtenir ce document', lien: 'https://www.qualibat.com/nos-qualifications-certifications', note: 'Demande en ligne sur qualibat.com' } },
    ],
  },

  renovation: {
    label: 'Rénovation',
    documents: [
      ...DOCUMENTS_COMMUNS,
      { id: 'decennale', nom: 'Assurance Décennale', description: 'Obligatoire pour tous travaux de rénovation structurelle', obligatoire: true, validite: '1 an', icon: icon('decennale'), obtenir: { label: 'Obtenir ce document', lien: 'https://reassurez-moi.fr/guide/pro/garantie-decennale', note: 'Délivrée par votre assureur' } },
      { id: 'amiante_ss4', nom: 'Certification amiante SS4', description: "Obligatoire pour tout bâtiment construit avant 1997", obligatoire: true, condition: 'Si bâtiment avant 1997', validite: '5 ans', icon: icon('amiante_ss4'), obtenir: { label: 'Obtenir ce document', lien: 'https://entreprendre.service-public.gouv.fr/vosdroits/F32355', note: "Formation auprès d'un organisme certifié COFRAC" } },
      { id: 'qualibat', nom: 'Qualification Qualibat', description: "Certification qualité entreprise de rénovation", obligatoire: false, recommande: true, validite: '1 an', icon: icon('qualibat'), obtenir: { label: 'Obtenir ce document', lien: 'https://www.qualibat.com/nos-qualifications-certifications', note: 'Demande en ligne sur qualibat.com' } },
      { id: 'rge', nom: 'Certification RGE', description: "Obligatoire pour travaux d'efficacité énergétique avec aides publiques", obligatoire: false, recommande: true, condition: 'Si rénovation énergétique', validite: '4 ans', icon: icon('rge'), obtenir: { label: 'Obtenir ce document', lien: 'https://www.qualibat.com/comment-devenir-qualibat-RGE', note: 'Qualibat RGE' } },
      { id: 'carte_btp', nom: 'Carte Pro BTP', description: 'Obligatoire pour tout salarié du BTP sur chantier', obligatoire: true, condition: 'Si salariés sur chantier', validite: 'Durée du contrat', icon: icon('carte_btp'), obtenir: { label: 'Obtenir ce document', lien: 'https://www.cartebtp.fr', note: 'Demande employeur sur cartebtp.fr' } },
    ],
  },

  amenagement_exterieur: {
    label: 'Aménagement extérieur',
    documents: [
      ...DOCUMENTS_COMMUNS,
      { id: 'decennale', nom: 'Assurance Décennale', description: 'Obligatoire pour terrasses, clôtures, structures extérieures', obligatoire: true, validite: '1 an', icon: icon('decennale'), obtenir: { label: 'Obtenir ce document', lien: 'https://reassurez-moi.fr/guide/pro/garantie-decennale', note: 'Délivrée par votre assureur' } },
      { id: 'qualibat', nom: 'Qualification Qualibat', description: 'Certification qualité artisan', obligatoire: false, recommande: true, validite: '1 an', icon: icon('qualibat'), obtenir: { label: 'Obtenir ce document', lien: 'https://www.qualibat.com/nos-qualifications-certifications', note: 'Demande en ligne sur qualibat.com' } },
    ],
  },

  espaces_verts: {
    label: 'Espaces verts / Paysagiste',
    documents: [
      ...DOCUMENTS_COMMUNS,
      { id: 'certiphyto', nom: 'Certiphyto', description: 'Obligatoire pour tout usage professionnel de produits phytosanitaires', obligatoire: true, validite: '5 ans', icon: icon('certiphyto'), obtenir: { label: 'Obtenir ce document', lien: 'https://entreprendre.service-public.gouv.fr/vosdroits/R31441', note: 'Demande en ligne sur service-public.fr après formation ou test QCM agréé' } },
      { id: 'qualipaysage', nom: 'QualiPaysage', description: 'Qualification référence du secteur paysage — exigée marchés publics', obligatoire: false, recommande: true, validite: '4 ans', icon: icon('qualipaysage'), obtenir: { label: 'Obtenir ce document', lien: 'https://www.qualipaysage.org/qualifications', note: 'Demande sur qualipaysage.org — sessions 3 fois par an' } },
      { id: 'labels_ecocert_paysage', nom: 'Labels QualiPaysage × Ecocert', description: '8 labels environnementaux pour les métiers du paysage', obligatoire: false, recommande: false, validite: 'Variable', icon: icon('labels_ecocert_paysage'), obtenir: { label: 'Obtenir ce document', lien: 'https://www.qualipaysage.org/qualifications', note: "Via QualiPaysage — engagement de résultats environnementaux" } },
      { id: 'decennale_paysage', nom: 'Assurance Décennale', description: 'Requise si création de structures (terrasses, murets, clôtures...)', obligatoire: false, condition: 'Si construction de structures extérieures', validite: '1 an', icon: icon('decennale_paysage'), obtenir: { label: 'Obtenir ce document', lien: 'https://reassurez-moi.fr/guide/pro/garantie-decennale', note: 'Délivrée par votre assureur' } },
    ],
  },

  nettoyage: {
    label: 'Nettoyage',
    documents: [
      ...DOCUMENTS_COMMUNS,
      { id: 'certibiocide', nom: 'Certibiocide', description: 'Obligatoire depuis jan. 2026 pour tout achat/usage professionnel de biocides', obligatoire: true, condition: 'Si usage de produits désinfectants biocides (TP2, TP3, TP4)', validite: '5 ans', icon: icon('certibiocide'), obtenir: { label: 'Obtenir ce document', lien: 'https://entreprendre.service-public.gouv.fr/vosdroits/F31192', note: "Formation agréée par le Ministère de l'Agriculture" } },
      { id: 'nf_proprete', nom: 'Certification NF Service Propreté', description: 'Label qualité pour entreprises de nettoyage — valorisant', obligatoire: false, recommande: true, validite: '3 ans', icon: icon('nf_proprete'), obtenir: { label: 'Obtenir ce document', lien: 'https://www.afnor.org/certification/', note: 'Délivrée par AFNOR Certification' } },
    ],
  },

  traitement_nuisibles: {
    label: 'Traitement nuisibles',
    documents: [
      ...DOCUMENTS_COMMUNS,
      { id: 'certibiocide_nuisibles', nom: 'Certibiocide nuisibles (TP14/18/20)', description: 'OBLIGATOIRE pour utiliser des produits biocides contre les nuisibles', obligatoire: true, validite: '5 ans', icon: icon('certibiocide_nuisibles'), obtenir: { label: 'Obtenir ce document', lien: 'https://entreprendre.service-public.gouv.fr/vosdroits/F31192', note: "Formation agréée par le Ministère de l'Agriculture" } },
      { id: 'certiphyto_nuisibles', nom: 'Certiphyto', description: 'Obligatoire si usage de produits phytopharmaceutiques (rongeurs, insectes)', obligatoire: true, validite: '5 ans', icon: icon('certiphyto_nuisibles'), obtenir: { label: 'Obtenir ce document', lien: 'https://entreprendre.service-public.gouv.fr/vosdroits/R31441', note: 'Demande en ligne sur service-public.fr' } },
      { id: 'agrement_3d', nom: 'Agrément Ministériel 3D', description: "Obligatoire pour exercer l'activité de dératisation / désinsectisation / désinfection", obligatoire: true, validite: '5 ans', icon: icon('agrement_3d'), obtenir: { label: 'Obtenir ce document', lien: 'https://entreprendre.service-public.gouv.fr/vosdroits/F31192', note: 'Délivré par le Ministère de l\'Agriculture — DRAAF compétente' } },
      { id: 'cepa', nom: 'Certification CEPA', description: 'Norme européenne CEN 16636 — gage de professionnalisme et d\'expertise', obligatoire: false, recommande: true, validite: 'Variable', icon: icon('cepa'), obtenir: { label: 'Obtenir ce document', lien: 'https://www.cepa-europe.org', note: 'Certification européenne délivrée par CEPA' } },
    ],
  },

  demenagement: {
    label: 'Déménagement',
    documents: [
      ...DOCUMENTS_COMMUNS,
      { id: 'licence_transport', nom: 'Licence de transport intérieur (LTI)', description: 'OBLIGATOIRE pour toute entreprise de déménagement utilisant des véhicules', obligatoire: true, validite: 'Permanent', icon: icon('licence_transport'), obtenir: { label: 'Obtenir ce document', lien: 'https://entreprendre.service-public.gouv.fr/vosdroits/F23633', note: 'Délivrée par la DRIEAT / DREAL de votre région' } },
      { id: 'nf_demenagement', nom: 'NF Déménagement', description: 'Label qualité référence du secteur — rassure les clients', obligatoire: false, recommande: true, validite: '3 ans', icon: icon('nf_demenagement'), obtenir: { label: 'Obtenir ce document', lien: 'https://www.afnor.org/certification/', note: 'Délivrée par AFNOR Certification' } },
    ],
  },

  vitrerie: {
    label: 'Vitrerie',
    documents: [
      ...DOCUMENTS_COMMUNS,
      { id: 'decennale', nom: 'Assurance Décennale', description: 'Obligatoire pour remplacement de vitres et double vitrage', obligatoire: true, validite: '1 an', icon: icon('decennale'), obtenir: { label: 'Obtenir ce document', lien: 'https://reassurez-moi.fr/guide/pro/garantie-decennale', note: 'Délivrée par votre assureur' } },
      { id: 'qualibat', nom: 'Qualification Qualibat', description: 'Certification qualité vitrier', obligatoire: false, recommande: true, validite: '1 an', icon: icon('qualibat'), obtenir: { label: 'Obtenir ce document', lien: 'https://www.qualibat.com/nos-qualifications-certifications', note: 'Demande en ligne sur qualibat.com' } },
    ],
  },

  petits_travaux: {
    label: 'Petits travaux',
    documents: [
      ...DOCUMENTS_COMMUNS,
      { id: 'decennale', nom: 'Assurance Décennale', description: 'Requise si les travaux touchent à la structure du bâtiment', obligatoire: false, condition: 'Si travaux structurels', validite: '1 an', icon: icon('decennale'), obtenir: { label: 'Obtenir ce document', lien: 'https://reassurez-moi.fr/guide/pro/garantie-decennale', note: 'Délivrée par votre assureur' } },
    ],
  },

  ferronnerie: {
    label: 'Ferronnerie',
    documents: [
      ...DOCUMENTS_COMMUNS,
      { id: 'decennale', nom: 'Assurance Décennale', description: 'Obligatoire pour pose de portails, garde-corps, structures métalliques', obligatoire: true, validite: '1 an', icon: icon('decennale'), obtenir: { label: 'Obtenir ce document', lien: 'https://reassurez-moi.fr/guide/pro/garantie-decennale', note: 'Délivrée par votre assureur' } },
      { id: 'qualibat', nom: 'Qualification Qualibat', description: 'Certification qualité ferronnier / métallier', obligatoire: false, recommande: true, validite: '1 an', icon: icon('qualibat'), obtenir: { label: 'Obtenir ce document', lien: 'https://www.qualibat.com/nos-qualifications-certifications', note: 'Demande en ligne sur qualibat.com' } },
    ],
  },

  // ─── DIAGNOSTIC IMMOBILIER ─────────────────────────────────────────────────
  diagnostic: {
    label: 'Diagnostic immobilier',
    documents: [
      ...DOCUMENTS_COMMUNS,
      { id: 'cofrac_dpe', nom: 'Certification DPE (Cofrac)', description: 'OBLIGATOIRE pour réaliser des diagnostics de performance énergétique', obligatoire: true, validite: '7 ans', icon: icon('cofrac_dpe'), obtenir: { label: 'Obtenir ce document', lien: 'https://www.cofrac.fr/fr/organismes/recherche.php', note: 'Délivrée par un organisme certificateur accrédité Cofrac (Bureau Veritas, Socotec, Apave...)' } },
      { id: 'cofrac_amiante', nom: 'Certification Amiante (Cofrac)', description: 'OBLIGATOIRE — diagnostic amiante avant vente / travaux / démolition (bâtiments avant 1997)', obligatoire: true, validite: '5 ans', icon: icon('cofrac_amiante'), obtenir: { label: 'Obtenir ce document', lien: 'https://www.cofrac.fr/fr/organismes/recherche.php', note: 'Mention "avec mention" requise pour amiante avant travaux / démolition' } },
      { id: 'cofrac_plomb', nom: 'Certification Plomb / CREP (Cofrac)', description: 'OBLIGATOIRE pour Constat de Risque d\'Exposition au Plomb (bâtiments avant 1949)', obligatoire: true, validite: '5 ans', icon: icon('cofrac_plomb'), obtenir: { label: 'Obtenir ce document', lien: 'https://www.cofrac.fr/fr/organismes/recherche.php', note: 'Délivrée par organisme accrédité Cofrac' } },
      { id: 'cofrac_gaz', nom: 'Certification État de l\'installation gaz (Cofrac)', description: 'OBLIGATOIRE pour diag installations gaz de plus de 15 ans', obligatoire: true, validite: '5 ans', icon: icon('cofrac_gaz'), obtenir: { label: 'Obtenir ce document', lien: 'https://www.cofrac.fr/fr/organismes/recherche.php', note: 'Délivrée par organisme accrédité Cofrac' } },
      { id: 'cofrac_elec', nom: 'Certification État de l\'installation électrique (Cofrac)', description: 'OBLIGATOIRE pour diag installations élec de plus de 15 ans', obligatoire: true, validite: '5 ans', icon: icon('cofrac_elec'), obtenir: { label: 'Obtenir ce document', lien: 'https://www.cofrac.fr/fr/organismes/recherche.php', note: 'Délivrée par organisme accrédité Cofrac' } },
      { id: 'cofrac_termites', nom: 'Certification Termites (Cofrac)', description: 'OBLIGATOIRE en zones à risque (préfectures publient les arrêtés)', obligatoire: true, condition: 'Si zone arrêtée préfectoral termites', validite: '5 ans', icon: icon('cofrac_termites'), obtenir: { label: 'Obtenir ce document', lien: 'https://www.cofrac.fr/fr/organismes/recherche.php', note: 'Délivrée par organisme accrédité Cofrac' } },
      { id: 'cofrac_erp', nom: 'État des Risques et Pollutions (ERP)', description: 'Document préfectoral obligatoire pour vente / location', obligatoire: false, recommande: true, validite: '6 mois', icon: icon('cofrac_erp'), obtenir: { label: 'Obtenir ce document', lien: 'https://errial.georisques.gouv.fr', note: 'Généré sur le portail GéoRisques' } },
      { id: 'rc_pro', nom: 'RC Pro Diagnostiqueur', description: 'Assurance responsabilité civile professionnelle spécifique diagnostiqueur (montant minimum 300 K€ par sinistre)', obligatoire: true, validite: '1 an', icon: icon('rc_pro'), obtenir: { label: 'Obtenir ce document', lien: 'https://www.april-courtage.fr', note: 'Comparer chez APRIL, Allianz, MMA — minimum légal 300 K€' } },
      { id: 'carte_diagnostiqueur', nom: 'Carte professionnelle diagnostiqueur', description: 'Justifie de l\'enregistrement de l\'activité auprès de la chambre de commerce', obligatoire: true, validite: 'Permanent', icon: icon('carte_diagnostiqueur'), obtenir: { label: 'Obtenir ce document', lien: 'https://www.cci.fr', note: 'Demande à la CCI lors de l\'inscription au RCS' } },
    ],
  },

  // ─── PLAQUISTE ─────────────────────────────────────────────────────────────
  plaquiste: {
    label: 'Plaquiste / Plâtrerie',
    documents: [
      ...DOCUMENTS_COMMUNS,
      { id: 'decennale', nom: 'Assurance Décennale', description: 'Obligatoire — travaux de cloisonnement, plafonds suspendus, doublages isolants', obligatoire: true, validite: '1 an', icon: icon('decennale'), obtenir: { label: 'Obtenir ce document', lien: 'https://reassurez-moi.fr/guide/pro/garantie-decennale', note: 'Délivrée par votre assureur' } },
      { id: 'qualibat_platrerie', nom: 'Qualibat Plâtrerie / Cloisons sèches', description: 'Référence qualité métier — exigée par maîtres d\'ouvrage et marchés publics', obligatoire: false, recommande: true, validite: '1 an', icon: icon('qualibat_platrerie'), obtenir: { label: 'Obtenir ce document', lien: 'https://www.qualibat.com/nos-qualifications-certifications', note: 'Sections 4131 (plâtrerie traditionnelle), 4132 (cloisons sèches), 4231 (plafonds suspendus)' } },
      { id: 'rge', nom: 'Certification RGE', description: "Obligatoire si pose d'isolation intérieure (ITI) — permet aux clients d'obtenir MaPrimeRénov'", obligatoire: false, recommande: true, condition: 'Si isolation intérieure', validite: '4 ans', icon: icon('rge'), obtenir: { label: 'Obtenir ce document', lien: 'https://www.qualibat.com/comment-devenir-qualibat-RGE', note: 'Qualibat RGE Section 7141' } },
      { id: 'amiante_ss4', nom: 'Certification amiante SS4', description: 'Obligatoire pour intervention sur cloisons / plafonds bâtiments avant 1997', obligatoire: true, condition: 'Si intervention sur bâtiment avant 1997', validite: '5 ans', icon: icon('amiante_ss4'), obtenir: { label: 'Obtenir ce document', lien: 'https://entreprendre.service-public.gouv.fr/vosdroits/F32355', note: "Formation auprès d'un organisme certifié COFRAC" } },
      { id: 'carte_btp', nom: 'Carte Pro BTP', description: 'Obligatoire pour tout salarié du BTP sur chantier', obligatoire: true, condition: 'Si salariés sur chantier', validite: 'Durée du contrat', icon: icon('carte_btp'), obtenir: { label: 'Obtenir ce document', lien: 'https://www.cartebtp.fr', note: 'Demande employeur sur cartebtp.fr' } },
    ],
  },

  // ─── PISCINE ───────────────────────────────────────────────────────────────
  piscine: {
    label: 'Piscine',
    documents: [
      ...DOCUMENTS_COMMUNS,
      { id: 'decennale', nom: 'Assurance Décennale', description: 'OBLIGATOIRE pour piscine enterrée / semi-enterrée — couvre étanchéité et structure', obligatoire: true, validite: '1 an', icon: icon('decennale'), obtenir: { label: 'Obtenir ce document', lien: 'https://reassurez-moi.fr/guide/pro/garantie-decennale', note: 'Mention spécifique "Piscine" obligatoire dans le contrat' } },
      { id: 'qualipiscine', nom: 'Qualification Propiscines / Qualipiscine', description: 'Référence professionnelle FPP — gage de respect de la norme NF P90-309 et de l\'éthique métier', obligatoire: false, recommande: true, validite: '1 an', icon: icon('qualipiscine'), obtenir: { label: 'Obtenir ce document', lien: 'https://www.propiscines.fr', note: 'Délivrée par la Fédération des Professionnels de la Piscine (FPP)' } },
      { id: 'habilitation_elec', nom: 'Habilitation électrique BR / B1V', description: 'Obligatoire pour câblage pompe, éclairage subaquatique, motorisation volet', obligatoire: true, validite: '3 ans', icon: icon('habilitation_elec'), obtenir: { label: 'Obtenir ce document', lien: 'https://habilitations-electrique.fr', note: 'Formation NF C18-510, niveau BR (intervention BT) ou B1V (travaux sous tension)' } },
      { id: 'fluides_frigorigenes', nom: 'Attestation fluides frigorigènes', description: 'Obligatoire pour installation / maintenance PAC piscine', obligatoire: true, condition: 'Si installation PAC piscine', validite: '5 ans', icon: icon('fluides_frigorigenes'), obtenir: { label: 'Obtenir ce document', lien: 'https://entreprendre.service-public.gouv.fr/vosdroits/F39033', note: 'Catégorie I minimum' } },
      { id: 'rge_qualipv', nom: 'Certification RGE QualiPV', description: "Obligatoire pour pose de chauffage solaire piscine avec aide MaPrimeRénov'", obligatoire: false, recommande: true, condition: 'Si chauffage solaire piscine', validite: '4 ans', icon: icon('rge_qualipv'), obtenir: { label: 'Obtenir ce document', lien: 'https://www.qualit-enr.org/qualipv/', note: "Délivrée par Qualit'EnR" } },
      { id: 'carte_btp', nom: 'Carte Pro BTP', description: 'Obligatoire pour tout salarié BTP sur chantier piscine', obligatoire: true, condition: 'Si salariés sur chantier', validite: 'Durée du contrat', icon: icon('carte_btp'), obtenir: { label: 'Obtenir ce document', lien: 'https://www.cartebtp.fr', note: 'Demande employeur sur cartebtp.fr' } },
    ],
  },

  // ─── RAMONAGE ──────────────────────────────────────────────────────────────
  ramonage: {
    label: 'Ramonage',
    documents: [
      ...DOCUMENTS_COMMUNS,
      { id: 'decennale', nom: 'Assurance Décennale', description: 'Recommandée — couvre les dommages liés à un ramonage défectueux ou à une intervention sur conduit', obligatoire: false, recommande: true, validite: '1 an', icon: icon('decennale'), obtenir: { label: 'Obtenir ce document', lien: 'https://reassurez-moi.fr/guide/pro/garantie-decennale', note: 'Délivrée par votre assureur' } },
      { id: 'carte_ramoneur', nom: 'Qualification professionnelle Ramoneur', description: 'OBLIGATOIRE — CAP / brevet professionnel ou 3 ans d\'expérience attestée (loi du 5 juillet 1996)', obligatoire: true, validite: 'Permanent', icon: icon('carte_ramoneur'), obtenir: { label: 'Obtenir ce document', lien: 'https://www.cma-france.fr', note: 'CAP Monteur en Installations Sanitaires + spécialisation, ou justificatif 3 ans d\'expérience' } },
      { id: 'qualifumisterie', nom: 'Qualibat Fumisterie', description: 'Certification pose / réfection de conduits de fumée — exigée par les compagnies d\'assurance', obligatoire: false, recommande: true, validite: '1 an', icon: icon('qualifumisterie'), obtenir: { label: 'Obtenir ce document', lien: 'https://www.qualibat.com/nos-qualifications-certifications', note: 'Section 8141 Qualibat' } },
      { id: 'qualigaz', nom: 'Certification QualiGaz', description: 'Obligatoire pour ramonage / contrôle de conduits gaz', obligatoire: true, condition: 'Si conduits gaz', validite: '5 ans', icon: icon('qualigaz'), obtenir: { label: 'Obtenir ce document', lien: 'https://www.qualigaz.com', note: 'Délivrée par Qualigaz après formation agréée' } },
      { id: 'carte_btp', nom: 'Carte Pro BTP', description: 'Obligatoire pour tout salarié BTP sur chantier', obligatoire: true, condition: 'Si salariés sur chantier', validite: 'Durée du contrat', icon: icon('carte_btp'), obtenir: { label: 'Obtenir ce document', lien: 'https://www.cartebtp.fr', note: 'Demande employeur sur cartebtp.fr' } },
    ],
  },

  // ─── STORE-BANNE ───────────────────────────────────────────────────────────
  store_banne: {
    label: 'Store / banne',
    documents: [
      ...DOCUMENTS_COMMUNS,
      { id: 'decennale', nom: 'Assurance Décennale', description: 'Obligatoire — fixation extérieure structurelle (engage la décennale du bâti porteur)', obligatoire: true, validite: '1 an', icon: icon('decennale'), obtenir: { label: 'Obtenir ce document', lien: 'https://reassurez-moi.fr/guide/pro/garantie-decennale', note: 'Délivrée par votre assureur' } },
      { id: 'qualibat_menuiserie_ext', nom: 'Qualibat Menuiserie extérieure', description: 'Référence qualité — pose stores bannes, pergolas, volets motorisés', obligatoire: false, recommande: true, validite: '1 an', icon: icon('qualibat_menuiserie_ext'), obtenir: { label: 'Obtenir ce document', lien: 'https://www.qualibat.com/nos-qualifications-certifications', note: 'Section 3531 (menuiserie extérieure aluminium / PVC)' } },
      { id: 'habilitation_elec', nom: 'Habilitation électrique BR', description: 'Obligatoire pour raccordement moteur / domotique store motorisé', obligatoire: true, condition: 'Si motorisation', validite: '3 ans', icon: icon('habilitation_elec'), obtenir: { label: 'Obtenir ce document', lien: 'https://habilitations-electrique.fr', note: 'Formation NF C18-510 niveau BR' } },
      { id: 'carte_btp', nom: 'Carte Pro BTP', description: 'Obligatoire pour tout salarié BTP sur chantier', obligatoire: true, condition: 'Si salariés sur chantier', validite: 'Durée du contrat', icon: icon('carte_btp'), obtenir: { label: 'Obtenir ce document', lien: 'https://www.cartebtp.fr', note: 'Demande employeur sur cartebtp.fr' } },
    ],
  },

  // ─── DEBOUCHAGE ────────────────────────────────────────────────────────────
  debouchage: {
    label: 'Débouchage / Assainissement',
    documents: [
      ...DOCUMENTS_COMMUNS,
      { id: 'decennale', nom: 'Assurance Décennale', description: 'Obligatoire si pose ou modification de canalisation (assainissement structurel)', obligatoire: true, condition: 'Si pose / modification canalisation', validite: '1 an', icon: icon('decennale'), obtenir: { label: 'Obtenir ce document', lien: 'https://reassurez-moi.fr/guide/pro/garantie-decennale', note: 'Délivrée par votre assureur' } },
      { id: 'qualibat', nom: 'Qualibat Plomberie / Assainissement', description: 'Référence qualité — sections 5111 / 5112 / 5141 selon spécialisation', obligatoire: false, recommande: true, validite: '1 an', icon: icon('qualibat'), obtenir: { label: 'Obtenir ce document', lien: 'https://www.qualibat.com/nos-qualifications-certifications', note: 'Sections 5111 (plomberie sanitaire), 5112 (plomberie chauffage), 5141 (assainissement)' } },
      { id: 'quali_eau', nom: "Quali'Eau", description: "Maîtrise sanitaire des réseaux d'eau potable — gage de confiance pour intervention curative", obligatoire: false, recommande: true, validite: '5 ans', icon: icon('quali_eau'), obtenir: { label: 'Obtenir ce document', lien: 'https://www.qualibat.com', note: 'Délivrée par Qualibat' } },
      { id: 'carte_btp', nom: 'Carte Pro BTP', description: 'Obligatoire pour tout salarié BTP sur chantier', obligatoire: true, condition: 'Si salariés sur chantier', validite: 'Durée du contrat', icon: icon('carte_btp'), obtenir: { label: 'Obtenir ce document', lien: 'https://www.cartebtp.fr', note: 'Demande employeur sur cartebtp.fr' } },
    ],
  },
}

// ── Mapping slug d'inscription → clé wallet ──────────────────
// Les slugs viennent du formulaire d'inscription (ex: 'espaces-verts' → 'espaces_verts')
export function slugToWalletKey(slug: string): string | null {
  const key = slug.replace(/-/g, '_').toLowerCase()
  return WALLET_PAR_METIER[key] ? key : null
}

// ── Mapping label français → clé wallet (fallback texte libre) ─
export function categoryToWalletKey(category: string | undefined | null): string | null {
  if (!category) return null

  // 1. Essai direct via slug (ex: 'espaces-verts', 'nettoyage')
  const direct = slugToWalletKey(category)
  if (direct) return direct

  // 2. Regex sur label français normalisé (accents supprimés)
  const c = category.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')

  // Ordre important : les regex spécifiques (debouchage, ramonage, etc.) DOIVENT être
  // testées AVANT les regex génériques (plomb, chauf...) pour éviter qu'un slug spécifique
  // ne soit absorbé par un fallback plus large.
  const MAP: [RegExp, string][] = [
    // ── Spécifiques d'abord (configs dédiées récentes) ──
    [/diagnost/, 'diagnostic'],
    [/plaquist|platrer|cloison.sech/, 'plaquiste'],
    [/piscin|pool/, 'piscine'],
    [/ramon|chimney/, 'ramonage'],
    [/store.*banne|banne.*solaire|pergola/, 'store_banne'],
    [/debouch|assainiss|curage|wc.bouch|canalisation.bouch/, 'debouchage'],
    // ── Génériques ensuite ──
    [/plomb/, 'plomberie'],
    [/elec|electr/, 'electricite'],
    [/serr|lock/, 'serrurerie'],
    [/chauf|heat|poele|chaudier/, 'chauffage'],
    [/clim|froid|frigori|hvac/, 'climatisation'],
    [/peintr|paint|ravale/, 'peinture'],
    [/macon|mason|beton|gros.oeuvre/, 'maconnerie'],
    [/menuis|carpentr|boiserie|parquet/, 'menuiserie'],
    [/toit|couver|zinguer|ardois/, 'toiture'],
    [/carrela|carrel|faience|mosaiq/, 'carrelage'],
    [/renov|rehabilit|restaur/, 'renovation'],
    [/amena.ext|exterieu|jardin.*amenag/, 'amenagement_exterieur'],
    [/espac.vert|paysag|elagu|jardin|tonte/, 'espaces_verts'],
    [/nettoy|propret|menage/, 'nettoyage'],
    [/nuisib|desrat|desinsect|3d\b/, 'traitement_nuisibles'],
    [/demenag|transport/, 'demenagement'],
    [/vitrer|vitr|vitrail|glassier/, 'vitrerie'],
    [/petit.trav|handyman|multi.serv/, 'petits_travaux'],
    // 'metaller' pour matcher 'metallerie' (double L) + autres variantes — était bug avant
    [/ferronn|metaller|metalier|soudure|grille/, 'ferronnerie'],
  ]

  for (const [re, key] of MAP) {
    if (re.test(c)) return key
  }
  return null
}

// ── Obtenir les documents pour un artisan ───────────────────
// categories peut être un tableau de slugs (artisan.categories) ou un string (legacy)
export function getWalletDocuments(
  categories: string | string[] | undefined | null
): { docs: WalletDocConfig[]; metierLabel: string | null; fallback: boolean } {
  const slugs = Array.isArray(categories)
    ? categories
    : categories ? [categories] : []

  // Résoudre les clés wallet pour chaque slug/label
  const keys = [...new Set(slugs.map(s => categoryToWalletKey(s)).filter(Boolean) as string[])]

  if (keys.length === 0) {
    return { docs: DOCUMENTS_COMMUNS, metierLabel: null, fallback: true }
  }

  if (keys.length === 1) {
    const cfg = WALLET_PAR_METIER[keys[0]]
    return { docs: cfg.documents, metierLabel: cfg.label, fallback: false }
  }

  // Multi-métier : fusionner en dédupliquant par id (les communs Kbis/URSSAF/RC Pro n'apparaissent qu'une fois)
  const seen = new Set<string>()
  const merged: WalletDocConfig[] = []
  for (const key of keys) {
    for (const doc of WALLET_PAR_METIER[key].documents) {
      if (!seen.has(doc.id)) {
        seen.add(doc.id)
        merged.push(doc)
      }
    }
  }
  const labels = keys.map(k => WALLET_PAR_METIER[k].label).join(' · ')
  return { docs: merged, metierLabel: labels, fallback: false }
}
