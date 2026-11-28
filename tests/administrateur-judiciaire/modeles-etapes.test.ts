import { describe, expect, it } from 'vitest'
import { etatEtape } from '@/lib/administrateur-judiciaire/domain/etapes'
import {
  TITRE_COPIE_AU_CS_POUR_INFO,
  USAGES_ETAPES_CABINET_PAR_DEFAUT,
  creerEtapeDossier,
  enchainerEtapeDossier,
  etapesEnFichesLiees,
  realiserEtapeDossier,
  validerEtapeDossier,
} from '@/lib/administrateur-judiciaire/domain/etapes-dossier'
import { creerRattachement, fichesLiees } from '@/lib/administrateur-judiciaire/domain/fiches-liees'
import {
  CLASSES_LISTE_DE_CONTROLE,
  DELAI_ETAPE_MAX_JOURS,
  DOSSIERS_NON_RELEVES,
  DOSSIERS_OUTILLES,
  DOSSIERS_SANS_TYPE_PROPRE,
  ETAPES_PAR_MODELE_MAX,
  ETAPE_TYPE_COPIE_AU_CS_POUR_INFO,
  ID_MODELE_PRISE_DE_FONCTION,
  ID_MODELE_REPRISE,
  OBJETS_LISTE_DE_CONTROLE,
  TYPES_ETAPES_PAR_DOSSIER,
  TYPE_ETAPE_COMMUN,
  ajouterEtapeModele,
  avancementListeControle,
  creerModeleListeControle,
  deplacerEtapeModele,
  fixerDelaiEtapeModele,
  instancierModele,
  limitesDuModele,
  modeleDuDossier,
  modelePriseDeFonction,
  modeleReprise,
  modifierEtapeModele,
  processusDuDossier,
  processusDuModele,
  remplacerEtapeListe,
  renommerEtapeModele,
  renommerModele,
  retirerEtapeModele,
  typesEtapesDuDossier,
  type InstanciationListeControle,
  type ModeleListeControle,
  type SaisieModeleListeControle,
} from '@/lib/administrateur-judiciaire/domain/modeles-etapes'
import { construireChecklistPriseFonction } from '@/lib/administrateur-judiciaire/domain/prise-de-fonction'
import { PIECES_REPRISE, REGLE_MOTEUR_PAR_DELAI_PIECE, piecesRepriseRecues } from '@/lib/administrateur-judiciaire/domain/reprise'
import { DOSSIER, PROCESSUS, type Dossier } from '@/lib/data/referentiels-gesteam-judiciaire'
import { enTeteDuModule } from './en-tete-module'

/**
 * Modèles d'étapes par type de dossier, listes de contrôle (point 49 du bilan 2). Gestéam : tranche 40 (référentiel
 * Classe : 37 « Liste de contrôle - … »), tranche 42, complément du 28/10/2026 (types d'étapes : Contentieux 3, Sinistre
 * 14, « Votes par correspondance » commun), tranche 17 § 6 et § 7, tranche 43 (« Nouveau mandat de syndic » inutilisé).
 * Dépend du point 48 (etapes-dossier.ts, décisions J20 à J24, J41, J44).
 */

const titres = (liste: readonly { titre: string }[]): string[] => liste.map((e) => e.titre)

const saisieModele = (surcharge: Partial<SaisieModeleListeControle> = {}): SaisieModeleListeControle => ({
  id: 'modele-dde',
  titre: 'Dégât des eaux',
  dossier: 'Sinistre',
  etapes: [
    { etapeType: 'sinistre.declaration_sinistre', titre: 'Déclaration sinistre', delaiJours: 2 },
    { etapeType: 'sinistre.expertise', titre: 'Expertise', delaiJours: null },
    { etapeType: 'sinistre.honoraire_sinistre', titre: 'Honoraire sinistre', delaiJours: 30, instructions: '  Ligne d’honoraires  ' },
  ],
  ...surcharge,
})

const modele = (surcharge: Partial<SaisieModeleListeControle> = {}): ModeleListeControle =>
  creerModeleListeControle(saisieModele(surcharge))

const copro = creerRattachement('Copropriété', 'copro-tilleuls')

const instanciation = (surcharge: Partial<InstanciationListeControle> = {}): InstanciationListeControle => ({
  ids: ['e-1', 'e-2', 'e-3'],
  dossierId: 'S-12',
  depart: '2026-11-02',
  creeeParId: 'collab-A',
  demandeurId: 'collab-A',
  demandeurNature: 'collaborateur',
  realisateurId: 'collab-B',
  rattachements: [copro],
  ...surcharge,
})

// ─── Référentiel Gestéam ──────────────────────────────────────────────────────────────────

