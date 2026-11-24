// tests/components/btp-adresse-depuis-devis.test.tsx — bouton « Importer l'adresse depuis un devis » (demande de
// Frédéric du 24/11/2026 : ne plus retaper à la main le lieu d'intervention d'un devis).
//   - Météo chantiers (components/dashboard/btp/MeteoChantierSection.tsx) : le lieu d'un devis reçoit ses prévisions
//     sous les chantiers, gardé sur l'appareil ; ni le devis ni les chantiers ne sont modifiés.
//   - Fiche chantier (components/dashboard/ChantiersBTPV2.tsx) : l'import d'un devis à la création reprend le lieu
//     d'intervention (et non plus la colonne client_address, que la synchronisation n'écrit pas), en rue, code postal et
//     ville ; le bouton à côté de l'adresse sert aussi en modification, direct quand un seul devis est rattaché.
// Supabase, géocodage, réseau et données BTP simulés ; adresses et devis fictifs.

import React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'

type Position = { latitude: number; longitude: number; precise: boolean }

const etat = vi.hoisted(() => ({
  chantiers: [] as Array<Record<string, unknown>>,
  devis: [] as Array<Record<string, unknown>>,
  /** Colonnes demandées à chaque select de la table devis. */
  selections: [] as string[],
  /** La première lecture des devis échoue (base sans colonne raw_data). */
  sansRawData: false,
  geocodage: null as Position | null,
  modifications: [] as Array<{ id: string; changes: Record<string, unknown> }>,
  locale: 'fr',
}))

vi.mock('@/lib/hooks/use-btp-data', () => {
  const donnees = {
    items: [] as unknown[],
    loading: false,
    error: null,
    add: async (item: Record<string, unknown>) => ({ id: 'c-neuf', ...item }),
    update: async (id: string, changes: Record<string, unknown>) => { etat.modifications.push({ id, changes }); return true },
    remove: async () => true,
  }
  const reglages = { settings: { country: 'FR', company_type: 'sarl', cout_horaire_ouvrier: 22, charges_patronales_pct: 45, objectif_marge_pct: 20 } }
  return { useBTPData: () => { donnees.items = etat.chantiers; return donnees }, useBTPSettings: () => reglages }
})
vi.mock('@/lib/btp/geocodage', async (original) => ({
  ...(await original<typeof import('@/lib/btp/geocodage')>()),
  geocoderAdresse: vi.fn(async () => etat.geocodage),
}))
vi.mock('@/lib/supabase', () => {
  const requete = (table: string) => {
    let colonnes = ''
    const chaine: Record<string, unknown> = {}
    for (const m of ['eq', 'is', 'in', 'not', 'order', 'limit']) chaine[m] = () => chaine
    chaine.select = (c: string) => { colonnes = c; if (table === 'devis') etat.selections.push(c); return chaine }
    chaine.then = (ok: (v: unknown) => unknown, ko?: (e: unknown) => unknown) => {
      if (table !== 'devis' || colonnes.includes('chantier_id')) return Promise.resolve({ data: [], error: null }).then(ok, ko)
      if (etat.sansRawData && colonnes.includes('raw_data')) {
        return Promise.resolve({ data: null, error: { message: 'column devis.raw_data does not exist' } }).then(ok, ko)
      }
      // Sans raw_data, la base ne rend que les colonnes demandées : le lieu tiré du contenu disparaît.
      const lignes = colonnes.includes('raw_data')
        ? etat.devis
        : etat.devis.map(({ lieu_intervention: _l, adresse_client_devis: _a, ...reste }) => reste)
      return Promise.resolve({ data: lignes, error: null }).then(ok, ko)
    }
    return chaine
  }
  return {
    supabase: {
      from: requete,
      auth: {
        getSession: async () => ({ data: { session: null } }),
        getUser: async () => ({ data: { user: { id: 'u1' } } }),
      },
    },
  }
})
vi.mock('@/lib/i18n/context', () => ({ useLocale: () => etat.locale, useTranslation: () => ({ t: (c: string) => c }) }))
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() } }))

import { toast } from 'sonner'
import { geocoderAdresse } from '@/lib/btp/geocodage'
import { MeteoChantierSection } from '@/components/dashboard/btp/MeteoChantierSection'
import { ChantiersBTPV2 } from '@/components/dashboard/ChantiersBTPV2'

