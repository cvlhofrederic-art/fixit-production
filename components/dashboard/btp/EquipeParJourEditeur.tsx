'use client'

import { useState } from 'react'
import { CalendarDays, RotateCcw } from 'lucide-react'
import {
  equipeDuJour, estJourOuvre, jourRetouche, reprendreEquipeHabituelle, retoucherJour, type EquipeParJour,
} from '@/lib/btp/equipe-par-jour'

// ═══════════════════════════════════════════════════════════════════════════════
// ÉQUIPE PAR JOUR — fiche d'une obra (components/dashboard/ChantiersBTPV2.tsx), 28/11/2026
// L'équipe habituelle (cases « Employés assignés ») travaille du lundi au vendredi ; chaque jour peut être retouché :
// un absent, un renfort, un samedi travaillé, un jour chômé. Règles : lib/btp/equipe-par-jour.ts.
// ═══════════════════════════════════════════════════════════════════════════════

export interface MembreChoisissable { id: string; prenom: string; nom: string }

interface Props {
  /** Jours de l'obra (« AAAA-MM-JJ »), dans l'ordre. Vide : dates de l'obra pas encore saisies. */
  jours: readonly string[]
  /** La liste a été coupée (période trop longue). */
  tronque: boolean
  /** Employés actifs, proposés au choix. */
  membres: readonly MembreChoisissable[]
  /** Tous les employés connus (anciens compris), pour nommer ceux d'un jour passé. */
  membresTous: readonly MembreChoisissable[]
  /** Équipe habituelle (membres_ids). */
  membresIds: readonly string[]
  equipeParJour: EquipeParJour
  onChange: (equipeParJour: EquipeParJour) => void
  isPt: boolean
  isV5: boolean
  dl: string
}

/** « seg., 01/12 » / « lun. 01/12 » : jour de la semaine et date, sans glisser de fuseau. */
function libelleJour(jour: string, dl: string): string {
  return new Date(`${jour}T00:00:00Z`).toLocaleDateString(dl, { weekday: 'short', day: '2-digit', month: '2-digit', timeZone: 'UTC' })
}

