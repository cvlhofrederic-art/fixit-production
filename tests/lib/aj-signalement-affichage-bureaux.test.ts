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
  changementBureauPossibleQr, messageErreurBureauQr, messageReactivationFicheQr, messageRefusAvecBureauQr, nbBureauxCabinetQr, refusBureauARelireQr,
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

// Lot 2 (E2, E3, E4, import) : refus d'une écriture qui porte un bureau (fiche créée, fiche changée de bureau).
describe('refus d’une écriture qui porte un bureau', () => {
  it('bureaux à relire : bureau requis (un bureau ouvert entre-temps), bureau fermé, ou bureau envoyé inconnu ou d’un autre cabinet', () => {
    expect(refusBureauARelireQr('bureau_requis', false)).toBe(true)
    expect(refusBureauARelireQr('bureau_ferme', true)).toBe(true)
    expect(refusBureauARelireQr('a_reverifier', true)).toBe(true)
    // Sans bureau envoyé, a_reverifier vise le cabinet (inconnu) : rien à relire côté bureaux.
    expect(refusBureauARelireQr('a_reverifier', false)).toBe(false)
    for (const code of ['hors_domaine', 'existe_deja', 'serveur', 'reseau', 'invalide'] as const) expect(refusBureauARelireQr(code, true), code).toBe(false)
  })

  it('message : bureau envoyé et données changées → « les bureaux ont changé » ; base absente → fonction pas encore disponible ; sinon le message commun', () => {
    expect(messageRefusAvecBureauQr('a_reverifier', true)).toBe(B.aReverifier)
    expect(messageRefusAvecBureauQr('base_absente', true)).toBe(B.indisponible)
    expect(messageRefusAvecBureauQr('a_reverifier', false)).toBe(T.erreurs.a_reverifier)
    expect(messageRefusAvecBureauQr('bureau_requis', false)).toBe(T.erreurs.bureau_requis)
    expect(messageRefusAvecBureauQr('bureau_ferme', true)).toBe(T.erreurs.bureau_ferme)
    expect(messageRefusAvecBureauQr('hors_domaine', true)).toBe(T.erreurs.hors_domaine)
  })

  it('réactivation d’une fiche refusée : restée dans un bureau fermé → la marche à suivre ; sinon le message commun', () => {
    expect(messageReactivationFicheQr('bureau_ferme')).toBe(B.gestionnaire.reactivationBureauFerme)
    expect(messageReactivationFicheQr('serveur')).toBe(T.erreurs.serveur)
    expect(messageReactivationFicheQr('introuvable')).toBe(T.erreurs.introuvable)
  })

  it('filtre « Bureau » d’une liste : aucun résultat dit en clair', () => {
    expect(B.filtre.aucunGestionnaire).toBe('Aucun gestionnaire pour ce filtre.')
  })
})

describe('« Changer de bureau » sur la page profil (E4)', () => {
  const fiche = (bureau?: typeof nord) => ({ cabinet: { id: K1, nom: 'Cabinet Exemple', identifiant: 'cabinet-exemple' }, ...(bureau ? { bureau } : {}) })

  it('proposé : fiche qui a un bureau (même fermé), ou fiche d’un cabinet qui a des bureaux (fermés compris)', () => {
    expect(changementBureauPossibleQr(fiche(nord), null)).toBe(true)
    expect(changementBureauPossibleQr(fiche(sud), [{ id: K1 }])).toBe(true)
    expect(changementBureauPossibleQr(fiche(), [{ id: K1, nbBureaux: 1 }])).toBe(true)
  })

  it('jamais tant qu’aucun bureau n’existe : fiche sans bureau d’un cabinet sans bureau, cabinets non chargés ou non transmis', () => {
    expect(changementBureauPossibleQr(fiche(), [{ id: K1 }, { id: K2, nbBureaux: 2 }])).toBe(false)
    expect(changementBureauPossibleQr(fiche(), null)).toBe(false)
    expect(changementBureauPossibleQr(fiche(), undefined)).toBe(false)
  })
})
