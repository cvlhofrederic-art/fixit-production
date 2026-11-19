import { describe, expect, it } from 'vitest'
import { enchainer, etatEtape, realiserEtape, type Etape, type EtapeTypeProcessus } from '@/lib/administrateur-judiciaire/domain/etapes'
import {
  creerEtapeDossier,
  enchainerEtapeDossier,
  programmerEtape,
  realiserEtapeDossier,
} from '@/lib/administrateur-judiciaire/domain/etapes-dossier'
import {
  DOSSIERS_OUTILLES,
  TYPES_ETAPES_PAR_DOSSIER,
  TYPE_ETAPE_COMMUN,
  fixerDelaiEtapeModele,
  instancierModele,
  modeleDuDossier,
  modeleReprise,
  processusDuDossier,
  processusDuModele,
} from '@/lib/administrateur-judiciaire/domain/modeles-etapes'
import {
  depuisEtapes,
  depuisEtapesAutomatiques,
  planSemaine,
  reglageParDefaut,
  selectionnerAFaire,
  type AffectationMandat,
  type NatureSuivi,
  type ReglageSuivi,
} from '@/lib/administrateur-judiciaire/domain/suivi-a-faire'
import { enTeteDuModule } from './en-tete-module'

/**
 * Réponse de Frédéric du 17/11/2026 (page de validation), registre J76 : aucun délai par défaut entre les étapes des
 * dossiers Sinistre et Contentieux ; le cabinet saisit les siens, délais de gestion, jamais présentés comme légaux.
 */

const etapeSimple = (): Etape => ({
  id: 'e-1',
  titre: 'A',
  etapeType: 'A',
  demandeurId: 'collab-A',
  realisateurId: null,
  validateurId: null,
  limite: null,
  alerteSecurite: null,
  faitLe: null,
  valideeLe: null,
  validationSansObjet: false,
  compteRendu: '',
})

const declarationRealisee = (etapeType: string) =>
  realiserEtapeDossier(
    creerEtapeDossier({
      id: 's-1',
      titre: 'Déclaration sinistre',
      etapeType,
      creeeLe: '2026-11-02',
      origine: 'manuelle',
      creeeParId: 'collab-A',
      demandeurId: 'collab-A',
      demandeurNature: 'collaborateur',
      realisateurId: 'collab-B',
    }),
    { date: '2026-11-03', compteRendu: '' },
  ).etape

/** Étape enchaînée du sinistre, sans délai saisi : ni limite, ni « à faire le », ni alerte (J76). */
const informationSansDelai = () => {
  const processus = processusDuDossier('Sinistre')
  return enchainerEtapeDossier(declarationRealisee(processus[0].etapeType), processus, {
    id: 's-2',
    date: '2026-11-03',
    creeeParId: 'collab-A',
  })!
}

/** Mardi, mercredi, samedi, dimanche, un mois et un an plus tard. */
const JOURS = ['2026-11-03', '2026-11-04', '2026-11-07', '2026-11-08', '2026-12-01', '2027-11-03']

const AFFECTATIONS: AffectationMandat[] = [{ mandatId: 'M1', cabinetId: null, responsableId: 'collab-R', comptableId: null, assistantId: null }]

/** Seule la famille Étapes suivie, au périmètre du portefeuille, à l'horizon « Maintenant », pour les critères donnés. */
const reglageEtapes = (collaborateurId: string, natures: NatureSuivi[] | null): ReglageSuivi => ({
  collaborateurId,
  familles: { etapes: { actif: true, perimetre: 'portefeuille', horizon: { unite: 'maintenant' }, natures } },
})

