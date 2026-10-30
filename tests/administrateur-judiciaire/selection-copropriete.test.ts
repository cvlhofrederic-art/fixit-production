import { describe, expect, it } from 'vitest'
import { composerDateIso } from '@/lib/administrateur-judiciaire/domain/dates'
import {
  codeDeNomCopro,
  codeLigneDemo,
  coproParDefaut,
  estRouteTousMandats,
  filtrerCopros,
  filtrerParCopro,
  fondementCourt,
  personneDeLaCopro,
  porteeRoute,
  rappelFinMission,
} from '@/lib/administrateur-judiciaire/domain/selection-copropriete'

const COPROS = [
  { code: 'LM', nom: 'Résidence Le Méridien', fondement: 'art. 46 — carence', echeance: '12/03/2027' },
  { code: 'CV', nom: 'Le Clos des Vignes', fondement: 'art. 46 — carence', echeance: '22/07/2026' },
  { code: 'TL', nom: 'Copropriété Les Tilleuls', fondement: 'art. 29-1 — difficulté', echeance: '05/05/2026' },
]

describe('sélecteur de copropriété — routes de tous les mandats', () => {
  it('« Aujourd’hui » et « Tableau de bord » montrent tous les mandats ; les autres pages, la copropriété choisie', () => {
    expect(estRouteTousMandats('cockpit')).toBe(true)
    expect(estRouteTousMandats('dashboard')).toBe(true)
    expect(estRouteTousMandats('tresorerie')).toBe(false)
    expect(estRouteTousMandats('lots')).toBe(false)
  })
})

describe('sélecteur de copropriété — portée des pages', () => {
  it('« Aujourd’hui », le tableau de bord et les pages du cabinet sont des vues générales', () => {
    for (const route of ['cockpit', 'dashboard', 'equipe', 'portefeuille', 'charge', 'pointage', 'modules', 'parametres', 'rgpd'])
      expect(porteeRoute(route)).toBe('generale')
  })

  it('toute autre page s’affiche selon la copropriété choisie, une route inconnue comprise', () => {
    for (const route of ['tresorerie', 'lots', 'prestataires', 'fiche360', 'agElective', 'fixy', 'route-inconnue'])
      expect(porteeRoute(route)).toBe('copro')
  })
})

describe('sélecteur de copropriété — filtre des listes', () => {
  const LIGNES = [
    { id: 1, copro: 'Le Méridien' },
    { id: 2, copro: 'Clos des Vignes' },
    { id: 3, copro: 'Résidence Le Méridien' },
    { id: 4, copro: 'Inconnue' },
  ]
  const codeDeLigne = (ligne: { copro: string }) => codeDeNomCopro(ligne.copro)

  it('ne garde que les lignes de la copropriété choisie, dans leur ordre', () => {
    expect(filtrerParCopro(LIGNES, 'LM', codeDeLigne).map((l) => l.id)).toEqual([1, 3])
    expect(filtrerParCopro(LIGNES, 'CV', codeDeLigne).map((l) => l.id)).toEqual([2])
    expect(filtrerParCopro(LIGNES, 'TL', codeDeLigne)).toEqual([])
  })

  it('sans copropriété choisie, toutes les lignes (nouveau tableau, source intacte)', () => {
    const toutes = filtrerParCopro(LIGNES, null, codeDeLigne)
    expect(toutes).toEqual(LIGNES)
    expect(toutes).not.toBe(LIGNES)
    expect(filtrerParCopro(LIGNES, undefined, codeDeLigne)).toHaveLength(4)
    expect(filtrerParCopro(LIGNES, '', codeDeLigne)).toHaveLength(4)
  })
})

