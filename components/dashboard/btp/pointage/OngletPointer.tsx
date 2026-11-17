'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { MapPin, Satellite } from 'lucide-react'
import { CONFIRMATION_ARRIVEE_MS, CONFIRMATION_DEPART_MS, distanceAuChantierM, type ChantierPointable } from '@/lib/btp/pointage-geo'
import { chantierPointable, libelleMode, type ContextePointage, type PointageEcran } from '@/lib/btp/pointage-regles'
import type { CorpsPointage, EnvoyerPointage } from './useContextePointage'
import { usePointageAuto, type StatutGps } from './usePointageAuto'
import { useArrierePlan } from './useArrierePlan'
import { CarteTelephoneEnPoche } from './CarteTelephoneEnPoche'
import {
  formatDistance,
  formatHeures,
  libelleBoutonChantier,
  messageAutoDesactive,
  messageErreurPointage,
  messageNonRelie,
  messageRemplaceParArrierePlan,
  messageSortieSansTrace,
  noticePointage,
} from './textes'

// Onglet « Pointer » : le pointage de la personne connectée (employé ou gérant ayant sa fiche dans Équipes), sur les
// chantiers en cours qui lui sont affectés — automatique dans le rayon du chantier, ou à la main. Le téléphone ne
// termine tout seul qu'un pointage commencé automatiquement ; un pointage commencé à la main se termine à la main.

interface Props {
  contexte: ContextePointage
  isPt: boolean
  envoyer: EnvoyerPointage
  recharger: () => Promise<void>
}

/** Texte secondaire : gris assez foncé pour un contraste lisible en petite taille. */
const GRIS = '#555'

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

const dateCourte = (date: string, isPt: boolean) =>
  new Date(`${date}T12:00:00`).toLocaleDateString(isPt ? 'pt-PT' : 'fr-FR', { day: '2-digit', month: 'short' })

/** Refus qui viennent d'un changement fait par le gérant entre-temps : on relit le contexte (la détection suit). */
const REFUS_QUI_CHANGENT_LE_CONTEXTE = new Set([
  'pointage_auto_desactive', 'chantier_non_affecte', 'chantier_sans_position', 'fiche_absente', 'fiche_ambigue', 'pointage_different',
])

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

