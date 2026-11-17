import { describe, expect, it } from 'vitest'
import {
  centimesVersSaisieEuros,
  controlerFicheSinistre,
  ficheDepuisEnregistrement,
  filtrerSinistres,
  lesesSituation,
  numerosAttribues,
  proposerNumeroSinistre,
  saisieEurosVersCentimes,
  suggestionForclusion,
} from '@/lib/administrateur-judiciaire/domain/fiche-sinistre'
import { creerSinistre, type FicheSinistre, type SaisieSinistre } from '@/lib/administrateur-judiciaire/domain/sinistres'

/**
 * Fiche sinistre complète sur le modèle de Gestéam (tranches 20, 28, 42, 43) : contrôles de cohérence (dates,
 * statut ⇔ « Clos le », indemnités réglées, numéro unique), montants saisis en euros et stockés en centimes entiers,
 * forclusion jamais inventée (suggestion 🔵 à confirmer, C. assur. art. L. 114-1), numéro proposé, colonne « Lésés /
 * situation », filtres de la liste et relecture d'une ligne de la base.
 */

const AUJOURDHUI = '2026-11-06'

const saisie = (surcharge: Partial<SaisieSinistre> = {}): SaisieSinistre => ({
  coproprieteId: 'copro-1',
  type: 'Dégât des eaux',
  phase: 'Général',
  dateSurvenance: '2026-10-27',
  dateConnaissance: null,
  dateDeclaration: null,
  dateExpertise: null,
  dateRapport: null,
  dateReglement: null,
  dateCloture: null,
  partiesCommunesLesees: true,
  partiesCommunesResponsables: false,
  origine: 'Fuite sur colonne d’eau froide',
  lieu: 'Cage B, 3e étage',
  dommages: 'Plafond du palier',
  assurance: { compagnie: 'Compagnie Démo', courtier: null, contrat: null, numeroSinistre: null },
  indemniteImmediateCentimes: 0,
  indemniteImmediateReglee: false,
  indemniteDiffereeCentimes: 0,
  indemniteDiffereeReglee: false,
  causesSupprimees: false,
  reparationsFaites: false,
  numero: 'CV.00001',
  dateOuverture: '2026-10-28',
  ...surcharge,
})

const fiche = (surcharge: Partial<SaisieSinistre> = {}): FicheSinistre => creerSinistre(saisie(surcharge))

const champs = (anomalies: { champ: string }[]) => anomalies.map((anomalie) => anomalie.champ)

const bloquants = (anomalies: { champ: string; niveau: string }[]) =>
  champs(anomalies.filter((anomalie) => anomalie.niveau === 'bloquant'))

const alertes = (anomalies: { champ: string; niveau: string }[]) =>
  champs(anomalies.filter((anomalie) => anomalie.niveau === 'alerte'))

describe('fiche sinistre — montants saisis en euros, stockés en centimes entiers', () => {
  it.each([
    ['1 240,50', 124_050],
    ['1240.5', 124_050],
    ['1 234,56 €', 123_456],
    ['0', 0],
    ['', 0],
    ['   ', 0],
  ])('« %s » → %i centimes', (texte, centimes) => {
    expect(saisieEurosVersCentimes(texte)).toBe(centimes)
  })

  it.each([['12,345'], ['-5'], ['abc'], ['1,2,3']])('« %s » est refusé (null)', (texte) => {
    expect(saisieEurosVersCentimes(texte)).toBeNull()
  })

  it('les centimes se réaffichent en euros à virgule, vide pour zéro', () => {
    expect(centimesVersSaisieEuros(124_050)).toBe('1240,50')
    expect(centimesVersSaisieEuros(5)).toBe('0,05')
    expect(centimesVersSaisieEuros(0)).toBe('')
  })
})