describe('Référentiel des types d’étapes par dossier (tranche 42, complément du 28/10/2026)', () => {
  it('Contentieux : les 3 types relevés, dans l’ordre affiché, la Copie au CS étant le n° 3', () => {
    expect(titres(TYPES_ETAPES_PAR_DOSSIER.Contentieux)).toEqual([
      'Ouverture de dossier',
      'Lettre de mise en demeure',
      TITRE_COPIE_AU_CS_POUR_INFO,
    ])
    expect(TYPES_ETAPES_PAR_DOSSIER.Contentieux[2].etapeType).toBe(ETAPE_TYPE_COPIE_AU_CS_POUR_INFO)
    expect(TYPES_ETAPES_PAR_DOSSIER.Contentieux.map((e) => e.etapeType)).toEqual([
      'contentieux.ouverture_de_dossier',
      'contentieux.lettre_de_mise_en_demeure',
      'contentieux.copie_au_cs_pour_info',
    ])
  })

  it('Sinistre : les 14 types relevés, dans l’ordre affiché, jusqu’à l’honoraire sinistre', () => {
    expect(titres(TYPES_ETAPES_PAR_DOSSIER.Sinistre)).toEqual([
      'Déclaration sinistre',
      'Information lésé',
      "Demande d'intervention",
      'Demande de devis',
      "Devis à l'assurance",
      'Expertise',
      'Proposition indemnité propriétaire',
      'Lettre de désistement',
      'Proposition indemnité locataire',
      'Accord sur indemnité immédiate',
      'Règlement immédiat au lésé',
      'Facture définitive au courtier',
      'Règlement différé au lésé',
      'Honoraire sinistre',
    ])
    expect(TYPES_ETAPES_PAR_DOSSIER.Sinistre).toHaveLength(14)
    expect(TYPES_ETAPES_PAR_DOSSIER.Sinistre[3].etapeType).toBe('sinistre.demande_de_devis')
    expect(TYPES_ETAPES_PAR_DOSSIER.Sinistre[4].etapeType).toBe('sinistre.devis_a_l_assurance')
    expect(TYPES_ETAPES_PAR_DOSSIER.Sinistre[1].etapeType).toBe('sinistre.information_lese')
  })

  it('« Votes par correspondance » : type commun, hors des suites', () => {
    expect(TYPE_ETAPE_COMMUN).toEqual({ etapeType: 'commun.votes_par_correspondance', titre: 'Votes par correspondance', delaiJours: null })
    for (const dossier of DOSSIERS_OUTILLES) expect(titres(TYPES_ETAPES_PAR_DOSSIER[dossier])).not.toContain('Votes par correspondance')
  })

  it('J76 : aucun délai par défaut (null partout) ; codes uniques', () => {
    const tous = [...TYPES_ETAPES_PAR_DOSSIER.Contentieux, ...TYPES_ETAPES_PAR_DOSSIER.Sinistre, TYPE_ETAPE_COMMUN]
    expect(tous.every((e) => e.delaiJours === null)).toBe(true)
    expect(new Set(tous.map((e) => e.etapeType)).size).toBe(tous.length)
  })

  it('les dossiers outillés, sans type propre et non relevés partagent le référentiel DOSSIER sans recouvrement', () => {
    const reunis = [...DOSSIERS_OUTILLES, ...DOSSIERS_SANS_TYPE_PROPRE, ...DOSSIERS_NON_RELEVES]
    expect(new Set(reunis).size).toBe(reunis.length)
    expect([...reunis].sort((a, b) => a.localeCompare(b))).toEqual([...DOSSIER].sort((a, b) => a.localeCompare(b)))
    expect(DOSSIERS_SANS_TYPE_PROPRE).toEqual([
      'Gestion',
      'Contrat',
      'Travaux',
      'Equipement',
      'Mutation',
      'Assemblée',
      'Exercice comptable',
      'Mandat de syndic',
    ])
  })

  it('typesEtapesDuDossier : types propres puis type commun ; type commun seul sans type propre ; null si non relevé', () => {
    expect(titres(typesEtapesDuDossier('Contentieux') ?? [])).toEqual([
      'Ouverture de dossier',
      'Lettre de mise en demeure',
      'Copie au CS pour info',
      'Votes par correspondance',
    ])
    expect(typesEtapesDuDossier('Sinistre')).toHaveLength(15)
    expect(typesEtapesDuDossier('Sinistre')?.at(-1)).toEqual(TYPE_ETAPE_COMMUN)
    for (const dossier of DOSSIERS_SANS_TYPE_PROPRE) expect(typesEtapesDuDossier(dossier)).toEqual([TYPE_ETAPE_COMMUN])
    for (const dossier of DOSSIERS_NON_RELEVES) expect(typesEtapesDuDossier(dossier)).toBeNull()
    expect(() => typesEtapesDuDossier('Copropriété' as Dossier)).toThrow(/Type de dossier inconnu : « Copropriété »/)
  })

  it('les listes rendues sont des copies : les modifier ne touche pas le référentiel', () => {
    const types = typesEtapesDuDossier('Contentieux') ?? []
    types[0].titre = 'Modifié'
    types.pop()
    const processus = processusDuDossier('Sinistre')
    processus[0].delaiJours = 99
    expect(TYPES_ETAPES_PAR_DOSSIER.Contentieux[0].titre).toBe('Ouverture de dossier')
    expect(TYPES_ETAPES_PAR_DOSSIER.Sinistre[0].delaiJours).toBeNull()
    expect(typesEtapesDuDossier('Contentieux')).toHaveLength(4)
    expect(Object.isFrozen(TYPES_ETAPES_PAR_DOSSIER.Sinistre)).toBe(true)
    expect(Object.isFrozen(TYPES_ETAPES_PAR_DOSSIER.Sinistre[0])).toBe(true)
    expect(Object.isFrozen(TYPE_ETAPE_COMMUN)).toBe(true)
  })

  const ouvertureContentieux = (etapeType: string) =>
    creerEtapeDossier({
      id: 'c-1',
      titre: 'Ouverture de dossier',
      etapeType,
      creeeLe: '2026-11-02',
      origine: 'manuelle',
      creeeParId: 'collab-A',
      demandeurId: 'collab-A',
      demandeurNature: 'collaborateur',
      rattachements: [creerRattachement('Contentieux', 'C-3')],
    })

  it('usage « Copie au CS » activé : processusDuDossier se passe à enchainerEtapeDossier, Ouverture → Mise en demeure → Copie au CS, puis fin', () => {
    const processus = processusDuDossier('Contentieux', { copieAuCsPourInfo: true })
    const faite = realiserEtapeDossier(ouvertureContentieux(processus[0].etapeType), { date: '2026-11-03', compteRendu: '' }).etape
    const med = enchainerEtapeDossier(faite, processus, { id: 'c-2', date: '2026-11-03', creeeParId: 'collab-A' })
    expect(med?.titre).toBe('Lettre de mise en demeure')
    // J76 : aucun délai par défaut ; sans délai saisi par le cabinet, l'étape enchaînée n'a pas de limite.
    expect(med?.limite).toBeNull()
    const medFaite = realiserEtapeDossier(med!, { date: '2026-11-05', compteRendu: '' }).etape
    const copie = enchainerEtapeDossier(medFaite, processus, { id: 'c-3', date: '2026-11-05', creeeParId: 'collab-A' })
    expect(copie?.etapeType).toBe(ETAPE_TYPE_COPIE_AU_CS_POUR_INFO)
    expect(copie?.origine).toBe('manuelle')
    const copieFaite = realiserEtapeDossier(copie!, { date: '2026-11-05', compteRendu: '' }).etape
    expect(enchainerEtapeDossier(copieFaite, processus, { id: 'c-4', date: '2026-11-05', creeeParId: 'collab-A' })).toBeNull()
  })

  it('J41 : usage inactif par défaut, le processus du contentieux s’arrête à la mise en demeure (aucune Copie au CS créée)', () => {
    const processus = processusDuDossier('Contentieux')
    expect(processus.map((e) => e.etapeType)).toEqual(['contentieux.ouverture_de_dossier', 'contentieux.lettre_de_mise_en_demeure'])
    expect(processusDuDossier('Contentieux', USAGES_ETAPES_CABINET_PAR_DEFAUT)).toEqual(processus)
    const faite = realiserEtapeDossier(ouvertureContentieux(processus[0].etapeType), { date: '2026-11-03', compteRendu: '' }).etape
    const med = enchainerEtapeDossier(faite, processus, { id: 'c-2', date: '2026-11-03', creeeParId: 'collab-A' })
    const medFaite = realiserEtapeDossier(med!, { date: '2026-11-05', compteRendu: '' }).etape
    expect(enchainerEtapeDossier(medFaite, processus, { id: 'c-3', date: '2026-11-05', creeeParId: 'collab-A' })).toBeNull()
    // Le référentiel (traçabilité) et le sélecteur « Étape type » gardent les 3 types observés ; le sinistre n'est pas concerné.
    expect(TYPES_ETAPES_PAR_DOSSIER.Contentieux).toHaveLength(3)
    expect(typesEtapesDuDossier('Contentieux')?.map((e) => e.etapeType)).toContain(ETAPE_TYPE_COPIE_AU_CS_POUR_INFO)
    expect(processusDuDossier('Sinistre')).toHaveLength(14)
  })

  it('J76 : sans délai saisi, l’étape enchaînée depuis le référentiel n’a pas de limite et n’est jamais en retard', () => {
    const processus = processusDuDossier('Sinistre')
    const declaration = creerEtapeDossier({
      id: 's-1',
      titre: 'Déclaration sinistre',
      etapeType: processus[0].etapeType,
      creeeLe: '2026-11-02',
      origine: 'manuelle',
      creeeParId: 'collab-A',
      demandeurId: 'collab-A',
      demandeurNature: 'collaborateur',
    })
    const faite = realiserEtapeDossier(declaration, { date: '2026-11-03', compteRendu: '' }).etape
    const information = enchainerEtapeDossier(faite, processus, { id: 's-2', date: '2026-11-03', creeeParId: 'collab-A' })!
    expect(information.limite).toBeNull()
    expect(etatEtape(information, '2026-11-03').enRetard).toBe(false)
    expect(etatEtape(information, '2026-11-04').enRetard).toBe(false)
  })
})

