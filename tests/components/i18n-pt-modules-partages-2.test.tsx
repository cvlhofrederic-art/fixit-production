// tests/components/i18n-pt-modules-partages-2.test.tsx
//
// Tableau de bord pro en portugais (/pt/pro/dashboard), rapport i18n de Frédéric du 17/11/2026, vague 2 (lot D) :
// modules PARTAGÉS entre l'artisan (orgRole « artisan ») et la société BTP (« pro_societe ») restés en français ou mal
// traduits : Serviços (MotifsSection et ServiceEtapesEditor), Biblioteca, Materiais, Estimativa de materiais,
// O meu perfil (SettingsSection), Canal Pro et les vues de la Bolsa de oportunidades (components/marches/views/*).
// Règle n° 1, décision du 17/11/2026 : la traduction vaut pour les deux côtés ; le vocabulaire propre aux sociétés de
// construction (« aprovisionamento de obra », « Concursos ») reste au BTP.
// Rendus avec le vrai locales/pt.json (LanguageProvider) ; les vues de la Bolsa reçoivent `isPt` de leur parent.
// Les valeurs enregistrées (unités, corps de métier, rôles, types de message) ne changent pas, ni le texte français
// (dernier bloc).

import React from 'react'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'

vi.mock('@/lib/supabase', () => {
  // Requête chaînable : profiles_artisan.select().eq().single() (zones d'intervention), update().eq().
  const requete: Record<string, unknown> = {}
  requete.select = () => requete
  requete.eq = () => requete
  requete.update = () => requete
  requete.single = async () => ({
    data: { intervention_zones: { regions: ['Norte'], departments: ['13 - Porto'], cities: ['Porto'] } },
    error: null,
  })
  return {
    supabase: {
      auth: {
        getSession: async () => ({ data: { session: { access_token: 'jeton-essai' } } }),
        updateUser: async () => ({ error: null }),
      },
      from: () => requete,
    },
  }
})
vi.mock('next/image', async () => {
  const { createElement } = await import('react')
  return { default: ({ src, alt }: { src?: string; alt?: string }) => createElement('img', { src, alt }) }
})
vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn(), info: vi.fn() } }))

import { toast } from 'sonner'
import { LanguageProvider } from '@/lib/i18n/context'
import type { Artisan, Service } from '@/lib/types'
import type { EstimationResult } from '@/lib/estimation-materiaux'
import { getCleanDescription, getPriceRangeLabel, getPricingUnit } from '@/lib/service-utils'
import MotifsSection from '@/components/dashboard/MotifsSection'
import ServiceEtapesEditor from '@/components/dashboard/ServiceEtapesEditor'
import BibliothequeSection from '@/components/dashboard/BibliothequeSection'
import MateriauxSection from '@/components/dashboard/MateriauxSection'
import EstimationMateriauxSection from '@/components/dashboard/EstimationMateriauxSection'
import SettingsSection from '@/components/dashboard/SettingsSection'
import CanalProSection, { comandoVozPt } from '@/components/dashboard/CanalProSection'
import BrowseTabView from '@/components/marches/views/BrowseTabView'
import DetailModalView from '@/components/marches/views/DetailModalView'
import MyBidsTabView from '@/components/marches/views/MyBidsTabView'
import WonContractsTabView from '@/components/marches/views/WonContractsTabView'
import SettingsTabView from '@/components/marches/views/SettingsTabView'

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

