// ─── Shared Types for Syndic Dashboard ────────────────────────────────────────

export type Page = 'accueil' | 'immeubles' | 'artisans' | 'missions' | 'canal' | 'planning' | 'documents' | 'facturation' | 'coproprios' | 'alertes' | 'emails' | 'reglementaire' | 'rapport' | 'ia' | 'parametres' | 'equipe' | 'comptabilite_tech' | 'analyse_devis' | 'docs_interventions' | 'compta_copro' | 'ag_digitale' | 'impayés' | 'carnet_entretien' | 'sinistres' | 'extranet' | 'pointage' | 'echéances' | 'recouvrement' | 'preparateur_ag' | 'modules' | 'pppt' | 'historique_immeuble' | 'urgences' | 'dpe_collectif' | 'visite_technique' | 'declaracao_encargos' | 'seguro_condominio' | 'fundo_reserva' | 'votacao_online' | 'portal_condomino' | 'pagamentos_digitais' | 'carregamento_ve' | 'reserva_espacos' | 'ocorrencias' | 'enquetes' | 'quadro_avisos' | 'atas_ia' | 'mapa_quotas' | 'orcamentos_obras' | 'cobranca_judicial' | 'monitorizacao_consumos' | 'whatsapp_condominos' | 'arquivo_digital' | 'vote_correspondance' | 'extranet_enrichi' | 'irve_bornes' | 'saisie_ia_factures' | 'reservation_espaces_fr' | 'signalements_fr' | 'sondages_fr' | 'panneau_affichage' | 'pv_assemblee_ia' | 'appels_fonds' | 'mise_en_concurrence' | 'recouvrement_enrichi_fr' | 'suivi_energetique_fr' | 'communication_demat' | 'ged_certifiee' | 'obrigacoes_legais' | 'relatorio_gestao' | 'preparador_assembleia' | 'plano_manutencao' | 'certificacao_energetica' | 'vistoria_tecnica' | 'pontuacao_saude' | 'orcamento_anual_ia' | 'contacto_proativo_ia' | 'ocorrencias_ia' | 'gestao_seguros' | 'checklists_ia' | 'processamentos_lote' | 'ag_live_digital' | 'marketplace_artisans' | 'predicao_manutencao' | 'qrcode_fracao' | 'dashboard_condomino_rt' | 'comparador_energia' | 'assinatura_cmd' | 'dashboard_multi_immeubles' | 'efatura_at' | 'infractions' | 'reconciliation_bancaire' | 'benchmarking' | 'chatbot_whatsapp'

export interface Immeuble {
  id: string
  nom: string
  adresse: string
  ville: string
  codePostal: string
  nbLots: number
  anneeConstruction: number
  typeImmeuble: string
  gestionnaire: string
  prochainControle?: string
  nbInterventions: number
  budgetAnnuel: number
  depensesAnnee: number
  // ── Géolocalisation ──
  latitude?: number
  longitude?: number
  geolocActivee?: boolean
  rayonDetection?: number
  // ── Règlement de copropriété ──
  reglementTexte?: string
  reglementPdfNom?: string
  reglementDateMaj?: string
  reglementChargesRepartition?: string
  reglementMajoriteAG?: string
  reglementFondsTravaux?: boolean
  reglementFondsRoulementPct?: number
  reglementClausesIA?: string
}

export interface Artisan {
  id: string
  nom: string
  prenom?: string
  nom_famille?: string
  metier: string
  telephone: string
  email: string
  siret: string
  rcProValide: boolean
  rc_pro_valide?: boolean
  rcProExpiration: string
  rc_pro_expiration?: string
  decennaleValide: boolean
  assurance_decennale_valide?: boolean
  decennaleExpiration: string
  assurance_decennale_expiration?: string
  note: number
  nbInterventions: number
  nb_interventions?: number
  statut: 'actif' | 'suspendu' | 'en_attente'
  vitfixCertifie: boolean
  vitfix_certifie?: boolean
  artisan_user_id?: string | null
  compte_existant?: boolean
  cabinet_id?: string
}

export interface SyndicMessage {
  id: string
  cabinet_id: string
  artisan_user_id: string
  sender_id: string
  sender_role: 'syndic' | 'artisan'
  sender_name: string
  content: string
  mission_id?: string | null
  message_type: 'text' | 'rapport' | 'proof_of_work' | 'devis' | 'photo'
  read_at?: string | null
  created_at: string
}

