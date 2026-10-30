import { describe, expect, it } from 'vitest'
import type { ActionFixy } from '@/lib/administrateur-judiciaire/domain/fixy/agents'
import type { RappelVeille } from '@/lib/administrateur-judiciaire/domain/fixy/veille'
import { veilleDeLaCopro } from '@/lib/administrateur-judiciaire/domain/fixy/veille-copropriete'

/**
 * Veille de Fixy selon la copropriété choisie dans le sélecteur du haut de page : les rappels portent le code de leur
 * copropriété dans l'action, sauf ceux du recouvrement, qui ne connaissent que le copropriétaire (rattaché par son lot).
 */

const DONNEES = {
  copros: [
    { id: 'C1', code: 'LM' },
    { id: 'C2', code: 'CV' },
  ],
  lots: [
    { id: 'L1', coproprieteId: 'C1' },
    { id: 'L2', coproprieteId: 'C2' },
  ],
  coproprietaires: [
    { id: 'P1', lotId: 'L1' },
    { id: 'P2', lotId: 'L2' },
    { id: 'P9', lotId: 'L-inconnu' },
  ],
}

const rappel = (id: string, action: ActionFixy): RappelVeille => ({
  id,
  agent: 'Fixy',
  gravite: 'amber',
  texte: id,
  action,
})

const commun = { label: 'Agir', effet: 'Effet', ecrit: false }

const echeance = (code: string) =>
  rappel(`ech:${code}`, { ...commun, id: `nav:${code}`, type: 'naviguer', params: { route: 'dossierJud', code } })

const notification = (code: string) =>
  rappel(`notif:${code}`, { ...commun, id: `acte:${code}`, type: 'ouvrirActe', params: { cle: 'notification', code } })

const recouvrement = (coproprietaireId: string) =>
  rappel(`deb:${coproprietaireId}`, {
    ...commun,
    id: `rec:${coproprietaireId}`,
    ecrit: true,
    type: 'avancerRecouvrement',
    params: { coproprietaireId, etape: 'mise_en_demeure' },
  })

const VEILLE: RappelVeille[] = [
  notification('LM'),
  echeance('CV'),
  recouvrement('P2'),
  recouvrement('P1'),
  echeance('LM'),
  recouvrement('P9'),
]

const ids = (veille: RappelVeille[]) => veille.map((element) => element.id)

describe('veilleDeLaCopro', () => {
  it('sans copropriété choisie : toute la veille, dans un nouveau tableau', () => {
    for (const code of [null, undefined, '']) {
      const resultat = veilleDeLaCopro(VEILLE, code, DONNEES)
      expect(resultat).toEqual(VEILLE)
      expect(resultat).not.toBe(VEILLE)
    }
  })

  it('garde les rappels de la copropriété (code de l’action), dans l’ordre de gravité reçu', () => {
    expect(ids(veilleDeLaCopro(VEILLE, 'LM', DONNEES))).toEqual(['notif:LM', 'deb:P1', 'ech:LM'])
    expect(ids(veilleDeLaCopro(VEILLE, 'CV', DONNEES))).toEqual(['ech:CV', 'deb:P2'])
  })

  it('rattache un rappel de recouvrement à la copropriété du lot de son copropriétaire', () => {
    expect(ids(veilleDeLaCopro([recouvrement('P2')], 'CV', DONNEES))).toEqual(['deb:P2'])
    expect(veilleDeLaCopro([recouvrement('P2')], 'LM', DONNEES)).toEqual([])
  })

  it('écarte un recouvrement dont la personne ou le lot est introuvable', () => {
    expect(veilleDeLaCopro([recouvrement('P9'), recouvrement('P-absent')], 'LM', DONNEES)).toEqual([])
  })

  it('code absent de la base : seuls les rappels portant ce code restent, aucun recouvrement', () => {
    expect(ids(veilleDeLaCopro([...VEILLE, echeance('XX')], 'XX', DONNEES))).toEqual(['ech:XX'])
  })

  it('navigation sans code mais vers une personne : rattachée par le lot de cette personne', () => {
    const versPersonne = rappel('nav:P2', {
      ...commun,
      id: 'nav:personne360:P2',
      type: 'naviguer',
      params: { route: 'personne360', coproprietaireId: 'P2' },
    })
    expect(ids(veilleDeLaCopro([versPersonne], 'CV', DONNEES))).toEqual(['nav:P2'])
    expect(veilleDeLaCopro([versPersonne], 'LM', DONNEES)).toEqual([])
  })
})
