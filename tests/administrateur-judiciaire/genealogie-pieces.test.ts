import { describe, expect, it } from 'vitest'
import type { DocumentLocal } from '@/lib/administrateur-judiciaire/db/schema'
import { creerDemande, modeleDeNature } from '@/lib/administrateur-judiciaire/domain/demandes'
import { creerEtapeDossier } from '@/lib/administrateur-judiciaire/domain/etapes-dossier'
import { creerRattachement, TAILLE_MAX_FICHES_LIEES, type FicheLiee } from '@/lib/administrateur-judiciaire/domain/fiches-liees'
import {
  cleDePiece,
  construireArbreFlux,
  courrierEnPieceFlux,
  creerOrigineSuite,
  demandeEnPieceFlux,
  documentEnPieceFlux,
  enPieceFlux,
  etapesEnPiecesFlux,
  honorairesEnPieceFlux,
  libellePieceFlux,
  liensDesDocuments,
  lignesDuFlux,
  type CourrierPourFlux,
  type LienFiliation,
  type NaturePieceFlux,
  type OrigineSuitePiece,
  type PieceFlux,
} from '@/lib/administrateur-judiciaire/domain/genealogie-pieces'
import { creerElement } from '@/lib/administrateur-judiciaire/domain/honoraires-facturation'
import { enTeteDuModule } from './en-tete-module'

/**
 * Flux : généalogie des pièces d'un dossier (point 52 du bilan 2 ; Gestéam, tranche 42 § Accès → Flux : Sinistre →
 * Courrier (Archivé) → Document (copie, À traiter), Document (constat), Honoraires lignes (À facturer) ; fiche document
 * avec Origine et Suite ; tranche 43 § 1 : Flux d'un contentieux, étape automatique et honoraires sous le dossier ;
 * tranche 41 : un calcul complet sur un gros mandat a fait tomber le poste, d'où le plafond).
 */

const sinistre = creerRattachement('Sinistre', 'S-7')
const contentieux = creerRattachement('Contentieux', 'C-3')
const copro = creerRattachement('Copropriété', 'copro-tilleuls')
const mandat = creerRattachement('Mandat de syndic', 'mandat-2026')

type SurchargePiece = Partial<FicheLiee> & Pick<PieceFlux, 'objet' | 'tiers' | 'dateAffichee'>

const piece = (nature: NaturePieceFlux, id: string, date: string, surcharge: SurchargePiece = {}): PieceFlux => ({
  id,
  nature,
  date,
  statut: null,
  rattachements: [sinistre],
  ...surcharge,
})
const libre = { rattachements: [] }
const origine = (parent: [NaturePieceFlux, string], enfant: string): LienFiliation => ({
  parent: { nature: parent[0], id: parent[1] },
  enfant: { nature: 'Document', id: enfant },
  source: 'origine',
})
const suite = (document: string, enfant: [NaturePieceFlux, string]): LienFiliation => ({
  parent: { nature: 'Document', id: document },
  enfant: { nature: enfant[0], id: enfant[1] },
  source: 'suite',
})
/** Élément d'honoraires « A facturer » rattaché au sinistre (T42). */
const elementDuSinistre = () =>
  creerElement({
    id: 'el-1',
    coproprieteId: 'copro-tilleuls',
    mandatId: 'mandat-2026',
    date: '2026-03-02',
    dossier: 'Sinistre',
    fiche: sinistre,
    nature: 'Prestations',
    tarif: 'Sinistre - SUIVI ET GESTION MRI',
    calcul: 'Coût horaire',
    quantite: 1,
    prixUnitaireHtDixMilliemes: 0,
    soumisTva: true,
    tauxTvaPct: 20,
    destinataire: 'Syndicat des copropriétaires',
  })
const lignes = (arbre: ReturnType<typeof construireArbreFlux>, replies?: ReadonlySet<string>) =>
  lignesDuFlux(arbre, replies).map(({ piece: p, profondeur }) => `${'  '.repeat(profondeur - 1)}${p.nature} ${p.id} (${p.statut ?? '—'})`)