describe('sélecteur de copropriété — code d’un nom de copropriété', () => {
  it('noms longs et courts de la démonstration', () => {
    expect(codeDeNomCopro('Résidence Le Méridien')).toBe('LM')
    expect(codeDeNomCopro('Le Méridien')).toBe('LM')
    expect(codeDeNomCopro('Le Clos des Vignes')).toBe('CV')
    expect(codeDeNomCopro('Clos des Vignes')).toBe('CV')
    expect(codeDeNomCopro('Copropriété Les Tilleuls')).toBe('TL')
    expect(codeDeNomCopro('Les Tilleuls')).toBe('TL')
    expect(codeDeNomCopro('Villa Montaigne')).toBe('VM')
  })

  it('sans accents ni casse, espaces réduits', () => {
    expect(codeDeNomCopro('  le  MERIDIEN ')).toBe('LM')
    expect(codeDeNomCopro('copropriete les tilleuls')).toBe('TL')
  })

  it('libellé composé : seul le nom avant « · », « , », « — », « ( » ou « : » compte', () => {
    expect(codeDeNomCopro('Le Méridien · lot 12')).toBe('LM')
    expect(codeDeNomCopro('Résidence Le Méridien, bât. A')).toBe('LM')
    expect(codeDeNomCopro('Clos des Vignes · 22/07/2026')).toBe('CV')
    expect(codeDeNomCopro('Le Clos des Vignes — AG élective')).toBe('CV')
    expect(codeDeNomCopro('Le Clos des Vignes (2026)')).toBe('CV')
    expect(codeDeNomCopro('Les Tilleuls : 36 %')).toBe('TL')
  })

  it('nom inconnu, vide ou absent : null (pas de rapprochement approximatif)', () => {
    expect(codeDeNomCopro('Toutes les copropriétés')).toBeNull()
    expect(codeDeNomCopro('Méridien')).toBeNull()
    expect(codeDeNomCopro('')).toBeNull()
    expect(codeDeNomCopro(null)).toBeNull()
    expect(codeDeNomCopro(undefined)).toBeNull()
  })

  it('les copropriétés fournies (base locale) l’emportent sur la table de démonstration', () => {
    const base = [
      { code: 'RDP', nom: 'Résidence du Parc' },
      { code: 'LM2', nom: 'Le Méridien' },
    ]
    expect(codeDeNomCopro('Résidence du Parc', base)).toBe('RDP')
    expect(codeDeNomCopro('residence du parc · lot 3', base)).toBe('RDP')
    expect(codeDeNomCopro('Le Méridien', base)).toBe('LM2')
    expect(codeDeNomCopro('Villa Montaigne', base)).toBe('VM')
    expect(codeDeNomCopro('Inconnue', base)).toBeNull()
  })

  // « Villa Marine » reçoit le code VM, comme « Villa Montaigne » : en mode réel, aucune ligne de démonstration ne doit
  // lui être rattachée (ni l'ascenseur, ni les événements de Villa Montaigne).
  it('mode réel : la table de démonstration n’est pas lue, seules les copropriétés de la base comptent', () => {
    const base = [{ code: 'VM', nom: 'Villa Marine' }]
    expect(codeDeNomCopro('Villa Montaigne', base, 'reel')).toBeNull()
    expect(codeDeNomCopro('Le Méridien · lot 12', [], 'reel')).toBeNull()
    expect(codeDeNomCopro('Villa Marine', base, 'reel')).toBe('VM')
    expect(codeDeNomCopro('Villa Montaigne', base, 'demo')).toBe('VM')
  })
})

describe('sélecteur de copropriété — code d’une ligne de démonstration', () => {
  it('mode démo : le code de la ligne (null si absent)', () => {
    expect(codeLigneDemo('TL', 'demo')).toBe('TL')
    expect(codeLigneDemo(undefined, 'demo')).toBeNull()
    expect(codeLigneDemo(null, 'demo')).toBeNull()
  })

  it('mode réel : aucune ligne de démonstration n’appartient à une copropriété de la base', () => {
    expect(codeLigneDemo('VM', 'reel')).toBeNull()
    expect(filtrerParCopro([{ code: 'VM' }], 'VM', (ligne) => codeLigneDemo(ligne.code, 'reel'))).toEqual([])
  })

  it('par défaut, le mode actif (démonstration dans les tests)', () => {
    expect(codeLigneDemo('LM')).toBe('LM')
  })
})

