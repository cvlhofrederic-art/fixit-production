// @vitest-environment node
// tests/lib/vitfixsignal-ancien-nom.test.ts
//
// Compatibilité avec l'ancien nom du produit (décision du 26/11/2026 : « Vitfix Signal », lib/vitfixsignal/ancien-nom.ts).
// Tout ce qui existait en production sous l'ancien nom reste ACCEPTÉ en lecture ; rien n'est plus écrit sous lui :
//   A. anciennes adresses des pages → nouvelle adresse (la redirection 308 elle-même : tests/securite/
//      acces-middleware-vitfixsignal.test.ts) ; l'ancien segment et le nouveau nom restent des identifiants réservés ;
//   B. ancienne adresse « un clic » (RFC 8058) : exemptée du contrôle d'Origin, jeton effacé chez Sentry (les
//      réécritures d'API : tests/next-config-routage-opennext.test.ts) ;
//   C. liens de désinscription signés avant le renommage : toujours vérifiés (VECTEURS FIGÉS, produits par le code
//      d'avant), un lien falsifié toujours refusé ; les nouveaux liens sont signés sous le nouveau contexte ;
//   D. invitations signées sous l'ancien nom d'espace : toujours vérifiées (vecteur figé), jamais pour un autre espace ;
//   E. repère de routage : nouvelle clé lue d'abord, ancienne clé à défaut ; seule la nouvelle est écrite ;
//   F. secrets : nouveau nom lu d'abord, ancien nom en repli, en un seul endroit (lib/vitfixsignal/variables.ts) ;
//   G. étiquettes des e-mails déjà envoyés : tests/api/webhook-resend.test.ts.
// Dernier bloc : GARDE — l'ancien nom n'est écrit nulle part hors de la liste des fichiers de compatibilité.
// Secrets et identifiants de ces tests : valeurs fictives.

import { createHmac, hkdfSync } from 'node:crypto'
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative, sep } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  ANCIEN_CHEMIN_CRON_REPRISE_QR, ANCIEN_ESPACE_INVITATION_QR, ANCIEN_PREFIXE_API_QR, ANCIEN_SEGMENT_ESPACE_QR,
  ANCIENNE_CLE_REPERE_CABINET_QR, ANCIENNE_INFO_HKDF_LIENS_QR, ANCIENS_IDENTIFIANTS_RESERVES_QR,
  ANCIENS_NOMS_VARIABLES_QR, ANCIENS_USAGES_SIGNES_QR, redirectionAncienneAdresseQr,
} from '@/lib/vitfixsignal/ancien-nom'
import {
  CLE_REPERE_CABINET_QR, SEGMENT_ESPACE_QR, aiguillageGestionnaireQr, connexionApresMotDePasseQr, decisionAccesEspaceQr,
  destinationConnexionEspaceQr, redirectionEspaceCabinetQr, repereCabinetQr,
} from '@/lib/vitfixsignal/acces-espace'
import {
  IDENTIFIANTS_RESERVES_QR, PREFIXES_RESERVES_QR, cheminEspaceCabinetQr, cheminPublicCabinetQr, validerIdentifiantCabinetQr,
} from '@/lib/vitfixsignal/chemin-cabinet'
import { estPostUnClicDesinscriptionQr } from '@/lib/vitfixsignal/chemin-desinscription'
import {
  cleLiensDiffusionConfigureeQr, signerLiensDiffusionQr, urlUnClicDesinscriptionQr, verifierJetonDiffusionQr,
} from '@/lib/vitfixsignal/diffusion-lien'
import { effacerJetonsUnClicQr, effacerJetonsUnClicSentryQr } from '@/lib/vitfixsignal/sentry-desinscription'
import { VARIABLES_VITFIXSIGNAL_QR, lireVariableQr } from '@/lib/vitfixsignal/variables'
import { jetonDuLien, lireJetonDuLien, signatureValide, type InvitationSignee } from '@/lib/equipe/lien-invitation'
import { signatureAncienEspace } from '../helpers/lien-invitation-ancien-espace'

// ── A. Adresses des pages ────────────────────────────────────────────────────

describe('A. anciennes adresses des pages : nouvelle adresse, même langue, même suite', () => {
  it.each([
    ['/fr/aj-signalement/', '/fr/vitfixsignal/'],
    ['/fr/aj-signalement', '/fr/vitfixsignal'],
    ['/fr/aj-signalement/connexion/', '/fr/vitfixsignal/connexion/'],
    ['/pt/aj-signalement/', '/pt/vitfixsignal/'],
    ['/pt/aj-signalement/connexion', '/pt/vitfixsignal/connexion'],
    ['/en/aj-signalement/', '/en/vitfixsignal/'],
    ['/nl/aj-signalement/connexion/', '/nl/vitfixsignal/connexion/'],
    ['/es/aj-signalement/', '/es/vitfixsignal/'],
    ['/aj-signalement/', '/vitfixsignal/'],
    ['/aj-signalement', '/vitfixsignal'],
    ['/aj-signalement/connexion/', '/vitfixsignal/connexion/'],
    ['/fr/aj-signalement/une/sous-page/', '/fr/vitfixsignal/une/sous-page/'],
  ])('%s → %s', (ancienne, nouvelle) => {
    expect(redirectionAncienneAdresseQr(ancienne)).toBe(nouvelle)
  })

  it.each([
    '/fr/vitfixsignal/', '/vitfixsignal/connexion/', '/fr/', '/', '',
    // Segment voisin, autre casse, segment plus loin dans le chemin : jamais.
    '/fr/aj-signalements/', '/fr/aj-signalement-x/', '/fr/AJ-SIGNALEMENT/', '/fr/blog/aj-signalement/', '/de/aj-signalement/',
    '/fr/fr/aj-signalement/',
    // Routes d'API (réécrites, jamais redirigées : le POST « un clic » ne suit pas les redirections).
    '/api/aj-signalement/tableau', '/api/aj-signalement/desinscription/un-clic/abc', '/api/cron/aj-diffusion-reprise',
    // Pages publiques ouvertes par un QR code affiché dans un immeuble : leur adresse ne change pas.
    '/cabinet-exemple/signalement/0123456789abcdef0123456789abcdef/', '/fr/signalement/0123456789abcdef0123456789abcdef/',
    '/cabinet-exemple/desinscription/', '/cabinet-exemple/suivi/',
  ])('%s : aucune redirection', (chemin) => {
    expect(redirectionAncienneAdresseQr(chemin)).toBeNull()
  })

  it('la destination n’est jamais elle-même redirigée (aucune boucle)', () => {
    for (const chemin of ['/fr/aj-signalement/', '/aj-signalement/connexion/', '/en/aj-signalement']) {
      expect(redirectionAncienneAdresseQr(redirectionAncienneAdresseQr(chemin) as string)).toBeNull()
    }
  })

  it('les constantes du module sont celles d’avant le renommage', () => {
    expect(ANCIEN_SEGMENT_ESPACE_QR).toBe('/aj-signalement')
    expect(ANCIEN_PREFIXE_API_QR).toBe('/api/aj-signalement')
    expect(ANCIEN_CHEMIN_CRON_REPRISE_QR).toBe('/api/cron/aj-diffusion-reprise')
    expect(ANCIENS_IDENTIFIANTS_RESERVES_QR).toEqual(['aj-signalement'])
  })

  it('la destination est le segment actuel de l’espace (celui de acces-espace.ts)', () => {
    expect(redirectionAncienneAdresseQr(ANCIEN_SEGMENT_ESPACE_QR)).toBe(SEGMENT_ESPACE_QR)
    expect(redirectionAncienneAdresseQr(`/fr${ANCIEN_SEGMENT_ESPACE_QR}/`)).toBe(`/fr${SEGMENT_ESPACE_QR}/`)
  })
})

