// tests/lib/btp-pointage-regles.test.ts — règles serveur du pointage BTP (16/11/2026) : fiche employé du compte,
// chantiers affectés, heure locale, clôture, export CSV. Données fictives.

import { describe, expect, it } from 'vitest'
import {
  FUSEAU_PAR_DEFAUT,
  FUSEAUX_AUTORISES,
  NOTE_A_REGULARISER,
  NOTE_DEPART_APRES_COUPURE,
  TOLERANCE_HORLOGE_MS,
  ajouterNote,
  celluleCsv,
  chantierPointable,
  chantierPourTelephone,
  chantiersAffectes,
  cloture,
  equipesDuMembre,
  estOublie,
  fuseauValide,
  heureLocale,
  instantArrivee,
  instantDepart,
  libelleMode,
  membreDuCompte,
  noteDepartApresCoupure,
  pointagesEnCsv,
  reperesArrivee,
  type ChantierBtp,
  type EquipeBtp,
  type MembreBtp,
} from '@/lib/btp/pointage-regles'

const PAUL: MembreBtp = { id: 'm-paul', prenom: 'Paul', nom: 'Exemple', email: 'Paul.Exemple@example.test ' }
const JEAN: MembreBtp = { id: 'm-jean', prenom: 'Jean', nom: 'Test', email: 'jean@example.test', equipe_id: 'e-ancienne' }

describe('membreDuCompte — la fiche employé porte l’adresse e-mail du compte', () => {
  it('comparaison sans casse ni espaces', () => {
    expect(membreDuCompte([PAUL, JEAN], ' paul.exemple@EXAMPLE.test')).toEqual({ statut: 'relie', membre: PAUL })
  })

  it('aucune fiche, adresse vide ou fiche inactive : non relié', () => {
    expect(membreDuCompte([JEAN], 'paul.exemple@example.test')).toEqual({ statut: 'aucun' })
    expect(membreDuCompte([PAUL], '')).toEqual({ statut: 'aucun' })
    expect(membreDuCompte([PAUL], undefined)).toEqual({ statut: 'aucun' })
    expect(membreDuCompte([{ ...PAUL, actif: false }], 'paul.exemple@example.test')).toEqual({ statut: 'aucun' })
  })

  it('deux fiches actives à la même adresse : ambigu, aucune n’est choisie', () => {
    expect(membreDuCompte([PAUL, { ...PAUL, id: 'm-paul-2' }], 'paul.exemple@example.test')).toEqual({ statut: 'ambigu' })
    expect(membreDuCompte([PAUL, { ...PAUL, id: 'm-paul-2', actif: false }], 'paul.exemple@example.test'))
      .toEqual({ statut: 'relie', membre: PAUL })
  })
})

describe('chantiersAffectes — directement ou par une équipe, et seulement « En cours »', () => {
  const equipes: EquipeBtp[] = [
    { id: 'e-macons', chantier_id: 'c-villa', equipe_membres_btp: [{ membre_id: 'm-paul' }] },
    { id: 'e-ancienne', chantier_id: 'c-immeuble', equipe_membres_btp: [] },
    { id: 'e-sans-chantier', chantier_id: null, equipe_membres_btp: [{ membre_id: 'm-paul' }] },
  ]
  const chantiers: ChantierBtp[] = [
    { id: 'c-villa', titre: 'Villa', statut: 'En cours', membres_ids: [] },
    { id: 'c-immeuble', titre: 'Immeuble', statut: 'En cours' },
    { id: 'c-garage', titre: 'Garage', statut: 'En cours', membres_ids: ['m-paul'] },
    { id: 'c-fini', titre: 'Fini', statut: 'Terminé', membres_ids: ['m-paul', 'm-jean'] },
    { id: 'c-autre', titre: 'Autre', statut: 'En cours', membres_ids: ['m-autre'] },
  ]

  it('équipes du membre : table de liaison et ancienne colonne equipe_id', () => {
    expect([...equipesDuMembre(PAUL, equipes)].sort((a, b) => a.localeCompare(b))).toEqual(['e-macons', 'e-sans-chantier'])
    expect([...equipesDuMembre(JEAN, equipes)]).toEqual(['e-ancienne'])
  })

  it('Paul : la villa par son équipe, le garage directement ; pas le chantier terminé', () => {
    expect(chantiersAffectes(PAUL, chantiers, equipes).map(c => c.id)).toEqual(['c-villa', 'c-garage'])
  })

  it('Jean : l’immeuble par l’ancienne colonne equipe_id', () => {
    expect(chantiersAffectes(JEAN, chantiers, equipes).map(c => c.id)).toEqual(['c-immeuble'])
  })

  it('sans la colonne membres_ids (migration non appliquée), les équipes suffisent', () => {
    const sansColonne = chantiers.map(({ membres_ids: _ignore, ...reste }) => reste)
    expect(chantiersAffectes(PAUL, sansColonne, equipes).map(c => c.id)).toEqual(['c-villa'])
  })
})

