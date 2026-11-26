// tests/components/i18n-pt-modules-btp.test.tsx
//
// Tableau de bord BTP pro en portugais (/pt/pro/dashboard, rapport i18n de Frédéric du 17/11/2026) : les cinq modules
// réservés aux sociétés (orgRole 'pro_societe') affichaient du français, des calques et des sigles français.
//   - Orçamentos de fornecedores (components/dashboard/RFQSection.tsx) : langue tirée du pays de la société, absent du
//     profil en production, donc tout en français même en /pt/ ;
//   - Contas de utilizadores (CompteUtilisateursSection.tsx), Meteorologia (btp/MeteoChantierSection.tsx),
//     Subempreitadas (btp/SousTraitanceDC4Section.tsx), Concursos / Mapas de quantidades (btp/DPGFSection.tsx).
// Ce test monte chaque module en portugais avec le vrai LanguageProvider (donc le vrai locales/pt.json), dans plusieurs
// états (liste, détail, formulaires, modales, fichiers exportés), et vérifie : aucun mot français ni calque connu, aucun
// tiret long hors valeur vide « — », aucune espace avant « : », des textes portugais attendus. Puis le rendu français
// reste celui d'avant. Réseau, Supabase et données simulés ; données fictives.

import React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render } from '@testing-library/react'

const etat = vi.hoisted(() => ({
  tables: {} as Record<string, unknown[]>,
  toasts: [] as string[],
  confirmations: [] as string[],
  fichiers: [] as Array<{ nom: string; blob: Blob }>,
  routeur: (async () => new Response('{}')) as (url: string, init?: RequestInit) => Promise<Response>,
}))

vi.mock('@/lib/hooks/use-btp-data', () => ({
  // Même tableau d'un rendu à l'autre, comme l'état React du vrai hook.
  useBTPData: ({ table }: { table: string }) => ({
    items: etat.tables[table] ?? (etat.tables[table] = []),
    loading: false,
    error: null,
    add: async (objet: Record<string, unknown>) => ({ id: 'nouveau-000001', createdAt: '2026-11-17T10:00:00Z', ...objet }),
    update: async () => true,
  }),
}))
vi.mock('@/lib/supabase', () => {
  const chaine: Record<string, unknown> = {}
  for (const m of ['select', 'update', 'eq', 'neq']) chaine[m] = () => chaine
  chaine.then = (resoudre: (v: unknown) => unknown) => resoudre({ data: [], error: null })
  return {
    supabase: {
      auth: {
        getSession: async () => ({ data: { session: { access_token: 'jeton-essai' } } }),
        getUser: async () => ({ data: { user: { id: 'u1' } } }),
      },
      from: () => chaine,
    },
  }
})
vi.mock('sonner', () => ({
  toast: { success: (m: string) => { etat.toasts.push(m) }, error: (m: string) => { etat.toasts.push(m) } },
}))
// Liste des obras du formulaire de subempreitada : composant partagé hors de ce lot (son texte est encore en français,
// signalé à part) ; retiré ici pour ne juger que les textes du module.
vi.mock('@/components/dashboard/btp/ChantierSelect', () => ({ ChantierSelect: () => null }))

import { LanguageProvider } from '@/lib/i18n/context'
import RFQSection from '@/components/dashboard/RFQSection'
import CompteUtilisateursSection from '@/components/dashboard/CompteUtilisateursSection'
import { MeteoChantierSection } from '@/components/dashboard/btp/MeteoChantierSection'
import { SousTraitanceDC4Section } from '@/components/dashboard/btp/SousTraitanceDC4Section'
import { DPGFSection } from '@/components/dashboard/btp/DPGFSection'

type Langue = 'fr' | 'pt'