// Mots qui trahissent un texte resté en français dans ces modules (rapport, section D), calques relevés dans le
// glossaire (« motivo », « prestação », « posto », « estaleiro », « Efectivo », « Avença ») et sigles français.
const MOTS_FRANCAIS = [
  'Nouveau', 'Nouvelle', 'Nouvel', 'Aucun', 'Aucune', 'Chargement', 'Ajouter', 'Supprimer', 'Enregistrer', 'Enregistré',
  'Annuler', 'Télécharger', 'votre', 'vos', 'chantier', 'chantiers', 'devis', 'Créer', 'Rechercher', 'Recherche',
  'Fournisseur', 'Fournisseurs', 'BTP', 'RDV', 'plage', 'motivo', 'motivos', 'prestação', 'prestações', 'Modifier',
  'Modificar', 'Prestation', 'Prestations', 'Motif', 'Motifs', 'Étapes', 'étape', 'Matériaux', 'Matériau', 'Appro',
  'Marché', 'Marchés', 'Mercado', 'Mercados', 'Bourse', 'Syndic', 'Budget', 'Postuler', 'Voir', 'Fermer', 'Valider',
  'Paramètres', 'Préférences', 'Erreur', 'Envoyer', 'Envoi', 'Partager', 'Copier', 'Lien', 'Titulaire', 'Espèces',
  'Dinheiro', 'Chèque', 'Virement', 'Aperçu', 'règlement', 'Zones', 'Région', 'Département', 'Ville', 'Réinitialiser',
  'profil', 'Kbis', 'RCS', 'APE', 'NAF', 'TVA', 'HT', 'TTC', 'SIRET', 'CGI', 'Pinel', 'BOAMP', 'Assurance', 'assureur',
  'Décennale', 'médiateur', 'Médiation', 'France', 'métropolitaine', 'Contact', 'Contacts', 'Rôle', 'Artisan',
  'Technicien', 'Gestionnaire', 'Lu', 'Avença', 'posto', 'estaleiro', 'Efectivo', 'efetivo', 'companheiros', 'forfait',
  'Scan', 'Scanner', 'Mairies', 'Plateformes', 'publicador', 'Ouvrage', 'Ouvrages', 'Libellé', 'Brouillon', 'Photo',
  'Logo', 'Importer', 'Changer', 'Mo', 'Stop', 'Vocal', 'Agent', 'Lots', 'travaux', 'pour', 'avec', 'dans', 'sur',
  'les', 'des', 'une', 'aux', 'et', 'est', 'sont', 'ces',
]
// Lettres que le portugais n'emploie pas (è, ë, î, ï, ù, û, ÿ, œ, æ).
const LETTRES_FRANCAISES = /[èëîïùûÿœæ]/iu
// Brésilianismes du glossaire (PT-PT attendu).
const BRESILIANISMES = [
  /(?<![\p{L}])(você|arquivo|usuários?|equipe|registro|contato|salvar|baixar|cadastro|excluir|deletar|tela|celular|síndicos?|dossiê|encanamento|gerencie|gerenciar)(?![\p{L}])/iu,
  /Configurações|Carregando/u,
  /^\s*Meus?(?![\p{L}])/u,
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
function verifierPortugais(contexte: string, racine: HTMLElement = document.body) {
  const textes = textesAffiches(racine)
  expect(textes.length, contexte).toBeGreaterThan(0)
  expect(fautesDePortugais(textes), contexte).toEqual([])
}

/** Côté artisan, aucune formulation réservée à la société BTP. */
function verifierReserveAuBtp(orgRole: Role, motifs: RegExp[], contexte: string) {
  if (orgRole !== 'artisan') return
  const trouvees = textesAffiches().filter(texte => motifs.some(motif => motif.test(texte)))
  expect(trouvees, contexte).toEqual([])
}

const texteDePage = () => (document.body.textContent ?? '').replace(/\s+/g, ' ')
const laisserPasser = (ms = 40) => act(async () => { await new Promise(resoudre => setTimeout(resoudre, ms)) })

async function afficher(element: React.ReactElement, locale: 'pt' | 'fr' = 'pt') {
  const rendu = await act(async () => render(<LanguageProvider initialLocale={locale}>{element}</LanguageProvider>))
  await laisserPasser()
  return rendu
}
const cliquer = async (element: Element) => {
  await act(async () => { fireEvent.click(element) })
  await laisserPasser()
}
const saisir = async (element: Element, valeur: string) => {
  await act(async () => { fireEvent.change(element, { target: { value: valeur } }) })
  await laisserPasser()
}
const bouton = (nom: string | RegExp) => screen.getByRole('button', { name: nom })

// ─── Faux serveur ────────────────────────────────────────────────────────────────────────────────────────────────────

type Reponse = { statut?: number; corps: unknown }
let routes: Array<(url: string, init?: RequestInit) => Reponse | undefined> = []
let appels: Array<{ url: string; init?: RequestInit }> = []

beforeAll(() => {
  // jsdom ne sait pas faire défiler : la messagerie et l'agent matériaux descendent au dernier message.
  Element.prototype.scrollIntoView = vi.fn()
})

beforeEach(() => {
  routes = []
  appels = []
  localStorage.clear()
  vi.mocked(toast.error).mockClear()
  vi.mocked(toast.success).mockClear()
  vi.stubGlobal('fetch', vi.fn(async (entree: RequestInfo | URL, init?: RequestInit) => {
    const url = String(entree)
    appels.push({ url, init })
    const reponse = routes.map(route => route(url, init)).find(Boolean) ?? { corps: {} }
    return new Response(JSON.stringify(reponse.corps), { status: reponse.statut ?? 200, headers: { 'Content-Type': 'application/json' } })
  }))
})
afterEach(() => {
  vi.unstubAllGlobals()
})

// ─── Serviços (MotifsSection, ServiceEtapesEditor) : côté artisan ────────────────────────────────────────────────────

type ProprietesMotifs = React.ComponentProps<typeof MotifsSection>
const SERVICES = [
  { id: 's1', artisan_id: 'art-1', name: 'Reparação de fuga', description: 'Fuga em torneira [unit:m2|min:50|max:100] [scope:mo]', duration_minutes: 90, active: true, validation_auto: false },
  { id: 's2', artisan_id: 'art-1', name: 'Desentupimento', description: '[unit:forfait|min:80|max:80] [scope:mo]', duration_minutes: 60, active: false, validation_auto: true },
  { id: 's3', artisan_id: 'art-1', name: 'Paletes de material', description: '[unit:lot|min:0|max:0] [scope:mo]', active: true },
] as Service[]
const FORMULAIRE: ProprietesMotifs['motifForm'] = {
  name: '', description: '', duration_minutes: '', price_min: '', price_max: '', pricing_unit: 'lot', validation_auto: false,
  delai_minimum_heures: 0, scope: 'mo', cost_ht: '', margin_pct: '',
}

function proprietesMotifs(modifs: Partial<ProprietesMotifs> = {}): ProprietesMotifs {
  return {
    services: SERVICES, showMotifModal: false, setShowMotifModal: vi.fn(), editingMotif: null, motifForm: FORMULAIRE,
    setMotifForm: vi.fn(), savingMotif: false, openNewMotif: vi.fn(), openEditMotif: vi.fn(), saveMotif: vi.fn(),
    toggleMotifActive: vi.fn(), deleteMotif: vi.fn(),
    getPriceRangeLabel: (s: Service) => getPriceRangeLabel(s, 'Sob orçamento'), getPricingUnit, getCleanDescription,
    orgRole: 'artisan', ...modifs,
  }
}

describe('Serviços (MotifsSection, ServiceEtapesEditor)', () => {
  it('artisan : liste et états vides en portugais, « serviço » au lieu de « prestação » / « motivo »', async () => {
    await afficher(<MotifsSection {...proprietesMotifs()} />)
    expect(screen.getByRole('heading', { name: '🛠️ Serviços' })).toBeInTheDocument()
    expect(screen.getByText('Configure os seus serviços, preços e durações')).toBeInTheDocument()
    expect(bouton('+ Novo serviço')).toBeInTheDocument()
    expect(texteDePage()).toContain('Crie um serviço por tipo de trabalho (canalização, eletricidade, pintura…) com preço e duração.')
    for (const titre of ['Serviço', 'Duração', 'Faixa de preços', 'Unidade', 'Validação', 'Estado', 'Ações']) {
      expect(screen.getByRole('columnheader', { name: titre }), titre).toBeInTheDocument()
    }
    // Prix et unités calculés par lib/service-utils : affichés en portugais, rien d'enregistré ne change.
    for (const texte of ['50 a 100 €/m²', '80 €', 'Sob orçamento', '/m²', 'valor global', '/lote', '1h30']) {
      expect(screen.getByText(texte), texte).toBeInTheDocument()
    }
    expect(screen.getAllByRole('button', { name: '✏️ Editar' })).toHaveLength(3)
    verifierPortugais('liste')

    await cliquer(bouton('🧱 Materiais'))
    expect(screen.getByText('Nenhum material referenciado')).toBeInTheDocument()
    expect(bouton('+ Adicionar um material')).toBeInTheDocument()
    verifierPortugais('materiais vides')
    cleanup()

    await afficher(<MotifsSection {...proprietesMotifs({ services: [] })} />)
    expect(screen.getByText('Nenhum serviço configurado')).toBeInTheDocument()
    expect(screen.getByText('Crie o seu primeiro serviço para que os seus clientes possam reservar')).toBeInTheDocument()
    expect(bouton('+ Criar um serviço')).toBeInTheDocument()
    verifierPortugais('liste vide')
  })

  it('artisan : formulaire d’un nouveau serviço (étapes, unités, délais) en portugais', async () => {
    await afficher(<MotifsSection {...proprietesMotifs({ showMotifModal: true })} />)
    expect(screen.getByText('🛠️ Novo serviço')).toBeInTheDocument()
    expect(screen.getByText('ETAPAS')).toBeInTheDocument()
    expect(screen.getByText('Nenhuma etapa. Clique em + Adicionar.')).toBeInTheDocument()
    expect(texteDePage()).toContain('Faixa de preços (€/lote)')
    for (const texte of ['💰 Valor global', '🔢 Por unidade', '📦 Por lote', '1 dia', '2 dias', '3 dias', 'Nenhum']) {
      expect(screen.getByText(texte), texte).toBeInTheDocument()
    }
    expect(bouton('+ Criar o serviço')).toBeInTheDocument()
    expect(bouton('Cancelar')).toBeInTheDocument()
    await cliquer(bouton('+ Adicionar'))
    expect(screen.getByPlaceholderText('Ex.: Diagnóstico visual')).toBeInTheDocument()
    verifierPortugais('formulaire')
  })

  it('artisan : formulaire d’un material, IVA en portugais (art. 53.º du CIVA, sans tiret)', async () => {
    await afficher(<MotifsSection {...proprietesMotifs({ showMotifModal: true, motifForm: { ...FORMULAIRE, scope: 'mat', cost_ht: 10, margin_pct: 50 } })} />)
    expect(screen.getByText('🧱 Novo material')).toBeInTheDocument()
    expect(screen.queryByText('ETAPAS')).toBeNull()
    expect(screen.getByText('Isento ao abrigo do art. 53.º do CIVA (regime especial de isenção)')).toBeInTheDocument()
    expect(screen.getByText('IVA não aplicável, artigo 53.º do CIVA (regime especial de isenção)')).toBeInTheDocument()
    expect(screen.getByText('Custo (€)')).toBeInTheDocument()
    verifierPortugais('material, isento')
    await cliquer(screen.getByRole('checkbox'))
    expect(screen.getByText('Adicionar IVA (23%) ao preço de venda')).toBeInTheDocument()
    expect(screen.getByText('Preço de venda c/ IVA (23%)')).toBeInTheDocument()
    expect(screen.getByText('Custo s/ IVA (€)')).toBeInTheDocument()
    verifierPortugais('material, com IVA')
  })

  it('artisan : modification d’un serviço, étapes enregistrées (ServiceEtapesEditor) en portugais', async () => {
    routes.push(url => url.startsWith('/api/service-etapes') ? { corps: { etapes: [{ id: 'e1', service_id: 's1', ordre: 1, designation: 'Fechar a água', created_at: '' }] } } : undefined)
    await afficher(<MotifsSection {...proprietesMotifs({ showMotifModal: true, editingMotif: SERVICES[0] })} />)
    expect(screen.getByText('✏️ Editar o serviço')).toBeInTheDocument()
    expect(screen.getByText('Etapas predefinidas', { exact: false })).toBeInTheDocument()
    expect(screen.getByText('Estas etapas serão copiadas para cada orçamento que utilize este serviço')).toBeInTheDocument()
    expect(screen.getByText('Fechar a água')).toBeInTheDocument()
    expect(screen.getByTitle('Editar')).toBeInTheDocument()
    expect(screen.getByTitle('Eliminar')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('Ex.: Cortar o abastecimento de água...')).toBeInTheDocument()
    expect(bouton('💾 Editar')).toBeInTheDocument()
    verifierPortugais('modification')
    cleanup()

    await afficher(<ServiceEtapesEditor serviceId={null} />)
    expect(screen.getByText('Guarde o serviço para poder adicionar etapas.')).toBeInTheDocument()
  })
})

// ─── Biblioteca (BibliothequeSection) ────────────────────────────────────────────────────────────────────────────────

// Corps de métier et unités enregistrés en français (valeurs des lignes d'exemple et des options).
const BIBLIOTECA = [
  { id: 1, nom: 'Reboco de fachada', type: 'ouvrage', unite: 'forfait', rev: 40, marge: 50, corps: 'Gros œuvre' },
  { id: 2, nom: 'Cimento 25 kg', type: 'materiau', unite: 'sac', rev: 6.5, marge: 40, corps: 'Sous-traitance' },
]

describe('Biblioteca (BibliothequeSection)', () => {
  it('artisan : bibliothèque en portugais, unités et corps de métier enregistrés affichés en portugais', async () => {
    localStorage.setItem('fixit_bibliotheque_art-1', JSON.stringify(BIBLIOTECA))
    await afficher(<BibliothequeSection artisan={ARTISAN} orgRole="artisan" navigateTo={vi.fn()} />)
    expect(screen.getByRole('heading', { name: 'Biblioteca de trabalhos' })).toBeInTheDocument()
    expect(screen.getByText('Base de dados de preços unitários · 2 artigos')).toBeInTheDocument()
    expect(bouton('+ Novo artigo')).toBeInTheDocument()
    for (const onglet of ['Todos', 'Trabalhos', 'Materiais', 'Mão de obra', 'Todas as especialidades', 'Estrutura', 'Subcontratação']) {
      expect(bouton(onglet), onglet).toBeInTheDocument()
    }
    for (const texte of ['valor global', 'saco', 'Trabalho', 'Material']) expect(screen.getAllByText(texte).length, texte).toBeGreaterThan(0)
    expect(texteDePage()).toContain('2 elemento(s) apresentado(s) · custo total: 46,50 €')
    verifierPortugais('bibliothèque')

    // Le filtre compare toujours la valeur enregistrée (« Gros œuvre »).
    await cliquer(bouton('Estrutura'))
    expect(screen.getByText('Reboco de fachada')).toBeInTheDocument()
    expect(screen.queryByText('Cimento 25 kg')).toBeNull()

    await cliquer(bouton('+ Novo artigo'))
    expect(screen.getByRole('heading', { name: 'Novo artigo' })).toBeInTheDocument()
    for (const texte of ['Designação', 'Especialidade', 'Tipo', 'Unidade', 'Custo s/ IVA (€)', 'Margem (%)', 'Preço de venda s/ IVA']) {
      expect(screen.getAllByText(texte).length, texte).toBeGreaterThan(0)
    }
    expect(screen.getByRole('option', { name: 'valor global' })).toHaveValue('forfait')
    expect(screen.getByRole('option', { name: 'unidade' })).toHaveValue('unité')
    verifierPortugais('formulaire')
  })

  it('les lignes d’exemple par défaut restent les données françaises enregistrées', async () => {
    await afficher(<BibliothequeSection artisan={ARTISAN} orgRole="artisan" navigateTo={vi.fn()} />)
    expect(screen.getByText('Béton de fondation C25/30')).toBeInTheDocument()
    const enregistrees = JSON.parse(localStorage.getItem('fixit_bibliotheque_art-1') ?? '[]') as Array<{ nom: string; corps: string; unite: string }>
    expect(enregistrees[1]).toMatchObject({ nom: 'Béton de fondation C25/30', corps: 'Gros œuvre', unite: 'm³' })
  })
})

// ─── Materiais (MateriauxSection) ────────────────────────────────────────────────────────────────────────────────────

const MATERIAIS = [
  {
    name: 'Termoacumulador 200 L', qty: 1, unit: 'un', category: 'Sanitário', norms: ['NP EN 12897'], normDetails: 'Instalar válvula de segurança.',
    prices: [{ store: 'Leroy Merlin PT', price: 300, url: 'https://lm.exemplo/1' }, { store: 'AKI', price: 320, url: null }],
    bestPrice: { store: 'Leroy Merlin PT', price: 300 }, avgPrice: 310,
  },
  { name: 'Válvula de segurança', qty: 2, unit: 'un', category: 'Sanitário', norms: [], normDetails: '', prices: [], bestPrice: null, avgPrice: 15 },
]
const PRODUTOS = [
  { name: 'Rebarbadora 125 mm 850 W', description: 'Com disco', price: 49.9, store: 'Leroy Merlin PT', url: 'https://lm.exemplo/r', image: null, condition: 'new' },
  { name: 'Rebarbadora 125 mm 1200 W', description: '', price: 79.9, store: 'AKI', url: 'https://aki.exemplo/r', image: null, condition: 'new' },
]

describe('Materiais (MateriauxSection)', () => {
  for (const orgRole of ROLES) {
    const btp = orgRole === 'pro_societe'

    it(`${orgRole} : accueil de l'agent en portugais, vocabulaire de la construction réservé au BTP`, async () => {
      await afficher(<MateriauxSection artisan={ARTISAN} onExportDevis={vi.fn()} orgRole={orgRole} />)
      expect(screen.getByRole('heading', { name: btp ? 'Materiais e aprovisionamento' : 'Materiais & Preços' })).toBeInTheDocument()
      expect(screen.getByText(btp ? 'Stock, encomendas e comparação de fornecedores' : 'Compare os preços dos materiais nas lojas em redor e encontre o melhor preço para a sua obra.')).toBeInTheDocument()
      expect(screen.getByText(btp ? 'Agente de aprovisionamento de obra' : 'Agente de materiais IA')).toBeInTheDocument()
      expect(screen.getByText(btp ? 'Trabalhos de obra frequentes' : 'Intervenções comuns')).toBeInTheDocument()
      expect(bouton(btp ? '🏗️ Betão estrutural' : '🚿 Termoacumulador')).toBeInTheDocument()
      for (const texte of ['🔍 Pesquisa', '📋 Histórico (0)', '💡 Ajuda', '🏗️ Materiais de obra', '🛍️ Pesquisa de produto', '📍 Localização GPS']) {
        expect(bouton(texte), texte).toBeInTheDocument()
      }
      verifierPortugais('accueil')
      verifierReserveAuBtp(orgRole, [/aprovisionamento/i, /Trabalhos de obra frequentes/, /Betão estrutural/], 'accueil')

      await cliquer(bouton('💡 Ajuda'))
      expect(screen.getByText('🏪 Lojas cobertas')).toBeInTheDocument()
      verifierPortugais('ajuda')
    })
  }

  it('artisan : résultats et marge en portugais, sans statut ni taux d’IVA affirmé ; export vers l’orçamento inchangé', async () => {
    routes.push(url => url === '/api/materiaux-ai'
      ? { corps: { materials: MATERIAIS, totalEstimate: { min: 120, max: 340 }, response: 'Lista de materiais para a substituição.' } }
      : undefined)
    const exporter = vi.fn()
    await afficher(<MateriauxSection artisan={ARTISAN} onExportDevis={exporter} orgRole="artisan" />)
    await cliquer(bouton('🚿 Termoacumulador'))

    expect(screen.getByText('Substituição de termoacumulador termodinâmico 200 L')).toBeInTheDocument()
    expect(screen.getByText('Preços não encontrados: verifique manualmente')).toBeInTheDocument()
    expect(screen.getByText('📊 Comparativo por loja')).toBeInTheDocument()
    expect(screen.getByText('💰 Integrar no orçamento', { exact: false })).toBeInTheDocument()
    for (const texte of [
      'Margem insuficiente.', 'Mínimo recomendado: 25%.', 'Custo de compra dos materiais (preço de loja c/ IVA)', 'Custo real s/ IVA do profissional',
      'Margem de revenda 15%', 'Montante s/ IVA a faturar',
      'Taxas em Portugal continental: 23% normal, 13% intermédia, 6% reduzida.',
      'Preços s/ IVA calculados com margem de 15%',
    ]) {
      expect(texteDePage(), texte).toContain(texte)
    }
    // La détection du statut ne connaît que des formes juridiques françaises et 10 % est le taux français de la
    // rénovation : rien de tout cela n'est affirmé en portugais.
    for (const faux of ['Isento de IVA', 'ENI', 'IVA 10%', 'Total c/ IVA', 'sujeita a IVA', 'IVA não aplicável']) {
      expect(texteDePage(), faux).not.toContain(faux)
    }
    expect(bouton('📄 Exportar para orçamento (362 € s/ IVA)')).toBeInTheDocument()
    verifierPortugais('résultats')

    await cliquer(bouton('📄 Exportar para orçamento (362 € s/ IVA)'))
    // Ligne de devis : la même qu'avant (le devis est un sujet à part).
    expect(exporter.mock.calls[0][0][0]).toMatchObject({ description: 'Termoacumulador 200 L — Sanitário (NP EN 12897)', qty: 1, tvaRate: 0 })

    await cliquer(bouton('📋 Histórico (1)'))
    expect(screen.getByText('2 materiais')).toBeInTheDocument()
    expect(screen.getByText('~120 a 340 €')).toBeInTheDocument()
    expect(bouton('📂 Carregar')).toBeInTheDocument()
    verifierPortugais('histórico')
  })

  it('artisan : pesquisa de produto en portugais', async () => {
    routes.push(url => url === '/api/materiaux-ai'
      ? { corps: { products: PRODUTOS, recommendations: 'A primeira oferta tem o melhor preço.', fetchedAt: '2026-11-17T10:00:00Z', response: 'Encontrei 2 ofertas.' } }
      : undefined)
    await afficher(<MateriauxSection artisan={ARTISAN} onExportDevis={vi.fn()} orgRole="artisan" />)
    await cliquer(bouton('🛍️ Pesquisa de produto'))
    expect(screen.getByText('Pesquisas populares')).toBeInTheDocument()
    verifierPortugais('produto, accueil')
    await cliquer(bouton('🔧 Rebarbadora'))
    for (const texte of ['🏆 Melhor preço', '📈 Preço médio', '💸 Mais caro', '2 ofertas', '🏆 Comprar', 'Comprar →', '🔄 Nova pesquisa']) {
      expect(screen.getAllByText(texte).length, texte).toBeGreaterThan(0)
    }
    expect(texteDePage()).toContain('⚠️ Preços verificados em tempo real. Os preços podem variar: verifique o preço final no site do vendedor antes de comprar.')
    verifierPortugais('produto, ofertas')
    await cliquer(bouton(/^♻️ Recondicionado/))
    expect(screen.getByText('Nenhuma oferta recondicionada / outlet encontrada para este produto.')).toBeInTheDocument()
    verifierPortugais('produto, recondicionado')
  })
})

// ─── Estimativa de materiais (EstimationMateriauxSection) ────────────────────────────────────────────────────────────

const RESULTADO = {
  computedAt: '2026-11-17T10:00:00Z',
  // Les règles de cohérence se déclenchent sur des identifiants de recettes françaises (« mur-parpaing-20 ») : on en
  // simule une pour vérifier le message portugais.
  items: [{
    recipeId: 'mur-parpaing-20', recipeName: 'Parede em blocos de betão 20 cm', label: 'Parede da garagem', geometry: { area: 12 },
    baseQuantity: 12, baseUnit: 'm2', dtuReferences: [{ code: 'NP EN 771-3', title: 'Blocos' }], materials: [],
    warnings: ['Aberturas acima de 30% da superfície.'], hypotheses: [],
  }],
  aggregated: [
    {
      id: 'bloco-20', name: 'Bloco de betão 50x20x20', category: 'maconnerie', phase: 'principal', optional: false,
      theoreticalQuantity: 120, quantityWithWaste: 126, unit: 'u',
      wasteBreakdown: { baseWastePercent: 5, baseWasteReason: 'Cortes e quebras', profileBonusPercent: 0, totalPercent: 5 },
      references: ['NP EN 771-3'], contributingItems: ['Parede da garagem'],
    },
    {
      id: 'hidrofugo', name: 'Hidrófugo de massa', category: 'adjuvant', phase: 'finitions', optional: true, condition: 'Se a parede ficar exposta à chuva',
      theoreticalQuantity: 2, quantityWithWaste: 2, unit: 'kg',
      wasteBreakdown: { baseWastePercent: 0, baseWasteReason: 'Sem perdas', profileBonusPercent: 0, totalPercent: 0 },
      packagingRecommendation: { unitsToOrder: 1, packagingLabel: 'balde de 5 kg', totalContent: 5 },
      references: ['LNEC E 464'], contributingItems: ['Parede da garagem'],
    },
  ],
  warnings: ['Valores indicativos.'],
  hypothesesACommuniquer: ['Blocos assentes com argamassa M5.'],
  humanSummary: ['Bloco de betão 50x20x20: 126 u'],
} as unknown as EstimationResult

describe('Estimativa de materiais (EstimationMateriauxSection)', () => {
  it('formulaire, paramétrage d’un trabalho et résultats en portugais', async () => {
    routes.push(url => url === '/api/estimation/compute' ? { corps: RESULTADO } : undefined)
    const alerte = vi.fn()
    vi.stubGlobal('alert', alerte)
    await afficher(<EstimationMateriauxSection artisan={{ id: 'art-1', categories: [] }} />)
    expect(screen.getByRole('heading', { name: 'Estimativa de materiais' })).toBeInTheDocument()
    expect(screen.getByText('Trabalhos da obra')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('Pesquisar um trabalho (laje, parede, azulejo…)')).toBeInTheDocument()
    expect(screen.getByText(/^Todas \(\d+\)$/)).toBeInTheDocument()
    verifierPortugais('formulaire')

    await saisir(screen.getByPlaceholderText('Pesquisar um trabalho (laje, parede, azulejo…)'), 'laje')
    const resultat = screen.getAllByRole('button', { name: /Laje de betão armado em terreno/ })[0]
    expect(resultat).toHaveTextContent('Alvenaria · Laje em terreno natural')
    verifierPortugais('recherche')
    await cliquer(resultat)
    expect(screen.getByPlaceholderText('Ex.: Laje de fundação, Ampliação…')).toBeInTheDocument()
    const surface = screen.getByText('Superfície', { selector: 'label' }).parentElement!.querySelector('input')!
    await saisir(surface, '12')
    expect(document.querySelector('.param-summary')).toHaveTextContent('Superfície: 12 m²')
    verifierPortugais('paramétrage')
    await cliquer(bouton('+ Adicionar à obra'))
    expect(screen.getByTitle('Editar')).toBeInTheDocument()

    await cliquer(bouton('Calcular os materiais'))
    expect(screen.getByText('2 materiais calculados para', { exact: false })).toHaveTextContent('2 materiais calculados para 1 trabalho · 1 opção(ões)')
    for (const texte of ['Trabalho principal', 'Opções condicionais', 'OPÇÃO', 'Trabalhos complementares em falta', 'Avisos de cálculo', 'Avisos gerais',
      'Parede exterior em blocos sem fundação: prever uma sapata corrida em betão armado',
      'Parede em blocos sem reboco exterior: prever o acabamento da fachada',
      'Parede da garagem: Aberturas acima de 30% da superfície.']) {
      expect(screen.getByText(texte), texte).toBeInTheDocument()
    }
    expect(texteDePage()).toContain('+5% · Cortes e quebras')
    verifierPortugais('résultats')

    await cliquer(bouton('🛒 Encomendar'))
    expect(alerte).toHaveBeenCalledWith('Em breve: redirecionamento para Materiais e aprovisionamento')

    await cliquer(bouton('Descrição livre'))
    expect(screen.getByText('Descreva a sua obra')).toBeInTheDocument()
    expect(screen.getByPlaceholderText(/^Ex\.: Preciso de fazer uma laje de betão de 8 m × 5 m com 12 cm/)).toBeInTheDocument()
    verifierPortugais('descrição livre')
  })
})

// ─── O meu perfil (SettingsSection) ──────────────────────────────────────────────────────────────────────────────────

type ProprietesPerfil = React.ComponentProps<typeof SettingsSection>
const FORMULAIRE_PERFIL: ProprietesPerfil['settingsForm'] = {
  company_name: 'Construções Ribeiro, Lda', email: 'geral@ribeiro.pt', phone: '912 000 000', bio: '', auto_block_duration_minutes: 240,
  auto_reply_message: '', zone_radius_km: 30, rcs_number: '', ape_code: '', share_capital: '', tva_intra: '', insurance_name: '',
  insurance_number: '', insurance_coverage: '', insurance_type: '', insurance_expiry: '', mediator_name: '', mediator_url: '',
}
const MODOS_PAGAMENTO = [
  { type: 'virement', iban: 'PT50000201231234567890154', bic: 'CGDIPTPL', titulaire: 'Ana Costa', actif: true },
  { type: 'stripe', lien: 'https://buy.stripe.com/essai', actif: true },
  { type: 'cheque', ordre: 'Construções Ribeiro', actif: true },
  { type: 'especes', actif: true },
  { type: 'autre', description: '', actif: true },
]

function proprietesPerfil(orgRole: Role, modifs: Partial<ProprietesPerfil> = {}): ProprietesPerfil {
  return {
    artisan: ARTISAN, initials: 'CR', orgRole, settingsForm: FORMULAIRE_PERFIL, setSettingsForm: vi.fn(), savingSettings: false,
    saveSettings: vi.fn(), autoAccept: true, toggleAutoAccept: vi.fn(), profilePhotoPreview: '', setProfilePhotoPreview: vi.fn(),
    profilePhotoFile: null, setProfilePhotoFile: vi.fn(), profilePhotoUploading: false, uploadDocument: vi.fn(),
    setProfilePhotoUploading: vi.fn(), uploadMsg: null, setUploadMsg: vi.fn(), ...modifs,
  }
}

describe('O meu perfil (SettingsSection)', () => {
  for (const orgRole of ROLES) {
    const btp = orgRole === 'pro_societe'

    it(`${orgRole} : perfil, pagamento, segurança e zonas em português`, async () => {
      routes.push(url => url === '/api/artisan-payment-info'
        ? { corps: { paiement_modes: MODOS_PAGAMENTO, paiement_mention_devis: true, paiement_mention_facture: true } }
        : undefined)
      routes.push(url => url === '/api/artisan-settings' ? { corps: { ok: true } } : undefined)
      await afficher(<SettingsSection {...proprietesPerfil(orgRole)} />)
      await laisserPasser(60)

      expect(screen.getByRole('heading', { name: 'O meu perfil' })).toBeInTheDocument()
      expect(screen.getByText('Faça a gestão das suas informações pessoais e profissionais.')).toBeInTheDocument()
      for (const texte of ['Foto de perfil', '🖼️ Alterar', 'JPG, PNG, WEBP (máx. 10 MB)', 'Logótipo (orçamentos e faturas)', '📁 Importar',
        'PNG, JPG, WebP (máx. 2 MB)', '💾 Guardar o perfil', '🔗 Partilhar', 'Informações de pagamento', 'Mostrar nos orçamentos',
        'Mostrar nas faturas', 'PRÉ-VISUALIZAÇÃO NO DOCUMENTO', 'MODO DE PAGAMENTO', 'Titular', 'Ligação', 'À ordem de',
        'O cliente pagará diretamente a partir desta ligação', 'Nenhuma informação adicional necessária', '💾 Guardar']) {
        expect(screen.getAllByText(texte).length, texte).toBeGreaterThan(0)
      }
      // Modes de paiement : valeurs inchangées, libellés portugais (« Numerário », pas « Dinheiro »).
      expect(screen.getAllByText('Numerário')).toHaveLength(2)
      for (const texte of ['Transferência bancária: PT50 0002 0123 1234 5678 9015 4 · Ana Costa', 'Pagamento online: https://buy.stripe.com/essai',
        'Cheque à ordem de: Construções Ribeiro', 'Outro modo de pagamento']) {
        expect(screen.getByText(texte), texte).toBeInTheDocument()
      }
      for (const texte of ['PT50 XXXX XXXX XXXX', 'XXXXPTPL', 'Nome do titular', 'PayPal, MB WAY, transferência internacional...']) {
        expect(screen.getByPlaceholderText(texte), texte).toBeInTheDocument()
      }
      expect(texteDePage()).toContain('💡 Partilhe esta ligação com os seus clientes para que possam fazer uma marcação diretamente na sua agenda.')
      expect(screen.getAllByRole('button', { name: 'Mostrar a palavra-passe' })).toHaveLength(2)

      // Informations légales et assurance : société BTP seulement, sans « Kbis » ni loi française.
      if (btp) {
        for (const texte of ['Informações legais (Certidão permanente)', 'Registo comercial', 'Código de atividade (CAE)', 'N.º de IVA intracomunitário',
          'Seguro e resolução de litígios', 'Tipo de seguro', 'Nome da seguradora', 'N.º da apólice', 'Cobertura geográfica',
          'Entidade de resolução de litígios (RAL)', 'Sítio web da entidade RAL']) {
          expect(screen.getByText(texte), texte).toBeInTheDocument()
        }
        expect(screen.getByText(/^Retomados em todos os seus orçamentos e faturas: seguro de responsabilidade civil profissional/)).toBeInTheDocument()
        expect(screen.getByPlaceholderText('Portugal continental')).toBeInTheDocument()
        expect(screen.getByRole('option', { name: 'Garantia decenal' })).toHaveValue('decennale')
        expect(screen.getByRole('option', { name: 'RC profissional + decenal' })).toHaveValue('both')
      } else {
        expect(screen.queryByText('Informações legais (Certidão permanente)')).toBeNull()
      }
      verifierPortugais('perfil')

      // Mot de passe : critères portugais.
      await saisir(screen.getAllByPlaceholderText('••••••••••••')[0], 'abc')
      expect(screen.getByText('Mínimo de 12 caracteres')).toBeInTheDocument()
      verifierPortugais('palavra-passe')

      // Zones d'intervention : onglets, résumé, enregistrement.
      for (const onglet of ['🌍 Região', '📍 Distrito', '🏙️ Localidade']) expect(bouton(onglet), onglet).toBeInTheDocument()
      expect(screen.getByText('Fase de teste: apenas a região Norte (Porto) está disponível')).toBeInTheDocument()
      for (const texte of ['📊 Resumo da cobertura', '1 região selecionada', '1 distrito', '1 localidade']) {
        expect(screen.getByText(texte), texte).toBeInTheDocument()
      }
      await cliquer(bouton('📍 Distrito'))
      expect(screen.getByText('Fase de teste: apenas o distrito do Porto está disponível')).toBeInTheDocument()
      expect(screen.getByPlaceholderText('Adicionar um distrito (ex.: Porto)')).toBeInTheDocument()
      await cliquer(bouton('🏙️ Localidade'))
      expect(screen.getByText('↑↓ navegar · Enter para adicionar')).toBeInTheDocument()
      verifierPortugais('zonas')
      await cliquer(bouton('💾 Guardar as zonas'))
      expect(toast.success).toHaveBeenCalledWith('Zonas de intervenção guardadas')
      expect(bouton('🗑️ Repor')).toBeInTheDocument()
    })
  }

  it('photo trop lourde et échec d’enregistrement des zones : messages en portugais', async () => {
    routes.push(url => url === '/api/artisan-settings' ? { statut: 500, corps: {} } : undefined)
    const message = vi.fn()
    const { container } = await afficher(<SettingsSection {...proprietesPerfil('artisan', { setUploadMsg: message })} />)
    const fichier = new File(['x'], 'foto.jpg', { type: 'image/jpeg' })
    Object.defineProperty(fichier, 'size', { value: 11 * 1024 * 1024 })
    await act(async () => { fireEvent.change(container.querySelectorAll('input[type="file"]')[0], { target: { files: [fichier] } }) })
    expect(message).toHaveBeenCalledWith({ text: 'Foto demasiado pesada (máx. 10 MB)', type: 'error' })
    await cliquer(bouton('💾 Guardar as zonas'))
    expect(toast.error).toHaveBeenCalledWith('Erro ao guardar')
  })
})

// ─── Canal Pro (CanalProSection) ─────────────────────────────────────────────────────────────────────────────────────

describe('Canal Pro (CanalProSection)', () => {
  it('contacts, rôle enregistré en français mais affiché en portugais, messages et actions rapides', async () => {
    // Reconnaissance vocale disponible : les exemples de commandes vocales s'affichent.
    vi.stubGlobal('SpeechRecognition', function ReconnaissanceFactice() {})
    routes.push(url => url.startsWith('/api/pro/channel?') ? {
      corps: {
        messages: [
          { id: 'm1', sender_id: 'usr-2', sender_name: 'Rui Almeida', sender_role: 'artisan', content: 'Estou no bloco A', type: 'voice_location',
            metadata: JSON.stringify({ isLocation: true, batiment: 'A', numero: '6', appartement: '2' }), created_at: '2026-11-17T10:00:00Z' },
          { id: 'm2', sender_id: 'usr-1', sender_name: 'Construções Ribeiro', sender_role: 'pro_societe', content: 'Obrigado', type: 'text',
            created_at: '2026-11-17T10:05:00Z', read_at: '2026-11-17T10:06:00Z' },
        ],
      },
    } : undefined)
    await afficher(<CanalProSection artisan={ARTISAN} orgRole="artisan" />)
    expect(screen.getByText('Comunicação direta gestor ↔ profissional')).toBeInTheDocument()
    for (const texte of ['Contactos', 'Nenhum contacto', 'Selecione um contacto', '🎤 Comandos de voz disponíveis']) {
      expect(screen.getByText(texte), texte).toBeInTheDocument()
    }
    expect(bouton('+ Contacto')).toBeInTheDocument()
    expect(bouton('+ Adicionar um contacto')).toBeInTheDocument()
    verifierPortugais('vide')

    await cliquer(bouton('+ Contacto'))
    expect(screen.getByText('📡 Adicionar um contacto')).toBeInTheDocument()
    for (const texte of ['Nome / Empresa *', 'Função', 'Identificador do utilizador (opcional)']) expect(screen.getByText(texte), texte).toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'Técnico' })).toHaveValue('Technicien')
    expect(screen.getByRole('option', { name: 'Administração de condomínio' })).toHaveValue('Syndic')
    verifierPortugais('ajout d’un contact')
    await saisir(screen.getByPlaceholderText('João Silva Canalizações'), 'Rui Almeida')
    await saisir(screen.getByRole('combobox'), 'Technicien')
    await cliquer(bouton('Adicionar'))

    // La valeur enregistrée reste « Technicien » ; l'écran dit « Técnico ».
    const contacts = JSON.parse(localStorage.getItem('fixit_canal_contacts_art-1') ?? '[]') as Array<{ role: string }>
    expect(contacts[0].role).toBe('Technicien')
    expect(screen.getByText('Técnico')).toBeInTheDocument()
    expect(screen.getByText('Técnico · Canal direto')).toBeInTheDocument()
    for (const texte of ['🏢 Bloco A', '🚪 N.º 6', '🏠 Apart. 2', 'profissional']) expect(screen.getByText(texte), texte).toBeInTheDocument()
    expect(texteDePage()).toContain(' · Lida')
    expect(screen.getByPlaceholderText('Escreva uma mensagem...')).toBeInTheDocument()
    expect(screen.getByTitle('Anexar um ficheiro')).toBeInTheDocument()
    verifierPortugais('conversa')

    await cliquer(bouton('✅ Concluído'))
    const envoi = appels.find(a => a.url === '/api/pro/channel' && a.init?.method === 'POST')!
    expect(JSON.parse(String(envoi.init!.body))).toMatchObject({ content: '✅ Intervenção concluída', type: 'voice_status', metadata: { status: 'completed' } })
  })

  it('commandes vocales dictées en portugais (les exemples affichés) : mêmes types et métadonnées qu’en français', () => {
    expect(comandoVozPt('Bloco B, número 12, Sra. Silva')).toEqual({
      type: 'voice_location',
      metadata: { original: 'Bloco B, número 12, Sra. Silva', batiment: 'B', numero: '12', appartement: undefined, isLocation: true },
      conteudo: '📍 Posição: Bloco B, número 12, Sra. Silva',
    })
    expect(comandoVozPt('Fração 3 do edifício C')?.metadata).toMatchObject({ batiment: 'C', appartement: '3' })
    // Comme en français, sans bâtiment ce n'est pas une position : l'alerte et le montant gardent leur type.
    expect(comandoVozPt('Urgência, fuga no apartamento 2')).toMatchObject({ type: 'voice_alert', metadata: { priority: 'high' } })
    expect(comandoVozPt('Orçamento número 12, 450 euros')).toMatchObject({ type: 'voice_devis' })
    expect(comandoVozPt('Intervenção concluída, fuga reparada')).toMatchObject({ type: 'voice_status', metadata: { status: 'completed' } })
    expect(comandoVozPt('Urgência, inundação no 3.º andar')).toMatchObject({ type: 'voice_alert', metadata: { priority: 'high' } })
    expect(comandoVozPt('Orçamento de 450 euros para substituição de torneira')).toMatchObject({ type: 'voice_devis' })
    expect(comandoVozPt('Bom dia, chego às dez')).toBeNull()
  })
})