export interface CanalInterneMsg {
  id: string
  de: string
  deRole: string
  type: 'message' | 'tache' | 'planning'
  contenu: string
  date: string
  lu: boolean
  planningDate?: string
  planningHeure?: string
  planningResident?: string
  planningResidence?: string
  planningMissionCreee?: boolean
  tacheAssignee?: string
  tachePriorite?: 'normale' | 'urgente'
  tacheStatut?: 'en_attente' | 'en_cours' | 'terminee'
}

export interface Mission {
  id: string
  immeuble: string
  artisan: string
  type: string
  description: string
  priorite: 'urgente' | 'normale' | 'planifiee'
  statut: 'en_attente' | 'acceptee' | 'en_cours' | 'terminee' | 'annulee'
  dateCreation: string
  dateIntervention?: string
  montantDevis?: number
  montantFacture?: number
  batiment?: string
  etage?: string
  numLot?: string
  locataire?: string
  telephoneLocataire?: string
  accesLogement?: string
  rapportArtisan?: string
  travailEffectue?: string
  materiauxUtilises?: string
  problemesConstates?: string
  recommandations?: string
  dateRapport?: string
  dureeIntervention?: string
  canalMessages?: { auteur: string; role: string; texte: string; date: string }[]
  demandeurNom?: string
  demandeurRole?: 'coproprio' | 'locataire' | 'technicien'
  demandeurEmail?: string
  demandeurMessages?: { auteur: string; role: string; texte: string; date: string }[]
  zoneSignalee?: string
  estPartieCommune?: boolean
  trackingToken?: string
}

export interface Alerte {
  id: string
  type: 'rc_pro' | 'controle' | 'budget' | 'mission' | 'document'
  message: string
  urgence: 'haute' | 'moyenne' | 'basse'
  date: string
}

export interface PlanningEvent {
  id: string
  titre: string
  date: string
  heure: string
  dureeMin: number
  type: 'reunion' | 'visite' | 'rdv' | 'tache' | 'autre'
  assigneA: string
  assigneRole: string
  description?: string
  creePar: string
  statut: 'planifie' | 'termine' | 'annule'
}

export interface EmailAnalysed {
  id: string
  gmail_message_id: string
  from_email: string
  from_name: string
  subject: string
  body_preview: string
  received_at: string
  urgence: 'haute' | 'moyenne' | 'basse'
  type_demande: string
  resume_ia: string
  immeuble_detecte: string | null
  locataire_detecte: string | null
  actions_suggerees: string[]
  reponse_suggeree: string | null
  statut: 'nouveau' | 'traite' | 'archive' | 'mission_cree' | 'repondu'
  note_interne: string
}

export interface TeamMember {
  id: string
  email: string
  full_name: string
  role: string
  invite_token: string | null
  invite_sent_at: string | null
  accepted_at: string | null
  is_active: boolean
  created_at: string
  custom_modules: string[] | null
}

export interface Coproprio {
  id: string
  immeuble: string
  batiment: string
  etage: number
  numeroPorte: string
  nomProprietaire: string
  prenomProprietaire: string
  emailProprietaire: string
  telephoneProprietaire: string
  nomLocataire?: string
  prenomLocataire?: string
  emailLocataire?: string
  telephoneLocataire?: string
  estOccupe: boolean
  notes?: string
}

export interface DocIntervention {
  id: string
  mission_id?: string
  artisan_nom: string
  artisan_metier: string
  immeuble: string
  date_intervention: string
  type: 'facture' | 'devis' | 'rapport' | 'photo' | 'autre'
  filename: string
  url: string
  envoye_compta: boolean
  envoye_compta_at?: string
  notes?: string
  montant?: number
}

export type TypeDocument = 'rapport' | 'facture' | 'devis' | 'contrat' | 'diagnostic' | 'ag' | 'plan' | 'controle' | 'assurance' | 'autre'

export interface GEDDocument {
  id: string
  nom: string
  type: TypeDocument
  immeuble: string
  artisan: string
  locataire: string
  dateDocument: string
  dateAjout: string
  taille: string
  tags: string[]
  url?: string
}