describe('chantier vers le téléphone', () => {
  it('rien d’autre que titre, adresse, position et rayon ; position invalide → null', () => {
    const chantier: ChantierBtp & Record<string, unknown> = {
      id: 'c1', titre: 'Villa', adresse: '1 rue des Lilas', code_postal: '13008', ville: 'Marseille',
      latitude: 43.25, longitude: 5.38, geo_rayon_m: 150, budget: 45000, client: 'Mme X', membres_ids: ['m1'],
    }
    expect(chantierPourTelephone(chantier)).toEqual({
      id: 'c1', titre: 'Villa', adresse: '1 rue des Lilas, 13008 Marseille', latitude: 43.25, longitude: 5.38, rayonM: 150,
    })
    const sansPosition = chantierPourTelephone({ id: 'c2', titre: 'Garage', latitude: 0, longitude: 0, geo_rayon_m: null })
    expect(sansPosition).toMatchObject({ latitude: null, longitude: null, rayonM: 100, adresse: '' })
    expect(chantierPointable(sansPosition)).toBeNull()
    expect(chantierPointable(chantierPourTelephone(chantier))).toEqual({ id: 'c1', titre: 'Villa', latitude: 43.25, longitude: 5.38, rayonM: 150 })
  })
})

describe('fuseau et instants du pointage', () => {
  it('fuseau : seulement ceux de la liste (France, outre-mer, Portugal), sinon Europe/Paris', () => {
    expect(fuseauValide('Europe/Lisbon')).toBe('Europe/Lisbon')
    expect(fuseauValide('Atlantic/Azores')).toBe('Atlantic/Azores')
    expect(fuseauValide('Indian/Reunion')).toBe('Indian/Reunion')
    expect(fuseauValide('America/Sao_Paulo')).toBe(FUSEAU_PAR_DEFAUT)
    expect(fuseauValide('Asia/Kolkata')).toBe(FUSEAU_PAR_DEFAUT)
    expect(fuseauValide('Pas/Un_Fuseau')).toBe(FUSEAU_PAR_DEFAUT)
    expect(fuseauValide(42)).toBe(FUSEAU_PAR_DEFAUT)
    expect(FUSEAUX_AUTORISES).toContain(FUSEAU_PAR_DEFAUT)
  })

  it('heure locale du chantier, heure d’été comprise', () => {
    const instant = Date.UTC(2026, 6, 15, 6, 5, 9) // 15/07/2026 06:05:09 UTC
    expect(heureLocale(instant, 'Europe/Paris')).toEqual({ date: '2026-07-15', heure: '08:05:09' })
    expect(heureLocale(instant, 'Europe/Lisbon')).toEqual({ date: '2026-07-15', heure: '07:05:09' })
    expect(heureLocale(Date.UTC(2026, 11, 31, 23, 30, 0), 'Europe/Paris')).toEqual({ date: '2027-01-01', heure: '00:30:00' })
  })

  const SERVEUR = 1_800_000_000_000

  it('arrivée : heure du serveur ; en automatique, l’entrée dans la zone si elle est passée et à moins de 10 min', () => {
    expect(instantArrivee('geo_auto', SERVEUR - 60_000, SERVEUR)).toBe(SERVEUR - 60_000)
    expect(instantArrivee('geo_auto', SERVEUR - TOLERANCE_HORLOGE_MS, SERVEUR)).toBe(SERVEUR - TOLERANCE_HORLOGE_MS)
    expect(instantArrivee('geo_auto', SERVEUR - TOLERANCE_HORLOGE_MS - 1, SERVEUR)).toBe(SERVEUR)
    expect(instantArrivee('geo_auto', SERVEUR + 60_000, SERVEUR)).toBe(SERVEUR) // dans le futur : refusé
    expect(instantArrivee('manuel', SERVEUR - 60_000, SERVEUR)).toBe(SERVEUR) // à la main : jamais l'horloge du téléphone
    expect(instantArrivee('geo_auto', undefined, SERVEUR)).toBe(SERVEUR)
    expect(instantArrivee('geo_auto', Number.NaN, SERVEUR)).toBe(SERVEUR)
  })

  it('départ : heure du serveur ; en automatique, la dernière présence, bornée entre l’arrivée et maintenant', () => {
    const arrivee = SERVEUR - 8 * 3_600_000
    expect(instantDepart('geo_auto', SERVEUR - 3 * 3_600_000, SERVEUR, arrivee)).toBe(SERVEUR - 3 * 3_600_000)
    expect(instantDepart('geo_auto', SERVEUR + 3_600_000, SERVEUR, arrivee)).toBe(SERVEUR) // futur : jamais plus tard que maintenant
    expect(instantDepart('geo_auto', arrivee - 3_600_000, SERVEUR, arrivee)).toBe(arrivee) // jamais avant l'arrivée
    expect(instantDepart('manuel', SERVEUR - 3 * 3_600_000, SERVEUR, arrivee)).toBe(SERVEUR)
  })
})