// ─── Bolsa de oportunidades : vues (components/marches/views/*) ──────────────────────────────────────────────────────

// Horloge figée pendant ces tests (mardi 17/11/2026, 10 h locale) ; échéances comptées à partir de ce moment.
const AGORA = new Date(2026, 10, 17, 10, 0, 0).getTime()
const daqui = (dias: number) => new Date(AGORA + dias * 86400000).toISOString()
const OPORTUNIDADES = [
  {
    id: 'mk1', title: 'Substituição de canalização', category: 'canalizacao', source_type: 'btp_sous_traitance', location_city: 'Porto',
    budget_min: 1000, budget_max: 2000, deadline: daqui(10), urgency: 'urgent', max_candidatures: 5, candidatures_count: 1,
    preferred_work_mode: 'forfait', require_rc_pro: true, require_decennale: true, artisan_dispo_info: { available_now: true },
  },
  { id: 'mk2', title: 'Pintura de fachada', category: 'pintura', source_type: 'scan_base', location_city: 'Gaia', urgency: 'normal', url_source: 'https://base.gov.pt/essai' },
]
const RESULTADOS_PESQUISA = [{
  sourceId: 'b1', title: 'Empreitada de reabilitação', source: 'base_gov', location: 'Porto', buyer: 'Câmara Municipal do Porto', budgetMin: 50000,
  deadline: '2026-12-01', scoring: { scoreTotal: 82, priority: 'high', matchedMetiers: ['Canalização'] }, sourceUrl: 'https://base.gov.pt/b1',
  aiSummary: 'Obra de reabilitação de canalizações.',
}]
const META_PESQUISA = { scannedAt: '2026-11-17T10:00:00Z', totalScanned: 40, totalFiltered: 3, sources: { ted: 2, base_gov: 1, stored: 1 } }

