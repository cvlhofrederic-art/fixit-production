import { describe, expect, it } from 'vitest'
import { construireChoixSinistre } from '@/components/administrateur-judiciaire/modules/technique/sinistres/choix-sinistre'
import {
  evaluerFicheSinistre,
  valeursAvecContrat,
  valeursAvecCopro,
  valeursDepuisFiche,
  valeursNouvelleDeclaration,
  type ValeursFicheSinistre,
} from '@/components/administrateur-judiciaire/modules/technique/sinistres/formulaire-sinistre'
import type { Contrat } from '@/lib/administrateur-judiciaire/db/schema'
import { ficheDepuisEnregistrement } from '@/lib/administrateur-judiciaire/domain/fiche-sinistre'

/**
 * Logique du formulaire de la fiche sinistre (fonctions pures) : reprise de la compagnie et du n° de police du contrat
 * choisi (et leur effacement au changement de contrat ou de copropriété), phase « non précisée », erreurs rattachées
 * aux champs, contrats d'assurance proposés.
 */

const AUJOURDHUI = '2026-11-06'

const MULTIRISQUE = { id: 'k-mri', compagnie: 'Generali', compagnieId: 'cie-generali', numeroPolice: 'MRI-44120' }
const PROTECTION_JURIDIQUE = { id: 'k-pj', compagnie: 'MMA', compagnieId: 'cie-mma', numeroPolice: null }
const DOMMAGES_OUVRAGE = { id: 'k-do', compagnie: 'SMABTP', compagnieId: 'cie-smabtp', numeroPolice: 'DO-77' }

const declaration = (surcharge: Partial<ValeursFicheSinistre> = {}): ValeursFicheSinistre => ({
  ...valeursNouvelleDeclaration({ coproprieteId: 'C3', mandatId: '', numero: 'TL.00010', aujourdhui: AUJOURDHUI }),
  ...surcharge,
})

describe('formulaire sinistre — reprise de la compagnie et du n° de police du contrat choisi', () => {
  it('premier contrat : compagnie et police reprises', () => {
    const valeurs = valeursAvecContrat(declaration(), MULTIRISQUE, null)
    expect(valeurs).toMatchObject({ contratId: 'k-mri', compagnie: { id: 'cie-generali', nom: 'Generali' }, contrat: 'MRI-44120' })
  })

  it('changer de contrat remplace les valeurs reprises du contrat précédent (police effacée si le nouveau n’en a pas)', () => {
    const apresMri = valeursAvecContrat(declaration(), MULTIRISQUE, null)
    const apresPj = valeursAvecContrat(apresMri, PROTECTION_JURIDIQUE, MULTIRISQUE)
    expect(apresPj).toMatchObject({ contratId: 'k-pj', compagnie: { id: 'cie-mma', nom: 'MMA' }, contrat: '' })
    const apresDo = valeursAvecContrat(apresPj, DOMMAGES_OUVRAGE, PROTECTION_JURIDIQUE)
    expect(apresDo).toMatchObject({ contratId: 'k-do', compagnie: { id: 'cie-smabtp', nom: 'SMABTP' }, contrat: 'DO-77' })
  })

  it('une compagnie ou une police saisies (différentes des valeurs reprises) sont conservées', () => {
    const apresMri = valeursAvecContrat(declaration(), MULTIRISQUE, null)
    const saisies = { ...apresMri, compagnie: { id: null, nom: 'Compagnie saisie' }, contrat: 'POL-SAISIE' }
    expect(valeursAvecContrat(saisies, PROTECTION_JURIDIQUE, MULTIRISQUE)).toMatchObject({
      contratId: 'k-pj',
      compagnie: { id: null, nom: 'Compagnie saisie' },
      contrat: 'POL-SAISIE',
    })
  })

  it('« — Aucun — » : contrat retiré avec les valeurs qui en avaient été reprises', () => {
    const apresMri = valeursAvecContrat(declaration(), MULTIRISQUE, null)
    expect(valeursAvecContrat(apresMri, null, MULTIRISQUE)).toMatchObject({
      contratId: '',
      compagnie: { id: null, nom: '' },
      contrat: '',
    })
  })

  it('changer de copropriété efface le contrat et les valeurs qui en avaient été reprises ; une saisie est conservée', () => {
    const numeroPropose = () => null
    const apresMri = valeursAvecContrat(declaration(), MULTIRISQUE, null)
    expect(
      valeursAvecCopro(apresMri, 'C1', { mandatId: '', numeroPropose, contratPrecedent: MULTIRISQUE }),
    ).toMatchObject({ coproprieteId: 'C1', contratId: '', compagnie: { id: null, nom: '' }, contrat: '' })
    const saisie = { ...apresMri, compagnie: { id: null, nom: 'Compagnie saisie' } }
    expect(
      valeursAvecCopro(saisie, 'C1', { mandatId: '', numeroPropose, contratPrecedent: MULTIRISQUE }),
    ).toMatchObject({ contratId: '', compagnie: { id: null, nom: 'Compagnie saisie' }, contrat: '' })
  })
})

