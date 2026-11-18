import { describe, expect, it } from 'vitest'
import { enchainer, etatEtape, realiserEtape, type Etape, type EtapeTypeProcessus } from '@/lib/administrateur-judiciaire/domain/etapes'
import { creerEtapeDossier, enchainerEtapeDossier, realiserEtapeDossier } from '@/lib/administrateur-judiciaire/domain/etapes-dossier'
import {
  DOSSIERS_OUTILLES,
  TYPES_ETAPES_PAR_DOSSIER,
  TYPE_ETAPE_COMMUN,
  fixerDelaiEtapeModele,
  modeleDuDossier,
  modeleReprise,
  processusDuDossier,
  processusDuModele,
} from '@/lib/administrateur-judiciaire/domain/modeles-etapes'
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
    }),
    { date: '2026-11-03', compteRendu: '' },
  ).etape

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
