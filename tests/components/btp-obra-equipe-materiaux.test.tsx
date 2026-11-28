// tests/components/btp-obra-equipe-materiaux.test.tsx — écran Obras (components/dashboard/ChantiersBTPV2.tsx), demande de
// Frédéric du 28/11/2026 : l'équipe d'une obra se retouche jour par jour, les achats de matériaux se saisissent dans la
// fiche, et la rentabilité est calculée hors IVA (valeur s/ IVA, matériaux ramenés hors IVA, main-d'œuvre jour par
// jour). Réseau, Supabase et données BTP simulés ; données fictives.

import React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen, within } from '@testing-library/react'

const etat = vi.hoisted(() => ({
  tables: {} as Record<string, unknown[]>,
  ajouts: [] as Array<{ table: string; objet: Record<string, unknown> }>,
  modifications: [] as Array<{ table: string; id: string; changes: Record<string, unknown> }>,
  retraits: [] as Array<{ table: string; id: string }>,
}))

// Un hook par table, chacun avec ses lignes (même tableau d'un rendu à l'autre, comme l'état React du vrai hook).
vi.mock('@/lib/hooks/use-btp-data', async (importOriginal) => {
  const cache: Record<string, unknown> = {}
  return {
    ...(await importOriginal<typeof import('@/lib/hooks/use-btp-data')>()),
    useBTPData: ({ table }: { table: string }) => {
      if (!cache[table]) {
        cache[table] = {
          loading: false, error: null,
          add: async (objet: Record<string, unknown>) => { etat.ajouts.push({ table, objet }); return { id: 'neuf', ...objet } },
          update: async (id: string, changes: Record<string, unknown>) => { etat.modifications.push({ table, id, changes }); return true },
          remove: async (id: string) => { etat.retraits.push({ table, id }); return true },
        }
      }
      const donnees = cache[table] as Record<string, unknown>
      donnees.items = etat.tables[table] ?? (etat.tables[table] = [])
      return donnees
    },
    useBTPSettings: () => ({ settings: REGLAGES, save: async () => true, loading: false }),
  }
})
vi.mock('@/lib/supabase', () => {
  const chaine: Record<string, unknown> = {}
  for (const methode of ['select', 'eq', 'is', 'in', 'not', 'order', 'limit']) chaine[methode] = () => chaine
  chaine.then = (ok: (v: unknown) => unknown) => Promise.resolve({ data: [], error: null }).then(ok)
  return { supabase: { from: () => chaine, auth: { getSession: async () => ({ data: { session: null } }) } } }
})
vi.mock('@/lib/i18n/context', () => ({ useLocale: () => 'fr', useTranslation: () => ({ t: (c: string) => c }) }))
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn() } }))

const REGLAGES = vi.hoisted(() => ({ country: 'FR', company_type: 'sarl', cout_horaire_ouvrier: 20, charges_patronales_pct: 50, objectif_marge_pct: 20 }))

import { ChantiersBTPV2 } from '@/components/dashboard/ChantiersBTPV2'
import { coutHorsIvaRecuperable } from '@/components/dashboard/btp/DepensesObraEditeur'

const artisan = { id: 'art-1', user_id: 'soc-a' } as unknown as React.ComponentProps<typeof ChantiersBTPV2>['artisan']

// Obra du lundi 30/11 au vendredi 04/12/2026, valeur 10 000 € HT, deux employés (coût d'une journée connu : 7 h au
// coût horaire, charges comprises, d'après les réglages et la fiche).
const OBRA = {
  id: 'c-villa', titre: 'Villa Lilas', client: 'M. Martin', adresse: '1 rue des Lilas', ville: 'Marseille', codePostal: '13008',
  dateDebut: '2026-11-30', dateFin: '2026-12-04', budget: '10000', statut: 'En cours', description: '', equipe: '',
  latitude: null, longitude: null, geoRayonM: 100, membres_ids: ['m-paul', 'm-jean'], alerteMeteo: false, equipe_par_jour: {},
}
const MEMBRES = [
  { id: 'm-paul', prenom: 'Paul', nom: 'Durand', type_compte: 'ouvrier', cout_horaire: 20, charges_patronales_pct: 50, actif: true },
  { id: 'm-jean', prenom: 'Jean', nom: 'Petit', type_compte: 'ouvrier', cout_horaire: 30, charges_patronales_pct: 50, actif: true },
]

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'], now: new Date(2026, 11, 2, 10, 0, 0) })
  etat.tables = { chantiers: [OBRA], depenses: [] }
  etat.ajouts = []
  etat.modifications = []
  etat.retraits = []
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (url) =>
    new Response(JSON.stringify(String(url).includes('table=membres') ? { membres: MEMBRES } : {})))
  vi.spyOn(window, 'confirm').mockReturnValue(true)
})
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks() })

