// tests/components/i18n-pt-modules-partages.test.tsx
//
// Tableau de bord pro en portugais (/pt/pro/dashboard), rapport i18n de Frédéric du 17/11/2026 (sections A, B, C) :
// quatre modules partagés entre l'artisan (orgRole « artisan ») et la société BTP (« pro_societe ») s'affichaient en
// français : Relatórios de obra (RapportsSection et ses deux sous-composants), Referências de obra
// (CarnetDeVisiteSection), Marketplace da construção (MarketplaceProBTPSection), Bolsa de oportunidades
// (BourseAuxMarchesSection).
// Règle n° 1, décision du 17/11/2026 : la traduction vaut pour les deux côtés ; le vocabulaire propre aux sociétés de
// construction (« relatório de obra », « diário de obra », « Referências de obra », onglet « Concursos ») reste au BTP.
// Rendus avec le vrai locales/pt.json (LanguageProvider), Bourse aux marchés comprise (useLocale, comme en production).
// Le texte français, lui, ne change pas (dernier bloc).

import React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'

vi.mock('@/lib/supabase', () => {
  const canal = { on: () => canal, subscribe: () => canal, unsubscribe: () => {} }
  const requete = { insert: async () => ({}), upsert: async () => ({}), delete: () => ({ eq: async () => ({}) }) }
  return {
    supabase: {
      auth: { getSession: async () => ({ data: { session: null } }) },
      from: () => requete,
      channel: () => canal,
      removeChannel: () => {},
    },
  }
})
vi.mock('@/lib/realtime-reconnect', () => ({ subscribeWithReconnect: (canal: unknown) => canal }))
// Vues de la Bourse chargées à la demande (components/marches/views/*) : hors de ce lot, seul l'écran principal compte.
vi.mock('next/dynamic', () => ({ default: () => function VueFactice() { return null } }))
vi.mock('next/image', async () => {
  const { createElement } = await import('react')
  return { default: ({ src, alt }: { src?: string; alt?: string }) => createElement('img', { src, alt }) }
})
vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }))
// Le PDF du rapport (lib/rapport-pdf.ts) reste tel quel et n'est pas produit ici.
vi.mock('@/lib/rapport-pdf', () => ({ generateRapportPDF: vi.fn() }))

import { toast } from 'sonner'
import { LanguageProvider } from '@/lib/i18n/context'
import type { Artisan, Booking } from '@/lib/types'
import RapportsSection from '@/components/dashboard/RapportsSection'
import RapportPDFPreview from '@/components/dashboard/rapports/RapportPDFPreview'
import CarnetDeVisiteSection from '@/components/dashboard/CarnetDeVisiteSection'
import MarketplaceProBTPSection from '@/components/dashboard/MarketplaceProBTPSection'
import BourseAuxMarchesSection from '@/components/marches/BourseAuxMarchesSection'

const ROLES = ['pro_societe', 'artisan'] as const
type Role = typeof ROLES[number]

const ARTISAN = {
  id: 'art-1', user_id: 'usr-1', company_name: 'Construções Ribeiro, Lda', slug: 'construcoes-ribeiro', categories: [],
} as unknown as Artisan

// ─── Lecture de ce que l'écran montre ────────────────────────────────────────────────────────────────────────────────

/** Chaque nœud de texte affiché, puis les textes portés par les attributs (placeholder, aria-label, title, alt). */
function textesAffiches(racine: HTMLElement = document.body): string[] {
  const textes: string[] = []
  const marcheur = document.createTreeWalker(racine, NodeFilter.SHOW_TEXT)
  for (let noeud = marcheur.nextNode(); noeud; noeud = marcheur.nextNode()) {
    const texte = noeud.textContent ?? ''
    if (texte.trim()) textes.push(texte)
  }
  for (const element of racine.querySelectorAll('[placeholder], [aria-label], [title], [alt]')) {
    for (const attribut of ['placeholder', 'aria-label', 'title', 'alt']) {
      const valeur = element.getAttribute(attribut)
      if (valeur?.trim()) textes.push(valeur)
    }
  }
  return textes
}

