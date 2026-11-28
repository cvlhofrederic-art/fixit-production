// tests/components/i18n-pt-modules-btp-2.test.tsx
//
// Tableau de bord BTP pro en portugais (/pt/pro/dashboard, rapport i18n de Frédéric du 17/11/2026), vague 2 : les modules
// réservés aux sociétés (orgRole 'pro_societe') Serviços, Obras, Equipas, Planeamento Gantt, Registo de horas, Autos de
// medição, Retenções para garantia, Portal cliente, Recrutar subempreiteiros, Contabilidade IA et Rentabilidade
// affichaient du français (textes sans branche portugaise, valeurs enregistrées affichées brutes), des calques
// (« Prestações », « Situações de obra », « Chefe de obra », « pointagem », « marcação »…), des tirets longs et des espaces
// avant « : ». Ce test monte chaque module en portugais avec le vrai LanguageProvider (donc le vrai locales/pt.json), dans
// plusieurs états (liste, détail, formulaires, modales, messages, fichier exporté), et vérifie : aucun mot français ni
// calque connu, aucun tiret long hors valeur vide « — », aucune espace avant « : ? ! ; », aucune unité collée au nombre
// (« 25€ », « 8h »), des textes portugais attendus, et les valeurs enregistrées inchangées. Puis le rendu français reste
// celui d'avant. Réseau, Supabase et données simulés ; données fictives.

import React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render } from '@testing-library/react'

const etat = vi.hoisted(() => ({
  tables: {} as Record<string, unknown[]>,
  reglages: {} as Record<string, unknown>,
  supa: {} as Record<string, unknown[]>,
  ajouts: [] as Array<{ table: string; objet: Record<string, unknown> }>,
  toasts: [] as string[],
  confirmations: [] as string[],
  fichiers: [] as Array<{ nom: string; blob: Blob }>,
  routeur: (async () => new Response('{}')) as (url: string, init?: RequestInit) => Promise<Response>,
}))

vi.mock('@/lib/hooks/use-btp-data', async (importOriginal) => ({
  // Les aides d'affichage du module (refus, plafonds atteints, chargement impossible), dont se servent la Compta BTP
  // et la Rentabilité, restent les vraies ; seuls les hooks sont simulés.
  ...(await importOriginal<typeof import('@/lib/hooks/use-btp-data')>()),
  // Même tableau d'un rendu à l'autre, comme l'état React du vrai hook.
  useBTPData: ({ table }: { table: string }) => ({
    items: etat.tables[table] ?? (etat.tables[table] = []),
    loading: false,
    error: null,
    add: async (objet: Record<string, unknown>) => { etat.ajouts.push({ table, objet }); return { id: 'nouveau-1', ...objet } },
    update: async () => true,
    remove: async () => true,
  }),
  useBTPSettings: () => ({ settings: etat.reglages, save: async () => true, loading: false }),
}))
vi.mock('@/lib/supabase', () => {
  const requete = (table: string) => {
    const chaine: Record<string, unknown> = {}
    for (const m of ['select', 'eq', 'neq', 'is', 'not', 'in', 'order', 'limit', 'update', 'insert', 'delete']) chaine[m] = () => chaine
    chaine.single = async () => ({ data: (etat.supa[table] ?? [])[0] ?? null, error: null })
    chaine.then = (resoudre: (v: unknown) => unknown, rejeter?: (e: unknown) => unknown) =>
      Promise.resolve({ data: etat.supa[table] ?? [], error: null }).then(resoudre, rejeter)
    return chaine
  }
  return {
    supabase: {
      auth: {
        getSession: async () => ({ data: { session: { access_token: 'jeton-essai', user: { id: 'u1', email: 'gerente@exemplo.pt' } } } }),
        getUser: async () => ({ data: { user: { id: 'u1' } } }),
      },
      from: (table: string) => requete(table),
    },
  }
})
vi.mock('sonner', () => {
  const noter = (m: string) => { etat.toasts.push(m) }
  return { toast: { success: noter, error: noter, warning: noter, info: noter } }
})
vi.mock('next/image', async () => {
  const { createElement } = await import('react')
  return { default: ({ src, alt }: { src?: string; alt?: string }) => createElement('img', { src, alt }) }
})
vi.mock('@/lib/auth/jeton-acces', () => ({ jetonAcces: async () => 'jeton-essai' }))
vi.mock('@/lib/btp/geocodage', async (original) => ({
  ...(await original<typeof import('@/lib/btp/geocodage')>()),
  geocoderAdresse: async () => null,
}))

import { LanguageProvider } from '@/lib/i18n/context'
import PrestationsBTPSection from '@/components/dashboard/PrestationsBTPSection'
import { ChantiersBTPV2 } from '@/components/dashboard/ChantiersBTPV2'
import EquipesBTPV2 from '@/components/dashboard/EquipesBTPV2'
import { GanttSection } from '@/components/dashboard/btp/GanttSection'
import { PointageGeoSection } from '@/components/dashboard/PointageGeoSection'
import { PointageEquipesSection } from '@/components/dashboard/btp/PointageEquipesSection'
import { SituationsTravaux } from '@/components/dashboard/btp/SituationsTravaux'
import { RetenuesGarantieSection } from '@/components/dashboard/btp/RetenuesGarantieSection'
import { ChantiersBTPSection } from '@/components/dashboard/btp/ChantiersBTPSection'
import PortailClientSection from '@/components/dashboard/btp/PortailClientSection'
import SousTraitanceOffresSection from '@/components/dashboard/SousTraitanceOffresSection'
import { ComptaBTPSection } from '@/components/dashboard/ComptaBTPSection'
import RentabiliteChantierSection from '@/components/dashboard/RentabiliteChantierSection'

type Langue = 'fr' | 'pt'
type Etape = (nom: string, c: HTMLElement, autres?: string[]) => void
type Scenario = (langue: Langue, etape: Etape) => Promise<void>

// ── Règles du portugais affiché ──
// Mots français, sigles français, calques et brésilianismes relevés par le rapport et le glossaire (bornes de mot Unicode).
const MOTS_INTERDITS = [
  'Nouveau', 'Nouvelle', 'Aucun', 'Aucune', 'Chargement', 'Ajouter', 'Supprimer', 'Enregistrer', 'Enregistrement', 'Annuler',
  'Télécharger', 'Sélectionner', 'Rechercher', 'Créer', 'Modifier', 'Fermer', 'Retour', 'Erreur', 'Statut', 'votre', 'vos',
  'chantier', 'chantiers', 'Chantier', 'Chantiers', 'devis', 'Devis', 'facture', 'Facture', 'Prix', 'Fourchette', 'Budget',
  'Marge', 'Score', 'Tarif', 'Dispo', 'Logiciel', 'France', 'Email', 'Net', 'Brut', 'CA', 'HT', 'TTC', 'TVA', 'SIRET', 'URSSAF',
  'SMIC', 'BTP', 'VRD', 'RDV', 'plage', 'jour', 'jours', 'mois', 'ouvré', 'Réf', 'Décennale', 'Situation', 'Pointage',
  'pointage', 'Pointer', 'Employé', 'Ouvrier', 'Gérant', 'Patron', 'Matériaux', 'Prestation', 'Prestations', 'Urgence',
  'Candidature', 'Candidatures', 'Annonce', 'Sous-traitance', 'Renfort', 'Min', 'Max',
  // Calques et brésilianismes
  'motivo', 'prestação', 'prestações', 'Prestação', 'Prestações', 'efetivo', 'Efetivo', 'efetivos', 'Situação', 'Situações',
  'situação', 'situações', 'Chefe de obra', 'chefe', 'Secretária', 'Secretário', 'Director', 'Condutor', 'estaleiro',
  'pointagem', 'pontuagens', 'Marcação', 'marcação', 'marcações', 'Marcar', 'marque', 'Cotizações', 'cotizações', 'Cesta',
  'Indemnidades', 'Ventilação', 'Patrão', 'patrão', 'decenário', 'você', 'arquivo', 'usuário', 'equipe', 'registro',
  'contato', 'salvar', 'baixar', 'excluir', 'deletar', 'dossiê',
].map(mot => new RegExp(`(?<![\\p{L}\\p{N}])${mot}(?![\\p{L}\\p{N}])`, 'u'))

/** Textes visibles : nœuds de texte (hors <style>), placeholder / title / aria-label, valeurs des champs de texte. */
function textesVisibles(conteneur: HTMLElement): string[] {
  const textes: string[] = []
  const parcours = document.createTreeWalker(conteneur, NodeFilter.SHOW_TEXT)
  for (let n = parcours.nextNode(); n; n = parcours.nextNode()) {
    if (n.parentElement?.closest('style')) continue
    textes.push(n.textContent ?? '')
  }
  for (const el of conteneur.querySelectorAll('[placeholder], [title], [aria-label]')) {
    for (const attribut of ['placeholder', 'title', 'aria-label']) {
      const valeur = el.getAttribute(attribut)
      if (valeur) textes.push(valeur)
    }
  }
  for (const champ of conteneur.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>('input:not([type]), input[type="text"], textarea')) {
    if (champ.value) textes.push(champ.value)
  }
  return textes
}

