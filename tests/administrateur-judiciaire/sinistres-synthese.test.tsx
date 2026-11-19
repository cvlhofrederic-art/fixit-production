import './fuseau-paris'
import 'fake-indexeddb/auto'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { SinistresModule } from '@/components/administrateur-judiciaire/modules/technique/SinistresModule'
import {
  evaluerFicheSinistre,
  valeursDepuisFiche,
} from '@/components/administrateur-judiciaire/modules/technique/sinistres/formulaire-sinistre'
import { SyntheseSinistre } from '@/components/administrateur-judiciaire/modules/technique/sinistres/SyntheseSinistre'
import { ToastContext, type ToastApi } from '@/components/administrateur-judiciaire/ui/toast'
import { useDonneesStore } from '@/lib/administrateur-judiciaire/db/donnees-store'
import { viderBaseLocale } from '@/lib/administrateur-judiciaire/db/reset'
import { initialiserBaseDemo } from '@/lib/administrateur-judiciaire/db/seed-demo'
import { controlerDelaiDeclaration } from '@/lib/administrateur-judiciaire/domain/declaration-sinistre'
import { formatEurosCentimes } from '@/lib/administrateur-judiciaire/domain/format'
import {
  creerSinistre,
  etapeSuiviSinistre,
  reperesDelaisSinistre,
  type FicheSinistre,
  type SaisieSinistre,
} from '@/lib/administrateur-judiciaire/domain/sinistres'
import { CLE_STOCKAGE_MODE } from '@/lib/administrateur-judiciaire/mode'
import { useSelectionDossier } from '@/lib/administrateur-judiciaire/selection'

/**
 * Synthèse en tête de la fiche sinistre (plan § 6) : frise des étapes (etapeSuiviSinistre), indemnités
 * (indemnitesSinistre), repères de délai (reperesDelaisSinistre) et état du délai de déclaration
 * (controlerDelaiDeclaration). Les attentes lisent ce que rend le domaine, sans retaper ses libellés quand il les
 * fournit. Entrées non enregistrées : délai du contrat (minimum légal), courriers de déclaration (aucun), date de
 * l'arrêté de catastrophe naturelle (pas de repère). Décision #699 : aucun délai entre étapes affiché par défaut.
 */

vi.mock('next/dynamic', () => ({
  default: () =>
    function EcranFactice() {
      return null
    },
}))

const AUJOURDHUI = '2026-06-04'

/** Fiche fictive : dégât des eaux déclaré trois jours après la survenance, expertise datée. */
const BASE: SaisieSinistre = {
  coproprieteId: 'copro-fictive',
  type: 'Dégât des eaux',
  phase: "Mission d'expertise",
  dateSurvenance: '2026-04-14',
  dateConnaissance: null,
  dateDeclaration: '2026-04-17',
  dateExpertise: '2026-05-04',
  dateRapport: null,
  dateReglement: null,
  dateCloture: null,
  partiesCommunesLesees: true,
  partiesCommunesResponsables: true,
  origine: 'Fuite sur colonne d’eau froide',
  lieu: 'Cage B, 3e étage',
  dommages: 'Plafond du palier',
  assurance: { compagnie: 'Assureur (fictif)', courtier: null, contrat: null, numeroSinistre: 'S-0000' },
  indemniteImmediateCentimes: 180_000,
  indemniteImmediateReglee: true,
  indemniteDiffereeCentimes: 64_000,
  indemniteDiffereeReglee: false,
  causesSupprimees: true,
  reparationsFaites: false,
}

const ETAPES = ['À déclarer', 'Déclaré', 'Expertise', 'Rapport', 'Réglé', 'Clos']

const fiche = (surcharge: Partial<SaisieSinistre> = {}): FicheSinistre => creerSinistre({ ...BASE, ...surcharge })

/** Contrôle du délai tel que la synthèse le calcule : aucun courrier rattaché, aucune option enregistrée. */
const controle = (f: FicheSinistre) => controlerDelaiDeclaration({ id: 'fiche', fiche: f }, [], { aujourdhui: AUJOURDHUI })