// Mots qui trahissent un texte resté en français (liste du rapport, section D, et vocabulaire des quatre modules).
const MOTS_FRANCAIS = [
  'Nouveau', 'Nouvelle', 'Nouvelles', 'Aucun', 'Aucune', 'Chargement', 'Ajouter', 'Ajoutez', 'Supprimer', 'Enregistrer',
  'Annuler', 'Télécharger', 'votre', 'vos', 'chantier', 'chantiers', 'devis', 'Créer', 'Creer', 'Créez', 'Creez',
  'Rapport', 'Rapports', 'Référence', 'Références', 'annonce', 'annonces', 'Marché', 'Marchés', 'Bourse', 'BTP',
  'Intervention', 'Statut', 'Envoi', 'Envoyé', 'Envoyés', 'Motif', 'Client', 'Fermer', 'Importer', 'Adresse', 'Heure',
  'Travaux', 'Matériaux', 'Materiaux', 'Recommandations', 'Photo', 'Photos', 'Prestataire', 'Établi', 'Etabli',
  'Détails', 'Details', 'Durée', 'Duree', 'Maître', 'ouvrage', 'œuvre', 'Montant', 'HT', 'TTC', 'optionnel',
  'Portfolio', 'réalisations', 'Achat', 'vente', 'équipements', 'Déposer', 'Mercados', 'Gagnés', 'Paramètres',
  'Erreur', 'Préférences', 'Impossible', 'Pelleteuse', 'Marquer', 'Facture', 'Sélectionner', 'Selectionner',
  'Mettre', 'SIRET', 'Lié', 'Liée', 'Lie', 'non', 'Désolé', 'Disponible', 'Rechercher', 'Parcourir', 'Demande',
  'Demandes', 'Session', 'Upload', 'Délai', 'urgent', 'Budget', 'Candidatures', 'opportunités', 'disponibles',
  'Réinitialiser', 'Vues', 'Filtrer', 'Location', 'Vente', 'Marque', 'Modèle', 'Année', 'État', 'Localisation', 'Titre',
  'Catégorie', 'catégories', 'Prix', 'Accepter', 'Refuser', 'Confirmer', 'Activer', 'Pauser', 'jour', 'semaine', 'mois',
  'hier', 'Envoyer', 'Contacter', 'vendeur', 'acheteurs', 'données', 'Statistiques', 'Toutes', 'Neuf', 'Intitulé',
  'Corps', 'métier', 'profil', 'entreprise', 'crédibilité', 'premier', 'première', 'projet', 'Téléphone', 'Telephone',
  'Nom', 'Raison', 'Mission', 'gestionnaire', 'syndic', 'Lier', 'saisir', 'manuellement', 'Terminé', 'cours',
  'reprendre', 'garantie', 'Description', 'problème', 'probleme', 'Constatations', 'Cliquez', 'Prenez', 'depuis',
  'pour', 'avec', 'dans', 'sur', 'les', 'des', 'une', 'aux', 'et', 'est', 'sont', 'cette', 'ces',
]
// Lettres que le portugais n'emploie pas (è, ë, î, ï, ù, û, ÿ, œ, æ).
const LETTRES_FRANCAISES = /[èëîïùûÿœæ]/iu
// Brésilianismes du glossaire (PT-PT attendu).
const BRESILIANISMES = [
  /(?<![\p{L}])(você|arquivo|usuários?|equipe|registro|contato|salvar|baixar|cadastro|excluir|deletar|tela|celular|síndicos?|dossiê)(?![\p{L}])/iu,
  /Configurações|Carregando/u,
  /^\s*Meus?(?![\p{L}])/u, // « Meus anúncios » : en PT-PT « Os meus anúncios »
]

const echapper = (mot: string) => mot.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const contientMot = (texte: string, mot: string) =>
  new RegExp(`(?<![\\p{L}\\p{N}])${echapper(mot)}(?![\\p{L}\\p{N}])`, 'iu').test(texte)

/** Ni français, ni brésilien, ni tiret long (sauf « — » seul : valeur vide), ni espace avant « : ; ! ? ». */
function fautesDePortugais(textes: string[]): string[] {
  const fautes: string[] = []
  for (const texte of textes) {
    for (const mot of MOTS_FRANCAIS) if (contientMot(texte, mot)) fautes.push(`français « ${mot} » dans « ${texte} »`)
    if (LETTRES_FRANCAISES.test(texte)) fautes.push(`lettre française dans « ${texte} »`)
    for (const motif of BRESILIANISMES) if (motif.test(texte)) fautes.push(`brésilien ${motif} dans « ${texte} »`)
    if (/[—–]/.test(texte) && texte.trim() !== '—') fautes.push(`tiret long dans « ${texte} »`)
    if (/\s[:;!?]/.test(texte)) fautes.push(`espace avant la ponctuation dans « ${texte} »`)
  }
  return fautes
}
function verifierPortugais(contexte: string) {
  const textes = textesAffiches()
  expect(textes.length, contexte).toBeGreaterThan(0)
  expect(fautesDePortugais(textes), contexte).toEqual([])
}

/** Côté artisan, aucune formulation réservée au BTP. */
function verifierReserveAuBtp(orgRole: Role, motifs: RegExp[], contexte: string) {
  if (orgRole !== 'artisan') return
  const trouvees = textesAffiches().filter(texte => motifs.some(motif => motif.test(texte)))
  expect(trouvees, contexte).toEqual([])
}

const laisserPasser = (ms = 30) => act(async () => { await new Promise(resoudre => setTimeout(resoudre, ms)) })