// ── Règles du portugais affiché ──
// Mots français, sigles français et calques relevés par le rapport (bornes de mot Unicode : « accès », « Météo »…).
const MOTS_INTERDITS = [
  'Nouveau', 'Nouvelle', 'Aucun', 'Aucune', 'Chargement', 'Ajouter', 'Supprimer', 'Enregistrer', 'Enregistrement',
  'Annuler', 'Télécharger', 'votre', 'vos', 'chantier', 'chantiers', 'Chantier', 'Chantiers', 'devis', 'Devis', 'Créer',
  'Fournisseur', 'Fournisseurs', 'Rapport', 'Sous-traitance', 'sous-traitant', 'DC1', 'DC2', 'DC4', 'DPGF', 'DCE', 'BTP',
  'Météo', 'accès', 'Erreur', 'Statut', 'Fermer', 'Retour', 'Vigilance', 'RAS', 'Terminée', 'Choisir', 'Produit',
  'Offre', 'Offres', 'HT', 'TTC', 'TVA', 'SIRET', 'Kbis', 'URSSAF', 'BPU', 'Module', 'Dirigeant', 'France', 'Pluie',
  'Chaleur', 'Analyse', 'Montant', 'ravalement', 'planning', 'Code du travail', 'Score', 'Checklist',
  // Calques et brésilianismes
  'Dirigente', 'Modificar', 'Condutor de obras', 'Chefe de obra', 'Secretária', 'Secretário', 'Subcontrata',
  'Última conexão', 'estaleiro', 'estaleiros', 'efetivos', 'previsional', 'padrão', 'você', 'arquivo', 'usuário',
  'equipe', 'registro', 'contato', 'salvar', 'baixar', 'excluir', 'deletar', 'dossiê',
].map(mot => new RegExp(`(?<![\\p{L}\\p{N}])${mot}(?![\\p{L}\\p{N}])`, 'u'))

/** Textes visibles : nœuds de texte, attributs placeholder / title / aria-label. */
function textesVisibles(conteneur: HTMLElement): string[] {
  const textes: string[] = []
  const parcours = document.createTreeWalker(conteneur, NodeFilter.SHOW_TEXT)
  for (let n = parcours.nextNode(); n; n = parcours.nextNode()) textes.push(n.textContent ?? '')
  for (const el of conteneur.querySelectorAll('[placeholder], [title], [aria-label]')) {
    for (const attribut of ['placeholder', 'title', 'aria-label']) {
      const valeur = el.getAttribute(attribut)
      if (valeur) textes.push(valeur)
    }
  }
  return textes
}

/** Écarts aux règles du portugais : liste vide attendue. `autres` : toasts, confirmations, fichiers exportés. */
function ecartsPortugais(conteneur: HTMLElement, autres: string[] = []): string[] {
  const ecarts: string[] = []
  for (const brut of [...textesVisibles(conteneur), ...autres.flatMap(t => t.split('\n'))]) {
    const texte = brut.trim()
    if (!texte) continue
    if (/[—–]/.test(texte) && texte !== '—') ecarts.push(`tiret long : « ${texte} »`)
    if (/\s:/.test(texte)) ecarts.push(`espace avant « : » : « ${texte} »`)
    for (const motif of MOTS_INTERDITS) if (motif.test(texte)) ecarts.push(`${motif.source.replace(/\(\?<?![^)]*\)/g, '')} : « ${texte} »`)
  }
  // Espace avant « : » à cheval sur deux éléments (« <strong>Gerente</strong> : … »).
  const tout = conteneur.textContent ?? ''
  const avant = tout.match(/.{0,30}\s:.{0,30}/)
  if (avant) ecarts.push(`espace avant « : » : « ${avant[0]} »`)
  return [...new Set(ecarts)]
}

// ── Montage et outils ──
const pause = (ms = 40) => act(async () => { await new Promise(r => setTimeout(r, ms)) })
const json = (corps: unknown, status = 200) => new Response(JSON.stringify(corps), { status })
const texte = (el: Element | null | undefined) => (el?.textContent ?? '').replace(/\s/g, ' ')
const cliquer = (el: Element | null | undefined) => { expect(el).toBeTruthy(); fireEvent.click(el as Element) }
const saisir = (el: Element | null | undefined, valeur: string) => { expect(el).toBeTruthy(); fireEvent.change(el as Element, { target: { value: valeur } }) }
const monter = (langue: Langue, element: React.ReactElement) => render(<LanguageProvider initialLocale={langue}>{element}</LanguageProvider>).container
const lireFichiers = () => Promise.all(etat.fichiers.map(async f => ({ nom: f.nom, contenu: await f.blob.text() })))

