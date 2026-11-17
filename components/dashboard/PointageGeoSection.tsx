'use client'

import { useState, type ReactNode } from 'react'
import { Loader2 } from 'lucide-react'
import { useLocale } from '@/lib/i18n/context'
import type { Artisan } from '@/lib/types'
import { useContextePointage } from './btp/pointage/useContextePointage'
import { OngletPointer } from './btp/pointage/OngletPointer'
import { OngletAffectations } from './btp/pointage/OngletAffectations'
import { OngletHistorique } from './btp/pointage/OngletHistorique'

// ═══════════════════════════════════════════════════════════════════════════════
// POINTAGE (société BTP) — sur le modèle du pointage terrain du Syndic et de l'Administrateur judiciaire :
// le pointage démarre quand l'employé arrive dans le rayon d'un de ses chantiers et s'arrête quand il en part,
// page ouverte sur son téléphone, connecté avec son propre compte ; ou à la main.
//   - Pointer      : tout compte de la société relié à sa fiche employé (même adresse e-mail que dans Équipes).
//   - Affectations : gérant — employés et équipes reliés aux chantiers en cours, rayon et position GPS.
//   - Historique   : gérant — tous les pointages, saisie à la main, résumé de la semaine, export CSV.
// Données : /api/btp/pointage (société résolue côté serveur) et /api/btp pour le gérant.
// ═══════════════════════════════════════════════════════════════════════════════

type Onglet = 'pointer' | 'affectations' | 'historique'

export function PointageGeoSection({ artisan }: { artisan: Artisan; orgRole?: string }) {
  const isPt = useLocale() === 'pt'
  const { contexte, chargement, erreur, recharger, envoyer } = useContextePointage()
  const [onglet, setOnglet] = useState<Onglet>('pointer')
  const gerant = contexte?.gerant === true

  const onglets: Array<[Onglet, string]> = [
    ['pointer', isPt ? 'Registar ponto' : 'Pointer'],
    ['affectations', isPt ? 'Atribuições' : 'Affectations'],
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
    const reserve = isPt ? 'Módulo reservado às empresas de construção.' : 'Module réservé aux sociétés du BTP.'
    const echec = isPt ? 'Não foi possível carregar o registo de horas.' : 'Le pointage n’a pas pu être chargé.'
    contenu = (
      <div className="v5-al warn" style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <span>{erreur === 'acces' ? reserve : echec}</span>
        {erreur !== 'acces' && (
          <button type="button" className="v5-btn v5-btn-sm" onClick={() => { void recharger() }}>
            {isPt ? 'Tentar novamente' : 'Réessayer'}
          </button>
        )}
      </div>
    )
  } else {
    contenu = (
      <>
        {gerant && (
          <div className="v5-tabs" style={{ marginBottom: '.75rem' }}>
            {onglets.map(([cle, libelle]) => (
              <button
                key={cle}
                type="button"
                aria-pressed={onglet === cle}
                className={`v5-tab-b${onglet === cle ? ' active' : ''}`}
                onClick={() => setOnglet(cle)}
              >
                {libelle}
              </button>
            ))}
          </div>
        )}
        {/* Toujours monté : le pointage automatique continue pendant que le gérant consulte un autre onglet. */}
        <div style={gerant && onglet !== 'pointer' ? { display: 'none' } : undefined}>
          <OngletPointer contexte={contexte} isPt={isPt} envoyer={envoyer} recharger={recharger} />
        </div>
        {gerant && onglet === 'affectations' && (
          <OngletAffectations
            artisan={artisan}
            isPt={isPt}
            comptes={contexte.comptes ?? {}}
            affectationIndividuelle={contexte.affectationIndividuelle !== false}
            pointageAutoActive={contexte.pointageAutoActive}
            reglageDisponible={contexte.reglageDisponible}
            envoyer={envoyer}
            onModifie={recharger}
          />
        )}
        {gerant && onglet === 'historique' && <OngletHistorique artisan={artisan} isPt={isPt} />}
      </>
    )
  }

  return (
    <div>
      <div className="v5-pg-t">
        <h1>{isPt ? 'Registo de horas' : 'Pointage'}</h1>
        <p>
          {isPt
            ? 'Registo automático à chegada à obra (GPS), ou manual'
            : 'Pointage automatique à l’arrivée sur le chantier (GPS), ou à la main'}
        </p>
      </div>
      {contenu}
    </div>
  )
}
