'use client'

import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import { MapPin } from 'lucide-react'
import { useBTPData, useBTPSettings } from '@/lib/hooks/use-btp-data'
import { geocoderAdresse } from '@/lib/btp/geocodage'
import { RAYON_PAR_DEFAUT_M, RAYONS_PROPOSES_M, coordonneesValides } from '@/lib/btp/pointage-geo'
import { STATUT_EN_COURS, type StatutCompte } from '@/lib/btp/pointage-regles'
import type { Artisan } from '@/lib/types'
import { rappelActivation } from './textes'

// Onglet « Affectations » (gérant) : relier employés et équipes aux chantiers en cours, régler le rayon de
// déclenchement et la position GPS de chaque chantier. Écrit par /api/btp comme les écrans Chantiers et Équipes :
// chantiers_btp.membres_ids et geo_rayon_m, equipes_btp.chantier_id (une équipe est sur un chantier à la fois).

interface ChantierLu {
  id: string
  titre: string
  adresse?: string
  ville?: string
  codePostal?: string
  statut?: string
  latitude?: number | null
  longitude?: number | null
  geoRayonM?: number
  membres_ids?: string[]
}

interface MembreLu { id: string; prenom?: string; nom?: string; actif?: boolean }
interface EquipeLue { id: string; nom?: string; chantierId?: string }

interface Brouillon { membres: string[]; equipes: string[]; rayon: number }

interface Props {
  artisan: Artisan
  isPt: boolean
  comptes: Record<string, StatutCompte>
  affectationIndividuelle: boolean
  /** Interrupteur de la société (settings_btp.geo_pointage_enabled), tel que lu par /api/btp/pointage. */
  pointageAutoActive: boolean
  onModifie: () => Promise<void>
}

/** Activation du pointage automatique pour la société, après le rappel des obligations de l'employeur. */
function InterrupteurPointageAuto({ actif, isPt, onModifie }: { actif: boolean; isPt: boolean; onModifie: () => Promise<void> }) {
  const { save } = useBTPSettings()
  const [confirme, setConfirme] = useState(false)
  const [occupe, setOccupe] = useState(false)
  const rappel = rappelActivation(isPt)

  const basculer = async (valeur: boolean) => {
    setOccupe(true)
    try {
      await save({ geo_pointage_enabled: valeur })
      await onModifie()
      setConfirme(false)
    } finally {
      setOccupe(false)
    }
  }

  return (
    <div className="v5-card">
      <div className="v5-st">{isPt ? 'Marcação automática (GPS)' : 'Pointage automatique (GPS)'}</div>
      {actif ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <span className="v5-badge v5-badge-green">{isPt ? 'Ativada' : 'Activé'}</span>
          <span style={{ fontSize: 13, flex: 1, minWidth: 200 }}>
            {isPt
              ? 'Cada colaborador pode ativá-la no seu telemóvel, no separador Marcar.'
              : 'Chaque employé peut l’activer sur son téléphone, dans l’onglet Pointer.'}
          </span>
          <button type="button" className="v5-btn" disabled={occupe} onClick={() => { void basculer(false) }}>
            {isPt ? 'Desativar' : 'Désactiver'}
          </button>
        </div>
      ) : (
        <>
          <div className="v5-al warn">
            <strong>{rappel.titre}</strong>
            <ul style={{ margin: '6px 0 0', paddingLeft: 18 }}>
              {rappel.points.map(point => <li key={point}>{point}</li>)}
            </ul>
          </div>
          <label style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 13, margin: '10px 0' }}>
            <input type="checkbox" checked={confirme} onChange={e => setConfirme(e.target.checked)} />
            {rappel.confirmation}
          </label>
          <button type="button" className="v5-btn v5-btn-p" disabled={!confirme || occupe} onClick={() => { void basculer(true) }}>
            {isPt ? 'Ativar para a minha empresa' : 'Activer pour ma société'}
          </button>
        </>
      )}
    </div>
  )
}