export type TypeEcheance = 'dpe' | 'ascenseur' | 'amiante' | 'plomb' | 'gaz' | 'electricite' | 'ag' | 'assurance' | 'ravalement' | 'autre'

export interface EcheanceReglementaire {
  id: string
  immeuble: string
  type: TypeEcheance
  label: string
  dateEcheance: string
  periodicite: number
  notes?: string
}

export interface SignatureData {
  svg_data: string
  signataire: string
  timestamp: string
  document_ref: string
  hash_sha256: string
}

export interface DevisExtracted {
  artisan_nom?: string
  artisan_siret?: string
  artisan_metier?: string
  type_document?: string
  numero_document?: string
  date_document?: string
  description_travaux?: string
  immeuble?: string
  montant_ht?: number
  montant_ttc?: number
  tva_taux?: number
  tva_montant?: number
  date_intervention?: string
  artisan_email?: string
  artisan_telephone?: string
  priorite?: 'urgente' | 'normale' | 'planifiee'
  prestations?: Array<{ designation: string; type?: string; quantite?: number; unite?: string; prix_unitaire_ht?: number; total_ht?: number }>
  mentions_presentes?: string[]
  mentions_manquantes?: string[]
  statut_juridique?: string
}

export type InputMode = 'drop' | 'paste'

export interface PointageSession {
  id: string
  immeubleId: string
  immeubleNom: string
  immeubleAdresse: string
  dateDebut: string
  dateFin: string
  dureeSecondes: number
  mode: 'manuel' | 'geo'
}

export interface PointageActif {
  immeubleId: string
  immeubleNom: string
  immeubleAdresse: string
  dateDebut: string
  mode: 'manuel' | 'geo'
}

// ─── Shared Constants ──────────────────────────────────────────────────────────

export const ROLE_LABELS_TEAM: Record<string, string> = {
  syndic_admin: 'Administrateur',
  syndic_tech: 'Gestionnaire Technique',
  syndic_secretaire: 'Secrétaire',
  syndic_gestionnaire: 'Gestionnaire Copropriété',
  syndic_comptable: 'Comptable',
  syndic_juriste: 'Juriste',
}

export const ROLE_LABELS_TEAM_PT: Record<string, string> = {
  syndic_admin: 'Administrador',
  syndic_tech: 'Gestor Técnico',
  syndic_secretaire: 'Secretária',
  syndic_gestionnaire: 'Gestor de Condomínio',
  syndic_comptable: 'Contabilista',
  syndic_juriste: 'Jurista',
}

export function getRoleLabel(role: string, locale?: string): string {
  if (locale === 'pt') return ROLE_LABELS_TEAM_PT[role] || role
  return ROLE_LABELS_TEAM[role] || role
}

export const ROLE_COLORS: Record<string, string> = {
  syndic_admin: 'bg-[#F7F4EE] text-[#0D1B2E]',
  syndic_tech: 'bg-blue-100 text-blue-800',
  syndic_secretaire: 'bg-green-100 text-green-800',
  syndic_gestionnaire: 'bg-yellow-100 text-yellow-800',
  syndic_comptable: 'bg-orange-100 text-orange-800',
  syndic_juriste: 'bg-purple-100 text-purple-800',
}

export const ROLE_EMOJIS_TEAM: Record<string, string> = {
  syndic_admin: '👑',
  syndic_tech: '🔧',
  syndic_secretaire: '📋',
  syndic_gestionnaire: '🏢',
  syndic_comptable: '💶',
  syndic_juriste: '⚖️',
}

export const TYPE_EMAIL_CONFIG: Record<string, { emoji: string; label: string; color: string }> = {
  signalement_panne: { emoji: '🔧', label: 'Signalement panne', color: 'bg-orange-100 text-orange-700' },
  demande_devis:     { emoji: '📝', label: 'Demande devis',      color: 'bg-blue-100 text-blue-700' },
  reclamation:       { emoji: '⚠️', label: 'Réclamation',        color: 'bg-red-100 text-red-700' },
  ag:                { emoji: '🔑', label: 'Assemblée générale', color: 'bg-[#F7F4EE] text-[#C9A84C]' },
  facturation:       { emoji: '💶', label: 'Facturation',        color: 'bg-green-100 text-green-700' },
  resiliation:       { emoji: '📤', label: 'Résiliation',        color: 'bg-pink-100 text-pink-700' },
  information:       { emoji: 'ℹ️', label: 'Information',        color: 'bg-[#F7F4EE] text-gray-600' },
  autre:             { emoji: '📄', label: 'Autre',              color: 'bg-[#F7F4EE] text-gray-500' },
}