describe('Classes « Liste de contrôle - … » (tranche 40, référentiel Classe)', () => {
  it('37 listes, dans l’ordre relevé, de « Mandat » à « Liste isolée »', () => {
    expect(OBJETS_LISTE_DE_CONTROLE).toHaveLength(37)
    expect(CLASSES_LISTE_DE_CONTROLE).toHaveLength(37)
    expect(new Set(CLASSES_LISTE_DE_CONTROLE).size).toBe(37)
    expect(CLASSES_LISTE_DE_CONTROLE[0]).toBe('Liste de contrôle - Mandat')
    expect(CLASSES_LISTE_DE_CONTROLE.at(-1)).toBe('Liste de contrôle - Liste isolée')
    expect(CLASSES_LISTE_DE_CONTROLE.every((c, i) => c === `Liste de contrôle - ${OBJETS_LISTE_DE_CONTROLE[i]}`)).toBe(true)
    expect(OBJETS_LISTE_DE_CONTROLE).toEqual(
      expect.arrayContaining(['Sinistre', 'Contentieux', 'Assemblée', 'Honoraires facture', "Ticket d'appel", 'Mouvement']),
    )
  })

  it('les deux familles « Liste de contrôle » de PROCESSUS en font partie (référentiel réutilisé, pas dupliqué)', () => {
    const familles = Object.keys(PROCESSUS).filter((f) => f.startsWith('Liste de contrôle'))
    expect(familles).toEqual(['Liste de contrôle - Bail', 'Liste de contrôle - Mandat'])
    for (const famille of familles) expect(CLASSES_LISTE_DE_CONTROLE).toContain(famille)
  })
})

// ─── Modèle paramétrable ──────────────────────────────────────────────────────────────────