const DEVIS_LILAS = {
  id: 'd-lilas', numero: 'DEV-2026-001', client_name: 'Mme Durand', client_address: null, created_at: '2026-11-20T10:00:00Z',
  status: 'envoye', total_ht_cents: 1_250_000, items: [{ description: 'Ravalement de façade' }],
  lieu_intervention: 'Résidence Le Mail, 15 rue des Lilas, 13001 Marseille', adresse_client_devis: '3 av. du Prado, 13008 Marseille',
}
const BROUILLON_LYON = {
  id: 'd-lyon', numero: null, client_name: 'M. Petit', client_address: null, created_at: '2026-11-19T10:00:00Z',
  status: 'brouillon', total_ht_cents: 0, items: [], lieu_intervention: '', adresse_client_devis: '8 rue Neuve, 69003 Lyon',
}
const SANS_ADRESSE = {
  id: 'd-vide', numero: 'DEV-2026-002', client_name: 'Société X', client_address: null, created_at: '2026-11-18T10:00:00Z',
  status: 'envoye', total_ht_cents: 0, items: [], lieu_intervention: null, adresse_client_devis: null,
}

let appels: string[]
const hote = (adresse: string) => new URL(adresse, 'http://localhost').hostname
const previsions = () => appels.filter(a => hote(a) === 'api.open-meteo.com')

beforeEach(() => {
  appels = []
  etat.chantiers = []
  etat.devis = [DEVIS_LILAS, BROUILLON_LYON, SANS_ADRESSE]
  etat.selections = []
  etat.sansRawData = false
  etat.geocodage = { latitude: 43.3, longitude: 5.38, precise: true }
  etat.modifications = []
  etat.locale = 'fr'
  localStorage.clear()
  vi.mocked(geocoderAdresse).mockClear()
  for (const f of Object.values(toast)) vi.mocked(f).mockClear()
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (url) => {
    const adresse = String(url)
    appels.push(adresse)
    if (adresse.startsWith('/api/btp')) return new Response(JSON.stringify({ membres: [] }))
    return new Response(JSON.stringify({
      daily: { time: ['2026-11-24'], temperature_2m_max: [15], temperature_2m_min: [8], precipitation_sum: [0], wind_speed_10m_max: [10], weather_code: [1] },
    }))
  })
  vi.spyOn(console, 'warn').mockImplementation(() => {})
})
afterEach(() => { vi.restoreAllMocks() })

// ═══ Météo chantiers ═══

const ouvrirChoixMeteo = async (nom: RegExp | string = 'Importer une adresse depuis un devis') => {
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: new RegExp(nom) })) })
  return screen.findByRole('combobox')
}

