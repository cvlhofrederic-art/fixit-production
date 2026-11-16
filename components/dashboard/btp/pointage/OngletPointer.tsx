'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { MapPin, Satellite } from 'lucide-react'
import { CONFIRMATION_ARRIVEE_MS, CONFIRMATION_DEPART_MS, distanceAuChantierM, type ChantierPointable } from '@/lib/btp/pointage-geo'
import { chantierPointable, libelleMode, type ContextePointage } from '@/lib/btp/pointage-regles'
import type { CorpsPointage, ResultatEnvoi } from './useContextePointage'
import { usePointageAuto, type StatutGps } from './usePointageAuto'
import { formatDistance, formatHeures, messageErreurPointage, noticePointage } from './textes'

// Onglet « Pointer » : le pointage de la personne connectée (employé ou gérant ayant sa fiche dans Équipes), sur les
// chantiers en cours qui lui sont affectés — automatique dans le rayon du chantier, ou à la main.

interface Props {
  contexte: ContextePointage
  isPt: boolean
  envoyer: (corps: CorpsPointage) => Promise<ResultatEnvoi>
  recharger: () => Promise<void>
}

const aujourdhui = (instant: number): string => {
  const d = new Date(instant)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** Lundi de la semaine de l'instant (heure locale), au format AAAA-MM-JJ. */
const lundi = (instant: number): string => {
  const d = new Date(instant)
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7))
  return aujourdhui(d.getTime())
}

const hhmm = (heure: string | null | undefined): string => (heure ? heure.slice(0, 5) : '')

/** Instant (heure locale du téléphone) d'une date AAAA-MM-JJ et d'une heure HH:MM[:SS] ; NaN si illisible. */
const instantLocal = (date: string, heure: string): number => {
  const secondes = /^\d{2}:\d{2}:\d{2}/.test(heure) ? heure.slice(0, 8) : `${heure.slice(0, 5)}:00`
  return Date.parse(`${date}T${secondes}`)
}

const chrono = (secondes: number): string => {
  const s = Math.max(0, secondes)
  return [Math.floor(s / 3600), Math.floor((s % 3600) / 60), s % 60].map(n => String(n).padStart(2, '0')).join(':')
}

function texteStatut(statut: StatutGps, isPt: boolean): string {
  const textes: Record<StatutGps, [string, string]> = {
    arrete: ['Désactivé', 'Desativada'],
    recherche: ['Recherche de votre position…', 'À procura da sua posição…'],
    actif: ['Actif : le pointage démarre dès votre arrivée dans le rayon d’un de vos chantiers.', 'Ativa: a marcação começa quando chegar ao raio de uma das suas obras.'],
    refuse: ['Localisation refusée : autorisez-la pour vitfix.io dans les réglages du navigateur, ou pointez à la main.', 'Localização recusada: autorize-a para vitfix.io nas definições do navegador, ou marque manualmente.'],
    indisponible: ['Position introuvable pour le moment : nouvel essai automatique.', 'Posição indisponível de momento: nova tentativa automática.'],
    non_supporte: ['Ce navigateur ne permet pas la localisation : pointez à la main.', 'Este navegador não permite a localização: marque manualmente.'],
  }
  return isPt ? textes[statut][1] : textes[statut][0]
}