async function afficher(element: React.ReactElement, locale: 'pt' | 'fr' = 'pt') {
  await act(async () => { render(<LanguageProvider initialLocale={locale}>{element}</LanguageProvider>) })
  await laisserPasser()
}
const cliquer = async (element: HTMLElement) => {
  await act(async () => { fireEvent.click(element) })
  await laisserPasser()
}
const bouton = (nom: string | RegExp) => screen.getByRole('button', { name: nom })

// ─── Faux serveur ────────────────────────────────────────────────────────────────────────────────────────────────────

type Reponse = { statut?: number; corps: unknown }
let routes: Array<(url: string) => Reponse | undefined> = []
let appels: string[] = []

beforeEach(() => {
  routes = []
  appels = []
  localStorage.clear()
  vi.mocked(toast.error).mockClear()
  vi.stubGlobal('fetch', vi.fn(async (entree: RequestInfo | URL) => {
    const url = String(entree)
    appels.push(url)
    const reponse = routes.map(route => route(url)).find(Boolean) ?? { corps: {} }
    return new Response(JSON.stringify(reponse.corps), { status: reponse.statut ?? 200, headers: { 'Content-Type': 'application/json' } })
  }))
})
afterEach(() => {
  vi.unstubAllGlobals()
  document.cookie = 'locale=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/'
})

// ─── Relatórios ──────────────────────────────────────────────────────────────────────────────────────────────────────

const DOCUMENTS = [
  { id: 'doc-dev-1', docNumber: 'DEV-2026-004', docType: 'devis', clientName: 'Ana Costa', service: 'Canalização', savedAt: '2026-11-09T10:00:00Z' },
  { id: 'doc-fac-1', docNumber: 'FACT-2026-002', docType: 'facture', clientName: 'Ana Costa', service: 'Canalização', savedAt: '2026-11-12T10:00:00Z' },
]
const RAPPORT_ENVOYE = {
  id: 'rap_1', rapportNumber: 'RAP-2026-001', createdAt: '2026-11-10T10:00:00Z', linkedBookingId: null, linkedPhotoIds: ['ph1', 'ph2'],
  refDevisFact: 'DEV-2026-004', artisanName: 'Construções Ribeiro, Lda', artisanAddress: 'Rua do Almada, 10, Porto',
  artisanPhone: '912 000 000', artisanEmail: 'geral@ribeiro.pt', artisanSiret: '509999999', artisanInsurance: '',
  clientName: 'Ana Costa', clientPhone: '913 000 000', clientEmail: 'ana@exemplo.pt', clientAddress: 'Rua de Cedofeita, 20, Porto',
  interventionDate: '2026-11-10', startTime: '09:00', endTime: '11:30', siteAddress: 'Rua de Cedofeita, 20, Porto',
  motif: 'Fuga na cozinha', travaux: ['Substituição da torneira', 'Vedação', 'Ensaio'], materiaux: ['Torneira misturadora'],
  observations: 'Tubagem antiga', recommendations: 'Revisão dentro de um ano', status: 'a_reprendre',
  sentStatus: 'envoye', sentAt: '2026-11-11T10:00:00Z', linkedDevisId: 'doc-dev-1', linkedFactureId: 'doc-fac-1',
}
const RAPPORT_NON_ENVOYE = {
  ...RAPPORT_ENVOYE, id: 'rap_2', rapportNumber: 'RAP-2026-002', clientName: '', clientEmail: '', linkedPhotoIds: [],
  linkedDevisId: null, linkedFactureId: null, refDevisFact: '', status: 'sous_garantie', sentStatus: 'non_envoye', sentAt: undefined,
}
const PHOTO = { id: 'ph1', url: 'https://exemplo.pt/obra.jpg', taken_at: '2026-11-10T10:00:00Z', lat: 41.15, lng: -8.61 }
const MISSION = { id: 'm1', titre: 'Infiltração no 3.º esquerdo', immeuble: 'Edifício Boavista', lot: '12', dateIntervention: '2026-11-20', priorite: 'urgente' }
const RESERVATION = {
  id: 'b1', status: 'confirmed', booking_date: '2026-11-10', booking_time: '09:00:00', services: { name: 'Canalização' },
  address: 'Rua de Cedofeita, 20, Porto', client_name: 'Rui Almeida', client_phone: '914 000 000', notes: '',
} as unknown as Booking

// Formulations réservées à la société BTP.
const RESERVE_RAPPORTS = [/relatórios? de obra/i, /diário de obra/i]