describe('origine et suite d’une pièce', () => {
  it('nature Courrier ou Demande, fiche et date facultatives ; blancs effacés', () => {
    expect(
      creerOrigineSuite({
        origine: { nature: 'Courrier', id: ' co-1 ', date: '2026-03-02' },
        pieceOrigineId: '  ',
        suite: { nature: 'Demande', id: 'de-4' },
      }),
    ).toEqual({ origine: { nature: 'Courrier', id: 'co-1', date: '2026-03-02' }, pieceOrigineId: null, suite: { nature: 'Demande', id: 'de-4', date: null } })
    expect(creerOrigineSuite({})).toEqual({ origine: null, pieceOrigineId: null, suite: null })
    expect(creerOrigineSuite({ origine: { nature: 'Demande', date: '2026-01-05' }, pieceOrigineId: ' doc-9 ' })).toEqual({
      origine: { nature: 'Demande', id: null, date: '2026-01-05' },
      pieceOrigineId: 'doc-9',
      suite: null,
    })
  })

  it('refuse une nature inconnue, une date invalide, une même fiche origine et suite, une suite avant l’origine', () => {
    // @ts-expect-error — nature hors liste
    expect(() => creerOrigineSuite({ origine: { nature: 'Email', id: 'x' } })).toThrow(/nature « Email » inconnue/)
    expect(() => creerOrigineSuite({ suite: { nature: 'Courrier', id: 'co-1', date: '02/03/2026' } })).toThrow(/Suite : date invalide/)
    expect(() => creerOrigineSuite({ origine: { nature: 'Courrier', id: 'co-1' }, suite: { nature: 'Courrier', id: ' co-1' } })).toThrow(
      /à la fois l'origine et la suite/,
    )
    expect(() =>
      creerOrigineSuite({ origine: { nature: 'Courrier', id: 'co-1', date: '2026-03-02' }, suite: { nature: 'Courrier', id: 'co-2', date: '2026-03-01' } }),
    ).toThrow(/avant l'origine/)
    // même identifiant, natures différentes : deux fiches distinctes
    expect(creerOrigineSuite({ origine: { nature: 'Courrier', id: 'x-1' }, suite: { nature: 'Demande', id: 'x-1' } }).suite?.nature).toBe('Demande')
  })

  it('liens : l’Origine est le parent du document, la Suite son enfant ; une origine sans fiche ne fait pas de lien', () => {
    expect(
      liensDesDocuments([
        { id: 'doc-1', origineSuite: creerOrigineSuite({ origine: { nature: 'Courrier', id: 'co-1' }, suite: { nature: 'Demande', id: 'de-2' } }) },
        { id: 'doc-2', origineSuite: creerOrigineSuite({ origine: { nature: 'Demande', date: '2026-01-05' } }) },
      ]),
    ).toEqual([origine(['Courrier', 'co-1'], 'doc-1'), suite('doc-1', ['Demande', 'de-2'])])
  })

  it('liens : le champ facultatif prévu sur DocumentLocal passe tel quel ; un document sans ce champ, ou nul, n’en fait pas', () => {
    const suivi = { createdAt: '2026-03-03T09:00:00.000Z', updatedAt: '2026-03-03T09:00:00.000Z', createdBy: null, updatedBy: null }
    const fiche = { ...suivi, entiteType: 'mandat', entiteId: 'm-1', type: 'piece', dateCreation: new Date(2026, 2, 3) }
    // branchement de l'en-tête : DocumentLocal portant `origineSuite?: OrigineSuitePiece`
    const documents: (DocumentLocal & { origineSuite?: OrigineSuitePiece })[] = [
      { ...fiche, id: 'doc-0', nom: 'Constat' },
      { ...fiche, id: 'doc-1', nom: 'Copie', origineSuite: creerOrigineSuite({ origine: { nature: 'Courrier', id: 'co-1' } }) },
    ]
    expect(liensDesDocuments(documents)).toEqual([origine(['Courrier', 'co-1'], 'doc-1')])
    expect(liensDesDocuments([{ id: 'doc-n', origineSuite: null }])).toEqual([])
  })
})

describe('pièces du Flux', () => {
  const courrier: CourrierPourFlux = {
    id: 'co-1',
    statut: 'Archivé',
    objet: 'Déclaration de sinistre',
    dateDepot: '2026-03-02',
    createdAt: '2026-02-27T12:00:00.000Z',
    coproprieteId: 'copro-tilleuls',
    mandatId: null,
    personneId: null,
    entrepriseId: null,
  }

  it('courrier : date de dépôt, à défaut de création ; objet, tiers passé ; dossiers passés puis rattachements de ses champs', () => {
    expect(courrierEnPieceFlux(courrier, { dossiers: [sinistre], tiers: ' Courtier ' })).toEqual({
      id: 'co-1',
      nature: 'Courrier',
      date: '2026-03-02',
      statut: 'Archivé',
      objet: 'Déclaration de sinistre',
      tiers: 'Courtier',
      rattachements: [sinistre, copro],
    })
    expect(courrierEnPieceFlux({ ...courrier, dateDepot: null })).toMatchObject({ date: '2026-02-27', tiers: null, rattachements: [copro] })
    expect(() => courrierEnPieceFlux({ ...courrier, dateDepot: null, createdAt: 'hier' })).toThrow(/Courrier co-1 : date de création invalide/)
  })

  it('document : date de création, nom en objet, statut passé (null par défaut), rattachement de entiteType / entiteId', () => {
    const document = { id: 'doc-1', entiteType: 'mandat', entiteId: 'm-1', nom: 'Constat amiable', dateCreation: new Date(2026, 2, 4) }
    expect(documentEnPieceFlux(document)).toEqual({
      id: 'doc-1',
      nature: 'Document',
      date: '2026-03-04',
      statut: null,
      objet: 'Constat amiable',
      tiers: null,
      rattachements: [{ type: 'Mandat de syndic', id: 'm-1' }],
    })
    expect(documentEnPieceFlux(document, { statut: 'À traiter', dossiers: [sinistre], tiers: 'Assureur' })).toMatchObject({
      statut: 'À traiter',
      tiers: 'Assureur',
      rattachements: [sinistre, { type: 'Mandat de syndic', id: 'm-1' }],
    })
    expect(() => documentEnPieceFlux({ ...document, dateCreation: new Date(Number.NaN) })).toThrow(/Document doc-1 : date de création invalide/)
  })

  it('étape (T43) : statut au jour donné, titre en objet, date affichée = réalisation (vide tant qu’elle n’est pas faite)', () => {
    const etape = creerEtapeDossier({
      id: 'et-copie-cs',
      titre: 'Copie au CS pour info',
      creeeLe: '2026-01-12',
      origine: 'automatique',
      demandeurId: 'collab-A',
      rattachements: [contentieux],
    })
    const faite = { ...etape, id: 'et-faite', faitLe: '2026-01-20' }
    const [ouverte, realisee] = etapesEnPiecesFlux([etape, faite], '2026-03-01')
    expect(ouverte).toMatchObject({
      id: 'et-copie-cs',
      nature: 'Étape',
      date: '2026-01-12',
      dateAffichee: null,
      objet: 'Copie au CS pour info',
      tiers: null,
      statut: 'À faire',
      rattachements: [contentieux],
    })
    expect(realisee).toMatchObject({ id: 'et-faite', date: '2026-01-12', dateAffichee: '2026-01-20', statut: 'Terminée' })
    expect(etape.faitLe).toBeNull()
    expect(() => etapesEnPiecesFlux([etape], '01/03/2026')).toThrow()
  })

  it('honoraires (T42) : élément « A facturer » sous sa fiche de dossier, tarif en objet, élément conservé', () => {
    const element = elementDuSinistre()
    const p = honorairesEnPieceFlux(element)
    expect(p).toMatchObject({
      id: 'el-1',
      nature: 'Honoraires lignes',
      date: '2026-03-02',
      statut: 'A facturer',
      objet: 'Sinistre - SUIVI ET GESTION MRI',
      tiers: null,
      rattachements: [sinistre, copro, mandat],
    })
    expect(p.element).toBe(element)
  })

  it('demande : objet, tiers passé, dossier de la demande dans les rattachements', () => {
    const modele = modeleDeNature('OS Copro')
    if (!modele) throw new Error('Modèle « OS Copro » absent.')
    const demande = creerDemande(
      { id: 'de-1', coproprieteId: 'copro-tilleuls', mandatId: null, prestataireId: null, demandeLe: '2026-03-04', objet: 'Recherche de fuite', dossier: sinistre },
      modele,
    )
    expect(demandeEnPieceFlux(demande, { tiers: 'Plombier' })).toEqual({
      id: 'de-1',
      nature: 'Demande',
      date: '2026-03-04',
      statut: demande.statut,
      objet: 'Recherche de fuite',
      tiers: 'Plombier',
      rattachements: [copro, sinistre],
    })
    expect(demandeEnPieceFlux(demande).tiers).toBeNull()
  })

  it('une fiche liée déjà convertie garde ses champs', () => {
    const etape = { id: 'et-1', date: '2026-03-02', statut: 'À faire', titre: 'Copie au CS pour info', rattachements: [contentieux] }
    expect(enPieceFlux('Étape', etape)).toEqual({ ...etape, nature: 'Étape' })
  })
})

describe('libellé d’un nœud (T42 : « Nature - date - tiers - objet - statut »)', () => {
  it('date en JJ/MM/AAAA ; tiers, objet et statut absents ou vides omis', () => {
    expect(libellePieceFlux(piece('Courrier', 'co-1', '2026-03-02', { tiers: 'Courtier', objet: 'Déclaration', statut: 'Archivé' }))).toBe(
      'Courrier - 02/03/2026 - Courtier - Déclaration - Archivé',
    )
    expect(libellePieceFlux(piece('Document', 'doc-1', '2026-03-03', { objet: '  ', tiers: null }))).toBe('Document - 03/03/2026')
  })

  it('date affichée prioritaire ; nulle (étape non réalisée, T43 « 00/00/00 ») : omise', () => {
    expect(libellePieceFlux(piece('Étape', 'et-1', '2026-01-12', { dateAffichee: null, objet: 'Copie au CS pour info', statut: 'À faire' }))).toBe(
      'Étape - Copie au CS pour info - À faire',
    )
    expect(libellePieceFlux(piece('Étape', 'et-1', '2026-01-12', { dateAffichee: '2026-01-20', statut: 'Terminée' }))).toBe('Étape - 20/01/2026 - Terminée')
  })
})

describe('arbre du Flux', () => {
  it('sinistre (T42) : courrier → copie, constat et honoraires sous le dossier, statut sur chaque nœud ; listes reçues intactes', () => {
    const pieces = [
      piece('Honoraires lignes', 'h-1', '2026-03-02', { statut: 'À facturer' }),
      piece('Document', 'doc-constat', '2026-03-05', { statut: 'À traiter' }),
      piece('Document', 'doc-copie', '2026-03-03', { statut: 'À traiter', ...libre }),
      piece('Courrier', 'co-declaration', '2026-03-02', { statut: 'Archivé' }),
    ]
    const liens = [origine(['Courrier', 'co-declaration'], 'doc-copie')]
    const avant = structuredClone({ pieces, liens })
    const arbre = construireArbreFlux(sinistre, pieces, liens)
    expect(lignes(arbre)).toEqual([
      'Courrier co-declaration (Archivé)',
      '  Document doc-copie (À traiter)',
      'Document doc-constat (À traiter)',
      'Honoraires lignes h-1 (À facturer)',
    ])
    expect(arbre.racine).toEqual(sinistre)
    expect(arbre.total).toBe(4)
    expect(arbre.tronque).toBe(false)
    expect(arbre.anomalies).toEqual([])
    expect(arbre.enfants[0].enfants[0].profondeur).toBe(2)
    expect({ pieces, liens }).toEqual(avant)
  })

  it('contentieux (T43) : étape, courrier, honoraires ; frères par nature, puis date, puis identifiant', () => {
    const r = { rattachements: [contentieux] }
    const arbre = construireArbreFlux(
      contentieux,
      [
        piece('Honoraires lignes', 'h-mise-en-demeure', '2026-01-10', r),
        piece('Honoraires lignes', 'h-envoi-2', '2026-01-12', r),
        piece('Honoraires lignes', 'h-envoi-1', '2026-01-12', r),
        piece('Courrier', 'co-med', '2026-01-12', { ...r, statut: 'Archivé' }),
        piece('Document', 'doc-retour', '2026-02-03', { statut: 'Terminé', ...libre }),
        piece('Étape', 'et-copie-cs', '2026-01-12', { ...r, statut: 'À faire' }),
        piece('Courrier', 'co-autre-dossier', '2026-01-01'),
      ],
      [origine(['Courrier', 'co-med'], 'doc-retour')],
    )
    expect(lignes(arbre)).toEqual([
      'Étape et-copie-cs (À faire)',
      'Courrier co-med (Archivé)',
      '  Document doc-retour (Terminé)',
      'Honoraires lignes h-mise-en-demeure (—)',
      'Honoraires lignes h-envoi-1 (—)',
      'Honoraires lignes h-envoi-2 (—)',
    ])
    expect(arbre.total).toBe(6)
  })

  it('la Suite d’un document est son enfant, même hors du dossier ; une pièce non rattachée entre par son parent', () => {
    const arbre = construireArbreFlux(
      sinistre,
      [
        piece('Document', 'doc-rapport', '2026-04-01'),
        piece('Courrier', 'co-reponse', '2026-04-08', libre),
        piece('Document', 'doc-ar', '2026-04-15', libre),
        piece('Courrier', 'co-isole', '2026-04-20', libre),
      ],
      [suite('doc-rapport', ['Courrier', 'co-reponse']), origine(['Courrier', 'co-reponse'], 'doc-ar')],
    )
    expect(lignes(arbre)).toEqual(['Document doc-rapport (—)', '  Courrier co-reponse (—)', '    Document doc-ar (—)'])
  })

  it('l’arbre se construit aussi depuis les fiches document (liensDesDocuments)', () => {
    const origineSuite = creerOrigineSuite({ origine: { nature: 'Courrier', id: 'co-1', date: '2026-03-02' } })
    const arbre = construireArbreFlux(
      sinistre,
      [piece('Courrier', 'co-1', '2026-03-02'), piece('Document', 'doc-1', '2026-03-03', libre)],
      liensDesDocuments([{ id: 'doc-1', origineSuite }]),
    )
    expect(lignes(arbre)).toEqual(['Courrier co-1 (—)', '  Document doc-1 (—)'])
  })

  it('orphelin : parent introuvable, la pièce reste sous le dossier ; suite introuvable signalée', () => {
    const arbre = construireArbreFlux(
      sinistre,
      [piece('Document', 'doc-1', '2026-03-03')],
      [origine(['Courrier', 'co-supprime'], 'doc-1'), suite('doc-1', ['Demande', 'de-absente'])],
    )
    expect(lignes(arbre)).toEqual(['Document doc-1 (—)'])
    expect(arbre.anomalies).toEqual([
      { nature: 'orphelin', piece: { nature: 'Document', id: 'doc-1' }, autre: { nature: 'Courrier', id: 'co-supprime' }, message: 'Document doc-1 : parent Courrier co-supprime introuvable.' },
      {
        nature: 'enfant_introuvable',
        piece: { nature: 'Document', id: 'doc-1' },
        autre: { nature: 'Demande', id: 'de-absente' },
        message: 'Document doc-1 : suite Demande de-absente introuvable.',
      },
    ])
  })

  it('document introuvable qui a une pièce du dossier pour Origine : signalé sur cette pièce, sans inverser la filiation', () => {
    const arbre = construireArbreFlux(sinistre, [piece('Courrier', 'co-1', '2026-03-02')], [origine(['Courrier', 'co-1'], 'doc-x')])
    expect(lignes(arbre)).toEqual(['Courrier co-1 (—)'])
    expect(arbre.anomalies).toEqual([
      {
        nature: 'enfant_introuvable',
        piece: { nature: 'Courrier', id: 'co-1' },
        autre: { nature: 'Document', id: 'doc-x' },
        message: "Courrier co-1 : Document doc-x, qui l'a pour origine, introuvable.",
      },
    ])
  })

  it('un orphelin non rattaché au dossier n’y entre pas, et son anomalie n’est pas rendue', () => {
    const arbre = construireArbreFlux(sinistre, [piece('Document', 'doc-ailleurs', '2026-03-03', libre)], [origine(['Courrier', 'co-x'], 'doc-ailleurs')])
    expect(arbre.total).toBe(0)
    expect(arbre.enfants).toEqual([])
    expect(arbre.anomalies).toEqual([])
  })

  it('plusieurs parents : un même courrier en Suite de deux documents du dossier se range sous le plus ancien, l’autre est signalé', () => {
    const suiteDe = (document: string) => ({ id: document, origineSuite: creerOrigineSuite({ suite: { nature: 'Courrier', id: 'co-r' } }) })
    const pieces = [piece('Document', 'doc-2', '2026-03-04'), piece('Document', 'doc-1', '2026-03-02'), piece('Courrier', 'co-r', '2026-03-10', libre)]
    const liens = liensDesDocuments([suiteDe('doc-2'), suiteDe('doc-1')])
    const arbre = construireArbreFlux(sinistre, pieces, liens)
    expect(lignes(arbre)).toEqual(['Document doc-1 (—)', '  Courrier co-r (—)', 'Document doc-2 (—)'])
    expect(arbre.anomalies).toEqual([
      {
        nature: 'plusieurs_parents',
        piece: { nature: 'Courrier', id: 'co-r' },
        autre: { nature: 'Document', id: 'doc-2' },
        message: 'Courrier co-r : second parent Document doc-2 écarté.',
      },
    ])
    // l'ordre des liens reçus est sans effet
    expect(lignes(construireArbreFlux(sinistre, pieces, [...liens].reverse()))).toEqual(lignes(arbre))
    // un lien reçu deux fois n'est pas un second parent
    expect(construireArbreFlux(sinistre, pieces, [liens[0], liens[0]]).anomalies).toEqual([])
    // un document n'est jamais la Suite d'un autre : seule son Origine en fait un enfant, d'où un parent au plus
    // @ts-expect-error — nature hors liste
    expect(() => creerOrigineSuite({ suite: { nature: 'Document', id: 'doc-b' } })).toThrow(/nature « Document » inconnue/)
  })

  it('plusieurs parents : celui qui relie la pièce au dossier l’emporte ; même Flux avec les pièces du dossier ou de la copropriété', () => {
    const autreSinistre = creerRattachement('Sinistre', 'S-8')
    const suiteDe = (document: string) => ({ id: document, origineSuite: creerOrigineSuite({ suite: { nature: 'Courrier', id: 'co-rep' } }) })
    // une même réponse co-rep, Suite de doc-B (ce sinistre) et de doc-old (sinistre S-8, plus ancien)
    const liens = liensDesDocuments([suiteDe('doc-old'), suiteDe('doc-B')])
    const duDossier = [piece('Document', 'doc-B', '2026-03-01'), piece('Courrier', 'co-rep', '2026-03-05', libre)]
    const deLaCopro = [...duDossier, piece('Document', 'doc-old', '2026-01-01', { rattachements: [autreSinistre] })]
    const attendu = ['Document doc-B (—)', '  Courrier co-rep (—)']
    expect(lignes(construireArbreFlux(sinistre, duDossier, liens))).toEqual(attendu)
    const arbre = construireArbreFlux(sinistre, deLaCopro, liens)
    expect(lignes(arbre)).toEqual(attendu)
    expect(arbre.anomalies.map((a) => a.message)).toEqual(['Courrier co-rep : second parent Document doc-old écarté.'])
    // elle figure aussi dans le Flux de l'autre sinistre, sous son document
    expect(lignes(construireArbreFlux(autreSinistre, deLaCopro, liens))).toEqual(['Document doc-old (—)', '  Courrier co-rep (—)'])

    // parent plus ancien rattaché à aucun dossier : la demande reste dans le Flux du dossier
    const demande = construireArbreFlux(
      sinistre,
      [piece('Document', 'doc-libre', '2025-01-01', libre), piece('Document', 'doc-B', '2026-03-01'), piece('Demande', 'de-1', '2026-03-05', libre)],
      [suite('doc-libre', ['Demande', 'de-1']), suite('doc-B', ['Demande', 'de-1'])],
    )
    expect(lignes(demande)).toEqual(['Document doc-B (—)', '  Demande de-1 (—)'])

    // un parent du dossier n'est pas écarté au profit d'un parent qui ferait boucler la chaîne
    const boucle = construireArbreFlux(
      sinistre,
      [
        piece('Courrier', 'co-1', '2026-01-01'),
        piece('Document', 'doc-c', '2026-01-02', libre),
        piece('Courrier', 'co-2', '2026-01-03', libre),
        piece('Document', 'doc-a', '2026-01-04', libre),
        piece('Document', 'doc-b', '2026-03-01'),
      ],
      [origine(['Courrier', 'co-1'], 'doc-c'), suite('doc-c', ['Courrier', 'co-2']), origine(['Courrier', 'co-2'], 'doc-a'), suite('doc-a', ['Courrier', 'co-1']), suite('doc-b', ['Courrier', 'co-1'])],
    )
    expect(lignes(boucle)).toEqual(['Document doc-b (—)', '  Courrier co-1 (—)', '    Document doc-c (—)', '      Courrier co-2 (—)', '        Document doc-a (—)'])
    expect(boucle.anomalies.map((a) => [a.nature, a.piece.id, a.autre?.id])).toEqual([
      ['plusieurs_parents', 'co-1', 'doc-a'],
      ['chronologie', 'co-1', 'doc-b'],
    ])
  })

  it('un lien reçu deux fois n’est signalé qu’une fois (introuvable, orphelin, parent écarté, pièce née d’elle-même)', () => {
    const fiche = { id: 'doc-1', origineSuite: creerOrigineSuite({ origine: { nature: 'Courrier', id: 'co-x' }, suite: { nature: 'Demande', id: 'de-y' } }) }
    const introuvables = construireArbreFlux(sinistre, [piece('Document', 'doc-1', '2026-03-03')], liensDesDocuments([fiche, fiche]))
    expect(introuvables.anomalies.map((a) => a.nature)).toEqual(['orphelin', 'enfant_introuvable'])

    const pieces = [piece('Document', 'doc-1', '2026-03-02'), piece('Document', 'doc-2', '2026-03-04'), piece('Courrier', 'co-r', '2026-03-10', libre)]
    const ecarte = suite('doc-2', ['Courrier', 'co-r'])
    const parents = construireArbreFlux(sinistre, pieces, [suite('doc-1', ['Courrier', 'co-r']), ecarte, ecarte])
    expect(parents.anomalies.map((a) => [a.nature, a.autre?.id])).toEqual([['plusieurs_parents', 'doc-2']])

    const auto = origine(['Document', 'doc-1'], 'doc-1')
    expect(construireArbreFlux(sinistre, pieces, [auto, auto]).anomalies.map((a) => a.nature)).toEqual(['cycle'])
  })

  it('cycle : coupé au lien de la pièce la plus ancienne, signalé ; une pièce née d’elle-même aussi', () => {
    const pieces = [
      piece('Courrier', 'co-1', '2026-03-01'),
      piece('Document', 'doc-1', '2026-03-02', libre),
      piece('Courrier', 'co-2', '2026-03-03', libre),
      piece('Document', 'doc-2', '2026-03-04', libre),
    ]
    const liens = [
      origine(['Courrier', 'co-1'], 'doc-1'),
      suite('doc-1', ['Courrier', 'co-2']),
      origine(['Courrier', 'co-2'], 'doc-2'),
      suite('doc-2', ['Courrier', 'co-1']),
    ]
    const arbre = construireArbreFlux(sinistre, pieces, liens)
    expect(lignes(arbre)).toEqual(['Courrier co-1 (—)', '  Document doc-1 (—)', '    Courrier co-2 (—)', '      Document doc-2 (—)'])
    expect(arbre.anomalies).toHaveLength(1)
    expect(arbre.anomalies[0]).toMatchObject({ nature: 'cycle', piece: { nature: 'Courrier', id: 'co-1' }, autre: { nature: 'Document', id: 'doc-2' } })
    // le cycle se lit du parent vers l'enfant, depuis la pièce dont le lien est coupé
    expect(arbre.anomalies[0].message).toBe('Cycle Courrier co-1 → Document doc-1 → Courrier co-2 → Document doc-2 : lien de Courrier co-1, la plus ancienne, coupé.')

    const auto = construireArbreFlux(sinistre, [piece('Document', 'doc-1', '2026-03-02')], [origine(['Document', 'doc-1'], 'doc-1')])
    expect(lignes(auto)).toEqual(['Document doc-1 (—)'])
    expect(auto.anomalies.map((a) => a.nature)).toEqual(['cycle'])
  })

  it('un cycle hors du dossier n’entre pas dans l’arbre', () => {
    const arbre = construireArbreFlux(
      sinistre,
      [piece('Courrier', 'co-1', '2026-03-01', libre), piece('Document', 'doc-1', '2026-03-02', libre)],
      [origine(['Courrier', 'co-1'], 'doc-1'), suite('doc-1', ['Courrier', 'co-1'])],
    )
    expect(arbre.total).toBe(0)
    expect(arbre.anomalies).toEqual([])
  })

  it('hors dossier : pièce rattachée dont le parent ne l’est pas, rangée sous le dossier', () => {
    const arbre = construireArbreFlux(
      sinistre,
      [piece('Courrier', 'co-copro', '2026-01-10', { rattachements: [copro] }), piece('Document', 'doc-1', '2026-03-02')],
      [origine(['Courrier', 'co-copro'], 'doc-1')],
    )
    expect(lignes(arbre)).toEqual(['Document doc-1 (—)'])
    expect(arbre.anomalies).toEqual([
      {
        nature: 'hors_dossier',
        piece: { nature: 'Document', id: 'doc-1' },
        autre: { nature: 'Courrier', id: 'co-copro' },
        message: 'Document doc-1 : parent Courrier co-copro hors du dossier ; rangée sous le dossier.',
      },
    ])
  })

  it('chronologie : un enfant daté avant son parent reste sous lui, avec un avertissement', () => {
    const arbre = construireArbreFlux(
      sinistre,
      [piece('Courrier', 'co-1', '2026-03-05'), piece('Document', 'doc-1', '2026-03-01', libre), piece('Document', 'doc-2', '2026-03-05', libre)],
      [origine(['Courrier', 'co-1'], 'doc-1'), origine(['Courrier', 'co-1'], 'doc-2')],
    )
    expect(lignes(arbre)).toEqual(['Courrier co-1 (—)', '  Document doc-1 (—)', '  Document doc-2 (—)'])
    expect(arbre.anomalies).toEqual([
      {
        nature: 'chronologie',
        piece: { nature: 'Document', id: 'doc-1' },
        autre: { nature: 'Courrier', id: 'co-1' },
        message: 'Document doc-1 : pièce du 01/03/2026, antérieure à son parent Courrier co-1 du 05/03/2026.',
      },
    ])
  })

  it('doublon : la première pièce reçue est gardée ; même identifiant, natures différentes : deux pièces', () => {
    const arbre = construireArbreFlux(sinistre, [
      piece('Courrier', 'x-1', '2026-03-01', { statut: 'Archivé' }),
      piece('Courrier', 'x-1', '2026-03-09', { statut: 'Préparation' }),
      piece('Document', 'x-1', '2026-03-02'),
    ])
    expect(lignes(arbre)).toEqual(['Courrier x-1 (Archivé)', 'Document x-1 (—)'])
    expect(arbre.anomalies.map((a) => [a.nature, a.piece])).toEqual([['doublon', { nature: 'Courrier', id: 'x-1' }]])
  })

  it('copies identiques (pièces de la copropriété, sans dossier, réunies à celles du dossier) : une pièce, sans avertissement, avec les rattachements de chaque copie', () => {
    const courrier = (id: string): CourrierPourFlux => ({
      id,
      statut: 'Archivé',
      objet: 'Déclaration de sinistre',
      dateDepot: '2026-03-02',
      createdAt: '2026-02-27T12:00:00.000Z',
      coproprieteId: 'copro-tilleuls',
      mandatId: null,
      personneId: null,
      entrepriseId: null,
    })
    const ids = ['co-1', 'co-2', 'co-3', 'co-4', 'co-5']
    const deLaCopro = [...ids, 'co-autre'].map((id) => courrierEnPieceFlux(courrier(id)))
    const duDossier = ids.map((id) => courrierEnPieceFlux(courrier(id), { dossiers: [sinistre] }))
    for (const pieces of [
      [...deLaCopro, ...duDossier],
      [...duDossier, ...deLaCopro],
    ]) {
      const arbre = construireArbreFlux(sinistre, pieces)
      expect(lignes(arbre)).toEqual(ids.map((id) => `Courrier ${id} (Archivé)`))
      expect(arbre.total).toBe(5)
      expect(arbre.anomalies).toEqual([])
      // la pièce rendue porte le rattachement au dossier qui l'a fait entrer dans l'arbre
      for (const { piece: p } of lignesDuFlux(arbre)) {
        expect(p.rattachements).toHaveLength(2)
        expect(p.rattachements).toEqual(expect.arrayContaining([sinistre, copro]))
      }
    }
    // listes reçues intactes
    expect(deLaCopro.map((p) => p.rattachements)).toEqual(Array(6).fill([copro]))
    expect(duDossier.map((p) => p.rattachements)).toEqual(Array(5).fill([sinistre, copro]))
  })

  it('copies qui diffèrent : la première reçue est gardée, avec les rattachements de toutes ; un seul doublon par pièce, avec les champs qui diffèrent', () => {
    const pieces = [
      piece('Courrier', 'co-1', '2026-03-01', { statut: 'Archivé', rattachements: [copro] }),
      piece('Courrier', 'co-1', '2026-03-01', { statut: 'Préparation' }),
      piece('Courrier', 'co-1', '2026-03-09', { statut: 'Archivé', objet: 'Relance' }),
    ]
    const arbre = construireArbreFlux(sinistre, pieces)
    expect(lignes(arbre)).toEqual(['Courrier co-1 (Archivé)'])
    expect(lignesDuFlux(arbre)[0].piece).toEqual({ ...pieces[0], rattachements: [copro, sinistre] })
    expect(arbre.anomalies).toEqual([
      {
        nature: 'doublon',
        piece: { nature: 'Courrier', id: 'co-1' },
        autre: null,
        message: 'Courrier co-1 : copies qui diffèrent (date, objet, statut) ; la première reçue est gardée, avec les rattachements de toutes.',
      },
    ])
    expect(pieces[0].rattachements).toEqual([copro])
  })

  it('copies comparées champ par champ (objets, tableaux, dates imbriqués) : copies distinctes de même contenu réunies ; une valeur imbriquée qui diffère est un doublon', () => {
    const element = elementDuSinistre()
    const honoraires = honorairesEnPieceFlux(element)
    const document = enPieceFlux('Document', { id: 'doc-1', date: '2026-03-03', statut: null, rattachements: [sinistre], recuLe: new Date(2026, 2, 3), pages: [1, 2] })
    const identiques = construireArbreFlux(sinistre, [honoraires, structuredClone(honoraires), document, { ...document, recuLe: new Date(2026, 2, 3), pages: [1, 2] }])
    expect(identiques.total).toBe(2)
    expect(identiques.anomalies).toEqual([])
    const differentes = construireArbreFlux(sinistre, [
      honoraires,
      { ...honoraires, element: { ...element, quantite: 2 } },
      document,
      { ...document, recuLe: new Date(2026, 2, 4), pages: [1, 2, 3] },
    ])
    expect(differentes.total).toBe(2)
    expect(differentes.anomalies.map((a) => a.message)).toEqual([
      'Honoraires lignes el-1 : copies qui diffèrent (element) ; la première reçue est gardée, avec les rattachements de toutes.',
      'Document doc-1 : copies qui diffèrent (pages, recuLe) ; la première reçue est gardée, avec les rattachements de toutes.',
    ])
  })

  it('date de pièce ou date affichée invalide : erreur', () => {
    expect(() => construireArbreFlux(sinistre, [piece('Document', 'doc-1', '03/03/2026')])).toThrow(/Document doc-1 : date invalide/)
    expect(() => construireArbreFlux(sinistre, [piece('Étape', 'et-1', '2026-03-03', { dateAffichee: '2026-02-30' })])).toThrow(
      /Étape et-1 : date affichée invalide/,
    )
  })

  it('une fiche liée d’une autre nature garde ses champs dans l’arbre', () => {
    const etape = enPieceFlux('Étape', { id: 'et-1', date: '2026-03-02', statut: 'À faire', titre: 'Copie au CS pour info', rattachements: [contentieux] })
    const [ligne] = lignesDuFlux(construireArbreFlux(contentieux, [etape]))
    expect(ligne.piece.titre).toBe('Copie au CS pour info')
    expect(ligne.profondeur).toBe(1)
  })
})

describe('plafond (T41) et affichage replié (Contracter / Déployer)', () => {
  const pieces = [
    piece('Courrier', 'co-1', '2026-03-01'),
    piece('Document', 'doc-a', '2026-03-02', libre),
    piece('Document', 'doc-b', '2026-03-03', libre),
    piece('Honoraires lignes', 'h-1', '2026-03-01'),
  ]
  const liens = [origine(['Courrier', 'co-1'], 'doc-a'), origine(['Courrier', 'co-1'], 'doc-b')]

  it('au-delà du plafond, l’arbre est coupé dans l’ordre d’affichage ; total compte toutes les pièces', () => {
    const arbre = construireArbreFlux(sinistre, pieces, liens, { plafond: 2 })
    expect(lignes(arbre)).toEqual(['Courrier co-1 (—)', '  Document doc-a (—)'])
    expect(arbre.total).toBe(4)
    expect(arbre.tronque).toBe(true)
    expect(construireArbreFlux(sinistre, pieces, liens, { plafond: 4 }).tronque).toBe(false)
  })

  it('plafond par défaut : celui des fiches liées ; plafond invalide refusé', () => {
    const nombreuses = Array.from({ length: TAILLE_MAX_FICHES_LIEES + 1 }, (_, i) => piece('Document', `doc-${String(i).padStart(4, '0')}`, '2026-03-01'))
    const arbre = construireArbreFlux(sinistre, nombreuses)
    expect(lignesDuFlux(arbre)).toHaveLength(TAILLE_MAX_FICHES_LIEES)
    expect(arbre.total).toBe(TAILLE_MAX_FICHES_LIEES + 1)
    expect(arbre.tronque).toBe(true)
    for (const plafond of [0, 1.5, TAILLE_MAX_FICHES_LIEES + 1])
      expect(() => construireArbreFlux(sinistre, pieces, liens, { plafond })).toThrow(/Plafond invalide/)
  })

  it('lignes : clé et présence d’enfants ; une pièce repliée cache ses descendants', () => {
    const arbre = construireArbreFlux(sinistre, pieces, liens)
    const toutes = lignesDuFlux(arbre)
    expect(toutes.map((l) => [l.cle, l.aEnfants])).toEqual([
      ['Courrier:co-1', true],
      ['Document:doc-a', false],
      ['Document:doc-b', false],
      ['Honoraires lignes:h-1', false],
    ])
    expect(cleDePiece({ nature: 'Courrier', id: 'co-1' })).toBe('Courrier:co-1')
    expect(lignes(arbre, new Set([cleDePiece({ nature: 'Courrier', id: 'co-1' })]))).toEqual(['Courrier co-1 (—)', 'Honoraires lignes h-1 (—)'])
  })
})

describe('en-tête du module', () => {
  const { texte, item } = enTeteDuModule('genealogie-pieces')

  it('cite les tranches lues et la Règle 5 (Courrier ≠ Document)', () => {
    for (const source of ['Tranche 42 § Accès → Flux', 'Tranche 43 § 1', 'Tranche 41', 'Règle 5']) expect(texte).toContain(source)
    expect(texte).toMatch(/Courrier ≠ Document/)
  })

  it('chaque question ouverte est adressée à Hugo ou à Frédéric', () => {
    const bloc = texte.slice(texte.indexOf('🔴 Non établi'), texte.indexOf('Le droit'))
    const numeros = [...bloc.matchAll(/(?<=\s)(\d+)\. /g)].map((m) => Number(m[1]))
    const adressees = [...bloc.matchAll(/(?<=\s)(\d+)\. (?:Hugo|Frédéric)(?: ou (?:Hugo|Frédéric))? :/g)].map((m) => Number(m[1]))
    expect(numeros).toEqual([1, 2, 3, 4, 5, 6, 7, 8])
    expect(adressees).toEqual(numeros)
    expect(texte).toMatch(/5\. Frédéric : le statut d'un document/)
  })

  it('droit : articles lus, aucun texte pour la généalogie, branchement à faire avec Frédéric', () => {
    expect(texte).toMatch(/L\. 1965 art\. 18, I/)
    expect(texte).toMatch(/D\. 1967 art\. 33/)
    expect(texte).toMatch(/aucun texte/)
    expect(texte).toMatch(/Branchement à faire avec Frédéric/)
    expect(texte).toContain('origineSuite?: OrigineSuitePiece')
  })

  it('droit : les archives passent à l’administrateur provisoire par les textes lus, pas par une question', () => {
    expect(texte).toMatch(/🟢 L\. 1965 art\. 29-1, I, al\. 2 : le président du tribunal confie à l'administrateur provisoire « tous les pouvoirs du syndic »/)
    expect(texte).toMatch(/🟢 D\. 1967 art\. 62-6 : l'ancien syndic est tenu envers l'administrateur provisoire des obligations de L\. 1965 art\. 18-2/)
    expect(texte).toMatch(/🟢 D\. 1967 art\. 47/)
    expect(texte).not.toMatch(/n'a pas été vérifiée/)
  })

  it('choix du parent : aucune priorité Origine / Suite, que les liens d’un même enfant ne peuvent départager', () => {
    expect(texte).not.toMatch(/l'Origine du document l'emporte/)
    expect(item('- le Flux est un arbre')).toMatch(/Le parent le plus proche du dossier l'emporte/)
  })
})