beforeEach(() => {
  // Mardi 17 novembre 2026, midi, heure du poste : « Último acesso » et dates d'export stables.
  vi.useFakeTimers({ toFake: ['Date'], now: new Date(2026, 10, 17, 12, 0, 0) })
  etat.tables = {}
  etat.toasts = []
  etat.confirmations = []
  etat.fichiers = []
  etat.routeur = async () => json({})
  delete (window as unknown as Record<string, unknown>).__team_members_cache
  localStorage.clear()
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (entree, init) => etat.routeur(String(entree), init))
  // Fichiers exportés : le Blob est gardé, le nom vient du lien de téléchargement.
  let dernierBlob: Blob | null = null
  URL.createObjectURL = vi.fn((b: Blob) => { dernierBlob = b; return 'blob:essai' }) as unknown as typeof URL.createObjectURL
  URL.revokeObjectURL = vi.fn()
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
    if (dernierBlob) etat.fichiers.push({ nom: this.download, blob: dernierBlob })
  })
  vi.spyOn(window, 'confirm').mockImplementation((m?: string) => { etat.confirmations.push(String(m)); return false })
})
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks() })

// ── Données fictives (valeurs enregistrées telles qu'en production : unités, catégories et statuts en français) ──
const PEDIDOS = [
  {
    id: 'r1', title: 'Materiais moradia Gaia', message: 'Entrega em obra até dia 30', status: 'answered', created_at: '2026-11-10T09:00:00Z',
    rfq_items: [
      { id: 'i1', rfq_id: 'r1', product_name: 'Bloco 20x20x50', product_ref: 'BL-20', category: 'gros_oeuvre', quantity: 200, unit: 'unité', notes: 'Classe B40' },
      { id: 'i2', rfq_id: 'r1', product_name: 'Cimento', product_ref: '', category: 'autre', quantity: 10, unit: 'sac', notes: '' },
    ],
    offers: [
      { id: 'o1', supplier_name: 'Fornecedor Norte', total_price: 1234.5, delivery_days: 5, status: 'pending', created_at: '2026-11-11T09:00:00Z' },
      { id: 'o2', supplier_name: 'Fornecedor Sul', total_price: null, delivery_days: null, status: 'pending', created_at: '2026-11-12T09:00:00Z' },
    ],
  },
  { id: 'r2', title: 'Telhas', message: '', status: 'pending', created_at: '2026-11-15T09:00:00Z', rfq_items: [], offers: [] },
]

const membre = (id: string, role: string, extra: Record<string, unknown> = {}) => ({
  id, email: `${id}@exemplo.pt`, full_name: `Pessoa ${id.toUpperCase()}`, phone: '', role, contract_type: 'cdi', assigned_chantiers: [],
  invite_sent_at: null, accepted_at: '2026-02-01T00:00:00Z', last_login_at: '2026-11-16T10:00:00', is_active: true,
  created_at: '2026-02-01T00:00:00Z', permission_overrides: [], ...extra,
})
const MEMBROS = [
  membre('m1', 'GERANT', { contract_type: null }),
  membre('m2', 'CONDUCTEUR_TRAVAUX'),
  membre('m3', 'CHEF_CHANTIER', { contract_type: 'cdd' }),
  membre('m4', 'SECRETAIRE', { contract_type: 'sous_traitant', accepted_at: null, last_login_at: null }),
  membre('m5', 'COMPTABLE', { is_active: false }),
  membre('m6', 'OUVRIER', { contract_type: 'apprenti', permission_overrides: [{ module_id: 'devis', access_level: 'READ' }] }),
]