describe('fiche sinistre — contrôles de cohérence', () => {
  it('une fiche cohérente ne lève aucune anomalie', () => {
    const coherente = fiche({
      dateDeclaration: '2026-10-29',
      dateExpertise: '2026-11-20',
      heureExpertise: '09:30',
      dateForclusion: '2028-10-27',
    })
    expect(controlerFicheSinistre(coherente, { aujourdhui: AUJOURDHUI, statutSaisi: 'En cours' })).toEqual([])
  })

  it('ouverture du dossier avant la survenance : bloquant', () => {
    const anomalies = controlerFicheSinistre(fiche({ dateOuverture: '2026-10-20' }), { aujourdhui: AUJOURDHUI })
    expect(bloquants(anomalies)).toEqual(['dateOuverture'])
  })

  it('clôture avant l’ouverture : bloquant', () => {
    const anomalies = controlerFicheSinistre(fiche({ dateOuverture: '2026-11-02', dateCloture: '2026-10-30' }), {
      aujourdhui: AUJOURDHUI,
    })
    expect(bloquants(anomalies)).toContain('dateCloture')
  })

  it('la déclaration n’est pas comparée à l’ouverture (ordre non établi dans Gestéam)', () => {
    const anomalies = controlerFicheSinistre(fiche({ dateOuverture: '2026-11-02', dateDeclaration: '2026-10-29' }), {
      aujourdhui: AUJOURDHUI,
    })
    expect(anomalies).toEqual([])
  })

  it('reprend la chronologie existante : déclaration avant la survenance, bloquant', () => {
    const anomalies = controlerFicheSinistre(fiche({ dateDeclaration: '2026-10-20' }), { aujourdhui: AUJOURDHUI })
    expect(bloquants(anomalies)).toEqual(['dateDeclaration'])
  })

  it('forclusion avant la survenance : bloquant', () => {
    const anomalies = controlerFicheSinistre(fiche({ dateForclusion: '2026-10-01' }), { aujourdhui: AUJOURDHUI })
    expect(bloquants(anomalies)).toEqual(['dateForclusion'])
  })

  it('heure d’expertise sans date d’expertise : bloquant', () => {
    const anomalies = controlerFicheSinistre(fiche({ heureExpertise: '14:00' }), { aujourdhui: AUJOURDHUI })
    expect(bloquants(anomalies)).toEqual(['heureExpertise'])
  })

  it('sinistre sans copropriété : bloquant', () => {
    const anomalies = controlerFicheSinistre(fiche({ coproprieteId: ' ' }), { aujourdhui: AUJOURDHUI })
    expect(bloquants(anomalies)).toEqual(['coproprieteId'])
  })

  it('statut « Terminé » sans « Clos le », « En cours » avec « Clos le » : bloquants', () => {
    expect(bloquants(controlerFicheSinistre(fiche(), { aujourdhui: AUJOURDHUI, statutSaisi: 'Terminé' }))).toEqual(['statut'])
    expect(
      bloquants(controlerFicheSinistre(fiche({ dateCloture: '2026-11-05' }), { aujourdhui: AUJOURDHUI, statutSaisi: 'En cours' })),
    ).toEqual(['statut'])
    expect(
      controlerFicheSinistre(fiche({ dateCloture: '2026-11-05' }), { aujourdhui: AUJOURDHUI, statutSaisi: 'Terminé' }),
    ).toEqual([])
  })

  it('sans statut saisi, le statut se lit sur « Clos le » : rien à contrôler', () => {
    expect(controlerFicheSinistre(fiche({ dateCloture: '2026-11-05' }), { aujourdhui: AUJOURDHUI })).toEqual([])
  })

  it('indemnité « réglée » sans montant, ou sans date de règlement : alertes', () => {
    const sansMontant = controlerFicheSinistre(fiche({ indemniteImmediateReglee: true, dateReglement: '2026-11-04' }), {
      aujourdhui: AUJOURDHUI,
    })
    expect(alertes(sansMontant)).toEqual(['indemniteImmediateReglee'])
    const sansDate = controlerFicheSinistre(fiche({ indemniteDiffereeCentimes: 50_000, indemniteDiffereeReglee: true }), {
      aujourdhui: AUJOURDHUI,
    })
    expect(alertes(sansDate)).toEqual(['dateReglement'])
    expect(bloquants(sansDate)).toEqual([])
  })

  it('dossier clos avec une indemnité non réglée : alerte', () => {
    const anomalies = controlerFicheSinistre(
      fiche({ indemniteDiffereeCentimes: 50_000, dateCloture: '2026-11-05' }),
      { aujourdhui: AUJOURDHUI, statutSaisi: 'Terminé' },
    )
    expect(alertes(anomalies)).toEqual(['indemniteDiffereeReglee'])
    expect(bloquants(anomalies)).toEqual([])
  })

  it('numéro déjà attribué à une autre fiche (casse et espaces ignorés) : bloquant', () => {
    const anomalies = controlerFicheSinistre(fiche({ numero: 'cv.00001 ' }), {
      aujourdhui: AUJOURDHUI,
      numerosExistants: ['CV.00001', null, undefined],
    })
    expect(bloquants(anomalies)).toEqual(['numero'])
  })

  it('numéros existants qui ne sont pas des textes (ligne illisible de la base) : ignorés, jamais d’exception', () => {
    const illisibles = [12, { a: 1 }, true] as unknown as readonly string[]
    const controler = (numero: string) =>
      controlerFicheSinistre(fiche({ numero }), { aujourdhui: AUJOURDHUI, numerosExistants: illisibles })
    expect(() => controler('12')).not.toThrow()
    expect(bloquants(controler('12'))).toEqual([])
    expect(
      bloquants(controlerFicheSinistre(fiche(), { aujourdhui: AUJOURDHUI, numerosExistants: [...illisibles, 'CV.00001'] })),
    ).toEqual(['numero'])
  })

  it('date future : alerte ; année improbable (faute de frappe) : bloquant', () => {
    expect(alertes(controlerFicheSinistre(fiche({ dateDeclaration: '2026-11-10' }), { aujourdhui: AUJOURDHUI }))).toEqual([
      'dateDeclaration',
    ])
    const improbable = controlerFicheSinistre(fiche({ dateSurvenance: '1026-10-27', dateOuverture: null }), { aujourdhui: AUJOURDHUI })
    expect(bloquants(improbable)).toEqual(['dateSurvenance'])
  })

  it('forclusion très lointaine (faute de frappe sur l’année) : alerte ; cinq ans (sécheresse, cat. nat.) : rien', () => {
    for (const improbable of ['3026-01-01', '2208-10-27']) {
      const anomalies = controlerFicheSinistre(fiche({ dateForclusion: improbable }), { aujourdhui: AUJOURDHUI })
      expect(alertes(anomalies)).toEqual(['dateForclusion'])
      expect(anomalies[0].message).toMatch(/plus de 10 ans après la survenance/)
    }
    expect(controlerFicheSinistre(fiche({ dateForclusion: '2031-10-27' }), { aujourdhui: AUJOURDHUI })).toEqual([])
    expect(controlerFicheSinistre(fiche({ dateForclusion: '2036-10-27' }), { aujourdhui: AUJOURDHUI })).toEqual([])
  })

  it('compagnie ou n° de police différents de ceux du contrat choisi : alertes (jamais bloquantes)', () => {
    const contratChoisi = { compagnie: 'MMA', numeroPolice: 'PJ-1' }
    const avecContrat = (assurance: Partial<SaisieSinistre['assurance']>) =>
      fiche({ assurance: { compagnie: null, courtier: null, contrat: null, numeroSinistre: null, contratId: 'k1', ...assurance } })
    const differente = controlerFicheSinistre(avecContrat({ compagnie: 'Generali', contrat: 'MRI-44120' }), {
      aujourdhui: AUJOURDHUI,
      contratChoisi,
    })
    expect(alertes(differente)).toEqual(['assurance', 'assurance'])
    expect(differente.map((anomalie) => anomalie.message).join(' ')).toMatch(/Generali.*MMA/)
    expect(bloquants(differente)).toEqual([])
    // Casse et espaces ignorés ; champs vides ou contrat sans compagnie : rien à signaler.
    expect(
      controlerFicheSinistre(avecContrat({ compagnie: ' mma ', contrat: 'pj-1' }), { aujourdhui: AUJOURDHUI, contratChoisi }),
    ).toEqual([])
    expect(controlerFicheSinistre(avecContrat({}), { aujourdhui: AUJOURDHUI, contratChoisi })).toEqual([])
    expect(
      controlerFicheSinistre(avecContrat({ compagnie: 'Generali' }), {
        aujourdhui: AUJOURDHUI,
        contratChoisi: { compagnie: null, numeroPolice: null },
      }),
    ).toEqual([])
  })

  it('partie « Immeuble » ou « Personne » rattachée à une fiche d’une autre copropriété : alerte', () => {
    const avecParties = fiche({
      parties: [
        { role: 'Lésé', nature: 'Immeuble', refId: 'copro-autre', libelle: 'Résidence voisine' },
        { role: 'Lésé', nature: 'Personne', refId: 'personne-autre', libelle: 'Copropriétaire voisin' },
        { role: 'Lésé', nature: 'Personne', refId: 'personne-1', libelle: 'Copropriétaire du lot 3' },
        { role: 'Responsable', nature: 'Entreprise', refId: 'entreprise-1', libelle: 'Plombier' },
        { role: 'Autre', nature: 'Personne', refId: null, libelle: 'Voisin (saisie libre)' },
      ],
    })
    const anomalies = controlerFicheSinistre(avecParties, {
      aujourdhui: AUJOURDHUI,
      refsCopropriete: ['copro-1', 'personne-1'],
    })
    expect(alertes(anomalies)).toEqual(['parties', 'parties'])
    expect(anomalies.map((anomalie) => anomalie.message).join(' ')).toMatch(/Résidence voisine.*Copropriétaire voisin/)
    // Sans liste des fiches de la copropriété : rien à contrôler.
    expect(controlerFicheSinistre(avecParties, { aujourdhui: AUJOURDHUI })).toEqual([])
  })

  it('chaque anomalie porte un message lisible', () => {
    const [anomalie] = controlerFicheSinistre(fiche({ dateOuverture: '2026-10-20' }), { aujourdhui: AUJOURDHUI })
    expect(anomalie.message).toMatch(/ouverture/i)
  })
})

