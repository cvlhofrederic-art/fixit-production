import './fuseau-paris'
import 'fake-indexeddb/auto'
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import type { ComponentType, ReactNode } from 'react'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * Écran Sinistres EN MODE DONNÉES RÉELLES : la fiche s'enregistre dans la table locale « sinistres » (création puis
 * modification), la liste lit la base (aucune ligne de démonstration), les intervenants sans fiche dans l'annuaire se
 * saisissent librement (mention « saisie libre »), et la suggestion de forclusion n'est jamais recopiée d'office.
 * Le mode est lu au chargement des modules : il est posé dans le stockage, puis les modules sont rechargés (t01-t02).
 */

const CLE_STOCKAGE_MODE = 'vitfix.aj.mode'

let SinistresModule: ComponentType
let ToastContext: typeof import('@/components/administrateur-judiciaire/ui/toast').ToastContext
let useDonneesStore: typeof import('@/lib/administrateur-judiciaire/db/donnees-store').useDonneesStore
let useSelectionDossier: typeof import('@/lib/administrateur-judiciaire/selection').useSelectionDossier
let ajDb: typeof import('@/lib/administrateur-judiciaire/db/schema').ajDb
let viderBaseLocale: () => Promise<void>
let survenance: string

beforeAll(async () => {
  localStorage.setItem(CLE_STOCKAGE_MODE, 'reel')
  vi.resetModules()
  ;({ SinistresModule } = await import('@/components/administrateur-judiciaire/modules/technique/SinistresModule'))
  ;({ ToastContext } = await import('@/components/administrateur-judiciaire/ui/toast'))
  ;({ useDonneesStore } = await import('@/lib/administrateur-judiciaire/db/donnees-store'))
  ;({ useSelectionDossier } = await import('@/lib/administrateur-judiciaire/selection'))
  ;({ ajDb } = await import('@/lib/administrateur-judiciaire/db/schema'))
  ;({ viderBaseLocale } = await import('@/lib/administrateur-judiciaire/db/reset'))
  const { MODE_ACTIF, AUJOURDHUI_ISO } = await import('@/lib/administrateur-judiciaire/mode')
  const { ajouterJours } = await import('@/lib/administrateur-judiciaire/domain/dates')
  expect(MODE_ACTIF).toBe('reel')
  survenance = ajouterJours(AUJOURDHUI_ISO, -10)
})

afterAll(() => {
  localStorage.removeItem(CLE_STOCKAGE_MODE)
})

beforeEach(async () => {
  await viderBaseLocale()
  useDonneesStore.setState({ loaded: false, loading: false, erreur: null, coproprietes: [], mandats: [], sinistres: [] })
  useSelectionDossier.setState({ code: null, coproprietaireId: null })
  await useDonneesStore.getState().loadAll()
  await useDonneesStore.getState().createCopropriete({
    nom: 'Résidence des Acacias',
    adresse: '1 rue de l’Exemple, 75000 Paris',
    nbLots: 10,
    rg: '26/00001',
    fondement: 'art. 46 — carence',
  })
})

afterEach(() => cleanup())

async function rendre() {
  const push = vi.fn<(options: { kind?: string; title?: ReactNode; desc?: ReactNode }) => number | undefined>(() => undefined)
  await act(async () => {
    render(
      <ToastContext.Provider value={{ push, dismiss: vi.fn() }}>
        <SinistresModule />
      </ToastContext.Provider>,
    )
  })
  return { push }
}

const lignesTableau = () => screen.queryAllByRole('row').slice(1)
const dialogue = () => screen.getByRole('dialog')
/** Champ obligatoire de type date : son libellé porte l'astérisque (aria-hidden) de Field. */
const SURVENANCE = /^Sinistre \(survenance\)/