export function EquipeParJourEditeur({ jours, tronque, membres, membresTous, membresIds, equipeParJour, onChange, isPt, isV5, dl }: Props) {
  const [jourOuvert, setJourOuvert] = useState<string | null>(null)
  const parId = new Map(membresTous.map(m => [m.id, m]))
  const nomCourt = (id: string) => {
    const m = parId.get(id)
    return m ? `${m.prenom} ${m.nom.charAt(0)}.`.trim() : (isPt ? 'Colaborador removido' : 'Employé supprimé')
  }
  const retouches = jours.filter(j => jourRetouche(j, membresIds, equipeParJour)).length

  return (
    <div className={isV5 ? 'v5-fg' : 'v22-form-group'}>
      <div id="equipe-par-jour-titre" className={isV5 ? 'v5-fl' : 'v22-form-label'} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
        <CalendarDays size={12} /> {isPt ? 'Equipa por dia' : 'Équipe par jour'}
        {retouches > 0 && (
          <span className={isV5 ? 'v5-badge v5-badge-orange' : 'v22-tag v22-tag-orange'} style={{ fontSize: 9 }}>
            {retouches} {isPt ? 'dia(s) alterado(s)' : 'jour(s) modifié(s)'}
          </span>
        )}
      </div>
      <div style={{ fontSize: 11, color: '#666', marginBottom: 4 }}>
        {isPt
          ? 'A equipa habitual trabalha de segunda a sexta. Altere um dia se alguém faltar, se vierem outros, ou para um sábado.'
          : 'L’équipe habituelle travaille du lundi au vendredi. Modifiez un jour si quelqu’un manque, si d’autres viennent, ou pour un samedi.'}
      </div>
      {jours.length === 0 ? (
        <div style={{ fontSize: 11, color: '#999', padding: 6 }}>
          {isPt ? 'Indique as datas de início e de fim para ajustar a equipa dia a dia.' : 'Indiquez les dates de début et de fin pour ajuster l’équipe jour par jour.'}
        </div>
      ) : (
        <ul aria-labelledby="equipe-par-jour-titre" style={{ listStyle: 'none', margin: 0, padding: 3, maxHeight: 220, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 3 }}>
          {jours.map(jour => {
            const presents = equipeDuJour(jour, membresIds, equipeParJour)
            const retouche = jourRetouche(jour, membresIds, equipeParJour)
            const ouvert = jourOuvert === jour
            const libelle = libelleJour(jour, dl)
            // Employés proposés ce jour-là : les actifs, plus un ancien employé encore inscrit à ce jour (pour pouvoir le retirer).
            const choix = [...membres, ...presents.filter(id => !membres.some(m => m.id === id)).map(id => ({ id, prenom: nomCourt(id), nom: '' }))]
            return (
              <li key={jour} style={{
                border: `1px solid ${retouche ? '#FFB74D' : '#E0E0E0'}`, borderRadius: 4, padding: '4px 8px', fontSize: 11,
                background: retouche ? '#FFF8E1' : estJourOuvre(jour) ? '#fff' : '#FAFAFA',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                  <span style={{ fontWeight: 600, minWidth: 74 }}>{libelle}</span>
                  <span style={{ color: presents.length === 0 ? '#999' : '#333', flex: 1 }}>
                    {presents.length === 0 ? (isPt ? 'Ninguém' : 'Personne') : presents.map(nomCourt).join(', ')}
                  </span>
                  {retouche && (
                    <button type="button" className={isV5 ? 'v5-btn v5-btn-sm' : 'v22-btn v22-btn-sm'} style={{ fontSize: 10 }}
                      aria-label={isPt ? `Repor a equipa habitual em ${libelle}` : `Remettre l’équipe habituelle le ${libelle}`}
                      onClick={() => { onChange(reprendreEquipeHabituelle(equipeParJour, jour)); if (ouvert) setJourOuvert(null) }}>
                      <RotateCcw size={10} /> {isPt ? 'Repor' : 'Rétablir'}
                    </button>
                  )}
                  <button type="button" className={isV5 ? 'v5-btn v5-btn-sm' : 'v22-btn v22-btn-sm'} style={{ fontSize: 10 }}
                    aria-expanded={ouvert} aria-label={isPt ? `Alterar a equipa de ${libelle}` : `Modifier l’équipe du ${libelle}`}
                    onClick={() => setJourOuvert(ouvert ? null : jour)}>
                    {ouvert ? (isPt ? 'Fechar' : 'Fermer') : (isPt ? 'Alterar' : 'Modifier')}
                  </button>
                </div>
                {ouvert && (
                  <fieldset style={{ border: 'none', margin: '4px 0 0', padding: 0, display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                    <legend style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)' }}>
                      {isPt ? `Colaboradores presentes em ${libelle}` : `Employés présents le ${libelle}`}
                    </legend>
                    {choix.length === 0 && (
                      <span style={{ color: '#999' }}>{isPt ? 'Nenhum colaborador. Adicione-os em "Equipas".' : 'Aucun employé. Ajoutez-en dans "Équipes".'}</span>
                    )}
                    {choix.map(m => {
                      const coche = presents.includes(m.id)
                      return (
                        <label key={m.id} style={{
                          display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 6px', borderRadius: 4, cursor: 'pointer',
                          border: `1px solid ${coche ? '#81C784' : '#E0E0E0'}`, background: coche ? '#E8F5E9' : '#fff',
                        }}>
                          <input type="checkbox" checked={coche} onChange={() => {
                            const suivants = coche ? presents.filter(id => id !== m.id) : [...presents, m.id]
                            onChange(retoucherJour(equipeParJour, membresIds, jour, suivants))
                          }} />
                          {`${m.prenom} ${m.nom}`.trim()}
                        </label>
                      )
                    })}
                  </fieldset>
                )}
              </li>
            )
          })}
        </ul>
      )}
      {tronque && (
        <div style={{ fontSize: 10, color: '#BF360C', marginTop: 3 }}>
          {isPt ? 'Obra muito longa: só são mostrados os primeiros dias. Verifique as datas.' : 'Chantier très long : seuls les premiers jours sont affichés. Vérifiez les dates.'}
        </div>
      )}
    </div>
  )
}