export const TYPE_DOC_CONFIG: Record<TypeDocument, { emoji: string; label: string; color: string }> = {
  rapport:    { emoji: '📋', label: 'Rapport intervention', color: 'bg-[#F7F4EE] text-[#C9A84C]' },
  facture:    { emoji: '💶', label: 'Facture',              color: 'bg-green-100 text-green-700' },
  devis:      { emoji: '📝', label: 'Devis',                color: 'bg-amber-100 text-amber-700' },
  contrat:    { emoji: '📜', label: 'Contrat',              color: 'bg-blue-100 text-blue-700' },
  diagnostic: { emoji: '🏛️', label: 'Diagnostic légal',     color: 'bg-[#F7F4EE] text-[#C9A84C]' },
  ag:         { emoji: '🔑', label: 'PV Assemblée',         color: 'bg-pink-100 text-pink-700' },
  plan:       { emoji: '🏗️', label: 'Plan / Carnet',        color: 'bg-orange-100 text-orange-700' },
  controle:   { emoji: '⚙️', label: 'Contrôle réglementaire', color: 'bg-red-100 text-red-700' },
  assurance:  { emoji: '🛡️', label: 'Assurance / RC Pro',   color: 'bg-teal-100 text-teal-700' },
  autre:      { emoji: '📄', label: 'Autre',                color: 'bg-[#F7F4EE] text-gray-600' },
}

export const ECHEANCE_CONFIG: Record<TypeEcheance, { emoji: string; label: string; color: string }> = {
  dpe:          { emoji: '🏷️', label: 'DPE',                     color: 'bg-blue-100 text-blue-700' },
  ascenseur:    { emoji: '🛗', label: 'Contrôle ascenseur',       color: 'bg-orange-100 text-orange-700' },
  amiante:      { emoji: '⚠️', label: 'Diagnostic amiante',       color: 'bg-red-100 text-red-700' },
  plomb:        { emoji: '🔩', label: 'Diagnostic plomb (CREP)',  color: 'bg-[#F7F4EE] text-gray-700' },
  gaz:          { emoji: '🔥', label: 'Contrôle gaz',             color: 'bg-yellow-100 text-yellow-700' },
  electricite:  { emoji: '⚡', label: 'Contrôle électricité',     color: 'bg-[#F7F4EE] text-[#C9A84C]' },
  ag:           { emoji: '🔑', label: 'Assemblée Générale',       color: 'bg-[#F7F4EE] text-[#C9A84C]' },
  assurance:    { emoji: '🛡️', label: 'Renouvellement assurance', color: 'bg-teal-100 text-teal-700' },
  ravalement:   { emoji: '🏗️', label: 'Ravalement façade',        color: 'bg-pink-100 text-pink-700' },
  autre:        { emoji: '📋', label: 'Autre',                    color: 'bg-[#F7F4EE] text-gray-500' },
}

export const STATUT_ECHEANCE_CONFIG = {
  expire: { label: 'Expiré',  color: 'bg-red-100 text-red-700 border-red-300',       dot: 'bg-red-500' },
  urgent: { label: 'Urgent',  color: 'bg-orange-100 text-orange-700 border-orange-300', dot: 'bg-[#C9A84C]' },
  proche: { label: 'Proche',  color: 'bg-amber-100 text-amber-700 border-amber-300',  dot: 'bg-amber-400' },
  ok:     { label: 'OK',      color: 'bg-green-100 text-green-700 border-green-300',  dot: 'bg-green-500' },
}

export const RAYON_DETECTION_DEFAUT = 150

// ─── Shared Utility Functions ──────────────────────────────────────────────────

export function getStatutEcheance(dateStr: string): 'expire' | 'urgent' | 'proche' | 'ok' {
  const date = new Date(dateStr)
  const now = new Date()
  const diff = (date.getTime() - now.getTime()) / (1000 * 86400)
  if (diff < 0) return 'expire'
  if (diff <= 30) return 'urgent'
  if (diff <= 90) return 'proche'
  return 'ok'
}