/** Ligne écrite directement dans la table (reprise, import), puis rechargée dans le store. */
async function insererLigne(ligne: Record<string, unknown>) {
  const coproprieteId = useDonneesStore.getState().coproprietes[0].id
  await ajDb.sinistres.add({
    id: 'sin-externe',
    createdAt: '2026-11-01T08:00:00.000Z',
    updatedAt: '2026-11-01T08:00:00.000Z',
    createdBy: null,
    updatedBy: null,
    coproprieteId,
    ...ligne,
  } as never)
  useDonneesStore.setState({ loaded: false })
  await useDonneesStore.getState().loadAll()
}

async function enregistrer() {
  await act(async () => {
    fireEvent.click(within(dialogue()).getByRole('button', { name: 'Enregistrer' }))
  })
  await act(async () => {
    await new Promise((resoudre) => setTimeout(resoudre, 20))
  })
}

/** Champs obligatoires de la déclaration : type et survenance. */
function remplirEssentiel(type: string) {
  const boite = within(dialogue())
  fireEvent.change(boite.getByRole('combobox', { name: 'Type de sinistre' }), { target: { value: type } })
  fireEvent.change(boite.getByLabelText(SURVENANCE), { target: { value: survenance } })
}

/** Indication sous le champ « Mandat » (« 🔵 Proposé… », aucun mandat…), vide s'il n'y en a pas. */
const indicationMandat = () =>
  within(dialogue()).getByLabelText('Mandat').closest('.field')?.querySelector('.field-hint')?.textContent ?? ''