describe('J76 — aucun délai par défaut entre les étapes (réponse de Frédéric du 17/11/2026)', () => {
  it('référentiel : aucun délai (null) pour les types du sinistre, du contentieux et le type commun', () => {
    const tous = [...TYPES_ETAPES_PAR_DOSSIER.Contentieux, ...TYPES_ETAPES_PAR_DOSSIER.Sinistre, TYPE_ETAPE_COMMUN]
    expect(tous.map((t) => t.delaiJours)).toEqual(tous.map(() => null))
  })

  it('processusDuDossier : aucun délai (null), usage « Copie au CS » actif ou non', () => {
    for (const dossier of DOSSIERS_OUTILLES)
      for (const copieAuCsPourInfo of [false, true])
        expect(
          processusDuDossier(dossier, { copieAuCsPourInfo }).map((p) => p.delaiJours),
          `${dossier}, copie ${copieAuCsPourInfo}`,
        ).toEqual(processusDuDossier(dossier, { copieAuCsPourInfo }).map(() => null))
  })

  it('etapes.enchainer : sans délai saisi, l’étape enchaînée n’a pas de limite ; un délai saisi, 0 compris, fixe la limite', () => {
    const faite = realiserEtape(etapeSimple(), { date: '2026-11-03', compteRendu: '' })
    const processus = (delaiJours: number | null): EtapeTypeProcessus[] => [
      { etapeType: 'A', titre: 'A', delaiJours: null },
      { etapeType: 'B', titre: 'B', delaiJours },
    ]
    const sansDelai = enchainer(faite, processus(null), { id: 'e-2' })
    expect(sansDelai).toMatchObject({ id: 'e-2', etapeType: 'B', limite: null, faitLe: null })
    for (const jour of ['2026-11-03', '2026-11-04', '2027-11-03']) expect(etatEtape(sansDelai!, jour).enRetard, jour).toBe(false)
    // Délai saisi par le cabinet : délai de gestion, la limite est fixée (0 jour : le jour de la réalisation).
    expect(enchainer(faite, processus(0), { id: 'e-2' })?.limite).toBe('2026-11-03')
    expect(enchainer(faite, processus(7), { id: 'e-2' })?.limite).toBe('2026-11-10')
  })

  it('processusDuDossier passé à l’enchaînement : l’étape suivante n’a pas de limite et n’est jamais en retard', () => {
    const processus = processusDuDossier('Sinistre')
    const information = enchainerEtapeDossier(declarationRealisee(processus[0].etapeType), processus, {
      id: 's-2',
      date: '2026-11-03',
      creeeParId: 'collab-A',
    })!
    expect(information.titre).toBe('Information lésé')
    expect(information.limite).toBeNull()
    for (const jour of ['2026-11-03', '2026-11-04', '2027-11-03']) expect(etatEtape(information, jour).enRetard, jour).toBe(false)
  })

  it('processusDuModele : un délai non saisi reste null, première étape comprise ; enchaînée, l’étape n’a pas de limite', () => {
    const modele = fixerDelaiEtapeModele(modeleDuDossier('Sinistre', { id: 'm-sin', titre: 'Sinistre' }), 'sinistre.information_lese', 7)
    const processus = processusDuModele(modele)
    expect(processus[0].delaiJours).toBeNull()
    expect(processus[1]).toEqual({ etapeType: 'sinistre.information_lese', titre: 'Information lésé', delaiJours: 7 })
    expect(processus.filter((p) => p.delaiJours === null)).toHaveLength(13)
    const information = enchainerEtapeDossier(declarationRealisee(processus[0].etapeType), processus, {
      id: 's-2',
      date: '2026-11-03',
      creeeParId: 'collab-A',
    })!
    expect(information.limite).toBe('2026-11-10')
    const informationFaite = realiserEtapeDossier(information, { date: '2026-11-05', compteRendu: '' }).etape
    const intervention = enchainerEtapeDossier(informationFaite, processus, { id: 's-3', date: '2026-11-05', creeeParId: 'collab-A' })!
    expect(intervention.titre).toBe("Demande d'intervention")
    expect(intervention.limite).toBeNull()
    // Modèle de reprise, sans délai de gestion : converti sans refus, aucun délai inventé.
    expect(processusDuModele(modeleReprise()).map((p) => p.delaiJours)).toEqual(modeleReprise().etapes.map(() => null))
  })

  it('en-têtes : le suivi des étapes sans délai est la proposition de Hugo du 19/11/2026, codée, à valider par Frédéric (question n° 6)', () => {
    const { texte, item } = enTeteDuModule('modeles-etapes')
    // J20 : la liste instanciée remonte par sa limite, quand elle en a une ; sans délai saisi, « sans délai ».
    expect(item('- J20 : instancier une liste')).toMatch(
      /par sa limite, quand elle en a une ; sans délai saisi, elle y remonte chaque jour, marquée « sans délai », jamais en retard.*question n° 6/,
    )
    expect(item('- J76 (réponse de Frédéric du 17/11/2026')).toMatch(/suivi « à faire ».*« sans délai ».*question n° 6/)
    expect(item('- J76 (réponse de Frédéric du 17/11/2026')).not.toMatch(/ne remonte donc jamais/)
    expect(texte).toMatch(
      /6\. Proposition de Hugo du 19\/11\/2026, codée, à valider par Frédéric avant fusion \(registre J76, point de contact avec J20\).*suivi « à faire ».*date de référence.*« sans délai ».*jamais en retard/,
    )
    expect(texte).toMatch(/6\. Proposition de Hugo.*étape automatique.*depuisEtapesAutomatiques/)
    expect(texte).not.toContain('6. Hugo ou Frédéric (registre J76')
    expect(texte).not.toContain("Rien n'est tranché ici")
    const etapes = enTeteDuModule('etapes').texte
    expect(etapes).toMatch(/remonte au suivi « à faire ».*« sans délai ».*jamais en retard.*proposition de Hugo du 19\/11\/2026, à valider par Frédéric.*question n° 6/)
    expect(etapes).not.toContain('ne remonte alors pas au suivi « à faire »')
    const suivi = enTeteDuModule('suivi-a-faire').texte
    expect(suivi).toMatch(/Étapes \(point 48.*sans aucune date.*« sans délai ».*jamais en retard.*proposition de Hugo du 19\/11\/2026, à valider par Frédéric/)
  })

  it('en-tête de modeles-etapes.ts : J76 cité, question n° 1 fermée, n° 2 fermée en partie (base du délai et replanification ouvertes)', () => {
    const { texte, item } = enTeteDuModule('modeles-etapes')
    const j76 = item('- J76 (réponse de Frédéric du 17/11/2026')
    expect(j76).toMatch(/aucun délai par défaut/)
    expect(j76).toMatch(/jamais présenté comme légal/)
    expect(texte).toContain('1. Fermée par J76')
    expect(texte).toContain('2. En partie fermée par J76')
    expect(texte).toMatch(/limite de l'étape précédente.*réalisation.*replanifier/)
    expect(texte).not.toContain('délais du référentiel : 0 jour')
    expect(texte).not.toContain('délais de gestion par défaut des processus Sinistre et Contentieux')
  })

  it('en-tête et type d’etapes.ts : sans délai saisi (null), l’étape enchaînée n’a pas de limite (J76)', () => {
    const { texte } = enTeteDuModule('etapes')
    expect(texte).toMatch(/null.*pas de limite.*J76/)
  })
})

describe('J76, question n° 6 — étape sans délai au suivi « à faire » (proposition de Hugo du 19/11/2026, à valider par Frédéric)', () => {
  it('étape enchaînée sans délai saisi : émise à la date de référence, nature « à faire », pour son réalisateur, id stable', () => {
    // Point de contact avec J20 : l'étape enchaînée est d'origine « manuelle », donc hors de la règle des N jours.
    const information = informationSansDelai()
    expect(information).toMatchObject({ origine: 'manuelle', limite: null, aFaireLe: null, alerteSecurite: null, realisateurId: 'collab-B' })
    for (const jour of JOURS) {
      expect(depuisEtapesAutomatiques([{ mandatId: 'M1', etape: information }], jour), jour).toEqual([])
      expect(depuisEtapes([{ mandatId: 'M1', etape: information }], jour), jour).toEqual([
        {
          id: 'etapes:s-2:a_faire',
          famille: 'etapes',
          nature: 'a_faire',
          libelle: 'Information lésé — sans délai',
          date: jour,
          mandatId: 'M1',
          objetId: 's-2',
          assigneId: 'collab-B',
          aConfirmer: false,
        },
      ])
    }
  })

  it('jamais en retard, sur plusieurs jours : due le jour même, jamais dans « Avant » de la semaine du jour', () => {
    const information = informationSansDelai()
    for (const jour of JOURS) {
      const elements = depuisEtapes([{ mandatId: 'M1', etape: information }], jour)
      expect(elements.map((e) => e.date < jour), jour).toEqual([false])
      const semaine = planSemaine(elements, jour)
      expect(semaine.avant, jour).toEqual([])
      expect(semaine.jours.flatMap((j) => j.elements.map((e) => e.id)), jour).toEqual(['etapes:s-2:a_faire'])
      expect(etatEtape(information, jour).enRetard, jour).toBe(false)
    }
    // Un jour de semaine : dans la colonne du jour. Samedi : au vendredi qui précède, comme tout élément du week-end.
    expect(planSemaine(depuisEtapes([{ mandatId: 'M1', etape: information }], '2026-11-04'), '2026-11-04').jours[2]).toMatchObject({
      date: '2026-11-04',
      elements: [{ id: 'etapes:s-2:a_faire' }],
    })
    expect(planSemaine(depuisEtapes([{ mandatId: 'M1', etape: information }], '2026-11-07'), '2026-11-07').jours[4]).toMatchObject({
      date: '2026-11-06',
      elements: [{ id: 'etapes:s-2:a_faire' }],
    })
  })

  it('libellé marqué « sans délai », sur le modèle des étapes automatiques ; liste instanciée sans délai : chaque étape marquée', () => {
    expect(depuisEtapes([{ mandatId: 'M1', etape: informationSansDelai() }], '2026-11-04').map((e) => e.libelle)).toEqual([
      'Information lésé — sans délai',
    ])
    // Liste de contrôle du contentieux, instanciée sans délai saisi (J20 : étapes « manuelles », sans limite).
    const liste = instancierModele(modeleDuDossier('Contentieux', { id: 'm-ctx', titre: 'Contentieux' }), {
      ids: ['c-1', 'c-2'],
      creeeParId: 'collab-A',
      dossierId: 'C-3',
      depart: '2026-11-03',
      demandeurId: 'collab-A',
      demandeurNature: 'collaborateur',
      realisateurId: 'collab-B',
    })
    expect(liste.etapes.map((e) => e.limite)).toEqual([null, null])
    expect(
      depuisEtapes(
        liste.etapes.map((etape) => ({ mandatId: 'M1', etape })),
        '2026-11-04',
      ).map((e) => [e.id, e.date, e.libelle]),
    ).toEqual(liste.etapes.map((e) => [`etapes:${e.id}:a_faire`, '2026-11-04', `${e.titre} — sans délai`]))
  })

  it('retenue par selectionnerAFaire à l’horizon « Maintenant » : réalisateur désigné et portefeuille, critère « À faire »', () => {
    const information = informationSansDelai()
    for (const jour of JOURS) {
      const elements = depuisEtapes([{ mandatId: 'M1', etape: information }], jour)
      // Réglage par défaut (toutes les familles, horizon « Maintenant ») : le réalisateur (désigné) et le responsable du mandat.
      for (const collaborateur of ['collab-B', 'collab-R'])
        expect(selectionnerAFaire(elements, reglageParDefaut(collaborateur), AFFECTATIONS, jour).map((e) => e.id), `${collaborateur}, ${jour}`).toEqual([
          'etapes:s-2:a_faire',
        ])
      // Hors portefeuille et non désigné : non retenue.
      expect(selectionnerAFaire(elements, reglageParDefaut('collab-Z'), AFFECTATIONS, jour), jour).toEqual([])
      // Le critère « À faire » de la famille Étapes la retient ; « Étape automatique non réalisée » seul, non.
      expect(selectionnerAFaire(elements, reglageEtapes('collab-B', ['a_faire']), AFFECTATIONS, jour), jour).toHaveLength(1)
      expect(selectionnerAFaire(elements, reglageEtapes('collab-B', ['automatique_non_realisee']), AFFECTATIONS, jour), jour).toEqual([])
    }
  })

  it('pas de doublon : une étape automatique sans date reste suivie par sa seule relance à N jours (J20, tranche 43)', () => {
    const automatique = creerEtapeDossier({
      id: 'a-1',
      titre: 'Copie au CS pour info',
      creeeLe: '2026-11-03',
      origine: 'automatique',
      demandeurId: 'collab-A',
      demandeurNature: 'collaborateur',
      realisateurId: 'collab-B',
    })
    expect(automatique).toMatchObject({ limite: null, aFaireLe: null, alerteSecurite: null })
    for (const jour of JOURS) {
      const items = [{ mandatId: 'M1', etape: automatique }]
      expect(depuisEtapes(items, jour), jour).toEqual([])
      expect([...depuisEtapes(items, jour), ...depuisEtapesAutomatiques(items, jour)].map((e) => [e.id, e.date]), jour).toEqual([
        ['etapes:a-1:automatique_non_realisee', '2026-12-03'],
      ])
    }
  })

  it('étape datée inchangée : à sa date la plus proche, sans marque, en retard une fois la date passée ; à valider inchangée', () => {
    const processus = processusDuDossier('Sinistre').map((p, i) => (i === 1 ? { ...p, delaiJours: 7 } : p))
    const datee = enchainerEtapeDossier(declarationRealisee(processus[0].etapeType), processus, {
      id: 's-2',
      date: '2026-11-03',
      creeeParId: 'collab-A',
    })!
    // Délai saisi par le cabinet : la limite la fait remonter, avant comme après la limite.
    for (const jour of ['2026-11-04', '2026-11-20'])
      expect(depuisEtapes([{ mandatId: 'M1', etape: datee }], jour).map((e) => [e.id, e.date, e.libelle]), jour).toEqual([
        ['etapes:s-2:a_faire', '2026-11-10', 'Information lésé'],
      ])
    expect(etatEtape(datee, '2026-11-20').enRetard).toBe(true)
    // « À faire le » seul : à cette date, sans marque.
    const programmee = programmerEtape(informationSansDelai(), { aFaireLe: '2026-11-12' })
    expect(depuisEtapes([{ mandatId: 'M1', etape: programmee }], '2026-11-04').map((e) => [e.date, e.libelle])).toEqual([
      ['2026-11-12', 'Information lésé'],
    ])
    // Étape automatique avec une limite : remonte par sa limite, comme avant.
    const automatiqueDatee = creerEtapeDossier({
      id: 'a-2',
      titre: 'Copie au CS pour info',
      creeeLe: '2026-11-03',
      origine: 'automatique',
      demandeurId: 'collab-A',
      demandeurNature: 'collaborateur',
      realisateurId: 'collab-B',
      limite: '2026-11-09',
    })
    expect(depuisEtapes([{ mandatId: 'M1', etape: automatiqueDatee }], '2026-11-04').map((e) => [e.id, e.date, e.libelle])).toEqual([
      ['etapes:a-2:a_faire', '2026-11-09', 'Copie au CS pour info'],
    ])
    // À valider : pour son validateur, à sa réalisation, sans marque (étape sans délai comprise).
    const aValider = realiserEtapeDossier({ ...informationSansDelai(), validateurId: 'collab-V' }, { date: '2026-11-05', compteRendu: '' }).etape
    expect(depuisEtapes([{ mandatId: 'M1', etape: aValider }], '2026-11-06')).toEqual([
      expect.objectContaining({ id: 'etapes:s-2:a_valider', nature: 'a_valider', date: '2026-11-05', libelle: 'Information lésé', assigneId: 'collab-V' }),
    ])
  })
})