describe('fiche sinistre — forclusion : suggestion 🔵, jamais inventée', () => {
  it('suggère survenance + 24 mois (prescription biennale), à confirmer, avec son fondement', () => {
    const suggestion = suggestionForclusion(fiche())
    expect(suggestion).toMatchObject({
      date: '2028-10-27',
      dureeMois: 24,
      base: 'survenance',
      marqueur: '🔵',
      aConfirmer: true,
      fondement: 'C. assur. art. L. 114-1',
    })
    expect(suggestion.avertissements.join(' ')).toMatch(/L\. 114-2/)
  })

  it('29 février → 28 février deux ans plus tard', () => {
    expect(suggestionForclusion(fiche({ dateSurvenance: '2024-02-29', dateOuverture: null })).date).toBe('2026-02-28')
  })

  it('n’écrit jamais dans la fiche : la date de forclusion reste celle saisie (vide ici)', () => {
    const sansForclusion = Object.freeze(fiche())
    suggestionForclusion(sansForclusion)
    expect(sansForclusion.dateForclusion ?? null).toBeNull()
  })

  it('connaissance postérieure : point de départ reporté si l’ignorance est prouvée (L. 114-1, 2°)', () => {
    const suggestion = suggestionForclusion(fiche({ dateConnaissance: '2026-12-15', dateOuverture: null }))
    expect(suggestion.date).toBe('2028-10-27')
    expect(suggestion.dateSiConnaissanceTardive).toBe('2028-12-15')
    expect(suggestion.avertissements.join(' ')).toMatch(/ignor/)
    expect(suggestionForclusion(fiche()).dateSiConnaissanceTardive).toBeNull()
  })

  it('responsabilité civile, défense-recours : le recours d’un tiers reporte le point de départ', () => {
    expect(suggestionForclusion(fiche({ type: 'Responsabilités civiles' })).avertissements.join(' ')).toMatch(/tiers/)
    expect(suggestionForclusion(fiche({ type: 'Défense - Recours' })).avertissements.join(' ')).toMatch(/tiers/)
    expect(suggestionForclusion(fiche()).avertissements.join(' ')).not.toMatch(/tiers/)
  })

  it('catastrophe naturelle : rappel des cinq ans de la sécheresse-réhydratation, à vérifier 🔴', () => {
    const texte = suggestionForclusion(fiche({ type: 'Catastrophes naturelles' })).avertissements.join(' ')
    expect(texte).toMatch(/cinq ans/)
    expect(texte).toMatch(/🔴/)
  })
})

