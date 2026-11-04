// lib/coproprietaire/source-aj.ts — espace du portail tiré de l'Administrateur judiciaire : les données doivent
// correspondre à celles de l'AJ (noms, lots, soldes, assemblées, ordres de service, avis), sans jamais montrer le lot
// privé d'un autre copropriétaire.

import { describe, expect, it } from 'vitest'
import { FICHES_ASSEMBLEES_DEMO } from '@/components/administrateur-judiciaire/data/assemblees'
import { DEMO_COPROPRIETAIRES } from '@/components/administrateur-judiciaire/data/coproprietaires'
import { DEMO_COPROPRIETES } from '@/components/administrateur-judiciaire/data/coproprietes'
import { resultatsResolutions } from '@/lib/administrateur-judiciaire/domain/fiche-assemblee'
import {
  appelsEtArriere, batimentEtEtage, choixValide, dateFrVersIso, decoderIdResolutionAj, espaceDepuisAj, idResolutionAj,
  listeCoprosAj, lireTantiemes, numeroDeLot, typeDepuisObjet,
} from '@/lib/coproprietaire/source-aj'
import { etatLiaisonVide, type EtatLiaison } from '@/lib/liaison-copro-aj/stockage'

const JOUR = '2026-06-04'
const espace = (code: string, personne: string, liaison: EtatLiaison = etatLiaisonVide()) => {
  const e = espaceDepuisAj(code, personne, liaison, { dateDuJour: JOUR, maintenant: new Date('2026-06-04T10:00:00Z') })
  if (!e) throw new Error(`espace introuvable ${code}/${personne}`)
  return e
}
const totalDu = (e: ReturnType<typeof espace>) =>
  Math.round((e.finances.appels.reduce((s, a) => s + a.resteAPayer, 0) + e.finances.impayes.reduce((s, i) => s + i.montant, 0)) * 100) / 100

describe('liste des copropriétés de l’AJ', () => {
  it('reprend les quatre copropriétés de l’AJ, dans son ordre, avec leurs copropriétaires', () => {
    const liste = listeCoprosAj()
    expect(liste.map((c) => c.code)).toEqual(DEMO_COPROPRIETES.map((c) => c.code))
    expect(liste.find((c) => c.code === 'LM')?.coproprietaires.map((p) => p.nom)).toEqual(['Laurent Mercier', 'Inès Lefèvre', 'Mathilde Faure'])
    expect(liste.flatMap((c) => c.coproprietaires)).toHaveLength(DEMO_COPROPRIETAIRES.length)
  })

  it('choix valide : copropriété et personne connues, sinon la première de la copropriété, sinon la première copropriété', () => {
    expect(choixValide('CV', 'P3')).toEqual({ code: 'CV', personneId: 'P3' })
    expect(choixValide('CV', 'P1')).toEqual({ code: 'CV', personneId: 'P2' })
    expect(choixValide('XX', null)).toEqual({ code: 'LM', personneId: 'P1' })
  })
})

describe('petits outils', () => {
  it('dates, lots, situation, tantièmes, corps de métier', () => {
    expect(dateFrVersIso('22/05/2026')).toBe('2026-05-22')
    expect(dateFrVersIso('—')).toBe('')
    expect(numeroDeLot('Lot 12 — Apt B3')).toBe('12')
    expect(numeroDeLot('Lots 8-9 — Local')).toBe('8-9')
    expect(batimentEtEtage('Bât. B, 3e étage')).toEqual({ batiment: 'B', etage: '3' })
    expect(batimentEtEtage('4e étage')).toEqual({ batiment: '', etage: '4' })
    expect(lireTantiemes('412/10000')).toEqual({ lot: 412, total: 10000 })
    expect(typeDepuisObjet('Fuite sur colonne EU — appartement du 4e étage')).toBe('Plomberie')
    expect(typeDepuisObjet('Remplacement de la minuterie du hall')).toBe('Électricité')
    expect(decoderIdResolutionAj(idResolutionAj('ag-lm-2026-2', 2))).toEqual({ agId: 'ag-lm-2026-2', numero: 2 })
    expect(decoderIdResolutionAj('sans-numero')).toBeNull()
  })
})

