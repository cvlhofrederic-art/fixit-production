'use client'

import { useState } from 'react'
import { CalendarDays, RotateCcw, Timer } from 'lucide-react'
import {
  equipeDuJour, estJourOuvre, jourRetouche, reprendreEquipeHabituelle, retoucherJour, type EquipeParJour, type JourOuvre,
} from '@/lib/btp/equipe-par-jour'
import type { CompositionJour } from '@/lib/btp/rentabilite-obra'

// ═══════════════════════════════════════════════════════════════════════════════
// ÉQUIPE PAR JOUR — fiche d'une obra (components/dashboard/ChantiersBTPV2.tsx), 28/11/2026
// L'équipe habituelle (cases « Employés assignés ») travaille du lundi au vendredi, hors jours fériés ; chaque jour peut
// être retouché : un absent, un renfort, un samedi travaillé, un férié travaillé. Un jour passé où quelqu'un a pointé
// sur l'obra montre les heures pointées (elles font foi et se corrigent dans l'écran Pointage) et les prévus comptés
// faute de pointage ; « Modifier » y retouche l'équipe prévue (pour retirer un absent qui n'a pas pointé).
// Règles : lib/btp/equipe-par-jour.ts, lib/btp/rentabilite-obra.ts.
// ═══════════════════════════════════════════════════════════════════════════════

export interface MembreChoisissable { id: string; prenom: string; nom: string }