export function OngletPointer({ contexte, isPt, envoyer, recharger }: Props) {
  const enCours = contexte.pointageEnCours
  const [avis, setAvis] = useState<string | null>(null)
  const [actionManuelle, setActionManuelle] = useState(false)
  const [maintenant, setMaintenant] = useState(() => Date.now())

  const chantiersPointables = useMemo(
    () => contexte.chantiers.map(chantierPointable).filter((c): c is ChantierPointable => c !== null),
    [contexte.chantiers],
  )

  const pointerArrivee = useCallback(async (chantierId: string, observeA: number) => {
    const resultat = await envoyer({ action: 'arrivee', chantierId, mode: 'geo_auto', observeA })
    if (!resultat.ok) {
      setAvis(messageErreurPointage(resultat.code, isPt))
      return false
    }
    setAvis(null)
    toast.success(isPt ? 'Chegada registada automaticamente' : 'Arrivée pointée automatiquement')
    await recharger()
    return true
  }, [envoyer, isPt, recharger])

  const pointerDepart = useCallback(async (_chantierId: string, observeA: number) => {
    const resultat = await envoyer({ action: 'depart', mode: 'geo_auto', observeA })
    if (!resultat.ok && resultat.code !== 'aucun_pointage_en_cours') {
      setAvis(messageErreurPointage(resultat.code, isPt))
      return false
    }
    setAvis(null)
    if (resultat.ok) toast.success(isPt ? 'Saída registada automaticamente' : 'Départ pointé automatiquement')
    await recharger()
    return true
  }, [envoyer, isPt, recharger])

  const auto = usePointageAuto({
    autorise: contexte.pointageAutoActive && contexte.rattachement === 'relie' && chantiersPointables.length > 0,
    chantiers: chantiersPointables,
    chantierActifId: enCours?.chantierId ?? null,
    pointerArrivee,
    pointerDepart,
  })

  const autoActif = auto.statut === 'actif' || auto.statut === 'recherche' || auto.statut === 'indisponible'
  useEffect(() => {
    if (!enCours && !autoActif) return
    const minuteur = setInterval(() => setMaintenant(Date.now()), 1000)
    return () => clearInterval(minuteur)
  }, [enCours, autoActif])

  const manuel = async (corps: CorpsPointage, succes: string) => {
    setActionManuelle(true)
    try {
      const resultat = await envoyer(corps)
      if (!resultat.ok) {
        toast.error(messageErreurPointage(resultat.code, isPt))
        return
      }
      toast.success(succes)
      await recharger()
    } finally {
      setActionManuelle(false)
    }
  }

  const notice = noticePointage(isPt)

  if (contexte.rattachement !== 'relie') {
    return (
      <div className="v5-card">
        <div className="v5-st">{isPt ? 'Marcar as minhas horas' : 'Pointer mes heures'}</div>
        <div className="v5-al warn">
          {contexte.rattachement === 'ambigu'
            ? (isPt
              ? 'Várias fichas de colaborador (Equipas) têm o e-mail da sua conta: peça ao seu responsável para manter só uma.'
              : 'Plusieurs fiches employé (Équipes) portent l’adresse e-mail de votre compte : demandez à votre responsable de n’en garder qu’une.')
            : contexte.gerant
              ? (isPt
                ? 'Para marcar as suas próprias horas, adicione-se em Equipas com o e-mail desta conta.'
                : 'Pour pointer vous-même, ajoutez-vous dans Équipes avec l’adresse e-mail de ce compte.')
              : (isPt
                ? 'A sua conta não está ligada a nenhuma ficha de colaborador: peça ao seu responsável para indicar o seu e-mail na sua ficha (módulo Equipas).'
                : 'Votre compte n’est relié à aucune fiche employé : demandez à votre responsable d’indiquer votre adresse e-mail sur votre fiche (module Équipes).')}
        </div>
      </div>
    )
  }

  const debutEnCours = enCours ? instantLocal(enCours.date, enCours.heureArrivee) : Number.NaN
  const ecoule = Number.isFinite(debutEnCours) ? Math.floor((maintenant - debutEnCours) / 1000) : 0
  const candidat = auto.etat.candidat ? contexte.chantiers.find(c => c.id === auto.etat.candidat?.chantierId) : undefined
  const resteArrivee = auto.etat.candidat ? Math.ceil((CONFIRMATION_ARRIVEE_MS - (maintenant - auto.etat.candidat.depuis)) / 1000) : 0
  const resteDepart = auto.etat.horsZoneDepuis !== null ? Math.ceil((CONFIRMATION_DEPART_MS - (maintenant - auto.etat.horsZoneDepuis)) / 1000) : 0

  const jour = aujourdhui(maintenant)
  const debutSemaine = lundi(maintenant)
  const heuresJour = contexte.historique.filter(p => p.date === jour).reduce((s, p) => s + p.heuresTravaillees, 0)
  const heuresSemaine = contexte.historique.filter(p => p.date >= debutSemaine).reduce((s, p) => s + p.heuresTravaillees, 0)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '.75rem' }}>
      <div className="v5-al info">
        <strong>{notice.titre}</strong>
        <ul style={{ margin: '6px 0 0', paddingLeft: 18 }}>
          {notice.points.map(point => <li key={point}>{point}</li>)}
        </ul>
      </div>

      {/* ── Pointage en cours ── */}
      <div className="v5-card" aria-live="polite">
        {enCours ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <span aria-hidden="true" style={{ width: 12, height: 12, borderRadius: '50%', background: '#4CAF50', boxShadow: '0 0 0 4px rgba(76,175,80,.2)' }} />
            <div style={{ flex: 1, minWidth: 180 }}>
              <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em', color: '#2E7D32' }}>
                {isPt ? 'Marcação em curso' : 'Pointage en cours'}
              </div>
              <div style={{ fontWeight: 600, fontSize: 15 }}>{enCours.chantierNom || '—'}</div>
              <div style={{ fontSize: 12, color: '#666' }}>
                {isPt ? 'Chegada às' : 'Arrivée à'} {hhmm(enCours.heureArrivee)} · {libelleMode(enCours.mode, isPt)}
              </div>
            </div>
            <div style={{ fontFamily: 'monospace', fontSize: 22, fontWeight: 700 }}>{chrono(ecoule)}</div>
            <button
              type="button"
              className="v5-btn v5-btn-d"
              disabled={actionManuelle}
              onClick={() => { void manuel({ action: 'depart', mode: 'manuel' }, isPt ? 'Saída registada' : 'Départ pointé') }}
            >
              {isPt ? 'Terminar a marcação' : 'Terminer le pointage'}
            </button>
          </div>
        ) : (
          <div style={{ fontSize: 13, color: '#666' }}>{isPt ? 'Nenhuma marcação em curso.' : 'Aucun pointage en cours.'}</div>
        )}
      </div>

      {/* ── Pointage automatique ── */}
      <div className="v5-card">
        <div className="v5-st" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Satellite size={14} aria-hidden="true" /> {isPt ? 'Marcação automática' : 'Pointage automatique'}
        </div>
        {contexte.pointageAutoActive ? (
          <>
            <p style={{ fontSize: 13, margin: '0 0 10px' }}>{texteStatut(auto.statut, isPt)}</p>
            {candidat && resteArrivee > 0 && (
              <div className="v5-al info" style={{ marginBottom: 10 }}>
                {isPt
                  ? `Chegada detetada em ${candidat.titre}: marcação dentro de ${resteArrivee} s.`
                  : `Arrivée détectée sur ${candidat.titre} : pointage dans ${resteArrivee} s.`}
              </div>
            )}
            {enCours && auto.etat.horsZoneDepuis !== null && resteDepart > 0 && (
              <div className="v5-al warn" style={{ marginBottom: 10 }}>
                {isPt
                  ? `Saiu da zona da obra: saída registada dentro de ${resteDepart} s, se não voltar.`
                  : `Sortie de la zone du chantier : départ pointé dans ${resteDepart} s si vous n’y revenez pas.`}
              </div>
            )}
            {avis && <div className="v5-al warn" style={{ marginBottom: 10 }}>{avis}</div>}
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
              {autoActif ? (
                <button type="button" className="v5-btn v5-btn-s" onClick={auto.arreter}>
                  {isPt ? 'Parar a marcação automática' : 'Arrêter le pointage automatique'}
                </button>
              ) : (
                <button type="button" className="v5-btn v5-btn-p" onClick={auto.demarrer} disabled={chantiersPointables.length === 0}>
                  {isPt ? 'Ativar a marcação automática' : 'Activer le pointage automatique'}
                </button>
              )}
              {auto.envoiEnCours && <span style={{ fontSize: 12, color: '#666' }}>{isPt ? 'A registar…' : 'Enregistrement…'}</span>}
            </div>
            <p style={{ fontSize: 11, color: '#888', margin: '10px 0 0' }}>
              {isPt
                ? 'Mantenha esta página aberta: o navegador para a localização quando a página é fechada ou o telemóvel entra em suspensão.'
                : 'Gardez cette page ouverte : le navigateur arrête la localisation quand la page est fermée ou le téléphone en veille.'}
            </p>
          </>
        ) : (
          <p style={{ fontSize: 13, margin: 0 }}>
            {contexte.gerant
              ? (isPt
                ? 'Desativada para a sua empresa. Pode ativá-la no separador Atribuições; entretanto, marque manualmente.'
                : 'Désactivé pour votre société. Vous pouvez l’activer dans l’onglet Affectations ; en attendant, pointez à la main.')
              : (isPt
                ? 'Não ativada pela sua entidade empregadora: marque manualmente a partir da lista das suas obras.'
                : 'Non activé par votre employeur : pointez à la main depuis la liste de vos chantiers.')}
          </p>
        )}
      </div>

      {/* ── Mes chantiers ── */}
      <div className="v5-card">
        <div className="v5-st" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <MapPin size={14} aria-hidden="true" /> {isPt ? 'As minhas obras em curso' : 'Mes chantiers en cours'}
        </div>
        {contexte.chantiers.length === 0 ? (
          <p style={{ fontSize: 13, color: '#666', margin: 0 }}>
            {isPt
              ? 'Nenhuma obra em curso lhe está atribuída. O seu responsável atribui-as em Marcação de horas › Atribuições.'
              : 'Aucun chantier en cours ne vous est affecté. Votre responsable vous affecte depuis Pointage › Affectations.'}
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {contexte.chantiers.map(chantier => {
              const pointable = chantiersPointables.find(c => c.id === chantier.id)
              const distance = pointable && auto.lecture ? distanceAuChantierM(auto.lecture, pointable) : null
              const surPlace = distance !== null && distance <= chantier.rayonM
              const actif = enCours?.chantierId === chantier.id
              return (
                <div key={chantier.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', border: `1px solid ${surPlace ? '#4CAF50' : '#E8E8E8'}`, borderRadius: 8, flexWrap: 'wrap' }}>
                  <div style={{ flex: 1, minWidth: 180 }}>
                    <div style={{ fontWeight: 600, fontSize: 13 }}>
                      {chantier.titre}{' '}
                      {actif && <span className="v5-badge v5-badge-green">{isPt ? 'Em curso' : 'En cours'}</span>}
                    </div>
                    <div style={{ fontSize: 11, color: '#888' }}>
                      {chantier.adresse || '—'} · {pointable
                        ? `${isPt ? 'raio' : 'rayon'} ${chantier.rayonM} m`
                        : (isPt ? 'sem posição GPS: marcação manual' : 'sans position GPS : pointage à la main')}
                    </div>
                  </div>
                  {distance !== null && (
                    <span style={{ fontWeight: 700, fontSize: 13, color: surPlace ? '#2E7D32' : '#888' }}>{formatDistance(distance, isPt)}</span>
                  )}
                  <button
                    type="button"
                    className="v5-btn v5-btn-sm"
                    disabled={actif || actionManuelle}
                    onClick={() => { void manuel({ action: 'arrivee', chantierId: chantier.id, mode: 'manuel' }, isPt ? 'Chegada registada' : 'Arrivée pointée') }}
                  >
                    {actif ? (isPt ? 'No local' : 'Sur place') : (isPt ? 'Marcar aqui' : 'Pointer ici')}
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* ── Mes pointages ── */}
      <div className="v5-card">
        <div className="v5-st">{isPt ? 'As minhas marcações (31 dias)' : 'Mes pointages (31 jours)'}</div>
        <div className="v5-kpi-g" style={{ marginBottom: 10 }}>
          <div className="v5-kpi">
            <div className="v5-kpi-l">{isPt ? 'Hoje' : 'Aujourd’hui'}</div>
            <div className="v5-kpi-v">{formatHeures(heuresJour)}</div>
          </div>
          <div className="v5-kpi">
            <div className="v5-kpi-l">{isPt ? 'Esta semana' : 'Cette semaine'}</div>
            <div className="v5-kpi-v">{formatHeures(heuresSemaine)}</div>
          </div>
        </div>
        {contexte.historique.length === 0 ? (
          <p style={{ fontSize: 13, color: '#666', margin: 0 }}>{isPt ? 'Nenhuma marcação.' : 'Aucun pointage.'}</p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="v5-dt">
              <thead>
                <tr>
                  <th>{isPt ? 'Data' : 'Date'}</th>
                  <th>{isPt ? 'Obra' : 'Chantier'}</th>
                  <th>{isPt ? 'Chegada' : 'Arrivée'}</th>
                  <th>{isPt ? 'Saída' : 'Départ'}</th>
                  <th>{isPt ? 'Horas' : 'Heures'}</th>
                  <th>{isPt ? 'Método' : 'Méthode'}</th>
                </tr>
              </thead>
              <tbody>
                {contexte.historique.map(p => (
                  <tr key={p.id}>
                    <td>{new Date(`${p.date}T12:00:00`).toLocaleDateString(isPt ? 'pt-PT' : 'fr-FR', { weekday: 'short', day: '2-digit', month: 'short' })}</td>
                    <td>{p.chantierNom || '—'}</td>
                    <td>{hhmm(p.heureArrivee)}</td>
                    <td>{p.heureDepart ? hhmm(p.heureDepart) : <span className="v5-badge v5-badge-green">{isPt ? 'Em curso' : 'En cours'}</span>}</td>
                    <td>{p.heureDepart ? formatHeures(p.heuresTravaillees) : '—'}</td>
                    <td>{libelleMode(p.mode, isPt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
