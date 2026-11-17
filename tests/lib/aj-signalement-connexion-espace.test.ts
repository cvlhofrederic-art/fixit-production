// tests/lib/aj-signalement-connexion-espace.test.ts
//
// Page de connexion professionnelle de l'espace « AJ Signalement » (demande de Hugo du 11/11/2026 : « il faut taper
// professionnel avec le mail et mot de passe ») : partie pure (lib/aj-signalement/connexion-espace.ts).
// - contexte de la page (nom affiché, adresse de l'espace par langue) : sérialisable ; l'espace d'un cabinet (PR 2)
//   passera le sien (la décision d'accès par cabinet viendra avec la PR 2) ;
// - validation de la saisie avant tout appel ; classement des erreurs de Supabase en trois messages qui ne disent
//   jamais si l'adresse existe ;
// - « Mot de passe oublié » dans la page : route existante POST /api/auth/reset-password, réponse classée en quatre cas ;
// - aucun texte ne parle de particulier, d'artisan, de Google ni du rôle requis.

import { describe, expect, it } from 'vitest'
import { AuthApiError, AuthRetryableFetchError, AuthUnknownError } from '@supabase/supabase-js'
import {
  CONTEXTE_CONNEXION_GLOBAL_QR, ROUTE_LIEN_MOT_DE_PASSE_QR, TEXTES_CONNEXION_QR, classerErreurConnexionQr,
  classerReponseLienMotDePasseQr, contexteConnexionCabinetQr, resumeErreurConnexionQr, titreOngletConnexionQr, validerEmailConnexionQr,
  validerSaisieConnexionQr,
} from '@/lib/aj-signalement/connexion-espace'

/** Tous les textes d'un objet, à plat. */
const textes = (valeur: unknown): string[] => {
  if (typeof valeur === 'string') return [valeur]
  if (valeur && typeof valeur === 'object') return Object.values(valeur).flatMap(textes)
  return []
}

describe('contexte de la page', () => {
  it('espace global : « AJ Signalement », arrivée sur /fr/aj-signalement/ ou /pt/aj-signalement/', () => {
    expect(CONTEXTE_CONNEXION_GLOBAL_QR).toEqual({ nom: 'AJ Signalement', espace: { fr: '/fr/aj-signalement/', pt: '/pt/aj-signalement/' } })
  })

  it('sérialisable (passé par la page serveur au composant client) : aucune fonction', () => {
    expect(JSON.parse(JSON.stringify(CONTEXTE_CONNEXION_GLOBAL_QR))).toEqual(CONTEXTE_CONNEXION_GLOBAL_QR)
  })

  it('espace global : aucun cabinet (la décision d’accès admet le super admin seul)', () => {
    expect(CONTEXTE_CONNEXION_GLOBAL_QR).not.toHaveProperty('cabinet')
  })

  it('page d’un cabinet (PR 2, lot 4) : nom du cabinet, espace /<identifiant>/suivi/ dans les deux langues, identifiant pour la décision', () => {
    const contexte = contexteConnexionCabinetQr({ identifiant: 'cabinet-exemple', nom: 'Cabinet Exemple' })
    expect(contexte).toEqual({
      nom: 'Cabinet Exemple', espace: { fr: '/cabinet-exemple/suivi/', pt: '/cabinet-exemple/suivi/' }, cabinet: { identifiant: 'cabinet-exemple' },
    })
    expect(JSON.parse(JSON.stringify(contexte))).toEqual(contexte)
  })

  it('titre d’onglet : « Connexion professionnelle — <nom> » (espace global inchangé)', () => {
    expect(titreOngletConnexionQr('Cabinet Exemple')).toBe('Connexion professionnelle — Cabinet Exemple')
    expect(TEXTES_CONNEXION_QR.titreOnglet).toBe('Connexion professionnelle — AJ Signalement')
  })
})

describe('« Mot de passe oublié » dans la page (relecture du 11/11/2026)', () => {
  it('route existante de VitFix, sans passer par la page commune /auth/reset-password/', () => {
    expect(ROUTE_LIEN_MOT_DE_PASSE_QR).toBe('/api/auth/reset-password')
  })

  it('réponse de la route : 2xx → envoyé (message neutre), 400 → adresse refusée, 429 → trop de demandes, reste → indisponible', () => {
    expect(classerReponseLienMotDePasseQr(200)).toBe('envoye')
    expect(classerReponseLienMotDePasseQr(204)).toBe('envoye')
    expect(classerReponseLienMotDePasseQr(400)).toBe('email')
    expect(classerReponseLienMotDePasseQr(429)).toBe('tentatives')
    for (const statut of [401, 403, 404, 413, 500, 502, 503]) expect(classerReponseLienMotDePasseQr(statut)).toBe('indisponible')
  })

  it('textes : message envoyé neutre (« Si un compte existe… »), retour vers la connexion professionnelle', () => {
    const T = TEXTES_CONNEXION_QR.oubli
    expect(T.titre).toBe('Mot de passe oublié')
    expect(T.envoye).toBe('Si un compte existe avec cette adresse, vous recevrez dans quelques minutes un lien pour choisir un nouveau mot de passe.')
    expect(T.retour).toBe('Retour à la connexion professionnelle')
    expect(T.erreurs).toEqual({
      tentatives: 'Trop de demandes. Réessayez dans quelques minutes.',
      indisponible: 'Envoi impossible pour le moment. Réessayez dans un instant.',
    })
  })

  it('validerEmailConnexionQr : mêmes règles et mêmes messages que la connexion', () => {
    expect(validerEmailConnexionQr('  gestion@exemple.test ')).toEqual({ ok: true, email: 'gestion@exemple.test' })
    expect(validerEmailConnexionQr('   ')).toEqual({ ok: false, erreur: 'Indiquez votre adresse e-mail.' })
    expect(validerEmailConnexionQr('gestion@exemple')).toEqual({ ok: false, erreur: 'Adresse e-mail invalide.' })
  })
})