describe('A. identifiants de cabinet : l’ancien segment reste réservé, le nouveau nom l’est aussi', () => {
  it.each(['aj-signalement', 'vitfixsignal', 'vitfix-signal'])('« %s » est refusé à la saisie (réservé)', (identifiant) => {
    expect(IDENTIFIANTS_RESERVES_QR).toContain(identifiant)
    expect(validerIdentifiantCabinetQr(identifiant)).toEqual({ ok: false, raison: 'reserve' })
  })

  it.each(['aj-signalement-paris', 'aj-signalements', 'vitfixsignal-paris', 'vitfixsignals'])(
    '« %s » (nom qui prolonge un nom réservé) est refusé', (identifiant) => {
      expect(validerIdentifiantCabinetQr(identifiant)).toEqual({ ok: false, raison: 'reserve' })
    })

  it('l’ancien segment et le nouveau sont des préfixes réservés (comme l’ancien l’était avant le renommage)', () => {
    for (const prefixe of ['aj-signalement', 'vitfixsignal']) expect(PREFIXES_RESERVES_QR).toContain(prefixe)
  })

  it('un identifiant ordinaire reste admis', () => {
    expect(validerIdentifiantCabinetQr('cabinet-exemple')).toEqual({ ok: true })
  })

  it.each(['/aj-signalement/', '/aj-signalement/connexion/', '/aj-signalement/suivi/', '/vitfix-signal/connexion/', '/vitfixsignal/connexion/'])(
    '%s n’est jamais pris pour l’espace d’un cabinet', (chemin) => {
      expect(cheminEspaceCabinetQr(chemin)).toBeNull()
    })

  it('le motif FIGÉ des pages publiques n’a pas changé (les QR codes déjà affichés restent valables)', () => {
    expect(cheminPublicCabinetQr('/cabinet-exemple/signalement/0123456789abcdef0123456789abcdef/'))
      .toEqual({ page: 'signalement', identifiant: 'cabinet-exemple', jeton: '0123456789abcdef0123456789abcdef' })
  })
})

// ── B. Adresse « un clic » d'avant ───────────────────────────────────────────

const JETON_QUELCONQUE = `${'ab'.repeat(16)}.${'cd'.repeat(32)}`

describe('B. ancienne adresse « un clic » (en-tête List-Unsubscribe des messages déjà envoyés)', () => {
  it('POST sur l’ancienne et sur la nouvelle adresse : exempté du contrôle d’Origin, barre finale facultative', () => {
    for (const prefixe of ['/api/aj-signalement', '/api/vitfixsignal']) {
      expect(estPostUnClicDesinscriptionQr('POST', `${prefixe}/desinscription/un-clic/${JETON_QUELCONQUE}`), prefixe).toBe(true)
      expect(estPostUnClicDesinscriptionQr('POST', `${prefixe}/desinscription/un-clic/${JETON_QUELCONQUE}/`), prefixe).toBe(true)
    }
  })

  it.each([
    ['GET', `/api/aj-signalement/desinscription/un-clic/${JETON_QUELCONQUE}`],
    ['POST', '/api/aj-signalement/desinscription/un-clic/pas-un-jeton'],
    ['POST', `/api/aj-signalement/desinscription/un-clic/${JETON_QUELCONQUE}/suite`],
    ['POST', '/api/aj-signalement/desinscription'],
    ['POST', '/api/aj-signalement/coproprietes'],
    ['POST', `/api/aj-signalements/desinscription/un-clic/${JETON_QUELCONQUE}`],
    ['POST', `/api/AJ-SIGNALEMENT/desinscription/un-clic/${JETON_QUELCONQUE}`],
    ['DELETE', `/api/aj-signalement/desinscription/un-clic/${JETON_QUELCONQUE}`],
  ])('%s %s : aucune exemption', (methode, chemin) => {
    expect(estPostUnClicDesinscriptionQr(methode, chemin)).toBe(false)
  })

  it('Sentry : le jeton de l’ancienne adresse un clic est effacé comme celui de la nouvelle', () => {
    for (const prefixe of ['/api/aj-signalement', '/api/vitfixsignal']) {
      const adresse = `https://vitfix.io${prefixe}/desinscription/un-clic/${JETON_QUELCONQUE}`
      expect(effacerJetonsUnClicQr(`POST ${adresse} 503`)).toBe(`POST https://vitfix.io${prefixe}/desinscription/un-clic/[jeton] 503`)
      const evenement = effacerJetonsUnClicSentryQr({ request: { url: adresse }, transaction: `POST ${prefixe}/desinscription/un-clic/${JETON_QUELCONQUE}` })
      expect(JSON.stringify(evenement)).not.toContain(JETON_QUELCONQUE)
    }
  })

  it('les nouveaux messages portent la nouvelle adresse un clic', () => {
    expect(urlUnClicDesinscriptionQr(JETON_QUELCONQUE)).toBe(`https://vitfix.io/api/vitfixsignal/desinscription/un-clic/${JETON_QUELCONQUE}`)
  })
})