describe('Relatórios (RapportsSection, RapportTableRow, RapportPDFPreview)', () => {
  for (const orgRole of ROLES) {
    const btp = orgRole === 'pro_societe'

    it(`${orgRole} : écran vide en portugais, textes du rapport`, async () => {
      await afficher(<RapportsSection artisan={ARTISAN} bookings={[]} services={[]} orgRole={orgRole} />)
      expect(screen.getByRole('heading', { name: btp ? 'Relatórios de obra' : 'Relatórios de intervenção' })).toBeInTheDocument()
      expect(screen.getByText(btp
        ? 'Relatórios e diário de obra associados às suas intervenções'
        : 'Relatórios associados às suas intervenções')).toBeInTheDocument()
      expect(bouton('+ Novo relatório')).toBeInTheDocument()
      expect(screen.getByText('Sem relatórios')).toBeInTheDocument()
      expect(screen.getByText(btp ? 'Crie o seu primeiro relatório de obra' : 'Crie o seu primeiro relatório de intervenção')).toBeInTheDocument()
      expect(bouton('Criar relatório')).toBeInTheDocument()
      verifierPortugais('écran vide')
      verifierReserveAuBtp(orgRole, RESERVE_RAPPORTS, 'écran vide')
    })

    it(`${orgRole} : liste, courriel au client, suppression et formulaire en portugais`, async () => {
      localStorage.setItem('fixit_rapports_art-1', JSON.stringify([RAPPORT_ENVOYE, RAPPORT_NON_ENVOYE]))
      localStorage.setItem('fixit_documents_art-1', JSON.stringify(DOCUMENTS))
      if (btp) localStorage.setItem('canal_artisan_art-1', JSON.stringify([MISSION]))
      routes.push(url => url.startsWith('/api/artisan-photos') ? { corps: { data: btp ? [PHOTO] : [] } } : undefined)
      const ouvrir = vi.fn()
      const confirmer = vi.fn(() => false)
      vi.stubGlobal('open', ouvrir)
      vi.stubGlobal('confirm', confirmer)
      await afficher(<RapportsSection artisan={ARTISAN} bookings={btp ? [RESERVATION] : []} services={[]} orgRole={orgRole} />)

      // Liste : compteurs, en-têtes, statut enregistré « a_reprendre » affiché en portugais, documents liés.
      expect(screen.getByText('Relatórios (2)')).toBeInTheDocument()
      for (const texte of ['Total de relatórios', 'Enviados', 'Não enviados', 'Ref.', 'Motivo', 'Estado', 'Envio', 'Ações',
        '⚠️ A retomar', '🛡️ Em garantia', 'Enviado', 'Não enviado', 'Cliente não definido', 'Marcar como enviado', '📸 2 fotos',
        '📋 Associado ao orçamento: Orçamento Canalização', '🧾 Associado à fatura: Fatura Canalização']) {
        expect(screen.getAllByText(texte).length, texte).toBeGreaterThan(0)
      }
      expect(screen.getAllByRole('button', { name: 'Descarregar' })).toHaveLength(2)
      verifierPortugais('liste')
      verifierReserveAuBtp(orgRole, RESERVE_RAPPORTS, 'liste')

      // Courriel préparé pour le client : en portugais, « relatório de obra » réservé au BTP.
      await cliquer(bouton('Email'))
      const lien = String(ouvrir.mock.calls[0][0])
      const sujet = decodeURIComponent(lien.split('subject=')[1].split('&body=')[0])
      const corps = decodeURIComponent(lien.split('&body=')[1])
      expect(sujet).toBe('Relatório RAP-2026-001 · Construções Ribeiro, Lda')
      expect(corps).toContain(`Segue em anexo o ${btp ? 'relatório de obra' : 'relatório de intervenção'} RAP-2026-001 de 10/11/2026.`)
      expect(fautesDePortugais([sujet, ...corps.split('\n')])).toEqual([])

      // Suppression : la question posée est en portugais.
      await cliquer(screen.getAllByRole('button', { name: '🗑️' })[0])
      expect(confirmer).toHaveBeenCalledWith('Eliminar este relatório?')

      // Formulaire d'un nouveau rapport, avec ses volets.
      await cliquer(bouton('+ Novo relatório'))
      expect(screen.getByText(btp ? 'Novo relatório de obra' : 'Novo relatório de intervenção')).toBeInTheDocument()
      expect(screen.getByText('Importação rápida: pré-preencher a partir de')).toBeInTheDocument()
      if (btp) expect(screen.getByText('2026-11-10 09:00 · Canalização · Rua de Cedofeita, 20, Porto')).toBeInTheDocument()
      expect(screen.getByText('DEV-2026-004 · Ana Costa · Orçamento')).toBeInTheDocument()
      expect(screen.getByText('FACT-2026-002 · Ana Costa · Fatura')).toBeInTheDocument()
      expect(screen.getByRole('option', { name: 'A retomar' })).toHaveValue('a_reprendre')
      verifierPortugais('formulaire')
      await cliquer(bouton('Missão de condomínio / gestor'))
      if (btp) expect(screen.getByText(/ Infiltração no 3\.º esquerdo · Edifício Boavista · 2026-11-20 \S+ URGENTE$/)).toBeInTheDocument()
      else expect(screen.getByText(/^Nenhuma missão disponível\./)).toBeInTheDocument()
      verifierPortugais('formulaire, missions')
      await cliquer(bouton('📥 Importar da base de clientes'))
      if (btp) expect(bouton(/Rui Almeida/)).toBeInTheDocument()
      else expect(screen.getByText(/^Nenhum cliente na base\./)).toBeInTheDocument()
      verifierPortugais('formulaire, base de clientes')
      expect(screen.getByText('Nenhuma foto associada. Adicione fotos da obra para as incluir no relatório.')).toBeInTheDocument()
      await cliquer(bouton('+ Adicionar fotos'))
      if (btp) {
        expect(screen.getByText('Clique para selecionar / desmarcar:')).toBeInTheDocument()
        expect(screen.getByText('0 foto selecionada')).toBeInTheDocument()
      } else {
        expect(screen.getByText('Nenhuma foto da obra disponível')).toBeInTheDocument()
      }
      verifierPortugais('formulaire, photos')
      verifierReserveAuBtp(orgRole, RESERVE_RAPPORTS, 'formulaire')
      await cliquer(bouton('Cancelar'))

      // Modification d'un rapport enregistré.
      await cliquer(screen.getAllByRole('button', { name: '✍️' })[0])
      expect(screen.getByText('Editar relatório')).toBeInTheDocument()
      expect(bouton('Atualizar')).toBeInTheDocument()
      if (btp) expect(screen.getByAltText('Foto da obra')).toBeInTheDocument()
      verifierPortugais('modification')
    })

    it(`${orgRole} : aperçu du rapport (gabarit de capture) en portugais`, async () => {
      localStorage.setItem('fixit_documents_art-1', JSON.stringify(DOCUMENTS))
      await afficher(<RapportPDFPreview previewRapport={RAPPORT_ENVOYE} availablePhotos={[PHOTO]} artisanId="art-1" orgRole={orgRole} dateFmtLocale="pt-PT" />)
      expect(screen.getByText(btp ? 'RELATÓRIO DE OBRA' : 'RELATÓRIO DE INTERVENÇÃO')).toBeInTheDocument()
      for (const texte of ['Prestador', 'Cliente', 'NIF: 509999999', 'Detalhes da intervenção', 'Hora de início', 'Duração', '2h30',
        'Motivo da intervenção', 'Trabalhos realizados', 'Materiais utilizados', 'Observações', 'Recomendações', 'Fotos da obra (1)',
        'Ref.: DEV-2026-004', '📋 Associado ao orçamento: Orçamento Canalização', '🧾 Associado à fatura: Fatura Canalização']) {
        expect(screen.getByText(texte), texte).toBeInTheDocument()
      }
      expect(screen.getByText(/^Construções Ribeiro, Lda · NIF 509999999 · Documento gerado pelo Vitfix Pro · /)).toBeInTheDocument()
      verifierPortugais('aperçu')
      verifierReserveAuBtp(orgRole, RESERVE_RAPPORTS, 'aperçu')
    })
  }
})