describe('textes', () => {
  it('titre « Connexion professionnelle », titre d’onglet « Connexion professionnelle — AJ Signalement »', () => {
    expect(TEXTES_CONNEXION_QR.titre).toBe('Connexion professionnelle')
    expect(TEXTES_CONNEXION_QR.titreOnglet).toBe('Connexion professionnelle — AJ Signalement')
  })

  it('aucun texte ne parle de particulier, d’artisan, de Google ni du rôle requis', () => {
    const tous = textes(TEXTES_CONNEXION_QR).join(' ').toLowerCase()
    for (const mot of ['particulier', 'artisan', 'google', 'super', 'admin', 'syndic', 'copropriétaire']) {
      expect(tous).not.toContain(mot)
    }
  })

  it('compte sans accès : message neutre, le même que celui de l’espace', () => {
    expect(TEXTES_CONNEXION_QR.sansAcces).toBe('Cet espace n’est pas accessible avec votre compte.')
    expect(TEXTES_CONNEXION_QR.autreCompte).toBe('Connectez-vous avec un autre compte.')
  })
})

describe('validerSaisieConnexionQr', () => {
  it('saisie complète : e-mail rogné, mot de passe tel quel (jamais rogné)', () => {
    expect(validerSaisieConnexionQr('  gestion@exemple.test ', ' secret fictif ')).toEqual({
      ok: true, email: 'gestion@exemple.test', motDePasse: ' secret fictif ',
    })
  })

  it('rien de saisi : deux messages', () => {
    expect(validerSaisieConnexionQr('', '')).toEqual({
      ok: false, erreurs: { email: 'Indiquez votre adresse e-mail.', motDePasse: 'Indiquez votre mot de passe.' },
    })
  })

  it('espaces seuls dans l’e-mail : vide', () => {
    expect(validerSaisieConnexionQr('   ', 'x')).toEqual({ ok: false, erreurs: { email: 'Indiquez votre adresse e-mail.' } })
  })

  it.each(['gestion', 'gestion@', 'gestion@exemple', '@exemple.test', 'ges tion@exemple.test', 'gestion@exemple.t'])(
    'e-mail mal formé (« %s ») : « Adresse e-mail invalide. »',
    (email) => {
      expect(validerSaisieConnexionQr(email, 'x')).toEqual({ ok: false, erreurs: { email: 'Adresse e-mail invalide.' } })
    },
  )

  it('mot de passe vide seul : un message ; un mot de passe d’espaces n’est pas vide', () => {
    expect(validerSaisieConnexionQr('gestion@exemple.test', '')).toEqual({ ok: false, erreurs: { motDePasse: 'Indiquez votre mot de passe.' } })
    expect(validerSaisieConnexionQr('gestion@exemple.test', '   ').ok).toBe(true)
  })
})

describe('classerErreurConnexionQr : trois messages, rien sur l’existence du compte', () => {
  it('identifiants refusés (400 invalid_credentials, e-mail non confirmé, 422…) : « E-mail ou mot de passe incorrect. »', () => {
    expect(classerErreurConnexionQr(new AuthApiError('Invalid login credentials', 400, 'invalid_credentials'))).toBe('identifiants')
    expect(classerErreurConnexionQr(new AuthApiError('Email not confirmed', 400, 'email_not_confirmed'))).toBe('identifiants')
    expect(classerErreurConnexionQr(new AuthApiError('Unprocessable', 422, undefined))).toBe('identifiants')
    expect(TEXTES_CONNEXION_QR.erreurs.identifiants).toBe('E-mail ou mot de passe incorrect.')
  })

  it('429 : « Trop de tentatives. Réessayez dans quelques minutes. »', () => {
    expect(classerErreurConnexionQr(new AuthApiError('Request rate limit reached', 429, 'over_request_rate_limit'))).toBe('tentatives')
    expect(TEXTES_CONNEXION_QR.erreurs.tentatives).toBe('Trop de tentatives. Réessayez dans quelques minutes.')
  })

  it('serveur ou réseau (500, 503, AuthRetryableFetchError, exception) : « Connexion impossible pour le moment… »', () => {
    expect(classerErreurConnexionQr(new AuthApiError('Internal error', 500, 'unexpected_failure'))).toBe('indisponible')
    expect(classerErreurConnexionQr(new AuthRetryableFetchError('Service Unavailable', 503))).toBe('indisponible')
    expect(classerErreurConnexionQr(new AuthRetryableFetchError('Failed to fetch', 0))).toBe('indisponible')
    expect(classerErreurConnexionQr(new AuthUnknownError('JSON invalide', new SyntaxError('x')))).toBe('indisponible')
    expect(classerErreurConnexionQr(new TypeError('Failed to fetch'))).toBe('indisponible')
    expect(classerErreurConnexionQr('panne')).toBe('indisponible')
    expect(classerErreurConnexionQr(null)).toBe('indisponible')
    expect(TEXTES_CONNEXION_QR.erreurs.indisponible).toBe('Connexion impossible pour le moment. Réessayez dans un instant.')
  })

  it('journal : nom et statut seulement, jamais le message (ni e-mail ni mot de passe)', () => {
    const erreur = new AuthApiError('gestion@exemple.test mot-de-passe-fictif', 400, 'invalid_credentials')
    expect(resumeErreurConnexionQr(erreur)).toBe('AuthApiError 400')
    expect(resumeErreurConnexionQr(new TypeError('gestion@exemple.test'))).toBe('TypeError')
    expect(resumeErreurConnexionQr('gestion@exemple.test')).toBe('erreur inconnue')
  })
})
