// tests/lib/aj-signalement-gestionnaires.test.ts
//
// Fiches gestionnaires, règles pures de lib/aj-signalement/gestionnaires.ts :
//   - nomCourtQr : « Marie M. », nom donné par l'e-mail et la page de confirmation d'adresse (RG-02 : un mauvais
//     destinataire doit pouvoir se reconnaître) ; texte brut, échappé par le gabarit ;
//   - domaines du cabinet (Hugo, 10/11/2026 : une fiche n'est acceptée que sur un domaine de SON cabinet) : égalité
//     EXACTE après le « @ », sous-domaines refusés, comme la fonction SQL signalements_qr_inviter_gestionnaire ;
//     messageries publiques refusées comme domaine de cabinet ; format identique au CHECK de la migration ;
//   - etatGestionnaireQr : les 5 états de la PR 1 (confirmation envoyée, expirée à 7 jours, adresse confirmée,
//     contestée, fiche désactivée).
// Noms et adresses fictifs (exemple.test).

import { describe, expect, it } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
import {
  DOMAINES_PUBLICS_QR, DUREE_VALIDITE_ENVOI_QR_MS, FORMAT_DOMAINE_QR, LONGUEUR_MAX_DOMAINE_QR, boiteEmailQr, domaineDeEmailQr,
  emailCanoniqueQr, emailDansDomainesQr, etatGestionnaireQr, nomCourtQr, validerDomaineCabinetQr,
} from '@/lib/aj-signalement/gestionnaires'
import { echapperHtml } from '@/lib/aj-signalement/email'
import {
  ETATS_GESTIONNAIRE_QR, OBJETS_ENVOI_QR, REFUS_ENVOI_QR, type EnvoiGestionnaireQr, type FicheEtatGestionnaireQr,
} from '@/lib/aj-signalement/types'

const sql = readFileSync(join(process.cwd(), 'supabase/migrations/20261111_signalements_qr_gestionnaires.sql'), 'utf-8')

describe('nomCourtQr', () => {
  it('« Marie Martin » → « Marie M. »', () => {
    expect(nomCourtQr('Marie Martin')).toBe('Marie M.')
  })

  it('prénom ou nom composés : prénom entier, initiale du dernier mot', () => {
    expect(nomCourtQr('Jean-Pierre Martin')).toBe('Jean-Pierre M.')
    expect(nomCourtQr('Marie Martin-Durand')).toBe('Marie M.')
    expect(nomCourtQr('Marie de la Tour')).toBe('Marie T.')
    expect(nomCourtQr('Jean Pierre Martin')).toBe('Jean M.')
  })

  it('un seul mot : gardé tel quel ; espaces en trop retirés ; initiale en majuscule, accent compris', () => {
    expect(nomCourtQr('Marie')).toBe('Marie')
    expect(nomCourtQr('   Marie    Martin  ')).toBe('Marie M.')
    expect(nomCourtQr('marie élise')).toBe('marie É.')
    expect(nomCourtQr('Marie Élise'.normalize('NFD'))).toBe('Marie É.')
  })

  it('vide ou effacé (fiche pseudonymisée) : chaîne vide ; dernier mot sans lettre : prénom seul', () => {
    expect(nomCourtQr('')).toBe('')
    expect(nomCourtQr('   ')).toBe('')
    expect(nomCourtQr(null)).toBe('')
    expect(nomCourtQr('Marie (RH)')).toBe('Marie R.')
    expect(nomCourtQr('Marie 2')).toBe('Marie')
  })

  it('texte brut : un nom contenant « < » n’est pas interprété ici, il est échappé par le gabarit', () => {
    const court = nomCourtQr('<script>alert(1)</script> Martin')
    expect(court).toBe('<script>alert(1)</script> M.')
    expect(echapperHtml(court)).toBe('&lt;script&gt;alert(1)&lt;/script&gt; M.')
  })
})