describe('fiche sinistre — numéro proposé (code + « . » + rang sur 5 chiffres, 🔵)', () => {
  it('premier numéro de la copropriété', () => {
    expect(proposerNumeroSinistre('CV', [])).toBe('CV.00001')
  })

  it('rang suivant le plus grand rang de la copropriété ; autres codes et numéros libres ignorés', () => {
    expect(proposerNumeroSinistre('CV', ['CV.00001', 'CV.00007', 'TL.00009', 'CV.ABC', null, undefined])).toBe('CV.00008')
  })

  it('sans code de copropriété : aucune proposition', () => {
    expect(proposerNumeroSinistre('', ['CV.00001'])).toBeNull()
    expect(proposerNumeroSinistre(null, [])).toBeNull()
  })

  it('numéros existants qui ne sont pas des textes : ignorés, jamais d’exception', () => {
    const existants = [12, { a: 1 }, 'CV.00002'] as unknown as readonly string[]
    expect(proposerNumeroSinistre('CV', existants)).toBe('CV.00003')
  })
})

describe('fiche sinistre — numéros attribués (proposition et unicité, à l’écran comme à l’enregistrement)', () => {
  const lignes = [
    { id: 'a', numero: 'CV.00001' },
    { id: 'b', numero: 12 },
    { id: 'c', numero: { a: 1 } },
    { id: 'd', numero: null },
    { id: 'e' },
    { id: 'f', numero: 'CV.00004' },
  ]

  it('numéros textes des lignes de la base, lisibles ou non ; un n° qui n’est pas un texte est ignoré', () => {
    expect(numerosAttribues(lignes, null)).toEqual(['CV.00001', 'CV.00004'])
  })

  it('le numéro de la fiche modifiée en est exclu', () => {
    expect(numerosAttribues(lignes, 'f')).toEqual(['CV.00001'])
  })
})