describe('Météo chantiers — importer une adresse depuis un devis', () => {
  it('liste les devis qui ont un lieu (lieu d’intervention, sinon adresse du client) ; le lieu choisi reçoit ses prévisions', async () => {
    render(<MeteoChantierSection userId="art-1" authUserId="u1" isPt={false} />)
    const liste = await ouvrirChoixMeteo()
    const options = within(liste).getAllByRole('option').map(o => o.textContent)
    expect(options).toEqual([
      '— Sélectionner un devis —',
      'DEV-2026-001 · Mme Durand · Résidence Le Mail, 15 rue des Lilas, 13001 Marseille',
      'Brouillon · M. Petit · 8 rue Neuve, 69003 Lyon (adresse du client)',
    ])
    expect(etat.selections[0]).toContain('lieu_intervention:raw_data->>interventionAddress')

    await act(async () => { fireEvent.change(liste, { target: { value: 'd-lilas' } }) })
    await waitFor(() => expect(previsions()).toHaveLength(1))
    expect(geocoderAdresse).toHaveBeenCalledWith(
      expect.objectContaining({ adresse: 'Résidence Le Mail, 15 rue des Lilas', codePostal: '13001', ville: 'Marseille' }), 'FR')
    expect(previsions()[0]).toContain('latitude=43.3')
    expect(await screen.findByText(/Devis DEV-2026-001 · Mme Durand/)).toBeTruthy()
    expect(screen.getByText('Lieux d’intervention des devis')).toBeTruthy()
    expect(screen.queryByRole('combobox')).toBeNull()
    expect(toast.success).toHaveBeenCalledWith('Météo ajoutée pour le lieu du devis DEV-2026-001.')

    // Gardé sur l'appareil ; rien n'est écrit dans les chantiers.
    expect(JSON.parse(localStorage.getItem('vitfix_btp_meteo_devis_art-1') ?? '[]')).toEqual([
      { devisId: 'd-lilas', numero: 'DEV-2026-001', client: 'Mme Durand', lieu: 'Résidence Le Mail, 15 rue des Lilas, 13001 Marseille', source: 'intervention' },
    ])
    expect(etat.modifications).toEqual([])
  })

  it('les indicateurs comptent les chantiers seulement', async () => {
    render(<MeteoChantierSection userId="art-1" authUserId="u1" isPt={false} />)
    const liste = await ouvrirChoixMeteo()
    await act(async () => { fireEvent.change(liste, { target: { value: 'd-lilas' } }) })
    await screen.findByText(/Devis DEV-2026-001/)
    const kpi = screen.getByText('Chantiers OK').parentElement as HTMLElement
    expect(within(kpi).getByText('0')).toBeTruthy()
  })

  it('lieux gardés : rechargés avec les chantiers à la visite suivante ; ✕ retire le lieu, de l’écran et de l’appareil', async () => {
    localStorage.setItem('vitfix_btp_meteo_devis_art-1', JSON.stringify([
      { devisId: 'd-lilas', numero: 'DEV-2026-001', client: 'Mme Durand', lieu: 'Résidence Le Mail, 15 rue des Lilas, 13001 Marseille', source: 'intervention' },
    ]))
    etat.chantiers = [{ id: 'c-villa', titre: 'Villa', adresse: '1 rue des Pins', codePostal: '13008', ville: 'Marseille', statut: 'En cours' }]
    render(<MeteoChantierSection userId="art-1" authUserId="u1" isPt={false} />)
    await waitFor(() => expect(previsions()).toHaveLength(2), { timeout: 4000 })
    expect(await screen.findByText(/Devis DEV-2026-001 · Mme Durand/)).toBeTruthy()
    expect(screen.getByText(/🏗️ Villa/)).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Retirer ce lieu de la météo' }))
    expect(screen.queryByText(/Devis DEV-2026-001/)).toBeNull()
    expect(screen.getByText(/🏗️ Villa/)).toBeTruthy()
    expect(JSON.parse(localStorage.getItem('vitfix_btp_meteo_devis_art-1') ?? 'null')).toEqual([])
  })

  it('lieu introuvable : la carte reste, avec son bouton ✕, pour pouvoir le retirer', async () => {
    etat.geocodage = null
    render(<MeteoChantierSection userId="art-1" authUserId="u1" isPt={false} />)
    const liste = await ouvrirChoixMeteo()
    await act(async () => { fireEvent.change(liste, { target: { value: 'd-lyon' } }) })
    expect(await screen.findByText(/Prévisions indisponibles pour ce lieu/)).toBeTruthy()
    expect(toast.success).toHaveBeenCalledWith('Météo ajoutée pour le lieu du devis brouillon. Pas de lieu d’intervention sur ce devis : c’est l’adresse du client.')
    fireEvent.click(screen.getByRole('button', { name: 'Retirer ce lieu de la météo' }))
    expect(screen.queryByText(/Prévisions indisponibles pour ce lieu/)).toBeNull()
  })

  it('base sans colonne raw_data : la liste se rabat sur l’ancienne colonne client_address', async () => {
    etat.sansRawData = true
    etat.devis = [{ ...SANS_ADRESSE, client_address: '2 place Bellecour, 69002 Lyon' }]
    render(<MeteoChantierSection userId="art-1" authUserId="u1" isPt={false} />)
    const liste = await ouvrirChoixMeteo()
    expect(within(liste).getAllByRole('option').map(o => o.textContent)).toContain('DEV-2026-002 · Société X · 2 place Bellecour, 69002 Lyon (adresse du client)')
    expect(etat.selections).toHaveLength(2)
    expect(etat.selections[1]).not.toContain('raw_data')
  })

  it('aucun devis avec un lieu : message, pas de liste', async () => {
    etat.devis = [SANS_ADRESSE]
    render(<MeteoChantierSection userId="art-1" authUserId="u1" isPt={false} />)
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /Importer une adresse depuis un devis/ })) })
    expect(await screen.findByText('Aucun devis avec un lieu d’intervention ou une adresse du client.')).toBeTruthy()
    expect(screen.queryByRole('combobox')).toBeNull()
  })

  it('en portugais : textes portugais, géocodage au Portugal', async () => {
    etat.devis = [{ ...DEVIS_LILAS, id: 'd-porto', numero: 'ORC-0012', client_name: 'Sr. Silva', lieu_intervention: 'Rua de Santa Catarina 123, 4000-447 Porto' }]
    render(<MeteoChantierSection userId="art-1" authUserId="u1" isPt />)
    const liste = await ouvrirChoixMeteo('Importar morada de um orçamento')
    expect(within(liste).getAllByRole('option')[0].textContent).toBe('Selecionar um orçamento...')
    await act(async () => { fireEvent.change(liste, { target: { value: 'd-porto' } }) })
    await waitFor(() => expect(previsions()).toHaveLength(1))
    expect(geocoderAdresse).toHaveBeenCalledWith(
      expect.objectContaining({ adresse: 'Rua de Santa Catarina 123', codePostal: '4000-447', ville: 'Porto' }), 'PT')
    expect(await screen.findByText(/Orçamento ORC-0012 · Sr\. Silva/)).toBeTruthy()
    expect(screen.getByText('Locais de intervenção dos orçamentos')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Retirar este local da meteorologia' })).toBeTruthy()
  })
})