describe('clôture d’un pointage (instants UTC)', () => {
  // Arrivée le 16/11/2026 à 08:30:00, heure de Paris (07:30:00 UTC), enregistrée par la route.
  const ARRIVEE = Date.UTC(2026, 10, 16, 7, 30, 0)
  const ouvert = { date: '2026-11-16', heure_arrivee: '08:30:00', created_at: new Date(ARRIVEE).toISOString(), pause_minutes: 0 }

  it('repères de l’arrivée : instant de created_at et fuseau dont l’écart correspond à cet instant', () => {
    expect(reperesArrivee(ouvert)).toEqual({ instant: ARRIVEE, fuseau: 'Europe/Paris' })
    // Lisbonne en hiver (écart nul), Réunion (+4 h) ; format de created_at rendu par PostgREST.
    const lisbonne = { date: '2026-11-16', heure_arrivee: '07:30:00', created_at: '2026-11-16T07:30:00.123+00:00' }
    expect(reperesArrivee(lisbonne)).toEqual({ instant: ARRIVEE + 123, fuseau: 'Europe/Lisbon' })
    // Le départ s'écrit à l'heure de Lisbonne, comme l'arrivée.
    expect(cloture(lisbonne, ARRIVEE + 123 + 8 * 3_600_000)).toEqual({ heureDepart: '15:30:00', heuresTravaillees: 8, aRegulariser: false })
    expect(reperesArrivee({ date: '2026-11-16', heure_arrivee: '11:30:00', created_at: new Date(ARRIVEE).toISOString() }))
      .toEqual({ instant: ARRIVEE, fuseau: 'Indian/Reunion' })
  })

  it('sans created_at exploitable : heure murale lue à Paris (heure d’été comprise)', () => {
    expect(reperesArrivee({ date: '2026-11-16', heure_arrivee: '08:30:00' })).toEqual({ instant: ARRIVEE, fuseau: 'Europe/Paris' })
    expect(reperesArrivee({ date: '2026-07-15', heure_arrivee: '08:00', created_at: 'n’importe quoi' }))
      .toEqual({ instant: Date.UTC(2026, 6, 15, 6, 0, 0), fuseau: 'Europe/Paris' })
  })

  it('created_at incohérent (ligne saisie après coup) : écart d’aucun fuseau de la liste → heure murale lue à Paris', () => {
    // Arrivée 08:00 enregistrée à 17:00 (heure de Paris, 16:00 UTC) : écart de −8 h, aucun fuseau de la liste.
    const saisieTardive = { date: '2026-11-16', heure_arrivee: '08:00:00', created_at: '2026-11-16T16:00:00Z', pause_minutes: 0 }
    expect(reperesArrivee(saisieTardive)).toEqual({ instant: Date.UTC(2026, 10, 16, 7, 0, 0), fuseau: 'Europe/Paris' })
    expect(cloture(saisieTardive, Date.UTC(2026, 10, 16, 17, 0, 0))).toEqual({ heureDepart: '18:00:00', heuresTravaillees: 10, aRegulariser: false })
  })

  it('changement d’heure pendant le pointage : durée sur les instants, heure de départ murale juste', () => {
    // Nuit du 24 au 25/10/2026 à Paris : 03:00 (été) redevient 02:00 (hiver). Arrivée 01:30 (été), départ 05:00 (hiver).
    const nuit = { date: '2026-10-25', heure_arrivee: '01:30:00', created_at: '2026-10-24T23:30:00Z', pause_minutes: 0 }
    expect(cloture(nuit, Date.UTC(2026, 9, 25, 4, 0, 0))).toEqual({ heureDepart: '05:00:00', heuresTravaillees: 4.5, aRegulariser: false })
  })

  it('même jour : heures calculées sur les instants, pause déduite, heure de départ dans le même fuseau qu’à l’arrivée', () => {
    expect(cloture(ouvert, ARRIVEE + 8 * 3_600_000 + 6 * 60_000)).toEqual({ heureDepart: '16:36:00', heuresTravaillees: 8.1, aRegulariser: false })
    expect(cloture({ ...ouvert, pause_minutes: 60 }, ARRIVEE + 9 * 3_600_000)).toEqual({ heureDepart: '17:30:00', heuresTravaillees: 8, aRegulariser: false })
  })

  it('départ constaté un autre jour (oubli) : 0 h, départ = arrivée, à régulariser — jamais une journée de 16 h', () => {
    expect(cloture(ouvert, ARRIVEE + 24 * 3_600_000)).toEqual({ heureDepart: '08:30:00', heuresTravaillees: 0, aRegulariser: true })
    // 23:59 heure de Paris le même jour : encore le jour de l'arrivée.
    expect(cloture(ouvert, Date.UTC(2026, 10, 16, 22, 59, 0)).aRegulariser).toBe(false)
  })

  it('horloge incohérente (départ avant l’arrivée) : durée nulle, jamais négative', () => {
    expect(cloture(ouvert, ARRIVEE - 3_600_000)).toEqual({ heureDepart: '08:30:00', heuresTravaillees: 0, aRegulariser: false })
  })

  it('pointage oublié : ouvert un jour précédent, selon l’heure murale de l’arrivée', () => {
    expect(estOublie(ouvert, Date.UTC(2026, 10, 16, 22, 59, 0))).toBe(false)
    expect(estOublie(ouvert, Date.UTC(2026, 10, 16, 23, 0, 1))).toBe(true) // 00:00:01 à Paris le 17
  })

  it('note après une coupure du suivi : heure murale de la dernière présence, seulement entre l’arrivée et le départ', () => {
    const depart = ARRIVEE + 9 * 3_600_000
    expect(noteDepartApresCoupure(ouvert, ARRIVEE + 35 * 60_000, depart))
      .toBe(`${NOTE_DEPART_APRES_COUPURE} ; dernière présence vue sur le chantier à 09:05 : à vérifier.`)
    expect(noteDepartApresCoupure(ouvert, ARRIVEE - 60_000, depart)).toBeNull()
    expect(noteDepartApresCoupure(ouvert, depart + 60_000, depart)).toBeNull()
    expect(noteDepartApresCoupure(ouvert, undefined, depart)).toBeNull()
    expect(noteDepartApresCoupure(ouvert, '09:05', depart)).toBeNull()
  })

  it('notes : ajoutées sans doublon', () => {
    expect(ajouterNote(null, NOTE_A_REGULARISER)).toBe(NOTE_A_REGULARISER)
    expect(ajouterNote('Pluie.', NOTE_A_REGULARISER)).toBe(`Pluie. ${NOTE_A_REGULARISER}`)
    expect(ajouterNote(`Pluie. ${NOTE_A_REGULARISER}`, NOTE_A_REGULARISER)).toBe(`Pluie. ${NOTE_A_REGULARISER}`)
  })
})