function rendreSynthese(f: FicheSinistre) {
  render(<SyntheseSinistre fiche={f} aujourdhui={AUJOURDHUI} />)
  return screen.getByRole('region', { name: 'Synthèse' })
}

const etapes = (synthese: HTMLElement) =>
  within(within(synthese).getByRole('list', { name: 'Étapes du suivi' }))
    .getAllByRole('listitem')
    .map((item) => item.textContent)
const etapeCourante = (synthese: HTMLElement) => synthese.querySelector('[aria-current="step"]')?.textContent
/** Bandeau des repères de délai (Alert du module). */
const bandeau = (synthese: HTMLElement) => synthese.querySelector('.alert') as HTMLElement

afterEach(() => cleanup())

describe('Synthèse — frise des étapes', () => {
  it('étape tirée de la date la plus avancée : rapport daté sans expertise → « Rapport »', () => {
    const f = fiche({ dateExpertise: null, dateRapport: '2026-05-20', phase: 'Relances' })
    expect(etapeSuiviSinistre(f)).toBe('rapport')
    const synthese = rendreSynthese(f)
    expect(etapes(synthese)).toEqual(ETAPES)
    expect(etapeCourante(synthese)).toBe('Rapport')
    expect(synthese.querySelectorAll('[aria-current="step"]')).toHaveLength(1)
    expect(synthese.textContent).toContain('Phase Gestéam : Relances · Statut : En cours')
  })

  it('sans date de suivi : « À déclarer » ; « Clos le » daté : « Clos », statut « Terminé »', () => {
    expect(etapeCourante(rendreSynthese(fiche({ dateDeclaration: null, dateExpertise: null, phase: 'Général' })))).toBe(
      'À déclarer',
    )
    cleanup()
    const close = rendreSynthese(fiche({ dateRapport: '2026-05-20', dateReglement: '2026-05-25', dateCloture: '2026-05-30' }))
    expect(etapeCourante(close)).toBe('Clos')
    expect(close.textContent).toContain('Statut : Terminé')
  })
})

describe('Synthèse — indemnités', () => {
  it('total, réglé et reste à recevoir (indemnitesSinistre)', () => {
    const synthese = rendreSynthese(fiche())
    expect(synthese.textContent).toContain(`Total : ${formatEurosCentimes(2440)}`)
    expect(synthese.textContent).toContain(`Réglé : ${formatEurosCentimes(1800)}`)
    expect(synthese.textContent).toContain(`Reste à recevoir : ${formatEurosCentimes(640)}`)
  })
})