const parNom = (a: string, b: string) => a.localeCompare(b, 'fr', { sensitivity: 'base' })
const memes = (a: readonly string[], b: readonly string[]) => a.length === b.length && a.every(x => b.includes(x))
const nomMembre = (m: MembreLu) => [m.prenom, m.nom].filter(Boolean).join(' ') || '—'

function puceCompte(statut: StatutCompte | undefined, isPt: boolean) {
  if (statut === 'actif') return <span className="v5-badge v5-badge-green">{isPt ? 'Conta ativa' : 'Compte actif'}</span>
  if (statut === 'invitation') return <span className="v5-badge v5-badge-yellow">{isPt ? 'Convite enviado' : 'Invitation envoyée'}</span>
  return <span className="v5-badge v5-badge-gray">{isPt ? 'Sem conta' : 'Sans compte'}</span>
}

export function OngletAffectations({ artisan, isPt, comptes, affectationIndividuelle, pointageAutoActive, onModifie }: Props) {
  const userId = artisan?.user_id || ''
  const chantiersBtp = useBTPData<ChantierLu>({ table: 'chantiers', artisanId: artisan?.id || '', userId })
  const membresBtp = useBTPData<MembreLu>({ table: 'membres', artisanId: artisan?.id || '', userId })
  const equipesBtp = useBTPData<EquipeLue>({ table: 'equipes', artisanId: artisan?.id || '', userId })
  const [brouillons, setBrouillons] = useState<Record<string, Brouillon>>({})
  const [occupe, setOccupe] = useState<string | null>(null)

  const chantiers = useMemo(
    () => chantiersBtp.items.filter(c => c.statut === STATUT_EN_COURS).sort((a, b) => parNom(a.titre || '', b.titre || '')),
    [chantiersBtp.items],
  )
  const membres = useMemo(
    () => membresBtp.items.filter(m => m.actif !== false).sort((a, b) => parNom(nomMembre(a), nomMembre(b))),
    [membresBtp.items],
  )
  const equipes = useMemo(() => [...equipesBtp.items].sort((a, b) => parNom(a.nom || '', b.nom || '')), [equipesBtp.items])
  const titreChantier = (id: string | undefined) => chantiersBtp.items.find(c => c.id === id)?.titre || '—'

  const initial = (c: ChantierLu): Brouillon => ({
    membres: Array.isArray(c.membres_ids) ? c.membres_ids : [],
    equipes: equipes.filter(e => e.chantierId === c.id).map(e => e.id),
    rayon: c.geoRayonM || RAYON_PAR_DEFAUT_M,
  })
  const brouillon = (c: ChantierLu) => brouillons[c.id] ?? initial(c)
  const modifie = (c: ChantierLu) => {
    const b = brouillons[c.id]
    if (!b) return false
    const i = initial(c)
    return !memes(b.membres, i.membres) || !memes(b.equipes, i.equipes) || b.rayon !== i.rayon
  }
  const changer = (c: ChantierLu, modification: (b: Brouillon) => Brouillon) =>
    setBrouillons(prev => ({ ...prev, [c.id]: modification(prev[c.id] ?? initial(c)) }))
  const basculer = (liste: string[], id: string) => (liste.includes(id) ? liste.filter(x => x !== id) : [...liste, id])
  const oublier = (id: string) => setBrouillons(prev => {
    const reste = { ...prev }
    delete reste[id]
    return reste
  })

  const enregistrer = async (c: ChantierLu) => {
    const b = brouillon(c)
    const i = initial(c)
    setOccupe(c.id)
    try {
      let ok = true
      const changements: Partial<ChantierLu> = {}
      if (b.rayon !== i.rayon) changements.geoRayonM = b.rayon
      if (affectationIndividuelle && !memes(b.membres, i.membres)) changements.membres_ids = b.membres
      if (Object.keys(changements).length > 0) ok = await chantiersBtp.update(c.id, changements)
      for (const equipe of equipes) {
        const avant = i.equipes.includes(equipe.id)
        const apres = b.equipes.includes(equipe.id)
        if (avant !== apres) ok = (await equipesBtp.update(equipe.id, { chantierId: apres ? c.id : '' })) && ok
      }
      if (!ok) {
        toast.error(isPt ? 'Algumas alterações não foram guardadas.' : 'Certaines modifications n’ont pas été enregistrées.')
        return
      }
      oublier(c.id)
      toast.success(isPt ? 'Atribuições guardadas' : 'Affectations enregistrées')
      await onModifie()
    } finally {
      setOccupe(null)
    }
  }

  const localiser = async (c: ChantierLu) => {
    const adresse = [c.adresse, c.codePostal, c.ville].filter(Boolean).join(' ')
    if (!adresse.trim()) {
      toast.error(isPt ? 'Indique a morada da obra no módulo Obras.' : 'Indiquez l’adresse du chantier dans le module Chantiers.')
      return
    }
    setOccupe(c.id)
    try {
      const position = await geocoderAdresse(adresse, isPt ? 'PT' : 'FR')
      if (!position) {
        toast.error(isPt ? 'Morada não encontrada: corrija-a no módulo Obras.' : 'Adresse introuvable : corrigez-la dans le module Chantiers.')
        return
      }
      if (await chantiersBtp.update(c.id, { latitude: position.latitude, longitude: position.longitude })) {
        toast.success(isPt ? 'Posição GPS registada' : 'Position GPS enregistrée')
        await onModifie()
      } else {
        toast.error(isPt ? 'A posição não foi guardada.' : 'La position n’a pas été enregistrée.')
      }
    } finally {
      setOccupe(null)
    }
  }

  const lienEmployes = typeof window === 'undefined' ? '' : `${window.location.origin}/${isPt ? 'pt' : 'fr'}/pro/dashboard/?p=pointage`

  if (chantiersBtp.loading || membresBtp.loading || equipesBtp.loading) {
    return <div className="v5-card" style={{ textAlign: 'center', color: '#999', fontSize: 13 }}>{isPt ? 'A carregar…' : 'Chargement…'}</div>
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '.75rem' }}>
      <InterrupteurPointageAuto actif={pointageAutoActive} isPt={isPt} onModifie={onModifie} />
      <div className="v5-al info">
        {isPt
          ? 'Cada colaborador marca a partir do seu telemóvel, ligado com a sua própria conta (Contas de utilizadores), com o mesmo e-mail da sua ficha em Equipas. Ligação a dar-lhe: '
          : 'Chaque employé pointe depuis son téléphone, connecté avec son propre compte (Comptes utilisateurs), avec la même adresse e-mail que sur sa fiche Équipes. Lien à lui donner : '}
        <strong style={{ wordBreak: 'break-all' }}>{lienEmployes}</strong>
      </div>
      {!affectationIndividuelle && (
        <div className="v5-al warn">
          {isPt
            ? 'A atribuição de colaboradores um a um estará disponível após a atualização da base de dados (migração de 16/11/2026). Entretanto, atribua equipas.'
            : 'L’affectation d’employés un par un sera disponible après la mise à jour de la base (migration du 16/11/2026). En attendant, affectez des équipes.'}
        </div>
      )}

      {chantiers.length === 0 ? (
        <div className="v5-card" style={{ fontSize: 13, color: '#666' }}>
          {isPt ? 'Nenhuma obra em curso. Passe uma obra para « Em curso » no módulo Obras.' : 'Aucun chantier en cours. Passez un chantier « En cours » dans le module Chantiers.'}
        </div>
      ) : chantiers.map(c => {
        const b = brouillon(c)
        const positionValide = coordonneesValides(c.latitude, c.longitude)
        const rayons = (RAYONS_PROPOSES_M as readonly number[]).includes(b.rayon) ? RAYONS_PROPOSES_M : [...RAYONS_PROPOSES_M, b.rayon].sort((x, y) => x - y)
        return (
          <div key={c.id} className="v5-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', alignItems: 'flex-start' }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 14 }}>{c.titre}</div>
                <div style={{ fontSize: 11, color: '#888', display: 'flex', alignItems: 'center', gap: 4 }}>
                  <MapPin size={10} aria-hidden="true" /> {[c.adresse, c.codePostal, c.ville].filter(Boolean).join(' ') || '—'}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                {positionValide
                  ? <span className="v5-badge v5-badge-green">{isPt ? 'Posição GPS' : 'Position GPS'}</span>
                  : (
                    <button type="button" className="v5-btn v5-btn-sm" disabled={occupe === c.id} onClick={() => { void localiser(c) }}>
                      {isPt ? 'Localizar a morada' : 'Localiser l’adresse'}
                    </button>
                  )}
                <label className="v5-fl" style={{ display: 'flex', alignItems: 'center', gap: 6, margin: 0 }}>
                  {isPt ? 'Raio' : 'Rayon'}
                  <select
                    className="v5-filter-sel"
                    value={b.rayon}
                    onChange={e => changer(c, prev => ({ ...prev, rayon: Number(e.target.value) }))}
                  >
                    {rayons.map(r => <option key={r} value={r}>{r} m</option>)}
                  </select>
                </label>
              </div>
            </div>
            {!positionValide && (
              <div className="v5-al warn" style={{ marginTop: 8 }}>
                {isPt ? 'Sem posição GPS, a marcação automática não pode iniciar nesta obra.' : 'Sans position GPS, le pointage automatique ne peut pas démarrer sur ce chantier.'}
              </div>
            )}

            <fieldset style={{ border: 'none', padding: 0, margin: '12px 0 0' }}>
              <legend className="v5-fl">{isPt ? 'Colaboradores' : 'Employés'}</legend>
              {membres.length === 0 ? (
                <p style={{ fontSize: 12, color: '#888', margin: 0 }}>{isPt ? 'Nenhum colaborador em Equipas.' : 'Aucun employé dans Équipes.'}</p>
              ) : (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {membres.map(m => (
                    <label key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, padding: '4px 8px', border: '1px solid #E0E0E0', borderRadius: 6 }}>
                      <input
                        type="checkbox"
                        disabled={!affectationIndividuelle}
                        checked={b.membres.includes(m.id)}
                        onChange={() => changer(c, prev => ({ ...prev, membres: basculer(prev.membres, m.id) }))}
                      />
                      {nomMembre(m)} {puceCompte(comptes[m.id], isPt)}
                    </label>
                  ))}
                </div>
              )}
            </fieldset>

            <fieldset style={{ border: 'none', padding: 0, margin: '12px 0 0' }}>
              <legend className="v5-fl">{isPt ? 'Equipas' : 'Équipes'}</legend>
              {equipes.length === 0 ? (
                <p style={{ fontSize: 12, color: '#888', margin: 0 }}>{isPt ? 'Nenhuma equipa em Equipas.' : 'Aucune équipe dans Équipes.'}</p>
              ) : (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {equipes.map(e => {
                    const ailleurs = e.chantierId && e.chantierId !== c.id && !b.equipes.includes(e.id)
                    return (
                      <label key={e.id} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, padding: '4px 8px', border: '1px solid #E0E0E0', borderRadius: 6 }}>
                        <input
                          type="checkbox"
                          checked={b.equipes.includes(e.id)}
                          onChange={() => changer(c, prev => ({ ...prev, equipes: basculer(prev.equipes, e.id) }))}
                        />
                        {e.nom || '—'}
                        {ailleurs && <span style={{ color: '#888' }}>({isPt ? 'atualmente em' : 'actuellement sur'} « {titreChantier(e.chantierId)} »)</span>}
                      </label>
                    )
                  })}
                </div>
              )}
            </fieldset>

            {modifie(c) && (
              <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                <button type="button" className="v5-btn v5-btn-p" disabled={occupe === c.id} onClick={() => { void enregistrer(c) }}>
                  {isPt ? 'Guardar' : 'Enregistrer'}
                </button>
                <button type="button" className="v5-btn" disabled={occupe === c.id} onClick={() => oublier(c.id)}>
                  {isPt ? 'Cancelar' : 'Annuler'}
                </button>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
