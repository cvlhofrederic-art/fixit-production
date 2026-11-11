// tests/lib/aj-signalement-import-variantes.test.ts
//
// PR 2, contrôle 2, constat C2 : l'import (diagnostiquerImportQr, lib/aj-signalement/import/ligne.ts) reconnaît
// l'adresse d'une fiche DU cabinet par la MÊME règle que le formulaire (estAdresseDeFicheQr : même boîte, étiquette « + »
// comprise, ou même partie locale sur un domaine du cabinet). Une variante reçoit le traitement de l'adresse exacte :
// mise dans Gestionnaire(s) si la fiche est utilisable (active, non contestée), sinon retirée avec un avertissement ;
// jamais gardée en adresse saisie (le formulaire la refuse : 400). Données fictives.

import { describe, expect, it } from 'vitest'
import { diagnostiquerImportQr } from '@/lib/aj-signalement/import/ligne'
import { MESSAGES_IMPORT_QR as M } from '@/lib/aj-signalement/import/textes'
import { adressesDeFichesQr } from '@/lib/aj-signalement/destinataires'
import type { ContexteImportQr, LigneImportQr } from '@/lib/aj-signalement/types'

const G1 = '11111111-1111-4111-8111-111111111111'
const G2 = '22222222-2222-4222-8222-222222222222'
const G3 = '33333333-3333-4333-8333-333333333333'

/** Cabinet à deux domaines (ancien et nouveau nom) : sa messagerie livre les deux aux mêmes boîtes. */
const contexte: ContexteImportQr = {
  domaines: ['exemple.test', 'exemple-bis.test'],
  fiches: [
    { id: G1, nom: 'Marie Exemple', email: 'marie.exemple@exemple.test', actif: true, contestee: false },
    { id: G2, nom: 'Paul Exemple', email: 'paul.exemple@exemple.test', actif: false, contestee: false },
    { id: G3, nom: 'Léa Exemple', email: 'lea.exemple@exemple.test', actif: true, contestee: true },
  ],
  emailsAutresCabinets: ['zoe.exemple@autre-exemple.test'],
  domainesAutresCabinets: ['autre-exemple.test'],
  existantes: [],
}

const ligne = (numeroLigne: number, emailsDestinataires: string[], sur: Partial<LigneImportQr> = {}): LigneImportQr => ({
  numeroLigne, nom: `Copropriété Exemple ${numeroLigne}`, adresse: '', codePostal: '', ville: '', immatriculation: '', referenceCabinet: '',
  batiments: [], gestionnaires: [], nomsGestionnaires: [], emailsDestinataires, actionSiExiste: 'ignorer', forcerDoublon: false,
  creerSiDoublonProbable: true, ...sur,
})