// ── C. Liens de désinscription signés ────────────────────────────────────────

// VECTEURS FIGÉS : jetons produits le 26/11/2026 par le code d'AVANT le renommage (signerLiensDiffusionQr de la
// révision 48f91b9b), pour ce secret et ce destinataire fictifs. Ils ne se recalculent pas ici : si l'un d'eux cessait
// d'être vérifié, le lien de désinscription d'un message déjà envoyé cesserait de marcher.
const CLE_D_AVANT = 'cle-de-test-fictive-0123456789-abcdefghij'
const DESTINATAIRE = '3f2b8c1d-4e5a-4b6c-8d7e-9f0a1b2c3d4e'
const JETON_PAGE_D_AVANT = '3f2b8c1d4e5a4b6c8d7e9f0a1b2c3d4e.ce0281d7bd5af1fbfeae6d3f3d87f4f695f649bfd80d14d1823135226cd58509'
const JETON_UN_CLIC_D_AVANT = '3f2b8c1d4e5a4b6c8d7e9f0a1b2c3d4e.6c2be59116840b694757b746d84ad5c6cc245b5b532a8be6af3aa1474282fede'
const AUTRE_CLE = 'autre-cle-de-test-fictive-pour-la-rotation-98765'
const ENV = { VITFIXSIGNAL_CLE_LIENS_DIFFUSION: CLE_D_AVANT }

/** Signature calculée par node:crypto (oracle indépendant de crypto.subtle), pour un contexte et un usage donnés. */
function signatureOracle(secret: string, info: string, usage: string, id: string): string {
  const cle = Buffer.from(hkdfSync('sha256', secret, 'vitfix', info, 32))
  return createHmac('sha256', cle).update(JSON.stringify(['v1', usage, id])).digest('hex')
}

/** Remplace le caractère d'indice i (hexadécimal) par un autre. */
const alterer = (jeton: string, i: number): string => `${jeton.slice(0, i)}${jeton[i] === '0' ? '1' : '0'}${jeton.slice(i + 1)}`

