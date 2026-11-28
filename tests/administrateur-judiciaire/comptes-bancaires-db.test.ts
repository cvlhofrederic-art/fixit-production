import './fuseau-paris'
import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import {
  cloturerCompteBancaire,
  enregistrerCompteBancaire,
  enregistrerModeComptesCabinet,
  enregistrerModeComptesMandat,
  lireReglagesComptesCabinet,
  listerComptesBancaires,
  type SaisieCompteBancaire,
} from '@/lib/administrateur-judiciaire/db/comptes-bancaires'
import { useDonneesStore } from '@/lib/administrateur-judiciaire/db/donnees-store'
import { viderBaseLocale } from '@/lib/administrateur-judiciaire/db/reset'
import { ajDb } from '@/lib/administrateur-judiciaire/db/schema'
import { estCompteDuFondsTravaux, resoudreModeComptes } from '@/lib/administrateur-judiciaire/domain/comptes-bancaires'

/**
 * Comptes bancaires d'une copropriété (D-BANQUE) écrits hors du store, dans la table locale « banques » existante, et
 * modes de tenue (réglage du cabinet dans « cabinets », choix du mandat dans Mandat.modeComptesBancaires). Aucun
 * changement de version : les marques du fonds de travaux (J71) sont des champs non indexés.
 */

// IBAN de test publiés (exemples déjà utilisés par les tests D-BANQUE) : clés valides, aucun compte réel.
const IBAN_A = 'FR76 3000 6000 0112 3456 7890 189'
const IBAN_B = 'FR14 2004 1010 0505 0001 3M02 606'
/** IBAN_A avec un dernier chiffre faux : clé invalide. */
const IBAN_FAUX = 'FR76 3000 6000 0112 3456 7890 188'

const saisie = (surcharge: Partial<SaisieCompteBancaire> = {}): SaisieCompteBancaire => ({
  nature: 'courant',
  libelle: 'Compte courant',
  iban: IBAN_A,
  bic: '',
  etablissement: '',
  ...surcharge,
})

let coproprieteId: string
let mandatId: string

beforeEach(async () => {
  await viderBaseLocale()
  useDonneesStore.setState({ loaded: false, loading: false, erreur: null, coproprietes: [], mandats: [] })
  await useDonneesStore.getState().loadAll()
  const vue = await useDonneesStore.getState().createCopropriete({
    nom: 'Résidence des Acacias',
    adresse: '1 rue de l’Exemple, 75000 Paris',
    nbLots: 10,
    rg: '26/00001',
    fondement: 'art. 46 — carence',
  })
  coproprieteId = vue.id
  mandatId = vue.mandatId
})