// ─── Referências de obra ─────────────────────────────────────────────────────────────────────────────────────────────

const REALISATIONS = [
  { id: '1', url: 'https://exemplo.pt/moradia.jpg', title: 'Moradia em Gaia', category: 'Gros œuvre / Maçonnerie', uploadedAt: '2025-06-01T10:00:00Z', maitreOuvrage: 'Câmara Municipal de Gaia', montantHT: '850000' },
  { id: '2', url: 'https://exemplo.pt/fachada.jpg', title: 'Reboco da fachada', category: 'Façade / ITE', uploadedAt: '2025-03-01T10:00:00Z' },
]

describe('Referências de obra (CarnetDeVisiteSection)', () => {
  for (const orgRole of ROLES) {
    const btp = orgRole === 'pro_societe'

    it(`${orgRole} : écran vide en portugais, textes du rapport`, async () => {
      await afficher(<CarnetDeVisiteSection artisan={ARTISAN} orgRole={orgRole} />)
      expect(screen.getByRole('heading', { name: btp ? 'Referências de obra' : 'Referências' })).toBeInTheDocument()
      expect(screen.getByText('Portefólio de trabalhos realizados Construções Ribeiro, Lda')).toBeInTheDocument()
      expect(bouton('+ Adicionar projeto')).toBeInTheDocument()
      expect(screen.getByText('Nenhuma obra de referência')).toBeInTheDocument()
      expect(screen.getByText('Adicione as obras realizadas para reforçar a sua credibilidade')).toBeInTheDocument()
      expect(bouton('🏗️ Adicionar a primeira obra')).toBeInTheDocument()
      verifierPortugais('écran vide')
      verifierReserveAuBtp(orgRole, [/Referências de obra/], 'écran vide')
    })

    it(`${orgRole} : galerie, filtre par catégorie enregistrée en français, formulaire`, async () => {
      localStorage.setItem('fixit_portfolio_art-1', JSON.stringify(REALISATIONS))
      const { container } = render(<LanguageProvider initialLocale="pt"><CarnetDeVisiteSection artisan={ARTISAN} orgRole={orgRole} /></LanguageProvider>)
      await laisserPasser()
      expect(screen.getByText('2025 • Estrutura / Alvenaria • 850 000 € s/ IVA')).toBeInTheDocument()
      expect(container.querySelector('.v5-al')).toHaveTextContent('💡 Estas referências são visíveis no seu perfil de empresa e valorizam as suas candidaturas a concursos.')
      verifierPortugais('galerie')

      // L'onglet affiché en portugais filtre toujours sur la catégorie enregistrée (« Façade / ITE »).
      await cliquer(bouton('Fachadas / Capoto'))
      expect(screen.getByText('Reboco da fachada')).toBeInTheDocument()
      expect(screen.queryByText('Moradia em Gaia')).toBeNull()
      await cliquer(bouton('Todas'))
      await cliquer(screen.getByText('Moradia em Gaia'))
      expect(screen.getByText(/^Estrutura \/ Alvenaria · .* · 850 000 € s\/ IVA · Câmara Municipal de Gaia$/)).toBeInTheDocument()
      verifierPortugais('aperçu de la photo')
      await cliquer(screen.getAllByRole('button', { name: '✕' })[0])

      // Formulaire d'ajout : libellés portugais, catégorie enregistrée inchangée (valeur française de l'option).
      const urlObjet = URL as unknown as { createObjectURL?: (objet: Blob) => string }
      const creerUrlOrigine = urlObjet.createObjectURL
      urlObjet.createObjectURL = () => 'blob:http://localhost/apercu'
      try {
        const champFichier = container.querySelector<HTMLInputElement>('input[type="file"]')!
        await act(async () => { fireEvent.change(champFichier, { target: { files: [new File(['x'], 'moradia-gaia.jpg', { type: 'image/jpeg' })] } }) })
      } finally {
        urlObjet.createObjectURL = creerUrlOrigine
      }
      expect(screen.getByText('🏗️ Nova obra de referência')).toBeInTheDocument()
      for (const texte of ['Designação da obra', 'Categoria', 'Dono de obra', 'Valor s/ IVA (€)', 'Especialidade', 'Cancelar', '✅ Adicionar esta obra']) {
        expect(screen.getByText(texte), texte).toBeInTheDocument()
      }
      const categorie = screen.getByRole('combobox') as HTMLSelectElement
      expect(categorie.value).toBe('Gros œuvre / Maçonnerie')
      expect(screen.getByRole('option', { name: 'Fachadas / Capoto' })).toHaveValue('Façade / ITE')
      verifierPortugais('formulaire')
      verifierReserveAuBtp(orgRole, [/Referências de obra/], 'galerie et formulaire')
    })
  }
})