describe('Modèle de liste de contrôle : création et contrôles', () => {
  it('nominal : textes nettoyés, délai absent = non saisi (null), instructions vides par défaut, classe facultative', () => {
    const m = creerModeleListeControle({
      ...saisieModele(),
      id: '  modele-dde ',
      titre: ' Dégât des eaux ',
      etapes: [
        { etapeType: ' sinistre.declaration_sinistre ', titre: ' Déclaration sinistre ' },
        { etapeType: 'sinistre.expertise', titre: 'Expertise', delaiJours: 0, instructions: '  Joindre le constat ' },
      ],
    })
    expect(m).toEqual({
      id: 'modele-dde',
      titre: 'Dégât des eaux',
      dossier: 'Sinistre',
      classe: null,
      etapes: [
        { etapeType: 'sinistre.declaration_sinistre', titre: 'Déclaration sinistre', delaiJours: null, instructions: '' },
        { etapeType: 'sinistre.expertise', titre: 'Expertise', delaiJours: 0, instructions: 'Joindre le constat' },
      ],
    })
  })

  it('la classe Gestéam se contrôle sur le référentiel Classe', () => {
    expect(modele({ classe: 'Liste de contrôle - Sinistre' }).classe).toBe('Liste de contrôle - Sinistre')
    expect(() => modele({ classe: 'Liste de contrôle - Inconnue' as never })).toThrow(/Classe de liste de contrôle inconnue/)
  })

  it('la saisie reçue n’est pas modifiée', () => {
    const saisie = saisieModele()
    const copie = structuredClone(saisie)
    creerModeleListeControle(saisie)
    expect(saisie).toEqual(copie)
  })

  it.each<[string, Partial<SaisieModeleListeControle>, RegExp]>([
    ['identifiant vide', { id: '  ' }, /identifiant du modèle attendu/],
    ['titre vide', { titre: '' }, /titre du modèle attendu/],
    ['fiche porteuse au lieu d’un dossier', { dossier: 'Copropriété' as Dossier }, /Type de dossier inconnu : « Copropriété »/],
    ['liste vide', { etapes: [] }, /au moins une étape attendue/],
    ['type d’étape vide', { etapes: [{ etapeType: ' ', titre: 'Expertise' }] }, /étape 1 : type d’étape attendu/],
    ['titre d’étape vide', { etapes: [{ etapeType: 'x', titre: '' }] }, /étape 1 : titre attendu/],
    [
      'type d’étape en double',
      { etapes: [{ etapeType: 'x', titre: 'A' }, { etapeType: ' x ', titre: 'B' }] },
      /type d’étape « x » en double/,
    ],
    [
      'type d’étape en double (casse ignorée)',
      { etapes: [{ etapeType: 'Sinistre.Expertise', titre: 'A' }, { etapeType: 'sinistre.expertise', titre: 'B' }] },
      /type d’étape « sinistre\.expertise » en double/,
    ],
    [
      'titre en double (casse et espaces ignorés)',
      { etapes: [{ etapeType: 'a', titre: 'Expertise  contradictoire' }, { etapeType: 'b', titre: 'expertise contradictoire' }] },
      /titre « expertise contradictoire » en double/,
    ],
    ['délai négatif', { etapes: [{ etapeType: 'a', titre: 'A', delaiJours: -1 }] }, /délai de gestion invalide \(-1\)/],
    ['délai non entier', { etapes: [{ etapeType: 'a', titre: 'A', delaiJours: 1.5 }] }, /délai de gestion invalide \(1\.5\)/],
    ['délai NaN', { etapes: [{ etapeType: 'a', titre: 'A', delaiJours: Number.NaN }] }, /délai de gestion invalide \(NaN\)/],
    [
      'délai au-delà du plafond',
      { etapes: [{ etapeType: 'a', titre: 'A', delaiJours: DELAI_ETAPE_MAX_JOURS + 1 }] },
      /nombre entier de jours entre 0 et 3650 attendu/,
    ],
  ])('refus : %s', (_cas, surcharge, message) => {
    expect(() => modele(surcharge)).toThrow(message)
  })

  it('bornes admises : délai 0 et délai plafond ; au plus ETAPES_PAR_MODELE_MAX étapes', () => {
    const m = modele({
      etapes: [
        { etapeType: 'a', titre: 'A', delaiJours: 0 },
        { etapeType: 'b', titre: 'B', delaiJours: DELAI_ETAPE_MAX_JOURS },
      ],
    })
    expect(m.etapes.map((e) => e.delaiJours)).toEqual([0, 3650])
    const etapes = (n: number) => Array.from({ length: n }, (_, i) => ({ etapeType: `t${i}`, titre: `Étape ${i}` }))
    expect(modele({ etapes: etapes(ETAPES_PAR_MODELE_MAX) }).etapes).toHaveLength(ETAPES_PAR_MODELE_MAX)
    expect(() => modele({ etapes: etapes(ETAPES_PAR_MODELE_MAX + 1) })).toThrow(/101 étapes, au plus 100 attendues/)
  })
})

describe('Modèle de liste de contrôle : paramétrage par le cabinet', () => {
  it('ajout en fin (par défaut), en tête, juste avant la fin ; le modèle d’origine reste inchangé', () => {
    const m = modele()
    const fin = ajouterEtapeModele(m, { etapeType: 'sinistre.lettre_de_desistement', titre: 'Lettre de désistement', delaiJours: 5 })
    expect(titres(fin.etapes)).toEqual(['Déclaration sinistre', 'Expertise', 'Honoraire sinistre', 'Lettre de désistement'])
    expect(fin.etapes[3]).toEqual({ etapeType: 'sinistre.lettre_de_desistement', titre: 'Lettre de désistement', delaiJours: 5, instructions: '' })
    expect(titres(ajouterEtapeModele(m, { etapeType: 'z', titre: 'Z' }, 1).etapes)[0]).toBe('Z')
    expect(titres(ajouterEtapeModele(m, { etapeType: 'z', titre: 'Z' }, 3).etapes)).toEqual([
      'Déclaration sinistre',
      'Expertise',
      'Z',
      'Honoraire sinistre',
    ])
    expect(titres(m.etapes)).toEqual(['Déclaration sinistre', 'Expertise', 'Honoraire sinistre'])
  })

  it('ajout refusé : rang hors de 1 à n + 1 ou non entier, doublon, délai invalide', () => {
    const m = modele()
    for (const rang of [0, 5, 1.5]) expect(() => ajouterEtapeModele(m, { etapeType: 'z', titre: 'Z' }, rang)).toThrow(/rang invalide/)
    expect(() => ajouterEtapeModele(m, { etapeType: 'sinistre.expertise', titre: 'Autre' })).toThrow(/en double/)
    expect(() => ajouterEtapeModele(m, { etapeType: 'z', titre: 'Expertise' })).toThrow(/titre « Expertise » en double/)
    expect(() => ajouterEtapeModele(m, { etapeType: 'z', titre: 'Z', delaiJours: -3 })).toThrow(/délai de gestion invalide/)
  })

  it('retrait d’une étape ; refus pour un type absent et pour la dernière étape', () => {
    const m = modele()
    expect(titres(retirerEtapeModele(m, 'sinistre.expertise').etapes)).toEqual(['Déclaration sinistre', 'Honoraire sinistre'])
    expect(() => retirerEtapeModele(m, 'inconnu')).toThrow(/aucune étape de type « inconnu »/)
    const seule = modele({ etapes: [{ etapeType: 'a', titre: 'A' }] })
    expect(() => retirerEtapeModele(seule, 'a')).toThrow(/doit garder au moins une étape/)
  })

  it('renommage d’une étape (le type, clé stable, ne change pas) ; refus : vide, doublon, type absent', () => {
    const m = renommerEtapeModele(modele(), 'sinistre.expertise', '  Expertise amiable ')
    expect(m.etapes[1]).toMatchObject({ etapeType: 'sinistre.expertise', titre: 'Expertise amiable' })
    expect(() => renommerEtapeModele(m, 'sinistre.expertise', ' ')).toThrow(/titre attendu/)
    expect(() => renommerEtapeModele(m, 'sinistre.expertise', 'déclaration SINISTRE')).toThrow(/en double/)
    expect(() => renommerEtapeModele(m, 'inconnu', 'X')).toThrow(/aucune étape de type « inconnu »/)
  })

  it('délai de gestion fixé ou effacé (null) ; refus d’un délai invalide', () => {
    const m = fixerDelaiEtapeModele(modele(), 'sinistre.expertise', 10)
    expect(m.etapes[1].delaiJours).toBe(10)
    expect(fixerDelaiEtapeModele(m, 'sinistre.expertise', null).etapes[1].delaiJours).toBeNull()
    expect(() => fixerDelaiEtapeModele(m, 'sinistre.expertise', -1)).toThrow(/délai de gestion invalide/)
    expect(() => fixerDelaiEtapeModele(m, 'sinistre.expertise', 3651)).toThrow(/délai de gestion invalide/)
  })

  it('modification groupée (titre, délai, instructions) ; champ absent inchangé', () => {
    const m = modifierEtapeModele(modele(), 'sinistre.honoraire_sinistre', { instructions: ' Forfait du contrat ' })
    expect(m.etapes[2]).toEqual({
      etapeType: 'sinistre.honoraire_sinistre',
      titre: 'Honoraire sinistre',
      delaiJours: 30,
      instructions: 'Forfait du contrat',
    })
    const n = modifierEtapeModele(m, 'sinistre.honoraire_sinistre', { titre: 'Honoraires', delaiJours: null })
    expect(n.etapes[2]).toEqual({ etapeType: 'sinistre.honoraire_sinistre', titre: 'Honoraires', delaiJours: null, instructions: 'Forfait du contrat' })
  })

  it('ordre : déplacement en tête et en fin ; refus d’un rang invalide', () => {
    const m = modele()
    expect(titres(deplacerEtapeModele(m, 'sinistre.honoraire_sinistre', 1).etapes)).toEqual([
      'Honoraire sinistre',
      'Déclaration sinistre',
      'Expertise',
    ])
    expect(titres(deplacerEtapeModele(m, 'sinistre.declaration_sinistre', 3).etapes)).toEqual([
      'Expertise',
      'Honoraire sinistre',
      'Déclaration sinistre',
    ])
    for (const rang of [0, 4, 2.5]) expect(() => deplacerEtapeModele(m, 'sinistre.expertise', rang)).toThrow(/rang invalide/)
    expect(() => deplacerEtapeModele(m, 'inconnu', 1)).toThrow(/aucune étape de type « inconnu »/)
  })

  it('renommage du modèle ; refus d’un titre vide', () => {
    expect(renommerModele(modele(), ' Dégâts des eaux ').titre).toBe('Dégâts des eaux')
    expect(() => renommerModele(modele(), '  ')).toThrow(/titre du modèle attendu/)
  })
})