describe('Comptes bancaires — création, modification, clôture', () => {
  it('création : ligne écrite dans « banques », IBAN sans espace, champs vides à null, compte actif', async () => {
    const cree = await enregistrerCompteBancaire(coproprieteId, saisie({ bic: ' ', etablissement: 'Banque d’exemple' }))
    const lignes = await ajDb.banques.toArray()
    expect(lignes).toHaveLength(1)
    expect(lignes[0]).toMatchObject({
      id: cree.id,
      coproprieteId,
      nature: 'courant',
      libelle: 'Compte courant',
      iban: 'FR7630006000011234567890189',
      bic: null,
      etablissement: 'Banque d’exemple',
      actif: true,
      tenaitFondsTravaux: false,
      reserveAuFondsTravaux: false,
    })
    const journal = await ajDb.activityLog.where('entite').equals('banques').toArray()
    expect(journal.map((entree) => entree.action)).toEqual(['create'])
  })

  it('IBAN vide : compte sans IBAN propre (null), accepté', async () => {
    await enregistrerCompteBancaire(coproprieteId, saisie({ nature: 'caisse_depots', iban: '  ' }))
    expect((await ajDb.banques.toArray())[0]).toMatchObject({ nature: 'caisse_depots', iban: null })
  })

  it('modification : même ligne, champs remplacés, compte toujours actif', async () => {
    const cree = await enregistrerCompteBancaire(coproprieteId, saisie())
    const modifie = await enregistrerCompteBancaire(coproprieteId, saisie({ libelle: 'Compte principal', iban: IBAN_B }), {
      id: cree.id,
    })
    const lignes = await ajDb.banques.toArray()
    expect(lignes).toHaveLength(1)
    expect(modifie.id).toBe(cree.id)
    expect(lignes[0]).toMatchObject({ libelle: 'Compte principal', iban: 'FR1420041010050500013M02606', actif: true })
  })

  it('clôture : la ligne reste, marquée inactive', async () => {
    const cree = await enregistrerCompteBancaire(coproprieteId, saisie())
    const cloture = await cloturerCompteBancaire(cree.id)
    expect(cloture.actif).toBe(false)
    expect(await ajDb.banques.get(cree.id)).toMatchObject({ actif: false, iban: 'FR7630006000011234567890189' })
  })

  it('clôture d’un compte inconnu : refusée', async () => {
    await expect(cloturerCompteBancaire('inconnu')).rejects.toThrow(/introuvable/)
  })

  it('IBAN invalide (clé fausse ou format) : refusé, rien n’est écrit', async () => {
    await expect(enregistrerCompteBancaire(coproprieteId, saisie({ iban: IBAN_FAUX }))).rejects.toThrow(/IBAN invalide/)
    await expect(enregistrerCompteBancaire(coproprieteId, saisie({ iban: 'FR76 1234' }))).rejects.toThrow(/IBAN invalide/)
    expect(await ajDb.banques.count()).toBe(0)
  })

  it('IBAN invalide à la modification : refusé, la ligne garde son IBAN', async () => {
    const cree = await enregistrerCompteBancaire(coproprieteId, saisie())
    await expect(enregistrerCompteBancaire(coproprieteId, saisie({ iban: IBAN_FAUX }), { id: cree.id })).rejects.toThrow(
      /IBAN invalide/,
    )
    expect((await ajDb.banques.get(cree.id))?.iban).toBe('FR7630006000011234567890189')
  })

  it('nature inconnue ou copropriété introuvable : refusées', async () => {
    await expect(enregistrerCompteBancaire(coproprieteId, saisie({ nature: 'livret' as never }))).rejects.toThrow(
      /Nature de compte inconnue/,
    )
    await expect(enregistrerCompteBancaire('inconnue', saisie())).rejects.toThrow(/Copropriété introuvable/)
    expect(await ajDb.banques.count()).toBe(0)
  })

  it('liste : seuls les comptes de la copropriété, dans l’ordre de création', async () => {
    const autre = await useDonneesStore.getState().createCopropriete({
      nom: 'Villa Bleue',
      adresse: '2 rue de l’Exemple, 75000 Paris',
      nbLots: 4,
      rg: '26/00002',
      fondement: 'art. 46 — carence',
    })
    await enregistrerCompteBancaire(coproprieteId, saisie({ libelle: 'Premier' }))
    await enregistrerCompteBancaire(autre.id, saisie({ libelle: 'Autre copropriété' }))
    await enregistrerCompteBancaire(coproprieteId, saisie({ nature: 'fonds_travaux', libelle: 'Second', iban: IBAN_B }))
    expect((await listerComptesBancaires(coproprieteId)).map((compte) => compte.libelle)).toEqual(['Premier', 'Second'])
  })
})

