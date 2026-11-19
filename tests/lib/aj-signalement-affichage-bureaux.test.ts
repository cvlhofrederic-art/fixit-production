// tests/lib/aj-signalement-affichage-bureaux.test.ts
//
// Bureaux des cabinets clients (PR 2 : écrans du super admin) — libellés et calculs purs partagés par les écrans E1 à E7
// et l'import (lib/aj-signalement/affichage-gestion.ts) :
//   - chaque code des bureaux a un message en clair (jamais le texte du serveur, jamais « super admin » ni « migration » :
//     le message commun sert aussi de repli à l'espace d'un gestionnaire) ;
//   - messages propres aux bureaux : base_absente → « fonction pas encore disponible » ; a_reverifier → la liste est relue ;
//   - « Cabinet · Bureau », « Nord (fermé) », compteurs d'un bureau, bureaux ouverts ;
//   - tant qu'aucun bureau n'existe (aucune clé nbBureaux, nbBureauxOuverts, bureau), rien ne s'affiche en plus :
//     « Bureaux (0) », aucun bureau obligatoire, aucun badge « Bureau à compléter ».
// Données fictives : « Cabinet Exemple », bureaux « Nord » et « Sud ».

import { describe, expect, it } from 'vitest'
import {
  TEXTES_GESTION_QR as G, aBureauOuvertQr, bureauACompleterQr, bureauxOuvertsQr, cabinetEtBureauQr, compteursBureauQr, libelleBureauQr,
  messageErreurBureauQr, nbBureauxCabinetQr,
} from '@/lib/aj-signalement/affichage-gestion'
import { TEXTES_TABLEAU_QR as T, messageErreurTableauQr } from '@/lib/aj-signalement/affichage'
import { remplir } from '@/lib/coproprietaire/textes'

const B = G.bureaux
const K1 = 'a0000000-0000-4000-8000-0000000000a1'
const K2 = 'a0000000-0000-4000-8000-0000000000a2'
const nord = { id: 'b1', nom: 'Nord', ferme: false }
const sud = { id: 'b2', nom: 'Sud', ferme: true }

describe('messages des codes des bureaux', () => {
  it.each(['nom_pris', 'plafond_bureaux', 'bureau_utilise', 'bureau_requis', 'bureau_ferme'] as const)('« %s » : un message en clair', (code) => {
    const message = messageErreurTableauQr(code)
    expect(message).toBe(T.erreurs[code])
    expect(message.length).toBeGreaterThan(20)
    expect(message).not.toMatch(/super admin|migration|SQL|_/i)
  })

  it('messages propres aux bureaux : base absente (fonction pas encore disponible), a_reverifier (liste relue) ; les autres : le message commun', () => {
    expect(messageErreurBureauQr('base_absente')).toBe(B.indisponible)
    expect(B.indisponible).toMatch(/^Fonction pas encore disponible/)
    expect(B.indisponible).not.toMatch(/migration|SQL/i)
    expect(messageErreurBureauQr('a_reverifier')).toBe(B.aReverifier)
    expect(messageErreurBureauQr('introuvable')).toBe(B.aReverifier)
    expect(messageErreurBureauQr('nom_pris')).toBe(T.erreurs.nom_pris)
    expect(messageErreurBureauQr('bureau_utilise')).toBe(T.erreurs.bureau_utilise)
    expect(messageErreurBureauQr('reseau')).toBe(T.erreurs.reseau)
  })

  it('400 et 500 : jamais le message des signalements ; nom refusé (400), enregistrement ou lecture impossible (500)', () => {
    expect(messageErreurBureauQr('invalide')).toBe(B.fenetre.nomRefuse)
    expect(messageErreurBureauQr('serveur')).toBe(B.fenetre.erreurEnregistrement)
    expect(messageErreurBureauQr('serveur', true)).toBe(B.fenetre.erreurLecture)
    expect(messageErreurBureauQr('base_absente', true)).toBe(B.indisponible)
    expect(messageErreurBureauQr('reseau', true)).toBe(T.erreurs.reseau)
    for (const texte of [B.fenetre.nomRefuse, B.fenetre.erreurEnregistrement, B.fenetre.erreurLecture]) expect(texte).not.toMatch(/signalement/i)
  })
})