describe('Délais de gestion : limites prévues et conversion en EtapeTypeProcessus[]', () => {
  it('limites : départ + délais cumulés ; une étape sans délai n’a pas de limite et n’ajoute rien au cumul', () => {
    expect(limitesDuModele(modele(), '2026-11-02')).toEqual(['2026-11-04', null, '2026-12-04'])
  })

  it('limites : fin de mois, 29 février d’une année bissextile, passage d’année (calendrier de dates.ts)', () => {
    const m = modele({
      etapes: [
        { etapeType: 'a', titre: 'A', delaiJours: 1 },
        { etapeType: 'b', titre: 'B', delaiJours: 1 },
        { etapeType: 'c', titre: 'C', delaiJours: 307 },
      ],
    })
    expect(limitesDuModele(m, '2028-02-27')).toEqual(['2028-02-28', '2028-02-29', '2029-01-01'])
    // Année non bissextile : même cumul, un jour plus loin.
    expect(limitesDuModele(m, '2027-02-27')).toEqual(['2027-02-28', '2027-03-01', '2028-01-02'])
  })

  it('refus : départ invalide, limite hors calendrier', () => {
    expect(() => limitesDuModele(modele(), '2026-02-30')).toThrow(/Date de départ invalide \(2026-02-30\)/)
    const long = modele({ etapes: [{ etapeType: 'a', titre: 'A', delaiJours: DELAI_ETAPE_MAX_JOURS }] })
    expect(() => limitesDuModele(long, '9999-12-01')).toThrow(/hors calendrier/)
  })

  it('processusDuModele : délais du cabinet repris, utilisable par l’enchaînement (limite = réalisation + délai)', () => {
    const m = fixerDelaiEtapeModele(modele(), 'sinistre.expertise', 7)
    const processus = processusDuModele(m)
    expect(processus).toEqual([
      { etapeType: 'sinistre.declaration_sinistre', titre: 'Déclaration sinistre', delaiJours: 2 },
      { etapeType: 'sinistre.expertise', titre: 'Expertise', delaiJours: 7 },
      { etapeType: 'sinistre.honoraire_sinistre', titre: 'Honoraire sinistre', delaiJours: 30 },
    ])
    const liste = instancierModele(m, instanciation())
    const declaration = realiserEtapeDossier(liste.etapes[0], { date: '2026-11-03', compteRendu: '' }).etape
    const suivante = enchainerEtapeDossier(declaration, processus, { id: 'e-9', date: '2026-11-03', creeeParId: 'collab-A' })
    expect(suivante).toMatchObject({ titre: 'Expertise', limite: '2026-11-10', creeeParId: 'collab-A', origine: 'manuelle' })
  })

  it('J76 : processusDuModele garde « non saisi » (null), première étape comprise ; enchaînée, l’étape n’a pas de limite', () => {
    const premiere = fixerDelaiEtapeModele(fixerDelaiEtapeModele(modele(), 'sinistre.expertise', 7), 'sinistre.declaration_sinistre', null)
    expect(processusDuModele(premiere)[0].delaiJours).toBeNull()
    const processus = processusDuModele(modele())
    expect(processus.map((p) => p.delaiJours)).toEqual([2, null, 30])
    const liste = instancierModele(modele(), instanciation())
    const declaration = realiserEtapeDossier(liste.etapes[0], { date: '2026-11-03', compteRendu: '' }).etape
    const expertise = enchainerEtapeDossier(declaration, processus, { id: 'e-9', date: '2026-11-03', creeeParId: 'collab-A' })
    expect(expertise).toMatchObject({ titre: 'Expertise', limite: null })
  })

  it('modeleDuDossier : le processus Gestéam en modèle paramétrable, délais à saisir par le cabinet', () => {
    const m = modeleDuDossier('Contentieux', { id: 'modele-ctx', titre: 'Recouvrement' }, { copieAuCsPourInfo: true })
    expect(m).toEqual({
      id: 'modele-ctx',
      titre: 'Recouvrement',
      dossier: 'Contentieux',
      classe: null,
      etapes: TYPES_ETAPES_PAR_DOSSIER.Contentieux.map((e) => ({ etapeType: e.etapeType, titre: e.titre, delaiJours: null, instructions: '' })),
    })
    expect(modeleDuDossier('Sinistre', { id: 'modele-sin', titre: 'Sinistre' }).etapes).toHaveLength(14)
  })

  it('J41 : modeleDuDossier sans réglage du cabinet ne porte pas la Copie au CS, et son instanciation ne la crée pas', () => {
    const m = modeleDuDossier('Contentieux', { id: 'modele-ctx', titre: 'Recouvrement' })
    expect(titres(m.etapes)).toEqual(['Ouverture de dossier', 'Lettre de mise en demeure'])
    const liste = instancierModele(m, instanciation({ ids: ['c-1', 'c-2'], dossierId: 'C-3', rattachements: [] }))
    expect(liste.etapes.map((e) => e.etapeType)).not.toContain(ETAPE_TYPE_COPIE_AU_CS_POUR_INFO)
  })
})