describe('C. liens de désinscription signés avant le renommage', () => {
  it('les vecteurs figés sont bien ceux de l’ancien contexte et des anciens usages (oracle node:crypto)', () => {
    const hex = DESTINATAIRE.replaceAll('-', '')
    expect(JETON_PAGE_D_AVANT).toBe(`${hex}.${signatureOracle(CLE_D_AVANT, 'aj-signalement-desinscription-v1', 'aj-diffusion-page', DESTINATAIRE)}`)
    expect(JETON_UN_CLIC_D_AVANT).toBe(`${hex}.${signatureOracle(CLE_D_AVANT, 'aj-signalement-desinscription-v1', 'aj-diffusion-un-clic', DESTINATAIRE)}`)
    expect(ANCIENNE_INFO_HKDF_LIENS_QR).toBe('aj-signalement-desinscription-v1')
    expect(ANCIENS_USAGES_SIGNES_QR).toEqual({ page: 'aj-diffusion-page', un_clic: 'aj-diffusion-un-clic' })
  })

  it('le lien un clic d’un message déjà envoyé reste valable (clé courante)', async () => {
    expect(await verifierJetonDiffusionQr(JETON_UN_CLIC_D_AVANT, ['un_clic'], ENV))
      .toEqual({ statut: 'signe', destinataireId: DESTINATAIRE, usage: 'un_clic', cle: 'courante' })
  })

  it('le lien de la page d’un message déjà envoyé reste valable (clé courante)', async () => {
    expect(await verifierJetonDiffusionQr(JETON_PAGE_D_AVANT, ['page', 'un_clic'], ENV))
      .toEqual({ statut: 'signe', destinataireId: DESTINATAIRE, usage: 'page', cle: 'courante' })
  })

  it('un jeton d’un usage ne vaut toujours rien pour l’autre', async () => {
    expect(await verifierJetonDiffusionQr(JETON_PAGE_D_AVANT, ['un_clic'], ENV)).toEqual({ statut: 'inconnu' })
    expect(await verifierJetonDiffusionQr(JETON_UN_CLIC_D_AVANT, ['page'], ENV)).toEqual({ statut: 'inconnu' })
  })

  it('un jeton falsifié reste refusé (signature ou identifiant altéré d’un seul caractère)', async () => {
    for (const jeton of [JETON_PAGE_D_AVANT, JETON_UN_CLIC_D_AVANT]) {
      for (const i of [0, 31, 33, 60, 96]) {
        expect(await verifierJetonDiffusionQr(alterer(jeton, i), ['page', 'un_clic'], ENV), `${jeton} [${i}]`).toEqual({ statut: 'inconnu' })
      }
    }
  })

  it('signé à l’ancienne par une AUTRE clé : refusé', async () => {
    const etranger = `${DESTINATAIRE.replaceAll('-', '')}.${signatureOracle(AUTRE_CLE, 'aj-signalement-desinscription-v1', 'aj-diffusion-un-clic', DESTINATAIRE)}`
    expect(await verifierJetonDiffusionQr(etranger, ['un_clic'], ENV)).toEqual({ statut: 'inconnu' })
  })

  it('rotation gardée : signé à l’ancienne par la clé PRÉCÉDENTE → « precedente » (lien expiré, repli par l’adresse)', async () => {
    const env = { VITFIXSIGNAL_CLE_LIENS_DIFFUSION: AUTRE_CLE, VITFIXSIGNAL_CLE_LIENS_DIFFUSION_PRECEDENTE: CLE_D_AVANT }
    expect(await verifierJetonDiffusionQr(JETON_UN_CLIC_D_AVANT, ['un_clic'], env))
      .toEqual({ statut: 'signe', destinataireId: DESTINATAIRE, usage: 'un_clic', cle: 'precedente' })
    expect(await verifierJetonDiffusionQr(JETON_UN_CLIC_D_AVANT, ['un_clic'], { VITFIXSIGNAL_CLE_LIENS_DIFFUSION: AUTRE_CLE }))
      .toEqual({ statut: 'inconnu' })
  })

  it('secret encore posé sous son ANCIEN nom seulement (état de la production au déploiement) : même vérification', async () => {
    const env = { AJ_SIGNALEMENT_CLE_LIENS_DIFFUSION: CLE_D_AVANT }
    expect(cleLiensDiffusionConfigureeQr(env)).toBe(true)
    expect(await verifierJetonDiffusionQr(JETON_UN_CLIC_D_AVANT, ['un_clic'], env))
      .toEqual({ statut: 'signe', destinataireId: DESTINATAIRE, usage: 'un_clic', cle: 'courante' })
    const precedente = { AJ_SIGNALEMENT_CLE_LIENS_DIFFUSION: AUTRE_CLE, AJ_SIGNALEMENT_CLE_LIENS_DIFFUSION_PRECEDENTE: CLE_D_AVANT }
    expect(await verifierJetonDiffusionQr(JETON_PAGE_D_AVANT, ['page'], precedente)).toMatchObject({ statut: 'signe', cle: 'precedente' })
  })

  // Retour de relecture du 26/11/2026 : en reposant le secret sous son nouveau nom, une valeur NEUVE peut être posée par
  // erreur au lieu de la même valeur. Le nouveau nom l'emporte (lireVariableQr) : sans filet, le lien « un clic » d'un
  // message déjà envoyé ne serait plus vérifié, la route répondrait 200 sans rien enregistrer et l'opposition serait
  // perdue sans aucun signal. Tant que l'ancien secret n'est pas supprimé, sa valeur vaut donc clé PRÉCÉDENTE.
  describe('nouveau nom posé avec une valeur NEUVE, ancien secret encore là (erreur de manipulation)', () => {
    const env = { VITFIXSIGNAL_CLE_LIENS_DIFFUSION: AUTRE_CLE, AJ_SIGNALEMENT_CLE_LIENS_DIFFUSION: CLE_D_AVANT }

    it('le lien un clic d’un message déjà envoyé vaut encore, comme signé par une clé précédente (l’opposition n’est pas perdue)', async () => {
      expect(await verifierJetonDiffusionQr(JETON_UN_CLIC_D_AVANT, ['un_clic'], env))
        .toEqual({ statut: 'signe', destinataireId: DESTINATAIRE, usage: 'un_clic', cle: 'precedente' })
    })

    it('le lien de la page aussi : « precedente », donc « expiré » avec le repli par l’adresse, jamais « valide »', async () => {
      expect(await verifierJetonDiffusionQr(JETON_PAGE_D_AVANT, ['page', 'un_clic'], env))
        .toEqual({ statut: 'signe', destinataireId: DESTINATAIRE, usage: 'page', cle: 'precedente' })
    })

    it('les nouveaux liens sont signés par la valeur du NOUVEAU nom seulement, et vérifiés « courante »', async () => {
      const hex = DESTINATAIRE.replaceAll('-', '')
      const signes = await signerLiensDiffusionQr(DESTINATAIRE, env)
      expect(signes).toMatchObject({
        ok: true,
        unClic: `${hex}.${signatureOracle(AUTRE_CLE, 'vitfixsignal-desinscription-v1', 'vitfixsignal-diffusion-un-clic', DESTINATAIRE)}`,
      })
      if (!signes.ok) throw new Error('signature impossible')
      expect(await verifierJetonDiffusionQr(signes.unClic, ['un_clic'], env)).toMatchObject({ statut: 'signe', cle: 'courante' })
    })

    it('un jeton falsifié, ou signé par une troisième clé, reste refusé', async () => {
      for (const i of [0, 31, 33, 60, 96]) {
        expect(await verifierJetonDiffusionQr(alterer(JETON_UN_CLIC_D_AVANT, i), ['page', 'un_clic'], env), `[${i}]`).toEqual({ statut: 'inconnu' })
      }
      const troisieme = 'troisieme-cle-de-test-fictive-0123456789-xyz'
      const etranger = `${DESTINATAIRE.replaceAll('-', '')}.${signatureOracle(troisieme, 'aj-signalement-desinscription-v1', 'aj-diffusion-un-clic', DESTINATAIRE)}`
      expect(await verifierJetonDiffusionQr(etranger, ['un_clic'], env)).toEqual({ statut: 'inconnu' })
    })

    it('un usage ne vaut toujours rien pour l’autre', async () => {
      expect(await verifierJetonDiffusionQr(JETON_PAGE_D_AVANT, ['un_clic'], env)).toEqual({ statut: 'inconnu' })
    })

    it('ancien secret trop court, vide ou supprimé : aucun filet (seule la clé du nouveau nom vérifie)', async () => {
      for (const ancien of ['trop-courte', '', '   ', undefined]) {
        const sans = { VITFIXSIGNAL_CLE_LIENS_DIFFUSION: AUTRE_CLE, AJ_SIGNALEMENT_CLE_LIENS_DIFFUSION: ancien }
        expect(await verifierJetonDiffusionQr(JETON_UN_CLIC_D_AVANT, ['un_clic'], sans), String(ancien)).toEqual({ statut: 'inconnu' })
      }
    })

    it('la même valeur sous les deux noms (manipulation attendue) : clé « courante », rien ne change', async () => {
      const memes = { VITFIXSIGNAL_CLE_LIENS_DIFFUSION: CLE_D_AVANT, AJ_SIGNALEMENT_CLE_LIENS_DIFFUSION: CLE_D_AVANT }
      expect(await verifierJetonDiffusionQr(JETON_UN_CLIC_D_AVANT, ['un_clic'], memes)).toMatchObject({ statut: 'signe', cle: 'courante' })
    })

    it('avec une clé précédente déclarée en plus : les deux sont vérifiées, la déclarée d’abord', async () => {
      const troisieme = 'troisieme-cle-de-test-fictive-0123456789-xyz'
      const hex = DESTINATAIRE.replaceAll('-', '')
      const rotation = { ...env, VITFIXSIGNAL_CLE_LIENS_DIFFUSION_PRECEDENTE: troisieme }
      const parLaDeclaree = `${hex}.${signatureOracle(troisieme, 'vitfixsignal-desinscription-v1', 'vitfixsignal-diffusion-un-clic', DESTINATAIRE)}`
      expect(await verifierJetonDiffusionQr(parLaDeclaree, ['un_clic'], rotation)).toMatchObject({ statut: 'signe', cle: 'precedente' })
      expect(await verifierJetonDiffusionQr(JETON_UN_CLIC_D_AVANT, ['un_clic'], rotation)).toMatchObject({ statut: 'signe', cle: 'precedente' })
    })

    it('l’ancien secret seul ne suffit jamais à SIGNER quand le nouveau nom est posé trop court : configuration incomplète', async () => {
      // Le nouveau nom renseigné l'emporte à la lecture : une valeur trop courte y vaut clé absente, sans retour à l'ancien.
      const court = { VITFIXSIGNAL_CLE_LIENS_DIFFUSION: 'trop-courte', AJ_SIGNALEMENT_CLE_LIENS_DIFFUSION: CLE_D_AVANT }
      expect(cleLiensDiffusionConfigureeQr(court)).toBe(false)
      expect(await verifierJetonDiffusionQr(JETON_UN_CLIC_D_AVANT, ['un_clic'], court)).toEqual({ statut: 'configuration_incomplete' })
    })
  })

  it('les NOUVEAUX liens sont signés sous le nouveau contexte et les nouveaux usages, jamais sous les anciens', async () => {
    const hex = DESTINATAIRE.replaceAll('-', '')
    for (const env of [ENV, { AJ_SIGNALEMENT_CLE_LIENS_DIFFUSION: CLE_D_AVANT }]) {
      const signes = await signerLiensDiffusionQr(DESTINATAIRE, env)
      expect(signes).toEqual({
        ok: true,
        page: `${hex}.${signatureOracle(CLE_D_AVANT, 'vitfixsignal-desinscription-v1', 'vitfixsignal-diffusion-page', DESTINATAIRE)}`,
        unClic: `${hex}.${signatureOracle(CLE_D_AVANT, 'vitfixsignal-desinscription-v1', 'vitfixsignal-diffusion-un-clic', DESTINATAIRE)}`,
      })
      if (!signes.ok) throw new Error('signature impossible')
      expect(signes.page).not.toBe(JETON_PAGE_D_AVANT)
      expect(signes.unClic).not.toBe(JETON_UN_CLIC_D_AVANT)
      expect(await verifierJetonDiffusionQr(signes.unClic, ['un_clic'], env)).toMatchObject({ statut: 'signe', usage: 'un_clic', cle: 'courante' })
    }
  })

  it('usage d’avant sous le contexte d’aujourd’hui (ou l’inverse) : refusé (aucun croisement des deux formes)', async () => {
    const hex = DESTINATAIRE.replaceAll('-', '')
    const croises = [
      signatureOracle(CLE_D_AVANT, 'vitfixsignal-desinscription-v1', 'aj-diffusion-un-clic', DESTINATAIRE),
      signatureOracle(CLE_D_AVANT, 'aj-signalement-desinscription-v1', 'vitfixsignal-diffusion-un-clic', DESTINATAIRE),
    ]
    for (const signature of croises) {
      expect(await verifierJetonDiffusionQr(`${hex}.${signature}`, ['page', 'un_clic'], ENV)).toEqual({ statut: 'inconnu' })
    }
  })
})

