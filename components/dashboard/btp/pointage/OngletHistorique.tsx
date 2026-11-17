'use client'

import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import { useBTPData } from '@/lib/hooks/use-btp-data'
import { NOTE_A_REGULARISER, NOTE_DEPART_APRES_COUPURE, NOTE_DOUBLON, pointagesEnCsv, STATUT_EN_COURS } from '@/lib/btp/pointage-regles'
import type { Artisan } from '@/lib/types'
import { formatHeures } from './textes'

/** Texte secondaire : gris assez foncé pour un contraste lisible en petite taille. */
const GRIS = '#555'

// Onglet « Historique » (gérant) : tous les pointages de la société, saisie à la main, résumé de la semaine, export
// CSV. Reprend l'ancien onglet « Pointages » de l'écran ; la saisie garde désormais l'employé et le chantier choisis
// (membre_id, chantier_id), et un pointage sans heure de départ s'affiche « En cours ».

interface PointageLu {
  id: string
  employe: string
  chantier?: string
  date: string
  heureArrivee: string
  heureDepart?: string
  heuresTravaillees: number
  mode?: string
  notes?: string
}
interface ChantierLu { id: string; titre: string; statut?: string }
interface MembreLu { id: string; prenom?: string; nom?: string; actif?: boolean; typeCompte?: string }

type FiltreMode = 'tous' | 'auto' | 'manuel'

/** Date AAAA-MM-JJ en heure locale (toISOString donnait la veille entre minuit et 1 h ou 2 h en France). */
const dateLocale = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const aujourdhui = () => dateLocale(new Date())

/** Lundi et dimanche de la semaine en cours (heure locale), au format AAAA-MM-JJ. */
function semaineEnCours(): { debut: string; fin: string } {
  const jour = new Date()
  const lundi = new Date(jour.getFullYear(), jour.getMonth(), jour.getDate() - ((jour.getDay() + 6) % 7))
  const dimanche = new Date(lundi.getFullYear(), lundi.getMonth(), lundi.getDate() + 6)
  return { debut: dateLocale(lundi), fin: dateLocale(dimanche) }
}

/** Jours de la semaine affichés, lundi d'abord : [libellé FR, libellé PT, Date.getDay()]. */
const JOURS: ReadonlyArray<[string, string, number]> = [
  ['Lun', 'Seg', 1], ['Mar', 'Ter', 2], ['Mer', 'Qua', 3], ['Jeu', 'Qui', 4], ['Ven', 'Sex', 5], ['Sam', 'Sáb', 6], ['Dim', 'Dom', 0],
]

const calculerHeures = (arrivee: string, depart: string, pauseMinutes: number) => {
  const [ah, am] = arrivee.split(':').map(Number)
  const [dh, dm] = depart.split(':').map(Number)
  return Math.max(0, ((dh * 60 + dm) - (ah * 60 + am) - pauseMinutes) / 60)
}

const formulaireVide = () => ({
  employe: '', membreId: '', poste: '', chantier: '', chantierId: '',
  date: aujourdhui(), heureArrivee: '08:00', heureDepart: '17:00', pauseMinutes: 60, notes: '',
})

/** Départ : heure, « En cours » (aujourd'hui), « Départ non pointé » (jour précédent, encore ouvert). */
function celluleDepart(p: PointageLu, jour: string, isPt: boolean) {
  if (p.heureDepart) return p.heureDepart.slice(0, 5)
  if (p.date < jour) return <span className="v5-badge v5-badge-orange">{isPt ? 'Saída não registada' : 'Départ non pointé'}</span>
  return <span className="v5-badge v5-badge-green">{isPt ? 'Em curso' : 'En cours'}</span>
}

const echapperRegExp = (texte: string) => texte.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const NOTE_COUPURE_ENREGISTREE = new RegExp(`${echapperRegExp(NOTE_DEPART_APRES_COUPURE)} ; dernière présence vue sur le chantier à (\\d{2}:\\d{2}) : à vérifier\\.`, 'g')

/**
 * Notes posées en français par le serveur (lib/btp/pointage-regles.ts) : traduites en portugais à l'affichage seulement,
 * la valeur enregistrée ne change pas ; un texte libre saisi par le gérant reste tel quel.
 */