type ProprietesBolsa = React.ComponentProps<typeof BrowseTabView>
function proprietesBolsa(orgRole: Role, isPt = true, modifs: Partial<ProprietesBolsa> = {}): ProprietesBolsa {
  const artisan = orgRole === 'artisan'
  return {
    isPt, locale: isPt ? 'pt' : 'fr', marches: OPORTUNIDADES, loading: false, scanning: false, scanResults: artisan ? [] : RESULTADOS_PESQUISA,
    scanMeta: artisan ? null : META_PESQUISA, scanError: '', showScanResults: true, alerts: { expiringCount: 1, unreadMessages: 1 },
    prefsLoaded: true, marchesOptIn: false, filterCategory: '', filterRegion: '', filterDepartments: [], filterMarcheType: 'tous',
    hidePublicMarches: artisan, isArtisan: artisan, prefsSaved: false, artisanMetiers: [],
    onFilterCategoryChange: vi.fn(), onFilterRegionChange: vi.fn(), onFilterDepartmentsChange: vi.fn(), onFilterMarcheTypeChange: vi.fn(),
    onScanMarches: vi.fn(), onSaveGeoPrefs: vi.fn(), onSelectMarche: vi.fn(), onGoToSettings: vi.fn(), ...modifs,
  }
}

type ProprietesDetalhe = React.ComponentProps<typeof DetailModalView>
const OPORTUNIDADE_DETALHE = {
  id: 'mk1', title: 'Fuga na coluna montante', category: 'canalizacao', urgency: 'emergency', publisher_type: 'syndic', city: 'Porto',
  deadline: daqui(1), candidatures_count: 1, budget_min: 1000, budget_max: 2000, description: 'Fuga na coluna montante do prédio.',
  photos: ['https://exemplo.pt/f1.jpg'], my_candidature_id: 'c1',
}
function proprietesDetalhe(isSociete: boolean, modifs: Partial<ProprietesDetalhe> = {}): ProprietesDetalhe {
  return {
    isPt: true, locale: 'pt', isSociete, selectedMarche: OPORTUNIDADE_DETALHE, artisan: ARTISAN, messages: [], msgLoading: false,
    msgSending: false, msgInput: '', msgCandidatureId: 'c1', onMsgInputChange: vi.fn(), onMsgCandidatureIdChange: vi.fn(),
    onLoadMessages: vi.fn(), onSendMessage: vi.fn(), onSubmitBid: vi.fn(), bidSubmitting: false, bidError: '', bidSuccess: false,
    showBidForm: false, onShowBidFormChange: vi.fn(), bidPrice: '', bidTimeline: '', bidDescription: '', bidMaterials: false,
    bidGuarantee: '', bidEffectif: '', onBidPriceChange: vi.fn(), onBidTimelineChange: vi.fn(), onBidDescriptionChange: vi.fn(),
    onBidMaterialsChange: vi.fn(), onBidGuaranteeChange: vi.fn(), onBidEffectifChange: vi.fn(), onBidErrorChange: vi.fn(), onClose: vi.fn(),
    ...modifs,
  }
}

