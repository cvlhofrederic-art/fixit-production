import { describe, expect, it } from 'vitest'
import {
  classerDocument,
  fusionnerDocuments,
  lireDocument,
  lireFicheCadastrale,
  lireReglement,
} from '@/lib/administrateur-judiciaire/domain/import-documents-mandat'

/**
 * Nouveau mandat à partir de documents (règlement de copropriété / état descriptif de division, fiche cadastrale,
 * ordonnance) : classement du document, lecture des champs, fusion en un brouillon de mandat. Règles locales, sans IA.
 */

const REGLEMENT = `REGLEMENT DE COPROPRIETE ET ETAT DESCRIPTIF DE DIVISION
Résidence Les Platanes
12 rue des Lilas, 37000 Tours
Acte reçu par Maître Jean Martin, notaire, le 12 mars 1975.
ETAT DESCRIPTIF DE DIVISION
Lot n° 1 : un appartement au rez-de-chaussée, et les 125/1000èmes des parties communes générales.
Lot n° 2 : un appartement au premier étage, et les 140/1000èmes des parties communes générales.
Lot n° 3 : une cave, et les 5/1000èmes des parties communes générales.`

const CADASTRE = `RELEVE DE PROPRIETE - DIRECTION GENERALE DES FINANCES PUBLIQUES
Commune : 37261 TOURS
Section AB n° 123 — 12 RUE DES LILAS — contenance 4 a 50 ca
Section AB n° 124 — contenance 1 ha 2 a 3 ca`

const ORDONNANCE = `TRIBUNAL JUDICIAIRE DE TOURS
RG 26/01234
Ordonnance du 2 mars 2026 désignant un administrateur provisoire (art. 29-1) de la copropriété
Résidence Les Platanes, 12 rue des Lilas 37000 Tours, pour une durée de 12 mois.`

describe('classement du document', () => {
  it.each([
    [REGLEMENT, 'reglement'],
    [CADASTRE, 'cadastre'],
    [ORDONNANCE, 'ordonnance'],
    ['Bonjour, voici le compte rendu de la réunion.', 'inconnu'],
  ] as const)('%#', (texte, type) => {
    expect(classerDocument(texte).type).toBe(type)
  })
})

describe('règlement de copropriété / EDD', () => {
  it('lit le nom, l’adresse, la date, le notaire et les lots avec leurs tantièmes', () => {
    expect(lireReglement(REGLEMENT)).toEqual({
      nom: 'Résidence Les Platanes',
      adresse: '12 rue des Lilas, 37000 Tours',
      dateReglement: '1975-03-12',
      notaire: 'Maître Jean Martin',
      lots: [
        { numero: '1', tantiemes: { numerateur: 125, denominateur: 1000 } },
        { numero: '2', tantiemes: { numerateur: 140, denominateur: 1000 } },
        { numero: '3', tantiemes: { numerateur: 5, denominateur: 1000 } },
      ],
    })
  })

  it('un lot cité deux fois n’est compté qu’une fois ; rien de trouvé → null et liste vide', () => {
    expect(lireReglement(`${REGLEMENT}\nRappel : Lot n° 1 et les 125/1000èmes.`).lots).toHaveLength(3)
    expect(lireReglement('texte sans rien')).toEqual({ nom: null, adresse: null, dateReglement: null, notaire: null, lots: [] })
  })
})

describe('fiche cadastrale', () => {
  it('lit la commune et les parcelles avec leur contenance en m²', () => {
    expect(lireFicheCadastrale(CADASTRE)).toEqual({
      commune: 'TOURS',
      codeCommune: '37261',
      parcelles: [
        { section: 'AB', numero: '123', contenanceM2: 450 },
        { section: 'AB', numero: '124', contenanceM2: 10_203 },
      ],
    })
  })
})

describe('fusion en brouillon de mandat', () => {
  it('l’ordonnance fournit le mandat, le règlement les lots, le cadastre les parcelles ; sources tracées', () => {
    const brouillon = fusionnerDocuments([
      lireDocument('reglement.pdf', REGLEMENT),
      lireDocument('cadastre.pdf', CADASTRE),
      lireDocument('ordonnance.pdf', ORDONNANCE),
    ])
    expect(brouillon).toMatchObject({
      nom: 'Résidence Les Platanes',
      tribunal: expect.stringMatching(/tours/i),
      rg: '26/01234',
      date: '2026-03-02',
      dureeMois: 12,
      nbLots: 3,
      parcelles: [{ section: 'AB', numero: '123' }, { section: 'AB', numero: '124' }],
      manquants: [],
    })
    expect(brouillon.sources.map((s) => [s.fichier, s.type])).toEqual([
      ['reglement.pdf', 'reglement'],
      ['cadastre.pdf', 'cadastre'],
      ['ordonnance.pdf', 'ordonnance'],
    ])
  })

  it('sans ordonnance : le brouillon garde les champs du mandat à compléter, jamais devinés', () => {
    const brouillon = fusionnerDocuments([lireDocument('reglement.pdf', REGLEMENT), lireDocument('cadastre.pdf', CADASTRE)])
    expect(brouillon.nom).toBe('Résidence Les Platanes')
    expect(brouillon.nbLots).toBe(3)
    expect(brouillon.manquants).toEqual(['tribunal', 'rg', 'date', 'fondement', 'dureeMois'])
  })

  it('deux documents en désaccord sur le nom : conflit signalé, l’ordonnance l’emporte', () => {
    const brouillon = fusionnerDocuments([
      lireDocument('reglement.pdf', REGLEMENT.replace('Les Platanes', 'Les Tilleuls')),
      lireDocument('ordonnance.pdf', ORDONNANCE),
    ])
    expect(brouillon.nom).toBe('Résidence Les Platanes')
    expect(brouillon.conflits[0]).toMatch(/nom/)
  })

  it('un document non reconnu est listé mais n’apporte rien', () => {
    const brouillon = fusionnerDocuments([lireDocument('note.txt', 'Compte rendu de réunion')])
    expect(brouillon.sources[0].type).toBe('inconnu')
    expect(brouillon.nom).toBeNull()
  })
})