export function getCoproKey(): string {
  if (typeof window === 'undefined') return 'fixit_copros_unknown'
  const candidate = Object.keys(localStorage).find(k => k.startsWith('fixit_syndic_immeubles_'))
  const uid = candidate ? candidate.replace('fixit_syndic_immeubles_', '') : 'local'
  return `fixit_copros_${uid}`
}

export function haversineMetres(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLng = (lng2 - lng1) * Math.PI / 180
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

// ─── Small UI Components ───────────────────────────────────────────────────────

export function StatCard({ emoji, label, value, sub, color = 'yellow' }: { emoji: string; label: string; value: string | number; sub?: string; color?: string }) {
  const icoColors: Record<string, string> = {
    yellow: 'var(--sd-gold-dim, rgba(201,168,76,0.15))',
    purple: 'var(--sd-gold-dim, rgba(201,168,76,0.15))',
    green:  'var(--sd-teal-soft, #E6F4F2)',
    red:    'var(--sd-red-soft, #FDECEA)',
    blue:   'var(--sd-teal-soft, #E6F4F2)',
  }
  return (
    <div style={{ background: '#fff', border: '1px solid var(--sd-border,#E4DDD0)', borderRadius: 12, padding: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ width: 38, height: 38, borderRadius: 9, background: icoColors[color] || icoColors.yellow, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>{emoji}</div>
      <div>
        <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 30, color: 'var(--sd-navy,#0D1B2E)', lineHeight: 1 }}>{value}</div>
        <div style={{ fontSize: 13, color: 'var(--sd-ink-2,#4A5E78)', fontWeight: 400, marginTop: 4 }}>{label}</div>
        {sub && <div style={{ fontSize: 11, color: 'var(--sd-ink-3,#8A9BB0)', marginTop: 2 }}>{sub}</div>}
      </div>
    </div>
  )
}

export function Badge({ statut, locale }: { statut: Mission['statut']; locale?: string }) {
  const styles: Record<string, { bg: string; color: string }> = {
    en_attente: { bg: 'var(--sd-amber-soft,#FEF5E4)',   color: 'var(--sd-amber,#D4830A)' },
    acceptee:   { bg: 'var(--sd-teal-soft,#E6F4F2)',    color: 'var(--sd-teal,#1A7A6E)' },
    en_cours:   { bg: 'var(--sd-amber-soft,#FEF5E4)',   color: 'var(--sd-amber,#D4830A)' },
    terminee:   { bg: 'var(--sd-teal-soft,#E6F4F2)',    color: 'var(--sd-teal,#1A7A6E)' },
    annulee:    { bg: 'var(--sd-cream-dark,#EDE8DF)',   color: 'var(--sd-ink-3,#8A9BB0)' },
  }
  const labels: Record<string, string> = locale === 'pt'
    ? { en_attente: 'Pendente', acceptee: 'Aceite', en_cours: 'Em curso', terminee: 'Concluída', annulee: 'Cancelada' }
    : { en_attente: 'En attente', acceptee: 'Acceptée', en_cours: 'En cours', terminee: 'Terminée', annulee: 'Annulée' }
  const s = styles[statut] || styles.annulee
  return (
    <span style={{ fontSize: 10, fontWeight: 600, padding: '3px 8px', borderRadius: 5, background: s.bg, color: s.color, letterSpacing: '0.3px', whiteSpace: 'nowrap' }}>
      {labels[statut] || statut}
    </span>
  )
}

export function PrioriteBadge({ p }: { p: Mission['priorite'] }) {
  const styles: Record<string, { bg: string; color: string }> = {
    urgente:   { bg: 'var(--sd-red-soft,#FDECEA)',    color: 'var(--sd-red,#C0392B)' },
    normale:   { bg: 'rgba(13,27,46,0.07)',            color: 'var(--sd-navy,#0D1B2E)' },
    planifiee: { bg: 'var(--sd-cream-dark,#EDE8DF)',  color: 'var(--sd-ink-3,#8A9BB0)' },
  }
  const s = styles[p] || styles.normale
  return (
    <span style={{ fontSize: 10, fontWeight: 600, padding: '3px 8px', borderRadius: 5, background: s.bg, color: s.color, letterSpacing: '0.3px', whiteSpace: 'nowrap' }}>
      {p.charAt(0).toUpperCase() + p.slice(1)}
    </span>
  )
}