describe('Bolsa de oportunidades : vues (onglets, detalhe, candidaturas, definições)', () => {
  beforeEach(() => { vi.useFakeTimers({ toFake: ['Date'], now: AGORA }) })
  afterEach(() => { vi.useRealTimers() })

  for (const orgRole of ROLES) {
    const btp = orgRole === 'pro_societe'

    it(`${orgRole} : onglet des oportunidades en portugais (« Concursos » réservé au BTP)`, async () => {
      render(<BrowseTabView {...proprietesBolsa(orgRole)} />)
      expect(screen.getByText(btp ? 'Concursos em curso' : 'Oportunidades em curso')).toBeInTheDocument()
      for (const texte of ['1 oportunidade expira nos próximos 3 dias', 'Tem 1 mensagem não lida', 'Filtros', 'Tipo', '2 resultados',
        'Ative a Bolsa de oportunidades nas definições para receber oportunidades personalizadas', '💰 Orçamento n.d.']) {
        expect(screen.getByText(texte), texte).toBeInTheDocument()
      }
      expect(screen.getByText('Valor global', { exact: false })).toBeInTheDocument()
      expect(screen.getByTitle('Subempreitada publicada por uma empresa de construção')).toHaveTextContent('🏗️ Subempreit.')
      expect(screen.getByTitle('Concurso público (BASE.gov/TED/...)')).toHaveTextContent('🏛️ Público')
      if (btp) {
        for (const texte of ['Concursos públicos encontrados', '1 resultado', '📋 Sites e câmaras municipais: 1', '📊 Analisados: 40']) {
          expect(screen.getByText(texte, { exact: false }), texte).toBeInTheDocument()
        }
        expect(texteDePage()).toContain('40 analisados → 3 relevantes')
        expect(bouton('📡 Pesquisar concursos')).toBeInTheDocument()
      } else {
        expect(texteDePage()).toContain('Oportunidades disponíveis para o seu estatuto: subempreitadas de grandes empresas de construção')
      }
      verifierPortugais('oportunidades')
      verifierReserveAuBtp(orgRole, [/Concursos? em curso/, /Pesquisar concursos/], 'oportunidades')
    })

    it(`${orgRole} : detalhe, mensagens et proposta en portugais`, async () => {
      render(<DetailModalView {...proprietesDetalhe(btp)} />)
      expect(screen.getByText(btp ? 'Detalhe do concurso' : 'Detalhe da oportunidade')).toBeInTheDocument()
      for (const texte of ['Condomínio', 'Emergência', '1 dia restante', '1 candidatura', 'Nenhuma mensagem ainda. Inicie a conversa!', 'Interessado?']) {
        expect(screen.getByText(texte, { exact: false }), texte).toBeInTheDocument()
      }
      expect(screen.getByAltText('Foto 1')).toBeInTheDocument()
      verifierPortugais('detalhe')
      verifierReserveAuBtp(orgRole, [/Detalhe do concurso/], 'detalhe')
      cleanup()

      render(<DetailModalView {...proprietesDetalhe(btp, { showBidForm: true })} />)
      for (const texte of ['A sua proposta', 'Prazo estimado', 'Materiais incluídos', 'Garantia (opcional)', '1 semana', 'Enviar proposta']) {
        expect(screen.getByText(texte, { exact: false }), texte).toBeInTheDocument()
      }
      for (const texte of ['Ex.: 5000', 'Ex.: 2 anos']) expect(screen.getByPlaceholderText(texte), texte).toBeInTheDocument()
      if (btp) expect(screen.getByText('Colaboradores mobilizáveis (operários)', { exact: false })).toBeInTheDocument()
      verifierPortugais('proposta')
    })
  }

  it('candidaturas, contratos ganhos et definições en portugais', async () => {
    render(<MyBidsTabView isPt locale="pt" myBids={[]} onGoToBrowse={vi.fn()} />)
    expect(screen.getByText('Ainda não se candidatou a nenhuma oportunidade. Explore as oportunidades abertas e envie a sua primeira proposta!')).toBeInTheDocument()
    expect(bouton('Explorar oportunidades →')).toBeInTheDocument()
    verifierPortugais('candidaturas, vide')
    cleanup()

    const candidaturas = [
      { id: 'b1', marche_category: 'canalizacao', status: 'accepted', marche_title: 'Substituição de canalização', marche_city: 'Porto', price: 1500, timeline: '1_week', materials_included: true },
      { id: 'b2', category: 'pintura', status: 'pending', title: '', price: 800, timeline: '' },
    ]
    render(<MyBidsTabView isPt locale="pt" myBids={candidaturas} onGoToBrowse={vi.fn()} />)
    for (const texte of ['As minhas candidaturas', 'Aceite', 'Pendente', 'Oportunidade']) expect(screen.getByText(texte, { exact: false }), texte).toBeInTheDocument()
    // Délai enregistré « 1_week » : libellé portugais à l'écran.
    expect(texteDePage()).toContain('Prazo: 1 semana')
    verifierPortugais('candidaturas')
    cleanup()

    render(<WonContractsTabView isPt locale="pt" wonBids={[]} receivedEval={{}} onGoToBrowse={vi.fn()} onSubmitEvaluation={vi.fn()} onLoadReceivedEvaluation={vi.fn()} />)
    expect(screen.getByText('Continue a candidatar-se às oportunidades. Os seus contratos ganhos aparecerão aqui.')).toBeInTheDocument()
    expect(bouton('Ver oportunidades →')).toBeInTheDocument()
    verifierPortugais('contratos, vide')
    cleanup()

    render(<SettingsTabView isPt marchesPrefs={{ marches_opt_in: false, marches_categories: ['canalizacao'], marches_work_mode: 'journee', marches_tarif_journalier: null, marches_tarif_horaire: null, marches_description: '' }}
      prefsSaving={false} onPrefsChange={vi.fn()} onSave={vi.fn()} />)
    for (const texte of ['Receber novas oportunidades', 'Deixará de receber notificações de novas oportunidades', 'Valor global',
      'Apresentação na Bolsa de oportunidades', 'Tarifa diária (€)', 'Guardar preferências']) {
      expect(screen.getByText(texte), texte).toBeInTheDocument()
    }
    expect(screen.getByPlaceholderText('Ex.: 350')).toBeInTheDocument()
    verifierPortugais('definições')
  })
})