function notesAffichees(notes: string, isPt: boolean): string {
  if (!isPt) return notes
  return notes
    .split(NOTE_A_REGULARISER).join('Saída não registada: a regularizar.')
    .split(NOTE_DOUBLON).join('Registo em duplicado: a verificar.')
    .replace(NOTE_COUPURE_ENREGISTREE, 'Saída registada manualmente após uma interrupção do acompanhamento GPS; última presença registada na obra às $1: a verificar.')
}

/**
 * Pointage refermé sans heures par le serveur (départ oublié, doublon) : à régulariser par le gérant. Départ pointé à la
 * main après une coupure du suivi GPS : à vérifier (la note donne la dernière présence vue sur le chantier).
 */
function badgeARegulariser(p: PointageLu, isPt: boolean) {
  const notes = p.notes ?? ''
  if (notes.includes(NOTE_A_REGULARISER) || notes.includes(NOTE_DOUBLON)) {
    return <span className="v5-badge v5-badge-orange" title={notesAffichees(notes, isPt)}>{isPt ? 'A regularizar' : 'À régulariser'}</span>
  }
  if (notes.includes(NOTE_DEPART_APRES_COUPURE)) {
    return <span className="v5-badge v5-badge-yellow" title={notesAffichees(notes, isPt)}>{isPt ? 'A verificar' : 'À vérifier'}</span>
  }
  return null
}

function badgeMode(p: PointageLu, isPt: boolean) {
  if (p.mode === 'geo_auto') return <span className="v5-badge v5-badge-blue">Auto (GPS)</span>
  if (p.mode === 'geo_confirme') return <span className="v5-badge v5-badge-green">{isPt ? 'No local' : 'Sur site'}</span>
  return <span className="v5-badge v5-badge-gray">{isPt ? 'Manual' : 'Manuel'}</span>
}