describe('formulaire sinistre — phase « non précisée »', () => {
  it('une fiche sans phase s’ouvre sans phase et s’enregistre sans phase (jamais « Général » d’office)', () => {
    const relue = ficheDepuisEnregistrement({ coproprieteId: 'C1', type: 'Vol', dateSurvenance: '2026-10-01', phase: null })
    if (!relue) throw new Error('ligne illisible')
    const valeurs = valeursDepuisFiche(relue)
    expect(valeurs.phase).toBe('')
    expect(evaluerFicheSinistre(valeurs, { aujourdhui: AUJOURDHUI }).saisie?.phase).toBeNull()
  })

  it('une nouvelle déclaration part de « Général »', () => {
    expect(declaration().phase).toBe('Général')
  })
})

describe('formulaire sinistre — mandat d’une fiche existante', () => {
  const relire = (ligne: { mandatId: string | null }) => {
    const relue = ficheDepuisEnregistrement({ coproprieteId: 'C1', type: 'Vol', dateSurvenance: '2026-10-01', ...ligne })
    if (!relue) throw new Error('ligne illisible')
    return relue
  }

  it('fiche sans mandat (« — Non renseigné — » enregistré) : s’ouvre et s’enregistre sans mandat, jamais rattachée d’office', () => {
    const valeurs = valeursDepuisFiche(relire({ mandatId: null }))
    expect(valeurs.mandatId).toBe('')
    expect(evaluerFicheSinistre(valeurs, { aujourdhui: AUJOURDHUI }).saisie?.mandatId).toBeNull()
  })

  it('fiche rattachée à un mandat : le mandat enregistré est repris', () => {
    expect(valeursDepuisFiche(relire({ mandatId: 'M7' })).mandatId).toBe('M7')
  })
})

describe('formulaire sinistre — erreurs rattachées aux champs', () => {
  it('type, survenance et montant illisible : une erreur par champ', () => {
    const evaluation = evaluerFicheSinistre(declaration({ indemniteImmediate: '12,345' }), { aujourdhui: AUJOURDHUI })
    expect(evaluation.saisie).toBeNull()
    expect(Object.keys(evaluation.erreursChamps).sort()).toEqual(['dateSurvenance', 'indemniteImmediate', 'type'])
    expect(evaluation.erreursChamps.type).toMatch(/type de sinistre/i)
  })

  it('anomalies bloquantes du domaine rattachées à leur champ (statut, clôture, copropriété)', () => {
    const evaluation = evaluerFicheSinistre(
      declaration({ type: 'Vol', dateSurvenance: '2026-10-01', dateOuverture: '2026-10-02', statut: 'Terminé', coproprieteId: '' }),
      { aujourdhui: AUJOURDHUI },
    )
    expect(evaluation.erreursChamps.statut).toMatch(/Clos le/)
    expect(evaluation.erreursChamps.coproprieteId).toMatch(/copropriété/)
  })

  it('alerte du contrat choisi reprise dans les points d’attention', () => {
    const valeurs = valeursAvecContrat(declaration({ type: 'Vol', dateSurvenance: '2026-10-01' }), PROTECTION_JURIDIQUE, null)
    const evaluation = evaluerFicheSinistre(
      { ...valeurs, compagnie: { id: null, nom: 'Generali' } },
      { aujourdhui: AUJOURDHUI, contratChoisi: PROTECTION_JURIDIQUE },
    )
    expect(evaluation.saisie).not.toBeNull()
    expect(evaluation.alertes.join(' ')).toMatch(/Generali.*MMA/)
  })
})

describe('liste « Contrat » : contrats d’assurance de la copropriété (données réelles)', () => {
  const contrat = (id: string, type: Contrat['type']): Contrat =>
    ({ id, coproprieteId: 'copro-1', type, prestataireId: null, intitule: id }) as unknown as Contrat

  it('assurance, dommages-ouvrage, loyers impayés et garantie vacance locative ; jamais un contrat de prestation', () => {
    const choix = construireChoixSinistre('reel', {
      copros: [{ id: 'copro-1', code: 'RA', nom: 'Résidence des Acacias' }],
      mandats: [],
      contrats: [
        contrat('k-assurance', 'Assurance'),
        contrat('k-do', 'Dommages Ouvrages'),
        contrat('k-gli', 'Assurance loyer impayé'),
        contrat('k-gvl', 'Garantie vacance locative'),
        contrat('k-maintenance', 'Maintenance'),
      ],
      prestataires: [],
      lots: [],
      coproprietaires: [],
    })
    expect(choix.contratsDe('copro-1').map((option) => option.id)).toEqual(['k-assurance', 'k-do', 'k-gli', 'k-gvl'])
  })
})