describe('Synthèse — repères de délai, présentés comme des signaux', () => {
  it('déclaration dans le repère : information, avec la justification du repère', () => {
    const f = fiche()
    const { message, etat } = controle(f)
    expect(etat).toBe('dans_le_delai')
    const alerte = bandeau(rendreSynthese(f))
    expect(alerte).toHaveClass('alert', 'info')
    expect(alerte.querySelector('b')?.textContent).toBe(message)
    expect(alerte.textContent).toContain(reperesDelaisSinistre(f).justificationDeclaration)
    expect(alerte.textContent).toContain('Signal indicatif, jamais une déchéance')
  })

  it('vol déclaré après le repère de 2 jours ouvrés : alerte de couleur rouille', () => {
    const f = fiche({ type: 'Vol', phase: 'Déclaration', dateSurvenance: '2026-05-05', dateDeclaration: '2026-05-12', dateExpertise: null })
    expect(controle(f).etat).toBe('tardive')
    const alerte = bandeau(rendreSynthese(f))
    expect(alerte).toHaveClass('alert', 'rust')
    expect(alerte.querySelector('b')?.textContent).toBe('Déclaration du 12/05/2026, postérieure au repère indicatif du 07/05/2026.')
    expect(alerte.textContent).toContain('Connaissance du 05/05/2026 + 2 jours ouvrés')
    expect(alerte.textContent).toContain('Signal indicatif, jamais une déchéance')
  })

  it('sinistre non déclaré, repère dépassé : alerte de couleur rouille', () => {
    const f = fiche({ dateDeclaration: null, dateExpertise: null, phase: 'Général' })
    expect(controle(f).etat).toBe('delai_depasse')
    const alerte = bandeau(rendreSynthese(f))
    expect(alerte).toHaveClass('rust')
    expect(alerte.querySelector('b')?.textContent).toBe('Sinistre non déclaré, repère indicatif du 21/04/2026 dépassé : déclarer sans attendre.')
  })

  it('dommages-ouvrage : « dès la connaissance », sans date au plus tard', () => {
    const f = fiche({ type: 'Dommages Ouvrage', dateDeclaration: null, dateExpertise: null, phase: 'Général' })
    expect(reperesDelaisSinistre(f).desLaConnaissance).toBe(true)
    expect(controle(f).etat).toBe('sans_repere')
    const alerte = bandeau(rendreSynthese(f))
    expect(alerte).toHaveClass('info')
    expect(alerte.textContent).toContain('à déclarer dès la connaissance')
    expect(alerte.textContent).toContain('Pas de repère, à confirmer.')
    expect(alerte.textContent).not.toContain('au plus tard le')
  })

  it('catastrophe naturelle sans date d’arrêté : pas de repère, à confirmer', () => {
    const f = fiche({ type: 'Catastrophes naturelles', dateDeclaration: null, dateExpertise: null, phase: 'Général' })
    const reperes = reperesDelaisSinistre(f)
    expect(controle(f).etat).toBe('sans_repere')
    const alerte = bandeau(rendreSynthese(f))
    expect(alerte.querySelector('b')?.textContent).toBe(controle(f).message)
    expect(alerte.textContent).toContain('Pas de repère.')
    expect(alerte.textContent).toContain(`Repère à confirmer : ${reperes.declarationAConfirmer}.`)
    // Le repère de cinq jours ouvrés du suivi « à faire » n'est pas repris : le contrôle n'a pas de repère.
    expect(alerte.textContent).not.toContain('au plus tard le')
  })

  it('vandalisme : un vol a pu y être rangé, repère à confirmer (2 jours ouvrés s’il y a eu vol)', () => {
    const f = fiche({ type: 'Vandalisme' })
    expect(reperesDelaisSinistre(f).volPossible).toBe(true)
    expect(bandeau(rendreSynthese(f)).textContent).toContain("Repère à confirmer : 2 jours ouvrés s'il y a eu vol.")
  })

  it('délai du contrat non enregistré : le repère est le minimum légal', () => {
    const f = fiche()
    expect(reperesDelaisSinistre(f).delaiDuContrat).toBe(false)
    expect(bandeau(rendreSynthese(f)).textContent).toContain('(minimum légal, C. assur. L. 113-2, 4°)')
  })

  it('prescription au plus tôt, présentée comme un repère ; garantie impayés : à confirmer', () => {
    const f = fiche({ type: 'Charges Impayées' })
    const reperes = reperesDelaisSinistre(f)
    const texte = rendreSynthese(f).textContent
    expect(texte).toContain(`Prescription, repère indicatif : ${reperes.justificationPrescription}`)
    expect(texte).toContain(`Prescription à confirmer : ${reperes.prescriptionAConfirmer}.`)
    expect(texte).toContain(`Repère à confirmer : ${reperes.declarationAConfirmer}.`)
  })

  it('aucun repère n’est présenté comme un délai légal ni comme une déchéance certaine', () => {
    for (const type of ['Dégât des eaux', 'Vol', 'Dommages Ouvrage', 'Catastrophes naturelles', 'Loyers Impayés'] as const) {
      const texte = rendreSynthese(fiche({ type })).textContent ?? ''
      expect(texte).not.toMatch(/délai légal/i)
      expect(texte).toContain('jamais une déchéance')
      cleanup()
    }
  })

  it('le contrôle de chronologie, déjà affiché par la fiche, n’est pas doublé', () => {
    const texte = rendreSynthese(fiche({ dateRapport: '2026-05-25', dateCloture: '2026-05-20' })).textContent
    expect(texte).not.toContain('avant une étape qui doit la précéder')
  })
})