// Attend les fiches employés (lecture, puis calcul des coûts par le moteur de paie chargé à la demande) : la colonne
// « Chef » affiche alors « P. Durand ».
const monter = async (props: Partial<React.ComponentProps<typeof ChantiersBTPV2>> = {}) => {
  render(<ChantiersBTPV2 artisan={artisan} orgRole="pro_societe" {...props} />)
  // Premier chargement à froid du moteur de paie : plusieurs secondes sur un poste chargé.
  await screen.findByText('P. Durand', undefined, { timeout: 15_000 })
}
const ouvrirFiche = async () => {
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Modifier' })) })
}
const enregistrer = async () => { await act(async () => { fireEvent.click(screen.getByRole('button', { name: /Enregistrer/ })) }) }

describe('Obras — équipe jour par jour', () => {
  it('l’équipe habituelle s’affiche du lundi au vendredi ; retirer Jean le mardi n’enregistre que ce jour-là', async () => {
    await monter()
    await ouvrirFiche()
    const liste = screen.getByRole('list', { name: /Équipe par jour/ })
    const jours = within(liste).getAllByRole('listitem')
    expect(jours).toHaveLength(5)
    expect(jours[1].textContent).toContain('Paul D., Jean P.')

    await act(async () => { fireEvent.click(within(jours[1]).getByRole('button', { name: /Modifier l’équipe du/ })) })
    await act(async () => { fireEvent.click(within(jours[1]).getByRole('checkbox', { name: 'Jean Petit' })) })
    expect(jours[1].textContent).toContain('Paul D.')
    expect(jours[1].textContent).not.toContain('Jean P.')
    expect(screen.getByText('1 jour(s) modifié(s)')).toBeTruthy()

    await enregistrer()
    expect(etat.modifications).toEqual([{ table: 'chantiers', id: 'c-villa', changes: { equipe_par_jour: { '2026-12-01': ['m-paul'] } } }])
  })

  it('remettre l’équipe habituelle sur le jour : plus rien à enregistrer', async () => {
    etat.tables.chantiers = [{ ...OBRA, equipe_par_jour: { '2026-12-01': ['m-paul'] } }]
    await monter()
    await ouvrirFiche()
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /Remettre l’équipe habituelle le/ })) })
    expect(screen.queryByText(/jour\(s\) modifié\(s\)/)).toBeNull()
    await enregistrer()
    expect(etat.modifications).toEqual([{ table: 'chantiers', id: 'c-villa', changes: { equipe_par_jour: {} } }])
  })

  it('changer l’équipe habituelle d’une obra commencée : lundi et mardi (passés) gardent l’ancienne équipe', async () => {
    await monter()
    await ouvrirFiche()
    // Décocher Jean dans « Employés assignés » (aujourd'hui : mercredi 02/12).
    const assignes = screen.getByText('Employés assignés').parentElement as HTMLElement
    await act(async () => { fireEvent.click(within(assignes).getAllByRole('checkbox')[1]) })
    const jours = within(screen.getByRole('list', { name: /Équipe par jour/ })).getAllByRole('listitem')
    expect(jours[0].textContent).toContain('Paul D., Jean P.')
    expect(jours[2].textContent).toContain('Paul D.')
    expect(jours[2].textContent).not.toContain('Jean P.')
    await enregistrer()
    expect(etat.modifications).toEqual([{ table: 'chantiers', id: 'c-villa', changes: {
      membres_ids: ['m-paul'], equipe_par_jour: { '2026-11-30': ['m-paul', 'm-jean'], '2026-12-01': ['m-paul', 'm-jean'] },
    } }])
  })

  it('employé désactivé resté dans l’équipe : visible pour être retiré ; il ne coûte plus rien à partir d’aujourd’hui', async () => {
    vi.mocked(globalThis.fetch).mockImplementation(async url => new Response(JSON.stringify(String(url).includes('table=membres')
      ? { membres: [MEMBRES[0], { ...MEMBRES[1], actif: false }] } : {})))
    await monter()
    // Paul 210 €/j sur 5 jours ouvrés ; Jean 315 €/j seulement lundi et mardi (passés) = 1 050 + 630 = 1 680 €.
    expect(screen.getByText(/Main-d’œuvre 1\s680 € \(5 jours travaillés\)/)).toBeTruthy()
    await ouvrirFiche()
    const ligne = screen.getByText('Jean Petit').closest('label') as HTMLElement
    expect(ligne.textContent).toContain('inactif')
    await act(async () => { fireEvent.click(within(ligne).getByRole('checkbox')) })
    await enregistrer()
    expect(etat.modifications[0].changes).toMatchObject({ membres_ids: ['m-paul'] })
  })

  it('obra sans dates : l’écran demande les dates au lieu d’une liste vide', async () => {
    await monter()
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /Nouveau chantier/ })) })
    expect(screen.getByText(/Indiquez les dates de début et de fin pour ajuster l’équipe jour par jour/)).toBeTruthy()
  })
})