/** Écarts aux règles du portugais : liste vide attendue. `autres` : toasts, confirmations, fichiers exportés. */
function ecartsPortugais(conteneur: HTMLElement, autres: string[] = []): string[] {
  const ecarts: string[] = []
  for (const brut of [...textesVisibles(conteneur), ...autres.flatMap(t => t.split('\n'))]) {
    const texte = brut.trim()
    // Adresse technique (lien de l'écran Registo de horas, « ?p=pointage ») : pas un texte à traduire.
    if (!texte || /^https?:\/\//.test(texte)) continue
    if (/[—–]/.test(texte) && texte !== '—') ecarts.push(`tiret long : « ${texte} »`)
    if (/\s[:?!;]/.test(texte)) ecarts.push(`espace avant ponctuation : « ${texte} »`)
    if (/\d(€|h|j|m|km|mm)(?![\p{L}\p{N}])/u.test(texte)) ecarts.push(`unité collée : « ${texte} »`)
    for (const motif of MOTS_INTERDITS) if (motif.test(texte)) ecarts.push(`${motif.source.replace(/\(\?<?![^)]*\)/g, '')} : « ${texte} »`)
  }
  // À cheval sur deux éléments (« <strong>Horas</strong> : … », « {12}€ ») : toutes les occurrences du texte complet.
  const tout = (conteneur.textContent ?? '').replace(/\s+/g, ' ')
  for (const m of tout.matchAll(/.{0,30} [:?!;].{0,30}/g)) ecarts.push(`espace avant ponctuation : « ${m[0]} »`)
  for (const m of tout.matchAll(/.{0,30}\d(€|h|j|m|km|mm)(?![\p{L}\p{N}]).{0,30}/gu)) ecarts.push(`unité collée : « ${m[0]} »`)
  return [...new Set(ecarts)]
}

// ── Montage et outils ──
const pause = (ms = 40) => act(async () => { await new Promise(r => setTimeout(r, ms)) })
const json = (corps: unknown, status = 200) => new Response(JSON.stringify(corps), { status })
const texte = (el: Element | null | undefined) => (el?.textContent ?? '').replace(/\s/g, ' ')
const cliquer = (el: Element | null | undefined) => { expect(el).toBeTruthy(); fireEvent.click(el as Element) }
const saisir = (el: Element | null | undefined, valeur: string) => { expect(el).toBeTruthy(); fireEvent.change(el as Element, { target: { value: valeur } }) }
const monter = (langue: Langue, element: React.ReactElement) => render(<LanguageProvider initialLocale={langue}>{element}</LanguageProvider>).container
const fermerModale = (c: HTMLElement) => cliquer(c.querySelector('div[style*="position: fixed"] button'))
const lireFichiers = () => Promise.all(etat.fichiers.map(async f => ({ nom: f.nom, contenu: await f.blob.text() })))

beforeEach(() => {
  // Mardi 17 novembre 2026, midi, heure du poste : dates, retards et échéances stables.
  vi.useFakeTimers({ toFake: ['Date'], now: new Date(2026, 10, 17, 12, 0, 0) })
  etat.tables = {}
  etat.reglages = {}
  etat.supa = {}
  etat.ajouts = []
  etat.toasts = []
  etat.confirmations = []
  etat.fichiers = []
  etat.routeur = async () => json({})
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
afterEach(() => { cleanup(); vi.useRealTimers(); vi.restoreAllMocks() })

// ── Données fictives (valeurs enregistrées telles qu'en production : statuts, unités, rôles et catégories en français) ──
const ARTISAN = { id: 'art-1', user_id: 'u1', company_name: 'Construções Ribeiro, Lda', category: '', bio: '', specialties: [], email: 'geral@exemplo.pt', phone: '' } as never

const REGLAGES_FR = {
  country: 'FR', company_type: 'sarl', depot_rayon_m: 100, cout_horaire_ouvrier: 22, cout_horaire_chef_chantier: 30,
  cout_horaire_conducteur: 40, charges_patronales_pct: 45, geo_pointage_enabled: false, devise: 'EUR',
  salaire_patron_mensuel: 3000, salaire_patron_type: 'net', taux_cotisations_patron: 45, statut_juridique: 'sarl',
  regime_tva: 'reel_normal', taux_is: 25, frais_fixes_mensuels: [{ label: 'Renda', montant: 900, frequence: 'mensuel' }],
  objectif_marge_pct: 20, amortissements_mensuels: 300,
}
const REGLAGES_PT = {
  ...REGLAGES_FR, country: 'PT', company_type: 'lda', cout_horaire_ouvrier: 10, cout_horaire_chef_chantier: 16,
  cout_horaire_conducteur: 22, charges_patronales_pct: 24, taux_cotisations_patron: 24, statut_juridique: 'lda', taux_is: 21,
}
const reglagesPour = (langue: Langue) => (langue === 'pt' ? REGLAGES_PT : REGLAGES_FR)

const CATALOGO = [
  { id: 1, name: 'Laje de betão armado', description: 'Laje sobre caixa de brita', type: 'prest', lot: 'gros_oeuvre', unit: 'm²', price: { min: 55, max: 75 }, etapes: [{ label: 'Cofragem', price: 20, unit: 'm²' }], supabase_id: 's-1' },
  { id: 2, name: 'Demolição de paredes', type: 'prest', lot: 'gros_oeuvre', unit: 'forfait', price: { min: 2500, max: 2500 }, supabase_id: 's-2' },
  { id: 3, name: 'Porta interior', type: 'prest', lot: 'gros_oeuvre', unit: 'pce', price: { min: 180, max: 220 }, supabase_id: 's-3' },
  { id: 4, name: 'Cimento 25 kg', type: 'mat', lot: 'gros_oeuvre', unit: 'sac', ref: 'Secil', supplier: 'Leroy Merlin', priceAchat: { min: 4.5, max: 4.5 }, price: { min: 6, max: 7 } },
  { id: 5, name: 'Deslocação à obra', type: 'frais', lot: 'gros_oeuvre', unit: 'jour', price: { min: 45, max: 60 } },
]

const OBRAS = [
  { id: 'c1', titre: 'Moradia Gaia', client: 'Ana Costa', adresse: 'Rua das Flores 10', ville: 'Porto', codePostal: '4050-262', dateDebut: '2026-10-01', dateFin: '2026-11-10', budget: '45000', statut: 'En cours', description: 'Remodelação total', equipe: '2', latitude: 41.15, longitude: -8.61, geoRayonM: 150, membres_ids: ['m1', 'm2', 'm3'], devis_id: 'd1' },
  { id: 'c2', titre: 'Armazém Maia', client: 'Construções Norte, Lda', adresse: '', ville: 'Maia', codePostal: '', dateDebut: '2026-12-01', dateFin: '2027-02-01', budget: '120000', statut: 'En attente', description: '', equipe: '', latitude: null, longitude: null, geoRayonM: 100, membres_ids: [] },
  { id: 'c3', titre: 'Escola Braga', client: 'Câmara Municipal', adresse: 'Av. Central 1', ville: 'Braga', codePostal: '4700-000', dateDebut: '2026-06-01', dateFin: '2026-09-30', budget: '80000', statut: 'Terminé', description: '', equipe: '', latitude: null, longitude: null, geoRayonM: 100, membres_ids: [] },
  { id: 'c4', titre: 'Loja Aveiro', client: 'Ana Costa', adresse: 'Rua Direita 5', ville: 'Aveiro', codePostal: '3800-000', dateDebut: '2026-11-02', dateFin: '2026-12-20', budget: '20000', statut: 'En cours', description: '', equipe: '', latitude: null, longitude: null, geoRayonM: 100, membres_ids: [] },
]
const MEMBROS_API = [
  { id: 'm1', prenom: 'João', nom: 'Silva', type_compte: 'chef_chantier', salaire_net_mensuel: 1500, heures_hebdo: 40, actif: true },
  { id: 'm2', prenom: 'Rui', nom: 'Sousa', type_compte: 'ouvrier', cout_horaire: 10, actif: true },
  { id: 'm3', prenom: 'Luís', nom: 'Pereira', type_compte: 'ouvrier', actif: true },
]
const ORCAMENTOS = [
  { id: 'd1', numero: 'ORC-2026-014', client_name: 'Ana Costa', client_address: 'Rua das Flores 10, 4050-262 Porto', total_ht_cents: 4500000, items: [{ description: 'Remodelação da cozinha' }], created_at: '2026-10-01T09:00:00Z', status: 'accepted', chantier_id: 'c1' },
  { id: 'd2', numero: 'ORC-2026-015', client_name: 'Rita Lopes', client_address: '', total_ht_cents: 800000, items: [], created_at: '2026-11-02T09:00:00Z', status: 'draft', chantier_id: null },
]
const FATURAS = [{ id: 'f1', numero: 'FT 2026/12', client_name: 'Ana Costa', total_ht_cents: 1500000, status: 'paid', chantier_id: 'c1' }]

const membro = (id: string, typeCompte: string, extra: Record<string, unknown>) => ({
  id, prenom: '', nom: '', telephone: '', email: '', typeCompte, rolePerso: '', equipeId: '', coutHoraire: 12, chargesPct: 24,
  charges_salariales_pct: 11, charges_patronales_pct: 23.75, type_contrat: 'cdi', heures_hebdo: 40, panier_repas_jour: 0,
  indemnite_trajet_jour: 0, prime_mensuelle: 0, actif: true, createdAt: '2026-01-05T00:00:00Z', ...extra,
})
const MEMBROS = [
  membro('m1', 'chef_chantier', { prenom: 'João', nom: 'Silva', rolePerso: 'Encarregado geral', salaire_net_mensuel: 1500, panier_repas_jour: 8, indemnite_trajet_jour: 5 }),
  membro('m2', 'ouvrier', { prenom: 'Rui', nom: 'Sousa', type_contrat: 'interim' }),
  membro('m3', 'secretaire', { prenom: 'Marta', nom: 'Lopes', type_contrat: 'stage' }),
  membro('m4', 'conducteur_travaux', { prenom: 'Pedro', nom: 'Costa', type_contrat: 'cdd' }),
  membro('m5', 'gerant', { prenom: 'Carlos', nom: 'Ribeiro', type_contrat: 'independant', detention_capital_percent: 60 }),
  membro('m6', 'ouvrier', { prenom: 'Tiago', nom: 'Alves', actif: false }),
]
// Spécialités enregistrées : une valeur de la liste portugaise d'origine (« VRD »), une de la liste française.
const EQUIPAS = [
  { id: 'e1', nom: 'Equipa Alvenaria A', metier: 'Infraestruturas / VRD', chantierId: '', membreIds: ['m1', 'm2'], createdAt: '' },
  { id: 'e2', nom: 'Equipa Acabamentos', metier: 'Maçonnerie', chantierId: '', membreIds: [], createdAt: '' },
]

const SUBTAREFAS = [
  { id: 't1', nom: 'Cofragem', chantierId: 'c1', responsable: 'João', debut: '2026-10-05', fin: '2026-10-20', avancement: 100, couleur: '#3B82F6' },
  { id: 't2', nom: 'Betonagem', chantierId: 'c1', responsable: '', debut: '2026-11-01', fin: '2026-11-12', avancement: 40, couleur: '' },
  { id: 't3', nom: 'Pintura', chantierId: 'c2', responsable: 'Rui', debut: '2026-12-05', fin: '2027-01-10', avancement: 0, couleur: '#AB47BC' },
]

const registoEcran = (id: string, extra: Record<string, unknown>) => ({
  id, chantierId: 'c1', chantierNom: 'Moradia Gaia', date: '2026-11-17', heureArrivee: '08:00:00', heureDepart: null, heuresTravaillees: 0, mode: 'manuel', ...extra,
})
const CONTEXTO_COLABORADOR = {
  gerant: false, rattachement: 'relie', moi: { id: 'm2', nom: 'Rui Sousa' },
  chantiers: [
    { id: 'c1', titre: 'Moradia Gaia', adresse: 'Rua das Flores 10, Porto', latitude: 41.15, longitude: -8.61, rayonM: 150 },
    { id: 'c2', titre: 'Armazém Maia', adresse: '', latitude: null, longitude: null, rayonM: 100 },
  ],
  pointageEnCours: registoEcran('p9', {}),
  pointagesOublies: [registoEcran('p8', { chantierId: 'c2', chantierNom: 'Armazém Maia', date: '2026-11-13', mode: 'geo_auto' })],
  historique: [
    registoEcran('p9', {}),
    registoEcran('p7', { date: '2026-11-16', heureDepart: '17:00:00', heuresTravaillees: 8, mode: 'geo_auto' }),
    registoEcran('p8', { chantierId: 'c2', chantierNom: 'Armazém Maia', date: '2026-11-13', mode: 'geo_auto' }),
  ],
  pointageAutoActive: true, reglageDisponible: true,
}
const CONTEXTO_GERENTE = {
  gerant: true, rattachement: 'aucun', moi: null, chantiers: [], pointageEnCours: null, pointagesOublies: [], historique: [],
  pointageAutoActive: false, reglageDisponible: true, comptes: { m1: 'actif', m2: 'invitation' }, affectationIndividuelle: true,
}
const REGISTOS = [
  { id: 'p1', employe: 'Rui Sousa', chantier: 'Moradia Gaia', date: '2026-11-17', heureArrivee: '08:00:00', heureDepart: '', heuresTravaillees: 0, mode: 'geo_auto' },
  { id: 'p2', employe: 'João Silva', chantier: 'Moradia Gaia', date: '2026-11-13', heureArrivee: '08:00:00', heureDepart: '', heuresTravaillees: 0, mode: 'manuel' },
  { id: 'p3', employe: 'João Silva', chantier: 'Moradia Gaia', date: '2026-11-12', heureArrivee: '08:00:00', heureDepart: '08:00:00', heuresTravaillees: 0, mode: 'geo_auto', notes: 'Départ non pointé : à régulariser.' },
  { id: 'p4', employe: 'Rui Sousa', chantier: 'Loja Aveiro', date: '2026-11-11', heureArrivee: '08:30:00', heureDepart: '13:00:00', heuresTravaillees: 4.5, mode: 'geo_auto', notes: 'Départ pointé à la main après une coupure du suivi GPS ; dernière présence vue sur le chantier à 09:05 : à vérifier.' },
  { id: 'p5', employe: 'Rui Sousa', chantier: 'Moradia Gaia', date: '2026-11-16', heureArrivee: '08:00:00', heureDepart: '17:00:00', heuresTravaillees: 8, mode: 'geo_confirme' },
]

const AUTOS = [
  { id: 's1', chantier: 'Moradia Gaia', chantier_id: 'c1', client: 'Ana Costa', numero: 1, date: '2026-11-01', montantMarche: 45000, travaux: [{ poste: 'Estrutura', quantite: 10, unite: 'm³', prixUnit: 300, avancement: 50 }, { poste: 'Pintura', quantite: 1, unite: 'forfait', prixUnit: 2000, avancement: 100 }], statut: 'envoyée' },
  { id: 's2', chantier: 'Moradia Gaia', chantier_id: 'c1', client: 'Ana Costa', numero: 2, date: '2026-11-15', montantMarche: 45000, travaux: [], statut: 'brouillon' },
]
const RETENCOES = [
  { id: 'r1', chantier: 'Moradia Gaia', client: 'Ana Costa', montantMarche: 45000, tauxRetenue: 5, montantRetenu: 2250, dateFinTravaux: '2026-01-10', statut: 'active', caution: false },
  { id: 'r2', chantier: 'Escola Braga', client: 'Câmara Municipal', montantMarche: 80000, tauxRetenue: 5, montantRetenu: 4000, dateFinTravaux: '2025-09-30', statut: 'mainlevée_demandée', caution: true },
  { id: 'r3', chantier: 'Loja Aveiro', client: 'Rita Lopes', montantMarche: 20000, tauxRetenue: 5, montantRetenu: 1000, dateFinTravaux: '2024-05-01', dateLiberation: '2025-05-02', statut: 'libérée', caution: false },
]

const oferta = (id: string, extra: Record<string, unknown>) => ({
  id, title: `Oferta ${id}`, description: 'Trabalhos de acabamento', category: 'carrelage', mission_type: 'sous_traitance_complete',
  location_city: 'Porto', deadline: '2026-11-30', urgency: 'normal', candidatures_count: 0, require_rc_pro: false,
  require_decennale: false, require_qualibat: false, status: 'open', created_at: '2026-11-10T09:00:00Z', ...extra,
})
const OFERTAS = [
  oferta('o1', { title: 'Assentamento de cerâmica 120 m²', location_postal: '4000-123', budget_min: 5000, budget_max: 8000, start_date: '2026-12-01', duration_text: '3 semanas', urgency: 'urgent', candidatures_count: 3, nb_intervenants_souhaite: 2, require_rc_pro: true, require_decennale: true, require_qualibat: true }),
  oferta('o2', { category: 'vrd', mission_type: 'renfort_equipe', budget_min: 3000, urgency: 'emergency', status: 'awarded' }),
  oferta('o3', { category: 'autre', budget_max: 2000, status: 'in_review' }),
  oferta('o4', { category: 'echafaudage', status: 'closed' }),
]
const candidatura = (id: string, extra: Record<string, unknown>) => ({
  id, artisan_id: `a-${id}`, artisan_user_id: `u-${id}`, price: 6500, timeline: '3 semanas', description: 'Equipa de dois ladrilhadores',
  materials_included: false, status: 'pending', created_at: '2026-11-12T09:00:00Z', ...extra,
})
const CANDIDATURAS = [
  candidatura('k1', { disponibilites: 'dezembro', experience_years: 12, artisan_company_name: 'Cerâmicas Silva', artisan_rating: 4.6, artisan_phone: '912345678', materials_included: true, profile: { city: 'Gaia', rc_pro_valid: true, decennale_valid: true, qualibat_valid: true } }),
  candidatura('k2', { status: 'accepted', experience_years: 5 }),
  candidatura('k3', { status: 'rejected', artisan_company_name: 'Obras Lima' }),
]

const linhaRentabilidade = (id: string, titre: string, statut: string, extra: Record<string, unknown>) => ({
  chantier_id: id, titre, client: 'Ana Costa', budget: 45000, date_debut: '2026-10-01', date_fin: '2026-11-10', statut,
  marge_prevue_pct: 20, tva_taux: 23, montant_facture: 30000, acompte_recu: 5000, penalite_retard_jour: 100, jours_prevu: 40,
  total_heures: 600, nb_ouvriers: 3, nb_jours_pointes: 30, cout_main_oeuvre_brut: 12000, cout_charges_patronales: 2800,
  cout_indemnites: 600, cout_main_oeuvre_total: 15400, total_materiaux: 9000, total_autres: 1500, total_depenses: 10500,
  cout_total: 25900, ca_reel: 30000, benefice_net: 4100, benefice_par_homme_jour: 45.55, perte_par_jour_retard: 520,
  detail_ouvriers: [], ...extra,
})
const RENTABILIDADE = [
  linhaRentabilidade('c1', 'Moradia Gaia', 'En cours', {}),
  linhaRentabilidade('c3', 'Escola Braga', 'Terminé', { ca_reel: 20000, montant_facture: 20000, cout_total: 26000, benefice_net: -6000, benefice_par_homme_jour: -20, date_debut: '2026-06-01', date_fin: '2026-09-30' }),
]
const MEMBROS_CONTAB = [
  { id: 'm1', prenom: 'João', nom: 'Silva', type_compte: 'chef_chantier', type_contrat: 'cdi', cout_horaire: 14, charges_pct: 24, panier_repas_jour: 8, indemnite_trajet_jour: 5 },
  { id: 'm2', prenom: 'Rui', nom: 'Sousa', type_compte: 'ouvrier', cout_horaire: 10 },
]
const ENCARGOS = [
  { id: 'f1', label: 'Renda do armazém', montant: 900, frequence: 'mensuel', categorie: 'loyer' },
  { id: 'f2', label: 'Seguro de responsabilidade civil', montant: 1200, frequence: 'annuel', categorie: 'rc_pro' },
  { id: 'f3', label: 'Contabilista', montant: 450, frequence: 'trimestriel', categorie: 'comptabilite' },
  { id: 'f4', label: 'Programa de faturação', montant: 30, frequence: 'mensuel', categorie: 'logiciel' },
]
// Taux de référence (même jeu que tests/lib/rentabilite/engine.test.ts).
const TAUX = [
  { id: '1', juridiction: 'FR', type_charge: 'cotisations_sociales', regime: 'auto_entrepreneur', taux: 22, seuil_min: null, seuil_max: null, date_debut_validite: '2026-01-01', date_fin_validite: null, source_reglementaire: 'URSSAF 2026', description: null },
  { id: '6', juridiction: 'PT', type_charge: 'tsu_patronal', regime: 'lda', taux: 23.75, seuil_min: null, seuil_max: null, date_debut_validite: '2026-01-01', date_fin_validite: null, source_reglementaire: 'Código dos Regimes Contributivos art. 53', description: null },
  { id: '7', juridiction: 'PT', type_charge: 'fct', regime: 'lda', taux: 1, seuil_min: null, seuil_max: null, date_debut_validite: '2026-01-01', date_fin_validite: null, source_reglementaire: 'Lei 70/2013', description: null },
  { id: '8', juridiction: 'PT', type_charge: 'irc_seuil_pme', regime: 'all', taux: 17, seuil_min: 0, seuil_max: 50000, date_debut_validite: '2026-01-01', date_fin_validite: null, source_reglementaire: 'CIRC art. 87 n.2', description: null },
  { id: '9', juridiction: 'PT', type_charge: 'irc_seuil_pme', regime: 'all', taux: 21, seuil_min: 50000.01, seuil_max: null, date_debut_validite: '2026-01-01', date_fin_validite: null, source_reglementaire: 'CIRC art. 87 n.1', description: null },
  { id: '10', juridiction: 'PT', type_charge: 'derrama_municipal', regime: 'all', taux: 1.5, seuil_min: null, seuil_max: null, date_debut_validite: '2026-01-01', date_fin_validite: null, source_reglementaire: 'Lei das Finanças Locais', description: null },
]
const routeurRentabilidade = async (url: string) => {
  if (url.includes('table=charges_fixes')) return json([])
  if (url.includes('table=chantiers')) return json({ chantiers: [
    { id: 'c1', titre: 'Moradia Gaia', client: 'Ana Costa', adresse: 'Rua das Flores 10', date_debut: '2026-10-01', date_fin: '2026-11-10', budget: 45000, statut: 'En cours' },
    { id: 'c3', titre: 'Escola Braga', client: 'Câmara Municipal', adresse: 'Av. Central 1', date_debut: '2026-06-01', date_fin: '2026-09-30', budget: 8000, statut: 'Terminé' },
  ] })
  if (url.includes('table=membres')) return json({ membres: [{ id: 'm1', prenom: 'João', nom: 'Silva', type_compte: 'chef_chantier' }] })
  if (url.includes('table=depenses')) return json({ depenses: [
    { id: 'x1', label: 'Cimento', amount: 3000, category: 'materiaux', date: '2026-10-05', chantier_id: 'c1' },
    { id: 'x2', label: 'Gasóleo', amount: 400, category: 'carburant', date: '2026-07-06', chantier_id: 'c3' },
  ] })
  if (url.includes('table=pointages')) return json({ pointages: [
    { id: 'p1', employe: 'João Silva', chantier: 'Moradia Gaia', chantier_id: 'c1', date: '2026-10-02', heures_travaillees: 8 },
    { id: 'p2', employe: 'Rui Sousa', chantier: 'Escola Braga', chantier_id: 'c3', date: '2026-07-02', heures_travaillees: 400 },
  ] })
  if (url.includes('table=situations')) return json({ situations: [
    { id: 's1', chantier: 'Moradia Gaia', chantier_id: 'c1', statut: 'validée', travaux: [{ poste: 'Estrutura', quantite: 10, unite: 'm³', prixUnit: 3000, avancement: 50 }] },
  ] })
  return json({})
}

// ── Scénarios partagés FR / PT : chaque `etape` relève un état de l'écran ──
const SCENARIOS: Record<string, Scenario> = {
  async servicos(langue, etape) {
    localStorage.setItem('fixit_prestations_btp_v5_art-1', JSON.stringify(CATALOGO))
    const c = monter(langue, <PrestationsBTPSection artisan={ARTISAN} orgRole="pro_societe" />)
    await pause()
    etape('lista', c)
    cliquer(c.querySelectorAll('.prest-lot-tab')[1]); await pause()
    etape('lote-vazio', c)
    cliquer(c.querySelectorAll('.prest-lot-tab')[0])
    cliquer(c.querySelectorAll('.prest-cat-btn')[1]); await pause()
    etape('materiais', c)
    cliquer(c.querySelectorAll('.prest-cat-btn')[2]); await pause()
    etape('despesas', c)
    cliquer(c.querySelectorAll('.prest-cat-btn')[0]); await pause()
    cliquer(c.querySelector('.prest-top .v5-btn-p')); await pause()
    cliquer(c.querySelector('.prest-modal .prest-range-toggle input')); await pause()
    etape('novo-servico', c)
    cliquer(c.querySelector('.prest-footer .v5-btn')); await pause()
    cliquer(c.querySelectorAll('.prest-cat-btn')[1]); await pause()
    cliquer(c.querySelector('tbody .v5-btn.v5-btn-sm')); await pause()
    etape('editar-material', c)
  },

  async obras(langue, etape) {
    etat.reglages = reglagesPour(langue)
    etat.tables.chantiers = OBRAS
    etat.supa = { devis: ORCAMENTOS, factures: FATURAS }
    etat.routeur = async url => (url.startsWith('/api/btp?table=membres') ? json({ membres: MEMBROS_API }) : json({}))
    const c = monter(langue, <ChantiersBTPV2 artisan={ARTISAN} orgRole="pro_societe" />)
    await pause(120)
    etape('lista', c)
    cliquer([...c.querySelectorAll('button.v5-btn-d')].find(b => !b.closest('table'))); await pause()
    etape('prolongar', c)
    fermerModale(c); await pause()
    cliquer(c.querySelector('tbody button.v5-btn-d')); await pause()
    etape('eliminar', c)
    fermerModale(c); await pause()
    cliquer(c.querySelector('.v5-search .v5-btn-p')); await pause(120)
    etape('nova', c)
    saisir(c.querySelector('div[style*="position: fixed"] select'), 'd1'); await pause()
    cliquer(c.querySelector('div[style*="position: fixed"] input[type="checkbox"]')); await pause()
    etape('nova-importada', c, etat.toasts)
    fermerModale(c); await pause()
    cliquer(c.querySelector('tbody button.v5-btn-sm:not(.v5-btn-d)')); await pause(120)
    etape('editar', c)
    fermerModale(c); await pause()
    cliquer([...c.querySelectorAll('button')].find(b => b.style.fontSize === '10px' && (b.textContent ?? '').startsWith('+'))); await pause()
    etape('associar', c)
    cliquer(c.querySelector('div[style*="position: fixed"] button.v5-btn:not(.v5-btn-sm)')); await pause()
    etape('associado', c, etat.toasts)
  },

  async equipas(langue, etape) {
    etat.reglages = reglagesPour(langue)
    etat.tables.membres = MEMBROS
    etat.tables.equipes = EQUIPAS
    const c = monter(langue, <EquipesBTPV2 artisan={ARTISAN} orgRole="pro_societe" />)
    await pause()
    etape('membros', c)
    cliquer(c.querySelectorAll('.v5-tabs button')[1]); await pause()
    etape('equipas', c)
    cliquer(c.querySelector('.v5-sg2 .v5-card')); await pause()
    etape('equipa-modal', c)
    fermerModale(c); await pause()
    cliquer(c.querySelectorAll('.v5-tabs button')[0]); await pause()
    cliquer(c.querySelectorAll('tbody tr')[0].querySelector('button')); await pause()
    etape('membro-financas', c)
    saisir(c.querySelectorAll('div[style*="position: fixed"] input[step="50"]')[1], '1200'); await pause()
    etape('membro-avisos', c)
    fermerModale(c); await pause()
    cliquer(c.querySelectorAll('tbody tr')[1].querySelectorAll('button')[2]); await pause()
    etape('eliminar', c)
  },

  // Gérant d'une société française (réglages du pays absents ou « FR ») : la classification du droit français s'affiche.
  async gerente(langue, etape) {
    etat.reglages = REGLAGES_FR
    etat.tables.membres = MEMBROS
    etat.tables.equipes = EQUIPAS
    const c = monter(langue, <EquipesBTPV2 artisan={ARTISAN} orgRole="pro_societe" />)
    await pause()
    cliquer(c.querySelector('.v5-pg-t .v5-btn-p')); await pause()
    saisir(c.querySelector('div[style*="position: fixed"] select'), 'gerant'); await pause()
    etape('gerente-maioritario', c)
    saisir(c.querySelector('div[style*="position: fixed"] input[max="100"]'), '50'); await pause()
    etape('gerente-igualitario', c)
  },

  async gantt(langue, etape) {
    etat.tables.chantiers = OBRAS
    localStorage.setItem('gantt_subtasks_art-1', JSON.stringify(SUBTAREFAS))
    const c = monter(langue, <GanttSection userId="art-1" orgRole="pro_societe" />)
    await pause()
    etape('grafico', c)
    cliquer(c.querySelector('.v5-pg-t .v5-btn-p')); await pause()
    etape('formulario', c)
  },

  async ganttVazio(langue, etape) {
    etat.tables.chantiers = []
    localStorage.removeItem('gantt_subtasks_art-1')
    const c = monter(langue, <GanttSection userId="art-1" orgRole="pro_societe" />)
    await pause()
    etape('vazio', c)
  },

  async registoColaborador(langue, etape) {
    etat.routeur = async (url, init) => (init?.method === 'POST' ? json({ pointage: null }, 201) : json(CONTEXTO_COLABORADOR))
    const c = monter(langue, <PointageGeoSection artisan={ARTISAN} orgRole="pro_societe" />)
    await pause(80)
    etape('colaborador', c)
    cliquer(c.querySelector('button.v5-btn-d')); await pause(80)
    etape('terminado', c, etat.toasts)
  },

  async registoSemFicha(langue, etape) {
    etat.routeur = async () => json({ ...CONTEXTO_COLABORADOR, rattachement: 'aucun', moi: null, chantiers: [] })
    const c = monter(langue, <PointageGeoSection artisan={ARTISAN} orgRole="pro_societe" />)
    await pause(80)
    etape('sem-ficha', c)
  },

  async registoGerente(langue, etape) {
    etat.routeur = async () => json(CONTEXTO_GERENTE)
    etat.tables.chantiers = OBRAS
    etat.tables.membres = [{ id: 'm1', prenom: 'João', nom: 'Silva', actif: true, typeCompte: 'chef_chantier' }, { id: 'm2', prenom: 'Rui', nom: 'Sousa', actif: true, typeCompte: 'ouvrier' }]
    etat.tables.equipes = [{ id: 'e1', nom: 'Equipa Alvenaria A', chantierId: 'c2' }]
    etat.tables.pointages = REGISTOS
    const c = monter(langue, <PointageGeoSection artisan={ARTISAN} orgRole="pro_societe" />)
    await pause(80)
    etape('gerente', c)
    cliquer(c.querySelectorAll('.v5-tabs button')[1]); await pause()
    etape('atribuicoes', c)
    cliquer(c.querySelectorAll('.v5-tabs button')[2]); await pause()
    etape('historico', c)
    cliquer(c.querySelector('.v5-search button')); await pause()
    etape('historico-tudo', c)
    cliquer(c.querySelector('button.v5-btn.v5-btn-p')); await pause()
    etape('historico-formulario', c)
    cliquer(c.querySelector('table.v5-dt + div > button')); await pause()
    const ficheiros = await lireFichiers()
    etape('csv', c, ficheiros.flatMap(f => [f.nom, f.contenu]))
  },

  async registoAntigo(langue, etape) {
    localStorage.setItem('pointage_art-1', JSON.stringify([{ id: 'x1', employe: 'Rui Sousa', poste: 'Pedreiro', chantier: 'Moradia Gaia', date: '2026-11-17', heureArrivee: '08:00', heureDepart: '17:00', pauseMinutes: 60, heuresTravaillees: 8, notes: '' }]))
    const c = monter(langue, <PointageEquipesSection userId="art-1" orgRole="pro_societe" />)
    await pause()
    etape('lista', c)
    cliquer(c.querySelector('.v5-pg-t button')); await pause()
    etape('formulario', c)
  },

  async autos(langue, etape) {
    etat.tables.situations = AUTOS
    etat.tables.chantiers = OBRAS
    const c = monter(langue, <SituationsTravaux userId="art-1" orgRole="pro_societe" />)
    await pause()
    etape('lista', c)
    cliquer(c.querySelector('.v5-sg2 > div:first-child .v5-card')); await pause()
    etape('detalhe', c)
    cliquer(c.querySelector('.v5-pg-t button')); await pause()
    etape('formulario', c)
  },

  async autosVazio(langue, etape) {
    etat.tables.situations = []
    const c = monter(langue, <SituationsTravaux userId="art-1" orgRole="pro_societe" />)
    await pause()
    etape('vazio', c)
  },

  async retencoes(langue, etape) {
    etat.tables.retenues = RETENCOES
    etat.tables.chantiers = OBRAS
    const c = monter(langue, <RetenuesGarantieSection userId="art-1" orgRole="pro_societe" />)
    await pause()
    etape('lista', c)
    cliquer(c.querySelector('.v5-pg-t button')); await pause()
    saisir(c.querySelector('.v5-fr input[type="number"]'), '10000'); await pause()
    etape('formulario', c)
  },

  async obrasAntigo(langue, etape) {
    localStorage.setItem('fixit_chantiers_art-1', JSON.stringify(OBRAS))
    const c = monter(langue, <ChantiersBTPSection artisan={ARTISAN} bookings={[]} orgRole="pro_societe" />)
    await pause()
    etape('lista', c)
    cliquer(c.querySelector('.v5-pg-t button')); await pause()
    etape('modal', c)
  },

  async portal(langue, etape) {
    etat.tables.chantiers = OBRAS
    localStorage.setItem('fixit_portal_states_art-1', JSON.stringify({ 'Ana Costa': true }))
    const c = monter(langue, <PortailClientSection userId="u1" artisanId="art-1" orgRole="pro_societe" />)
    await pause()
    etape('lista', c)
    cliquer(c.querySelector('.v5-card > div[style*="cursor: pointer"]')); await pause()
    etape('detalhe', c)
  },

  async recrutar(langue, etape) {
    etat.routeur = async (url, init) => {
      if (init?.method === 'PATCH') return json({})
      if (url.includes('offer_id=')) return json({ candidatures: CANDIDATURAS })
      if (url.startsWith('/api/marches/sous-traitance')) return json({ offers: OFERTAS })
      return json({})
    }
    const c = monter(langue, <SousTraitanceOffresSection artisan={ARTISAN} orgRole="pro_societe" />)
    await pause()
    etape('anuncios', c)
    cliquer(c.querySelectorAll('.v5-tabs button')[1]); await pause()
    etape('publicar', c)
    cliquer([...c.querySelectorAll('.v5-card button.v5-btn-p')].at(-1)); await pause()
    etape('publicar-erro', c)
    cliquer(c.querySelectorAll('.v5-tabs button')[0]); await pause()
    cliquer(c.querySelector('.v5-card button.v5-btn-p.v5-btn-sm')); await pause()
    etape('candidaturas', c)
    cliquer(c.querySelector('button.v5-btn-s.v5-btn-sm')); await pause()
    etape('candidatura-aceite', c)
  },

  async recrutarErro(langue, etape) {
    etat.routeur = async () => json({ error: 'indisponível' }, 500)
    const c = monter(langue, <SousTraitanceOffresSection artisan={ARTISAN} orgRole="pro_societe" />)
    await pause()
    etape('erro', c)
  },

  async contabilidade(langue, etape) {
    etat.reglages = REGLAGES_FR
    etat.routeur = async url => {
      if (url.includes('table=rentabilite')) return json({ rentabilite: RENTABILIDADE })
      if (url.includes('table=membres')) return json({ membres: MEMBROS_CONTAB })
      if (url.includes('table=charges_fixes')) return json({ charges_fixes: ENCARGOS })
      return json({})
    }
    const c = monter(langue, <ComptaBTPSection artisan={ARTISAN} orgRole="pro_societe" />)
    await pause()
    etape('painel', c)
    cliquer(c.querySelector('tbody tr')); await pause()
    saisir(c.querySelectorAll('input[type="range"]')[0], '3')
    saisir(c.querySelectorAll('input[type="range"]')[1], '2'); await pause()
    etape('detalhe-simulador', c)
    cliquer(c.querySelectorAll('.v5-tabs button')[1]); await pause()
    etape('perfil', c)
    cliquer(c.querySelectorAll('.v5-tabs button')[2]); await pause()
    etape('equipa', c)
    cliquer(c.querySelectorAll('.v5-tabs button')[3]); await pause()
    etape('encargos', c)
  },

  async rentabilidade(langue, etape) {
    etat.reglages = reglagesPour(langue)
    etat.supa = { ref_taux: TAUX }
    etat.routeur = routeurRentabilidade
    const c = monter(langue, <RentabiliteChantierSection artisan={ARTISAN} orgRole="pro_societe" />)
    await pause(120)
    etape('visao-geral', c)
    cliquer(c.querySelector('button.v5-btn')); await pause()
    etape('custos-hora', c)
    cliquer(c.querySelector('button.v5-btn')); await pause()
    cliquer(c.querySelector('.v5-card[style*="border-left"] > div')); await pause()
    saisir(c.querySelectorAll('input[type="range"]')[0], '5')
    saisir(c.querySelectorAll('input[type="range"]')[1], '1')
    saisir(c.querySelector('.v5-fg input[type="number"]'), '500'); await pause()
    etape('detalhe', c)
  },
}

/** Joue un scénario en portugais : écarts relevés à chaque étape, textes et copie de l'écran gardés pour les vérifications. */
async function jouerEnPortugais(nom: keyof typeof SCENARIOS) {
  const ecarts: string[] = []
  const textes: Record<string, string> = {}
  const conteneurs: Record<string, HTMLElement> = {}
  await SCENARIOS[nom]('pt', (etape, c, autres = []) => {
    ecarts.push(...ecartsPortugais(c, autres).map(e => `${etape} : ${e}`))
    textes[etape] = texte(c)
    conteneurs[etape] = c.cloneNode(true) as HTMLElement
  })
  return { ecarts, textes, conteneurs }
}

describe('modules BTP (vague 2) du tableau de bord pro en portugais (pt-PT)', () => {
  it('Serviços : catalogue, lots, unités et fourchettes en portugais, sans « Prestações » ni tiret', async () => {
    const { ecarts, textes } = await jouerEnPortugais('servicos')
    expect(ecarts).toEqual([])
    expect(textes.lista).toContain('Catálogo de serviços e materiais: é o que os seus clientes veem')
    expect(textes.lista).toContain('Estrutura e alvenaria')
    expect(textes.lista).toContain('55 € a 75 € / m²')
    expect(textes.lista).toContain('2500 €')
    expect(textes.lista).toContain('Adicionar um serviço (Estrutura e alvenaria)')
    expect(textes['lote-vazio']).toContain('Nenhum serviço neste lote.')
    expect(textes.materiais).toContain('saco')
    expect(textes.despesas).toContain('45 € a 60 € / dia')
    expect(textes['novo-servico']).toContain('Novo serviço')
    expect(textes['novo-servico']).toContain('Descrição do serviço')
    expect(textes['novo-servico']).toContain('Mín.')
    expect(textes['editar-material']).toContain('Preço')
  })

  it('Serviços : unités enregistrées en français affichées en portugais, valeur du formulaire inchangée', async () => {
    localStorage.setItem('fixit_prestations_btp_v5_art-1', JSON.stringify(CATALOGO))
    const c = monter('pt', <PrestationsBTPSection artisan={ARTISAN} orgRole="pro_societe" />)
    await pause()
    expect([...c.querySelectorAll('.prest-unit')].map(e => e.textContent)).toEqual(['m²', 'vg', 'pç'])
    cliquer(c.querySelectorAll('tbody .v5-btn.v5-btn-sm:not(.v5-btn-d)')[1]); await pause()
    const unidade = c.querySelectorAll('.prest-modal select')[2] as HTMLSelectElement
    expect(unidade.value).toBe('forfait')
    expect(unidade.selectedOptions[0].textContent).toBe('vg')
  })

  it('Obras : liste, documents associés, rentabilité, modales et messages en portugais', async () => {
    const { ecarts, textes, conteneurs } = await jouerEnPortugais('obras')
    expect(ecarts).toEqual([])
    expect(textes.lista).toContain('Gestão das suas obras: 2 ativa(s)')
    expect([...conteneurs.lista.querySelectorAll('thead th')].map(e => e.textContent)).toEqual(
      ['Ref.', 'Obra', 'Cliente', 'Encarregado', 'Início', 'Fim', 'Avanço', 'Estado', 'Valor', ''])
    expect(textes.lista).toContain('Moradia Gaia: Documentos associados')
    expect(textes.lista).toContain('Aceite')
    expect(textes.lista).toContain('Paga')
    expect(textes.lista).toMatch(/\d+ dias de atraso = -/)
    expect(textes.prolongar).toContain('A sua obra terminou?')
    // Du 01/10 au 10/11, les deux inclus : 41 jours (l'ancien calcul oubliait le dernier jour, 28/11/2026).
    expect(textes.prolongar).toContain('Moradia Gaia · Previsto: 41 dias')
    // Rentabilité hors IVA, détail du calcul et équipe jour par jour (28/11/2026).
    expect(textes.lista).toMatch(/Moradia Gaia: \+[\d\s]+ € s\/ IVA/)
    expect(textes.lista).toContain('Materiais 6750 € (estimativa 15%)')
    // 29 jours ouvrés du 01/10 au 10/11, moins le 5 octobre (Implantação da República, férié national) : 28.
    expect(textes.lista).toMatch(/Mão de obra \d+ € \(28 dias de trabalho\)/)
    expect(textes.editar).toContain('Equipa por dia')
    expect(textes.editar).toContain('Despesas da obra (s/ IVA)')
    expect(textes.nova).toContain('Despesas da obra: crie a obra e depois abra-a')
    // Feriado nacional na obra (5 de outubro, Implantação da República) : chômé et nommé.
    expect(textes.editar).toContain('Feriado: Implantação da República')
    expect(textes.prolongar).toContain('Prolongar por 2 dias')
    expect(textes.eliminar).toContain('Tem a certeza de que pretende eliminar esta obra?')
    expect(textes.nova).toContain('Selecionar um orçamento...')
    expect(textes.nova).toContain('ORC-2026-014 · Ana Costa')
    expect(textes.nova).toContain('Raio do registo de ponto (GPS)')
    expect(textes['nova-importada']).toContain('1 colaborador(es) selecionado(s) · Custo/dia: ')
    expect(textes['nova-importada']).toContain('Operário')
    expect(textes.editar).toContain('GPS: 41.15000, -8.61000')
    expect(textes.editar).toContain('150 m')
    expect(textes.associar).toContain('Associar um orçamento a esta obra')
    expect(textes.associar).toContain('Rascunho')
    expect(etat.toasts).toContain('Orçamento associado à obra')
  })

  it('Obras : orçamento importado, título por defeito em português', async () => {
    etat.reglages = REGLAGES_PT
    etat.tables.chantiers = []
    etat.supa = { devis: [{ ...ORCAMENTOS[1] }] }
    const c = monter('pt', <ChantiersBTPV2 artisan={ARTISAN} orgRole="pro_societe" />)
    await pause(120)
    cliquer(c.querySelector('.v5-btn.v5-btn-p')); await pause(120)
    saisir(c.querySelector('div[style*="position: fixed"] select'), 'd2'); await pause()
    expect((c.querySelector('div[style*="position: fixed"] input.v5-fi') as HTMLInputElement).value).toBe('Orçamento ORC-2026-015')
  })

  it('Equipas : funções, contratos, custos, equipas e modais em português', async () => {
    const { ecarts, textes } = await jouerEnPortugais('equipas')
    expect(ecarts).toEqual([])
    for (const papel of ['Encarregado', 'Operário', 'Administrativo(a)', 'Diretor de obra', 'Gerente']) expect(textes.membros).toContain(papel)
    expect(textes.membros).toContain('40 h/sem.')
    expect(textes.membros).toContain('12 €')
    expect(textes.equipas).toContain('João Silva, encarregado · 2 membros')
    expect(textes.equipas).toContain('Infraestruturas e redes')
    expect(textes.equipas).toContain('Alvenaria')
    expect(textes.equipas).toContain('Custo/h: ')
    expect(textes['equipa-modal']).toContain('Custo real total/h: ')
    expect(textes['membro-financas']).toContain('Modo automático: preencha o LÍQUIDO ou o BRUTO')
    expect(textes['membro-financas']).toContain('Custo/hora (total):')
    // Entreprise portugaise (réglage « pays » PT) : aucune comparaison au salaire minimum français.
    expect(textes['membro-avisos'] ?? '').not.toContain('salário mínimo')
    expect(textes.eliminar).toContain('Tem a certeza de que pretende eliminar?')
  })

  it('Equipas : gerente de uma sociedade francesa, classificação traduzida sem regra portuguesa inventada', async () => {
    const { ecarts, textes } = await jouerEnPortugais('gerente')
    expect(ecarts).toEqual([])
    expect(textes['gerente-maioritario']).toContain('Gerente maioritário: trabalhador independente')
    expect(textes['gerente-maioritario']).toContain('Código Comercial francês')
    expect(textes['gerente-maioritario']).toContain('Sem recibo de vencimento')
    expect(textes['gerente-igualitario']).toContain('segurança social francesa')
  })

  it('Equipas : especialidade enregistrée inchangée, libellé corrigé à l’affichage', async () => {
    etat.reglages = REGLAGES_PT
    etat.tables.membres = MEMBROS
    etat.tables.equipes = EQUIPAS
    const c = monter('pt', <EquipesBTPV2 artisan={ARTISAN} orgRole="pro_societe" />)
    await pause()
    cliquer(c.querySelectorAll('.v5-tabs button')[1]); await pause()
    cliquer(c.querySelector('.v5-sg2 .v5-card')); await pause()
    const especialidade = c.querySelectorAll('div[style*="position: fixed"] select')[0] as HTMLSelectElement
    expect(especialidade.value).toBe('Infraestruturas / VRD')
    expect(especialidade.selectedOptions[0].textContent).toBe('Infraestruturas e redes')
  })

  it('Planeamento Gantt : sous-titre, légende, tableau et formulaire sans tiret ni « estaleiro »', async () => {
    const { ecarts, textes } = await jouerEnPortugais('gantt')
    expect(ecarts).toEqual([])
    expect(textes.grafico).toMatch(/Vista geral das obras: SET → MAR 2027/)
    expect(textes.grafico).toContain('Linha vermelha = avanço real da obra')
    expect(textes.grafico).toContain('Losango = marco principal')
    const vazio = await jouerEnPortugais('ganttVazio')
    expect(vazio.ecarts).toEqual([])
    expect(vazio.textes.vazio).toContain('Crie obras com datas no módulo Obras')
  })

  it('Registo de horas : écran du colaborador (registo automático, obras, registos) et fim manual', async () => {
    const { ecarts, textes, conteneurs } = await jouerEnPortugais('registoColaborador')
    expect(ecarts).toEqual([])
    expect(textes.colaborador).toContain('Registo de horas')
    expect(textes.colaborador).toContain('Registo em curso')
    expect(textes.colaborador).toContain('Registo automático')
    expect(textes.colaborador).toContain('Registo manual em curso: o registo automático retoma depois de o terminar.')
    expect(textes.colaborador).toContain('Os meus registos (31 dias)')
    expect(textes.colaborador).toContain('Saída não registada')
    expect([...conteneurs.colaborador.querySelectorAll('button[aria-label]')].map(b => b.getAttribute('aria-label')))
      .toEqual(['No local (Moradia Gaia)', 'Registar aqui (Armazém Maia)'])
    expect(etat.toasts).toContain('Saída registada')
    const semFicha = await jouerEnPortugais('registoSemFicha')
    expect(semFicha.ecarts).toEqual([])
    expect(semFicha.textes['sem-ficha']).toContain('Registar as minhas horas')
  })

  it('Registo de horas : gerente (atribuições, histórico, registo manual, exportação CSV)', async () => {
    const { ecarts, textes, conteneurs } = await jouerEnPortugais('registoGerente')
    expect(ecarts).toEqual([])
    expect([...conteneurs.gerente.querySelectorAll('.v5-tabs button')].map(b => b.textContent)).toEqual(['Registar ponto', 'Atribuições', 'Histórico'])
    expect(textes.atribuicoes).toContain('Registo automático (GPS)')
    expect(textes.atribuicoes).toContain('abre « Registo de horas » no menu')
    expect([...conteneurs.atribuicoes.querySelectorAll('[aria-label]')].map(b => b.getAttribute('aria-label'))).toEqual(
      expect.arrayContaining(['Ver no mapa (Moradia Gaia)', 'Colocar na minha posição atual (Moradia Gaia)', 'Colocar na minha posição atual (Loja Aveiro)']))
    expect(textes['historico-tudo']).toContain('A regularizar')
    expect(textes['historico-tudo']).toContain('Saída não registada')
    expect(textes['historico-tudo']).toContain('5 registo(s) · ')
    const titulos = [...conteneurs['historico-tudo'].querySelectorAll('.v5-badge[title]')].map(b => b.getAttribute('title'))
    expect(titulos).toEqual([
      'Saída não registada: a regularizar.',
      'Saída registada manualmente após uma interrupção do acompanhamento GPS; última presença registada na obra às 09:05: a verificar.',
    ])
    expect(textes['historico-formulario']).toContain('Novo registo')
    expect(textes['historico-formulario']).toContain('Notas')
    expect(textes['historico-formulario']).toContain('Horas: 8 h 00')
    const [csv] = await lireFichiers()
    expect(csv.nom).toBe('registos_de_horas_2026-11-17.csv')
  })

  it('Registo de horas : função enregistrée inchangée (« Chefe de obra »), libellé « Encarregado »', async () => {
    etat.routeur = async () => json(CONTEXTO_GERENTE)
    etat.tables.pointages = []
    etat.tables.membres = []
    const c = monter('pt', <PointageGeoSection artisan={ARTISAN} orgRole="pro_societe" />)
    await pause(80)
    cliquer(c.querySelectorAll('.v5-tabs button')[2]); await pause()
    cliquer(c.querySelector('button.v5-btn.v5-btn-p')); await pause()
    const funcao = c.querySelector('#pointage-poste') as HTMLSelectElement
    expect([...funcao.options].map(o => o.textContent)).toContain('Encarregado')
    saisir(funcao, 'Chefe de obra')
    saisir(c.querySelector('#pointage-employe'), 'Rui Sousa')
    cliquer([...c.querySelectorAll('button.v5-btn.v5-btn-p')].at(-1)); await pause()
    expect(etat.ajouts.at(-1)?.objet).toEqual(expect.objectContaining({ poste: 'Chefe de obra', employe: 'Rui Sousa' }))
  })

  it('Registo de horas (écran d’origine, non affiché par la page) : clés de locales/pt.json sans calque', async () => {
    const { ecarts, textes } = await jouerEnPortugais('registoAntigo')
    expect(ecarts).toEqual([])
    expect(textes.lista).toContain('1 registo(s) · 8.0 h')
    expect(textes.formulario).toContain('Colaborador *')
    expect(textes.formulario).toContain('Encarregado')
  })

  it('Autos de medição : liste, détail (estados, unidades), formulaire et sélecteur de obra', async () => {
    const { ecarts, textes, conteneurs } = await jouerEnPortugais('autos')
    expect(ecarts).toEqual([])
    expect(textes.lista).toContain('Autos de medição')
    expect(textes.lista).toContain('+ Novo auto de medição')
    expect(textes.lista).toContain('Auto de medição n.º 1')
    expect(textes.lista).toContain('Selecione um auto de medição')
    expect(textes.detalhe).toContain('Auto de medição n.º 1 · Moradia Gaia')
    expect([...conteneurs.detalhe.querySelectorAll('.v5-tabs button')].map(b => b.textContent)).toEqual(['rascunho', 'enviado', 'validado', 'pago'])
    expect([...conteneurs.detalhe.querySelectorAll('tbody td:nth-child(3)')].map(e => e.textContent)).toEqual(['m³', 'vg'])
    const opcoes = [...conteneurs.formulario.querySelectorAll('.v5-card select option')].map(o => o.textContent)
    expect(opcoes.slice(0, 3)).toEqual(['Selecionar uma obra...', 'Moradia Gaia · Ana Costa', 'Armazém Maia · Construções Norte, Lda'])
    const vazio = await jouerEnPortugais('autosVazio')
    expect(vazio.ecarts).toEqual([])
    expect(vazio.textes.vazio).toContain('Crie o seu primeiro auto de medição')
  })

  it('Retenções para garantia : estados enregistrés en français affichés en portugais', async () => {
    const { ecarts, textes } = await jouerEnPortugais('retencoes')
    expect(ecarts).toEqual([])
    expect(textes.lista).toContain('Retenções para garantia')
    for (const estado of ['Em curso', 'Libertação pedida', 'Libertada']) expect(textes.lista).toContain(estado)
    expect(textes.formulario).toContain('Nova retenção para garantia')
  })

  it('Obras (écran d’origine, non affiché par la page), Portal cliente : textes et estados en portugais', async () => {
    const antigo = await jouerEnPortugais('obrasAntigo')
    expect(antigo.ecarts).toEqual([])
    expect(antigo.textes.modal).toContain('Valor s/ IVA (€)')
    const portal = await jouerEnPortugais('portal')
    expect(portal.ecarts).toEqual([])
    expect(portal.textes.lista).toContain('Progresso: barra de avanço por lote')
    expect(portal.textes.lista).toContain('Autos de medição: consulta e validação')
    expect(portal.textes.detalhe).toContain('Em curso')
    expect(portal.textes.detalhe).toContain('Copiar link de acesso')
  })

  it('Recrutar subempreiteiros : anúncios, formulário, erros e candidaturas em português (langue de l’interface)', async () => {
    const { ecarts, textes } = await jouerEnPortugais('recrutar')
    expect(ecarts).toEqual([])
    expect(textes.anuncios).toContain('Os meus anúncios')
    for (const t of ['Aberta', 'Adjudicada', 'Em análise', 'Encerrada', 'Urgente', 'Emergência', 'Subempreitada completa', 'Reforço de equipa']) expect(textes.anuncios).toContain(t)
    expect(textes.anuncios).toContain('Arruamentos e redes')
    expect(textes.anuncios).toContain('5 000 a 8 000 €')
    expect(textes.anuncios).toContain('Ver candidaturas (3)')
    expect(textes.anuncios).toContain('Seguro decenal exigido')
    expect(textes.publicar).toContain('Título da missão *')
    expect(textes['publicar-erro']).toContain('Preencha os campos obrigatórios: título, descrição, cidade, data limite.')
    expect(textes.candidaturas).toContain('Preço: 6 500 € (materiais incluídos)')
    for (const t of ['Pendente', 'Aceite', 'Recusada', 'Aceitar', 'Recusar', 'Contactar', '12 anos']) expect(textes.candidaturas).toContain(t)
    expect(textes['candidatura-aceite']).toContain('Candidatura aceite')
    const erro = await jouerEnPortugais('recrutarErro')
    expect(erro.ecarts).toEqual([])
    expect(erro.textes.erro).toContain('Não foi possível carregar os seus anúncios')
  })

  it('Contabilidade IA : painel, detalhe, simulador, perfil, equipa e encargos em português', async () => {
    const { ecarts, textes } = await jouerEnPortugais('contabilidade')
    expect(ecarts).toEqual([])
    expect(textes.painel).toContain('Contabilidade inteligente da construção')
    expect(textes.painel).toContain('Faturação s/ IVA acumulada')
    expect(textes.painel).toContain('Repartição por obra')
    expect(textes['detalhe-simulador']).toContain('3 dias de atraso = ')
    expect(textes['detalhe-simulador']).toContain('Margem: ')
    expect(textes.perfil).toContain('Contribuições patronais')
    expect(textes.perfil).toContain('Regime real normal')
    expect(textes.perfil).toMatch(/3\s?000 € líquido/)
    expect(textes.perfil).toContain('Por dia útil (22 dias)')
    expect(textes.equipa).toContain('Encarregado')
    expect(textes.equipa).toContain('CTI (sem termo)')
    expect(textes.equipa).toContain('Custo real/dia (8 h)')
    expect(textes.encargos).toContain('Seguro decenal não registado: é obrigatório na construção em França.')
    for (const t of ['renda', 'anual', 'trimestral', 'software']) expect(textes.encargos).toContain(t)
  })

  it('Rentabilidade : visão geral, motor de rentabilidade, detalhe e simulador em português', async () => {
    const { ecarts, textes } = await jouerEnPortugais('rentabilidade')
    expect(ecarts).toEqual([])
    expect(textes['visao-geral']).toContain('Rentabilidade das obras')
    expect(textes['visao-geral']).toContain('Faturação total')
    expect(textes['visao-geral']).toContain('Esta obra rendeu-lhe')
    expect(textes['visao-geral']).toContain('Líquido no seu bolso')
    expect(textes['custos-hora']).toContain('Custo horário por função (€/h)')
    expect(textes['custos-hora']).toContain('Administrativo(a)')
    expect(textes.detalhe).toMatch(/Limiar de rentabilidade: \d+ dias/)
    expect(textes.detalhe).toContain('Pontuação')
  })
})

describe('les mêmes modules en français : textes inchangés', () => {
  async function jouerEnFrancais(nom: keyof typeof SCENARIOS) {
    const textes: Record<string, string> = {}
    const conteneurs: Record<string, HTMLElement> = {}
    await SCENARIOS[nom]('fr', (etape, c) => { textes[etape] = texte(c); conteneurs[etape] = c.cloneNode(true) as HTMLElement })
    return { textes, conteneurs }
  }

  it('Prestations, Chantiers, Équipes, Gantt', async () => {
    expect((await jouerEnFrancais('servicos')).textes.lista).toContain('Catalogue de prestations et matériaux — c\'est ce que vos clients voient')
    const chantiers = await jouerEnFrancais('obras')
    expect(chantiers.textes.lista).toContain('Gestion de vos chantiers — 2 actif(s)')
    expect(chantiers.textes.lista).toContain('Moradia Gaia — Devis et factures liés')
    expect(chantiers.textes['nova-importada']).toContain('1 employé(s) sélectionné(s)— Coût/j: ')
    expect(chantiers.textes.editar).toContain('GPS : 41.15000, -8.61000')
    const equipes = await jouerEnFrancais('equipas')
    expect(equipes.textes.equipas).toContain('João Silva, chef — 2 personnes')
    expect(equipes.textes['membro-financas']).toContain('Coût/heure (total) :')
    // Entreprise française (réglage « pays » FR) : l'alerte du SMIC reste affichée.
    expect(equipes.textes['membro-avisos']).toContain('Salaire en dessous du SMIC brut 2025 (1 747€)')
    expect((await jouerEnFrancais('gantt')).textes.grafico).toContain('Vue d\'ensemble des chantiers — SEPT → MARS 2027')
  })

  it('Pointage, Situations, Retenues, sélecteur de chantier', async () => {
    const employe = await jouerEnFrancais('registoColaborador')
    expect([...employe.conteneurs.colaborador.querySelectorAll('button[aria-label]')].map(b => b.getAttribute('aria-label')))
      .toEqual(['Sur place — Moradia Gaia', 'Pointer ici — Armazém Maia'])
    const gerant = await jouerEnFrancais('registoGerente')
    expect(gerant.textes['historico-tudo']).toContain('5 pointage(s) — ')
    expect(gerant.textes['historico-formulario']).toContain('Heures : 8 h 00')
    const situations = await jouerEnFrancais('autos')
    expect(situations.textes.detalhe).toContain('Situation n°1 — Moradia Gaia')
    expect([...situations.conteneurs.detalhe.querySelectorAll('.v5-tabs button')].map(b => b.textContent)).toEqual(['brouillon', 'envoyée', 'validée', 'payée'])
    expect([...situations.conteneurs.formulario.querySelectorAll('.v5-card select option')].map(o => o.textContent).slice(0, 2))
      .toEqual(['Sélectionner un chantier...', 'Moradia Gaia — Ana Costa'])
    expect((await jouerEnFrancais('retencoes')).textes.lista).toContain('Mainlevée demandée')
  })

  it('Recrutement, Compta, Rentabilité', async () => {
    const recrutement = await jouerEnFrancais('recrutar')
    expect(recrutement.textes.anuncios).toContain('Voir candidats (3)')
    expect(recrutement.textes.candidaturas).toContain('Tarif : 6 500 € (matériaux inclus)')
    const compta = await jouerEnFrancais('contabilidade')
    expect(compta.textes.painel).toContain('Compta Intelligente BTP')
    expect(compta.textes.encargos).toContain('Tu n\'as pas renseigné d\'assurance décennale. C\'est obligatoire en BTP.')
    const renta = await jouerEnFrancais('rentabilidade')
    expect(renta.textes['visao-geral']).toContain('Ce chantier t\'a rapporté')
    expect(renta.textes.detalhe).toMatch(/Seuil de rentabilité : \d+ jours/)
  })
})