// ═══ Fiche chantier ═══

const artisan = { id: 'art-1', user_id: 'u1' } as unknown as React.ComponentProps<typeof ChantiersBTPV2>['artisan']

const champs = () => ({
  adresse: (screen.getByPlaceholderText('N°, rue...') as HTMLInputElement).value,
  codePostal: (screen.getByPlaceholderText('13001') as HTMLInputElement).value,
  ville: (screen.getByPlaceholderText('Marseille, Lyon...') as HTMLInputElement).value,
})
const boutonAdresse = () => screen.getByRole('button', { name: /Importer l’adresse depuis un devis/ })
const enregistrer = async () => { await act(async () => { fireEvent.click(screen.getByRole('button', { name: /Enregistrer/ })) }) }

const nouvelleFiche = async () => {
  render(<ChantiersBTPV2 artisan={artisan} orgRole="pro_societe" />)
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: /Nouveau chantier/ })) })
  await waitFor(() => expect(boutonAdresse()).toHaveProperty('disabled', false))
}

const VILLA = {
  id: 'c-villa', titre: 'Villa', client: 'Mme Durand', adresse: '1 rue des Pins', ville: 'Marseille', codePostal: '13008',
  dateDebut: '2026-11-01', dateFin: '2026-12-15', budget: '12000', statut: 'En cours', description: '', equipe: '',
  latitude: 43.2504, longitude: 5.3801, geoRayonM: 50, devis_id: null, membres_ids: [],
}
const modifier = async (chantier: Record<string, unknown>) => {
  etat.chantiers = [chantier]
  render(<ChantiersBTPV2 artisan={artisan} orgRole="pro_societe" />)
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Modifier' })) })
  await waitFor(() => expect(boutonAdresse()).toHaveProperty('disabled', false))
}