describe('export CSV', () => {
  it('cellules entre guillemets, guillemets doublés, formules neutralisées', () => {
    expect(celluleCsv('Villa "Les Pins"')).toBe('"Villa ""Les Pins"""')
    expect(celluleCsv('=HYPERLINK("x")')).toBe('"\'=HYPERLINK(""x"")"')
    expect(celluleCsv('-2')).toBe('"\'-2"')
    expect(celluleCsv('@SUM(A1)')).toBe('"\'@SUM(A1)"')
    expect(celluleCsv(null)).toBe('""')
  })

  it('points-virgules, en-tête dans la langue, pointage en cours, virgule décimale', () => {
    const csv = pointagesEnCsv([
      { date: '2026-11-16', employe: 'Paul Exemple', chantier: 'Villa', heureArrivee: '08:00:00', heureDepart: '12:30:00', heuresTravaillees: 4.5, mode: 'geo_auto' },
      { date: '2026-11-16', employe: 'Jean Test', chantier: 'Garage', heureArrivee: '13:15:00', heureDepart: '', heuresTravaillees: 0, mode: 'manuel' },
    ], false)
    expect(csv.split('\r\n')).toEqual([
      '"Date";"Employé";"Chantier";"Arrivée";"Départ";"Heures";"Méthode"',
      '"2026-11-16";"Paul Exemple";"Villa";"08:00";"12:30";"4,50";"Automatique (GPS)"',
      '"2026-11-16";"Jean Test";"Garage";"13:15";"En cours";"0,00";"Manuel"',
    ])
    expect(pointagesEnCsv([], true)).toBe('"Data";"Colaborador";"Obra";"Chegada";"Saída";"Horas";"Método"')
  })

  it('libellés des méthodes', () => {
    expect(libelleMode('geo_confirme', false)).toBe('Sur site (GPS)')
    // « o método » : masculin en portugais (rapport i18n PT-PT du 17/11/2026).
    expect(libelleMode('geo_auto', true)).toBe('Automático (GPS)')
    expect(libelleMode(undefined, false)).toBe('Manuel')
  })
})
