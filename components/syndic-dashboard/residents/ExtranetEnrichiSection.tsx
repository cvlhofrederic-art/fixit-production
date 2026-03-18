'use client'

import React, { useState, useEffect, useMemo } from 'react'

// ─── Types ─────────────────────────────────────────────────────────────────────

type CoproConnexion = {
  id: string
  nom: string
  email: string
  lot: string
  derniereConnexion: string
  solde: number
  appelsFonds: AppelFonds[]
  historiquePaiements: Paiement[]
  chargesDeductibles: number
}

type AppelFonds = {
  id: string
  trimestre: string
  montant: number
  paye: boolean
  dateLimite: string
  dateReglement?: string
}

type Paiement = {
  id: string
  date: string
  montant: number
  libelle: string
  type: 'charge' | 'appel_fonds' | 'regularisation' | 'travaux'
}

type DocumentObligatoire = {
  id: string
  categorie: string
  label: string
  obligatoire: boolean
  fichier?: string
  dateMiseEnLigne?: string
  dateExpiration?: string
  statut: 'en_ligne' | 'manquant' | 'expire'
  taille?: string
}

type Demande = {
  id: string
  coproId: string
  coproNom: string
  type: 'travaux' | 'reclamation' | 'question_comptable' | 'demande_documents'
  objet: string
  description: string
  statut: 'soumise' | 'en_traitement' | 'repondue' | 'cloturee'
  dateSoumission: string
  dateReponse?: string
  reponse?: string
  tempsTraitement?: number
}

type Communication = {
  id: string
  type: 'broadcast' | 'individuel'
  destinataire?: string
  objet: string
  contenu: string
  dateEnvoi: string
  template?: string
  luPar: string[]
  totalDestinataires: number
}

// ─── Constantes ────────────────────────────────────────────────────────────────

const STATUT_DEMANDE_COLORS: Record<string, string> = {
  soumise: '#E8731A',
  en_traitement: '#2563EB',
  repondue: '#16A34A',
  cloturee: '#6B7280',
}

const STATUT_DEMANDE_LABELS: Record<string, string> = {
  soumise: 'Soumise',
  en_traitement: 'En traitement',
  repondue: 'Repondue',
  cloturee: 'Cloturee',
}

const TYPE_DEMANDE_LABELS: Record<string, string> = {
  travaux: 'Demande de travaux',
  reclamation: 'Reclamation',
  question_comptable: 'Question comptable',
  demande_documents: 'Demande de documents',
}

const TEMPLATES_COMMUNICATION = [
  { id: 'convocation', label: 'Convocation AG', contenu: 'Madame, Monsieur,\n\nNous avons le plaisir de vous convoquer a l\'Assemblee Generale Ordinaire de la copropriete qui se tiendra le [DATE] a [HEURE] au [LIEU].\n\nL\'ordre du jour est joint a la presente convocation.\n\nCordialement,\nLe Syndic' },
  { id: 'rappel_charges', label: 'Rappel charges impayees', contenu: 'Madame, Monsieur,\n\nNous vous informons que votre compte presente un solde debiteur de [MONTANT] EUR au titre des charges de copropriete.\n\nNous vous remercions de bien vouloir regulariser cette situation dans les meilleurs delais.\n\nCordialement,\nLe Syndic' },
  { id: 'avis_travaux', label: 'Avis de travaux', contenu: 'Madame, Monsieur,\n\nNous vous informons que des travaux de [TYPE] debuteront le [DATE_DEBUT] pour une duree estimee de [DUREE].\n\nNous vous remercions de votre comprehension.\n\nCordialement,\nLe Syndic' },
  { id: 'info_generale', label: 'Information generale', contenu: '' },
]

const CATEGORIES_DOCUMENTS = [
  { categorie: 'reglement', label: 'Reglement de copropriete + etat descriptif de division', obligatoire: true },
  { categorie: 'pv_ag_1', label: 'PV de la derniere AG', obligatoire: true },
  { categorie: 'pv_ag_2', label: 'PV de l\'avant-derniere AG', obligatoire: true },
  { categorie: 'pv_ag_3', label: 'PV de la 3e derniere AG', obligatoire: true },
  { categorie: 'fiche_synthetique', label: 'Fiche synthetique de la copropriete (art. 8-2 loi 1965)', obligatoire: true },
  { categorie: 'carnet_entretien', label: 'Carnet d\'entretien de l\'immeuble', obligatoire: true },
  { categorie: 'contrat_syndic', label: 'Contrat du syndic en cours', obligatoire: true },
  { categorie: 'contrat_assurance', label: 'Contrat d\'assurance immeuble', obligatoire: true },
  { categorie: 'contrat_maintenance', label: 'Contrats de maintenance (ascenseur, chauffage...)', obligatoire: true },
  { categorie: 'budget_previsionnel', label: 'Budget previsionnel de l\'exercice en cours', obligatoire: true },
  { categorie: 'comptes_approuves', label: 'Comptes approuves du dernier exercice', obligatoire: true },
  { categorie: 'attestation_assurance', label: 'Attestation d\'assurance en cours de validite', obligatoire: true },
  { categorie: 'dtg', label: 'Diagnostic Technique Global (DTG) si existant', obligatoire: false },
  { categorie: 'pppt', label: 'Plan Pluriannuel de Travaux (PPPT) si existant', obligatoire: false },
  { categorie: 'dpe_collectif', label: 'DPE collectif si existant', obligatoire: false },
]

