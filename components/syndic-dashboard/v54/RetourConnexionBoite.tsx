'use client'

import { useEffect, useRef } from 'react'
import { useToast } from '@/components/syndic-dashboard/v54/primitives/toast'
import { useV54Locale } from '@/lib/syndic/v54/i18n'

/** Paramètres d'URL posés par les retours OAuth de la boîte e-mail (app/api/email-agent/callback). */
export const PARAMS_RETOUR_BOITE = ['email_connected', 'email', 'email_provider', 'email_error', 'email_admin_consent'] as const

const NOMS_FOURNISSEURS_BOITE: Readonly<Record<string, string>> = { microsoft: 'Outlook / Microsoft 365', gmail: 'Gmail / Google Workspace' }

type Texte = { fr: string; pt: string }

const REFUS: Texte = { fr: 'Autorisation refusée : la boîte n’a pas été connectée.', pt: 'Autorização recusada: a caixa não foi ligada.' }

/** Erreurs de connexion les plus probables, expliquées (sinon le code court est affiché). */
const ERREURS_CONNEXION_BOITE: Readonly<Record<string, Texte>> = {
  admin_approval_required: {
    fr: 'L’administrateur Microsoft 365 du cabinet doit d’abord autoriser l’application Vitfix (consentement administrateur).',
    pt: 'O administrador Microsoft 365 do gabinete tem de autorizar primeiro a aplicação Vitfix (consentimento de administrador).',
  },
  consent_required: {
    fr: 'Autorisation Microsoft 365 manquante : l’administrateur du cabinet doit autoriser l’application Vitfix.',
    pt: 'Falta a autorização Microsoft 365: o administrador do gabinete tem de autorizar a aplicação Vitfix.',
  },
  consent_declined: REFUS,
  access_denied: REFUS,
  state_expired: { fr: 'Le lien de connexion a expiré : recommencez.', pt: 'O pedido de ligação expirou: tente novamente.' },
  csrf_failed: { fr: 'Connexion interrompue : recommencez depuis Vitfix.', pt: 'Ligação interrompida: recomece a partir do Vitfix.' },
}

function texte(t: Texte, fr: boolean): string {
  return fr ? t.fr : t.pt
}

/**
 * Retour de la connexion de la boîte (Google ou Microsoft, app/api/email-agent/callback) :
 * ?email_connected=true&email=…&email_provider=…, ?email_error=… ou ?email_admin_consent=true
 * → message, puis nettoyage de l'URL.
 */
export function RetourConnexionBoite() {
  const { push } = useToast()
  const locale = useV54Locale()
  const traite = useRef(false)
  useEffect(() => {
    if (traite.current) return
    traite.current = true
    const p = new URLSearchParams(window.location.search)
    const connecte = p.get('email_connected') === 'true'
    const erreur = p.get('email_error')
    const consentementAdmin = p.get('email_admin_consent') === 'true'
    if (!connecte && !erreur && !consentementAdmin) return
    const fr = locale === 'fr-FR'
    if (connecte) {
      const nom = NOMS_FOURNISSEURS_BOITE[p.get('email_provider') ?? '']
      const boite = (p.get('email') ?? '') + (nom ? ` (${nom})` : '')
      push({
        kind: 'success',
        title: texte({ fr: 'Boîte e-mail connectée', pt: 'Caixa de email ligada' }, fr),
        desc: boite + texte({ fr: ' — Alfredo analyse les derniers e-mails reçus.', pt: ' — o Alfredo analisa os últimos emails recebidos.' }, fr),
      })
    } else if (erreur) {
      const explication = Object.prototype.hasOwnProperty.call(ERREURS_CONNEXION_BOITE, erreur) ? ERREURS_CONNEXION_BOITE[erreur] : null
      push({
        kind: 'error',
        title: texte({ fr: 'Connexion de la boîte e-mail impossible', pt: 'Ligação da caixa de email impossível' }, fr),
        desc: explication ? texte(explication, fr) : erreur,
      })
    } else {
      push({
        kind: 'success',
        title: texte({ fr: 'Autorisation administrateur accordée', pt: 'Autorização de administrador concedida' }, fr),
        desc: texte({ fr: 'Connectez maintenant la boîte Outlook / Microsoft 365.', pt: 'Ligue agora a caixa Outlook / Microsoft 365.' }, fr),
      })
    }
    // Nettoyage différé : l'effet du parent (routeInitiale) lit encore ces paramètres
    // après celui-ci (les effets des enfants passent avant ceux du parent).
    for (const cle of PARAMS_RETOUR_BOITE) p.delete(cle)
    const reste = p.toString()
    window.setTimeout(() => {
      window.history.replaceState(null, '', window.location.pathname + (reste ? '?' + reste : '') + window.location.hash)
    }, 0)
  }, [push, locale])
  return null
}