describe('Comptes bancaires — seconde fiche active du même IBAN refusée (réponse du référent métier du 28/11/2026, point #858 · 7 A)', () => {
  const REFUS = /IBAN déjà enregistré sur un autre compte actif de la copropriété \(« Compte courant »\) : un IBAN désigne un seul compte\./

  it('création d’une seconde fiche active du même IBAN (autre casse, sans espace, autre nature) : refusée, rien n’est écrit', async () => {
    const premier = await enregistrerCompteBancaire(coproprieteId, saisie())
    await expect(enregistrerCompteBancaire(coproprieteId, saisie({ libelle: 'Second', iban: 'fr7630006000011234567890189' }))).rejects.toThrow(REFUS)
    await expect(enregistrerCompteBancaire(coproprieteId, saisie({ libelle: 'Second' }))).rejects.toThrow(
      'Modifier ce compte, ou le clôturer avant de créer une nouvelle fiche.',
    )
    await expect(enregistrerCompteBancaire(coproprieteId, saisie({ nature: 'fonds_travaux', libelle: 'Fonds' }))).rejects.toThrow(REFUS)
    expect((await ajDb.banques.toArray()).map((ligne) => ligne.id)).toEqual([premier.id])
    const journal = await ajDb.activityLog.where('entite').equals('banques').toArray()
    expect(journal.map((entree) => entree.action)).toEqual(['create'])
  })

  it('fiche clôturée puis recréée sous le même IBAN : acceptée', async () => {
    const premier = await enregistrerCompteBancaire(coproprieteId, saisie())
    await cloturerCompteBancaire(premier.id)
    const recree = await enregistrerCompteBancaire(coproprieteId, saisie({ libelle: 'Compte recréé' }))
    expect(recree.id).not.toBe(premier.id)
    expect((await listerComptesBancaires(coproprieteId)).map((compte) => [compte.libelle, compte.actif])).toEqual([
      ['Compte courant', false],
      ['Compte recréé', true],
    ])
    // Une troisième fiche active du même IBAN est refusée : la fiche recréée le porte.
    await expect(enregistrerCompteBancaire(coproprieteId, saisie({ libelle: 'Troisième' }))).rejects.toThrow(/« Compte recréé »/)
  })

  it('même IBAN dans une autre copropriété, comptes sans IBAN : acceptés (la règle vaut par copropriété, pour un IBAN saisi)', async () => {
    const autre = await useDonneesStore.getState().createCopropriete({
      nom: 'Villa Bleue',
      adresse: '2 rue de l’Exemple, 75000 Paris',
      nbLots: 4,
      rg: '26/00002',
      fondement: 'art. 46 — carence',
    })
    await enregistrerCompteBancaire(coproprieteId, saisie())
    await enregistrerCompteBancaire(autre.id, saisie())
    await enregistrerCompteBancaire(coproprieteId, saisie({ nature: 'caisse_depots', iban: '' }))
    await enregistrerCompteBancaire(coproprieteId, saisie({ nature: 'sous_compte_centralisateur', iban: null }))
    expect(await ajDb.banques.count()).toBe(4)
  })

  it('modification : IBAN changé pour celui d’une autre fiche active : refusé, la ligne garde son IBAN', async () => {
    await enregistrerCompteBancaire(coproprieteId, saisie())
    const second = await enregistrerCompteBancaire(coproprieteId, saisie({ libelle: 'Second', iban: IBAN_B }))
    await expect(enregistrerCompteBancaire(coproprieteId, saisie({ libelle: 'Second', iban: IBAN_A }), { id: second.id })).rejects.toThrow(REFUS)
    // Retour de la relecture du 28/11/2026 : à la modification, le message ne parle pas de créer une fiche.
    await expect(enregistrerCompteBancaire(coproprieteId, saisie({ libelle: 'Second', iban: IBAN_A }), { id: second.id })).rejects.toThrow(
      'Saisir un autre IBAN pour le compte modifié, ou clôturer d’abord « Compte courant ».',
    )
    expect(await ajDb.banques.get(second.id)).toMatchObject({ libelle: 'Second', iban: 'FR1420041010050500013M02606' })
  })

  it('modification sans changer l’IBAN (libellé, IBAN ressaisi avec d’autres espaces) : acceptée', async () => {
    const premier = await enregistrerCompteBancaire(coproprieteId, saisie())
    await enregistrerCompteBancaire(coproprieteId, saisie({ libelle: 'Compte principal', iban: 'fr76 30006000 0112 3456 7890189' }), { id: premier.id })
    expect(await ajDb.banques.get(premier.id)).toMatchObject({ libelle: 'Compte principal', iban: 'FR7630006000011234567890189', actif: true })
  })

  it('deux fiches actives du même IBAN écrites avant cette règle : chacune reste modifiable, sans changer son IBAN', async () => {
    const premier = await enregistrerCompteBancaire(coproprieteId, saisie())
    const { id: _id, ...champs } = premier
    await ajDb.banques.add({ ...champs, id: 'banque-en-double', libelle: 'Compte en double' })
    await enregistrerCompteBancaire(coproprieteId, saisie({ libelle: 'Compte en double, renommé' }), { id: 'banque-en-double' })
    expect((await ajDb.banques.get('banque-en-double'))?.libelle).toBe('Compte en double, renommé')
    // Une nouvelle fiche active de cet IBAN reste refusée.
    await expect(enregistrerCompteBancaire(coproprieteId, saisie({ libelle: 'Troisième' }))).rejects.toThrow(/IBAN déjà enregistré/)
  })

  it('deux créations du même IBAN lancées ensemble (double clic) : une seule fiche écrite', async () => {
    const resultats = await Promise.allSettled([
      enregistrerCompteBancaire(coproprieteId, saisie({ libelle: 'Premier' })),
      enregistrerCompteBancaire(coproprieteId, saisie({ libelle: 'Second' })),
    ])
    expect(resultats.map((resultat) => resultat.status).sort()).toEqual(['fulfilled', 'rejected'])
    expect(await ajDb.banques.count()).toBe(1)
  })
})