const DIAS = ['2026-11-17', '2026-11-18', '2026-11-19', '2026-11-20', '2026-11-21', '2026-11-22', '2026-11-23']
const previsao = (o: Partial<Record<'max' | 'min' | 'chuva' | 'vento', number[]>>) => ({
  daily: {
    time: DIAS,
    temperature_2m_max: o.max ?? [15, 16, 17, 18, 17, 16, 15],
    temperature_2m_min: o.min ?? [8, 9, 9, 10, 9, 8, 8],
    precipitation_sum: o.chuva ?? [0, 0, 2.5, 0, 0, 0, 0],
    wind_speed_10m_max: o.vento ?? [10, 12, 14, 10, 9, 8, 7],
    weather_code: [1, 2, 3, 61, 0, 45, 95],
  },
})
const PREVISOES: Record<string, unknown> = {
  '41.1': previsao({ vento: [10, 72, 14, 10, 9, 8, 7] }),
  '41.2': previsao({ chuva: [0, 0, 7.4, 0, 0, 0, 0] }),
  '41.3': previsao({ min: [-3, 1, 2, 3, 2, 1, 1] }),
  '41.4': previsao({ max: [15, 16, 17, 35, 17, 16, 15] }),
  '41.5': previsao({}),
}
const obra = (id: string, lat: number | null, extra: Record<string, unknown> = {}) => ({
  id, titre: `Obra ${id}`, adresse: 'Rua das Flores 10', ville: 'Porto', codePostal: '4050-262', statut: 'En cours',
  latitude: lat, longitude: lat === null ? null : -8.61, ...extra,
})
const routeurMeteo = async (url: string) => json(PREVISOES[new URL(url).searchParams.get('latitude') ?? ''] ?? previsao({}))

const SUBEMPREITEIROS = [
  { id: 's1', entreprise: 'Canalizações Lda', siret: '501234567', responsable: 'José Pereira', email: 'jp@exemplo.pt', telephone: '912345678', adresse: 'Rua A, Porto', chantier: 'Moradia Gaia', lot: 'Lote 3 Canalização', montantMarche: 12500, tauxTVA: 20, statut: 'en_attente', dc4Genere: false },
  { id: 's2', entreprise: 'Eletro Norte', siret: '509876543', responsable: 'Rita Sousa', email: 'rs@exemplo.pt', telephone: '913333333', adresse: 'Rua B, Braga', chantier: 'Moradia Gaia', lot: 'Lote 4 Eletricidade', montantMarche: 8000, tauxTVA: 20, statut: 'agréé', dateAgrement: '2026-11-02', dc4Genere: true },
]
const ANALISES = [
  { id: 'a1', titre: 'Escola de Gaia', country: 'PT', projectType: 'Rénovation', createdAt: '2026-11-03T10:00:00Z', status: 'done', result: { scoring: { technique: 72, prix: 65, probabilite: 40 }, analyse_marche: 'Texto da IA', exigences: 'Requisitos da IA', strategie: 'Estratégia da IA' } },
  { id: 'a2', titre: 'Pavilhão', country: 'PT', projectType: 'Gros œuvre', createdAt: '2026-11-04T10:00:00Z', status: 'error', result: { error: 'Erreur inconnue' } },
  { id: 'a3', titre: 'Mercado', country: 'PT', projectType: '', createdAt: '2026-11-05T10:00:00Z', status: 'pending' },
]
const CONCURSOS = [
  { id: 'cc-000001', titre: 'Escola Gaia', client: 'Câmara Municipal', dateRemise: '2026-11-25', montantEstime: 250000, statut: 'en_cours', lots: [{ numero: '1', designation: 'Estrutura', montantHT: 100000 }] },
  { id: 'cc-000002', titre: 'Pavilhão', client: 'Junta de Freguesia', dateRemise: '', montantEstime: 0, statut: 'gagné', lots: [] },
]