describe('Synthèse — délais entre étapes (décision #699)', () => {
  it('sans délai saisi par le cabinet : aucun délai affiché entre les étapes', () => {
    const synthese = rendreSynthese(fiche({ dateRapport: '2026-05-20' }))
    expect(etapes(synthese)).toEqual(ETAPES)
    expect(synthese.textContent).not.toMatch(/délai de gestion|délai entre/i)
  })
})

describe('Synthèse — calculée sur la saisie en cours du formulaire', () => {
  it('evaluerFicheSinistre rend la fiche lue, même quand une anomalie bloque l’enregistrement', () => {
    const incoherente = valeursDepuisFiche(fiche({ dateRapport: '2026-05-25', dateCloture: '2026-05-20' }))
    const evaluation = evaluerFicheSinistre(incoherente, { aujourdhui: AUJOURDHUI })
    expect(evaluation.saisie).toBeNull()
    expect(evaluation.fiche?.dateCloture).toBe('2026-05-20')
    expect(evaluerFicheSinistre({ ...incoherente, type: '' }, { aujourdhui: AUJOURDHUI }).fiche).toBeNull()
  })
})

describe('Synthèse — dans la fiche sinistre (démonstration)', () => {
  beforeEach(async () => {
    localStorage.removeItem(CLE_STOCKAGE_MODE)
    await viderBaseLocale()
    await initialiserBaseDemo()
    useDonneesStore.setState({ loading: false })
    await useDonneesStore.getState().loadAll()
    useSelectionDossier.setState({ code: null, coproprietaireId: null })
  })

  function rendreEcran() {
    const push = vi.fn<ToastApi['push']>(() => undefined)
    render(
      <ToastContext.Provider value={{ push, dismiss: vi.fn() }}>
        <SinistresModule />
      </ToastContext.Provider>,
    )
  }
  const dialogue = () => screen.getByRole('dialog')
  const ouvrirDetails = (numero: string) => {
    const ligne = screen
      .queryAllByRole('row')
      .slice(1)
      .find((candidate) => candidate.textContent?.includes(numero))
    fireEvent.click(within(ligne as HTMLElement).getByRole('button', { name: 'Détails' }))
  }

  it('« Détails » : la synthèse est en tête de la fiche, avant les neuf blocs', () => {
    rendreEcran()
    ouvrirDetails('TL.00009')
    const regions = within(dialogue())
      .getAllByRole('region')
      .map((region) => region.getAttribute('aria-label'))
    expect(regions[0]).toBe('Synthèse')
    expect(regions).toHaveLength(10)
    expect(etapeCourante(within(dialogue()).getByRole('region', { name: 'Synthèse' }))).toBe('Expertise')
  })

  it('déclaration : aucune synthèse tant que le type et la survenance manquent, puis elle apparaît', () => {
    rendreEcran()
    fireEvent.click(screen.getByRole('button', { name: /Déclarer un sinistre/ }))
    const boite = within(dialogue())
    expect(boite.queryByRole('region', { name: 'Synthèse' })).toBeNull()
    fireEvent.change(boite.getByRole('combobox', { name: 'Type de sinistre' }), { target: { value: 'Vol' } })
    fireEvent.change(boite.getByLabelText(/^Sinistre \(survenance\)/), { target: { value: '2026-06-02' } })
    const synthese = boite.getByRole('region', { name: 'Synthèse' })
    expect(etapeCourante(synthese)).toBe('À déclarer')
    expect(bandeau(synthese).querySelector('b')?.textContent).toMatch(/^Sinistre à déclarer, repère indicatif au /)
  })

  it('une date de déclaration modifiée change aussitôt l’état du délai', () => {
    rendreEcran()
    ouvrirDetails('TL.00009')
    const boite = within(dialogue())
    const synthese = () => boite.getByRole('region', { name: 'Synthèse' })
    expect(bandeau(synthese())).toHaveClass('info')
    fireEvent.change(boite.getByLabelText('Déclaration'), { target: { value: '2026-05-04' } })
    expect(bandeau(synthese())).toHaveClass('rust')
    expect(bandeau(synthese()).querySelector('b')?.textContent).toMatch(/^Déclaration du 04\/05\/2026, postérieure au repère indicatif/)
  })
})