describe('Comptes bancaires — marques du fonds de travaux (J71)', () => {
  it('« tenait le fonds de travaux » sur un compte repris : enregistrée, le compte tient le fonds', async () => {
    await enregistrerCompteBancaire(
      coproprieteId,
      saisie({ nature: 'repris_ancien_gestionnaire', iban: IBAN_B, tenaitFondsTravaux: true }),
    )
    const [ligne] = await ajDb.banques.toArray()
    expect(ligne).toMatchObject({ tenaitFondsTravaux: true, reserveAuFondsTravaux: false })
    expect(estCompteDuFondsTravaux({ nature: 'repris_ancien_gestionnaire', tenaitFondsTravaux: ligne.tenaitFondsTravaux })).toBe(
      true,
    )
  })

  it('« réservé au fonds de travaux » sur un placement : enregistrée', async () => {
    await enregistrerCompteBancaire(coproprieteId, saisie({ nature: 'placement', iban: IBAN_B, reserveAuFondsTravaux: true }))
    expect((await ajDb.banques.toArray())[0]).toMatchObject({ nature: 'placement', reserveAuFondsTravaux: true })
  })

  it('marque portée par une mauvaise nature : refusée par le domaine, rien n’est écrit', async () => {
    await expect(enregistrerCompteBancaire(coproprieteId, saisie({ tenaitFondsTravaux: true }))).rejects.toThrow(
      /seul un compte repris de l'ancien gestionnaire/,
    )
    await expect(enregistrerCompteBancaire(coproprieteId, saisie({ reserveAuFondsTravaux: true }))).rejects.toThrow(
      /seul un compte de placement/,
    )
    expect(await ajDb.banques.count()).toBe(0)
  })

  it('changement de nature à la modification : la marque devenue sans objet est effacée', async () => {
    const cree = await enregistrerCompteBancaire(
      coproprieteId,
      saisie({ nature: 'placement', iban: IBAN_B, reserveAuFondsTravaux: true }),
    )
    await enregistrerCompteBancaire(coproprieteId, saisie({ nature: 'avance_travaux', iban: IBAN_B }), { id: cree.id })
    expect(await ajDb.banques.get(cree.id)).toMatchObject({ nature: 'avance_travaux', reserveAuFondsTravaux: false })
  })
})

