// Recherche des listes Devis et Factures (artisan et BTP) : tout ce qui est relié au document se cherche —
// client, objet, adresse du chantier, adresse du client, lignes, notes, documents liés, date — sans tenir
// compte des majuscules, des accents ni de la ponctuation ; plusieurs mots = tous doivent se trouver.
import { describe, it, expect } from 'vitest'
import {
  correspondDocument,
  filtrerDocuments,
  indexerDocument,
  motsRecherche,
  normaliserRecherche,
  type ChampRecherche,
} from '@/lib/documents/recherche-documents'

const AUCUN_VISIBLE: ReadonlySet<ChampRecherche> = new Set()
const VISIBLES_DEVIS: ReadonlySet<ChampRecherche> = new Set<ChampRecherche>(['numero', 'client', 'intitule', 'date'])

const DEVIS_DUPONT = {
  id: 'd1', docType: 'devis', docNumber: 'DEV-2026-012', docTitle: 'Rénovation salle de bains',
  docDate: '2026-10-07', clientName: 'Jean Dupont', clientEmail: 'jean.dupont@example.fr',
  clientPhone: '06 12 34 56 78', clientAddress: '3 impasse des Lilas, 13008 Marseille',
  interventionAddress: '12 rue de la Paix, 42000 Saint-Étienne', interventionBatiment: 'B', interventionEtage: '2',
  lines: [{ id: 1, description: 'Pose carrelage 30x60', lineDetail: 'Faïence murale', qty: 12, priceHT: 40, totalHT: 480 }],
  notes: 'Accès par la cour, code 1234',
}
const FACTURE_MARTIN = {
  id: 'f1', docType: 'facture', docNumber: 'FACT-2026-040', docTitle: 'Ravalement de façade',
  docDate: '2026-03-15', clientName: 'SCI Martin', clientSiret: '131 197 253 00019',
  clientStreet: '8 avenue Foch', clientCity: 'Lyon', clientPostalCode: '69006',
  sourceDevisNumber: 'DEV-2026-008', maitreOuvrageFinal: 'Syndic Horizon',
  customTables: [{ id: 't1', name: 'Échafaudage', lines: [{ id: 1, description: 'Montage nacelle', qty: 1, totalHT: 900 }] }],
  fraisAnnexes: [{ id: 1, designation: 'Déplacement zone 2' }],
}

const trouve = (doc: object, requete: string, visibles: ReadonlySet<ChampRecherche> = AUCUN_VISIBLE) =>
  correspondDocument(indexerDocument(doc, 'fr'), motsRecherche(requete), visibles)

describe('normaliserRecherche', () => {
  it('minuscules, sans accents, ponctuation en espaces', () => {
    expect(normaliserRecherche('Saint-Étienne')).toBe('saint etienne')
    expect(normaliserRecherche("  L'Œuvre, n°12  ")).toBe('l oeuvre n 12')
    expect(normaliserRecherche('Março / Açores')).toBe('marco acores')
  })
  it('une saisie vide ou faite de ponctuation ne donne aucun mot', () => {
    expect(motsRecherche('')).toEqual([])
    expect(motsRecherche('  - , ')).toEqual([])
  })
})

