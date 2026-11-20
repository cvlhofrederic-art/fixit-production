import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { DEMO_COPROPRIETES } from '@/components/administrateur-judiciaire/data/coproprietes'
import {
  DEMO_COMPAGNIES_ASSURANCE,
  DEMO_CONTRATS_SINISTRE,
  DEMO_SINISTRES,
} from '@/components/administrateur-judiciaire/data/sinistres'

/**
 * Jeu de démonstration du module administrateur judiciaire : assureurs et courtiers FICTIFS. Le dépôt est public et la
 * démonstration ne doit citer aucune compagnie réelle. On relit le source des données (commentaires compris) contre
 * une liste des principaux assureurs et courtiers du marché français ; « TAXATION » ou « comma » ne comptent pas
 * (mots entiers seulement).
 */

const DOSSIER_DONNEES = join(__dirname, '..', '..', 'components', 'administrateur-judiciaire', 'data')

/** Motifs (expressions régulières) des noms à refuser : assureurs, puis courtiers. */
const ASSUREURS_ET_COURTIERS_REELS = [
  'AXA', 'MMA', 'Allianz', 'Generali', 'SMABTP', 'SMA BTP', 'MAAF', 'MAIF', 'MACIF', 'MACSF', 'Matmut', 'Groupama',
  'GMF', 'Cov[ée]a', 'Aviva', 'Abeille Assurances', 'Hiscox', 'Swiss ?Life', 'Th[ée]lem', 'Albingia', 'Euromaf',
  'Chubb', 'QBE', 'AIG', 'Pacifica', 'Sogessur', 'BPCE (IARD|Assurances)', 'Cr[ée]dit Agricole Assurances',
  'Ageas', 'Helvetia',
  'Verlingue', 'Gras Savoye', 'WTW', 'Marsh', 'Siaci', 'Diot', 'Bess[ée]', 'Filhet[- ]Allard', 'Ascora',
]

const NOM_REEL = new RegExp(String.raw`\b(${ASSUREURS_ET_COURTIERS_REELS.join('|')})\b`, 'gi')

describe('jeu de démonstration : assureurs fictifs', () => {
  it('aucun assureur ni courtier réel dans les données de démonstration', () => {
    const occurrences = readdirSync(DOSSIER_DONNEES)
      .filter((fichier) => fichier.endsWith('.ts'))
      .flatMap((fichier) =>
        [...readFileSync(join(DOSSIER_DONNEES, fichier), 'utf8').matchAll(NOM_REEL)].map(
          ([nom]) => `${fichier} : ${nom}`,
        ),
      )
    expect(occurrences).toEqual([])
  })

  it('chaque sinistre cite une compagnie de la démonstration, sous son identifiant et son nom', () => {
    for (const { numero, assurance } of DEMO_SINISTRES) {
      const compagnie = DEMO_COMPAGNIES_ASSURANCE.find(({ id }) => id === assurance.compagnieId)
      expect(compagnie?.libelle, `${numero}`).toBe(assurance.compagnie)
    }
  })

  it('chaque sinistre est chez un assureur dont un contrat de démonstration couvre sa copropriété', () => {
    for (const { numero, coproprieteId, assurance } of DEMO_SINISTRES) {
      const code = DEMO_COPROPRIETES.find(({ id }) => id === coproprieteId)?.code
      const contratsCouvrants = DEMO_CONTRATS_SINISTRE.filter(
        ({ compagnieId, copros }) => compagnieId === assurance.compagnieId && !!code && copros.includes(code),
      ).map(({ libelle }) => libelle)
      expect(contratsCouvrants, `${numero} (${code ?? coproprieteId}) chez ${assurance.compagnie}`).not.toEqual([])
    }
  })

  it('références du sinistre chez l’assureur : trois lettres, année sur deux chiffres, rang sur six chiffres', () => {
    for (const { numero, assurance } of DEMO_SINISTRES) {
      expect(assurance.numeroSinistre, `${numero}`).toMatch(/^[A-Z]{3}-\d{2}-\d{6}$/)
    }
  })
})