describe('adresses et domaines', () => {
  it('emailCanoniqueQr : rognée, en minuscules ; null sans « @ » ou si ce n’est pas une chaîne', () => {
    expect(emailCanoniqueQr('  Marie.Martin@Exemple.TEST ')).toBe('marie.martin@exemple.test')
    expect(emailCanoniqueQr('pas-une-adresse')).toBeNull()
    expect(emailCanoniqueQr(undefined)).toBeNull()
    expect(emailCanoniqueQr(42)).toBeNull()
  })

  it('boiteEmailQr : adresse canonique sans l’étiquette « + » de la partie locale (même boîte de réception)', () => {
    expect(boiteEmailQr(' Marie.Exemple+Suivi@Exemple.TEST ')).toBe('marie.exemple@exemple.test')
    expect(boiteEmailQr('marie.exemple+a+b@exemple.test')).toBe('marie.exemple@exemple.test')
    expect(boiteEmailQr('marie.exemple@exemple.test')).toBe('marie.exemple@exemple.test')
    // Partie locale vide avant l'étiquette : rien à retirer (ce n'est pas une sous-adresse).
    expect(boiteEmailQr('+suivi@exemple.test')).toBe('+suivi@exemple.test')
    expect(boiteEmailQr('pas-une-adresse')).toBeNull()
    expect(boiteEmailQr(undefined)).toBeNull()
  })

  it('domaineDeEmailQr : partie après l’unique « @ », en minuscules ; null si zéro ou plusieurs « @ », ou partie vide', () => {
    expect(domaineDeEmailQr(' Marie@Cabinet-Exemple.TEST')).toBe('cabinet-exemple.test')
    expect(domaineDeEmailQr('marie@')).toBeNull()
    expect(domaineDeEmailQr('@cabinet-exemple.test')).toBeNull()
    expect(domaineDeEmailQr('marie')).toBeNull()
    expect(domaineDeEmailQr('a@b.test@cabinet-exemple.test')).toBeNull()
  })

  it('emailDansDomainesQr : égalité exacte du domaine ; sous-domaine et domaine voisin refusés ; liste vide → faux', () => {
    const domaines = ['cabinet-exemple.test', ' Autre-Exemple.test ']
    expect(emailDansDomainesQr('marie.martin@cabinet-exemple.test', domaines)).toBe(true)
    expect(emailDansDomainesQr('MARIE@CABINET-EXEMPLE.TEST', domaines)).toBe(true)
    expect(emailDansDomainesQr('paul@autre-exemple.test', domaines)).toBe(true)
    expect(emailDansDomainesQr('marie@paris.cabinet-exemple.test', domaines)).toBe(false)
    expect(emailDansDomainesQr('marie@cabinet-exemple.test.exemple.test', domaines)).toBe(false)
    expect(emailDansDomainesQr('marie@cabinetexemple.test', domaines)).toBe(false)
    expect(emailDansDomainesQr('marie@cabinet-exemple.test', [])).toBe(false)
    expect(emailDansDomainesQr('pas-une-adresse', domaines)).toBe(false)
  })

  it('même règle que la fonction SQL : split_part(email, \'@\', 2) comparé par égalité aux domaines de SON cabinet', () => {
    expect(sql).toMatch(/WHERE d\.cabinet_id = v_cab AND d\.domaine = split_part\(v_email, '@', 2\)/)
  })

  it('validerDomaineCabinetQr : format du CHECK de la migration, 253 caractères au plus', () => {
    for (const d of ['cabinet-exemple.test', 'a.b', 'paris.cabinet-exemple.test', 'x1.exemple.test']) expect(validerDomaineCabinetQr(d), d).toEqual({ ok: true })
    for (const d of ['exemple', '-exemple.test', 'exemple-.test', 'exemple..test', '.exemple.test', 'Exemple.test', 'exe_mple.test', 'exemple.test.', '', `${'a'.repeat(250)}.test`]) {
      expect(validerDomaineCabinetQr(d), d).toEqual({ ok: false, raison: 'format' })
    }
    const check = /domaine ~ '([^']+)'\)/.exec(sql)
    expect(FORMAT_DOMAINE_QR.source.replaceAll('(?:', '(')).toBe(check?.[1])
    expect(LONGUEUR_MAX_DOMAINE_QR).toBe(253)
    expect(sql).toMatch(/domaine = lower\(domaine\) AND char_length\(domaine\) <= 253/)
  })

  it('validerDomaineCabinetQr : messageries publiques refusées comme domaine d’un cabinet', () => {
    for (const d of ['gmail.com', 'outlook.fr', 'hotmail.com', 'yahoo.fr', 'orange.fr', 'free.fr', 'laposte.net', 'icloud.com']) {
      expect(validerDomaineCabinetQr(d), d).toEqual({ ok: false, raison: 'public' })
    }
    expect(new Set(DOMAINES_PUBLICS_QR).size).toBe(DOMAINES_PUBLICS_QR.length)
    for (const d of DOMAINES_PUBLICS_QR) expect(FORMAT_DOMAINE_QR.test(d), d).toBe(true)
  })
})

