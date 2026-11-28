'use client'

import { useState } from 'react'
import { AUTOMATISATIONS_PAR_ROLE } from '@/components/administrateur-judiciaire/data/automatisations'
import { DEMO_COPROPRIETES, DEMO_TOTAL_LOTS } from '@/components/administrateur-judiciaire/data/coproprietes'
import { AssistantMandatModal } from '@/components/administrateur-judiciaire/modules/mandat/composants/AssistantMandatModal'
import {
  AlerteEcheancesDepassees,
  PanneauActesExpress,
  PanneauEcheancesLegales,
  RadarMandats,
  estEnRetard,
  pastilleUrgence,
  tachesDuRole,
  type ActeExpressOuvert,
  type TacheDatee,
} from '@/components/administrateur-judiciaire/modules/mandat/composants/EtatGeneralMandats'
import { GenerationActeModal } from '@/components/administrateur-judiciaire/modules/mandat/composants/GenerationActeModal'
import { naviguerVers } from '@/components/administrateur-judiciaire/shell/navigation'
import { ICONES_ROLES_CABINET, useRoleCabinet } from '@/components/administrateur-judiciaire/shell/RoleCabinetContext'
import { Icon } from '@/components/administrateur-judiciaire/ui/Icon'
import { Panel } from '@/components/administrateur-judiciaire/ui/Panel'
import { Pill } from '@/components/administrateur-judiciaire/ui/Pill'
import { useToast } from '@/components/administrateur-judiciaire/ui/toast'
import { useTrouverCopro } from '@/lib/administrateur-judiciaire/db/hooks'
import type { CleActeExpress } from '@/lib/administrateur-judiciaire/domain/actes/actes-express'
import { LIBELLES_ROLES_CABINET } from '@/lib/administrateur-judiciaire/domain/roles-cabinet'
import { AUJOURDHUI, MODE_ACTIF } from '@/lib/administrateur-judiciaire/mode'

/** Assistant IA proposé : route, nom, rôle et pictogramme. */
type AssistantIaCockpit = [route: string, nom: string, description: string, icone: string]

const ASSISTANTS_IA_COCKPIT: AssistantIaCockpit[] = [
  ['max', 'Max — Juridique', 'Rédige requêtes, vérifie la procédure', 'grad'],
  ['lea', 'Léa — Comptable', 'Contrôle le compte séparé, les impayés', 'sparkle'],
  ['alfredo', 'Alfredo — Courriers', 'Génère et envoie les LRAR', 'mail'],
  ['tempo', 'Tempo — Échéances', 'Surveille tous les délais légaux', 'clock'],
]

/**
 * Cockpit, ancienne page « Aujourd'hui » : retirée du menu le 29/10/2026 (doublon de la page d'accueil), son ancre
 * #cockpit ouvre le tableau de bord, qui reprend son radar, ses échéances légales, son alerte et ses actes express.
 * Écran conservé : bandeau du jour selon le rôle du cabinet, radar des mandats, échéances légales du portefeuille
 * (fenêtre J-60 à J+120), file d'actions triée par urgence (état « fait » local, non persisté), centre
 * d'automatisation, génération express d'actes et assistants IA.
 */