/** Cellule « Départ » d'un pointage : heure, « En cours » (aujourd'hui) ou « Départ non pointé » (jour précédent). */
function celluleDepart(p: PointageEcran, jour: string, isPt: boolean) {
  if (p.heureDepart) return hhmm(p.heureDepart)
  if (p.date < jour) return <span className="v5-badge v5-badge-orange">{isPt ? 'Saída não marcada' : 'Départ non pointé'}</span>
  return <span className="v5-badge v5-badge-green">{isPt ? 'Em curso' : 'En cours'}</span>
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
  // Pointage commencé à la main : le mode automatique attend qu'il soit terminé à la main.
  const pointageManuelEnCours = enCours !== null && enCours.mode !== 'geo_auto'

  const pointerArrivee = useCallback(async (chantierId: string, observeA: number) => {
    const resultat = await envoyer({ action: 'arrivee', chantierId, mode: 'geo_auto', observeA })
    if (!resultat.ok) {
      setAvis(messageErreurPointage(resultat.code, isPt))
      if (REFUS_QUI_CHANGENT_LE_CONTEXTE.has(resultat.code)) await recharger()
      return false
    }
    setAvis(null)
    toast.success(isPt ? 'Chegada registada automaticamente' : 'Arrivée pointée automatiquement')
    await recharger()
    return true
  }, [envoyer, isPt, recharger])

  const pointerDepart = useCallback(async (chantierId: string, observeA: number) => {
    const resultat = await envoyer({ action: 'depart', chantierId, mode: 'geo_auto', observeA })
    if (!resultat.ok && resultat.code !== 'aucun_pointage_en_cours') {
      setAvis(messageErreurPointage(resultat.code, isPt))
      if (REFUS_QUI_CHANGENT_LE_CONTEXTE.has(resultat.code)) await recharger()
      return false
    }
    setAvis(null)
    if (resultat.ok) toast.success(isPt ? 'Saída registada automaticamente' : 'Départ pointé automatiquement')
    await recharger()
    return true
  }, [envoyer, isPt, recharger])

  // Appli Vitfix Pro : pointage téléphone en poche. Quand il est actif sur ce téléphone, le système suit les zones des
  // chantiers et le pointage page ouverte s'efface (un seul des deux pointe, jamais les deux à la fois).
  const arrierePlan = useArrierePlan({ contexte, chantiers: chantiersPointables, envoyer, recharger, isPt })
  // Autorisation « Toujours » retirée depuis l'activation : rien ne pointe en arrière-plan, la page ouverte reprend.
  // Zones en partie indisponibles : le téléphone peut encore pointer, la page ouverte ne reprend pas (un pointage
  // qu'elle ouvrirait primerait sur ses envois et ne serait refermé par personne).
  const pointeEnArrierePlan = arrierePlan.etat === 'actif' || arrierePlan.etat === 'zones_indisponibles'

  const auto = usePointageAuto({
    autorise: contexte.pointageAutoActive && contexte.rattachement === 'relie' && chantiersPointables.length > 0
      && !pointageManuelEnCours && !pointeEnArrierePlan,
    chantiers: chantiersPointables,
    chantierActifId: enCours?.mode === 'geo_auto' ? enCours.chantierId : null,
    chantierEnCoursId: enCours?.chantierId ?? null,
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
        // Changement fait ailleurs entre-temps (gérant, autre appareil, minuit passé page ouverte) : on relit l'écran.
        if (REFUS_QUI_CHANGENT_LE_CONTEXTE.has(resultat.code) || resultat.code === 'aucun_pointage_en_cours') await recharger()
        return
      }
      toast.success(succes)
      await recharger()
    } finally {
      setActionManuelle(false)
    }
  }

  /** Fin à la main ; après une coupure du suivi, la dernière présence vue part avec, pour une note au gérant. */
  const terminer = () => {
    const corps: Extract<CorpsPointage, { action: 'depart' }> = { action: 'depart', mode: 'manuel' }
    if (enCours?.mode === 'geo_auto' && auto.etat.sortieSansTrace && auto.etat.derniereDansZone !== null) {
      corps.derniereVue = auto.etat.derniereDansZone
    }
    void manuel(corps, isPt ? 'Saída registada' : 'Départ pointé')
  }

  const notice = noticePointage(isPt)

  if (contexte.rattachement !== 'relie') {
    return (
      <div className="v5-card">
        <div className="v5-st">{isPt ? 'Marcar as minhas horas' : 'Pointer mes heures'}</div>
        <div className="v5-al warn">{messageNonRelie(contexte.rattachement, contexte.gerant, isPt)}</div>
      </div>
    )
  }

  const debutEnCours = enCours ? instantLocal(enCours.date, enCours.heureArrivee) : Number.NaN
  const ecoule = Number.isFinite(debutEnCours) ? Math.floor((maintenant - debutEnCours) / 1000) : 0
  const candidat = auto.etat.candidat ? contexte.chantiers.find(c => c.id === auto.etat.candidat?.chantierId) : undefined
  const chantierBloque = autoActif && auto.etat.chantierBloque ? contexte.chantiers.find(c => c.id === auto.etat.chantierBloque) : undefined
  const resteArrivee = auto.etat.candidat ? Math.ceil((CONFIRMATION_ARRIVEE_MS - (maintenant - auto.etat.candidat.depuis)) / 1000) : 0
  const resteDepart = auto.etat.horsZoneDepuis === null ? 0 : Math.ceil((CONFIRMATION_DEPART_MS - (maintenant - auto.etat.horsZoneDepuis)) / 1000)

  const attenteManuel = isPt
    ? 'Marcação manual em curso: a marcação automática retoma depois de a terminar.'
    : 'Pointage à la main en cours : le pointage automatique reprendra quand vous l’aurez terminé.'
  // Carte du pointage page ouverte sans ses commandes : mode coupé par le gérant, ou téléphone en poche actif ici.
  const texteSansPageOuverte = pointeEnArrierePlan ? messageRemplaceParArrierePlan(isPt) : messageAutoDesactive(contexte.gerant, isPt)
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

      {contexte.pointagesOublies.length > 0 && (
        <div className="v5-al warn">
          {isPt ? 'Saída não marcada em ' : 'Départ non pointé le '}
          {contexte.pointagesOublies.map(p => `${dateCourte(p.date, isPt)} (${p.chantierNom || '—'})`).join(', ')}
          {isPt
            ? ': estas marcações serão fechadas sem horas e o seu responsável regulariza-as.'
            : ' : ces pointages seront refermés sans heures et votre responsable les régularisera.'}
        </div>
      )}

      {/* ── Pointage en cours ── */}
      <div className="v5-card">
        {enCours ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <span aria-hidden="true" style={{ width: 12, height: 12, borderRadius: '50%', background: '#4CAF50', boxShadow: '0 0 0 4px rgba(76,175,80,.2)' }} />
            <div style={{ flex: 1, minWidth: 180 }}>
              <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em', color: '#2E7D32' }}>
                {isPt ? 'Marcação em curso' : 'Pointage en cours'}
              </div>
              <div style={{ fontWeight: 600, fontSize: 15 }}>{enCours.chantierNom || '—'}</div>
              <div style={{ fontSize: 12, color: GRIS }}>
                {isPt ? 'Chegada às' : 'Arrivée à'} {hhmm(enCours.heureArrivee)}{' · '}{libelleMode(enCours.mode, isPt)}
              </div>
            </div>
            <div style={{ fontFamily: 'monospace', fontSize: 22, fontWeight: 700 }}>{chrono(ecoule)}</div>
            <button
              type="button"
              className="v5-btn v5-btn-d"
              disabled={actionManuelle}
              onClick={terminer}
            >
              {isPt ? 'Terminar a marcação' : 'Terminer le pointage'}
            </button>
          </div>
        ) : (
          <div style={{ fontSize: 13, color: GRIS }}>{isPt ? 'Nenhuma marcação em curso.' : 'Aucun pointage en cours.'}</div>
        )}
      </div>

      {/* ── Pointage automatique ── */}
      <div className="v5-card">
        <div className="v5-st" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Satellite size={14} aria-hidden="true" /> {isPt ? 'Marcação automática' : 'Pointage automatique'}
        </div>
        {contexte.pointageAutoActive && !pointeEnArrierePlan ? (
          <>
            <p style={{ fontSize: 13, margin: '0 0 10px' }}>{pointageManuelEnCours ? attenteManuel : texteStatut(auto.statut, isPt)}</p>
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
            {enCours && auto.etat.sortieSansTrace && (
              <div className="v5-al warn" style={{ marginBottom: 10 }}>{messageSortieSansTrace(auto.etat.derniereDansZone, isPt)}</div>
            )}
            {!enCours && chantierBloque && (
              <div className="v5-al info" style={{ marginBottom: 10 }}>
                {isPt
                  ? `Marcação terminada em ${chantierBloque.titre}: a chegada automática só volta a funcionar nesta obra depois de sair da zona. Para retomar já, marque manualmente.`
                  : `Pointage terminé sur ${chantierBloque.titre} : l’arrivée automatique n’y reprendra qu’après votre sortie de la zone. Pour reprendre tout de suite, pointez à la main.`}
              </div>
            )}
            {avis && <div className="v5-al warn" style={{ marginBottom: 10 }}>{avis}</div>}
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
              {autoActif ? (
                <button type="button" className="v5-btn v5-btn-s" onClick={auto.arreter}>
                  {isPt ? 'Parar a marcação automática' : 'Arrêter le pointage automatique'}
                </button>
              ) : (
                <button
                  type="button"
                  className="v5-btn v5-btn-p"
                  onClick={auto.demarrer}
                  disabled={chantiersPointables.length === 0 || pointageManuelEnCours}
                >
                  {isPt ? 'Ativar a marcação automática' : 'Activer le pointage automatique'}
                </button>
              )}
              {auto.envoiEnCours && <span style={{ fontSize: 12, color: GRIS }}>{isPt ? 'A registar…' : 'Enregistrement…'}</span>}
            </div>
            <p style={{ fontSize: 12, color: GRIS, margin: '10px 0 0' }}>
              {isPt
                ? 'Mantenha esta página aberta: o navegador para a localização quando a página é fechada ou o telemóvel entra em suspensão.'
                : 'Gardez cette page ouverte : le navigateur arrête la localisation quand la page est fermée ou le téléphone en veille.'}
            </p>
          </>
        ) : (
          <p style={{ fontSize: 13, margin: 0 }}>{texteSansPageOuverte}</p>
        )}
      </div>

      <CarteTelephoneEnPoche arrierePlan={arrierePlan} isPt={isPt} />

      {/* ── Mes chantiers ── */}
      <div className="v5-card">
        <div className="v5-st" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <MapPin size={14} aria-hidden="true" /> {isPt ? 'As minhas obras em curso' : 'Mes chantiers en cours'}
        </div>
        {contexte.chantiers.length === 0 ? (
          <p style={{ fontSize: 13, color: GRIS, margin: 0 }}>
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
              const sansGps = isPt ? 'sem posição GPS: marcação manual' : 'sans position GPS : pointage à la main'
              const detail = pointable ? `${isPt ? 'raio' : 'rayon'} ${chantier.rayonM} m` : sansGps
              const libelle = libelleBoutonChantier(actif, isPt)
              return (
                <div key={chantier.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', border: `1px solid ${surPlace ? '#4CAF50' : '#E8E8E8'}`, borderRadius: 8, flexWrap: 'wrap' }}>
                  <div style={{ flex: 1, minWidth: 180 }}>
                    <div style={{ fontWeight: 600, fontSize: 13 }}>
                      {chantier.titre}{' '}
                      {actif && <span className="v5-badge v5-badge-green">{isPt ? 'Em curso' : 'En cours'}</span>}
                    </div>
                    <div style={{ fontSize: 12, color: GRIS }}>{chantier.adresse || '—'} · {detail}</div>
                  </div>
                  {distance !== null && (
                    <span style={{ fontWeight: 700, fontSize: 13, color: surPlace ? '#2E7D32' : GRIS }}>{formatDistance(distance, isPt)}</span>
                  )}
                  <button
                    type="button"
                    className="v5-btn v5-btn-sm"
                    disabled={actif || actionManuelle}
                    aria-label={`${libelle} — ${chantier.titre}`}
                    onClick={() => { void manuel({ action: 'arrivee', chantierId: chantier.id, mode: 'manuel' }, isPt ? 'Chegada registada' : 'Arrivée pointée') }}
                  >
                    {libelle}
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
          <p style={{ fontSize: 13, color: GRIS, margin: 0 }}>{isPt ? 'Nenhuma marcação.' : 'Aucun pointage.'}</p>
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
                    <td>{celluleDepart(p, jour, isPt)}</td>
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