describe('etatGestionnaireQr', () => {
  const MAINTENANT = new Date('2026-11-10T12:00:00.000Z')
  const JOUR = 86_400_000
  const ilYa = (ms: number) => new Date(MAINTENANT.getTime() - ms).toISOString()
  const fiche = (champs: Partial<FicheEtatGestionnaireQr> = {}): FicheEtatGestionnaireQr => ({
    actif: true, adresseConfirmeeLe: null, adresseContesteeLe: null, ...champs,
  })
  const envoi = (champs: Partial<EnvoiGestionnaireQr> = {}): EnvoiGestionnaireQr => ({
    objet: 'confirmation_adresse', creeLe: ilYa(JOUR), envoyeLe: ilYa(JOUR), accepteLe: null, refus: null, ...champs,
  })

  it('7 jours de validité, comme lib/equipe et la fonction SQL', () => {
    expect(DUREE_VALIDITE_ENVOI_QR_MS).toBe(7 * JOUR)
    expect(sql).toMatch(/i\.created_at > now\(\) - interval '7 days'/)
  })

  it('confirmation envoyée il y a moins de 7 jours, en attente : « confirmation_envoyee »', () => {
    expect(etatGestionnaireQr(fiche(), [envoi()], MAINTENANT)).toBe('confirmation_envoyee')
    expect(etatGestionnaireQr(fiche(), [envoi({ creeLe: ilYa(7 * JOUR - 1) })], MAINTENANT)).toBe('confirmation_envoyee')
  })

  it('7 jours écoulés (pile ou plus) : « confirmation_expiree »', () => {
    expect(etatGestionnaireQr(fiche(), [envoi({ creeLe: ilYa(7 * JOUR) })], MAINTENANT)).toBe('confirmation_expiree')
    expect(etatGestionnaireQr(fiche(), [envoi({ creeLe: ilYa(30 * JOUR) })], MAINTENANT)).toBe('confirmation_expiree')
  })

  it('le dernier envoi fait foi (un renvoi rend les précédents caducs), quel que soit l’ordre reçu', () => {
    const ancien = envoi({ creeLe: ilYa(20 * JOUR) })
    const recent = envoi({ creeLe: ilYa(2 * JOUR) })
    expect(etatGestionnaireQr(fiche(), [recent, ancien], MAINTENANT)).toBe('confirmation_envoyee')
    expect(etatGestionnaireQr(fiche(), [ancien, recent], MAINTENANT)).toBe('confirmation_envoyee')
  })

  it('e-mail jamais parti, ou aucun envoi : lien inutilisable, « confirmation_expiree » (à renvoyer)', () => {
    expect(etatGestionnaireQr(fiche(), [envoi({ envoyeLe: null })], MAINTENANT)).toBe('confirmation_expiree')
    expect(etatGestionnaireQr(fiche(), [], MAINTENANT)).toBe('confirmation_expiree')
    expect(etatGestionnaireQr(fiche(), [envoi({ creeLe: 'pas une date' })], MAINTENANT)).toBe('confirmation_expiree')
  })

  it('adresse confirmée : « adresse_confirmee », même si l’envoi a plus de 7 jours', () => {
    expect(etatGestionnaireQr(fiche({ adresseConfirmeeLe: ilYa(10 * JOUR) }), [envoi({ creeLe: ilYa(11 * JOUR), accepteLe: ilYa(10 * JOUR) })], MAINTENANT)).toBe('adresse_confirmee')
    expect(etatGestionnaireQr(fiche(), [envoi({ accepteLe: ilYa(1000) })], MAINTENANT)).toBe('adresse_confirmee')
  })

  it('« Ce n’est pas moi » : « adresse_contestee », avant la confirmation', () => {
    expect(etatGestionnaireQr(fiche({ adresseContesteeLe: ilYa(1000) }), [envoi({ refus: 'pas_moi' })], MAINTENANT)).toBe('adresse_contestee')
    expect(etatGestionnaireQr(fiche(), [envoi({ refus: 'pas_moi' })], MAINTENANT)).toBe('adresse_contestee')
    expect(etatGestionnaireQr(fiche({ adresseContesteeLe: ilYa(1000), adresseConfirmeeLe: ilYa(5000) }), [], MAINTENANT)).toBe('adresse_contestee')
  })

  it('fiche désactivée (départ, ou effacée) : « desactive », avant tout le reste', () => {
    expect(etatGestionnaireQr(fiche({ actif: false, adresseConfirmeeLe: ilYa(JOUR), adresseContesteeLe: ilYa(JOUR) }), [envoi()], MAINTENANT)).toBe('desactive')
  })

  it('les envois « acces » (PR 2) ne comptent pas pour la confirmation d’adresse', () => {
    expect(etatGestionnaireQr(fiche(), [envoi({ objet: 'acces', creeLe: ilYa(1000) }), envoi({ creeLe: ilYa(20 * JOUR) })], MAINTENANT)).toBe('confirmation_expiree')
  })

  it('états rendus : les 5 de la PR 1, tous dans ETATS_GESTIONNAIRE_QR', () => {
    const pr1 = ['confirmation_envoyee', 'confirmation_expiree', 'adresse_confirmee', 'adresse_contestee', 'desactive']
    expect(ETATS_GESTIONNAIRE_QR.slice(0, 5)).toEqual(pr1)
  })

  it('objets et refus d’un envoi : listes égales aux CHECK de signalements_qr_invitations', () => {
    expect([...OBJETS_ENVOI_QR]).toEqual(['confirmation_adresse', 'acces'])
    expect(sql).toMatch(/CHECK \(objet IN \('confirmation_adresse', 'acces'\)\)/)
    expect([...REFUS_ENVOI_QR]).toEqual(['compte_autre_espace', 'pas_moi'])
    expect(sql).toMatch(/CHECK \(refus IS NULL OR refus IN \('compte_autre_espace', 'pas_moi'\)\)/)
  })
})

