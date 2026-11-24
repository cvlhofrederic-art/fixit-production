// tests/lib/btp-perimetre-compte.test.ts — les gardes pures du périmètre BTP (24/11/2026).
//
// Ces fonctions décident de ce qu'un compte voit et écrit dans /api/btp. Les cas vérifiés ici sont ceux que la route
// n'atteint pas aujourd'hui : un module hors de la matrice, une table sans correspondance, un rôle d'équipe inconnu.
// Ce sont précisément les chemins qu'une évolution future emprunterait sans s'en apercevoir — et chacun doit refuser,
// jamais accorder par défaut.

import { describe, it, expect } from 'vitest'
import {
  MODULE_PAR_LISTE, MODULE_PAR_TABLE, COLONNES_VUE_RESTREINTE,
  niveauSur, peutEcrireTable, projeter, visibiliteListe, type PerimetreBtp,
} from '@/lib/btp/perimetre-compte'
import { ALL_PRO_MODULES } from '@/lib/permissions'
import { BTP_TABLES_ECRIVABLES } from '@/lib/btp/schema-tables-btp'

const SOCIETE = '550e8400-e29b-41d4-a716-446655440000'

const titulaire: PerimetreBtp = { societeId: SOCIETE, titulaire: true, roleEquipe: null, permissions: {}, email: 'patron@exemple.test' }
const ouvrier: PerimetreBtp = {
  societeId: SOCIETE, titulaire: false, roleEquipe: 'OUVRIER', email: 'joao@exemple.test',
  permissions: { chantiers: 'READ', pointage: 'READ', equipes: 'NONE' },
}
/** Sous-compte dont le rôle d'équipe n'a pas été reconnu : aucune permission, donc aucun droit. */
const roleInconnu: PerimetreBtp = { societeId: SOCIETE, titulaire: false, roleEquipe: null, permissions: {}, email: 'x@exemple.test' }

describe('niveauSur', () => {
  it('le titulaire a tout, quel que soit le module', () => {
    expect(niveauSur(titulaire, 'chantiers')).toBe('FULL')
    expect(niveauSur(titulaire, 'module_qui_n_existe_pas')).toBe('FULL')
    expect(niveauSur(titulaire, undefined)).toBe('FULL')
  })

  it('un module absent de la matrice ne donne RIEN à un sous-compte', () => {
    expect(niveauSur(ouvrier, 'module_qui_n_existe_pas')).toBe('NONE')
    expect(niveauSur(ouvrier, undefined)).toBe('NONE')
  })

  it('une table de référence commune (module null) se lit', () => {
    expect(niveauSur(ouvrier, null)).toBe('READ')
  })

  it('un sous-compte au rôle d’équipe inconnu n’a aucun droit', () => {
    for (const nomModule of ['chantiers', 'pointage', 'meteo', 'dictionnaire_materiaux']) {
      expect(niveauSur(roleInconnu, nomModule)).toBe('NONE')
    }
  })
})

describe('visibiliteListe', () => {
  it('une liste hors de la table de correspondance ne se montre pas à un sous-compte', () => {
    expect(visibiliteListe(ouvrier, 'liste_inconnue')).toBe('aucune')
    expect(visibiliteListe(titulaire, 'liste_inconnue')).toBe('tout')
  })

  it('READ sans vue restreinte définie ne montre rien plutôt que tout', () => {
    const avecPointage: PerimetreBtp = { ...ouvrier, permissions: { pointage: 'READ' } }
    // 'pointages' n'a pas de projection : en lecture seule, mieux vaut ne rien montrer que montrer trop.
    expect('pointages' in COLONNES_VUE_RESTREINTE).toBe(false)
    expect(visibiliteListe(avecPointage, 'pointages')).toBe('aucune')
  })

  it('la table de référence commune reste lisible par un salarié', () => {
    expect(MODULE_PAR_LISTE.ref_taux).toBeNull()
    expect(visibiliteListe(ouvrier, 'ref_taux')).toBe('restreinte')
  })
})

describe('peutEcrireTable', () => {
  it('le titulaire écrit partout', () => {
    for (const table of BTP_TABLES_ECRIVABLES) expect(peutEcrireTable(titulaire, table)).toBe(true)
  })

  it('une table sans correspondance n’est jamais écrivable par un sous-compte', () => {
    expect(peutEcrireTable(ouvrier, 'table_ajoutee_sans_module')).toBe(false)
    expect(peutEcrireTable(roleInconnu, 'table_ajoutee_sans_module')).toBe(false)
  })

  it('seul FULL écrit : READ ne suffit pas', () => {
    expect(peutEcrireTable(ouvrier, 'chantiers_btp')).toBe(false)
    const avecFull: PerimetreBtp = { ...ouvrier, permissions: { chantiers: 'FULL' } }
    expect(peutEcrireTable(avecFull, 'chantiers_btp')).toBe(true)
  })

  it('un rôle d’équipe inconnu n’écrit rien', () => {
    for (const table of BTP_TABLES_ECRIVABLES) expect(peutEcrireTable(roleInconnu, table)).toBe(false)
  })

  // Sans cet invariant, une 14e table écrivable ajoutée sans module de rattachement tomberait dans le cas
  // « table inconnue » : refusée à tous les sous-comptes, en silence, y compris à la secrétaire.
  it('chaque table écrivable relève d’un module connu de la matrice', () => {
    for (const table of BTP_TABLES_ECRIVABLES) {
      expect(MODULE_PAR_TABLE[table], `table ${table} sans module`).toBeDefined()
      expect(ALL_PRO_MODULES, `module de ${table} absent du catalogue`).toContain(MODULE_PAR_TABLE[table])
    }
  })

  it('chaque liste rattachée à un module nomme un module du catalogue', () => {
    for (const [cle, nomModule] of Object.entries(MODULE_PAR_LISTE)) {
      if (nomModule === null) continue
      expect(ALL_PRO_MODULES, `module de la liste ${cle} absent du catalogue`).toContain(nomModule)
    }
  })
})

describe('projeter', () => {
  it('ne garde que les colonnes autorisées', () => {
    const lignes = [{ id: 'c1', titre: 'Toiture', budget: 90000, client: 'Mme Dupont', owner_id: SOCIETE }]
    expect(projeter('chantiers', lignes)).toEqual([{ id: 'c1', titre: 'Toiture' }])
  })

  it('laisse passer une liste sans projection définie', () => {
    const lignes = [{ id: 'r1', taux: 21 }]
    expect(projeter('ref_taux', lignes)).toEqual(lignes)
  })

  it('ne rend jamais la ligne d’origine (pas de fuite par référence)', () => {
    const ligne = { id: 'c1', titre: 'Toiture', budget: 90000 }
    const [projetee] = projeter('chantiers', [ligne])
    expect(projetee).not.toBe(ligne)
    expect(ligne.budget).toBe(90000)
  })
})