// ── Rendus partagés FR / PT ──
async function rfqDetalhe(langue: Langue) {
  etat.routeur = async (url, init) => (url === '/api/rfq' && !init?.method ? json({ rfqs: PEDIDOS }) : json({}))
  const c = monter(langue, <RFQSection artisan={{ id: 'art-1' }} orgRole="pro_societe" />)
  await pause()
  const lista = texte(c)
  cliquer(c.querySelector('tbody tr'))
  await pause()
  return { c, lista }
}
async function contas(langue: Langue, membros = MEMBROS) {
  etat.routeur = async (url, init) => (url === '/api/pro/team' && !init?.method ? json({ members: membros }) : json({}))
  const c = monter(langue, <CompteUtilisateursSection artisan={{ id: 'art-1', user_id: 'u1' } as never} isGerant />)
  await pause()
  return c
}
async function meteo(langue: Langue) {
  etat.routeur = routeurMeteo
  etat.tables.chantiers = [obra('vento', 41.1), obra('chuva', 41.2), obra('gelo', 41.3), obra('calor', 41.4), obra('calma', 41.5), obra('sem-cidade', null, { ville: '', adresse: '' })]
  const c = monter(langue, <MeteoChantierSection userId="u1" authUserId="u1" isPt={langue === 'pt'} />)
  await pause(600)
  return c
}
async function dpgf(langue: Langue) {
  etat.tables.dpgf = CONCURSOS
  const c = monter(langue, <DPGFSection userId="u1" orgRole="pro_societe" />)
  await pause()
  cliquer(c.querySelector('tbody tr'))
  await pause()
  cliquer(c.querySelector('button.v5-btn.v5-btn-sm'))
  await pause()
  return { c, fichiers: await lireFichiers() }
}