// ─── Instanciation ────────────────────────────────────────────────────────────────────────

describe('Instanciation d’un modèle en étapes rattachées au dossier', () => {
  it('nominal : une étape par étape du modèle, dans l’ordre, rattachée au dossier, créée par le collaborateur (J20)', () => {
    const liste = instancierModele(modele(), instanciation())
    expect(liste).toMatchObject({ modeleId: 'modele-dde', titre: 'Dégât des eaux', depart: '2026-11-02' })
    expect(liste.dossier).toEqual({ type: 'Sinistre', id: 'S-12' })
    expect(liste.etapes.map((e) => e.id)).toEqual(['e-1', 'e-2', 'e-3'])
    expect(liste.etapes.map((e) => e.etapeType)).toEqual(['sinistre.declaration_sinistre', 'sinistre.expertise', 'sinistre.honoraire_sinistre'])
    expect(titres(liste.etapes)).toEqual(['Déclaration sinistre', 'Expertise', 'Honoraire sinistre'])
    expect(liste.etapes.map((e) => e.limite)).toEqual(['2026-11-04', null, '2026-12-04'])
    for (const etape of liste.etapes) {
      expect(etape).toMatchObject({
        creeeLe: '2026-11-02',
        origine: 'manuelle',
        creeeParId: 'collab-A',
        demandeurId: 'collab-A',
        demandeurNature: 'collaborateur',
        realisateurId: 'collab-B',
        validateurId: null,
        faitLe: null,
      })
      expect(etape.rattachements).toEqual([{ type: 'Sinistre', id: 'S-12' }, copro])
      expect(etatEtape(etape, '2026-11-02').statut).toBe('a_faire')
    }
    expect(liste.etapes[2].instructions).toBe('Ligne d’honoraires')
  })

  it('le rattachement du dossier n’est pas doublé s’il est aussi fourni', () => {
    const liste = instancierModele(modele(), instanciation({ rattachements: [creerRattachement('Sinistre', 'S-12'), copro] }))
    expect(liste.etapes[0].rattachements).toEqual([{ type: 'Sinistre', id: 'S-12' }, copro])
  })

  it('l’onglet Étapes du dossier retrouve toute la liste (fiches liées, point 47)', () => {
    const liste = instancierModele(modele(), instanciation())
    const page = fichesLiees(etapesEnFichesLiees(liste.etapes, '2026-11-02'), liste.dossier)
    expect(page.total).toBe(3)
  })

  it('J20 : refus sans collaborateur qui instancie (« Créée par » jamais « Automatique » pour ce geste)', () => {
    expect(() => instancierModele(modele(), instanciation({ creeeParId: '  ' }))).toThrow(/collaborateur qui instancie la liste attendu.*J20/)
  })

  it.each<[string, Partial<InstanciationListeControle>, RegExp]>([
    ['moins d’identifiants que d’étapes', { ids: ['e-1', 'e-2'] }, /3 identifiants d’étape attendus \(un par étape du modèle\), 2 reçus/],
    ['identifiant en double', { ids: ['e-1', 'e-2', ' e-1 '] }, /identifiant d’étape « e-1 » en double/],
    ['identifiant vide', { ids: ['e-1', '', 'e-3'] }, /Identifiant d’étape attendu/],
    ['dossier sans identifiant', { dossierId: ' ' }, /Rattachement « Sinistre » : identifiant attendu/],
    ['départ invalide', { depart: '02/11/2026' }, /Date de départ invalide/],
    ['demandeur vide', { demandeurId: '' }, /Demandeur de l’étape attendu/],
  ])('refus : %s', (_cas, surcharge, message) => {
    expect(() => instancierModele(modele(), instanciation(surcharge))).toThrow(message)
  })

  it('un modèle altéré (relu d’un stockage) est recontrôlé avant l’instanciation', () => {
    const altere: ModeleListeControle = { ...modele(), etapes: [{ etapeType: 'a', titre: 'A', delaiJours: -2, instructions: '' }] }
    expect(() => instancierModele(altere, instanciation({ ids: ['e-1'] }))).toThrow(/délai de gestion invalide \(-2\)/)
  })

  it('la liste instanciée ne suit pas les modifications ultérieures du modèle', () => {
    const m = modele()
    const liste = instancierModele(m, instanciation())
    renommerEtapeModele(m, 'sinistre.expertise', 'Expertise amiable')
    retirerEtapeModele(m, 'sinistre.honoraire_sinistre')
    expect(titres(liste.etapes)).toEqual(['Déclaration sinistre', 'Expertise', 'Honoraire sinistre'])
  })
})

// ─── Avancement ───────────────────────────────────────────────────────────────────────────