describe('C2 — import : une variante de l’adresse d’une fiche du cabinet n’est jamais gardée en saisie', () => {
  it('fiche active : sous-adresse « + », même partie locale sur l’autre domaine (avec étiquette) → mises dans Gestionnaire(s)', () => {
    const v = diagnostiquerImportQr([ligne(2, ['marie.exemple+cs@exemple.test', 'Marie.Exemple@Exemple-Bis.test', 'marie.exemple+x@exemple-bis.test', 'cs@externe.test'])], contexte)
    const d = v.diagnostics[0]
    expect(d).toMatchObject({ etat: 'avertissement', action: 'creer' })
    expect(d.gestionnaires).toEqual([{ id: G1, nom: 'Marie Exemple' }])
    expect(d.emailsDestinataires).toEqual(['cs@externe.test'])
    expect(d.messages.map((m) => [m.niveau, m.champ, m.texte])).toEqual([
      ['avertissement', 'emailsDestinataires', M.destinataireGestionnaire('marie.exemple+cs@exemple.test')],
      ['avertissement', 'emailsDestinataires', M.destinataireGestionnaire('marie.exemple@exemple-bis.test')],
      ['avertissement', 'emailsDestinataires', M.destinataireGestionnaire('marie.exemple+x@exemple-bis.test')],
      ['avertissement', 'emailsDestinataires', M.horsDomaine('cs@externe.test')],
    ])
  })

  it('fiche désactivée ou contestée : la variante est retirée avec un avertissement (ni attribuée, ni gardée)', () => {
    const v = diagnostiquerImportQr([ligne(2, ['paul.exemple+x@exemple.test', 'paul.exemple@exemple-bis.test', 'lea.exemple+y@exemple-bis.test'])], contexte)
    const d = v.diagnostics[0]
    expect(d.gestionnaires).toEqual([])
    expect(d.emailsDestinataires).toEqual([])
    expect(d.messages.map((m) => m.texte)).toEqual([
      M.destinataireRetire('paul.exemple+x@exemple.test'), M.destinataireRetire('paul.exemple@exemple-bis.test'), M.destinataireRetire('lea.exemple+y@exemple-bis.test'),
    ])
  })

  it('autre partie locale, domaine non déclaré ou d’un autre cabinet, « + » en tête : restent des saisies (la règle ne les rattache pas)', () => {
    const v = diagnostiquerImportQr([ligne(2, ['accueil@exemple-bis.test', 'marie.exemple@externe.test', 'marie.exemple@autre-exemple.test', '+marie.exemple@exemple.test'])], contexte)
    const d = v.diagnostics[0]
    expect(d.gestionnaires).toEqual([])
    expect(d.emailsDestinataires).toEqual(['accueil@exemple-bis.test', 'marie.exemple@externe.test', 'marie.exemple@autre-exemple.test', '+marie.exemple@exemple.test'])
  })

  it('cabinet à UN domaine : la partie locale sur un autre domaine reste une saisie ; l’étiquette « + » est reconnue', () => {
    const v = diagnostiquerImportQr([ligne(2, ['marie.exemple@exemple-bis.test', 'marie.exemple+x@exemple.test'])], { ...contexte, domaines: ['exemple.test'] })
    const d = v.diagnostics[0]
    expect(d.gestionnaires).toEqual([{ id: G1, nom: 'Marie Exemple' }])
    expect(d.emailsDestinataires).toEqual(['marie.exemple@exemple-bis.test'])
  })

  it('l’adresse exacte garde son traitement ; variante et adresse exacte dans la même ligne : une seule attribution', () => {
    const v = diagnostiquerImportQr([ligne(2, ['marie.exemple@exemple.test', 'marie.exemple+cs@exemple.test'])], contexte)
    expect(v.diagnostics[0].gestionnaires).toEqual([{ id: G1, nom: 'Marie Exemple' }])
    expect(v.diagnostics[0].emailsDestinataires).toEqual([])
  })

  it('colonne Gestionnaire(s) : une variante désigne la fiche (attribuée si utilisable, erreur sinon), jamais une fiche à créer', () => {
    const v = diagnostiquerImportQr([
      ligne(2, [], { gestionnaires: ['marie.exemple+x@exemple-bis.test'] }),
      ligne(3, [], { gestionnaires: ['paul.exemple@exemple-bis.test'] }),
      ligne(4, [], { gestionnaires: ['lea.exemple+z@exemple.test'] }),
    ], contexte)
    expect(v.diagnostics[0]).toMatchObject({ etat: 'a_creer', action: 'creer', gestionnaires: [{ id: G1, nom: 'Marie Exemple' }], messages: [] })
    expect(v.diagnostics[1].messages.map((m) => m.texte)).toEqual([M.gestionnaireDesactive('paul.exemple@exemple-bis.test')])
    expect(v.diagnostics[2].messages.map((m) => m.texte)).toEqual([M.gestionnaireConteste('lea.exemple+z@exemple.test')])
    expect(v.gestionnairesInconnus).toEqual([])
  })

  it('même réponse que le formulaire : l’import retire exactement les adresses que adressesDeFichesQr reconnaît', () => {
    const proposees = [
      'marie.exemple@exemple.test', 'marie.exemple+a@exemple.test', 'marie.exemple@exemple-bis.test', 'MARIE.EXEMPLE+B@EXEMPLE-BIS.TEST',
      'marie.exemple@autre-exemple.test', 'paul.exemple+z@exemple-bis.test', 'lea.exemple@exemple-bis.test', 'accueil@exemple.test', 'cs@externe.test',
    ]
    const cabinets = new Map(contexte.domaines.map((d) => [d, 'cabinet']))
    const reconnues = adressesDeFichesQr(proposees, contexte.fiches.map((f) => ({ email: f.email, cabinetId: 'cabinet' })), cabinets)
    const gardees = diagnostiquerImportQr([ligne(2, proposees)], contexte).diagnostics[0].emailsDestinataires
    const canoniques = proposees.map((e) => e.trim().toLowerCase())
    expect(gardees).toEqual(canoniques.filter((e) => !reconnues.includes(e)))
    expect(reconnues.length).toBe(6)
  })
})