describe('Sinistres en mode réel — enregistrement dans la table « sinistres »', () => {
  it('base sans sinistre : aucune ligne de démonstration', async () => {
    await rendre()
    expect(lignesTableau()).toHaveLength(0)
    expect(screen.queryByText('TL.00009')).toBeNull()
    expect(screen.getByText(/Aucun sinistre/)).toBeInTheDocument()
  })

  it('les intervenants sans fiche dans l’annuaire se saisissent librement, mention « saisie libre »', async () => {
    await rendre()
    fireEvent.click(screen.getByRole('button', { name: /Déclarer un sinistre/ }))
    const boite = within(dialogue())
    expect(boite.getByLabelText('Compagnie').tagName).toBe('INPUT')
    expect(boite.getByLabelText('Courtier').tagName).toBe('INPUT')
    fireEvent.click(boite.getByRole('button', { name: 'Compléter le bloc Responsable et assistant' }))
    expect(boite.getByLabelText('Responsable').tagName).toBe('INPUT')
    expect(boite.getByLabelText('Assistant').tagName).toBe('INPUT')
    expect(boite.getAllByText(/saisie libre/i).length).toBeGreaterThanOrEqual(4)
    expect(boite.getByText(/Aucun contrat d’assurance/)).toBeInTheDocument()
  })

  it('déclarer : la fiche est écrite en base et apparaît dans la liste ; la forclusion suggérée n’est pas recopiée', async () => {
    const { push } = await rendre()
    fireEvent.click(screen.getByRole('button', { name: /Déclarer un sinistre/ }))
    const boite = within(dialogue())
    expect(boite.getByLabelText('N°')).toHaveValue('RA.00001')
    fireEvent.change(boite.getByRole('combobox', { name: 'Type de sinistre' }), { target: { value: 'Dégât des eaux' } })
    fireEvent.change(boite.getByLabelText(SURVENANCE), { target: { value: survenance } })
    fireEvent.change(boite.getByLabelText('Compagnie'), { target: { value: 'Compagnie hors annuaire' } })
    fireEvent.change(boite.getByLabelText('Lieu, situation'), { target: { value: 'Cage A, 2e étage' } })
    fireEvent.click(boite.getByLabelText('Parties communes lésées'))
    fireEvent.click(boite.getByRole('button', { name: 'Compléter le bloc Responsable et assistant' }))
    fireEvent.change(boite.getByLabelText('Responsable'), { target: { value: 'Gestionnaire du dossier' } })
    // Bloc Suivi déplié : la suggestion 🔵 est affichée, le champ « Forclusion » reste vide.
    fireEvent.click(boite.getByRole('button', { name: 'Compléter le bloc Suivi' }))
    expect(boite.getByText(/^🔵 Suggestion : .*L\. 114-1.*à confirmer\.$/)).toBeInTheDocument()
    expect(boite.getByLabelText('Forclusion')).toHaveValue('')
    await enregistrer()

    const lignes = await ajDb.sinistres.toArray()
    expect(lignes).toHaveLength(1)
    const copro = useDonneesStore.getState().coproprietes[0]
    expect(lignes[0]).toMatchObject({
      coproprieteId: copro.id,
      type: 'Dégât des eaux',
      numero: 'RA.00001',
      dateSurvenance: survenance,
      dateForclusion: null,
      lieu: 'Cage A, 2e étage',
      partiesCommunesLesees: true,
      assurance: { compagnie: 'Compagnie hors annuaire', compagnieId: null },
      responsable: { id: null, nom: 'Gestionnaire du dossier' },
    })
    expect(lignes[0].mandatId).toBe(useDonneesStore.getState().mandats[0].id)
    expect(push.mock.calls.at(-1)?.[0]).toMatchObject({ kind: 'success', title: 'Sinistre enregistré' })
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(lignesTableau()).toHaveLength(1)
    expect(lignesTableau()[0].textContent).toContain('RA.00001')
    expect(lignesTableau()[0].textContent).toContain('Parties communes / Cage A, 2e étage')
  })

  it('modifier par « Détails » : même ligne en base, liste à jour', async () => {
    await rendre()
    fireEvent.click(screen.getByRole('button', { name: /Déclarer un sinistre/ }))
    fireEvent.change(within(dialogue()).getByRole('combobox', { name: 'Type de sinistre' }), { target: { value: 'Incendie' } })
    fireEvent.change(within(dialogue()).getByLabelText(SURVENANCE), { target: { value: survenance } })
    await enregistrer()
    const [creee] = await ajDb.sinistres.toArray()

    fireEvent.click(within(lignesTableau()[0]).getByRole('button', { name: 'Détails' }))
    const boite = within(dialogue())
    expect(boite.getByRole('combobox', { name: 'Type de sinistre' })).toHaveValue('Incendie')
    fireEvent.change(boite.getByLabelText('Phase'), { target: { value: 'Déclaration' } })
    fireEvent.change(boite.getByLabelText('Déclaration'), { target: { value: survenance } })
    await enregistrer()

    const lignes = await ajDb.sinistres.toArray()
    expect(lignes).toHaveLength(1)
    expect(lignes[0]).toMatchObject({ id: creee.id, phase: 'Déclaration', dateDeclaration: survenance })
    expect(lignesTableau()).toHaveLength(1)
    expect(lignesTableau()[0].textContent).toContain('Déclaration')
  })

  it('échec d’écriture : toast d’avertissement, la fiche reste ouverte', async () => {
    const { push } = await rendre()
    fireEvent.click(screen.getByRole('button', { name: /Déclarer un sinistre/ }))
    fireEvent.change(within(dialogue()).getByRole('combobox', { name: 'Type de sinistre' }), { target: { value: 'Incendie' } })
    fireEvent.change(within(dialogue()).getByLabelText(SURVENANCE), { target: { value: survenance } })
    const espion = vi.spyOn(ajDb.sinistres, 'add').mockRejectedValueOnce(new Error('Quota dépassé'))
    await enregistrer()
    espion.mockRestore()
    expect(push.mock.calls.at(-1)?.[0]).toMatchObject({ kind: 'warn', title: 'Enregistrement impossible' })
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(await ajDb.sinistres.count()).toBe(0)
  })

  it('aucune mention « enregistrement simulé » en données réelles', async () => {
    await rendre()
    expect(screen.queryByText('Démonstration : enregistrement simulé')).toBeNull()
  })
})