describe('Modes de tenue — réglage du cabinet et choix du mandat (D-BANQUE)', () => {
  it('base sans cabinet : réglage par défaut du domaine (compte séparé au nom du syndicat)', async () => {
    expect(await lireReglagesComptesCabinet()).toEqual({ modeParDefaut: 'compte_separe_syndicat' })
    expect(await ajDb.cabinets.count()).toBe(0)
  })

  it('réglage du cabinet : deux écritures simultanées sur une table vide, une seule ligne, le dernier choix gardé', async () => {
    await Promise.all([enregistrerModeComptesCabinet('caisse_depots'), enregistrerModeComptesCabinet('banque_et_caisse_depots')])
    expect(await ajDb.cabinets.count()).toBe(1)
    expect(await lireReglagesComptesCabinet()).toEqual({ modeParDefaut: 'banque_et_caisse_depots' })
  })

  it('réglage du cabinet : écrit dans « cabinets », une seule ligne même après deux changements', async () => {
    await enregistrerModeComptesCabinet('caisse_depots')
    await enregistrerModeComptesCabinet('banque_et_caisse_depots')
    expect(await ajDb.cabinets.count()).toBe(1)
    expect(await lireReglagesComptesCabinet()).toEqual({ modeParDefaut: 'banque_et_caisse_depots' })
  })

  it('mandat sans choix : le mode du cabinet s’applique', async () => {
    await enregistrerModeComptesCabinet('caisse_depots')
    const mandat = await ajDb.mandats.get(mandatId)
    expect(mandat?.modeComptesBancaires ?? null).toBeNull()
    expect(resoudreModeComptes(await lireReglagesComptesCabinet(), mandat?.modeComptesBancaires)).toEqual({
      mode: 'caisse_depots',
      origine: 'cabinet',
    })
  })

  it('choix du mandat : écrit sur le mandat (base et store), puis « Comme le cabinet » (null) le retire', async () => {
    await enregistrerModeComptesMandat(mandatId, 'centralisateur_cabinet')
    expect((await ajDb.mandats.get(mandatId))?.modeComptesBancaires).toBe('centralisateur_cabinet')
    const duStore = useDonneesStore.getState().mandats.find((mandat) => mandat.id === mandatId)
    expect(duStore?.modeComptesBancaires).toBe('centralisateur_cabinet')
    expect(resoudreModeComptes(await lireReglagesComptesCabinet(), duStore?.modeComptesBancaires)).toEqual({
      mode: 'centralisateur_cabinet',
      origine: 'mandat',
    })

    await enregistrerModeComptesMandat(mandatId, null)
    expect((await ajDb.mandats.get(mandatId))?.modeComptesBancaires).toBeNull()
    // Le reste du mandat est conservé.
    expect(await ajDb.mandats.get(mandatId)).toMatchObject({ rg: '26/00001', fondement: 'art. 46 — carence' })
  })

  it('mode inconnu : refusé pour le mandat comme pour le cabinet', async () => {
    await expect(enregistrerModeComptesMandat(mandatId, 'livret' as never)).rejects.toThrow(/Mode de tenue inconnu/)
    await expect(enregistrerModeComptesCabinet('livret' as never)).rejects.toThrow(/Mode de tenue inconnu/)
    expect(await ajDb.cabinets.count()).toBe(0)
    expect((await ajDb.mandats.get(mandatId))?.modeComptesBancaires ?? null).toBeNull()
  })

  it('mandat introuvable : refusé', async () => {
    await expect(enregistrerModeComptesMandat('inconnu', 'caisse_depots')).rejects.toThrow(/introuvable/)
  })
})