describe('sélecteur de copropriété — personne de la copropriété', () => {
  const DONNEES = {
    lots: [
      { id: 'L1', coproprieteId: 'C1' },
      { id: 'L2', coproprieteId: 'C2' },
    ],
    coproprietaires: [
      { id: 'P1', lotId: 'L1' },
      { id: 'P2', lotId: 'L2' },
      { id: 'P3', lotId: 'L-absent' },
    ],
  }

  it('vrai si le lot de la personne appartient à la copropriété', () => {
    expect(personneDeLaCopro('P1', 'C1', DONNEES)).toBe(true)
    expect(personneDeLaCopro('P2', 'C2', DONNEES)).toBe(true)
  })

  it('faux pour une autre copropriété, une personne inconnue ou un lot introuvable', () => {
    expect(personneDeLaCopro('P1', 'C2', DONNEES)).toBe(false)
    expect(personneDeLaCopro('P9', 'C1', DONNEES)).toBe(false)
    expect(personneDeLaCopro('P3', 'C1', DONNEES)).toBe(false)
  })
})

describe('sélecteur de copropriété — recherche', () => {
  it('par nom ou par code, sans accents ni casse', () => {
    expect(filtrerCopros(COPROS, 'meridien').map((c) => c.code)).toEqual(['LM'])
    expect(filtrerCopros(COPROS, 'cv').map((c) => c.code)).toEqual(['CV'])
    expect(filtrerCopros(COPROS, ' LES ').map((c) => c.code)).toEqual(['TL'])
    expect(filtrerCopros(COPROS, 'le').map((c) => c.code)).toEqual(['LM', 'CV', 'TL'])
  })

  it('une recherche vide garde toutes les copropriétés ; une recherche sans résultat n’en garde aucune', () => {
    expect(filtrerCopros(COPROS, '  ')).toHaveLength(3)
    expect(filtrerCopros(COPROS, 'inconnue')).toEqual([])
  })
})

describe('sélecteur de copropriété — copropriété par défaut', () => {
  it('le choix courant, sinon le choix mémorisé, sinon la première', () => {
    expect(coproParDefaut(COPROS, 'CV', 'TL')).toBe('CV')
    expect(coproParDefaut(COPROS, null, 'TL')).toBe('TL')
    expect(coproParDefaut(COPROS, null, null)).toBe('LM')
  })

  it('un code qui n’existe plus est ignoré ; sans copropriété, aucun choix', () => {
    expect(coproParDefaut(COPROS, 'XX', 'YY')).toBe('LM')
    expect(coproParDefaut([], 'LM', 'LM')).toBeNull()
  })

  it('seuls les codes sont lus (liste réduite aux codes acceptée)', () => {
    expect(coproParDefaut([{ code: 'A' }, { code: 'B' }], null, 'B')).toBe('B')
  })
})

describe('sélecteur de copropriété — fondement abrégé', () => {
  it('l’article cité, quel que soit le libellé (démonstration, formulaire, assistant)', () => {
    expect(fondementCourt('art. 46 — carence')).toBe('art. 46')
    expect(fondementCourt('art. 29-1 — difficulté')).toBe('art. 29-1')
    expect(fondementCourt('Syndic judiciaire (art. 46)')).toBe('art. 46')
    expect(fondementCourt('Administration provisoire (art. 29-1)')).toBe('art. 29-1')
    expect(fondementCourt('art. 47 décret du 17 mars 1967 (syndicat dépourvu de syndic)')).toBe('art. 47')
    expect(fondementCourt('Art 47')).toBe('art. 47')
  })

  it('sans article : le libellé tel quel ; vide si inconnu', () => {
    expect(fondementCourt(' Mandat ad hoc ')).toBe('Mandat ad hoc')
    expect(fondementCourt('')).toBe('')
  })
})

describe('sélecteur de copropriété — fin de mission', () => {
  const le4juin = composerDateIso(2026, 6, 4)

  it('compte à rebours, jour même ou retard', () => {
    expect(rappelFinMission('22/07/2026', le4juin)).toEqual({ texte: 'J-48', retard: false })
    expect(rappelFinMission('04/06/2026', le4juin)).toEqual({ texte: "Aujourd'hui", retard: false })
    expect(rappelFinMission('05/05/2026', le4juin)).toEqual({ texte: 'Retard 30 j', retard: true })
  })

  it('une date inconnue ne donne aucun rappel', () => {
    expect(rappelFinMission('', le4juin)).toEqual({ texte: '', retard: false })
  })
})