// ── D. Invitations des gestionnaires ─────────────────────────────────────────

// VECTEUR FIGÉ : jeton produit le 26/11/2026 par le code d'AVANT le renommage (jetonDuLien de la révision 48f91b9b,
// espace d'avant), pour cette clé de service et cette invitation fictives.
const CLE_SERVICE = 'cle-service-fictive-pour-les-tests-0123456789'
const INVITATION: InvitationSignee = {
  id: '11111111-2222-4333-8444-555555555555', email: 'gestionnaire@cabinet-exemple.test', invite_token: 'ab'.repeat(24),
  equipe_id: 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee', role: null,
}
const JETON_INVITATION_D_AVANT = `${'ab'.repeat(24)}.ea6f2d11061d36990071d6005a17d72a3660e574eebfbf1425693fba996f6aee`

describe('D. invitations signées sous l’ancien nom d’espace', () => {
  let cleAvant: string | undefined
  beforeEach(() => {
    cleAvant = process.env.SUPABASE_SERVICE_ROLE_KEY
    process.env.SUPABASE_SERVICE_ROLE_KEY = CLE_SERVICE
  })
  afterEach(() => {
    if (cleAvant === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY
    else process.env.SUPABASE_SERVICE_ROLE_KEY = cleAvant
  })

  const signatureDAvant = () => (lireJetonDuLien(JETON_INVITATION_D_AVANT) as { signature: string }).signature

  it('le vecteur figé est bien celui de l’ancien nom d’espace (aide des tests, recalcul indépendant)', async () => {
    expect(await signatureAncienEspace(INVITATION)).toBe(signatureDAvant())
    expect(ANCIEN_ESPACE_INVITATION_QR).toBe('aj_signalement')
  })

  it('une invitation en attente, signée avant le renommage, reste acceptée', async () => {
    expect(await signatureValide('vitfixsignal', signatureDAvant(), INVITATION)).toBe(true)
  })

  it('le rôle de la ligne n’y change rien (rôle unique de la table, comme avant)', async () => {
    expect(await signatureValide('vitfixsignal', signatureDAvant(), { ...INVITATION, role: 'gestionnaire_signalement' })).toBe(true)
    expect(await signatureValide('vitfixsignal', signatureDAvant(), { ...INVITATION, role: 'super_admin' })).toBe(true)
  })

  it('elle ne vaut rien dans un autre espace (pro, syndic)', async () => {
    expect(await signatureValide('pro', signatureDAvant(), INVITATION)).toBe(false)
    expect(await signatureValide('syndic', signatureDAvant(), INVITATION)).toBe(false)
    expect(await signatureValide('pro', signatureDAvant(), { ...INVITATION, role: 'gestionnaire_signalement' })).toBe(false)
  })

  it('ligne modifiée après l’envoi (adresse, jeton, fiche, identifiant) ou signature altérée : refusée', async () => {
    const signature = signatureDAvant()
    expect(await signatureValide('vitfixsignal', signature, { ...INVITATION, email: 'autre@cabinet-exemple.test' })).toBe(false)
    expect(await signatureValide('vitfixsignal', signature, { ...INVITATION, invite_token: 'cd'.repeat(24) })).toBe(false)
    expect(await signatureValide('vitfixsignal', signature, { ...INVITATION, equipe_id: 'aaaaaaaa-bbbb-4ccc-8ddd-ffffffffffff' })).toBe(false)
    expect(await signatureValide('vitfixsignal', signature, { ...INVITATION, id: '11111111-2222-4333-8444-666666666666' })).toBe(false)
    expect(await signatureValide('vitfixsignal', alterer(signature, 10), INVITATION)).toBe(false)
  })

  it('autre clé de service : refusée', async () => {
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'une-autre-cle-de-service-fictive'
    expect(await signatureValide('vitfixsignal', signatureDAvant(), INVITATION)).toBe(false)
  })

  it('les NOUVELLES invitations sont signées sous le nouveau nom d’espace', async () => {
    const jeton = await jetonDuLien('vitfixsignal', INVITATION)
    expect(jeton).not.toBe(JETON_INVITATION_D_AVANT)
    const signature = (lireJetonDuLien(jeton) as { signature: string }).signature
    expect(await signatureValide('vitfixsignal', signature, INVITATION)).toBe(true)
    // Oracle : message v2 dont l'espace est le nouveau nom et le rôle celui des gestionnaires.
    const cle = Buffer.from(hkdfSync('sha256', CLE_SERVICE, 'vitfix', 'invitation-equipe-v1', 32))
    const attendu = createHmac('sha256', cle)
      .update(JSON.stringify(['v2', 'vitfixsignal', INVITATION.id, INVITATION.equipe_id, INVITATION.email, INVITATION.invite_token, 'gestionnaire_signalement']))
      .digest('hex')
    expect(signature).toBe(attendu)
  })

  it('les espaces pro et syndic sont inchangés (un lien de l’un ne vaut rien pour l’autre, ni pour Vitfix Signal)', async () => {
    const pro = (lireJetonDuLien(await jetonDuLien('pro', { ...INVITATION, role: 'OUVRIER' })) as { signature: string }).signature
    expect(await signatureValide('pro', pro, { ...INVITATION, role: 'OUVRIER' })).toBe(true)
    expect(await signatureValide('syndic', pro, { ...INVITATION, role: 'OUVRIER' })).toBe(false)
    expect(await signatureValide('vitfixsignal', pro, { ...INVITATION, role: 'OUVRIER' })).toBe(false)
  })
})

// ── E. Repère de routage des comptes ─────────────────────────────────────────

describe('E. repère de routage : nouvelle clé d’abord, ancienne clé à défaut', () => {
  const ROLE = 'gestionnaire_signalement'
  const D_AVANT = { role: ROLE, aj_signalement_cabinet: 'cabinet-exemple' }

  it('les deux clés', () => {
    expect(CLE_REPERE_CABINET_QR).toBe('vitfixsignal_cabinet')
    expect(ANCIENNE_CLE_REPERE_CABINET_QR).toBe('aj_signalement_cabinet')
  })

  it('compte d’avant (ancienne clé seule, ou jeton de session pas encore rafraîchi) : repère lu', () => {
    expect(repereCabinetQr(D_AVANT)).toBe('cabinet-exemple')
  })

  it('compte d’aujourd’hui (nouvelle clé seule) : repère lu', () => {
    expect(repereCabinetQr({ role: ROLE, vitfixsignal_cabinet: 'cabinet-exemple' })).toBe('cabinet-exemple')
  })

  it('les deux clés : la nouvelle l’emporte, même mal formée (jamais un retour à l’ancienne)', () => {
    expect(repereCabinetQr({ role: ROLE, vitfixsignal_cabinet: 'nouveau-cabinet', aj_signalement_cabinet: 'cabinet-exemple' })).toBe('nouveau-cabinet')
    expect(repereCabinetQr({ role: ROLE, vitfixsignal_cabinet: 'Mal Formé', aj_signalement_cabinet: 'cabinet-exemple' })).toBeNull()
  })

  it.each([
    ['ancienne clé mal formée', { role: ROLE, aj_signalement_cabinet: 'Cabinet-Exemple' }],
    ['ancienne clé au nom réservé', { role: ROLE, aj_signalement_cabinet: 'vitfixsignal' }],
    ['ancienne clé non textuelle', { role: ROLE, aj_signalement_cabinet: 42 }],
    ['autre rôle', { role: 'syndic', aj_signalement_cabinet: 'cabinet-exemple' }],
    ['super admin', { role: 'super_admin', aj_signalement_cabinet: 'cabinet-exemple' }],
    ['sans rôle', { aj_signalement_cabinet: 'cabinet-exemple' }],
  ])('%s : aucun repère', (_cas, meta) => {
    expect(repereCabinetQr(meta)).toBeNull()
  })

  it('toutes les décisions de routage suivent l’ancienne clé comme la nouvelle', () => {
    const compte = { app_metadata: D_AVANT }
    expect(decisionAccesEspaceQr(compte, 'cabinet-exemple')).toEqual({ acces: 'autorise', role: 'gestionnaire' })
    expect(decisionAccesEspaceQr(compte, 'autre-cabinet')).toEqual({ acces: 'refuse' })
    expect(decisionAccesEspaceQr(compte)).toEqual({ acces: 'refuse' })
    expect(redirectionEspaceCabinetQr({ page: 'suivi', identifiant: 'cabinet-exemple' }, compte)).toBeNull()
    expect(redirectionEspaceCabinetQr({ page: 'connexion', identifiant: 'cabinet-exemple' }, compte)).toBe('/cabinet-exemple/suivi/')
    expect(redirectionEspaceCabinetQr({ page: 'suivi', identifiant: 'autre-cabinet' }, compte)).toBe('/autre-cabinet/connexion/')
    expect(aiguillageGestionnaireQr('/', D_AVANT)).toBe('/cabinet-exemple/suivi/')
    expect(aiguillageGestionnaireQr('/vitfixsignal/', D_AVANT)).toBe('/cabinet-exemple/suivi/')
    expect(connexionApresMotDePasseQr(D_AVANT)).toBe('/cabinet-exemple/connexion/')
    expect(destinationConnexionEspaceQr('/cabinet-exemple/suivi/', '#signalements', D_AVANT, 'cabinet-exemple')).toBe('/cabinet-exemple/suivi/#signalements')
    expect(destinationConnexionEspaceQr('/fr/vitfixsignal/', null, D_AVANT)).toBe('/cabinet-exemple/suivi/')
  })
})

// ── F. Secrets et variables ──────────────────────────────────────────────────

describe('F. secrets : nouveau nom d’abord, ancien nom en repli, un seul endroit de lecture', () => {
  it('chaque variable a son ancien nom', () => {
    expect(VARIABLES_VITFIXSIGNAL_QR).toEqual([
      'VITFIXSIGNAL_CLE_LIENS_DIFFUSION', 'VITFIXSIGNAL_CLE_LIENS_DIFFUSION_PRECEDENTE', 'VITFIXSIGNAL_EXPEDITEUR_DIFFUSION',
    ])
    expect(ANCIENS_NOMS_VARIABLES_QR).toEqual({
      VITFIXSIGNAL_CLE_LIENS_DIFFUSION: 'AJ_SIGNALEMENT_CLE_LIENS_DIFFUSION',
      VITFIXSIGNAL_CLE_LIENS_DIFFUSION_PRECEDENTE: 'AJ_SIGNALEMENT_CLE_LIENS_DIFFUSION_PRECEDENTE',
      VITFIXSIGNAL_EXPEDITEUR_DIFFUSION: 'AJ_SIGNALEMENT_EXPEDITEUR_DIFFUSION',
    })
  })

  it.each(VARIABLES_VITFIXSIGNAL_QR.map((nom) => [nom, ANCIENS_NOMS_VARIABLES_QR[nom]] as const))('%s : repli sur %s', (nom, ancien) => {
    expect(lireVariableQr(nom, {})).toBeUndefined()
    expect(lireVariableQr(nom, { [nom]: 'valeur-nouvelle' })).toBe('valeur-nouvelle')
    expect(lireVariableQr(nom, { [ancien]: 'valeur-ancienne' })).toBe('valeur-ancienne')
    // Les deux posés (transition) : le nouveau nom l'emporte.
    expect(lireVariableQr(nom, { [nom]: 'valeur-nouvelle', [ancien]: 'valeur-ancienne' })).toBe('valeur-nouvelle')
    // Nouveau nom vide ou fait d'espaces : traité comme absent, l'ancien nom sert encore.
    expect(lireVariableQr(nom, { [nom]: '', [ancien]: 'valeur-ancienne' })).toBe('valeur-ancienne')
    expect(lireVariableQr(nom, { [nom]: '   ', [ancien]: 'valeur-ancienne' })).toBe('valeur-ancienne')
  })

  it('aucune des deux : la clé des liens n’est pas configurée (aucune diffusion ne part)', async () => {
    expect(cleLiensDiffusionConfigureeQr({})).toBe(false)
    expect(await signerLiensDiffusionQr(DESTINATAIRE, {})).toEqual({ ok: false, code: 'configuration_incomplete' })
    expect(await verifierJetonDiffusionQr(JETON_UN_CLIC_D_AVANT, ['un_clic'], {})).toEqual({ statut: 'configuration_incomplete' })
  })

  it('clé trop courte sous l’ancien nom : traitée comme absente, comme sous le nouveau', () => {
    expect(cleLiensDiffusionConfigureeQr({ AJ_SIGNALEMENT_CLE_LIENS_DIFFUSION: 'trop-courte' })).toBe(false)
    expect(cleLiensDiffusionConfigureeQr({ VITFIXSIGNAL_CLE_LIENS_DIFFUSION: 'trop-courte' })).toBe(false)
  })
})

// ── GARDE : l'ancien nom n'est écrit nulle part ailleurs ─────────────────────

const RACINE = process.cwd()
// « \s* » et non un seul espace : le nom peut être coupé par un retour à la ligne (voir sansCoupure).
const ANCIEN_NOM = /aj[\s_-]*signal|aj[_-]diffusion/i

/**
 * Texte d'un fichier où chaque retour à la ligne, avec le retrait et le marqueur de commentaire de la ligne suivante
 * (//, *, #, --, <!--), devient un espace : un nom coupé en fin de ligne d'un commentaire se lit alors d'un seul tenant.
 * Sans cela, la garde ne voyait pas l'ancien nom à cheval sur deux lignes (retour de relecture du 26/11/2026).
 */
const sansCoupure = (texte: string): string => texte.replace(/\r?\n[ \t]*(?:\/\/+|\*+|#+|--+|<!--)?[ \t]*/g, ' ')

/** Le fichier contient-il l'ancien nom, même coupé par un retour à la ligne ? */
const contientAncienNom = (chemin: string): boolean => ANCIEN_NOM.test(sansCoupure(readFileSync(chemin, 'utf-8')))

/** Dossiers et fichiers du dépôt relus (code, tests, migrations, workflows, documentation). */
const PERIMETRE = [
  'app', 'components', 'lib', 'hooks', 'types', 'worker', 'e2e', 'tests', 'docs', 'supabase', 'scripts', 'locales',
  '.github', '.claude/rules',
  'middleware.ts', 'next.config.ts', 'open-next.config.ts', 'sentry.server.config.ts', 'sentry.edge.config.ts',
  'instrumentation.ts', 'instrumentation-client.ts', 'wrangler.toml', '.env.example', 'CLAUDE.md', 'README.md',
]
const EXTENSIONS_TEXTE = /\.(?:ts|tsx|js|jsx|mjs|cjs|json|md|sql|ya?ml|toml|css|html|txt|csv|example)$/

/** Seuls fichiers où l'ancien nom peut être écrit (chemins du dépôt, « / »). */
const FICHIERS_DE_COMPATIBILITE = [
  // Le module de transition et ses tests.
  'lib/vitfixsignal/ancien-nom.ts',
  'tests/lib/vitfixsignal-ancien-nom.test.ts',
  'tests/helpers/lien-invitation-ancien-espace.ts',
  'tests/securite/acces-middleware-vitfixsignal.test.ts',
  'tests/next-config-routage-opennext.test.ts',
  'tests/api/webhook-resend.test.ts',
  'tests/api/vitfixsignal-desinscription.test.ts',
  'tests/api/vitfixsignal-invitation.test.ts',
  'tests/lib/vitfixsignal-diffusion-email.test.ts',
  'tests/securite/cron-vitfixsignal-diffusion.test.ts',
  // Migration du renommage (ancienne clé d'app_metadata) et ses tests.
  'supabase/migrations/20261126b_vitfixsignal_renommage.sql',
  'tests/migrations/vitfixsignal_renommage.test.ts',
  'tests/migrations/vitfixsignal_renommage.execution.test.ts',
  // Ancienne variable de dépôt GitHub, encore lue par la condition du job, et ancienne adresse du filet de reprise,
  // encore appelée le temps du déploiement (tests/securite/cron-vitfixsignal-diffusion.test.ts, « transition »).
  '.github/workflows/vitfixsignal-diffusion-reprise.yml',
  // Clé d'un verrou de transaction, interne à une fonction SQL d'une migration déjà appliquée (jamais stockée).
  'supabase/migrations/20261113_signalements_qr_diffusion.sql',
  'tests/migrations/signalements_qr_diffusion.test.ts',
]

function fichiersTexte(chemin: string): string[] {
  if (!existsSync(chemin)) return []
  if (!statSync(chemin).isDirectory()) return EXTENSIONS_TEXTE.test(chemin) ? [chemin] : []
  return readdirSync(chemin, { withFileTypes: true })
    .filter((e) => e.name !== 'node_modules')
    .flatMap((e) => fichiersTexte(join(chemin, e.name)))
}

describe('garde : l’ancien nom n’est écrit nulle part hors des fichiers de compatibilité', () => {
  const fichiers = PERIMETRE.flatMap((chemin) => fichiersTexte(join(RACINE, chemin)))
  const cheminDepot = (f: string) => relative(RACINE, f).split(sep).join('/')

  it('le périmètre est bien lu (sinon la garde ne garderait rien)', () => {
    expect(fichiers.length).toBeGreaterThan(2000)
    for (const attendu of ['middleware.ts', 'next.config.ts', 'lib/vitfixsignal/ancien-nom.ts', 'lib/equipe/lien-invitation.ts',
      '.github/workflows/vitfixsignal-diffusion-reprise.yml', 'supabase/migrations/20261113_signalements_qr_diffusion.sql']) {
      expect(fichiers.map(cheminDepot), attendu).toContain(attendu)
    }
    expect(ANCIEN_NOM.test('AJ Signalement')).toBe(true)
    expect(ANCIEN_NOM.test('/api/cron/aj-diffusion-reprise')).toBe(true)
    expect(ANCIEN_NOM.test('AJ_DIFFUSION_REPRISE_ACTIVE')).toBe(true)
    expect(ANCIEN_NOM.test('Vitfix Signal, vitfixsignal, signalements_qr')).toBe(false)
  })

  it('un nom coupé par un retour à la ligne est vu, quel que soit le marqueur de commentaire de la ligne suivante', () => {
    const [debut, fin] = ['AJ', 'Signalement']
    for (const coupure of ['\n// ', '\r\n// ', '\n   * ', '\n * ', '\n# ', '\n-- ', '\n  ', '\n', '\n<!-- ']) {
      expect(ANCIEN_NOM.test(sansCoupure(`toutes les routes d'${debut}${coupure}${fin}. Super admin`)), JSON.stringify(coupure)).toBe(true)
    }
    // Aucun faux positif : le nouveau nom coupé de la même façon, ni un mot voisin suivi d'une ligne sans rapport.
    expect(ANCIEN_NOM.test(sansCoupure('espace de Vitfix\n// Signal. Super admin'))).toBe(false)
    expect(ANCIEN_NOM.test(sansCoupure('mise à jour\n// puis signalement suivant'))).toBe(false)
  })

  it('aucun autre fichier ne le contient', () => {
    const fautifs = fichiers
      .filter(contientAncienNom)
      .map(cheminDepot)
      .filter((f) => !FICHIERS_DE_COMPATIBILITE.includes(f))
    expect(fautifs, 'ancien nom écrit hors de lib/vitfixsignal/ancien-nom.ts : l’importer depuis ce module').toEqual([])
  })

  it('chaque fichier de la liste existe et contient bien l’ancien nom (liste sans entrée morte)', () => {
    const sansAncienNom = FICHIERS_DE_COMPATIBILITE.filter((f) => {
      const chemin = join(RACINE, f)
      return !existsSync(chemin) || !contientAncienNom(chemin)
    })
    expect(sansAncienNom).toEqual([])
  })

  it('aucun nom de fichier ni de dossier ne le porte', () => {
    expect(fichiers.map(cheminDepot).filter((f) => ANCIEN_NOM.test(f))).toEqual([])
  })
})