describe('modules BTP du tableau de bord pro en portugais (pt-PT)', () => {
  it('Orçamentos de fornecedores : liste, détail, formulaire et messages en portugais, même sans pays « PT » dans le profil', async () => {
    const { c, lista } = await rfqDetalhe('pt')
    expect(lista).toContain('Orçamentos de fornecedores (pedidos de cotação)')
    expect(lista).toContain('Pedidos de cotação a fornecedores')
    expect(lista).toContain('+ Novo pedido de cotação')
    expect(lista).toContain('Resposta(s) recebida(s)')
    expect(ecartsPortugais(c)).toEqual([])
    // Détail : unités et catégorie enregistrées en français, affichées en portugais.
    const detalhe = texte(c)
    expect(detalhe).toContain('200 unidade')
    expect(detalhe).toContain('10 saco')
    expect(detalhe).toContain('Estrutura e alvenaria')
    expect(detalhe).toContain('Preço s/ IVA')
    expect(detalhe).toContain('A aguardar resposta')
    // Formulaire : options d'unité traduites, valeur enregistrée inchangée.
    cliquer(c.querySelector('button.v5-btn.v5-btn-p'))
    await pause()
    const unidade = c.querySelector('form select') as HTMLSelectElement
    expect(unidade.value).toBe('unité')
    expect(unidade.selectedOptions[0].textContent).toBe('unidade')
    fireEvent.submit(c.querySelector('form') as HTMLFormElement)
    await pause()
    expect(texte(c)).toContain('O título é obrigatório')
    expect(ecartsPortugais(c)).toEqual([])
  })

  it('Contas de utilizadores : papéis, tableau, bloc PAPÉIS / PERMISSÕES, convite e permissões', async () => {
    const c = await contas('pt')
    const tudo = texte(c)
    expect(tudo).toContain('Último acesso')
    for (const papel of ['Gerente', 'Diretor de obra', 'Encarregado', 'Administrativo(a)', 'Contabilista', 'Operário']) expect(tudo).toContain(papel)
    expect(tudo).toContain('Sócio-gerente')
    expect(tudo).toContain('Subempreiteiro')
    expect(tudo).toContain('Gerente: acesso total e gestão das contas. Só o gerente titular cria ou retira gerentes.')
    // Droits par défaut des rôles de terrain depuis le 25/11/2026 : leurs obras, la météo et le pointage.
    expect(tudo).toContain('Encarregado: por defeito, só as suas obras (consulta), a meteorologia e o registo de horas.')
    expect(tudo).toContain('o botão « Editar » de cada membro')
    expect([...c.querySelectorAll('tbody button')].map(b => b.textContent)).toContain('Editar')
    expect(ecartsPortugais(c)).toEqual([])

    // Convite : formulaire, exemple portugais, message d'erreur client.
    cliquer(c.querySelector('button.v5-btn.v5-btn-p'))
    await pause()
    expect((c.querySelector('.v22-modal input[type="tel"]') as HTMLInputElement).placeholder).toBe('+351 912 345 678')
    cliquer(c.querySelector('.v22-modal-foot .v22-btn-primary'))
    await pause()
    expect(etat.toasts).toEqual(['Preencha o e-mail e o nome'])
    expect(ecartsPortugais(c, etat.toasts)).toEqual([])
    cliquer(c.querySelector('.v22-modal-foot .v22-btn'))
    await pause()

    // Permissões : titre sans tiret, modules sans sigle français.
    cliquer(c.querySelectorAll('tbody tr')[5].querySelector('button'))
    await pause()
    const modal = texte(c.querySelector('.v22-modal'))
    expect(modal).toContain('Permissões: Pessoa M6')
    expect(modal).toContain('Módulo')
    expect(modal).toContain('Subempreitadas')
    expect(modal).toContain('Concursos / Mapas de quantidades')
    expect(ecartsPortugais(c)).toEqual([])

    // Suppression et erreur réseau : confirmation et repli « Erro » en portugais.
    cliquer(c.querySelector('.v22-modal-foot .v22-btn'))
    await pause()
    cliquer(c.querySelectorAll('tbody tr')[1].querySelectorAll('button')[2])
    expect(etat.confirmations).toEqual(['Tem a certeza que deseja eliminar Pessoa M2?'])
    etat.routeur = async () => { throw new Error('rede') }
    cliquer(c.querySelectorAll('tbody tr')[1].querySelectorAll('button')[1])
    await pause()
    expect(etat.toasts.at(-1)).toBe('Erro')
  })

  it('Contas de utilizadores : « 1 conta ativa » au singulier', async () => {
    const c = await contas('pt', [MEMBROS[0]])
    expect(texte(c.querySelector('.v5-pg-t p'))).toBe('Acessos da equipa: 1 conta ativa / 20 no máximo')
  })

  it('Meteorologia : alertes, avis et limiares de obra en portugais, source Open-Meteo (pas IPMA)', async () => {
    const c = await meteo('pt')
    const tudo = texte(c)
    expect(tudo).toContain('Meteorologia das obras')
    expect(tudo).toContain('dados Open-Meteo')
    expect(tudo).not.toContain('IPMA')
    expect([...c.querySelectorAll('.v5-kpi-l')].map(e => e.textContent)).toContain('Avisos')
    expect(tudo).toContain('Limiares de obra: 🌧️ Chuva > 5 mm = sem rebocos/betonagem')
    expect(tudo).toContain('🌧 7.4 mm')
    expect(tudo).toContain('✅ Sem alertas')
    expect(tudo).toContain('Gelo -3 °C. Sem alvenaria nem betonagem.')
    expect(tudo).toContain('secção Obras')
    expect(ecartsPortugais(c)).toEqual([])
  })

  it('Meteorologia : statuts enregistrés en français affichés en portugais', async () => {
    etat.tables.chantiers = [obra('fim', 41.5, { statut: 'Terminé' }), obra('anulada', 41.5, { statut: 'Annulé' })]
    const c = monter('pt', <MeteoChantierSection userId="u1" authUserId="u1" isPt />)
    await pause()
    expect(texte(c)).toContain('(estados: Concluída, Anulada)')
    expect(ecartsPortugais(c)).toEqual([])
  })

  it('Subempreitadas : onglets, formulaire, analyse, mémoire, liste de vérification et fiche exportée sans « DC4 »', async () => {
    etat.tables.dc4 = SUBEMPREITEIROS
    etat.tables.dce_analyses = ANALISES
    const c = monter('pt', <SousTraitanceDC4Section userId="u1" orgRole="pro_societe" />)
    await pause()
    const separadores = [...c.querySelectorAll('.v5-tabs button')].map(b => texte(b).trim())
    expect(separadores).toEqual(['Subempreiteiros (2)', 'Análise do processo de concurso / IA', 'Memória descritiva', 'Lista de verificação'])
    expect(texte(c)).toContain('Fichas geradas')
    expect(ecartsPortugais(c)).toEqual([])

    // Formulaire
    cliquer(c.querySelector('button.v5-btn.v5-btn-p'))
    await pause()
    const rotulos = [...c.querySelectorAll('label.v5-fl')].map(l => l.textContent)
    expect(rotulos).toEqual(expect.arrayContaining(['NIF / NIPC', 'Lote', 'Montante s/ IVA (€)', 'IVA']))
    expect(ecartsPortugais(c)).toEqual([])

    // Fiche exportée
    cliquer(c.querySelector('tbody button.v5-btn-p.v5-btn-sm'))
    await pause()
    const [ficha] = await lireFichiers()
    expect(ficha.nom).toBe('Ficha_subempreitada_Eletro_Norte.txt')
    expect(ficha.contenu).toContain('FICHA DE SUBEMPREITADA')
    expect(ficha.contenu).toContain('Montante c/ IVA: ')
    expect(ficha.contenu).toContain('O dono de obra: ')
    expect(ecartsPortugais(c, [ficha.nom, ficha.contenu])).toEqual([])

    // Analyse : formulaire, analyses précédentes, résultat
    cliquer(c.querySelectorAll('.v5-tabs button')[1])
    await pause()
    const analise = texte(c)
    expect(analise).toContain('Nova análise de processo de concurso')
    expect(analise).toContain('Renovação')
    expect(analise).toContain('Concluída')
    expect(ecartsPortugais(c)).toEqual([])
    cliquer([...c.querySelectorAll('.v5-card')].find(e => e.textContent?.includes('Escola de Gaia')))
    await pause()
    expect(texte(c)).toContain('Pontuação técnica')
    expect(texte(c)).toContain('Análise do concurso')
    expect(ecartsPortugais(c)).toEqual([])
    cliquer(c.querySelector('button.v5-btn'))
    await pause()

    // Mémoire et liste de vérification (en portugais, onglet « Portugal » ouvert par défaut ; « França » traduit
    // sans sigle français)
    cliquer(c.querySelectorAll('.v5-tabs button')[2])
    await pause()
    expect(texte(c)).toContain('Estrutura tipo da memória descritiva')
    expect(ecartsPortugais(c)).toEqual([])
    cliquer(c.querySelectorAll('.v5-tabs button')[3])
    await pause()
    expect(texte(c)).toContain('Lista de preços unitários')
    expect(ecartsPortugais(c)).toEqual([])
    cliquer(c.querySelectorAll('.v5-tabs')[1].querySelectorAll('button')[0])
    await pause()
    expect(texte(c)).toContain('França')
    expect(texte(c)).toContain('Declaração de subempreitada')
    expect(ecartsPortugais(c)).toEqual([])
  })

  it('Subempreitadas : taux d’IVA portugais proposés en portugais, taux français en français', async () => {
    const tauxProposes = (c: HTMLElement) => {
      const choix = [...c.querySelectorAll('select')].find(s => [...s.options].some(o => o.textContent === '0%'))
      return choix ? [...choix.options].map(o => o.textContent) : []
    }
    const pt = monter('pt', <SousTraitanceDC4Section userId="u1" orgRole="pro_societe" />)
    await pause()
    cliquer([...pt.querySelectorAll('button')].find(b => b.textContent?.includes('Novo subempreiteiro')))
    await pause()
    expect(tauxProposes(pt)).toEqual(['23%', '13%', '6%', '0%'])
    const fr = monter('fr', <SousTraitanceDC4Section userId="u1" orgRole="pro_societe" />)
    await pause()
    cliquer([...fr.querySelectorAll('button')].find(b => b.textContent?.includes('Nouveau DC4')))
    await pause()
    expect(tauxProposes(fr)).toEqual(['20%', '10%', '5.5%', '0%'])
  })

  it('Subempreitadas : erreur d\'analyse enregistrée en français affichée en portugais', async () => {
    etat.routeur = async () => json({}, 500)
    const c = monter('pt', <SousTraitanceDC4Section userId="u1" orgRole="pro_societe" />)
    await pause()
    cliquer(c.querySelectorAll('.v5-tabs button')[1])
    await pause()
    saisir(c.querySelector('input.v5-fi'), 'Escola')
    saisir(c.querySelector('textarea'), 'Reabilitação')
    cliquer(c.querySelector('.v5-card > button.v5-btn-p'))
    await pause(80)
    expect(texte(c.querySelector('.v5-al.err'))).toBe('Erro desconhecido')
  })

  it('Concursos / Mapas de quantidades : textes de locales/pt.json, IVA 23% et fichier exporté en portugais', async () => {
    const { c, fichiers } = await dpgf('pt')
    const tudo = texte(c)
    expect(tudo).toContain('Concursos / Mapas de quantidades')
    expect(tudo).toContain('Mapas de quantidades e preços por lote')
    expect(tudo).toContain('Cliente (dono de obra)')
    expect(tudo).toContain('Mapa de quantidades: Escola Gaia')
    expect(tudo).toContain('TOTAL c/ IVA (IVA 23%)')
    expect(tudo).toContain('123 000 €')
    expect(ecartsPortugais(c)).toEqual([])
    expect(fichiers.map(f => f.nom)).toEqual(['Mapa_de_quantidades_Escola_Gaia.txt'])
    const conteudo = fichiers[0].contenu.replace(/\s/g, ' ')
    expect(conteudo).toContain('IVA 23%: 23 000 €')
    expect(conteudo).toContain('TOTAL c/ IVA: 123 000 €')
    expect(ecartsPortugais(c, [fichiers[0].contenu])).toEqual([])
  })
})