// ── PR 2, lot 5 : états d'accès d'une fiche (migration 20261112) ─────────────────────────────────────────────────
// Les 4 états réservés à la PR 2 ne sont calculés que si la fiche porte ses champs d'accès (lus à part par le serveur,
// absents tant que la 20261112 manque : l'état est alors exactement celui de la PR 1). Désactivée et contestée restent
// en tête ; puis la demande d'effacement (fiche encore active) ; l'accès ouvert (compte relié) ; enfin le dernier envoi
// « acces » : refusé pour un compte d'un autre espace, ou parti il y a moins de 7 jours et en attente. Un envoi
// expiré, jamais parti ou accepté sans liaison rend l'état de la PR 1 (accès à renvoyer).
describe('etatGestionnaireQr : états de l’accès (PR 2)', () => {
  const MAINTENANT = new Date('2026-11-10T12:00:00.000Z')
  const JOUR = 86_400_000
  const ilYa = (ms: number) => new Date(MAINTENANT.getTime() - ms).toISOString()
  const SANS_ACCES = { accesOuvertLe: null, compteRelie: false, effacementDemandeLe: null }
  const fiche = (champs: Partial<FicheEtatGestionnaireQr> = {}): FicheEtatGestionnaireQr => ({
    actif: true, adresseConfirmeeLe: ilYa(5 * JOUR), adresseContesteeLe: null, acces: { ...SANS_ACCES }, ...champs,
  })
  const acces = (champs: Partial<EnvoiGestionnaireQr> = {}): EnvoiGestionnaireQr => ({
    objet: 'acces', creeLe: ilYa(JOUR), envoyeLe: ilYa(JOUR), accepteLe: null, refus: null, ...champs,
  })

  it('sans champs d’accès (migration 20261112 absente) : l’état de la PR 1, même avec un envoi « acces »', () => {
    expect(etatGestionnaireQr(fiche({ acces: undefined }), [acces()], MAINTENANT)).toBe('adresse_confirmee')
  })

  it('accès envoyé il y a moins de 7 jours, en attente : « acces_envoye » (adresse confirmée ou non)', () => {
    expect(etatGestionnaireQr(fiche(), [acces()], MAINTENANT)).toBe('acces_envoye')
    expect(etatGestionnaireQr(fiche({ adresseConfirmeeLe: null }), [acces()], MAINTENANT)).toBe('acces_envoye')
  })

  it('accès expiré, jamais parti ou accepté sans liaison : l’état de la PR 1 (à renvoyer)', () => {
    expect(etatGestionnaireQr(fiche(), [acces({ creeLe: ilYa(8 * JOUR) })], MAINTENANT)).toBe('adresse_confirmee')
    expect(etatGestionnaireQr(fiche(), [acces({ envoyeLe: null })], MAINTENANT)).toBe('adresse_confirmee')
    expect(etatGestionnaireQr(fiche(), [acces({ accepteLe: ilYa(1000) })], MAINTENANT)).toBe('adresse_confirmee')
  })

  it('le DERNIER envoi « acces » fait foi : un nouvel envoi après un refus « autre espace » est « acces_envoye »', () => {
    const refuse = acces({ creeLe: ilYa(3 * JOUR), refus: 'compte_autre_espace' })
    expect(etatGestionnaireQr(fiche(), [refuse], MAINTENANT)).toBe('refus_autre_espace')
    expect(etatGestionnaireQr(fiche(), [refuse, acces({ creeLe: ilYa(1000) })], MAINTENANT)).toBe('acces_envoye')
    expect(etatGestionnaireQr(fiche(), [acces({ creeLe: ilYa(1000) }), refuse], MAINTENANT)).toBe('acces_envoye')
  })

  it('compte relié et accès ouvert : « acces_ouvert », quels que soient les envois', () => {
    const ouvert = { accesOuvertLe: ilYa(2 * JOUR), compteRelie: true, effacementDemandeLe: null }
    expect(etatGestionnaireQr(fiche({ acces: ouvert }), [acces({ accepteLe: ilYa(2 * JOUR) })], MAINTENANT)).toBe('acces_ouvert')
    expect(etatGestionnaireQr(fiche({ acces: ouvert }), [], MAINTENANT)).toBe('acces_ouvert')
    // Compte effacé (FK ON DELETE SET NULL) : plus d'accès ouvert.
    expect(etatGestionnaireQr(fiche({ acces: { ...ouvert, compteRelie: false } }), [], MAINTENANT)).toBe('adresse_confirmee')
  })

  it('demande d’effacement d’une fiche active : « effacement_demande », avant l’accès ouvert', () => {
    const demande = { accesOuvertLe: ilYa(2 * JOUR), compteRelie: true, effacementDemandeLe: ilYa(1000) }
    expect(etatGestionnaireQr(fiche({ acces: demande }), [], MAINTENANT)).toBe('effacement_demande')
  })

  it('désactivée puis contestée restent en tête (départ : les boutons Réactiver et Effacer restent servis)', () => {
    const demande = { accesOuvertLe: ilYa(2 * JOUR), compteRelie: true, effacementDemandeLe: ilYa(1000) }
    expect(etatGestionnaireQr(fiche({ actif: false, acces: demande }), [acces()], MAINTENANT)).toBe('desactive')
    expect(etatGestionnaireQr(fiche({ adresseContesteeLe: ilYa(1000), acces: demande }), [acces()], MAINTENANT)).toBe('adresse_contestee')
    expect(etatGestionnaireQr(fiche(), [acces({ refus: 'pas_moi' })], MAINTENANT)).toBe('adresse_contestee')
  })

  it('tous les états rendus sont dans ETATS_GESTIONNAIRE_QR', () => {
    expect(ETATS_GESTIONNAIRE_QR.slice(5)).toEqual(['acces_envoye', 'acces_ouvert', 'refus_autre_espace', 'effacement_demande'])
  })
})
