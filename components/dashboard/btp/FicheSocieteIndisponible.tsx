'use client'

import { CONTACT_EMAIL } from '@/lib/constants'

/**
 * Fiche de la société BTP illisible au chargement du tableau de bord (réseau coupé, serveur indisponible) : au lieu
 * d'ouvrir le tableau de bord sur une société de secours, la page le dit et propose de réessayer. Rien n'est lu ni
 * écrit tant que la fiche n'a pas été chargée.
 */
export function FicheSocieteIndisponible({ isPt, onReessayer }: { isPt: boolean; onReessayer: () => void }) {
  return (
    <div role="alert" style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#F2F2F0', padding: 16 }}>
      <div style={{ maxWidth: 440, textAlign: 'center', color: '#333' }}>
        <h1 style={{ margin: '0 0 8px', fontSize: 18, fontWeight: 700, color: '#111' }}>
          {isPt ? 'Não foi possível carregar a sua empresa' : 'Impossible de charger votre société'}
        </h1>
        <p style={{ margin: '0 0 20px', fontSize: 14, lineHeight: 1.5 }}>
          {isPt
            ? `A ficha da sua empresa não pôde ser lida (ligação interrompida ou servidor indisponível). Nada foi alterado. Verifique a ligação e tente novamente; se o problema persistir, escreva-nos para ${CONTACT_EMAIL}.`
            : `La fiche de votre société n’a pas pu être lue (connexion interrompue ou serveur indisponible). Rien n’a été modifié. Vérifiez votre connexion puis réessayez ; si le problème persiste, écrivez-nous à ${CONTACT_EMAIL}.`}
        </p>
        <button
          type="button"
          onClick={onReessayer}
          style={{ padding: '10px 18px', borderRadius: 8, border: 'none', background: '#FFC107', color: '#111', cursor: 'pointer', fontSize: 13, fontWeight: 700 }}
        >
          {isPt ? 'Tentar novamente' : 'Réessayer'}
        </button>
      </div>
    </div>
  )
}

/**
 * Le compte BTP sans fiche doit-il en être prévenu ? Oui pour le compte de la société elle-même (gérant), dont la
 * fiche est à rétablir. Non pour la démonstration du super_admin en vue BTP, ni pour un compte invité dans l'équipe
 * d'une société : il n'a pas de fiche à lui, il n'y a rien à rétablir, et il garde l'ouverture d'avant.
 * Le compte invité se reconnaît à la société d'un autre compte posée dans app_metadata.company_id à l'acceptation de
 * l'invitation, quel que soit son rôle d'équipe (Gérant compris : invité ou promu Gérant) ; à défaut, à un rôle
 * d'équipe autre que GERANT. Le compte de la société n'a pas de company_id, ou le sien (`compteId`).
 */
export function prevenirFicheSocieteAbsente(appMetadata: Record<string, unknown> | undefined, compteId: string): boolean {
  if (appMetadata?._original_role === 'super_admin') return false
  const societe = appMetadata?.company_id
  if (typeof societe === 'string' && societe !== '' && societe !== compteId) return false
  const roleEquipe = appMetadata?.pro_team_role
  return !roleEquipe || roleEquipe === 'GERANT'
}

/**
 * Message affiché quand le compte de la société n'a pas de fiche lisible (inscription interrompue) : le tableau de
 * bord s'ouvre, mais ses documents ne portent pas l'identité de la société.
 */
export function messageFicheSocieteAbsente(isPt: boolean): string {
  return isPt
    ? `Ficha da empresa não encontrada: os seus orçamentos e faturas não terão a forma jurídica nem o número de registo da sua empresa. Escreva-nos para ${CONTACT_EMAIL} para a restabelecer.`
    : `Fiche société introuvable : vos devis et factures ne reprendront ni la forme juridique ni le SIRET de votre société. Écrivez-nous à ${CONTACT_EMAIL} pour la rétablir.`
}