// ─── Français inchangé ───────────────────────────────────────────────────────────────────────────────────────────────

describe('en français, rien ne change', () => {
  it('Serviços, Biblioteca, Materiais, Estimativa : textes français d’origine', async () => {
    await afficher(<MotifsSection {...proprietesMotifs({ showMotifModal: true })} />, 'fr')
    expect(screen.getByRole('heading', { name: '🛠️ Prestations' })).toBeInTheDocument()
    for (const texte of ['50 – 100€/m²', 'forfait', '/lot', 'ÉTAPES', 'Aucune étape. Cliquez + Ajouter.', '1j', '3j']) expect(screen.getByText(texte), texte).toBeInTheDocument()
    expect(bouton('+ Nouvelle prestation')).toBeInTheDocument()
    cleanup()

    localStorage.setItem('fixit_bibliotheque_art-1', JSON.stringify(BIBLIOTECA))
    await afficher(<BibliothequeSection artisan={ARTISAN} orgRole="artisan" navigateTo={vi.fn()} />, 'fr')
    expect(screen.getByRole('heading', { name: 'Bibliothèque d\'ouvrages' })).toBeInTheDocument()
    expect(screen.getByText('Base de données de prix unitaires — 2 postes')).toBeInTheDocument()
    expect(bouton('Gros œuvre')).toBeInTheDocument()
    expect(texteDePage()).toContain('2 élément(s) affiché(s) — coût total : 46,50 €')
    cleanup()

    await afficher(<MateriauxSection artisan={ARTISAN} onExportDevis={vi.fn()} orgRole="artisan" />, 'fr')
    for (const texte of ['Matériaux & Prix', 'Agent Approvisionnement BTP', 'Lots de travaux fréquents']) expect(screen.getByText(texte), texte).toBeInTheDocument()
    expect(bouton('🏗️ Béton structure')).toBeInTheDocument()
    cleanup()
    await afficher(<MateriauxSection artisan={ARTISAN} onExportDevis={vi.fn()} orgRole="pro_societe" />, 'fr')
    expect(screen.getByRole('heading', { name: 'Matériaux & Appro' })).toBeInTheDocument()
    expect(screen.getByText('Stock, commandes, comparatif fournisseurs')).toBeInTheDocument()
    cleanup()

    await afficher(<EstimationMateriauxSection artisan={{ id: 'art-1', categories: [] }} />, 'fr')
    for (const texte of ['Estimation matériaux', 'Ouvrages du chantier']) expect(screen.getByText(texte), texte).toBeInTheDocument()
  })

  it('Materiais : panneau de marge, statut de TVA et export en français inchangés', async () => {
    routes.push(url => url === '/api/materiaux-ai'
      ? { corps: { materials: MATERIAIS, totalEstimate: { min: 120, max: 340 }, response: 'Liste des matériaux.' } }
      : undefined)
    const exporter = vi.fn()
    await afficher(<MateriauxSection artisan={ARTISAN} onExportDevis={exporter} orgRole="artisan" />, 'fr')
    await cliquer(bouton('🏗️ Béton structure'))
    expect(texteDePage()).toMatch(/EI — Franchise TVA/)
    for (const texte of [
      'Coût achat matériaux (prix magasin TTC)', 'Coût réel HT artisan', 'Marge revente 15%', 'Montant HT à facturer', 'Total TTC client',
      'Franchise en base de TVA :', 'Franchise TVA art. 293B CGI · Marge 15% sur coût TTC artisan',
    ]) {
      expect(texteDePage(), texte).toContain(texte)
    }
    await cliquer(bouton('📄 Exporter vers un devis (362 € HT — TVA non applicable)'))
    expect(exporter.mock.calls[0][0][0]).toMatchObject({ description: 'Termoacumulador 200 L — Sanitário (NP EN 12897)', qty: 1, tvaRate: 0 })
  })

  it('O meu perfil, Canal Pro et Bolsa : textes français d’origine', async () => {
    routes.push(url => url === '/api/artisan-payment-info' ? { corps: { paiement_modes: MODOS_PAGAMENTO } } : undefined)
    await afficher(<SettingsSection {...proprietesPerfil('pro_societe')} />, 'fr')
    await laisserPasser(60)
    for (const texte of ['Mon profil', 'Informations légales (Kbis)', 'RCS / RM', 'Mention obligatoire BTP : RC Pro / Décennale (Loi Pinel 2014) + médiateur de la consommation.',
      '📍 Zones d\'intervention', 'Titulaire', 'À l\'ordre de', 'MODE DE RÈGLEMENT', 'Virement : PT50 0002 0123 1234 5678 9015 4 — Ana Costa']) {
      expect(screen.getAllByText(texte).length, texte).toBeGreaterThan(0)
    }
    expect(screen.getAllByText('Espèces')).toHaveLength(2)
    expect(screen.getByPlaceholderText('France métropolitaine')).toBeInTheDocument()
    cleanup()

    await afficher(<CanalProSection artisan={ARTISAN} orgRole="artisan" />, 'fr')
    for (const texte of ['Communication directe gestionnaire ↔ artisan', 'Aucun contact', 'Sélectionnez un contact']) expect(screen.getByText(texte), texte).toBeInTheDocument()
    cleanup()

    render(<BrowseTabView {...proprietesBolsa('pro_societe', false)} />)
    expect(screen.getByText('Appels d\'offres en cours')).toBeInTheDocument()
    expect(texteDePage()).toContain('Dernier scan :')
    expect(bouton('📡 Scan marchés')).toBeInTheDocument()
    cleanup()

    render(<MyBidsTabView isPt={false} locale="fr" myBids={[{ id: 'b1', status: 'pending', title: 'Marché test', price: 800, timeline: '1_week' }]} onGoToBrowse={vi.fn()} />)
    expect(texteDePage()).toContain('Délai : 1_week')
  })
})