interface Props {
  /** Jours de l'obra (« AAAA-MM-JJ »), dans l'ordre. Vide : dates de l'obra pas encore saisies. */
  jours: readonly string[]
  /** La liste a été coupée (période trop longue). */
  tronque: boolean
  /** « AAAA-MM-JJ » du jour : un jour passé garde sa liste (lib/btp/equipe-par-jour.ts). */
  aujourdhui: string
  /** Jours travaillés par l'équipe habituelle (week-end et fériés exclus). */
  ouvre?: JourOuvre
  /** Nom du jour férié national, ou null. */
  ferie?: (jour: string) => string | null
  /** Jours passés pointés sur l'obra : qui a pointé (et ses heures), qui est compté faute de pointage. */
  compositions?: ReadonlyMap<string, CompositionJour>
  /** Nom d'origine d'un employé pointé sans fiche (clé « nom:… »). */
  noms?: ReadonlyMap<string, string>
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

/** Fond d'une ligne : pointée, retouchée, jour travaillé, jour chômé. */
function fondDuJour(pointe: boolean, retouche: boolean, ouvre: boolean): string {
  if (pointe) return '#E3F2FD'
  if (retouche) return '#FFF8E1'
  return ouvre ? '#fff' : '#FAFAFA'
}

/** « seg., 01/12 » / « lun. 01/12 » : jour de la semaine et date, sans glisser de fuseau. */
function libelleJour(jour: string, dl: string): string {
  return new Date(`${jour}T00:00:00Z`).toLocaleDateString(dl, { weekday: 'short', day: '2-digit', month: '2-digit', timeZone: 'UTC' })
}

const masque = { position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)' } as const

export function EquipeParJourEditeur({
  jours, tronque, aujourdhui, ouvre = estJourOuvre, ferie, compositions, noms, membres, membresTous, membresIds, equipeParJour, onChange,
  isPt, isV5, dl,
}: Props) {
  const [jourOuvert, setJourOuvert] = useState<string | null>(null)
  const parId = new Map(membresTous.map(m => [m.id.toLowerCase(), m]))
  const nomCourt = (id: string): string => {
    if (id.startsWith('nom:')) return noms?.get(id) || id.slice(4) || '?'
    const m = parId.get(id.toLowerCase())
    if (m) return `${m.prenom} ${m.nom.charAt(0)}.`.trim()
    return isPt ? 'Colaborador removido' : 'Employé supprimé'
  }
  const heures = (h: number | null) => (h === null ? (isPt ? 'dia' : 'journée') : `${h.toLocaleString(dl, { maximumFractionDigits: 2 })} h`)
  const retouches = jours.filter(j => jourRetouche(j, membresIds, equipeParJour, ouvre)).length
  const bouton = isV5 ? 'v5-btn v5-btn-sm' : 'v22-btn v22-btn-sm'

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
          ? 'A equipa habitual trabalha de segunda a sexta, exceto feriados. Altere um dia se alguém faltar, se vierem outros, ou para um sábado. Nos dias passados com registo de ponto, conta o ponto.'
          : 'L’équipe habituelle travaille du lundi au vendredi, hors jours fériés. Modifiez un jour si quelqu’un manque, si d’autres viennent, ou pour un samedi. Les jours passés pointés comptent le pointage.'}
      </div>
      {jours.length === 0 ? (
        <div style={{ fontSize: 11, color: '#999', padding: 6 }}>
          {isPt ? 'Indique as datas de início e de fim para ajustar a equipa dia a dia.' : 'Indiquez les dates de début et de fin pour ajuster l’équipe jour par jour.'}
        </div>
      ) : (
        <ul aria-labelledby="equipe-par-jour-titre" style={{ listStyle: 'none', margin: 0, padding: 3, maxHeight: 220, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 3 }}>
          {jours.map(jour => {
            const pointe = compositions?.get(jour)
            const presents = equipeDuJour(jour, membresIds, equipeParJour, ouvre)
            const retouche = jourRetouche(jour, membresIds, equipeParJour, ouvre)
            const ouvert = jourOuvert === jour
            const libelle = libelleJour(jour, dl)
            const nomFerie = ferie?.(jour) ?? null
            // Employés proposés ce jour-là : les actifs, plus un ancien employé encore inscrit à ce jour (pour pouvoir le retirer).
            const choix = [...membres, ...presents.filter(id => !membres.some(m => m.id.toLowerCase() === id)).map(id => ({ id, prenom: nomCourt(id), nom: '' }))]
            return (
              <li key={jour} style={{
                border: `1px solid ${retouche ? '#FFB74D' : '#E0E0E0'}`, borderRadius: 4, padding: '4px 8px', fontSize: 11,
                background: fondDuJour(!!pointe, retouche, ouvre(jour)),
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                  <span style={{ fontWeight: 600, minWidth: 74 }}>{libelle}</span>
                  {nomFerie && (
                    <span className={isV5 ? 'v5-badge v5-badge-gray' : 'v22-tag v22-tag-gray'} style={{ fontSize: 9 }}>
                      {isPt ? 'Feriado: ' : 'Férié : '}{nomFerie}
                    </span>
                  )}
                  {pointe ? (
                    <>
                      <span style={{ color: '#1565C0', flex: 1, display: 'inline-flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
                        <Timer size={11} /> {pointe.pointes.map(p => `${nomCourt(p.id)} ${heures(p.heures)}`).join(' · ')}
                        {pointe.prevus.length > 0 && (
                          <span style={{ color: '#666' }}>
                            {' + '}{pointe.prevus.map(nomCourt).join(', ')}{isPt ? ' (previsto, sem ponto)' : ' (prévu, sans pointage)'}
                          </span>
                        )}
                      </span>
                      <span style={{ color: '#666', fontSize: 10 }}>
                        {isPt ? 'registo de ponto (corrige-se em Registo de horas)' : 'pointage (se corrige dans Pointage)'}
                      </span>
                    </>
                  ) : (
                    <span style={{ color: presents.length === 0 ? '#999' : '#333', flex: 1 }}>
                      {presents.length === 0 ? (isPt ? 'Ninguém' : 'Personne') : presents.map(nomCourt).join(', ')}
                    </span>
                  )}
                  {retouche && (
                    <button type="button" className={bouton} style={{ fontSize: 10 }}
                      aria-label={isPt ? `Repor a equipa habitual em ${libelle}` : `Remettre l’équipe habituelle le ${libelle}`}
                      onClick={() => { onChange(reprendreEquipeHabituelle(equipeParJour, jour)); if (ouvert) setJourOuvert(null) }}>
                      <RotateCcw size={10} /> {isPt ? 'Repor' : 'Rétablir'}
                    </button>
                  )}
                  <button type="button" className={bouton} style={{ fontSize: 10 }}
                    aria-expanded={ouvert} aria-label={isPt ? `Alterar a equipa de ${libelle}` : `Modifier l’équipe du ${libelle}`}
                    onClick={() => setJourOuvert(ouvert ? null : jour)}>
                    {ouvert ? (isPt ? 'Fechar' : 'Fermer') : (isPt ? 'Alterar' : 'Modifier')}
                  </button>
                </div>
                {ouvert && (
                  <fieldset style={{ border: 'none', margin: '4px 0 0', padding: 0, display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                    <legend style={masque}>
                      {isPt ? `Colaboradores presentes em ${libelle}` : `Employés présents le ${libelle}`}
                    </legend>
                    {choix.length === 0 && (
                      <span style={{ color: '#999' }}>{isPt ? 'Nenhum colaborador. Adicione-os em "Equipas".' : 'Aucun employé. Ajoutez-en dans "Équipes".'}</span>
                    )}
                    {choix.map(m => {
                      const id = m.id.toLowerCase()
                      const coche = presents.includes(id)
                      return (
                        <label key={m.id} style={{
                          display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 6px', borderRadius: 4, cursor: 'pointer',
                          border: `1px solid ${coche ? '#81C784' : '#E0E0E0'}`, background: coche ? '#E8F5E9' : '#fff',
                        }}>
                          <input type="checkbox" checked={coche} onChange={() => {
                            const suivants = coche ? presents.filter(x => x !== id) : [...presents, id]
                            onChange(retoucherJour(equipeParJour, membresIds, jour, suivants, aujourdhui, ouvre))
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