describe('Avancement d’une liste instanciée', () => {
  it('liste neuve : rien de réalisé, prochaine = la première, retards au jour donné', () => {
    const liste = instancierModele(modele(), instanciation())
    expect(avancementListeControle(liste, '2026-11-03')).toEqual({
      total: 3,
      realisees: 0,
      aValider: 0,
      terminees: 0,
      enRetard: 0,
      pourcentage: 0,
      terminee: false,
      prochaine: { rang: 1, id: 'e-1', titre: 'Déclaration sinistre', etapeType: 'sinistre.declaration_sinistre', limite: '2026-11-04', enRetard: false },
    })
    const tard = avancementListeControle(liste, '2026-12-05')
    expect(tard.enRetard).toBe(2)
    expect(tard.prochaine?.enRetard).toBe(true)
  })

  it('après réalisation de la première : 1 sur 3 (33 %, arrondi inférieur), prochaine = la deuxième', () => {
    const liste = instancierModele(modele(), instanciation())
    const faite = realiserEtapeDossier(liste.etapes[0], { date: '2026-11-03', compteRendu: 'Déclarée au courtier' }).etape
    const suite = remplacerEtapeListe(liste, faite)
    const avancement = avancementListeControle(suite, '2026-11-03')
    expect(avancement).toMatchObject({ realisees: 1, terminees: 1, pourcentage: 33, terminee: false })
    expect(avancement.prochaine).toMatchObject({ rang: 2, id: 'e-2', titre: 'Expertise', limite: null, enRetard: false })
    // La liste reçue n'est pas modifiée.
    expect(liste.etapes[0].faitLe).toBeNull()
  })

  it('réalisation dans le désordre : la prochaine est la première encore à faire dans l’ordre du modèle', () => {
    let liste = instancierModele(modele(), instanciation())
    liste = remplacerEtapeListe(liste, realiserEtapeDossier(liste.etapes[1], { date: '2026-11-04', compteRendu: '' }).etape)
    liste = remplacerEtapeListe(liste, realiserEtapeDossier(liste.etapes[2], { date: '2026-11-04', compteRendu: '' }).etape)
    const avancement = avancementListeControle(liste, '2026-11-04')
    expect(avancement).toMatchObject({ realisees: 2, pourcentage: 66 })
    expect(avancement.prochaine?.id).toBe('e-1')
  })

  it('validation prévue : réalisée mais à valider n’est pas terminée ; validée, la liste est terminée (100 %, plus de prochaine)', () => {
    const m = modele({ etapes: [{ etapeType: 'a', titre: 'A' }, { etapeType: 'b', titre: 'B' }] })
    let liste = instancierModele(m, instanciation({ ids: ['e-1', 'e-2'], validateurId: 'collab-C' }))
    for (const etape of liste.etapes) liste = remplacerEtapeListe(liste, realiserEtapeDossier(etape, { date: '2026-11-05', compteRendu: '' }).etape)
    const aValider = avancementListeControle(liste, '2026-11-05')
    expect(aValider).toMatchObject({ realisees: 2, aValider: 2, terminees: 0, pourcentage: 100, terminee: false, prochaine: null })
    for (const etape of liste.etapes) liste = remplacerEtapeListe(liste, validerEtapeDossier(etape, { date: '2026-11-06' }))
    expect(avancementListeControle(liste, '2026-11-06')).toMatchObject({ realisees: 2, aValider: 0, terminees: 2, terminee: true, prochaine: null })
  })

  it('refus : étape absente de la liste, date du jour invalide', () => {
    const liste = instancierModele(modele(), instanciation())
    const etrangere = creerEtapeDossier({
      id: 'autre',
      titre: 'Autre',
      creeeLe: '2026-11-02',
      origine: 'manuelle',
      creeeParId: 'collab-A',
      demandeurId: 'collab-A',
      demandeurNature: 'collaborateur',
    })
    expect(() => remplacerEtapeListe(liste, etrangere)).toThrow(/Étape « autre » absente de la liste « Dégât des eaux »/)
    expect(() => avancementListeControle(liste, '2026-13-01')).toThrow(/Date du jour invalide/)
  })
})

// ─── Prise de fonction, premier modèle ────────────────────────────────────────────────────

describe('Prise de fonction : premier modèle, tiré des 8 diligences de prise-de-fonction.ts', () => {
  const coproVM = { code: 'VM', fondement: 'L. 1965 art. 46', impayes: 1200 }

  it('8 étapes, dans l’ordre et sous les libellés des diligences, fondement recopié en instructions', () => {
    const diligences = construireChecklistPriseFonction({ code: 'X', impayes: 0 })
    const m = modelePriseDeFonction()
    expect(m).toMatchObject({
      id: ID_MODELE_PRISE_DE_FONCTION,
      titre: 'Prise de fonction',
      dossier: 'Mandat de syndic',
      classe: 'Liste de contrôle - Mandat',
    })
    expect(m.etapes).toHaveLength(8)
    expect(titres(m.etapes)).toEqual(diligences.map((d) => d.label))
    expect(m.etapes.map((e) => e.instructions)).toEqual(diligences.map((d) => d.art))
    expect(m.etapes.map((e) => e.etapeType)).toEqual(diligences.map((d) => `prise-de-fonction.${d.id}`))
  })

  it('aucun délai de gestion : les délais légaux cités ne deviennent jamais des limites', () => {
    const m = modelePriseDeFonction()
    expect(m.etapes.every((e) => e.delaiJours === null)).toBe(true)
    const liste = instancierModele(m, { ...instanciation(), ids: m.etapes.map((_, i) => `pf-${i + 1}`), dossierId: 'mandat-1' })
    expect(liste.dossier).toEqual({ type: 'Mandat de syndic', id: 'mandat-1' })
    expect(liste.etapes.every((e) => e.limite === null && e.faitLe === null)).toBe(true)
    expect(avancementListeControle(liste, '2026-11-02')).toMatchObject({ total: 8, realisees: 0, enRetard: 0 })
  })

  it('régime de l’art. 29-1 : mêmes 8 étapes, fondements du régime (62-5 ; art. 18)', () => {
    const m = modelePriseDeFonction({ fondement: 'L. 1965 art. 29-1' })
    expect(m.etapes[0].instructions).toContain('62-5')
    expect(m.etapes[2].instructions).toBe('art. 18 L. 1965')
    expect(titres(m.etapes)).toEqual(titres(modelePriseDeFonction().etapes))
  })

  it('le cabinet le paramètre comme tout modèle (délai, ajout), sans toucher la check-list d’origine', () => {
    const m = ajouterEtapeModele(fixerDelaiEtapeModele(modelePriseDeFonction(), 'prise-de-fonction.1', 7), {
      etapeType: 'cabinet.visite',
      titre: "Visite d'immeuble",
    })
    expect(m.etapes).toHaveLength(9)
    expect(limitesDuModele(m, '2026-11-02')[0]).toBe('2026-11-09')
    expect(modelePriseDeFonction().etapes[0].delaiJours).toBeNull()
  })

  it('non-régression : construireChecklistPriseFonction rend toujours ses 8 diligences, statuts compris', () => {
    const avant = construireChecklistPriseFonction(coproVM)
    modelePriseDeFonction({ fondement: coproVM.fondement })
    const apres = construireChecklistPriseFonction(coproVM)
    expect(apres).toEqual(avant)
    expect(apres.map((d) => d.id)).toEqual([1, 2, 3, 4, 5, 6, 7, 8])
    expect(apres.map((d) => d.statut)).toEqual(['En cours', 'En cours', 'À faire', 'En cours', 'En cours', 'À faire', 'À faire', 'En cours'])
  })
})