describe('fiche sinistre — colonne « Lésés / situation »', () => {
  it('parties communes lésées et lieu', () => {
    expect(lesesSituation(fiche())).toBe('Parties communes / Cage B, 3e étage')
  })

  it('parties lésées de la grille, puis le lieu ; les autres rôles ne figurent pas', () => {
    const avecParties = fiche({
      partiesCommunesLesees: false,
      parties: [
        { role: 'Lésé', nature: 'Personne', refId: null, libelle: 'Occupant du lot 12' },
        { role: 'Responsable', nature: 'Entreprise', refId: 'F1', libelle: 'Plombier' },
      ],
    })
    expect(lesesSituation(avecParties)).toBe('Occupant du lot 12 / Cage B, 3e étage')
  })

  it('rien de renseigné : vide', () => {
    expect(lesesSituation(fiche({ partiesCommunesLesees: false, lieu: '' }))).toBe('')
  })
})

describe('fiche sinistre — filtres de la liste', () => {
  const lignes = [
    { id: 'a', ...fiche({ coproprieteId: 'C1', phase: 'Déclaration' }) },
    { id: 'b', ...fiche({ coproprieteId: 'C2', type: 'Bris de glace', dateCloture: '2026-11-05' }) },
    { id: 'c', ...fiche({ coproprieteId: 'C2', phase: "Mission d'expertise" }) },
  ]

  it('sans filtre : toutes les lignes, dans l’ordre', () => {
    expect(filtrerSinistres(lignes, {}).map((ligne) => ligne.id)).toEqual(['a', 'b', 'c'])
  })

  it('par statut, type, phase et copropriété, cumulables', () => {
    expect(filtrerSinistres(lignes, { statut: 'Terminé' }).map((ligne) => ligne.id)).toEqual(['b'])
    expect(filtrerSinistres(lignes, { statut: 'En cours' }).map((ligne) => ligne.id)).toEqual(['a', 'c'])
    expect(filtrerSinistres(lignes, { type: 'Bris de glace' }).map((ligne) => ligne.id)).toEqual(['b'])
    expect(filtrerSinistres(lignes, { phase: "Mission d'expertise" }).map((ligne) => ligne.id)).toEqual(['c'])
    expect(filtrerSinistres(lignes, { coproprieteId: 'C2', statut: 'En cours' }).map((ligne) => ligne.id)).toEqual(['c'])
  })

  it('un filtre vide (null) est ignoré', () => {
    expect(filtrerSinistres(lignes, { statut: null, type: null, phase: null, coproprieteId: null })).toHaveLength(3)
  })
})

