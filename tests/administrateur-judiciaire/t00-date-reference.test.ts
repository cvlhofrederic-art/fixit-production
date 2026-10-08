import './fuseau-paris'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { describe, expect, it } from 'vitest'
import { joursAvantDateFr } from '@/lib/administrateur-judiciaire/domain/dates'
import {
  DATE_REFERENCE_SUIVI_DOSSIERS,
  calculerDateReferenceSuiviDossiers,
  calculerStatutSuiviDossier,
  joursAvantEcheanceSuivi,
} from '@/lib/administrateur-judiciaire/domain/suivi-dossiers'
import { DATE_DEMO_ISO, calculerDateDuJourIso } from '@/lib/administrateur-judiciaire/mode'

/**
 * T00 (intégration Gestéam, lot 0) : aucun calcul de délai ne doit dépendre d'une date figée en mode réel.
 * La date de référence entre par un paramètre explicite : date figée en démonstration, date système en mode réel.
 */

describe('T00 — date du jour selon le mode', () => {
  it('en démonstration, la date du jour est la date figée, quelle que soit la date système', () => {
    expect(calculerDateDuJourIso('demo', new Date(2030, 0, 15, 10))).toBe(DATE_DEMO_ISO)
  })

  it('en mode réel, la date du jour est la date système injectée (jour local)', () => {
    expect(calculerDateDuJourIso('reel', new Date(2026, 9, 8, 15, 30))).toBe('2026-10-08')
    expect(calculerDateDuJourIso('reel', new Date(2027, 1, 1, 0, 5))).toBe('2027-02-01')
  })
})

describe('T00 — joursAvantDateFr prend la date de référence en paramètre', () => {
  it('la même échéance donne deux résultats différents avec deux dates de référence différentes', () => {
    const avecDemo = joursAvantDateFr('30/06/2026', '2026-06-04')
    const avecReel = joursAvantDateFr('30/06/2026', '2026-10-08')
    expect(avecDemo).toBe(26)
    expect(avecReel).toBeLessThan(0)
    expect(avecDemo).not.toBe(avecReel)
  })

  it('sans date de référence explicite, le comportement historique est conservé (date du jour du mode actif)', () => {
    expect(joursAvantDateFr('30/06/2026')).toBe(joursAvantDateFr('30/06/2026', calculerDateDuJourIso('demo', new Date())))
  })

  it('une échéance absente reste null', () => {
    expect(joursAvantDateFr(null, '2026-10-08')).toBeNull()
  })
})

describe('T00 — Suivi des dossiers : plus de 19/06/2026 figé en mode réel', () => {
  it('en démonstration, la référence reste le 19/06/2026 (cohérence du jeu de démonstration)', () => {
    const reference = calculerDateReferenceSuiviDossiers('demo', new Date(2030, 0, 15, 10))
    expect(reference.getTime()).toBe(DATE_REFERENCE_SUIVI_DOSSIERS.getTime())
  })

  it('en mode réel, la référence est la date système injectée, ramenée à minuit local', () => {
    const reference = calculerDateReferenceSuiviDossiers('reel', new Date(2026, 9, 8, 15, 30))
    expect(reference.getTime()).toBe(new Date(2026, 9, 8).getTime())
  })

  it('la même échéance donne deux écarts différents avec deux dates de référence', () => {
    expect(joursAvantEcheanceSuivi('24/06/2026', new Date(2026, 5, 19))).toBe(5)
    expect(joursAvantEcheanceSuivi('24/06/2026', new Date(2026, 9, 8))).toBe(-106)
    expect(joursAvantEcheanceSuivi('—', new Date(2026, 9, 8))).toBeNull()
  })

  it('le statut d’un dossier dépend de la date de référence fournie', () => {
    const dossier = { echeance: '24/06/2026', retard: 0 }
    expect(calculerStatutSuiviDossier(dossier, 7, new Date(2026, 5, 19)).k).toBe('urgent')
    expect(calculerStatutSuiviDossier(dossier, 7, new Date(2026, 9, 8)).k).toBe('retard')
    expect(calculerStatutSuiviDossier(dossier, 7, new Date(2026, 5, 1)).k).toBe('ok')
  })
})

describe('T00 — aucune date littérale ailleurs que dans les constantes de démonstration nommées', () => {
  const RACINE = join(__dirname, '..', '..')
  const DOSSIERS = ['lib/administrateur-judiciaire', 'components/administrateur-judiciaire', 'app/administrateur-judiciaire']
  /** Constantes de démonstration autorisées, une par fichier. */
  const AUTORISEES: Record<string, RegExp> = {
    'lib/administrateur-judiciaire/mode.ts': /export const DATE_DEMO_ISO = '2026-06-04'/,
    'lib/administrateur-judiciaire/domain/suivi-dossiers.ts': /export const DATE_REFERENCE_SUIVI_DOSSIERS = new Date\(2026, 5, 19\)/,
    // Métadonnées de traçabilité (date du relevé dans Gestéam) : pas une date de calcul.
    'lib/administrateur-judiciaire/domain/referentiels-vitfix.ts': /^\s*dateReleve: "20\d{2}-\d{2}-\d{2}",$/,
  }
  /** Date ISO littérale ou `new Date(AAAA, …)` en dur. */
  const DATE_LITTERALE = /['"`]20\d{2}-\d{2}-\d{2}|new Date\(\s*20\d{2}\s*,/

  const lister = (dossier: string): string[] =>
    readdirSync(dossier).flatMap((nom) => {
      const chemin = join(dossier, nom)
      if (statSync(chemin).isDirectory()) return nom === 'data' ? [] : lister(chemin)
      return /\.(ts|tsx)$/.test(nom) ? [chemin] : []
    })

  it('seules les constantes de démonstration nommées (et les dates de relevé des référentiels) contiennent une date en dur', () => {
    const fautifs: string[] = []
    for (const dossier of DOSSIERS) {
      let fichiers: string[] = []
      try {
        fichiers = lister(join(RACINE, dossier))
      } catch {
        continue // dossier absent : rien à vérifier
      }
      for (const fichier of fichiers) {
        const rel = relative(RACINE, fichier).replaceAll('\\', '/')
        readFileSync(fichier, 'utf8')
          .split('\n')
          .forEach((ligne, i) => {
            if (!DATE_LITTERALE.test(ligne) || ligne.trim().startsWith('*') || ligne.trim().startsWith('//')) return
            if (AUTORISEES[rel]?.test(ligne)) return
            fautifs.push(`${rel}:${i + 1}: ${ligne.trim()}`)
          })
      }
    }
    expect(fautifs).toEqual([])
  })
})