// ─── Reprise, second modèle ───────────────────────────────────────────────────────────────

describe('Reprise des pièces auprès de l’ancien syndic : second modèle (liste de contrôle « Mandat »)', () => {
  it('12 étapes, une par pièce de PIECES_REPRISE, dans l’ordre ; base et délai cités recopiés en instructions', () => {
    const m = modeleReprise()
    expect(m).toMatchObject({
      id: ID_MODELE_REPRISE,
      titre: "Reprise des pièces auprès de l'ancien syndic",
      dossier: 'Mandat de syndic',
      classe: 'Liste de contrôle - Mandat',
    })
    expect(m.etapes).toHaveLength(PIECES_REPRISE.length)
    expect(m.etapes.map((e) => e.etapeType)).toEqual(PIECES_REPRISE.map((p) => `reprise.${p.cle}`))
    expect(titres(m.etapes)).toEqual(PIECES_REPRISE.map((p) => p.libelle))
    expect(m.etapes[0].instructions).toBe('Base : L. 1965 art. 18-2 · délai légal cité : 15 jours')
    expect(m.etapes.every((e) => e.delaiJours === null)).toBe(true)
  })

  it('instructions : délai cité qualifié de légal, « pratique » = sans délai légal, marque « à confirmer » reprise du moteur de délais', () => {
    const instructions = (cle: string) => modeleReprise().etapes.find((e) => e.etapeType === `reprise.${cle}`)?.instructions
    expect(instructions('archives')).toBe('Base : L. 1965 art. 18-2 · délai légal cité : 1 mois')
    // « pratique » n'est pas un délai (reprise.ts : sans délai légal).
    expect(instructions('cles')).toBe('Base : pratique · sans délai légal')
    expect(instructions('immatriculation')).toBe('Base : CCH art. L. 711-1 · sans délai légal')
    // Règle ancien-syndic-etat-comptes : certitude A_CONFIRMER dans delais-legaux.ts.
    expect(instructions('comptes')).toBe("Base : L. 1965 art. 18-2 · délai légal cité : deux mois après le délai d'un mois (à confirmer)")
    for (const etape of modeleReprise().etapes) expect(etape.instructions).not.toMatch(/délai : (pratique|apurement)/)
  })

  it('converti en EtapeTypeProcessus[] : sans délai saisi, aucun délai (J76) ; avec les délais de gestion saisis par le cabinet', () => {
    expect(processusDuModele(modeleReprise()).every((p) => p.delaiJours === null)).toBe(true)
    const m = modeleReprise().etapes.reduce((acc, e) => fixerDelaiEtapeModele(acc, e.etapeType, 3), modeleReprise())
    const processus = processusDuModele(m)
    expect(processus).toHaveLength(12)
    expect(processus.every((p) => p.delaiJours === 3)).toBe(true)
  })

  it('non-régression : PIECES_REPRISE, REGLE_MOTEUR_PAR_DELAI_PIECE et piecesRepriseRecues inchangés', () => {
    const cles = PIECES_REPRISE.map((p) => p.cle)
    modeleReprise()
    expect(PIECES_REPRISE.map((p) => p.cle)).toEqual(cles)
    expect(cles).toHaveLength(12)
    expect(REGLE_MOTEUR_PAR_DELAI_PIECE).toEqual({
      '15 jours': 'ancien-syndic-tresorerie',
      '1 mois': 'ancien-syndic-archives',
      apurement: 'ancien-syndic-etat-comptes',
    })
    const documents = [
      { entiteType: 'reprise', entiteId: 'c1', type: 'tresorerie' },
      { entiteType: 'reprise', entiteId: 'c1', type: 'archives' },
      { entiteType: 'reprise', entiteId: 'c1', type: 'retrait:archives' },
    ]
    expect([...piecesRepriseRecues(documents, 'c1')]).toEqual(['tresorerie'])
  })
})

// ─── En-tête ──────────────────────────────────────────────────────────────────────────────

describe('En-tête du module : sources, décisions et points non établis', () => {
  const { texte } = enTeteDuModule('modeles-etapes')

  it('cite les tranches Gestéam et les décisions utilisées', () => {
    for (const attendu of ['Tranche 40', 'Tranche 42', 'Tranche 17', 'Tranche 43', 'J20', 'J21', 'J24', 'J41'])
      expect(texte).toContain(attendu)
  })

  it('distingue délai de gestion et délai légal, et garde ses points 🔴', () => {
    expect(texte).toContain('délai de GESTION')
    expect(texte).toContain('🔴')
    expect(texte).toContain('delais-legaux.ts')
  })

  it('fidèle aux sources : sens du bouton Enchaînement déduit (tranche 35), aucun délai par défaut (J76), J44 limité à « À faire le » et « Prévue le »', () => {
    expect(texte).toContain("bouton Enchaînement (🔵 étape suivante d'un processus)")
    expect(texte).not.toContain('délais du référentiel : 0 jour')
    expect(texte).not.toContain('valeur neutre')
    expect(texte).not.toContain('se reprogramme comme toute limite')
    expect(texte).not.toContain('aucun délai n’est affiché')
    expect(texte).not.toContain("aucun délai n'est affiché")
  })
})