describe('fiche sinistre — relecture d’une ligne de la base', () => {
  it('ligne partielle : fiche complète aux valeurs par défaut, sans les champs de suivi de la base', () => {
    const relue = ficheDepuisEnregistrement({
      id: 'sin-1',
      createdAt: '2026-11-06T10:00:00.000Z',
      updatedAt: '2026-11-06T10:00:00.000Z',
      createdBy: null,
      updatedBy: null,
      coproprieteId: 'C1',
      type: 'Incendie',
      dateSurvenance: '2026-10-01',
    })
    expect(relue).not.toBeNull()
    expect(relue).toMatchObject({
      coproprieteId: 'C1',
      type: 'Incendie',
      phase: null,
      dateSurvenance: '2026-10-01',
      dateConnaissance: '2026-10-01',
      dateCloture: null,
      origine: '',
      assurance: { compagnie: null, courtier: null, contrat: null, numeroSinistre: null },
      indemniteImmediateCentimes: 0,
      parties: [],
      numero: null,
      dateForclusion: null,
      responsable: null,
    })
    expect(relue).not.toHaveProperty('id')
    expect(relue).not.toHaveProperty('createdAt')
  })

  it('conserve les champs Gestéam enregistrés', () => {
    const complete = fiche({ heureExpertise: '10:15', dateExpertise: '2026-11-20', notes: 'Clé chez le gardien' })
    expect(ficheDepuisEnregistrement({ id: 'x', ...complete })).toEqual(complete)
  })

  it('ligne illisible (sans type, type inconnu, montant non entier) : null', () => {
    expect(ficheDepuisEnregistrement({ coproprieteId: 'C1', dateSurvenance: '2026-10-01' })).toBeNull()
    expect(ficheDepuisEnregistrement({ coproprieteId: 'C1', type: 'Grêle' as never, dateSurvenance: '2026-10-01' })).toBeNull()
    expect(
      ficheDepuisEnregistrement({ coproprieteId: 'C1', type: 'Vol', dateSurvenance: '2026-10-01', indemniteImmediateCentimes: 1.5 }),
    ).toBeNull()
  })

  it('ligne au format inattendu (texte null ou numérique, parties hors tableau…) : null, jamais une exception', () => {
    const base = { coproprieteId: 'C1', type: 'Vol' as const, dateSurvenance: '2026-10-01' }
    const illisibles: Record<string, unknown>[] = [
      { origine: null },
      { lieu: 12 },
      { dommages: null },
      { notes: null },
      { numero: 12 },
      { bail: 7 },
      { parties: 'Voisin' },
      { parties: [null] },
      { parties: [{ role: 'Lésé', nature: 'Personne', refId: null, libelle: 3 }] },
      { responsable: { id: null, nom: 5 } },
      { assistant: 'Awa' },
      { assurance: { compagnie: 12 } },
      { assurance: 'MMA' },
      { partiesCommunesLesees: 'oui' },
    ]
    for (const surcharge of illisibles)
      expect(() => ficheDepuisEnregistrement({ ...base, ...surcharge } as never), JSON.stringify(surcharge)).not.toThrow()
    for (const surcharge of illisibles)
      expect(ficheDepuisEnregistrement({ ...base, ...surcharge } as never), JSON.stringify(surcharge)).toBeNull()
    // Valeurs nulles admises par le format : la ligne reste lisible.
    expect(ficheDepuisEnregistrement({ ...base, numero: null, bail: null, responsable: null })).not.toBeNull()
  })
})
