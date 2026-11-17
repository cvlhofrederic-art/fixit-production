// tests/lib/aj-signalement-affichage-gestionnaire.test.ts
//
// PR 2, lot 5 : libellés et calculs purs de l'espace d'un cabinet (vitfix.io/<identifiant>/suivi/), vu par un gestionnaire
// connecté (SPEC § 2.8) :
//   - messages d'échec propres au gestionnaire (403 acces_retire : « Votre accès a été retiré par le cabinet. » ; 503 :
//     « Fonction pas encore activée. » ; réseau : « Connexion impossible, réessayez. ») ; jamais un texte du super admin
//     (« réservé au super admin », nom de migration) ; les autres codes gardent le message commun ;
//   - copropriétés : actives d'abord, désactivées regroupées en bas, ordre du serveur conservé ;
//   - destinataires ajoutés : seulement dans les domaines de SON cabinet (contrôle avant l'envoi ; le serveur refait tout) ;
//     une adresse déjà présente (posée par le super admin) peut rester ;
//   - auteur d'un changement de statut sans nom : vous, un collègue, le cabinet.
// Données fictives (exemple.test).

import { describe, expect, it } from 'vitest'
import {
  TEXTES_ESPACE_CABINET_QR as E, adressesHorsDomaineQr, coproprietesGestionnaireOrdonneesQr, messageErreurGestionnaireQr, texteAuteurStatutQr,
} from '@/lib/aj-signalement/affichage-gestionnaire'
import { messageErreurTableauQr } from '@/lib/aj-signalement/affichage'
import { CODES_METIER_QR, CODES_REFUS_QR, type CodeErreurQr } from '@/lib/aj-signalement/api'
import { gestionCoproprieteQrVide, type CoproprieteQr } from '@/lib/aj-signalement/types'

const copro = (id: string, actif = true): CoproprieteQr => ({
  id, nom: `Résidence ${id}`, adresse: '1 rue Exemple', jeton: actif ? '0'.repeat(32) : '', emailsDestinataires: [], actif, creeLe: '2026-11-01T00:00:00Z',
  nbSignalements: 0, nbEnAttente: 0, derniereAdresseProposee: null, ...gestionCoproprieteQrVide(),
})

describe('messages d’échec du gestionnaire', () => {
  it('accès retiré, fonction pas encore activée, réseau : les textes de la SPEC § 2.8', () => {
    expect(messageErreurGestionnaireQr('acces_retire')).toBe('Votre accès a été retiré par le cabinet.')
    expect(messageErreurGestionnaireQr('base_absente')).toBe('Fonction pas encore activée.')
    expect(messageErreurGestionnaireQr('reseau')).toBe('Connexion impossible, réessayez.')
    expect(messageErreurGestionnaireQr('lecture_seule')).toBe(E.copropriete.lectureSeule)
  })

  it('aucun message ne parle du super admin ni d’une migration ; chaque code a un texte', () => {
    const codes: CodeErreurQr[] = [
      'invalide', 'introuvable', 'trop_de_demandes', 'non_authentifie', 'interdit', 'base_absente', 'serveur', 'reseau',
      ...CODES_METIER_QR, ...CODES_REFUS_QR,
    ]
    for (const code of codes) {
      const message = messageErreurGestionnaireQr(code)
      expect(message.length).toBeGreaterThan(5)
      expect(message).not.toMatch(/super admin|migration|SQL/i)
    }
  })

  it('les codes sans texte propre gardent le message commun', () => {
    expect(messageErreurGestionnaireQr('trop_de_demandes')).toBe(messageErreurTableauQr('trop_de_demandes'))
    expect(messageErreurGestionnaireQr('a_reverifier')).toBe(messageErreurTableauQr('a_reverifier'))
  })

  it('le super admin a aussi un message pour les nouveaux codes 403', () => {
    expect(messageErreurTableauQr('acces_retire').length).toBeGreaterThan(5)
    expect(messageErreurTableauQr('lecture_seule').length).toBeGreaterThan(5)
  })
})

describe('copropriétés du gestionnaire', () => {
  it('actives d’abord, désactivées regroupées en bas, ordre conservé dans chaque groupe', () => {
    const liste = [copro('a'), copro('b', false), copro('c'), copro('d', false)]
    expect(coproprietesGestionnaireOrdonneesQr(liste).map((c) => c.id)).toEqual(['a', 'c', 'b', 'd'])
    expect(liste.map((c) => c.id)).toEqual(['a', 'b', 'c', 'd'])
  })
})

describe('destinataires ajoutés par le gestionnaire', () => {
  it('une adresse AJOUTÉE hors des domaines de son cabinet est signalée (sous-domaine compris) ; une adresse déjà là peut rester', () => {
    expect(adressesHorsDomaineQr(['cs@exemple.test'], [], ['exemple.test'])).toEqual([])
    expect(adressesHorsDomaineQr(['cs@externe.test', 'x@sous.exemple.test'], [], ['exemple.test'])).toEqual(['cs@externe.test', 'x@sous.exemple.test'])
    expect(adressesHorsDomaineQr(['cs@externe.test'], ['CS@externe.test'], ['exemple.test'])).toEqual([])
  })

  it('sans domaine déclaré : toute adresse ajoutée est refusée', () => {
    expect(adressesHorsDomaineQr(['cs@exemple.test'], [], [])).toEqual(['cs@exemple.test'])
  })
})

describe('auteur d’un changement de statut (sans nom)', () => {
  it('vous, un collègue, le cabinet ; rien si le statut n’a jamais changé', () => {
    expect(texteAuteurStatutQr('vous')).toBe('Statut modifié par vous')
    expect(texteAuteurStatutQr('collegue')).toBe('Statut modifié par un collègue')
    expect(texteAuteurStatutQr('cabinet')).toBe('Statut modifié par le cabinet')
    expect(texteAuteurStatutQr(null)).toBeNull()
    expect(texteAuteurStatutQr(undefined)).toBeNull()
  })
})
