/**
 * Fournisseur « Autre messagerie (IMAP) » : toute boîte accessible en IMAP sur le port 993
 * (OVH, Infomaniak, Gandi, Ionos, iCloud, Yahoo, serveur du cabinet…), lecture seule.
 *
 * Pas d'OAuth : le syndic saisit serveur, identifiant et mot de passe (d'application) dans
 * le tableau de bord ; POST /api/email-agent/connect-imap teste la connexion puis range la
 * ligne syndic_oauth_tokens avec provider 'imap', access_token = identifiants chiffrés
 * (AES-GCM, lib/email-agent/chiffrement.ts), refresh_token vide et token_expiry lointain
 * (jamais de rafraîchissement). Aucune migration de schéma.
 */

import { cleChiffrementManquante, dechiffrerIdentifiantsImap, type IdentifiantsImap } from '../chiffrement'
import { ErreurImap, releverBoiteImap } from '../imap/client'
import {
  ErreurFournisseur,
  LONGUEUR_CORPS,
  MAX_MESSAGES_RELEVE,
  debutFenetreReleve,
  type FournisseurBoite,
  type JetonsFournisseur,
  type MessageNormalise,
  type OptionsReleve,
} from './types'

/** Expiration rangée pour une boîte IMAP (colonne NOT NULL ; pas de jeton qui expire). */
export const EXPIRATION_IMAP = '2099-12-31T23:59:59.000Z'

function sansOAuth(): never {
  throw new ErreurFournisseur('non_oauth', 'Boîte IMAP : connexion par identifiants (/api/email-agent/connect-imap), sans OAuth')
}

export const fournisseurImap: FournisseurBoite = {
  id: 'imap',
  nom: 'Autre messagerie (IMAP)',
  sansRafraichissement: true,

  configurationManquante() {
    return cleChiffrementManquante() ? ['OAUTH_TOKENS_ENCRYPTION_KEY'] : []
  },

  urlAutorisation(): string {
    return sansOAuth()
  },

  async echangerCode(): Promise<JetonsFournisseur> {
    return sansOAuth()
  },

  async rafraichir(): Promise<JetonsFournisseur> {
    return sansOAuth()
  },

  async recupererMessages(accessToken: string, { premiereReleve }: OptionsReleve): Promise<MessageNormalise[]> {
    let identifiants: IdentifiantsImap
    try {
      identifiants = await dechiffrerIdentifiantsImap(accessToken)
    } catch (err) {
      // Clé OAUTH_TOKENS_ENCRYPTION_KEY changée ou valeur altérée : reconnecter la boîte.
      throw new ErreurFournisseur('identifiants_illisibles', 'Identifiants IMAP illisibles : reconnectez la boîte', {
        erreur: err instanceof Error ? err.message : String(err),
      })
    }
    try {
      return await releverBoiteImap(identifiants, {
        depuis: debutFenetreReleve(premiereReleve),
        max: MAX_MESSAGES_RELEVE,
        longueurCorps: LONGUEUR_CORPS,
      })
    } catch (err) {
      if (err instanceof ErreurImap) {
        // Détail du serveur (jamais le mot de passe) pour les journaux du poll.
        throw new ErreurFournisseur(err.code, err.message, { hote: identifiants.hote, detail: err.detail })
      }
      throw err
    }
  },
}
