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
            ? 'A ficha da sua empresa não pôde ser lida (ligação interrompida ou servidor indisponível). Nada foi alterado. Verifique a ligação e tente novamente.'
            : 'La fiche de votre société n’a pas pu être lue (connexion interrompue ou serveur indisponible). Rien n’a été modifié. Vérifiez votre connexion puis réessayez.'}
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
 * Message affiché quand le compte société n'a pas de fiche lisible (inscription interrompue, salarié invité) : le
 * tableau de bord s'ouvre, mais ses documents ne portent pas l'identité de la société.
 */
export function messageFicheSocieteAbsente(isPt: boolean): string {
  return isPt
    ? `Ficha da empresa não encontrada: os seus orçamentos e faturas não terão a forma jurídica nem o número de registo da sua empresa. Escreva-nos para ${CONTACT_EMAIL} para a restabelecer.`
    : `Fiche société introuvable : vos devis et factures ne reprendront ni la forme juridique ni le SIRET de votre société. Écrivez-nous à ${CONTACT_EMAIL} pour la rétablir.`
}