describe('nombre de bureaux d’un cabinet', () => {
  it('« Bureaux (n) » : fermés compris ; 0 quand la réponse n’en porte pas (aucun bureau, ou migration absente)', () => {
    expect(nbBureauxCabinetQr({})).toBe(0)
    expect(nbBureauxCabinetQr({ nbBureaux: 3 })).toBe(3)
    expect(remplir(B.fenetre.bouton, { n: 0 })).toBe('Bureaux (0)')
  })

  it('bureau ouvert : seulement si nbBureauxOuverts > 0 (absent, 0 ou cabinet inconnu : non)', () => {
    expect(aBureauOuvertQr({ nbBureauxOuverts: 1 })).toBe(true)
    expect(aBureauOuvertQr({ nbBureauxOuverts: 0 })).toBe(false)
    expect(aBureauOuvertQr({})).toBe(false)
    expect(aBureauOuvertQr(null)).toBe(false)
    expect(aBureauOuvertQr(undefined)).toBe(false)
  })
})

describe('libellés d’un bureau', () => {
  it('« Nord », « Sud (fermé) »', () => {
    expect(libelleBureauQr(nord)).toBe('Nord')
    expect(libelleBureauQr(sud)).toBe('Sud (fermé)')
  })

  it('« Cabinet Exemple · Nord » ; sans bureau, le cabinet seul (ligne d’avant)', () => {
    expect(cabinetEtBureauQr('Cabinet Exemple', nord)).toBe('Cabinet Exemple · Nord')
    expect(cabinetEtBureauQr('Cabinet Exemple', sud)).toBe('Cabinet Exemple · Sud (fermé)')
    expect(cabinetEtBureauQr('Cabinet Exemple', undefined)).toBe('Cabinet Exemple')
    expect(cabinetEtBureauQr('Cabinet Exemple', null)).toBe('Cabinet Exemple')
  })

  it('compteurs d’un bureau : gestionnaires actifs et copropriétés actives', () => {
    expect(compteursBureauQr({ nbGestionnaires: 2, nbCoproprietes: 0 })).toBe(remplir(B.fenetre.compteurs, { gestionnaires: 2, coproprietes: 0 }))
  })

  it('bureaux ouverts : les fermés écartés, ordre gardé, liste reçue intacte', () => {
    const liste = [sud, nord, { id: 'b3', nom: 'Est', ferme: false }]
    expect(bureauxOuvertsQr(liste).map((b) => b.nom)).toEqual(['Nord', 'Est'])
    expect(liste.map((b) => b.nom)).toEqual(['Sud', 'Nord', 'Est'])
  })
})

describe('badge « Bureau à compléter »', () => {
  const cabinets = [{ id: K1, nbBureauxOuverts: 1 }, { id: K2 }]
  const fiche = (cabinet: string, bureau?: typeof nord) => ({ cabinet: { id: cabinet, nom: 'Cabinet Exemple', identifiant: 'cabinet-exemple' }, ...(bureau ? { bureau } : {}) })

  it('fiche sans bureau d’un cabinet qui a un bureau ouvert (même règle que ?bureau=aucun)', () => {
    expect(bureauACompleterQr(fiche(K1), cabinets)).toBe(true)
  })

  it('jamais : fiche avec un bureau (même fermé), cabinet sans bureau ouvert, cabinets non chargés', () => {
    expect(bureauACompleterQr(fiche(K1, nord), cabinets)).toBe(false)
    expect(bureauACompleterQr(fiche(K1, sud), cabinets)).toBe(false)
    expect(bureauACompleterQr(fiche(K2), cabinets)).toBe(false)
    expect(bureauACompleterQr(fiche(K1), null)).toBe(false)
  })
})

describe('textes des écrans E1 à E7 et de l’import', () => {
  it('chaque écran a ses textes, en français, sans nom réel', () => {
    for (const cle of ['bouton', 'titre', 'intro', 'chargement', 'aucun', 'ouvert', 'ferme', 'nom', 'ajouter', 'renommer', 'fermer', 'rouvrir'] as const) {
      expect(B.fenetre[cle].length, cle).toBeGreaterThan(2)
    }
    for (const texte of [B.gestionnaire.champ, B.gestionnaire.requis, B.gestionnaire.changer, B.gestionnaire.reactivationBureauFerme,
      B.filtre.libelle, B.filtre.tous, B.filtre.aCompleter, B.copropriete.champ, B.copropriete.aucun, B.copropriete.ligne,
      B.copropriete.bureauNonPose, B.copropriete.reactivationBureauFerme, B.import.champ, B.import.aide, B.import.requis]) {
      expect(texte.length).toBeGreaterThan(2)
    }
    expect(remplir(B.copropriete.ligne, { bureau: 'Nord' })).toBe('Bureau : Nord')
  })
})