const formatDate = (s: string) => {
  try { return new Date(s).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' }) }
  catch { return s }
}

const formatDateShort = (s: string) => {
  try { return new Date(s).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' }) }
  catch { return s }
}

const formatPrice = (n: number) => new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(n)

const joursDepuis = (dateStr: string) => {
  const diff = Date.now() - new Date(dateStr).getTime()
  return Math.floor(diff / 86400000)
}

// ─── Demo Data ─────────────────────────────────────────────────────────────────

function generateDemoData() {
  const copros: CoproConnexion[] = [
    {
      id: 'cp1', nom: 'Martin Dupont', email: 'martin.dupont@email.fr', lot: 'Lot 12 - T3', derniereConnexion: '2026-03-12T14:30:00',
      solde: 0, chargesDeductibles: 4280,
      appelsFonds: [
        { id: 'af1', trimestre: 'T1 2026', montant: 1250, paye: true, dateLimite: '2026-01-15', dateReglement: '2026-01-12' },
        { id: 'af2', trimestre: 'T2 2026', montant: 1250, paye: false, dateLimite: '2026-04-15' },
      ],
      historiquePaiements: [
        { id: 'p1', date: '2026-01-12', montant: 1250, libelle: 'Appel fonds T1 2026', type: 'appel_fonds' },
        { id: 'p2', date: '2025-10-08', montant: 1250, libelle: 'Appel fonds T4 2025', type: 'appel_fonds' },
        { id: 'p3', date: '2025-07-15', montant: 1250, libelle: 'Appel fonds T3 2025', type: 'appel_fonds' },
        { id: 'p4', date: '2025-06-01', montant: 3500, libelle: 'Travaux ravalement facade', type: 'travaux' },
      ],
    },
    {
      id: 'cp2', nom: 'Sophie Laurent', email: 'sophie.laurent@email.fr', lot: 'Lot 5 - T2', derniereConnexion: '2026-03-10T09:15:00',
      solde: -1250, chargesDeductibles: 3120,
      appelsFonds: [
        { id: 'af3', trimestre: 'T1 2026', montant: 980, paye: false, dateLimite: '2026-01-15' },
        { id: 'af4', trimestre: 'T2 2026', montant: 980, paye: false, dateLimite: '2026-04-15' },
      ],
      historiquePaiements: [
        { id: 'p5', date: '2025-10-03', montant: 980, libelle: 'Appel fonds T4 2025', type: 'appel_fonds' },
        { id: 'p6', date: '2025-07-10', montant: 980, libelle: 'Appel fonds T3 2025', type: 'appel_fonds' },
      ],
    },
    {
      id: 'cp3', nom: 'Jean-Pierre Bernard', email: 'jpbernard@email.fr', lot: 'Lot 1 - Local commercial', derniereConnexion: '2026-02-28T16:45:00',
      solde: 0, chargesDeductibles: 6850,
      appelsFonds: [
        { id: 'af5', trimestre: 'T1 2026', montant: 2100, paye: true, dateLimite: '2026-01-15', dateReglement: '2026-01-14' },
        { id: 'af6', trimestre: 'T2 2026', montant: 2100, paye: false, dateLimite: '2026-04-15' },
      ],
      historiquePaiements: [
        { id: 'p7', date: '2026-01-14', montant: 2100, libelle: 'Appel fonds T1 2026', type: 'appel_fonds' },
        { id: 'p8', date: '2025-12-01', montant: 850, libelle: 'Regularisation charges 2025', type: 'regularisation' },
      ],
    },
    {
      id: 'cp4', nom: 'Marie Lefevre', email: 'marie.lefevre@email.fr', lot: 'Lot 8 - T4', derniereConnexion: '2026-03-11T11:20:00',
      solde: 0, chargesDeductibles: 5200,
      appelsFonds: [
        { id: 'af7', trimestre: 'T1 2026', montant: 1580, paye: true, dateLimite: '2026-01-15', dateReglement: '2026-01-10' },
        { id: 'af8', trimestre: 'T2 2026', montant: 1580, paye: false, dateLimite: '2026-04-15' },
      ],
      historiquePaiements: [
        { id: 'p9', date: '2026-01-10', montant: 1580, libelle: 'Appel fonds T1 2026', type: 'appel_fonds' },
      ],
    },
    {
      id: 'cp5', nom: 'Ahmed Benali', email: 'ahmed.benali@email.fr', lot: 'Lot 15 - T2', derniereConnexion: '2026-01-20T08:00:00',
      solde: -980, chargesDeductibles: 2900,
      appelsFonds: [
        { id: 'af9', trimestre: 'T1 2026', montant: 850, paye: false, dateLimite: '2026-01-15' },
        { id: 'af10', trimestre: 'T2 2026', montant: 850, paye: false, dateLimite: '2026-04-15' },
      ],
      historiquePaiements: [
        { id: 'p10', date: '2025-10-12', montant: 850, libelle: 'Appel fonds T4 2025', type: 'appel_fonds' },
      ],
    },
    {
      id: 'cp6', nom: 'Christine Moreau', email: 'christine.moreau@email.fr', lot: 'Lot 3 - T3', derniereConnexion: '2026-03-13T07:30:00',
      solde: 0, chargesDeductibles: 4100,
      appelsFonds: [
        { id: 'af11', trimestre: 'T1 2026', montant: 1180, paye: true, dateLimite: '2026-01-15', dateReglement: '2026-01-08' },
        { id: 'af12', trimestre: 'T2 2026', montant: 1180, paye: false, dateLimite: '2026-04-15' },
      ],
      historiquePaiements: [
        { id: 'p11', date: '2026-01-08', montant: 1180, libelle: 'Appel fonds T1 2026', type: 'appel_fonds' },
        { id: 'p12', date: '2025-10-05', montant: 1180, libelle: 'Appel fonds T4 2025', type: 'appel_fonds' },
      ],
    },
  ]

  const documents: DocumentObligatoire[] = CATEGORIES_DOCUMENTS.map((cat, i) => ({
    id: `doc_${i}`,
    categorie: cat.categorie,
    label: cat.label,
    obligatoire: cat.obligatoire,
    fichier: i < 8 ? `${cat.categorie}.pdf` : undefined,
    dateMiseEnLigne: i < 8 ? '2025-12-15' : undefined,
    dateExpiration: cat.categorie === 'attestation_assurance' ? '2026-06-30' : undefined,
    statut: (i < 8 ? 'en_ligne' : 'manquant') as 'en_ligne' | 'manquant' | 'expire',
    taille: i < 8 ? `${(Math.random() * 3 + 0.5).toFixed(1)} Mo` : undefined,
  }))

  const demandes: Demande[] = [
    { id: 'd1', coproId: 'cp1', coproNom: 'Martin Dupont', type: 'travaux', objet: 'Fuite robinet cuisine lot 12', description: 'Fuite persistante au robinet de cuisine malgre remplacement joint. Necessaire intervention plombier.', statut: 'en_traitement', dateSoumission: '2026-03-10T09:00:00', tempsTraitement: 3 },
    { id: 'd2', coproId: 'cp2', coproNom: 'Sophie Laurent', type: 'question_comptable', objet: 'Detail charges T4 2025', description: 'Pourriez-vous me fournir le detail des charges du T4 2025 ? Je ne comprends pas la ligne regularisation chauffage.', statut: 'repondue', dateSoumission: '2026-03-05T14:30:00', dateReponse: '2026-03-06T10:15:00', reponse: 'Bonjour Mme Laurent, la regularisation chauffage correspond a l\'ecart entre la provision et la consommation reelle. Vous trouverez le detail en piece jointe.', tempsTraitement: 1 },
    { id: 'd3', coproId: 'cp5', coproNom: 'Ahmed Benali', type: 'demande_documents', objet: 'Attestation d\'assurance immeuble', description: 'J\'ai besoin de l\'attestation d\'assurance de l\'immeuble pour mon dossier de pret.', statut: 'soumise', dateSoumission: '2026-03-12T16:00:00' },
    { id: 'd4', coproId: 'cp4', coproNom: 'Marie Lefevre', type: 'reclamation', objet: 'Bruit ascenseur etage 4', description: 'L\'ascenseur emet un bruit metallique important au niveau du 4e etage depuis 2 semaines. Tres derangeant la nuit.', statut: 'en_traitement', dateSoumission: '2026-03-08T20:00:00', tempsTraitement: 5 },
    { id: 'd5', coproId: 'cp3', coproNom: 'Jean-Pierre Bernard', type: 'travaux', objet: 'Renovation vitrine local commercial', description: 'Demande d\'autorisation pour travaux de renovation de la vitrine du local commercial lot 1.', statut: 'cloturee', dateSoumission: '2026-02-15T11:00:00', dateReponse: '2026-02-20T09:30:00', reponse: 'Autorisation accordee sous reserve du respect du reglement de copropriete (article 12). Merci de transmettre le devis au syndic avant demarrage.', tempsTraitement: 5 },
  ]

  const communications: Communication[] = [
    { id: 'com1', type: 'broadcast', objet: 'Convocation AG Ordinaire 2026', contenu: 'Madame, Monsieur,\n\nNous avons le plaisir de vous convoquer a l\'AG Ordinaire qui se tiendra le 15 avril 2026 a 18h30 en salle des fetes.\n\nL\'ordre du jour est joint.', dateEnvoi: '2026-03-01T09:00:00', template: 'convocation', luPar: ['cp1', 'cp4', 'cp6'], totalDestinataires: 6 },
    { id: 'com2', type: 'individuel', destinataire: 'Sophie Laurent', objet: 'Rappel charges impayees T1 2026', contenu: 'Madame Laurent,\n\nVotre compte presente un solde debiteur de 1 250 EUR. Merci de regulariser.', dateEnvoi: '2026-03-05T10:00:00', luPar: ['cp2'], totalDestinataires: 1 },
    { id: 'com3', type: 'broadcast', objet: 'Travaux cage d\'escalier B - Planning', contenu: 'Chers coproprietaires,\n\nLes travaux de peinture de la cage d\'escalier B debuteront le 20 mars pour 5 jours ouvres.\n\nAcces maintenu par l\'escalier A.', dateEnvoi: '2026-03-08T14:00:00', template: 'avis_travaux', luPar: ['cp1', 'cp2', 'cp3', 'cp4', 'cp6'], totalDestinataires: 6 },
  ]

  return { copros, documents, demandes, communications }
}

// ─── Composant principal ───────────────────────────────────────────────────────

export default function ExtranetEnrichiSection({ user, userRole }: { user: any; userRole: string }) {
  const uid = user?.id || 'demo'
  const STORAGE_KEY = `fixit_extranet_fr_${uid}`

  // ── State ──
  const [activeTab, setActiveTab] = useState<'dashboard' | 'compte' | 'documents' | 'demandes' | 'communications'>('dashboard')

  const [copros, setCopros] = useState<CoproConnexion[]>([])
  const [documents, setDocuments] = useState<DocumentObligatoire[]>([])
  const [demandes, setDemandes] = useState<Demande[]>([])
  const [communications, setCommunications] = useState<Communication[]>([])

  // Sub-state
  const [selectedCopro, setSelectedCopro] = useState<CoproConnexion | null>(null)
  const [selectedDemande, setSelectedDemande] = useState<Demande | null>(null)
  const [reponseText, setReponseText] = useState('')
  const [showNewDemande, setShowNewDemande] = useState(false)
  const [showNewComm, setShowNewComm] = useState(false)
  const [filterStatutDemande, setFilterStatutDemande] = useState<string>('all')
  const [filterTypeDemande, setFilterTypeDemande] = useState<string>('all')
  const [commForm, setCommForm] = useState({ type: 'broadcast' as 'broadcast' | 'individuel', destinataire: '', objet: '', contenu: '', template: '' })

  // ── Load / Save ──
  useEffect(() => {
    try {
      const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null')
      if (stored && stored.copros) {
        setCopros(stored.copros)
        setDocuments(stored.documents)
        setDemandes(stored.demandes)
        setCommunications(stored.communications)
      } else {
        const demo = generateDemoData()
        setCopros(demo.copros)
        setDocuments(demo.documents)
        setDemandes(demo.demandes)
        setCommunications(demo.communications)
        localStorage.setItem(STORAGE_KEY, JSON.stringify(demo))
      }
    } catch {
      const demo = generateDemoData()
      setCopros(demo.copros)
      setDocuments(demo.documents)
      setDemandes(demo.demandes)
      setCommunications(demo.communications)
    }
  }, [])

  const saveAll = (c?: CoproConnexion[], d?: DocumentObligatoire[], dem?: Demande[], com?: Communication[]) => {
    const data = {
      copros: c || copros,
      documents: d || documents,
      demandes: dem || demandes,
      communications: com || communications,
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
  }

  // ── KPIs ──
  const connectes = copros.filter(c => joursDepuis(c.derniereConnexion) <= 30).length
  const docsEnLigne = documents.filter(d => d.statut === 'en_ligne').length
  const docsTotal = documents.filter(d => d.obligatoire).length
  const demandesEnAttente = demandes.filter(d => d.statut === 'soumise' || d.statut === 'en_traitement').length
  const demandesResolues = demandes.filter(d => d.statut === 'repondue' || d.statut === 'cloturee').length
  const tauxSatisfaction = demandes.length > 0 ? Math.round((demandesResolues / demandes.length) * 100) : 0

  // Conformite
  const docsObligatoires = documents.filter(d => d.obligatoire)
  const docsConformes = docsObligatoires.filter(d => d.statut === 'en_ligne').length
  const docsManquants = docsObligatoires.filter(d => d.statut !== 'en_ligne')

  // ── Styles communs ──
  const cardStyle: React.CSSProperties = { background: '#fff', border: '1px solid var(--sd-border, #E4DDD0)', borderRadius: 12, padding: 20 }
  const btnPrimary: React.CSSProperties = { background: 'var(--sd-navy, #0D1B2E)', color: '#fff', border: 'none', borderRadius: 10, padding: '10px 18px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }
  const btnSecondary: React.CSSProperties = { background: 'transparent', color: 'var(--sd-navy, #0D1B2E)', border: '1px solid var(--sd-border, #E4DDD0)', borderRadius: 10, padding: '10px 18px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }
  const inputStyle: React.CSSProperties = { width: '100%', padding: '10px 14px', border: '1px solid var(--sd-border, #E4DDD0)', borderRadius: 8, fontSize: 13, outline: 'none', background: '#fff' }
  const labelStyle: React.CSSProperties = { fontSize: 12, fontWeight: 600, color: 'var(--sd-ink-2, #4A5E78)', marginBottom: 4, display: 'block' }
  const modalOverlay: React.CSSProperties = { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(13,27,46,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }
  const modalBox: React.CSSProperties = { background: '#fff', borderRadius: 16, padding: 28, maxWidth: 600, width: '100%', maxHeight: '85vh', overflowY: 'auto' }

  const TABS = [
    { key: 'dashboard' as const, label: 'Tableau de bord' },
    { key: 'compte' as const, label: 'Compte coproprietaire' },
    { key: 'documents' as const, label: 'Documents obligatoires' },
    { key: 'demandes' as const, label: 'Demandes' },
    { key: 'communications' as const, label: 'Communications' },
  ]

  // ─── Handlers ──────────────────────────────────────────────────────────────────

  const handleUploadDoc = (docId: string) => {
    const updated = documents.map(d =>
      d.id === docId ? { ...d, statut: 'en_ligne' as const, fichier: `${d.categorie}.pdf`, dateMiseEnLigne: new Date().toISOString().split('T')[0], taille: `${(Math.random() * 3 + 0.5).toFixed(1)} Mo` } : d
    )
    setDocuments(updated)
    saveAll(undefined, updated)
  }

  const handleRepondreDemande = (demandeId: string) => {
    if (!reponseText.trim()) return
    const updated = demandes.map(d =>
      d.id === demandeId ? { ...d, statut: 'repondue' as const, reponse: reponseText, dateReponse: new Date().toISOString(), tempsTraitement: joursDepuis(d.dateSoumission) } : d
    )
    setDemandes(updated)
    saveAll(undefined, undefined, updated)
    setReponseText('')
    setSelectedDemande(updated.find(d => d.id === demandeId) || null)
  }

  const handleCloturerDemande = (demandeId: string) => {
    const updated = demandes.map(d =>
      d.id === demandeId ? { ...d, statut: 'cloturee' as const } : d
    )
    setDemandes(updated)
    saveAll(undefined, undefined, updated)
    setSelectedDemande(null)
  }

  const handleSendComm = () => {
    if (!commForm.objet.trim() || !commForm.contenu.trim()) return
    const newComm: Communication = {
      id: `com_${Date.now()}`,
      type: commForm.type,
      destinataire: commForm.type === 'individuel' ? commForm.destinataire : undefined,
      objet: commForm.objet,
      contenu: commForm.contenu,
      dateEnvoi: new Date().toISOString(),
      template: commForm.template || undefined,
      luPar: [],
      totalDestinataires: commForm.type === 'broadcast' ? copros.length : 1,
    }
    const updated = [newComm, ...communications]
    setCommunications(updated)
    saveAll(undefined, undefined, undefined, updated)
    setShowNewComm(false)
    setCommForm({ type: 'broadcast', destinataire: '', objet: '', contenu: '', template: '' })
  }

  // ─── Render ────────────────────────────────────────────────────────────────────

  return (
    <div style={{ padding: '0 4px' }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h2 style={{ fontFamily: "'Playfair Display',serif", fontSize: 26, color: 'var(--sd-navy, #0D1B2E)', margin: 0 }}>
          Extranet Coproprietaires
        </h2>
        <p style={{ fontSize: 13, color: 'var(--sd-ink-3, #8A9BB0)', marginTop: 4 }}>
          Espace reglementaire conforme au decret du 23 mai 2019 — Acces securise pour les coproprietaires
        </p>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 20, borderBottom: '2px solid var(--sd-border, #E4DDD0)', paddingBottom: 12, flexWrap: 'wrap' }}>
        {TABS.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            style={{
              padding: '8px 16px', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer',
              background: activeTab === tab.key ? 'var(--sd-navy, #0D1B2E)' : 'transparent',
              color: activeTab === tab.key ? '#fff' : 'var(--sd-ink-2, #4A5E78)',
              border: activeTab === tab.key ? 'none' : '1px solid var(--sd-border, #E4DDD0)',
              transition: 'all 0.2s',
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ─── Tab 1: Tableau de bord ──────────────────────────────────────────────── */}
      {activeTab === 'dashboard' && (
        <div>
          {/* KPI Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 24 }}>
            {[
              { label: 'Coproprietaires connectes', value: `${connectes}/${copros.length}`, color: 'var(--sd-navy, #0D1B2E)', icon: '👥' },
              { label: 'Documents en ligne', value: `${docsEnLigne}/${docsTotal}`, color: docsEnLigne === docsTotal ? '#16A34A' : '#E8731A', icon: '📄' },
              { label: 'Demandes en attente', value: String(demandesEnAttente), color: demandesEnAttente > 0 ? '#E8731A' : '#16A34A', icon: '📩' },
              { label: 'Taux de satisfaction', value: `${tauxSatisfaction}%`, color: tauxSatisfaction >= 80 ? '#16A34A' : tauxSatisfaction >= 50 ? '#E8731A' : '#DC2626', icon: '⭐' },
            ].map((kpi, i) => (
              <div key={i} style={{ ...cardStyle, textAlign: 'center' }}>
                <div style={{ fontSize: 28, marginBottom: 6 }}>{kpi.icon}</div>
                <div style={{ fontSize: 28, fontWeight: 800, color: kpi.color }}>{kpi.value}</div>
                <div style={{ fontSize: 12, color: 'var(--sd-ink-3, #8A9BB0)', marginTop: 4 }}>{kpi.label}</div>
              </div>
            ))}
          </div>

          {/* Two columns */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
            {/* Dernieres connexions */}
            <div style={cardStyle}>
              <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--sd-navy, #0D1B2E)', marginTop: 0, marginBottom: 14 }}>
                Dernieres connexions
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {[...copros].sort((a, b) => new Date(b.derniereConnexion).getTime() - new Date(a.derniereConnexion).getTime()).map(cp => {
                  const jours = joursDepuis(cp.derniereConnexion)
                  return (
                    <div key={cp.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', background: 'var(--sd-cream, #F7F4EE)', borderRadius: 8 }}>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--sd-navy, #0D1B2E)' }}>{cp.nom}</div>
                        <div style={{ fontSize: 11, color: 'var(--sd-ink-3, #8A9BB0)' }}>{cp.lot}</div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: 12, color: jours <= 7 ? '#16A34A' : jours <= 30 ? '#E8731A' : '#DC2626', fontWeight: 600 }}>
                          {jours === 0 ? "Aujourd'hui" : jours === 1 ? 'Hier' : `Il y a ${jours}j`}
                        </div>
                        <div style={{ fontSize: 10, color: 'var(--sd-ink-3, #8A9BB0)' }}>{formatDateShort(cp.derniereConnexion)}</div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Conformite decret 2019 */}
            <div style={cardStyle}>
              <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--sd-navy, #0D1B2E)', marginTop: 0, marginBottom: 14 }}>
                Conformite decret 2019
              </h3>
              <div style={{ marginBottom: 14, padding: '12px 16px', background: docsConformes === docsObligatoires.length ? '#DCFCE7' : '#FEF3C7', borderRadius: 10 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: docsConformes === docsObligatoires.length ? '#16A34A' : '#D97706' }}>
                  {docsConformes}/{docsObligatoires.length} documents obligatoires en ligne
                </div>
                <div style={{ fontSize: 12, color: 'var(--sd-ink-2, #4A5E78)', marginTop: 2 }}>
                  {docsConformes === docsObligatoires.length
                    ? 'Votre extranet est conforme au decret du 23/05/2019'
                    : `${docsObligatoires.length - docsConformes} document(s) manquant(s)`}
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {docsObligatoires.map(doc => (
                  <div key={doc.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', borderRadius: 6, background: doc.statut === 'en_ligne' ? '#F0FDF4' : '#FEF2F2' }}>
                    <span style={{ fontSize: 14 }}>{doc.statut === 'en_ligne' ? '✅' : '❌'}</span>
                    <span style={{ fontSize: 12, color: doc.statut === 'en_ligne' ? '#16A34A' : '#DC2626', flex: 1 }}>{doc.label}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── Tab 2: Compte coproprietaire ────────────────────────────────────────── */}
      {activeTab === 'compte' && (
        <div>
          {selectedCopro ? (
            <div>
              <button onClick={() => setSelectedCopro(null)} style={{ ...btnSecondary, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 6 }}>
                ← Retour a la liste
              </button>

              {/* Fiche copro */}
              <div style={{ ...cardStyle, marginBottom: 20 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 }}>
                  <div>
                    <h3 style={{ fontSize: 18, fontWeight: 700, color: 'var(--sd-navy, #0D1B2E)', margin: 0 }}>{selectedCopro.nom}</h3>
                    <p style={{ fontSize: 13, color: 'var(--sd-ink-3, #8A9BB0)', margin: '4px 0 0' }}>{selectedCopro.lot} — {selectedCopro.email}</p>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 12, color: 'var(--sd-ink-3, #8A9BB0)' }}>Solde du compte</div>
                    <div style={{ fontSize: 24, fontWeight: 800, color: selectedCopro.solde < 0 ? '#DC2626' : '#16A34A' }}>
                      {formatPrice(selectedCopro.solde)}
                    </div>
                  </div>
                </div>
              </div>

              {/* Sub-sections */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 20 }}>
                {/* Appels de fonds */}
                <div style={cardStyle}>
                  <h4 style={{ fontSize: 14, fontWeight: 700, color: 'var(--sd-navy, #0D1B2E)', marginTop: 0, marginBottom: 12 }}>Appels de fonds</h4>
                  {selectedCopro.appelsFonds.map(af => (
                    <div key={af.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', marginBottom: 8, background: 'var(--sd-cream, #F7F4EE)', borderRadius: 8 }}>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: 13 }}>{af.trimestre}</div>
                        <div style={{ fontSize: 11, color: 'var(--sd-ink-3, #8A9BB0)' }}>Echance : {formatDateShort(af.dateLimite)}</div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontWeight: 700, fontSize: 14 }}>{formatPrice(af.montant)}</div>
                        <span style={{
                          fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 5,
                          background: af.paye ? '#DCFCE7' : '#FEF2F2',
                          color: af.paye ? '#16A34A' : '#DC2626',
                        }}>
                          {af.paye ? `Paye le ${formatDateShort(af.dateReglement!)}` : 'Impaye'}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Charges deductibles */}
                <div style={cardStyle}>
                  <h4 style={{ fontSize: 14, fontWeight: 700, color: 'var(--sd-navy, #0D1B2E)', marginTop: 0, marginBottom: 12 }}>Charges deductibles (revenus fonciers)</h4>
                  <div style={{ padding: '16px', background: 'var(--sd-cream, #F7F4EE)', borderRadius: 10, textAlign: 'center', marginBottom: 12 }}>
                    <div style={{ fontSize: 12, color: 'var(--sd-ink-3, #8A9BB0)' }}>Montant deductible annee 2025</div>
                    <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--sd-navy, #0D1B2E)' }}>{formatPrice(selectedCopro.chargesDeductibles)}</div>
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--sd-ink-2, #4A5E78)', lineHeight: 1.5 }}>
                    Ce montant correspond aux charges de copropriete deductibles des revenus fonciers au sens de l'article 31 du CGI.
                    Il inclut les charges de gestion, entretien, assurance et provisions pour travaux.
                  </div>
                </div>
              </div>

              {/* Historique paiements */}
              <div style={{ ...cardStyle, marginBottom: 20 }}>
                <h4 style={{ fontSize: 14, fontWeight: 700, color: 'var(--sd-navy, #0D1B2E)', marginTop: 0, marginBottom: 12 }}>Releve de charges / Historique paiements</h4>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ borderBottom: '2px solid var(--sd-border, #E4DDD0)' }}>
                      <th style={{ textAlign: 'left', padding: '8px 12px', color: 'var(--sd-ink-3, #8A9BB0)', fontWeight: 600, fontSize: 11 }}>Date</th>
                      <th style={{ textAlign: 'left', padding: '8px 12px', color: 'var(--sd-ink-3, #8A9BB0)', fontWeight: 600, fontSize: 11 }}>Libelle</th>
                      <th style={{ textAlign: 'left', padding: '8px 12px', color: 'var(--sd-ink-3, #8A9BB0)', fontWeight: 600, fontSize: 11 }}>Type</th>
                      <th style={{ textAlign: 'right', padding: '8px 12px', color: 'var(--sd-ink-3, #8A9BB0)', fontWeight: 600, fontSize: 11 }}>Montant</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedCopro.historiquePaiements.map(p => (
                      <tr key={p.id} style={{ borderBottom: '1px solid var(--sd-border, #E4DDD0)' }}>
                        <td style={{ padding: '10px 12px' }}>{formatDateShort(p.date)}</td>
                        <td style={{ padding: '10px 12px' }}>{p.libelle}</td>
                        <td style={{ padding: '10px 12px' }}>
                          <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 5, background: 'var(--sd-cream, #F7F4EE)', color: 'var(--sd-ink-2, #4A5E78)', fontWeight: 600 }}>
                            {p.type === 'appel_fonds' ? 'Appel de fonds' : p.type === 'regularisation' ? 'Regularisation' : p.type === 'travaux' ? 'Travaux' : 'Charge'}
                          </span>
                        </td>
                        <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 600 }}>{formatPrice(p.montant)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Attestation + Fiche synthese */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
                <div style={cardStyle}>
                  <h4 style={{ fontSize: 14, fontWeight: 700, color: 'var(--sd-navy, #0D1B2E)', marginTop: 0, marginBottom: 8 }}>Attestation de charges pour vente</h4>
                  <p style={{ fontSize: 12, color: 'var(--sd-ink-2, #4A5E78)', lineHeight: 1.5, marginBottom: 12 }}>
                    Decret n 2006-1341 du 9 novembre 2006 — Document obligatoire en cas de vente d'un lot de copropriete. Atteste du montant des charges courantes et des charges hors budget previsionnel.
                  </p>
                  <button style={btnPrimary} onClick={() => alert('Generation attestation de charges pour ' + selectedCopro.nom)}>
                    Generer l'attestation
                  </button>
                </div>
                <div style={cardStyle}>
                  <h4 style={{ fontSize: 14, fontWeight: 700, color: 'var(--sd-navy, #0D1B2E)', marginTop: 0, marginBottom: 8 }}>Fiche de synthese (pre-etat date)</h4>
                  <p style={{ fontSize: 12, color: 'var(--sd-ink-2, #4A5E78)', lineHeight: 1.5, marginBottom: 12 }}>
                    Article L721-2 du Code de la construction et de l'habitation — Fiche synthetique regroupant les donnees financieres et techniques de la copropriete, obligatoire pour toute promesse de vente.
                  </p>
                  <button style={btnPrimary} onClick={() => alert('Generation fiche de synthese pour ' + selectedCopro.nom)}>
                    Generer la fiche
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div>
              <p style={{ fontSize: 13, color: 'var(--sd-ink-2, #4A5E78)', marginBottom: 16 }}>
                Selectionnez un coproprietaire pour visualiser son espace personnel simule (solde, appels de fonds, historique, attestations).
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 14 }}>
                {copros.map(cp => (
                  <div
                    key={cp.id}
                    onClick={() => setSelectedCopro(cp)}
                    style={{ ...cardStyle, cursor: 'pointer', transition: 'border-color 0.2s' }}
                    onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--sd-gold, #C9A84C)')}
                    onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--sd-border, #E4DDD0)')}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--sd-navy, #0D1B2E)' }}>{cp.nom}</div>
                        <div style={{ fontSize: 12, color: 'var(--sd-ink-3, #8A9BB0)', marginTop: 2 }}>{cp.lot}</div>
                        <div style={{ fontSize: 11, color: 'var(--sd-ink-3, #8A9BB0)', marginTop: 2 }}>{cp.email}</div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: 16, fontWeight: 700, color: cp.solde < 0 ? '#DC2626' : '#16A34A' }}>{formatPrice(cp.solde)}</div>
                        <div style={{ fontSize: 10, color: 'var(--sd-ink-3, #8A9BB0)', marginTop: 2 }}>
                          Connexion : {joursDepuis(cp.derniereConnexion) === 0 ? "Aujourd'hui" : `Il y a ${joursDepuis(cp.derniereConnexion)}j`}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ─── Tab 3: Documents obligatoires ───────────────────────────────────────── */}
      {activeTab === 'documents' && (
        <div>
          {/* Summary bar */}
          <div style={{ ...cardStyle, marginBottom: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
            <div>
              <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--sd-navy, #0D1B2E)', margin: 0 }}>
                Documents obligatoires — Decret du 23 mai 2019
              </h3>
              <p style={{ fontSize: 12, color: 'var(--sd-ink-2, #4A5E78)', margin: '4px 0 0' }}>
                L'ensemble des documents devant etre accessibles sur l'extranet des coproprietaires.
              </p>
            </div>
            <div style={{ display: 'flex', gap: 12 }}>
              <div style={{ padding: '8px 16px', background: '#DCFCE7', borderRadius: 8, textAlign: 'center' }}>
                <div style={{ fontSize: 18, fontWeight: 800, color: '#16A34A' }}>{docsConformes}</div>
                <div style={{ fontSize: 10, color: '#16A34A' }}>En ligne</div>
              </div>
              <div style={{ padding: '8px 16px', background: '#FEF2F2', borderRadius: 8, textAlign: 'center' }}>
                <div style={{ fontSize: 18, fontWeight: 800, color: '#DC2626' }}>{docsObligatoires.length - docsConformes}</div>
                <div style={{ fontSize: 10, color: '#DC2626' }}>Manquants</div>
              </div>
            </div>
          </div>

          {/* Documents list */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {documents.map(doc => (
              <div key={doc.id} style={{ ...cardStyle, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, padding: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1, minWidth: 250 }}>
                  <span style={{ fontSize: 20 }}>{doc.statut === 'en_ligne' ? '✅' : doc.statut === 'expire' ? '⚠️' : '❌'}</span>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--sd-navy, #0D1B2E)' }}>{doc.label}</div>
                    <div style={{ fontSize: 11, color: 'var(--sd-ink-3, #8A9BB0)', marginTop: 2 }}>
                      {doc.obligatoire ? 'Obligatoire (decret 2019)' : 'Recommande (si existant)'}
                      {doc.dateMiseEnLigne && ` — Mis en ligne le ${formatDateShort(doc.dateMiseEnLigne)}`}
                      {doc.taille && ` — ${doc.taille}`}
                    </div>
                    {doc.dateExpiration && (
                      <div style={{ fontSize: 11, color: new Date(doc.dateExpiration) < new Date() ? '#DC2626' : '#D97706', marginTop: 2 }}>
                        Expire le {formatDateShort(doc.dateExpiration)}
                      </div>
                    )}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  {doc.statut === 'en_ligne' ? (
                    <>
                      <button style={{ ...btnSecondary, padding: '6px 12px', fontSize: 12 }} onClick={() => alert(`Telechargement de ${doc.fichier}`)}>
                        Telecharger
                      </button>
                      <button
                        style={{ ...btnSecondary, padding: '6px 12px', fontSize: 12 }}
                        onClick={() => handleUploadDoc(doc.id)}
                      >
                        Remplacer
                      </button>
                    </>
                  ) : (
                    <button
                      style={{ ...btnPrimary, padding: '6px 14px', fontSize: 12 }}
                      onClick={() => handleUploadDoc(doc.id)}
                    >
                      Deposer le document
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ─── Tab 4: Demandes ──────────────────────────────────────────────────────── */}
      {activeTab === 'demandes' && (
        <div>
          {selectedDemande ? (
            <div>
              <button onClick={() => setSelectedDemande(null)} style={{ ...btnSecondary, marginBottom: 16 }}>
                ← Retour aux demandes
              </button>

              <div style={cardStyle}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
                  <div>
                    <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--sd-navy, #0D1B2E)', margin: 0 }}>{selectedDemande.objet}</h3>
                    <p style={{ fontSize: 12, color: 'var(--sd-ink-3, #8A9BB0)', margin: '4px 0 0' }}>
                      Par {selectedDemande.coproNom} — {formatDate(selectedDemande.dateSoumission)}
                    </p>
                  </div>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <span style={{ fontSize: 11, fontWeight: 600, padding: '4px 10px', borderRadius: 6, background: `${STATUT_DEMANDE_COLORS[selectedDemande.statut]}20`, color: STATUT_DEMANDE_COLORS[selectedDemande.statut] }}>
                      {STATUT_DEMANDE_LABELS[selectedDemande.statut]}
                    </span>
                    <span style={{ fontSize: 11, fontWeight: 600, padding: '4px 10px', borderRadius: 6, background: 'var(--sd-cream, #F7F4EE)', color: 'var(--sd-ink-2, #4A5E78)' }}>
                      {TYPE_DEMANDE_LABELS[selectedDemande.type]}
                    </span>
                  </div>
                </div>

                <div style={{ padding: 16, background: 'var(--sd-cream, #F7F4EE)', borderRadius: 10, marginBottom: 16 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--sd-ink-3, #8A9BB0)', marginBottom: 6 }}>Description</div>
                  <div style={{ fontSize: 13, color: 'var(--sd-navy, #0D1B2E)', lineHeight: 1.6 }}>{selectedDemande.description}</div>
                </div>

                {selectedDemande.reponse && (
                  <div style={{ padding: 16, background: '#F0FDF4', borderRadius: 10, marginBottom: 16, borderLeft: '3px solid #16A34A' }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: '#16A34A', marginBottom: 6 }}>Reponse du syndic — {selectedDemande.dateReponse && formatDate(selectedDemande.dateReponse)}</div>
                    <div style={{ fontSize: 13, color: 'var(--sd-navy, #0D1B2E)', lineHeight: 1.6 }}>{selectedDemande.reponse}</div>
                  </div>
                )}

                {selectedDemande.tempsTraitement !== undefined && (
                  <div style={{ fontSize: 12, color: 'var(--sd-ink-3, #8A9BB0)', marginBottom: 16 }}>
                    Temps de traitement : {selectedDemande.tempsTraitement} jour(s)
                  </div>
                )}

                {(selectedDemande.statut === 'soumise' || selectedDemande.statut === 'en_traitement') && (
                  <div style={{ borderTop: '1px solid var(--sd-border, #E4DDD0)', paddingTop: 16 }}>
                    <label style={labelStyle}>Reponse</label>
                    <textarea
                      value={reponseText}
                      onChange={e => setReponseText(e.target.value)}
                      style={{ ...inputStyle, minHeight: 100, resize: 'vertical', marginBottom: 12 }}
                      placeholder="Redigez votre reponse..."
                    />
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button style={btnPrimary} onClick={() => handleRepondreDemande(selectedDemande.id)}>
                        Envoyer la reponse
                      </button>
                      {selectedDemande.statut === 'soumise' && (
                        <button style={btnSecondary} onClick={() => {
                          const updated = demandes.map(d => d.id === selectedDemande.id ? { ...d, statut: 'en_traitement' as const } : d)
                          setDemandes(updated)
                          saveAll(undefined, undefined, updated)
                          setSelectedDemande(updated.find(d => d.id === selectedDemande.id)!)
                        }}>
                          Marquer "En traitement"
                        </button>
                      )}
                    </div>
                  </div>
                )}

                {selectedDemande.statut === 'repondue' && (
                  <button style={btnPrimary} onClick={() => handleCloturerDemande(selectedDemande.id)}>
                    Cloturer la demande
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div>
              {/* Filters + stats */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <select
                    value={filterStatutDemande}
                    onChange={e => setFilterStatutDemande(e.target.value)}
                    style={{ ...inputStyle, width: 'auto' }}
                  >
                    <option value="all">Tous les statuts</option>
                    <option value="soumise">Soumise</option>
                    <option value="en_traitement">En traitement</option>
                    <option value="repondue">Repondue</option>
                    <option value="cloturee">Cloturee</option>
                  </select>
                  <select
                    value={filterTypeDemande}
                    onChange={e => setFilterTypeDemande(e.target.value)}
                    style={{ ...inputStyle, width: 'auto' }}
                  >
                    <option value="all">Tous les types</option>
                    <option value="travaux">Travaux</option>
                    <option value="reclamation">Reclamation</option>
                    <option value="question_comptable">Question comptable</option>
                    <option value="demande_documents">Demande de documents</option>
                  </select>
                </div>
                <div style={{ display: 'flex', gap: 12 }}>
                  {(['soumise', 'en_traitement', 'repondue', 'cloturee'] as const).map(s => (
                    <div key={s} style={{ padding: '4px 10px', borderRadius: 6, background: `${STATUT_DEMANDE_COLORS[s]}15`, fontSize: 12, fontWeight: 600, color: STATUT_DEMANDE_COLORS[s] }}>
                      {demandes.filter(d => d.statut === s).length} {STATUT_DEMANDE_LABELS[s].toLowerCase()}
                    </div>
                  ))}
                </div>
              </div>

              {/* Pipeline view */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {demandes
                  .filter(d => filterStatutDemande === 'all' || d.statut === filterStatutDemande)
                  .filter(d => filterTypeDemande === 'all' || d.type === filterTypeDemande)
                  .sort((a, b) => new Date(b.dateSoumission).getTime() - new Date(a.dateSoumission).getTime())
                  .map(d => (
                    <div
                      key={d.id}
                      onClick={() => setSelectedDemande(d)}
                      style={{ ...cardStyle, cursor: 'pointer', padding: 16, transition: 'border-color 0.2s', borderLeft: `3px solid ${STATUT_DEMANDE_COLORS[d.statut]}` }}
                      onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--sd-gold, #C9A84C)')}
                      onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--sd-border, #E4DDD0)')}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 8 }}>
                        <div>
                          <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--sd-navy, #0D1B2E)' }}>{d.objet}</div>
                          <div style={{ fontSize: 12, color: 'var(--sd-ink-3, #8A9BB0)', marginTop: 4 }}>
                            {d.coproNom} — {formatDate(d.dateSoumission)}
                          </div>
                        </div>
                        <div style={{ display: 'flex', gap: 6 }}>
                          <span style={{ fontSize: 11, fontWeight: 600, padding: '3px 8px', borderRadius: 5, background: `${STATUT_DEMANDE_COLORS[d.statut]}20`, color: STATUT_DEMANDE_COLORS[d.statut] }}>
                            {STATUT_DEMANDE_LABELS[d.statut]}
                          </span>
                          <span style={{ fontSize: 11, fontWeight: 600, padding: '3px 8px', borderRadius: 5, background: 'var(--sd-cream, #F7F4EE)', color: 'var(--sd-ink-2, #4A5E78)' }}>
                            {TYPE_DEMANDE_LABELS[d.type]}
                          </span>
                        </div>
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--sd-ink-2, #4A5E78)', marginTop: 8, lineHeight: 1.5 }}>
                        {d.description.length > 150 ? d.description.substring(0, 150) + '...' : d.description}
                      </div>
                      {d.tempsTraitement !== undefined && (
                        <div style={{ fontSize: 11, color: 'var(--sd-ink-3, #8A9BB0)', marginTop: 6 }}>
                          Traitement en {d.tempsTraitement}j
                        </div>
                      )}
                    </div>
                  ))}
                {demandes.filter(d =>
                  (filterStatutDemande === 'all' || d.statut === filterStatutDemande) &&
                  (filterTypeDemande === 'all' || d.type === filterTypeDemande)
                ).length === 0 && (
                  <div style={{ textAlign: 'center', padding: 40, color: 'var(--sd-ink-3, #8A9BB0)' }}>
                    Aucune demande correspondant aux filtres.
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ─── Tab 5: Communications ───────────────────────────────────────────────── */}
      {activeTab === 'communications' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
            <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--sd-navy, #0D1B2E)', margin: 0 }}>
              Communications aux coproprietaires
            </h3>
            <button style={btnPrimary} onClick={() => setShowNewComm(true)}>
              + Nouvelle communication
            </button>
          </div>

          {/* Communications list */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {communications.map(com => {
              const tauxLecture = com.totalDestinataires > 0 ? Math.round((com.luPar.length / com.totalDestinataires) * 100) : 0
              return (
                <div key={com.id} style={{ ...cardStyle, padding: 16 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 8 }}>
                    <div>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 4 }}>
                        <span style={{
                          fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 5,
                          background: com.type === 'broadcast' ? '#EDE9FE' : '#DBEAFE',
                          color: com.type === 'broadcast' ? '#7C3AED' : '#2563EB',
                        }}>
                          {com.type === 'broadcast' ? 'Diffusion generale' : `Individuel — ${com.destinataire}`}
                        </span>
                        {com.template && (
                          <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 4, background: 'var(--sd-cream, #F7F4EE)', color: 'var(--sd-ink-3, #8A9BB0)' }}>
                            {TEMPLATES_COMMUNICATION.find(t => t.id === com.template)?.label || com.template}
                          </span>
                        )}
                      </div>
                      <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--sd-navy, #0D1B2E)' }}>{com.objet}</div>
                      <div style={{ fontSize: 12, color: 'var(--sd-ink-3, #8A9BB0)', marginTop: 2 }}>
                        Envoye le {formatDate(com.dateEnvoi)}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: 12, color: 'var(--sd-ink-2, #4A5E78)', fontWeight: 600 }}>
                        {com.luPar.length}/{com.totalDestinataires} lu(s)
                      </div>
                      <div style={{ marginTop: 4, width: 100, height: 6, background: '#E5E7EB', borderRadius: 3, overflow: 'hidden' }}>
                        <div style={{ width: `${tauxLecture}%`, height: '100%', background: tauxLecture === 100 ? '#16A34A' : 'var(--sd-gold, #C9A84C)', borderRadius: 3, transition: 'width 0.3s' }} />
                      </div>
                      <div style={{ fontSize: 10, color: 'var(--sd-ink-3, #8A9BB0)', marginTop: 2 }}>{tauxLecture}% de lecture</div>
                    </div>
                  </div>
                  <div style={{ fontSize: 13, color: 'var(--sd-ink-2, #4A5E78)', marginTop: 10, lineHeight: 1.5, whiteSpace: 'pre-line' }}>
                    {com.contenu.length > 200 ? com.contenu.substring(0, 200) + '...' : com.contenu}
                  </div>
                </div>
              )
            })}
          </div>

          {/* Templates section */}
          <div style={{ ...cardStyle, marginTop: 20 }}>
            <h4 style={{ fontSize: 14, fontWeight: 700, color: 'var(--sd-navy, #0D1B2E)', marginTop: 0, marginBottom: 12 }}>Modeles de communication</h4>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 10 }}>
              {TEMPLATES_COMMUNICATION.map(tpl => (
                <div
                  key={tpl.id}
                  onClick={() => {
                    setCommForm({ type: 'broadcast', destinataire: '', objet: tpl.label, contenu: tpl.contenu, template: tpl.id })
                    setShowNewComm(true)
                  }}
                  style={{ padding: '12px 16px', background: 'var(--sd-cream, #F7F4EE)', borderRadius: 10, cursor: 'pointer', transition: 'background 0.2s', border: '1px solid transparent' }}
                  onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--sd-gold, #C9A84C)')}
                  onMouseLeave={e => (e.currentTarget.style.borderColor = 'transparent')}
                >
                  <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--sd-navy, #0D1B2E)' }}>{tpl.label}</div>
                  <div style={{ fontSize: 11, color: 'var(--sd-ink-3, #8A9BB0)', marginTop: 4 }}>
                    {tpl.contenu ? 'Modele pre-rempli' : 'Modele vierge'}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* New Communication Modal */}
          {showNewComm && (
            <div style={modalOverlay} onClick={() => setShowNewComm(false)}>
              <div style={modalBox} onClick={e => e.stopPropagation()}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                  <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--sd-navy, #0D1B2E)', margin: 0 }}>Nouvelle communication</h3>
                  <button onClick={() => setShowNewComm(false)} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: 'var(--sd-ink-3, #8A9BB0)' }}>X</button>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <div>
                    <label style={labelStyle}>Type d'envoi</label>
                    <select
                      value={commForm.type}
                      onChange={e => setCommForm({ ...commForm, type: e.target.value as 'broadcast' | 'individuel' })}
                      style={inputStyle}
                    >
                      <option value="broadcast">Diffusion generale (tous les coproprietaires)</option>
                      <option value="individuel">Message individuel</option>
                    </select>
                  </div>

                  {commForm.type === 'individuel' && (
                    <div>
                      <label style={labelStyle}>Destinataire</label>
                      <select
                        value={commForm.destinataire}
                        onChange={e => setCommForm({ ...commForm, destinataire: e.target.value })}
                        style={inputStyle}
                      >
                        <option value="">Selectionnez un coproprietaire</option>
                        {copros.map(cp => (
                          <option key={cp.id} value={cp.nom}>{cp.nom} — {cp.lot}</option>
                        ))}
                      </select>
                    </div>
                  )}

                  <div>
                    <label style={labelStyle}>Objet</label>
                    <input
                      type="text"
                      value={commForm.objet}
                      onChange={e => setCommForm({ ...commForm, objet: e.target.value })}
                      style={inputStyle}
                      placeholder="Objet de la communication"
                    />
                  </div>

                  <div>
                    <label style={labelStyle}>Contenu</label>
                    <textarea
                      value={commForm.contenu}
                      onChange={e => setCommForm({ ...commForm, contenu: e.target.value })}
                      style={{ ...inputStyle, minHeight: 180, resize: 'vertical' }}
                      placeholder="Redigez votre message..."
                    />
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                    <button style={btnSecondary} onClick={() => setShowNewComm(false)}>Annuler</button>
                    <button style={btnPrimary} onClick={handleSendComm}>
                      Envoyer {commForm.type === 'broadcast' ? `a ${copros.length} coproprietaires` : ''}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