export function CockpitModule() {
  const role = useRoleCabinet(),
    { push } = useToast(),
    [faits, setFaits] = useState<Set<string>>(() => new Set()),
    [acteOuvert, setActeOuvert] = useState<ActeExpressOuvert | null>(null),
    [assistantOuvert, setAssistantOuvert] = useState(false),
    ouvrirActe = (tpl: CleActeExpress | undefined, code: string) =>
      setActeOuvert({
        tpl,
        code,
      }),
    ouvrirEcran = (route: string) => {
      naviguerVers(route)
    },
    basculerFait = (id: string) =>
      setFaits((precedents) => {
        const suivants = new Set(precedents)
        if (suivants.has(id)) suivants.delete(id)
        else suivants.add(id)
        return suivants
      }),
    trouverCopro = useTrouverCopro(),
    taches: TacheDatee[] = tachesDuRole(role),
    nombreAMener = taches.filter((tache) => !faits.has(tache.id)).length,
    nombreEnRetard = taches.filter((tache) => !faits.has(tache.id) && estEnRetard(tache)).length,
    nombreAujourdhui = taches.filter((tache) => !faits.has(tache.id) && tache.d === 0).length,
    heuresEconomisees = (12.5 + faits.size * 0.6).toFixed(1),
    heure = MODE_ACTIF === 'demo' ? 9 : new Date().getHours(),
    salutation = heure < 13 ? 'Bonjour' : 'Bonsoir'
  return (
    <>
      <div className="hero">
        <div className="hero-grid">
          <div>
            <div className="date-line">
              {new Intl.DateTimeFormat('fr-FR', {
                weekday: 'long',
                day: 'numeric',
                month: 'long',
                year: 'numeric',
              }).format(AUJOURDHUI)}
            </div>
            <h1>
              {salutation}
              {' — '}
              <i>{LIBELLES_ROLES_CABINET[role]}</i>
            </h1>
            <div className="lede">
              Votre poste de travail du jour. Les obligations légales de chaque mandat sont calculées et priorisées
              automatiquement — agissez en un clic.
            </div>
            <div
              style={{
                display: 'flex',
                gap: 8,
                marginTop: 14,
                flexWrap: 'wrap',
              }}
            >
              <Pill kind="navy" noDot>
                <Icon
                  name={ICONES_ROLES_CABINET[role]}
                  style={{
                    width: 12,
                    height: 12,
                    verticalAlign: '-1px',
                    marginRight: 4,
                  }}
                />
                {role}
              </Pill>
              <Pill kind={nombreEnRetard ? 'rust' : 'sage'}>
                {nombreAMener}
                {' action'}
                {nombreAMener > 1 ? 's' : ''}
                {' à mener'}
              </Pill>
              {nombreEnRetard > 0 && (
                <Pill kind="rust">
                  {nombreEnRetard}
                  {' en retard'}
                </Pill>
              )}
              <Pill kind="gold">
                ~{heuresEconomisees}
                {' h économisées ce mois'}
              </Pill>
            </div>
          </div>
          <div className="hero-divider" />
          <div className="hero-stat">
            <div className="label">À mener</div>
            <div className="val">{nombreAMener}</div>
            <div className="sub-stat">{role === 'Direction' ? 'tout le cabinet' : role}</div>
          </div>
          <div className="hero-divider" />
          <div className="hero-stat">
            <div className="label">{"Aujourd'hui"}</div>
            <div className="val">{nombreAujourdhui}</div>
            <div className="sub-stat">
              {nombreEnRetard}
              {' en retard'}
            </div>
          </div>
          <div className="hero-divider" />
          <div className="hero-stat">
            <div className="label">Mandats</div>
            <div className="val">{DEMO_COPROPRIETES.length}</div>
            <div className="sub-stat">
              {DEMO_TOTAL_LOTS}
              {' lots · TJ Nanterre'}
            </div>
          </div>
        </div>
      </div>
      <AlerteEcheancesDepassees nombre={nombreEnRetard} />
      <RadarMandats />
      <PanneauEcheancesLegales />
      <Panel
        title={role === 'Direction' ? "File d'actions du cabinet" : `Ma file d'actions — ${role}`}
        sub="Générée automatiquement depuis les échéances légales · triée par urgence"
        icon="clipboard"
        right={
          <>
            <Pill kind="navy" noDot>
              Auto
            </Pill>
            <Pill kind="sage" noDot>
              {nombreAMener}
              {' ouverte'}
              {nombreAMener > 1 ? 's' : ''}
            </Pill>
          </>
        }
        flush
      >
        {taches.length === 0 && (
          <div
            style={{
              padding: '26px',
              textAlign: 'center',
              color: 'var(--navy-300)',
              fontSize: 13,
            }}
          >
            Aucune action pour ce rôle. Tout est à jour.
          </div>
        )}
        {taches.map((tache) => {
          const fait = faits.has(tache.id),
            pastille = pastilleUrgence(tache.d),
            copro = trouverCopro(tache.code)
          return (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 14,
                padding: '15px 22px',
                borderBottom: '1px solid var(--line)',
                opacity: fait ? 0.5 : 1,
              }}
              key={tache.id}
            >
              <button
                onClick={() => basculerFait(tache.id)}
                aria-label={fait ? 'Rouvrir' : 'Marquer comme fait'}
                title={fait ? 'Rouvrir' : 'Marquer comme fait'}
                style={{
                  flexShrink: 0,
                  width: 22,
                  height: 22,
                  borderRadius: 6,
                  border: '1.5px solid ' + (fait ? 'var(--sage-500)' : 'var(--line)'),
                  background: fait ? 'var(--sage-500)' : '#fff',
                  color: '#fff',
                  cursor: 'pointer',
                  display: 'grid',
                  placeItems: 'center',
                  padding: 0,
                }}
              >
                {fait && (
                  <Icon
                    name="check"
                    style={{
                      width: 13,
                      height: 13,
                    }}
                  />
                )}
              </button>
              <div
                style={{
                  flex: 1,
                  minWidth: 0,
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    flexWrap: 'wrap',
                  }}
                >
                  <span
                    style={{
                      fontWeight: 600,
                      fontSize: 13.5,
                      textDecoration: fait ? 'line-through' : 'none',
                    }}
                  >
                    {tache.title}
                  </span>
                  {role === 'Direction' && (
                    <Pill kind="navy" noDot>
                      {tache.role}
                    </Pill>
                  )}
                </div>
                <div
                  style={{
                    fontSize: 11.5,
                    color: 'var(--navy-300)',
                    marginTop: 3,
                  }}
                >
                  {copro.nom}
                  {' · '}
                  {tache.basis}
                </div>
              </div>
              <Pill kind={pastille.k} noDot>
                {pastille.lbl}
              </Pill>
              {!fait && tache.kind === 'doc' && (
                <button className="btn sm gold" onClick={() => ouvrirActe(tache.tpl, tache.code)}>
                  <Icon name="doc" />
                  Générer
                </button>
              )}
              {!fait && tache.kind === 'nav' && (
                // Comme l'affectation de window.location.hash de la maquette : une route absente donnerait « undefined ».
                <button className="btn sm ghost" onClick={() => ouvrirEcran(String(tache.nav))}>
                  {tache.act || 'Ouvrir'}
                </button>
              )}
              {!fait && tache.kind === 'todo' && (
                <button
                  className="btn sm"
                  style={{
                    background: 'var(--sage-500)',
                    color: '#fff',
                    border: 'none',
                  }}
                  onClick={() => {
                    basculerFait(tache.id)
                    push({
                      kind: 'success',
                      title: 'Simulation — ' + (tache.act || 'Fait'),
                      desc: "L'action n'a pas été réellement exécutée pour : " + tache.title,
                    })
                  }}
                >
                  {tache.act || 'Fait'}
                </button>
              )}
              {fait && (
                <span
                  style={{
                    fontSize: 11.5,
                    color: 'var(--sage-700)',
                    fontWeight: 600,
                  }}
                >
                  Fait ✓
                </span>
              )}
            </div>
          )
        })}
      </Panel>
      <Panel
        title="Centre d'automatisation"
        sub="Traitement par lot — un clic pour toute la charge récurrente de votre rôle"
        icon="bolt"
      >
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit,minmax(250px,1fr))',
            gap: 10,
          }}
        >
          <button
            onClick={() => setAssistantOuvert(true)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              textAlign: 'left',
              cursor: 'pointer',
              background: 'linear-gradient(135deg,var(--gold-50),#fff)',
              border: '1px solid var(--gold-200)',
              borderRadius: 10,
              padding: 14,
            }}
          >
            <span
              style={{
                width: 36,
                height: 36,
                borderRadius: 9,
                background: 'var(--gold-100)',
                display: 'grid',
                placeItems: 'center',
                color: 'var(--gold-700)',
                flexShrink: 0,
              }}
            >
              <Icon
                name="scale"
                style={{
                  width: 18,
                  height: 18,
                }}
              />
            </span>
            <span
              style={{
                minWidth: 0,
              }}
            >
              <b
                style={{
                  fontSize: 13,
                }}
              >
                Configurer un nouveau mandat
              </b>
              <div
                style={{
                  fontSize: 11,
                  color: 'var(--navy-300)',
                }}
              >
                {'Auto-planifie échéances, tâches & actes'}
              </div>
            </span>
          </button>
          {AUTOMATISATIONS_PAR_ROLE.filter(
            (automatisation) => role === 'Direction' || automatisation.roles.includes(role),
          ).map((automatisation) => (
            <button
              onClick={() =>
                push({
                  kind: 'success',
                  title: 'Simulation — ' + automatisation.label,
                  desc: "Aucun document n'a été réellement généré ni transmis.",
                })
              }
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                textAlign: 'left',
                cursor: 'pointer',
                background: '#fff',
                border: '1px solid var(--line)',
                borderRadius: 10,
                padding: 14,
              }}
              key={automatisation.id}
            >
              <span
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 9,
                  background: 'var(--cream)',
                  display: 'grid',
                  placeItems: 'center',
                  color: 'var(--navy-700)',
                  flexShrink: 0,
                }}
              >
                <Icon
                  name={automatisation.icon}
                  style={{
                    width: 18,
                    height: 18,
                  }}
                />
              </span>
              <span
                style={{
                  minWidth: 0,
                }}
              >
                <b
                  style={{
                    fontSize: 13,
                  }}
                >
                  {automatisation.label}
                </b>
                <div
                  style={{
                    fontSize: 11,
                    color: 'var(--navy-300)',
                  }}
                >
                  {automatisation.hint}
                </div>
              </span>
            </button>
          ))}
        </div>
      </Panel>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1.3fr 1fr',
          gap: 16,
        }}
      >
        <PanneauActesExpress onChoisir={ouvrirActe} />
        <Panel title="Assistants IA" sub="Délègue les tâches chronophages" icon="bot">
          {ASSISTANTS_IA_COCKPIT.map(([route, nom, description, icone]) => (
            <button
              onClick={() => ouvrirEcran(route)}
              className="list-row"
              style={{
                width: '100%',
                textAlign: 'left',
                cursor: 'pointer',
                border: 'none',
                background: 'transparent',
              }}
              key={route}
            >
              <div className="thumb">
                <Icon name={icone} />
              </div>
              <div className="info">
                <b>{nom}</b>
                <div className="meta">
                  <span>{description}</span>
                </div>
              </div>
              <div />
              <Icon
                name="arrow"
                style={{
                  width: 14,
                  height: 14,
                  color: 'var(--navy-200)',
                }}
              />
            </button>
          ))}
        </Panel>
      </div>
      <GenerationActeModal
        open={!!acteOuvert}
        tplKey={acteOuvert == null ? undefined : acteOuvert.tpl}
        initialCode={acteOuvert == null ? undefined : acteOuvert.code}
        onClose={() => setActeOuvert(null)}
      />
      <AssistantMandatModal open={assistantOuvert} onClose={() => setAssistantOuvert(false)} />
    </>
  )
}