describe('espace d’un copropriétaire de l’AJ', () => {
  it('profil et immeuble : ceux de l’AJ (nom, lot, tantièmes, solde, adresse, budget)', () => {
    const e = espace('LM', 'P1')
    expect(e.source).toBe('aj')
    expect(e.vueSuperAdmin).toBe(true)
    expect(e.dateDuJour).toBe(JOUR)
    expect(e.profil).toMatchObject({
      id: 'P1', prenom: 'Laurent', nom: 'Mercier', email: 'l.mercier@email.fr', immeuble: 'Résidence Le Méridien',
      batiment: 'B', etage: '3', numLot: '12', tantiemes: 412, totalTantiemes: 10000, quotePart: 4.12, solde: 0, estOccupe: true,
    })
    expect(e.immeuble).toMatchObject({ nom: 'Résidence Le Méridien', adresse: '14 rue de Verdun', codePostal: '92000', ville: 'Nanterre', nbLots: 36, budgetAnnuel: 142000 })
    expect(e.syndic.nom).toBe('Cabinet Delaunay — syndic judiciaire')
    expect(espace('TL', 'P7').syndic.nom).toBe('Cabinet Delaunay — administrateur provisoire')
  })

  it('personne morale : son nom entier, sans prénom', () => {
    expect(espace('TL', 'P5').profil).toMatchObject({ prenom: '', nom: 'SCI Belvédère', numLot: '8-9' })
  })

  it('une personne d’une autre copropriété est refusée', () => {
    expect(espaceDepuisAj('LM', 'P2', etatLiaisonVide())).toBeNull()
  })

  it('charges : le total dû du portail est exactement le solde de l’AJ, pour chaque copropriétaire', () => {
    for (const personne of DEMO_COPROPRIETAIRES) {
      const copro = DEMO_COPROPRIETES.find((c) => c.nom === personne.copro)
      if (!copro) continue
      const e = espace(copro.code, personne.id)
      expect(totalDu(e), personne.nom).toBe(personne.solde < 0 ? -personne.solde : 0)
      expect(e.finances.solde).toBe(personne.solde)
    }
  })

  it('appels trimestriels échus au jour de l’AJ, répartis depuis le budget voté et les tantièmes', () => {
    const { appels, arriere } = appelsEtArriere(198000, { lot: 308, total: 10000 }, -1840, JOUR, 'CV00027')
    expect(appels.map((a) => a.exercice)).toEqual(['2026-T1', '2026-T2'])
    expect(appels.map((a) => a.montantTotal)).toEqual([1524.6, 1524.6])
    expect(appels[1]).toMatchObject({ resteAPayer: 1524.6, statut: 'en_retard' })
    expect(appels[0]).toMatchObject({ resteAPayer: 315.4, statut: 'partiellement_paye' })
    expect(arriere).toBe(0)
    // Dette supérieure aux appels de l'exercice : le reste est un arriéré.
    const contentieux = appelsEtArriere(96000, { lot: 640, total: 10000 }, -9200, JOUR, 'TL00008')
    expect(contentieux.appels.every((a) => a.statut === 'en_retard')).toBe(true)
    expect(contentieux.arriere).toBe(6128)
  })

  it('ordres de service : parties communes de la copropriété et lot du copropriétaire, jamais le lot privé d’un autre', () => {
    const garnier = espace('CV', 'P2').interventions.immeuble
    const benali = espace('CV', 'P3').interventions.immeuble
    expect(garnier.map((i) => i.id)).toContain('OS-2026-051')
    expect(garnier.find((i) => i.id === 'OS-2026-051')).toMatchObject({ estLaMienne: true, numLot: '27', partieCommune: false, statut: 'en_cours', priorite: 'urgente' })
    expect(benali.map((i) => i.id)).not.toContain('OS-2026-051')
    expect(benali.every((i) => i.partieCommune)).toBe(true)
    expect(espace('LM', 'P1').interventions.immeuble.find((i) => i.id === 'OS-2026-050')).toMatchObject({ statut: 'en_attente', prestataire: 'ELEC92 Services' })
  })

  it('assemblées : celles de l’AJ, résultats de son moteur de vote, vote du copropriétaire repris', () => {
    const e = espace('LM', 'P1')
    expect(e.assemblees.map((ag) => ag.id)).toEqual(['ag-lm-2026-1', 'ag-lm-2026-2'])
    const annuelle = e.assemblees[0]
    const fiche = FICHES_ASSEMBLEES_DEMO.find((ag) => ag.id === 'ag-lm-2026-1')
    if (!fiche) throw new Error('fiche absente')
    const attendus = resultatsResolutions(fiche)
    expect(annuelle.statut).toBe('cloturee')
    annuelle.resolutions.forEach((r, rang) => {
      expect(r.votePour).toBe(attendus[rang].vote?.pour)
      expect(r.statut).toBe(attendus[rang].resolution.etat === 'adoptee' ? 'adoptee' : 'rejetee')
      expect(r.monVote).toBe('pour')
    })
    const speciale = e.assemblees[1]
    expect(speciale).toMatchObject({ statut: 'convoquee', date: '2026-09-15T18:30:00', type: 'extraordinaire' })
    expect(speciale.resolutions.every((r) => r.monVote === null && r.statut === 'en_cours')).toBe(true)
  })

  it('un vote par correspondance de la liaison est le vote du copropriétaire (et de lui seul)', () => {
    const liaison: EtatLiaison = {
      ...etatLiaisonVide(),
      votes: [{ agId: 'ag-lm-2026-2', resolutionNumero: 2, codeCopro: 'LM', coproprietaireId: 'P1', nomCoproprietaire: 'Laurent Mercier', choix: 'contre', date: '2026-06-04T09:30:00.000Z', vueParAj: false }],
    }
    expect(espace('LM', 'P1', liaison).assemblees[1].resolutions[1]).toMatchObject({ monVote: 'contre', monVoteLe: '2026-06-04' })
    expect(espace('LM', 'P4', liaison).assemblees[1].resolutions[1].monVote).toBeNull()
  })

  it('demandes de la liaison : celles du copropriétaire seulement, avec leur fil', () => {
    const liaison: EtatLiaison = {
      ...etatLiaisonVide(),
      demandes: [
        {
          id: 'sig-1', codeCopro: 'LM', nomCopro: 'Résidence Le Méridien', coproprietaireId: 'P1', nomCoproprietaire: 'Laurent Mercier', lot: 'Lot 12 — Apt B3',
          type: 'Plomberie', description: 'Fuite sous l’évier de la cuisine', priorite: 'urgente', partieCommune: false, zone: '',
          creeLe: '2026-06-04T08:00:00.000Z', misAJourLe: '2026-06-04T09:00:00.000Z', statut: 'en_cours', vueParAj: true,
          messages: [
            { id: 'm1', auteur: 'coproprietaire', nom: 'Laurent Mercier', texte: 'Ça coule encore', date: '2026-06-04T08:30:00.000Z' },
            { id: 'm2', auteur: 'administrateur', nom: 'Cabinet Delaunay', texte: 'Plombier demain 9 h', date: '2026-06-04T09:00:00.000Z' },
          ],
        },
        {
          id: 'sig-2', codeCopro: 'LM', nomCopro: 'Résidence Le Méridien', coproprietaireId: 'P4', nomCoproprietaire: 'Inès Lefèvre', lot: 'Lot 31 — Apt C2',
          type: 'Ascenseur', description: 'Bruit anormal', priorite: 'normale', partieCommune: true, zone: 'Ascenseur',
          creeLe: '2026-06-04T08:00:00.000Z', misAJourLe: '2026-06-04T08:00:00.000Z', statut: 'en_attente', vueParAj: false, messages: [],
        },
      ],
    }
    const mes = espace('LM', 'P1', liaison).interventions.mesDemandes
    expect(mes).toHaveLength(1)
    expect(mes[0]).toMatchObject({ id: 'sig-1', statut: 'en_cours', origine: 'portail', numLot: '12' })
    expect(mes[0].messages.map((m) => [m.role, m.deMoi])).toEqual([['coproprio', true], ['syndic', false]])
  })

  it('annonces : avis publiés par l’AJ puis avis de son tableau d’affichage pour cette copropriété', () => {
    const liaison: EtatLiaison = {
      ...etatLiaisonVide(),
      avis: [
        { id: 'aj-avis-1', codeCopro: 'LM', nomCopro: 'Résidence Le Méridien', categorie: 'Travaux', importance: 'Importante', titre: 'Coupure d’eau', contenu: 'Mardi 9 h – 12 h', date: '2026-06-04T07:00:00.000Z' },
        { id: 'aj-avis-2', codeCopro: 'CV', nomCopro: 'Le Clos des Vignes', categorie: 'Information', importance: '', titre: 'Autre copro', contenu: '…', date: '2026-06-04T07:00:00.000Z' },
      ],
    }
    const annonces = espace('LM', 'P1', liaison).annonces
    expect(annonces[0]).toMatchObject({ id: 'aj-avis-1', categorie: 'manutencao', priorite: 'importante', epinglee: true })
    expect(annonces.map((a) => a.titre)).toContain("Convocation à l'assemblée générale élective")
    expect(annonces.map((a) => a.titre)).not.toContain('Autre copro')
  })

  it('documents : procès-verbal de l’AG notifiée et pièces de la GED, sans l’état daté (document d’une vente)', () => {
    const lm = espace('LM', 'P1').documents
    expect(lm.fichiers.map((f) => f.nom)).toEqual(expect.arrayContaining(['Ordonnance de désignation', 'Contrat ascenseur', 'Procès-verbal de l\'assemblée du 18/04/2026']))
    expect(espace('VM', 'P6').documents.fichiers.map((f) => f.nom)).not.toContain('État daté')
    expect(lm.assurances.map((a) => a.type)).toEqual(['multirriscos', 'responsabilidade_civil'])
  })
})