describe('les mêmes modules en français : textes inchangés', () => {
  it('Devis Fournisseurs (RFQ)', async () => {
    const { c, lista } = await rfqDetalhe('fr')
    expect(lista).toContain('Devis Fournisseurs (RFQ)')
    expect(lista).toContain('+ Nouvelle demande de prix')
    expect(texte(c)).toContain('200 unité')
    expect(texte(c)).toContain('Gros œuvre')
    expect(texte(c)).toContain('Prix HT')
  })

  it('Comptes utilisateurs', async () => {
    const c = await contas('fr')
    const tout = texte(c)
    expect(tout).toContain('Accès équipe : 6 comptes actifs / 20 max')
    expect(tout).toContain('Dernière connexion')
    expect(tout).toContain('Gérant : accès complet et gestion des comptes. Seul le gérant titulaire crée ou retire un gérant.')
    expect(tout).toContain('Chef de chantier')
    expect(tout).toContain('Dirigeant')
  })

  it('Météo chantiers', async () => {
    const c = await meteo('fr')
    const tout = texte(c)
    expect(tout).toContain('Météo chantiers')
    expect(tout).toContain('Seuils BTP : 🌧️ Pluie > 5mm = pas de ravalement/béton')
    expect(tout).toContain('horaires aménagés obligatoires (Code du travail)')
    expect(tout).toContain('chantier(s) sans ville — Ajoutez la ville')
  })

  it('Sous-traitance & DC4, fiche exportée comprise', async () => {
    etat.tables.dc4 = SUBEMPREITEIROS
    const c = monter('fr', <SousTraitanceDC4Section userId="u1" orgRole="pro_societe" />)
    await pause()
    expect(texte(c)).toContain('Sous-traitance & Appels d\'offres')
    expect(texte(c)).toContain('+ Nouveau DC4')
    cliquer(c.querySelector('tbody button.v5-btn-p.v5-btn-sm'))
    await pause()
    const [fiche] = await lireFichiers()
    expect(fiche.nom).toBe('DC4_Eletro_Norte.txt')
    expect(fiche.contenu).toContain('DC4 — ACTE SPÉCIAL DE SOUS-TRAITANCE')
    expect(fiche.contenu).toContain('Le sous-traitant bénéficie du paiement direct.')
  })

  it('Appels d\'offres DPGF : TVA 20 % sans pays transmis, export inchangé', async () => {
    const { c, fichiers } = await dpgf('fr')
    expect(texte(c)).toContain('Appels d\'offres — DPGF')
    expect(texte(c)).toContain('DPGF — Escola Gaia')
    expect(texte(c)).toContain('TOTAL TTC (TVA 20%)')
    expect(fichiers.map(f => f.nom)).toEqual(['DPGF_Escola_Gaia.txt'])
    const contenu = fichiers[0].contenu.replace(/\s/g, ' ')
    expect(contenu).toContain('DPGF — Escola Gaia')
    expect(contenu).toContain('TVA 20% : 20 000 €')
    expect(contenu).toContain('TOTAL TTC : 120 000 €')
  })
})