// ─── Marketplace da construção ───────────────────────────────────────────────────────────────────────────────────────

// Horloge figée pendant ces tests (mardi 17/11/2026, 10 h locale) : annonces et demande datées de deux jours avant.
const MAINTENANT_MARKETPLACE = new Date(2026, 10, 17, 10, 0, 0)
const IL_Y_A_DEUX_JOURS = new Date(2026, 10, 15, 10, 0, 0).toISOString()

const ANNONCE = {
  id: 'l1', user_id: 'usr-2', title: 'Martelo demolidor Hilti TE 1000', categorie: 'outillage_pro', type_annonce: 'vente_location',
  prix_vente: 1200, prix_location_jour: 80, localisation: 'Braga', marque: 'Hilti', modele: 'TE 1000', annee: 2022, etat: 'bon',
  photos: [], vues: 12, status: 'active', country: 'PT', accessible_ae: false, created_at: IL_Y_A_DEUX_JOURS, updated_at: IL_Y_A_DEUX_JOURS,
}
const MON_ANNONCE = {
  ...ANNONCE, id: 'l2', user_id: 'usr-1', title: 'Andaime de fachada', categorie: 'echafaudages', type_annonce: 'location',
  prix_vente: undefined, prix_location_jour: 150, localisation: undefined, etat: 'correct', status: 'paused', vues: 3,
}
const DEMANDE = {
  id: 'd1', listing_id: 'l2', type_demande: 'location', date_debut: '2026-11-20', date_fin: '2026-11-25', prix_propose: 120,
  message: 'Preciso do andaime para uma obra em Gaia.', status: 'pending', created_at: IL_Y_A_DEUX_JOURS,
}