describe('correspondDocument — tout ce qui est relié au document', () => {
  it('par le nom du client, sans accents ni majuscules', () => {
    expect(trouve(DEVIS_DUPONT, 'DUPONT').trouve).toBe(true)
    expect(trouve(DEVIS_DUPONT, 'jean').trouve).toBe(true)
  })

  it("par l'objet de l'intervention", () => {
    expect(trouve(DEVIS_DUPONT, 'salle de bain').trouve).toBe(true)
    expect(trouve(DEVIS_DUPONT, 'renovation').trouve).toBe(true)
  })

  it('par la rue du chantier, avec ou sans tiret ni accent', () => {
    expect(trouve(DEVIS_DUPONT, 'rue de la paix').trouve).toBe(true)
    expect(trouve(DEVIS_DUPONT, 'saint etienne').trouve).toBe(true)
    expect(trouve(DEVIS_DUPONT, '42000').trouve).toBe(true)
  })

  it("par l'adresse du client, y compris en champs séparés (formulaire BTP)", () => {
    expect(trouve(DEVIS_DUPONT, 'impasse des lilas').trouve).toBe(true)
    expect(trouve(FACTURE_MARTIN, 'avenue foch lyon').trouve).toBe(true)
    expect(trouve(FACTURE_MARTIN, '69006').trouve).toBe(true)
  })

  it('par une ligne, un détail de ligne, une section ou un frais annexe', () => {
    expect(trouve(DEVIS_DUPONT, 'carrelage').trouve).toBe(true)
    expect(trouve(DEVIS_DUPONT, 'faience').trouve).toBe(true)
    expect(trouve(FACTURE_MARTIN, 'echafaudage').trouve).toBe(true)
    expect(trouve(FACTURE_MARTIN, 'nacelle').trouve).toBe(true)
    expect(trouve(FACTURE_MARTIN, 'deplacement').trouve).toBe(true)
  })

  it('par le téléphone, avec ou sans espaces, par le SIRET et par l\'e-mail', () => {
    expect(trouve(DEVIS_DUPONT, '0612345678').trouve).toBe(true)
    expect(trouve(DEVIS_DUPONT, '06 12 34').trouve).toBe(true)
    expect(trouve(FACTURE_MARTIN, '13119725300019').trouve).toBe(true)
    expect(trouve(DEVIS_DUPONT, 'jean.dupont@example').trouve).toBe(true)
  })

  it("par le devis d'origine ou le maître d'ouvrage", () => {
    expect(trouve(FACTURE_MARTIN, 'DEV-2026-008').trouve).toBe(true)
    expect(trouve(FACTURE_MARTIN, 'horizon').trouve).toBe(true)
  })

  it('par les notes', () => {
    expect(trouve(DEVIS_DUPONT, 'cour').trouve).toBe(true)
  })

  it('par la date : jour, ou mois et année en toutes lettres (fr et pt)', () => {
    expect(trouve(DEVIS_DUPONT, '07/10/2026').trouve).toBe(true)
    expect(trouve(DEVIS_DUPONT, 'octobre 2026').trouve).toBe(true)
    expect(trouve(FACTURE_MARTIN, 'mars').trouve).toBe(true)
    expect(trouve(DEVIS_DUPONT, 'novembre 2026').trouve).toBe(false)
    const pt = correspondDocument(indexerDocument(FACTURE_MARTIN, 'pt'), motsRecherche('março 2026'), AUCUN_VISIBLE)
    expect(pt.trouve).toBe(true)
  })

  it('date du document absente : celle de l\'enregistrement', () => {
    expect(trouve({ docNumber: 'BR-1', savedAt: '2026-11-02T10:00:00.000Z' }, 'novembre').trouve).toBe(true)
  })

  it('plusieurs mots : tous doivent se trouver, dans des champs différents au besoin', () => {
    expect(trouve(DEVIS_DUPONT, 'dupont saint etienne').trouve).toBe(true)
    expect(trouve(DEVIS_DUPONT, 'dupont lyon').trouve).toBe(false)
  })

  it('indice : le champ non affiché qui explique la correspondance, rien quand une colonne la montre', () => {
    expect(trouve(DEVIS_DUPONT, 'paix', VISIBLES_DEVIS).indice).toEqual({ champ: 'chantier', texte: '12 rue de la Paix, 42000 Saint-Étienne, B, 2' })
    expect(trouve(DEVIS_DUPONT, 'carrelage', VISIBLES_DEVIS).indice).toEqual({ champ: 'lignes', texte: 'Pose carrelage 30x60' })
    expect(trouve(DEVIS_DUPONT, 'dupont', VISIBLES_DEVIS).indice).toBeNull()
    // Client visible + chantier : l'indice montre le chantier.
    expect(trouve(DEVIS_DUPONT, 'dupont paix', VISIBLES_DEVIS).indice?.champ).toBe('chantier')
  })

  it('indice abrégé sur une seule ligne', () => {
    const long = { docNumber: 'DEV-1', notes: `Ligne 1\n${'mot '.repeat(60)}fin` }
    const { indice } = trouve(long, 'fin')
    expect(indice?.texte.length).toBeLessThanOrEqual(90)
    expect(indice?.texte).not.toContain('\n')
    expect(indice?.texte.endsWith('…')).toBe(true)
  })

  it('données incomplètes ou mal formées : ni erreur, ni fausse correspondance', () => {
    const abime = { docNumber: null, clientName: 42, lines: [null, 'x', { description: undefined }], customTables: 'oops', docDate: 'n/a' }
    expect(() => indexerDocument(abime, 'fr')).not.toThrow()
    expect(trouve(abime, '42').trouve).toBe(true)
    expect(trouve(abime, 'oops').trouve).toBe(false)
  })
})

describe('filtrerDocuments', () => {
  const index = [DEVIS_DUPONT, FACTURE_MARTIN].map(d => indexerDocument(d, 'fr'))

  it('saisie vide : tous les documents, dans le même ordre, sans indice', () => {
    expect(filtrerDocuments(index, '  ', VISIBLES_DEVIS)).toEqual([
      { doc: DEVIS_DUPONT, indice: null },
      { doc: FACTURE_MARTIN, indice: null },
    ])
  })

  it('ne garde que les documents qui contiennent tous les mots', () => {
    expect(filtrerDocuments(index, '2026', VISIBLES_DEVIS).map(r => r.doc)).toEqual([DEVIS_DUPONT, FACTURE_MARTIN])
    expect(filtrerDocuments(index, 'facade lyon', VISIBLES_DEVIS).map(r => r.doc)).toEqual([FACTURE_MARTIN])
    expect(filtrerDocuments(index, 'introuvable', VISIBLES_DEVIS)).toEqual([])
  })
})
