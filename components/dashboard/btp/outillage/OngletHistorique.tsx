'use client'

import type { ContexteOutillage, LigneVerifiee } from '@/lib/btp/outillage-regles'
import { dateEtHeure, iconeType, jourEtDate, resumeVerification } from './textes'

// Onglet « Historique » : les vérifications des douze dernières semaines (celles de ses chantiers pour un responsable),
// de la plus récente à la plus ancienne, avec ce qui manquait ou était en panne et les remarques. Lecture seule.

const GRIS = '#555'

const aSignaler = (l: LigneVerifiee) => l.presents < l.attendus || l.enPanne

function Ligne({ ligne, isPt }: { ligne: LigneVerifiee; isPt: boolean }) {
  const manque = ligne.attendus - ligne.presents
  const etats: string[] = []
  if (manque > 0) etats.push(ligne.attendus > 1 ? (isPt ? `${manque} em falta de ${ligne.attendus}` : `${manque} manquant${manque > 1 ? 's' : ''} sur ${ligne.attendus}`) : (isPt ? 'em falta' : 'manquant'))
  if (ligne.enPanne) etats.push(isPt ? 'avariada' : 'en panne')
  if (etats.length === 0) etats.push(isPt ? 'presente' : 'présent')
  return (
    <li style={{ fontSize: 13, color: aSignaler(ligne) ? '#b91c1c' : GRIS }}>
      <span aria-hidden="true">{iconeType(ligne.type)} </span>
      {ligne.nom}{ligne.reference ? ` (${ligne.reference})` : ''} — {etats.join(', ')}
      {ligne.remarque && <span style={{ color: GRIS }}> · « {ligne.remarque} »</span>}
    </li>
  )
}

export function OngletHistorique({ contexte, isPt }: { contexte: ContexteOutillage; isPt: boolean }) {
  if (contexte.verifications.length === 0) {
    return (
      <div className="v5-card" style={{ fontSize: 13, color: GRIS }}>
        {isPt ? 'Ainda não há verificações nas últimas 12 semanas.' : 'Aucune vérification sur les 12 dernières semaines.'}
      </div>
    )
  }
  return (
    <div style={{ display: 'grid', gap: 8 }}>
      {contexte.verifications.map(v => {
        const signalees = v.lignes.filter(aSignaler)
        const autres = v.lignes.filter(l => !aSignaler(l))
        const probleme = v.manquants > 0 || v.enPanne > 0
        return (
          <details key={v.id} className="v5-card">
            <summary style={{ cursor: 'pointer', display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
              <span>
                <strong>{v.chantierTitre || '—'}</strong>
                <span style={{ color: GRIS }}> · {isPt ? 'semana de' : 'semaine du'} {jourEtDate(v.vendredi, isPt)}</span>
              </span>
              <span style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <span className={`v5-badge v5-badge-${probleme ? 'red' : 'green'}`}>{resumeVerification(v.manquants, v.enPanne, isPt)}</span>
                <span style={{ fontSize: 12, color: GRIS }}>{isPt ? 'Ver detalhe ▾' : 'Voir le détail ▾'}</span>
              </span>
            </summary>
            <div style={{ marginTop: 8 }}>
              <div style={{ fontSize: 12, color: GRIS }}>
                {isPt ? `Validada por ${v.par || '—'}, ${dateEtHeure(v.le, true)}` : `Validée par ${v.par || '—'}, le ${dateEtHeure(v.le, false)}`}
              </div>
              {v.observations && (
                <p style={{ fontSize: 13, margin: '6px 0', whiteSpace: 'pre-wrap' }}>
                  <strong>{isPt ? 'Observações: ' : 'Remarques : '}</strong>{v.observations}
                </p>
              )}
              {v.lignes.length === 0 && <p style={{ fontSize: 13, color: GRIS, margin: '6px 0' }}>{isPt ? 'Nenhum elemento nesta obra.' : 'Aucun élément sur ce chantier.'}</p>}
              <ul style={{ margin: '6px 0 0', paddingLeft: 18 }}>
                {[...signalees, ...autres].map(l => <Ligne key={l.outilId} ligne={l} isPt={isPt} />)}
              </ul>
            </div>
          </details>
        )
      })}
    </div>
  )
}