export function OngletHistorique({ artisan, isPt }: { artisan: Artisan; isPt: boolean }) {
  const userId = artisan?.user_id || ''
  const langueDates = isPt ? 'pt-PT' : 'fr-FR'
  const pointagesBtp = useBTPData<PointageLu>({ table: 'pointages', artisanId: artisan?.id || '', userId })
  const chantiersBtp = useBTPData<ChantierLu>({ table: 'chantiers', artisanId: artisan?.id || '', userId })
  const membresBtp = useBTPData<MembreLu>({ table: 'membres', artisanId: artisan?.id || '', userId })

  const [formulaireOuvert, setFormulaireOuvert] = useState(false)
  const [form, setForm] = useState(formulaireVide)
  const [filtreDate, setFiltreDate] = useState(aujourdhui())
  const [filtreEmploye, setFiltreEmploye] = useState('')
  const [filtreMode, setFiltreMode] = useState<FiltreMode>('tous')

  const pointages = pointagesBtp.items
  const jourCourant = aujourdhui()
  const chantiersEnCours = chantiersBtp.items.filter(c => c.statut === STATUT_EN_COURS)
  const membres = membresBtp.items.filter(m => m.actif !== false)
  // [valeur enregistrée, libellé] : la valeur portugaise d'origine « Chefe de obra » reste enregistrée telle quelle, seul
  // son libellé suit le glossaire (« Encarregado »).
  const postes: ReadonlyArray<[string, string]> = isPt
    ? [['Chefe de obra', 'Encarregado'], ['Pedreiro', 'Pedreiro'], ['Eletricista', 'Eletricista'], ['Canalizador', 'Canalizador'], ['Carpinteiro', 'Carpinteiro'], ['Pintor', 'Pintor'], ['Servente', 'Servente']]
    : ['Chef de chantier', 'Maçon', 'Électricien', 'Plombier', 'Charpentier', 'Peintre', 'Manoeuvre'].map(p => [p, p])

  const employes = useMemo(() => [...new Set(pointages.map(p => p.employe))].filter(Boolean), [pointages])
  const filtres = pointages.filter(p =>
    (!filtreDate || p.date === filtreDate)
    && (!filtreEmploye || p.employe === filtreEmploye)
    && (filtreMode === 'tous' || (filtreMode === 'manuel' ? (p.mode ?? 'manuel') === 'manuel' : (p.mode ?? 'manuel') !== 'manuel')),
  )
  const totalHeures = filtres.reduce((s, p) => s + (p.heuresTravaillees || 0), 0)

  const resumeSemaine = useMemo(() => {
    const { debut, fin } = semaineEnCours()
    const deLaSemaine = pointages.filter(p => p.date >= debut && p.date <= fin)
    return [...new Set(deLaSemaine.map(p => p.employe))].filter(Boolean).map(employe => {
      const parJour: Record<number, number> = {}
      let total = 0
      for (const p of deLaSemaine.filter(x => x.employe === employe)) {
        const jour = new Date(`${p.date}T12:00:00`).getDay()
        parJour[jour] = (parJour[jour] || 0) + (p.heuresTravaillees || 0)
        total += p.heuresTravaillees || 0
      }
      return { employe, parJour, total }
    })
  }, [pointages])

  const enregistrer = async () => {
    if (!form.employe) return
    const ajout = await pointagesBtp.add({
      ...form,
      heuresTravaillees: Math.round(calculerHeures(form.heureArrivee, form.heureDepart, form.pauseMinutes) * 100) / 100,
    } as Partial<PointageLu>)
    if (!ajout) {
      toast.error(isPt ? 'O registo não foi guardado.' : 'Le pointage n’a pas été enregistré.')
      return
    }
    setFormulaireOuvert(false)
    setForm(formulaireVide())
  }

  const exporterCsv = () => {
    const csv = pointagesEnCsv(filtres.map(p => ({
      date: p.date,
      employe: p.employe,
      chantier: p.chantier || '',
      heureArrivee: p.heureArrivee || '',
      heureDepart: p.heureDepart || '',
      heuresTravaillees: p.heuresTravaillees || 0,
      mode: p.mode || 'manuel',
    })), isPt)
    const url = URL.createObjectURL(new Blob(['﻿', csv], { type: 'text/csv;charset=utf-8' }))
    const lien = document.createElement('a')
    lien.href = url
    lien.download = `${isPt ? 'registos_de_horas' : 'pointages'}_${filtreDate || aujourdhui()}.csv`
    lien.click()
    URL.revokeObjectURL(url)
  }

  if (pointagesBtp.loading) {
    return <div className="v5-card" style={{ textAlign: 'center', color: GRIS, fontSize: 13 }}>{isPt ? 'A carregar…' : 'Chargement…'}</div>
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '.75rem' }}>
      <div>
        <button type="button" className="v5-btn v5-btn-p" onClick={() => setFormulaireOuvert(true)}>
          {isPt ? 'Registar manualmente' : 'Pointer manuellement'}
        </button>
      </div>

      {formulaireOuvert && (
        <div className="v5-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '.75rem' }}>
            <div className="v5-st" style={{ marginBottom: 0 }}>{isPt ? 'Novo registo' : 'Nouveau pointage'}</div>
            <button type="button" className="v5-btn v5-btn-sm" onClick={() => setFormulaireOuvert(false)} aria-label={isPt ? 'Fechar' : 'Fermer'}>✕</button>
          </div>
          <div className="v5-fr" style={{ marginBottom: '.75rem' }}>
            <div className="v5-fg">
              <label className="v5-fl" htmlFor="pointage-employe">{isPt ? 'Colaborador' : 'Employé'}</label>
              {membres.length > 0 ? (
                <select id="pointage-employe" className="v5-fi" value={form.membreId} onChange={e => {
                  const membre = membres.find(m => m.id === e.target.value)
                  setForm({ ...form, membreId: membre?.id || '', employe: membre ? [membre.prenom, membre.nom].filter(Boolean).join(' ') : '', poste: membre?.typeCompte || form.poste })
                }}>
                  <option value="">{isPt ? 'Selecionar' : 'Sélectionner'}</option>
                  {membres.map(m => <option key={m.id} value={m.id}>{[m.prenom, m.nom].filter(Boolean).join(' ')}</option>)}
                </select>
              ) : (
                <input id="pointage-employe" className="v5-fi" value={form.employe} onChange={e => setForm({ ...form, employe: e.target.value, membreId: '' })} />
              )}
            </div>
            <div className="v5-fg">
              <label className="v5-fl" htmlFor="pointage-poste">{isPt ? 'Função' : 'Poste'}</label>
              <select id="pointage-poste" className="v5-fi" value={form.poste} onChange={e => setForm({ ...form, poste: e.target.value })}>
                <option value="">{isPt ? 'Selecionar' : 'Sélectionner'}</option>
                {postes.map(([valeur, libelle]) => <option key={valeur} value={valeur}>{libelle}</option>)}
              </select>
            </div>
            <div className="v5-fg">
              <label className="v5-fl" htmlFor="pointage-chantier">{isPt ? 'Obra' : 'Chantier'}</label>
              {chantiersEnCours.length > 0 ? (
                <select id="pointage-chantier" className="v5-fi" value={form.chantierId} onChange={e => {
                  const chantier = chantiersEnCours.find(c => c.id === e.target.value)
                  setForm({ ...form, chantierId: chantier?.id || '', chantier: chantier?.titre || '' })
                }}>
                  <option value="">{isPt ? 'Selecionar' : 'Sélectionner'}</option>
                  {chantiersEnCours.map(c => <option key={c.id} value={c.id}>{c.titre}</option>)}
                </select>
              ) : (
                <input id="pointage-chantier" className="v5-fi" value={form.chantier} onChange={e => setForm({ ...form, chantier: e.target.value, chantierId: '' })} />
              )}
            </div>
            <div className="v5-fg">
              <label className="v5-fl" htmlFor="pointage-date">{isPt ? 'Data' : 'Date'}</label>
              <input id="pointage-date" type="date" className="v5-fi" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} />
            </div>
            <div className="v5-fg">
              <label className="v5-fl" htmlFor="pointage-arrivee">{isPt ? 'Chegada' : 'Arrivée'}</label>
              <input id="pointage-arrivee" type="time" className="v5-fi" value={form.heureArrivee} onChange={e => setForm({ ...form, heureArrivee: e.target.value })} />
            </div>
            <div className="v5-fg">
              <label className="v5-fl" htmlFor="pointage-depart">{isPt ? 'Saída' : 'Départ'}</label>
              <input id="pointage-depart" type="time" className="v5-fi" value={form.heureDepart} onChange={e => setForm({ ...form, heureDepart: e.target.value })} />
            </div>
            <div className="v5-fg">
              <label className="v5-fl" htmlFor="pointage-pause">{isPt ? 'Pausa (min)' : 'Pause (min)'}</label>
              <input id="pointage-pause" type="number" min={0} className="v5-fi" value={form.pauseMinutes} onChange={e => setForm({ ...form, pauseMinutes: Number(e.target.value) })} />
            </div>
            <div className="v5-fg">
              <label className="v5-fl" htmlFor="pointage-notes">{isPt ? 'Notas' : 'Notes'}</label>
              <input id="pointage-notes" className="v5-fi" value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} />
            </div>
          </div>
          <div className="v5-al info" style={{ marginBottom: 12 }}>
            {isPt ? 'Horas:' : 'Heures :'} <strong>{formatHeures(calculerHeures(form.heureArrivee, form.heureDepart, form.pauseMinutes))}</strong>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="button" className="v5-btn v5-btn-p" onClick={() => { void enregistrer() }} disabled={!form.employe}>
              {isPt ? 'Guardar' : 'Enregistrer'}
            </button>
            <button type="button" className="v5-btn" onClick={() => setFormulaireOuvert(false)}>{isPt ? 'Cancelar' : 'Annuler'}</button>
          </div>
        </div>
      )}

      <div className="v5-card" style={{ overflowX: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: '.65rem' }}>
          <div className="v5-st" style={{ marginBottom: 0 }}>
            {filtreDate
              ? new Date(`${filtreDate}T12:00:00`).toLocaleDateString(langueDates, { weekday: 'long', day: 'numeric', month: 'long' })
              : (isPt ? 'Todos os registos' : 'Tous les pointages')}
          </div>
          <div className="v5-search" style={{ marginBottom: 0 }}>
            <input type="date" aria-label={isPt ? 'Data' : 'Date'} className="v5-search-in" style={{ minWidth: 140, flex: 'none' }} value={filtreDate} onChange={e => setFiltreDate(e.target.value)} />
            <select aria-label={isPt ? 'Colaborador' : 'Employé'} className="v5-filter-sel" value={filtreEmploye} onChange={e => setFiltreEmploye(e.target.value)}>
              <option value="">{isPt ? 'Todos' : 'Tous'}</option>
              {employes.map(e => <option key={e} value={e}>{e}</option>)}
            </select>
            <select aria-label={isPt ? 'Método' : 'Méthode'} className="v5-filter-sel" value={filtreMode} onChange={e => setFiltreMode(e.target.value as FiltreMode)}>
              <option value="tous">{isPt ? 'Todos os métodos' : 'Toutes méthodes'}</option>
              <option value="auto">{isPt ? 'Automático (GPS)' : 'Automatique (GPS)'}</option>
              <option value="manuel">{isPt ? 'Manual' : 'Manuel'}</option>
            </select>
            <button type="button" className="v5-btn v5-btn-sm" onClick={() => setFiltreDate('')}>{isPt ? 'Ver tudo' : 'Voir tout'}</button>
          </div>
        </div>
        <table className="v5-dt">
          <thead>
            <tr>
              <th>{isPt ? 'Colaborador' : 'Employé'}</th>
              <th>{isPt ? 'Data' : 'Date'}</th>
              <th>{isPt ? 'Obra' : 'Chantier'}</th>
              <th>{isPt ? 'Chegada' : 'Arrivée'}</th>
              <th>{isPt ? 'Saída' : 'Départ'}</th>
              <th>{isPt ? 'Horas' : 'Heures'}</th>
              <th>{isPt ? 'Método' : 'Méthode'}</th>
              <th><span className="sr-only">{isPt ? 'Ações' : 'Actions'}</span></th>
            </tr>
          </thead>
          <tbody>
            {filtres.length === 0 ? (
              <tr><td colSpan={8} style={{ textAlign: 'center', padding: 24, color: GRIS }}>{isPt ? 'Nenhum registo' : 'Aucun pointage'}</td></tr>
            ) : filtres.map(p => (
              <tr key={p.id}>
                <td style={{ fontWeight: 600 }}>{p.employe}</td>
                <td>{new Date(`${p.date}T12:00:00`).toLocaleDateString(langueDates, { day: '2-digit', month: 'short' })}</td>
                <td>{p.chantier || '—'}</td>
                <td>{(p.heureArrivee || '').slice(0, 5)}</td>
                <td>{celluleDepart(p, jourCourant, isPt)}</td>
                <td style={{ fontWeight: 600 }}>{p.heureDepart ? formatHeures(p.heuresTravaillees || 0) : '—'}</td>
                <td>{badgeMode(p, isPt)} {badgeARegulariser(p, isPt)}</td>
                <td>
                  <button
                    type="button"
                    className="v5-btn v5-btn-sm v5-btn-d"
                    aria-label={`${isPt ? 'Eliminar o registo de' : 'Supprimer le pointage de'} ${p.employe}`}
                    onClick={() => { void pointagesBtp.remove(p.id) }}
                  >
                    ✕
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div style={{ marginTop: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap', fontSize: 11, color: GRIS }}>
          <span>{filtres.length} {isPt ? 'registo(s)' : 'pointage(s)'}{isPt ? ' · ' : ' — '}<strong>{formatHeures(totalHeures)}</strong></span>
          <button type="button" className="v5-btn v5-btn-sm" onClick={exporterCsv} disabled={filtres.length === 0}>
            {isPt ? 'Exportar CSV' : 'Exporter CSV'}
          </button>
        </div>
      </div>

      <div className="v5-card">
        <div className="v5-st">{isPt ? 'Resumo da semana' : 'Résumé de la semaine'}</div>
        <table className="v5-dt">
          <thead>
            <tr>
              <th>{isPt ? 'Colaborador' : 'Employé'}</th>
              {JOURS.map(([fr, pt]) => <th key={fr}>{isPt ? pt : fr}</th>)}
              <th>Total</th>
            </tr>
          </thead>
          <tbody>
            {resumeSemaine.length === 0 ? (
              <tr><td colSpan={JOURS.length + 2} style={{ textAlign: 'center', padding: 16, color: GRIS }}>{isPt ? 'Sem dados esta semana' : 'Aucune donnée cette semaine'}</td></tr>
            ) : resumeSemaine.map(ligne => (
              <tr key={ligne.employe}>
                <td style={{ fontWeight: 600 }}>{ligne.employe}</td>
                {JOURS.map(([fr, , jour]) => <td key={fr}>{ligne.parJour[jour] ? formatHeures(ligne.parJour[jour]) : '—'}</td>)}
                <td style={{ fontWeight: 600 }}>{formatHeures(ligne.total)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