describe('Obras — achats de matériaux et rentabilité hors TVA', () => {
  it('achat payé TTC : enregistré hors TVA comme dépense de l’obra, montant payé gardé dans la note', async () => {
    await monter()
    await ouvrirFiche()
    fireEvent.change(screen.getByRole('textbox', { name: 'Description de la dépense' }), { target: { value: 'Ciment' } })
    fireEvent.change(screen.getByRole('textbox', { name: 'Montant payé (€)' }), { target: { value: '1 200,00' } })
    expect(screen.getByText(/Compte 1\s000,00 € HT \(les 200,00 € de TVA récupérable ne comptent pas\)/)).toBeTruthy()
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /Ajouter/ })) })
    expect(etat.ajouts).toEqual([{ table: 'depenses', objet: {
      chantierId: 'c-villa', label: 'Ciment', amount: 1000, category: 'materiaux', date: '2026-12-02',
      notes: expect.stringMatching(/Montant payé \(TTC, TVA 20 %\) : 1\s200,00 €/),
    } }])
  })

  it('TVA récupérable en partie (carburant d’un véhicule de tourisme, 80 %) ou pas du tout : seule la part récupérable est retirée', async () => {
    // 120 € TTC à 20 % : 20 € de TVA, dont 16 € récupérables → 104 € de coût réel ; non récupérable → 120 €.
    expect(coutHorsIvaRecuperable(120, { taux: 20, deductible: 0.8 })).toBe(104)
    expect(coutHorsIvaRecuperable(123, { taux: 23, deductible: 0.5 })).toBe(111.5)
    expect(coutHorsIvaRecuperable(123, { taux: 0, deductible: 0 })).toBe(123)
    await monter()
    await ouvrirFiche()
    fireEvent.change(screen.getByRole('combobox', { name: 'Type de dépense' }), { target: { value: 'carburant' } })
    fireEvent.change(screen.getByRole('textbox', { name: 'Montant payé (€)' }), { target: { value: '120' } })
    fireEvent.change(screen.getByRole('combobox', { name: 'Le montant comprend-il la TVA ?' }), { target: { value: '20-80' } })
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /Ajouter/ })) })
    expect(etat.ajouts[0].objet).toMatchObject({ label: 'Carburant', category: 'carburant', amount: 104 })
  })

  it('montant saisi HT : enregistré tel quel, sans note', async () => {
    await monter()
    await ouvrirFiche()
    fireEvent.change(screen.getByRole('textbox', { name: 'Montant payé (€)' }), { target: { value: '450' } })
    fireEvent.change(screen.getByRole('combobox', { name: 'Le montant comprend-il la TVA ?' }), { target: { value: '0' } })
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /Ajouter/ })) })
    expect(etat.ajouts[0].objet).toMatchObject({ label: 'Matériaux', amount: 450, notes: null })
  })

  it('la rentabilité prend les achats saisis (hors TVA) au lieu de l’estimation, et l’équipe jour par jour', async () => {
    etat.tables.depenses = [
      { id: 'd1', chantier_id: 'c-villa', category: 'materiaux', amount: 1000, date: '2026-11-30', label: 'Ciment' },
      { id: 'd2', chantier_id: 'autre', category: 'materiaux', amount: 5000, date: '2026-11-30', label: 'Autre obra' },
    ]
    await monter()
    const ligne = screen.getByText(/Villa Lilas: \+/).closest('div')?.parentElement as HTMLElement
    // Journée de l'équipe : Paul 20 × 1,5 × 7 = 210 €, Jean 30 × 1,5 × 7 = 315 € ; cinq jours ouvrés = 2 625 €.
    expect(ligne.textContent).toMatch(/Matériaux 1\s000 €/)
    expect(ligne.textContent).not.toContain('estimation')
    expect(ligne.textContent).toMatch(/Main-d’œuvre 2\s625 € \(5 jours travaillés\)/)
    // 10 000 − 1 000 − 2 625 = 6 375 € HT
    expect(ligne.textContent).toMatch(/Villa Lilas: \+6\s375 € HT/)
  })

  it('aucun achat saisi : estimation de 15 %, dite comme telle', async () => {
    await monter()
    expect(screen.getByText(/Matériaux 1\s500 € \(estimation 15 %\)/)).toBeTruthy()
  })

  it('retirer un achat se confirme', async () => {
    etat.tables.depenses = [{ id: 'd1', chantier_id: 'c-villa', category: 'materiaux', amount: 1000, date: '2026-11-30', label: 'Ciment' }]
    await monter()
    await ouvrirFiche()
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Supprimer la dépense Ciment' })) })
    expect(window.confirm).toHaveBeenCalledWith(expect.stringContaining('Supprimer la dépense « Ciment »'))
    expect(etat.retraits).toEqual([{ table: 'depenses', id: 'd1' }])
  })

  it('autre dépense (location de matériel) : enregistrée dans sa catégorie, déduite du résultat sans toucher aux matériaux', async () => {
    await monter()
    await ouvrirFiche()
    fireEvent.change(screen.getByRole('combobox', { name: 'Type de dépense' }), { target: { value: 'location' } })
    fireEvent.change(screen.getByRole('textbox', { name: 'Montant payé (€)' }), { target: { value: '240' } })
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /Ajouter/ })) })
    expect(etat.ajouts[0].objet).toMatchObject({ label: 'Location de matériel', category: 'location', amount: 200 })
  })

  it('rentabilité : autres dépenses déduites ; jour passé pointé compté sur les heures réelles', async () => {
    etat.tables.depenses = [
      { id: 'd1', chantier_id: 'c-villa', category: 'materiaux', amount: 1000, date: '2026-11-30', label: 'Ciment' },
      { id: 'd2', chantier_id: 'c-villa', category: 'location', amount: 300, date: '2026-11-30', label: 'Mini-pelle' },
    ]
    // Mardi 01/12 (passé) : Paul a pointé 4 h (coût horaire 20 × 1,5 = 30 €) ; Jean, prévu, n'a pointé nulle part : il
    // compte une journée (315 €) — un collègue sans l'appli ne disparaît pas du coût.
    etat.tables.pointages = [{ id: 'p1', chantier_id: 'c-villa', membre_id: 'm-paul', employe: 'Paul Durand', date: '2026-12-01', heures_travaillees: 4 }]
    await monter()
    const ligne = screen.getByText(/Villa Lilas: \+/).closest('div')?.parentElement as HTMLElement
    expect(ligne.textContent).toMatch(/Autres dépenses 300 €/)
    // Lundi 525 + mardi (120 + 315) + mercredi à vendredi 3 × 525 = 2 535 €.
    expect(ligne.textContent).toMatch(/Main-d’œuvre 2\s535 € \(5 jours travaillés, dont 1 pointé\)/)
    // 10 000 − 1 000 − 300 − 2 535 = 6 165 € HT
    expect(ligne.textContent).toMatch(/Villa Lilas: \+6\s165 € HT/)
    await ouvrirFiche()
    const mardi = within(screen.getByRole('list', { name: /Équipe par jour/ })).getAllByRole('listitem')[1]
    expect(mardi.textContent).toContain('Paul D. 4 h')
    expect(mardi.textContent).toContain('Jean P. (prévu, sans pointage)')
    expect(mardi.textContent).toContain('pointage (se corrige dans Pointage)')
    // L'équipe prévue reste modifiable ce jour-là (pour retirer un absent qui n'a pas pointé).
    await act(async () => { fireEvent.click(within(mardi).getByRole('button', { name: /Modifier l’équipe/ })) })
    await act(async () => { fireEvent.click(within(mardi).getByRole('checkbox', { name: 'Jean Petit' })) })
    expect(mardi.textContent).not.toContain('(prévu, sans pointage)')
  })

  it('jour férié (France : 11 novembre) : chômé par l’équipe habituelle, nommé, modifiable', async () => {
    etat.tables.chantiers = [{ ...OBRA, dateDebut: '2026-11-09', dateFin: '2026-11-13', statut: 'Terminé' }]
    await monter()
    const ligne = screen.getByText(/Villa Lilas: \+/).closest('div')?.parentElement as HTMLElement
    expect(ligne.textContent).toMatch(/Main-d’œuvre 2\s100 € \(4 jours travaillés\)/)
    await ouvrirFiche()
    const mercredi = within(screen.getByRole('list', { name: /Équipe par jour/ })).getAllByRole('listitem')[2]
    expect(mercredi.textContent).toContain('Férié : Armistice')
    expect(mercredi.textContent).toContain('Personne')
    // Modifiable : l'équipe a travaillé ce jour-là.
    await act(async () => { fireEvent.click(within(mercredi).getByRole('button', { name: /Modifier l’équipe/ })) })
    await act(async () => { fireEvent.click(within(mercredi).getByRole('checkbox', { name: 'Paul Durand' })) })
    expect(mercredi.textContent).toContain('Paul D.')
  })

  it('sans le droit sur la comptabilité : pas de saisie d’achats dans la fiche', async () => {
    await monter({ gestionMateriaux: false })
    await ouvrirFiche()
    expect(screen.queryByText('Dépenses du chantier (HT)')).toBeNull()
  })
})