describe('Sinistres en mode réel — parties après un changement de copropriété', () => {
  it('bloc Parties ouvert, changement de copropriété : la partie « Immeuble » enregistrée est la nouvelle copropriété', async () => {
    await useDonneesStore.getState().createCopropriete({
      nom: 'Villa Bleue',
      adresse: '2 rue de l’Exemple, 75000 Paris',
      nbLots: 4,
      rg: '26/00002',
      fondement: 'art. 46 — carence',
    })
    await rendre()
    fireEvent.click(screen.getByRole('button', { name: /Déclarer un sinistre/ }))
    const boite = within(dialogue())
    fireEvent.click(boite.getByRole('button', { name: 'Compléter le bloc Parties' }))
    expect(boite.getByLabelText('Partie')).toHaveDisplayValue('Résidence des Acacias')
    fireEvent.change(boite.getByRole('combobox', { name: 'Copropriété' }), { target: { value: 'Villa Bleue' } })
    expect(boite.getByLabelText('N°')).toHaveValue('VB.00001')
    fireEvent.click(boite.getByRole('button', { name: 'Ajouter la partie' }))
    fireEvent.change(boite.getByRole('combobox', { name: 'Type de sinistre' }), { target: { value: 'Incendie' } })
    fireEvent.change(boite.getByLabelText(SURVENANCE), { target: { value: survenance } })
    await enregistrer()

    const villaBleue = useDonneesStore.getState().coproprietes.find((copro) => copro.nom === 'Villa Bleue')
    const [ligne] = await ajDb.sinistres.toArray()
    expect(ligne.coproprieteId).toBe(villaBleue?.id)
    expect(ligne.parties).toEqual([{ role: 'Lésé', nature: 'Immeuble', refId: villaBleue?.id, libelle: 'Villa Bleue' }])
  })
})

describe('Sinistres en mode réel — lignes venues d’ailleurs (reprise, import)', () => {
  it('une ligne au texte null est comptée comme illisible : l’écran reste affiché', async () => {
    await insererLigne({ type: 'Vol', dateSurvenance: survenance, origine: null })
    await rendre()
    expect(screen.getByRole('heading', { name: 'Sinistres' })).toBeInTheDocument()
    expect(screen.getByText('1 fiche de la base non affichée')).toBeInTheDocument()
    expect(lignesTableau()).toHaveLength(0)
  })

  it('une fiche sans phase ni mandat, ouverte puis enregistrée sans modification, reste sans phase et sans mandat', async () => {
    await insererLigne({ type: 'Vol', dateSurvenance: survenance, phase: null })
    await rendre()
    expect(lignesTableau()).toHaveLength(1)
    fireEvent.click(within(lignesTableau()[0]).getByRole('button', { name: 'Détails' }))
    const boite = within(dialogue())
    expect(boite.getByLabelText('Phase')).toHaveValue('')
    expect(boite.getByLabelText('Phase')).toHaveDisplayValue('— Non précisée —')
    expect(boite.getByLabelText('Mandat')).toHaveDisplayValue('— Non renseigné —')
    expect(indicationMandat()).not.toMatch(/🔵/)
    await enregistrer()
    const [ligne] = await ajDb.sinistres.toArray()
    expect(ligne.phase).toBeNull()
    expect(ligne.mandatId).toBeNull()
  })

  it('un n° qui n’est pas un texte (ligne illisible) ne bloque pas une déclaration numérotée', async () => {
    await insererLigne({ type: 'Vol', dateSurvenance: survenance, numero: 12 })
    const { push } = await rendre()
    expect(screen.getByText('1 fiche de la base non affichée')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Déclarer un sinistre/ }))
    expect(within(dialogue()).getByLabelText('N°')).toHaveValue('RA.00001')
    remplirEssentiel('Incendie')
    await enregistrer()
    expect(push.mock.calls.at(-1)?.[0]).toMatchObject({ kind: 'success', title: 'Sinistre enregistré' })
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(await ajDb.sinistres.count()).toBe(2)
  })

  it('le n° texte d’une ligne illisible n’est pas reproposé ; ressaisi, il est refusé dans la fiche (sans toast)', async () => {
    await insererLigne({ type: 'Vol', dateSurvenance: survenance, origine: null, numero: 'RA.00001' })
    const { push } = await rendre()
    fireEvent.click(screen.getByRole('button', { name: /Déclarer un sinistre/ }))
    const boite = within(dialogue())
    expect(boite.getByLabelText('N°')).toHaveValue('RA.00002')
    remplirEssentiel('Incendie')
    fireEvent.change(boite.getByLabelText('N°'), { target: { value: 'RA.00001' } })
    await enregistrer()
    expect(boite.getByRole('group', { name: 'Erreurs de la fiche' }).textContent).toContain(
      'Numéro RA.00001 déjà attribué à un autre sinistre.',
    )
    expect(push).not.toHaveBeenCalled()
    expect(await ajDb.sinistres.count()).toBe(1)
  })
})

