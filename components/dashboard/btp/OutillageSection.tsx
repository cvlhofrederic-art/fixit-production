'use client'

import { useState, type ReactNode } from 'react'
import { Loader2 } from 'lucide-react'
import { useLocale } from '@/lib/i18n/context'
import { useOutillage } from './outillage/useOutillage'
import { OngletVerification } from './outillage/OngletVerification'
import { OngletRepertoire } from './outillage/OngletRepertoire'
import { OngletHistorique } from './outillage/OngletHistorique'
import { messageErreurOutillage } from './outillage/textes'

// ═══════════════════════════════════════════════════════════════════════════════
// OUTILLAGE ET VÉHICULES (société BTP), 26/11/2026 — demande de Frédéric : un répertoire des outils et véhicules de
// la société, vérifié chaque vendredi par le responsable de chaque chantier (encarregado), qui valide ce qui s'y trouve
// et signale ce qui manque.
//   - Vérification du vendredi : tout compte qui a accès au module (gestion : tous les chantiers en cours ; responsable :
//     ses chantiers affectés, comme pour le pointage).
//   - Répertoire : gestion seulement (gérant, ou compte en accès complet sur le module).
//   - Historique : les vérifications des 12 dernières semaines (celles de ses chantiers pour un responsable).
// Données : /api/btp/outillage (société et droits résolus côté serveur).
// ═══════════════════════════════════════════════════════════════════════════════

type Onglet = 'verification' | 'repertoire' | 'historique'

export function OutillageSection() {
  const isPt = useLocale() === 'pt'
  const { contexte, chargement, erreur, recharger, envoyer } = useOutillage()
  const [onglet, setOnglet] = useState<Onglet>('verification')
  const gestion = contexte?.gestion === true

  const onglets: Array<[Onglet, string]> = [
    ['verification', isPt ? 'Verificação de sexta-feira' : 'Vérification du vendredi'],
    ...(gestion ? [['repertoire', isPt ? 'Inventário' : 'Répertoire'] as [Onglet, string]] : []),
    ['historique', isPt ? 'Histórico' : 'Historique'],
  ]

  let contenu: ReactNode
  if (chargement) {
    contenu = (
      <div style={{ padding: 40, textAlign: 'center' }}>
        <Loader2 size={24} className="animate-spin" style={{ display: 'inline-block', color: '#999' }} />
      </div>
    )
  } else if (!contexte) {
    const refuse = erreur === 'acces_refuse' || erreur === 'reserve_btp'
    contenu = (
      <div className="v5-al warn" style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <span>{refuse ? messageErreurOutillage(erreur, isPt) : (isPt ? 'Não foi possível carregar as ferramentas.' : 'L’outillage n’a pas pu être chargé.')}</span>
        {!refuse && (
          <button type="button" className="v5-btn v5-btn-sm" onClick={() => { void recharger() }}>{isPt ? 'Tentar novamente' : 'Réessayer'}</button>
        )}
      </div>
    )
  } else if (!contexte.disponible) {
    contenu = <div className="v5-al warn">{messageErreurOutillage('migration_requise', isPt)}</div>
  } else {
    const actif = gestion || onglet !== 'repertoire' ? onglet : 'verification'
    contenu = (
      <>
        <div className="v5-tabs" style={{ marginBottom: '.75rem' }}>
          {onglets.map(([cle, libelle]) => (
            <button key={cle} type="button" aria-pressed={actif === cle} className={`v5-tab-b${actif === cle ? ' active' : ''}`} onClick={() => setOnglet(cle)}>
              {libelle}
            </button>
          ))}
        </div>
        {actif === 'verification' && <OngletVerification contexte={contexte} isPt={isPt} envoyer={envoyer} recharger={recharger} />}
        {actif === 'repertoire' && <OngletRepertoire contexte={contexte} isPt={isPt} envoyer={envoyer} recharger={recharger} />}
        {actif === 'historique' && <OngletHistorique contexte={contexte} isPt={isPt} />}
      </>
    )
  }

  return (
    <div>
      <div className="v5-pg-t">
        <h1>{isPt ? 'Ferramentas e viaturas' : 'Outillage et véhicules'}</h1>
        <p>
          {isPt
            ? 'Inventário da empresa e verificação de cada obra à sexta-feira pelo encarregado'
            : 'Répertoire de la société et vérification de chaque chantier le vendredi par son chef'}
        </p>
      </div>
      {contenu}
    </div>
  )
}