describe('Marketplace da construção (MarketplaceProBTPSection)', () => {
  beforeEach(() => { vi.useFakeTimers({ toFake: ['Date'], now: MAINTENANT_MARKETPLACE }) })
  afterEach(() => { vi.useRealTimers() })

  for (const orgRole of ROLES) {
    it(`${orgRole} : sans annonce, textes du rapport et chaque onglet`, async () => {
      routes.push(url => url.startsWith('/api/marketplace-btp') ? { corps: { listings: [] } } : undefined)
      await afficher(<MarketplaceProBTPSection artisan={ARTISAN} orgRole={orgRole} />)
      expect(screen.getByRole('heading', { name: 'Marketplace da construção' })).toBeInTheDocument()
      expect(screen.getByText('Compra e venda de materiais e equipamentos entre profissionais')).toBeInTheDocument()
      expect(bouton('+ Publicar anúncio')).toBeInTheDocument()
      expect(screen.getByText('Nenhum anúncio disponível')).toBeInTheDocument()
      verifierPortugais('explorar, vide')
      await cliquer(bouton(/^Os meus anúncios/))
      expect(screen.getByText('Nenhum anúncio publicado')).toBeInTheDocument()
      verifierPortugais('os meus anúncios, vide')
      await cliquer(bouton(/^Pedidos/))
      expect(screen.getByText('Nenhum pedido recebido')).toBeInTheDocument()
      verifierPortugais('pedidos, vide')
      await cliquer(bouton(/^Estatísticas/))
      expect(screen.getByText('Sem dados')).toBeInTheDocument()
      verifierPortugais('estatísticas, vide')
      await cliquer(bouton('+ Publicar anúncio'))
      expect(screen.getByText('Novo anúncio', { selector: '.v5-st' })).toBeInTheDocument()
      expect(screen.getByPlaceholderText('Ex.: Escavadora 3 t Caterpillar 308')).toBeInTheDocument()
      verifierPortugais('novo anúncio')
    })

    it(`${orgRole} : annonces, demande d'un acheteur, suppression et modification`, async () => {
      routes.push(url => {
        if (/\/api\/marketplace-btp\/[^/?]+\/demande/.test(url)) return { corps: { demandes: [DEMANDE] } }
        if (url.includes('user_id=')) return { corps: { listings: [MON_ANNONCE] } }
        return url.startsWith('/api/marketplace-btp') ? { corps: { listings: [ANNONCE] } } : undefined
      })
      await afficher(<MarketplaceProBTPSection artisan={ARTISAN} orgRole={orgRole} />)
      expect(screen.getByText('BOM ESTADO')).toBeInTheDocument()
      expect(screen.getAllByText('há 2 dias').length).toBeGreaterThan(0)
      verifierPortugais('explorar')

      await cliquer(bouton('Contactar vendedor'))
      for (const texte of ['Tipo de pedido', 'Data de início', 'Data de fim', 'Mensagem']) expect(screen.getByText(texte), texte).toBeInTheDocument()
      expect(screen.getByText('(opcional)')).toBeInTheDocument()
      verifierPortugais('contactar vendedor')
      await cliquer(bouton('Cancelar'))

      await cliquer(bouton(/^Os meus anúncios/))
      expect(screen.getByText('▪ PAUSADO')).toBeInTheDocument()
      await cliquer(bouton('Eliminar este anúncio'))
      expect(screen.getByText('Tem a certeza de que pretende eliminar este anúncio? Esta ação é irreversível.')).toBeInTheDocument()
      verifierPortugais('os meus anúncios, eliminação')
      await cliquer(bouton('Cancelar'))

      await cliquer(bouton(/^Pedidos/))
      expect(screen.getByText('PENDENTE')).toBeInTheDocument()
      expect(screen.getByText(/^Pedido de aluguer ·/)).toBeInTheDocument()
      verifierPortugais('pedidos')

      await cliquer(bouton(/^Estatísticas/))
      for (const texte of ['Total de anúncios', 'Anúncios ativos', 'Total de visualizações', 'Pedidos pendentes']) expect(screen.getByText(texte), texte).toBeInTheDocument()
      verifierPortugais('estatísticas')

      await cliquer(bouton(/^Os meus anúncios/))
      await cliquer(bouton('Editar este anúncio'))
      expect(screen.getByText('Editar anúncio', { selector: '.v5-st' })).toBeInTheDocument()
      await act(async () => { fireEvent.change(screen.getByDisplayValue('Aluguer'), { target: { value: 'vente_location' } }) })
      for (const texte of ['Preço de venda (€)', 'Disponível a partir de', 'Disponível até']) expect(screen.getByText(texte), texte).toBeInTheDocument()
      verifierPortugais('editar anúncio')
    })
  }
})

// ─── Bolsa de oportunidades ──────────────────────────────────────────────────────────────────────────────────────────

