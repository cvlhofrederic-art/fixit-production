'use client'

import { Fragment, useEffect, useRef, useState } from 'react'
import {
  DEMO_EQUIPE_PLANNING,
  DEMO_EVENEMENTS_PLANNING,
  JOURS_SEMAINE_PLANNING,
  PILL_PAR_COULEUR_EVENEMENT,
  REGLAGES_PLANNING_DEFAUT,
  type CleJour,
  type EvenementPlanning,
  type ReglagesPlanning,
} from '@/components/administrateur-judiciaire/data/planning'
import { Alert } from '@/components/administrateur-judiciaire/ui/Alert'
import { Icon } from '@/components/administrateur-judiciaire/ui/Icon'
import { Modal, ModalBody, ModalFooter, ModalHeader } from '@/components/administrateur-judiciaire/ui/Modal'
import { PageHead } from '@/components/administrateur-judiciaire/ui/PageHead'
import { Panel } from '@/components/administrateur-judiciaire/ui/Panel'
import { Pill } from '@/components/administrateur-judiciaire/ui/Pill'
import { useToast, type OptionsFormulaire } from '@/components/administrateur-judiciaire/ui/toast'

/** Ligne horaire de la grille : index (0 = premier créneau) et libellé « HH:MM ». */
interface CreneauPlanning {
  idx: number
  label: string
}

/** Position d'un événement dans la grille CSS (colonne 1 = heures, ligne 1 = en-têtes des jours). */
interface PlacementEvenement {
  gridColumn: number
  gridRow: string
}

/**
 * Formulaire « Nouvel événement » ouvert par le bouton « Ajouter » et par chaque case de la grille
 * (même formulaire, sans préremplissage de la date ni de l'heure ; validation simulée).
 */
const FORMULAIRE_NOUVEL_EVENEMENT: OptionsFormulaire = {
  kind: 'form',
  icon: 'calendar',
  title: 'Nouvel événement',
  fields: [
    {
      label: 'Copropriété',
      type: 'select',
      options: ['Résidence Le Méridien', 'Le Clos des Vignes', 'Copropriété Les Tilleuls', 'Villa Montaigne'],
      full: true,
    },
    {
      label: 'Type',
      type: 'select',
      options: ['Intervention', 'Visite', 'Assemblée générale', 'Conseil syndical', 'Échéance'],
      full: true,
    },
    {
      label: 'Objet',
      placeholder: "Intitulé de l'événement",
      full: true,
    },
    {
      label: 'Date',
      placeholder: 'JJ/MM/AAAA',
      full: true,
    },
  ],
  submitLabel: 'Ajouter',
  toast: {
    title: 'Événement ajouté',
  },
}

/** Heures proposées dans les réglages (début, puis fin) et durées de créneau possibles (minutes). */
const HEURES_DEBUT = [6, 7, 8, 9, 10, 11]
const HEURES_FIN = [16, 17, 18, 19, 20, 21, 22]
const DUREES_CRENEAU = [30, 60, 120]

/** Durée d'un créneau : « 1h », « 2h » à partir d'une heure, sinon « 30min ». */
function libelleDureeCreneau(minutes: number): string {
  return minutes >= 60 ? minutes / 60 + 'h' : minutes + 'min'
}

/** « HH:MM » → minutes depuis minuit. */
function enMinutes(heure: string): number {
  const [heures, minutes] = heure.split(':').map(Number)
  return heures * 60 + minutes
}

/** Créneaux de startHour à endHour (exclue) par pas de slotMinutes, libellés « HH:MM ». */
function calculerCreneaux(reglages: ReglagesPlanning): CreneauPlanning[] {
  const creneaux: CreneauPlanning[] = []
  let minutes = reglages.startHour * 60
  const fin = reglages.endHour * 60
  for (; minutes < fin; ) {
    const heures = Math.floor(minutes / 60)
    const reste = minutes % 60
    creneaux.push({
      idx: creneaux.length,
      label: `${String(heures).padStart(2, '0')}:${String(reste).padStart(2, '0')}`,
    })
    minutes += reglages.slotMinutes
  }
  return creneaux
}

