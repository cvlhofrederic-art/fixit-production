// Le document (devis ou facture) auquel un rapport d'intervention est rattaché :
// components/dashboard/rapports/document-lie.ts.
//
// Ce module est né d'un remaniement — la ligne du tableau et le gabarit PDF cherchaient chacun le document dans le
// stockage, pour les deux liens, à chaque rendu. En leur donnant une carte construite par l'écran parent, je leur
// avais retiré leur capacité à vivre seuls : monté sans carte, le gabarit PDF ne retrouvait plus le libellé et
// retombait sur la référence brute. Le repli `documentsParId ?? carteDocumentsLies(undefined, artisanId)` est
// revenu, et la relecture adverse a relevé qu'aucun test ne portait sur ce module. Le voici.

import { describe, it, expect, beforeEach } from 'vitest'
import { carteDocumentsLies, libelleDocumentLie, type DocumentLie } from '@/components/dashboard/rapports/document-lie'

const CLE = 'fiche-rapports'

const DEVIS_EMIS: DocumentLie = {
  id: 'dev-1', docNumber: 'DEV-2026-001', status: 'signed', service: 'Ravalement façade', clientName: 'SCI Les Tilleuls',
}
const FACTURE_EMISE: DocumentLie = {
  id: 'fact-1', docNumber: 'FACT-2026-001', status: 'paid', clientName: 'SARL Durand',
}
// Un rapport peut être rattaché à un devis encore en brouillon : il faut pouvoir le nommer. C'est un libellé, pas
// un chiffre — d'où `avecBrouillons: true` dans le module.
const DEVIS_BROUILLON: DocumentLie = {
  id: 'dev-brouillon', docNumber: 'BR-7', status: 'brouillon', service: 'Terrasse', clientName: 'SAS Petit',
}

function ranger(emis: DocumentLie[], brouillons: DocumentLie[] = []) {
  localStorage.setItem(`fixit_documents_${CLE}`, JSON.stringify(emis))
  localStorage.setItem(`fixit_drafts_${CLE}`, JSON.stringify(brouillons))
}

beforeEach(() => {
  localStorage.clear()
})

describe('carteDocumentsLies — la carte des documents retrouvables', () => {
  it('prend la liste fournie par le parent quand elle est non vide', () => {
    ranger([FACTURE_EMISE])
    const carte = carteDocumentsLies([DEVIS_EMIS], CLE)
    expect([...carte.keys()]).toEqual(['dev-1'])
  })

  it('retombe sur le stockage du navigateur quand le parent ne fournit rien', () => {
    // C'est tout l'objet du repli : ce module est aussi appelé par un enfant monté seul, sans carte.
    ranger([DEVIS_EMIS, FACTURE_EMISE])
    const carte = carteDocumentsLies(undefined, CLE)
    expect([...carte.keys()].sort()).toEqual(['dev-1', 'fact-1'])
  })

  it('retombe aussi sur le stockage quand la liste fournie est vide', () => {
    // Une liste vide n'est pas une réponse : c'est un écran qui n'a pas encore reçu la sienne.
    ranger([DEVIS_EMIS])
    expect([...carteDocumentsLies([], CLE).keys()]).toEqual(['dev-1'])
  })

  it('garde les brouillons du stockage : un rapport peut être lié à un devis en brouillon', () => {
    ranger([DEVIS_EMIS], [DEVIS_BROUILLON])
    expect([...carteDocumentsLies(undefined, CLE).keys()].sort()).toEqual(['dev-1', 'dev-brouillon'])
  })

  it('garde un brouillon de la liste fournie, numéro provisoire compris', () => {
    expect([...carteDocumentsLies([DEVIS_BROUILLON], CLE).keys()]).toEqual(['dev-brouillon'])
  })

  it('écarte un document sans identifiant : il ne serait pas retrouvable', () => {
    const sansId = { docNumber: 'DEV-2026-009', clientName: 'Anonyme' } as DocumentLie
    expect(carteDocumentsLies([sansId, DEVIS_EMIS], CLE).size).toBe(1)
  })

  it('rend une carte vide sans identifiant de stockage et sans liste', () => {
    ranger([DEVIS_EMIS])
    expect(carteDocumentsLies(undefined, undefined).size).toBe(0)
  })

  it('survit à un stockage illisible', () => {
    localStorage.setItem(`fixit_documents_${CLE}`, '{ ceci n est pas du JSON')
    expect(() => carteDocumentsLies(undefined, CLE)).not.toThrow()
  })
})

describe('libelleDocumentLie — nommer le document, ou dire ce qu’on en sait', () => {
  const carte = () => carteDocumentsLies([DEVIS_EMIS, FACTURE_EMISE], CLE)

  it('nomme un devis retrouvé par son objet, en français', () => {
    expect(libelleDocumentLie(carte(), 'dev-1', 'DEV-2026-001', 'devis', false)).toBe('Devis Ravalement façade')
  })

  it('nomme le même devis en portugais', () => {
    // Deux sociétés BTP portugaises sont en production : ce libellé ne doit pas rester français.
    expect(libelleDocumentLie(carte(), 'dev-1', 'DEV-2026-001', 'devis', true)).toBe('Orçamento Ravalement façade')
  })

  it('nomme une facture par son client, faute d’objet', () => {
    expect(libelleDocumentLie(carte(), 'fact-1', 'FACT-2026-001', 'facture', false)).toBe('Facture SARL Durand')
    expect(libelleDocumentLie(carte(), 'fact-1', 'FACT-2026-001', 'facture', true)).toBe('Fatura SARL Durand')
  })

  it('ne confond pas les deux types : chacun garde son mot', () => {
    // Une inversion devis/facture donnerait un libellé faux sans faire rougir quoi que ce soit d'autre.
    expect(libelleDocumentLie(carte(), 'dev-1', '', 'facture', false)).toBe('Facture Ravalement façade')
  })

  it('retombe sur la référence enregistrée quand le document a disparu', () => {
    // `linkedDevisRef` survit à la suppression du document : c'est le meilleur repli.
    expect(libelleDocumentLie(carte(), 'dev-supprime', 'DEV-2026-007', 'devis', false)).toBe('DEV-2026-007')
  })

  it('retombe sur la référence quand aucun identifiant n’a été gardé', () => {
    expect(libelleDocumentLie(carte(), null, 'DEV-2026-008', 'devis', false)).toBe('DEV-2026-008')
    expect(libelleDocumentLie(carte(), undefined, 'FACT-2026-008', 'facture', true)).toBe('FACT-2026-008')
  })

  it('rend une chaîne vide quand il n’y a ni document ni référence', () => {
    expect(libelleDocumentLie(carte(), null, null, 'devis', false)).toBe('')
    expect(libelleDocumentLie(new Map(), 'dev-1', '', 'devis', false)).toBe('')
  })

  it('se rabat sur l’identifiant quand le document n’a ni objet ni client', () => {
    const nu: DocumentLie = { id: 'dev-nu' }
    expect(libelleDocumentLie(carteDocumentsLies([nu], CLE), 'dev-nu', '', 'devis', false)).toBe('Devis dev-nu')
  })
})