describe('Bolsa de oportunidades (BourseAuxMarchesSection)', () => {
  for (const orgRole of ROLES) {
    const btp = orgRole === 'pro_societe'

    it(`${orgRole} : en-tête, compteurs et onglets en portugais`, async () => {
      await act(async () => { render(<LanguageProvider initialLocale="pt"><BourseAuxMarchesSection artisan={ARTISAN} orgRole={orgRole} navigateTo={vi.fn()} /></LanguageProvider>) })
      await laisserPasser()
      expect(screen.getByText('Bolsa de oportunidades')).toBeInTheDocument()
      expect(screen.getByText('0 oportunidades disponíveis')).toBeInTheDocument()
      expect(screen.getByText('Orçamento máx.')).toBeInTheDocument()
      // « Concursos » (marchés publics) : société BTP ; l'artisan ne voit que des marchés privés.
      expect(bouton(btp ? 'Concursos' : 'Oportunidades')).toBeInTheDocument()
      expect(screen.queryByRole('button', { name: btp ? 'Oportunidades' : 'Concursos' })).toBeNull()
      for (const onglet of ['Candidaturas', 'Ganhos', 'Definições']) expect(bouton(onglet), onglet).toBeInTheDocument()
      verifierPortugais('bolsa')
      expect(appels.some(url => url.startsWith('/api/marches?') && url.includes('pays=PT'))).toBe(true)
    })

    it(`${orgRole} : refus du serveur, messages en portugais`, async () => {
      const erreurs = vi.spyOn(console, 'error').mockImplementation(() => {})
      routes.push(url => url.includes('pays=PT') ? { statut: 500, corps: {} } : undefined)
      routes.push(url => url.includes('my_bids=true') ? { statut: 401, corps: {} } : undefined)
      await act(async () => { render(<LanguageProvider initialLocale="pt"><BourseAuxMarchesSection artisan={ARTISAN} orgRole={orgRole} navigateTo={vi.fn()} /></LanguageProvider>) })
      await vi.waitFor(() => expect(toast.error).toHaveBeenCalledWith('Erro ao carregar as oportunidades'))
      if (btp) {
        await vi.waitFor(() => expect(toast.error).toHaveBeenCalledWith('Não foi possível carregar as suas candidaturas', { id: 'marches-mes-candidatures' }))
      }
      expect(erreurs).toHaveBeenCalledWith('Marches fetch failed:', expect.any(Error))
      erreurs.mockRestore()
    })
  }
})

// ─── Français inchangé ───────────────────────────────────────────────────────────────────────────────────────────────

describe('en français, rien ne change', () => {
  for (const orgRole of ROLES) {
    it(`${orgRole} : textes français d'origine des quatre modules`, async () => {
      await afficher(<RapportsSection artisan={ARTISAN} bookings={[]} services={[]} orgRole={orgRole} />, 'fr')
      expect(screen.getByRole('heading', { name: 'Rapports d\'Intervention' })).toBeInTheDocument()
      for (const texte of ['Compte-rendus BTP, liés à vos interventions', 'Aucun rapport', 'Creez votre premier rapport d\'intervention BTP']) {
        expect(screen.getByText(texte), texte).toBeInTheDocument()
      }
      expect(bouton('+ Nouveau rapport')).toBeInTheDocument()
      expect(bouton('Creer un rapport')).toBeInTheDocument()
      await cliquer(bouton('+ Nouveau rapport'))
      for (const texte of ['Nouveau rapport d\'intervention', 'Import rapide : pre-remplir depuis', 'Adresse du chantier (si differente du client)', 'Materiaux utilises']) {
        expect(screen.getByText(texte), texte).toBeInTheDocument()
      }
      cleanup()

      await afficher(<CarnetDeVisiteSection artisan={ARTISAN} orgRole={orgRole} />, 'fr')
      expect(screen.getByRole('heading', { name: 'Références chantiers' })).toBeInTheDocument()
      expect(screen.getByText('Portfolio de réalisations Construções Ribeiro, Lda')).toBeInTheDocument()
      expect(bouton('+ Ajouter un projet')).toBeInTheDocument()
      expect(screen.getByText('Aucun chantier de référence')).toBeInTheDocument()
      cleanup()

      routes.push(url => url.startsWith('/api/marketplace-btp') ? { corps: { listings: [] } } : undefined)
      await afficher(<MarketplaceProBTPSection artisan={ARTISAN} orgRole={orgRole} />, 'fr')
      expect(screen.getByRole('heading', { name: 'Marketplace BTP' })).toBeInTheDocument()
      expect(screen.getByText('Achat/vente de matériaux et équipements entre pros')).toBeInTheDocument()
      expect(bouton('+ Déposer annonce')).toBeInTheDocument()
      expect(screen.getByRole('option', { name: '— Toutes catégories —' })).toBeInTheDocument()
      cleanup()

      await act(async () => { render(<LanguageProvider initialLocale="fr"><BourseAuxMarchesSection artisan={ARTISAN} orgRole={orgRole} navigateTo={vi.fn()} /></LanguageProvider>) })
      await laisserPasser()
      expect(screen.getByText('Bourse aux Marchés')).toBeInTheDocument()
      for (const onglet of ['Marchés', 'Candidatures', 'Gagnés', 'Paramètres']) expect(bouton(onglet), onglet).toBeInTheDocument()
    })
  }
})