/**
 * Planning hebdomadaire de l'équipe (surtitre « Gestion courante ») : semaine figée du 8 au 14 juin 2026,
 * filtre par collaborateur (menu déroulant), réglages d'affichage (jours ouvrés, plage horaire, durée des
 * créneaux) appliqués seulement via « Appliquer ». Les ajouts sont simulés (formulaire sans enregistrement).
 */
export function PlanningModule() {
  const { push } = useToast()
  const [reglagesAppliques, setReglagesAppliques] = useState<ReglagesPlanning>(REGLAGES_PLANNING_DEFAUT)
  const [brouillon, setBrouillon] = useState<ReglagesPlanning>(REGLAGES_PLANNING_DEFAUT)
  const [reglagesOuverts, setReglagesOuverts] = useState(false)
  const [membreSelectionneId, setMembreSelectionneId] = useState<string | null>(null)
  const [menuOuvert, setMenuOuvert] = useState(false)
  const refMenu = useRef<HTMLDivElement>(null)
  const refBoutonMenu = useRef<HTMLButtonElement>(null)
  const membreSelectionne = membreSelectionneId
    ? DEMO_EQUIPE_PLANNING.find((membre) => membre.id === membreSelectionneId)
    : null

  // Menu des collaborateurs : clic extérieur → fermeture ; Échap → fermeture et retour du focus au bouton.
  useEffect(() => {
    if (!menuOuvert) return
    const surClicExterieur = (evenement: MouseEvent) => {
      if (refMenu.current && !refMenu.current.contains(evenement.target as Node | null)) setMenuOuvert(false)
    }
    const surTouche = (evenement: KeyboardEvent) => {
      if (evenement.key === 'Escape') {
        setMenuOuvert(false)
        if (refBoutonMenu.current) refBoutonMenu.current.focus()
      }
    }
    document.addEventListener('mousedown', surClicExterieur)
    document.addEventListener('keydown', surTouche)
    return () => {
      document.removeEventListener('mousedown', surClicExterieur)
      document.removeEventListener('keydown', surTouche)
    }
  }, [menuOuvert])

  const choisirMembre = (id: string | null) => {
    setMembreSelectionneId(id)
    setMenuOuvert(false)
    const membre = id ? DEMO_EQUIPE_PLANNING.find((candidat) => candidat.id === id) : null
    push({
      kind: 'info',
      title: membre ? `Agenda de ${membre.name}` : "Toute l'équipe",
      desc: membre ? `Événements de ${membre.role}` : 'Tous les événements du cabinet',
    })
  }

  // Le brouillon repart des réglages appliqués à chaque ouverture.
  const ouvrirReglages = () => {
    setBrouillon(reglagesAppliques)
    setReglagesOuverts(true)
  }

  const appliquerReglages = () => {
    if (brouillon.endHour <= brouillon.startHour) {
      push({
        kind: 'info',
        title: 'Horaire invalide',
        desc: "L'heure de fin doit suivre l'heure de début.",
      })
      return
    }
    if (brouillon.workingDays.length === 0) {
      push({
        kind: 'info',
        title: 'Aucun jour ouvré',
        desc: 'Sélectionnez au moins un jour.',
      })
      return
    }
    setReglagesAppliques(brouillon)
    setReglagesOuverts(false)
    push({
      kind: 'success',
      title: 'Affichage mis à jour',
      desc: `${brouillon.workingDays.length} jours · ${brouillon.startHour}h-${brouillon.endHour}h · créneaux de ${libelleDureeCreneau(brouillon.slotMinutes)}`,
    })
  }

  const basculerJour = (cle: CleJour) =>
    setBrouillon((precedent) => ({
      ...precedent,
      workingDays: precedent.workingDays.includes(cle)
        ? precedent.workingDays.filter((jour) => jour !== cle)
        : [...precedent.workingDays, cle],
    }))

  // Jours affichés dans l'ordre de la semaine (et non dans l'ordre de sélection).
  const joursAffiches = JOURS_SEMAINE_PLANNING.filter((jour) => reglagesAppliques.workingDays.includes(jour.key))
  const creneaux = calculerCreneaux(reglagesAppliques)

  const evenementsVisibles = DEMO_EVENEMENTS_PLANNING.filter(
    (evenement) =>
      !(
        (membreSelectionneId && evenement.owner !== membreSelectionneId) ||
        !reglagesAppliques.workingDays.includes(evenement.day) ||
        enMinutes(evenement.end) <= reglagesAppliques.startHour * 60 ||
        enMinutes(evenement.start) >= reglagesAppliques.endHour * 60
      ),
  )

  // Lignes en créneaux, bornées à la plage affichée : début arrondi à l'inférieur, fin au supérieur.
  const placerEvenement = (evenement: EvenementPlanning): PlacementEvenement | null => {
    const debut = Math.max(enMinutes(evenement.start), reglagesAppliques.startHour * 60)
    const fin = Math.min(enMinutes(evenement.end), reglagesAppliques.endHour * 60)
    const ligneDebut = (debut - reglagesAppliques.startHour * 60) / reglagesAppliques.slotMinutes
    const ligneFin = (fin - reglagesAppliques.startHour * 60) / reglagesAppliques.slotMinutes
    const indexJour = joursAffiches.findIndex((jour) => jour.key === evenement.day)
    return indexJour < 0
      ? null
      : {
          gridColumn: indexJour + 2,
          gridRow: `${Math.floor(ligneDebut) + 2} / ${Math.ceil(ligneFin) + 2}`,
        }
  }

  const fermerReglages = () => setReglagesOuverts(false)

  return (
    <>
      <PageHead
        eyebrow="Gestion courante"
        title={membreSelectionne ? `Agenda de ${membreSelectionne.name}` : 'Planning'}
        lede={
          membreSelectionne
            ? `${membreSelectionne.role} · ${joursAffiches.length} jours affichés · ${creneaux.length} créneaux`
            : `Vue hebdomadaire · semaine du 8 au 14 juin 2026 · créneaux de ${libelleDureeCreneau(reglagesAppliques.slotMinutes)}`
        }
        actions={
          <>
            <div className="team-dd-wrap" ref={refMenu}>
              <button
                ref={refBoutonMenu}
                type="button"
                className="btn team-dd-btn"
                aria-haspopup="menu"
                aria-expanded={menuOuvert ? 'true' : 'false'}
                onClick={() => setMenuOuvert((ouvert) => !ouvert)}
              >
                {membreSelectionne ? (
                  <>
                    <span className={`team-dd-avatar accent-${membreSelectionne.accent}`}>{membreSelectionne.id}</span>
                    <span className="team-dd-label">{membreSelectionne.name}</span>
                  </>
                ) : (
                  <>
                    <Icon name="team" />
                    <span className="team-dd-label">{"Toute l'équipe"}</span>
                  </>
                )}
                <Icon name="chevron" />
              </button>
              {menuOuvert && (
                <div className="team-dd-menu" role="menu" aria-label="Sélectionner un collaborateur">
                  <button
                    type="button"
                    role="menuitem"
                    className={`team-dd-item ${membreSelectionneId ? '' : 'active'}`}
                    onClick={() => choisirMembre(null)}
                  >
                    <span className="team-dd-item-icon">
                      <Icon name="team" />
                    </span>
                    <span className="team-dd-item-info">
                      <span className="team-dd-item-name">{"Toute l'équipe"}</span>
                      <span className="team-dd-item-role">
                        {DEMO_EQUIPE_PLANNING.length}
                        {' collaborateurs'}
                      </span>
                    </span>
                  </button>
                  <div className="team-dd-sep" />
                  {DEMO_EQUIPE_PLANNING.map((membre) => (
                    <button
                      type="button"
                      role="menuitem"
                      className={`team-dd-item ${membreSelectionneId === membre.id ? 'active' : ''}`}
                      onClick={() => choisirMembre(membre.id)}
                      key={membre.id}
                    >
                      <span className={`team-dd-avatar accent-${membre.accent}`}>{membre.id}</span>
                      <span className="team-dd-item-info">
                        <span className="team-dd-item-name">{membre.name}</span>
                        <span className="team-dd-item-role">{membre.role}</span>
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <button className="btn" onClick={ouvrirReglages}>
              <Icon name="wrench" />
              Réglages
            </button>
            <button className="btn gold" onClick={() => push(FORMULAIRE_NOUVEL_EVENEMENT)}>
              <Icon name="plus" />
              Ajouter
            </button>
          </>
        }
      />
      {evenementsVisibles.length === 0 && membreSelectionne && (
        <Alert kind="warn" icon="calendar" title={`Aucun événement pour ${membreSelectionne.name} cette semaine`}>
          {"Revenez à la vue globale de l'équipe ou ajoutez un événement."}
        </Alert>
      )}
      <Panel flush>
        <div
          className="week-grid"
          style={{
            gridTemplateColumns: `60px repeat(${joursAffiches.length}, minmax(0, 1fr))`,
            gridTemplateRows: `40px repeat(${creneaux.length}, 48px)`,
          }}
        >
          <div className="week-corner" />
          {joursAffiches.map((jour) => (
            <div className="week-day-head" key={`h-${jour.key}`}>
              <span className="week-day-short">{jour.short}</span>
              <span className="week-day-date">{jour.date}/06</span>
            </div>
          ))}
          {creneaux.map((creneau) => (
            <Fragment key={`row-${creneau.idx}`}>
              <div className="week-hour">{creneau.label}</div>
              {/* Cases vides : raccourci à la souris du bouton « Ajouter » (même formulaire), masqué aux lecteurs d'écran. */}
              {joursAffiches.map((jour) => (
                <div
                  className="week-cell"
                  onClick={() => push(FORMULAIRE_NOUVEL_EVENEMENT)}
                  aria-hidden="true"
                  key={`c-${jour.key}-${creneau.idx}`}
                />
              ))}
            </Fragment>
          ))}
          {evenementsVisibles.map((evenement) => {
            const placement = placerEvenement(evenement)
            if (!placement) return null
            const responsable = DEMO_EQUIPE_PLANNING.find((membre) => membre.id === evenement.owner)
            return (
              <button
                type="button"
                className={`week-event kind-${evenement.kind}`}
                style={placement}
                onClick={() =>
                  push({
                    kind: 'info',
                    title: evenement.label,
                    desc: `${evenement.start}-${evenement.end} · ${responsable ? responsable.name : ''}`,
                  })
                }
                title={`${evenement.start}-${evenement.end} · ${responsable ? responsable.name : ''}`}
                key={`ev-${evenement.id}`}
              >
                <span className="week-event-time">{evenement.start}</span>
                <span className="week-event-label">{evenement.label}</span>
                {responsable && (
                  <span className={`team-dd-avatar sm accent-${responsable.accent}`}>{responsable.id}</span>
                )}
              </button>
            )
          })}
        </div>
      </Panel>
      <div
        style={{
          marginTop: 16,
        }}
      >
        <div className="section-eyebrow">
          <span>
            {membreSelectionne ? `Événements de ${membreSelectionne.name} cette semaine` : 'Événements de la semaine'}
            {' ('}
            {evenementsVisibles.length})
          </span>
          <div className="line" />
        </div>
      </div>
      <Panel flush>
        {evenementsVisibles.length === 0 ? (
          <div
            style={{
              padding: '40px 20px',
              textAlign: 'center',
              color: 'var(--navy-300)',
              fontSize: 13,
            }}
          >
            Aucun événement cette semaine avec les filtres actuels.
          </div>
        ) : (
          evenementsVisibles.map((evenement) => {
            const responsable = DEMO_EQUIPE_PLANNING.find((membre) => membre.id === evenement.owner)
            const jour = JOURS_SEMAINE_PLANNING.find((candidat) => candidat.key === evenement.day)
            return (
              <div className="list-row" key={evenement.id}>
                <div
                  className="thumb"
                  style={{
                    flexDirection: 'column',
                    fontSize: 12,
                    padding: 4,
                    lineHeight: 1.1,
                  }}
                >
                  <div
                    style={{
                      fontWeight: 700,
                    }}
                  >
                    {jour && jour.short}
                  </div>
                  <div
                    style={{
                      fontSize: 10,
                      color: 'var(--navy-300)',
                    }}
                  >
                    {evenement.start}
                  </div>
                </div>
                <div className="info">
                  <b>{evenement.label}</b>
                  <div className="meta">
                    <Pill kind={PILL_PAR_COULEUR_EVENEMENT[evenement.kind]} noDot>
                      {jour && jour.long}
                    </Pill>
                    {responsable && (
                      <span className={`team-dd-avatar sm accent-${responsable.accent}`} title={responsable.name}>
                        {responsable.id}
                      </span>
                    )}
                    {responsable && (
                      <span
                        style={{
                          fontSize: 11.5,
                          color: 'var(--navy-500)',
                        }}
                      >
                        {responsable.name}
                      </span>
                    )}
                  </div>
                </div>
                <div
                  style={{
                    color: 'var(--navy-500)',
                    fontSize: 12,
                  }}
                >
                  {evenement.start}-{evenement.end}
                </div>
              </div>
            )
          })
        )}
      </Panel>
      <Modal open={reglagesOuverts} onClose={fermerReglages} size="md" labelledBy="plan-set-t">
        <ModalHeader id="plan-set-t" icon="wrench" title="Réglages d'affichage" onClose={fermerReglages} />
        <ModalBody>
          <div className="plan-settings-section">
            <div className="plan-settings-label">Jours ouvrés affichés</div>
            <div className="plan-day-toggles">
              {JOURS_SEMAINE_PLANNING.map((jour) => (
                <button
                  type="button"
                  className={`chip ${brouillon.workingDays.includes(jour.key) ? 'active' : ''}`}
                  onClick={() => basculerJour(jour.key)}
                  key={jour.key}
                >
                  {jour.short}
                </button>
              ))}
            </div>
          </div>
          <div className="plan-settings-section">
            <div className="plan-settings-label">Plage horaire</div>
            <div
              style={{
                display: 'flex',
                gap: 12,
                alignItems: 'center',
              }}
            >
              <select
                aria-label="Heure de début"
                value={brouillon.startHour}
                onChange={(evenement) =>
                  setBrouillon((precedent) => ({
                    ...precedent,
                    startHour: Number(evenement.target.value),
                  }))
                }
              >
                {HEURES_DEBUT.map((heure) => (
                  <option value={heure} key={heure}>
                    {heure}h
                  </option>
                ))}
              </select>
              <span
                style={{
                  color: 'var(--navy-300)',
                }}
              >
                →
              </span>
              <select
                aria-label="Heure de fin"
                value={brouillon.endHour}
                onChange={(evenement) =>
                  setBrouillon((precedent) => ({
                    ...precedent,
                    endHour: Number(evenement.target.value),
                  }))
                }
              >
                {HEURES_FIN.map((heure) => (
                  <option value={heure} key={heure}>
                    {heure}h
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="plan-settings-section">
            <div className="plan-settings-label">Durée des créneaux</div>
            <div className="plan-slot-radios">
              {DUREES_CRENEAU.map((duree) => (
                <button
                  type="button"
                  className={`chip ${brouillon.slotMinutes === duree ? 'active' : ''}`}
                  onClick={() =>
                    setBrouillon((precedent) => ({
                      ...precedent,
                      slotMinutes: duree,
                    }))
                  }
                  key={duree}
                >
                  {libelleDureeCreneau(duree)}
                </button>
              ))}
            </div>
            <div className="plan-settings-hint">Affecte la hauteur des lignes et le calage des événements.</div>
          </div>
        </ModalBody>
        <ModalFooter>
          <button className="btn ghost" onClick={() => setBrouillon(REGLAGES_PLANNING_DEFAUT)}>
            Réinitialiser
          </button>
          <button className="btn gold" onClick={appliquerReglages}>
            Appliquer
          </button>
        </ModalFooter>
      </Modal>
    </>
  )
}