describe('Sinistres en mode réel — mandat choisi conservé', () => {
  it('« — Non renseigné — » choisi à la déclaration : conservé quand la fiche est modifiée par « Détails »', async () => {
    await rendre()
    fireEvent.click(screen.getByRole('button', { name: /Déclarer un sinistre/ }))
    const boite = within(dialogue())
    expect(boite.getByLabelText('Mandat')).toHaveValue(useDonneesStore.getState().mandats[0].id)
    expect(indicationMandat()).toMatch(/^🔵 Proposé/)
    remplirEssentiel('Incendie')
    fireEvent.change(boite.getByLabelText('Mandat'), { target: { value: '' } })
    await enregistrer()
    expect((await ajDb.sinistres.toArray())[0].mandatId).toBeNull()

    fireEvent.click(within(lignesTableau()[0]).getByRole('button', { name: 'Détails' }))
    const detail = within(dialogue())
    expect(detail.getByLabelText('Mandat')).toHaveDisplayValue('— Non renseigné —')
    expect(indicationMandat()).not.toMatch(/🔵/)
    fireEvent.change(detail.getByLabelText('Phase'), { target: { value: 'Déclaration' } })
    await enregistrer()
    const [modifiee] = await ajDb.sinistres.toArray()
    expect(modifiee).toMatchObject({ phase: 'Déclaration', mandatId: null })
  })

  it('« Détails » puis changement de copropriété : le seul mandat de la nouvelle copropriété est proposé, marqué 🔵', async () => {
    await useDonneesStore.getState().createCopropriete({
      nom: 'Villa Bleue',
      adresse: '2 rue de l’Exemple, 75000 Paris',
      nbLots: 4,
      rg: '26/00002',
      fondement: 'art. 46 — carence',
    })
    await rendre()
    fireEvent.click(screen.getByRole('button', { name: /Déclarer un sinistre/ }))
    remplirEssentiel('Incendie')
    await enregistrer()
    const [creee] = await ajDb.sinistres.toArray()
    expect(creee.mandatId).not.toBeNull()

    fireEvent.click(within(lignesTableau()[0]).getByRole('button', { name: 'Détails' }))
    const detail = within(dialogue())
    expect(detail.getByLabelText('Mandat')).toHaveValue(creee.mandatId)
    expect(indicationMandat()).not.toMatch(/🔵/)
    fireEvent.change(detail.getByRole('combobox', { name: 'Copropriété' }), { target: { value: 'Villa Bleue' } })
    const villaBleue = useDonneesStore.getState().coproprietes.find((copro) => copro.nom === 'Villa Bleue')
    const mandatVilla = useDonneesStore.getState().mandats.find((mandat) => mandat.coproprieteId === villaBleue?.id)
    expect(detail.getByLabelText('Mandat')).toHaveValue(mandatVilla?.id)
    expect(indicationMandat()).toMatch(/^🔵 Proposé/)
  })
})