describe('fiche chantier — adresse reprise d’un devis', () => {
  it('import d’un devis à la création : le lieu d’intervention en rue, code postal et ville (plus l’adresse du client)', async () => {
    await nouvelleFiche()
    const liste = screen.getByDisplayValue('— Sélectionner un devis —')
    await act(async () => { fireEvent.change(liste, { target: { value: 'd-lilas' } }) })
    expect(champs()).toEqual({ adresse: 'Résidence Le Mail, 15 rue des Lilas', codePostal: '13001', ville: 'Marseille' })
    expect(geocoderAdresse).toHaveBeenLastCalledWith({ adresse: 'Résidence Le Mail, 15 rue des Lilas', codePostal: '13001', ville: 'Marseille' }, 'FR')
    expect(screen.getByText(/GPS : 43\.30000, 5\.38000/)).toBeTruthy()
    expect(toast.success).toHaveBeenCalledWith('Adresse reprise du devis DEV-2026-001.')
  })

  it('import d’un devis sans aucune adresse : l’adresse déjà saisie reste, avec un avertissement', async () => {
    await nouvelleFiche()
    fireEvent.change(screen.getByPlaceholderText('N°, rue...'), { target: { value: '4 rue Haute' } })
    await act(async () => { fireEvent.change(screen.getByDisplayValue('— Sélectionner un devis —'), { target: { value: 'd-vide' } }) })
    expect(champs().adresse).toBe('4 rue Haute')
    expect(toast.warning).toHaveBeenCalledWith('Ce devis n’a ni lieu d’intervention ni adresse du client : indiquez l’adresse du chantier.')
  })

  it('bouton à côté de l’adresse, sans devis rattaché : la liste des devis à lieu s’ouvre ; seule l’adresse est reprise', async () => {
    await nouvelleFiche()
    fireEvent.change(screen.getByPlaceholderText('ex: Immeuble R+3 — Gros oeuvre'), { target: { value: 'Mon titre' } })
    await act(async () => { fireEvent.click(boutonAdresse()) })
    const liste = screen.getByRole('combobox', { name: 'Devis dont reprendre l’adresse' })
    expect(within(liste).getAllByRole('option').map(o => o.textContent)).toEqual([
      '— Sélectionner un devis —',
      'DEV-2026-001 · Mme Durand · Résidence Le Mail, 15 rue des Lilas, 13001 Marseille',
      'Brouillon · M. Petit · 8 rue Neuve, 69003 Lyon (adresse du client)',
    ])
    await act(async () => { fireEvent.change(liste, { target: { value: 'd-lyon' } }) })
    expect(champs()).toEqual({ adresse: '8 rue Neuve', codePostal: '69003', ville: 'Lyon' })
    expect((screen.getByPlaceholderText('ex: Immeuble R+3 — Gros oeuvre') as HTMLInputElement).value).toBe('Mon titre')
    expect(screen.queryByRole('combobox', { name: 'Devis dont reprendre l’adresse' })).toBeNull()
    expect(toast.success).toHaveBeenCalledWith('Adresse reprise du devis brouillon. Pas de lieu d’intervention sur ce devis : c’est l’adresse du client.')
  })

  it('modification d’un chantier rattaché à un seul devis : un clic reprend son lieu ; la position enregistrée n’est remplacée qu’avec l’accord du gérant', async () => {
    const confirmer = vi.spyOn(window, 'confirm').mockReturnValue(true)
    await modifier({ ...VILLA, devis_id: 'd-lilas' })
    await act(async () => { fireEvent.click(boutonAdresse()) })
    expect(champs()).toEqual({ adresse: 'Résidence Le Mail, 15 rue des Lilas', codePostal: '13001', ville: 'Marseille' })
    // Comme une adresse corrigée à la main : pas de géocodage, la position enregistrée reste jusqu'à l'enregistrement.
    expect(geocoderAdresse).not.toHaveBeenCalled()
    expect(screen.getByText(/GPS : 43\.25040, 5\.38010/)).toBeTruthy()
    await enregistrer()
    expect(confirmer).toHaveBeenCalledTimes(1)
    expect(etat.modifications).toEqual([{
      id: 'c-villa', changes: { adresse: 'Résidence Le Mail, 15 rue des Lilas', codePostal: '13001' },
    }])
  })

  it('modification d’un chantier sans position : le lieu repris est géocodé tout de suite', async () => {
    await modifier({ ...VILLA, latitude: null, longitude: null, devis_id: 'd-lilas' })
    await act(async () => { fireEvent.click(boutonAdresse()) })
    expect(geocoderAdresse).toHaveBeenLastCalledWith({ adresse: 'Résidence Le Mail, 15 rue des Lilas', codePostal: '13001', ville: 'Marseille' }, 'FR')
    expect(screen.getByText(/GPS : 43\.30000, 5\.38000/)).toBeTruthy()
  })

  it('aucun devis avec une adresse : avertissement, pas de liste', async () => {
    etat.devis = [SANS_ADRESSE]
    await nouvelleFiche()
    await act(async () => { fireEvent.click(boutonAdresse()) })
    expect(toast.warning).toHaveBeenCalledWith('Aucun devis avec un lieu d’intervention ou une adresse du client.')
    expect(screen.queryByRole('combobox', { name: 'Devis dont reprendre l’adresse' })).toBeNull()
  })

  it('en portugais : libellés portugais et découpage d’une morada portuguesa', async () => {
    etat.locale = 'pt'
    etat.devis = [{ ...DEVIS_LILAS, id: 'd-porto', numero: 'ORC-0012', client_name: 'Sr. Silva', lieu_intervention: 'Rua de Santa Catarina 123, 4000-447 Porto' }]
    render(<ChantiersBTPV2 artisan={artisan} orgRole="pro_societe" />)
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /Nova obra/ })) })
    const bouton = screen.getByRole('button', { name: /Importar morada de um orçamento/ })
    await waitFor(() => expect(bouton).toHaveProperty('disabled', false))
    await act(async () => { fireEvent.click(bouton) })
    await act(async () => { fireEvent.change(screen.getByRole('combobox', { name: 'Orçamento cuja morada importar' }), { target: { value: 'd-porto' } }) })
    expect((screen.getByPlaceholderText('Rua, n.º...') as HTMLInputElement).value).toBe('Rua de Santa Catarina 123')
    expect((screen.getByPlaceholderText('4000-123') as HTMLInputElement).value).toBe('4000-447')
    expect((screen.getByPlaceholderText('Porto, Lisboa...') as HTMLInputElement).value).toBe('Porto')
    expect(geocoderAdresse).toHaveBeenLastCalledWith(expect.objectContaining({ ville: 'Porto' }), 'PT')
    expect(toast.success).toHaveBeenCalledWith('Morada importada do orçamento ORC-0012.')
  })
})
