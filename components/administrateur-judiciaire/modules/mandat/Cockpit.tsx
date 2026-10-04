'use client'

import { useState } from 'react'
import { AUTOMATISATIONS_PAR_ROLE } from '@/components/administrateur-judiciaire/data/automatisations'
import { DEMO_COPROPRIETES, DEMO_TOTAL_LOTS } from '@/components/administrateur-judiciaire/data/coproprietes'
import { DEMO_TACHES, type TacheDemo } from '@/components/administrateur-judiciaire/data/taches'
import { AssistantMandatModal } from '@/components/administrateur-judiciaire/modules/mandat/composants/AssistantMandatModal'
import { GenerationActeModal } from '@/components/administrateur-judiciaire/modules/mandat/composants/GenerationActeModal'
import { naviguerVers } from '@/components/administrateur-judiciaire/shell/navigation'
import { ICONES_ROLES_CABINET, useRoleCabinet } from '@/components/administrateur-judiciaire/shell/RoleCabinetContext'
import { Alert } from '@/components/administrateur-judiciaire/ui/Alert'
import { Icon } from '@/components/administrateur-judiciaire/ui/Icon'
import { ListeEcheancesLegales } from '@/components/administrateur-judiciaire/ui/ListeEcheancesLegales'
import { Panel } from '@/components/administrateur-judiciaire/ui/Panel'
import { Pill } from '@/components/administrateur-judiciaire/ui/Pill'
import { useToast } from '@/components/administrateur-judiciaire/ui/toast'
import { useTrouverCopro } from '@/lib/administrateur-judiciaire/db/hooks'
import { useEcheancesPortefeuille } from '@/lib/administrateur-judiciaire/db/use-echeances'
import {
  MODELES_ACTES_EXPRESS,
  type CleActeExpress,
  type ModeleActeExpress,
} from '@/lib/administrateur-judiciaire/domain/actes/actes-express'
import { dateIsoVersFr, ecartJours, joursAvantDateFr } from '@/lib/administrateur-judiciaire/domain/dates'
import {
  MESSAGES_ETAT_ECHEANCES,
  filtrerEcheancesAAfficher,
} from '@/lib/administrateur-judiciaire/domain/echeances-mandat'
import { LIBELLES_ROLES_CABINET } from '@/lib/administrateur-judiciaire/domain/roles-cabinet'
import { AUJOURDHUI, AUJOURDHUI_ISO, MODE_ACTIF } from '@/lib/administrateur-judiciaire/mode'

/** Acte express ouvert dans la GenerationActeModal : modèle et copropriété proposée. */
export interface ActeExpressOuvert {
  tpl: CleActeExpress | undefined
  code: string
}

/** Pastille d'urgence d'une échéance : libellé et variante de couleur (chaîne vide = pastille neutre). */
export interface PastilleUrgence {
  lbl: string
  k: '' | 'rust' | 'amber' | 'gold' | 'sage'
}

/** Tâche de la file d'actions, avec le nombre de jours avant son échéance (null si date illisible). */
type TacheCockpit = TacheDemo & { d: number | null }

/** Assistant IA proposé : route, nom, rôle et pictogramme. */
type AssistantIaCockpit = [route: string, nom: string, description: string, icone: string]

const ASSISTANTS_IA_COCKPIT: AssistantIaCockpit[] = [
  ['max', 'Max — Juridique', 'Rédige requêtes, vérifie la procédure', 'grad'],
  ['lea', 'Léa — Comptable', 'Contrôle le compte séparé, les impayés', 'sparkle'],
  ['alfredo', 'Alfredo — Courriers', 'Génère et envoie les LRAR', 'mail'],
  ['tempo', 'Tempo — Échéances', 'Surveille tous les délais légaux', 'clock'],
]

/**
 * Échelle d'urgence : sans date « — » ; en retard ou aujourd'hui en rouille ; J-1 à J-3 ambre ; J-4 à J-10 or ;
 * au-delà sauge.
 */
export const pastilleUrgence = (jours: number | null): PastilleUrgence =>
  jours == null
    ? {
        lbl: '—',
        k: '',
      }
    : jours < 0
      ? {
          lbl: `Retard ${Math.abs(jours)} j`,
          k: 'rust',
        }
      : jours === 0
        ? {
            lbl: "Aujourd'hui",
            k: 'rust',
          }
        : jours <= 3
          ? {
              lbl: `J-${jours}`,
              k: 'amber',
            }
          : jours <= 10
            ? {
                lbl: `J-${jours}`,
                k: 'gold',
              }
            : {
                lbl: `J-${jours}`,
                k: 'sage',
              }

/**
 * Cockpit (écran par défaut) : bandeau du jour selon le rôle du cabinet, radar des mandats, échéances légales du
 * portefeuille (fenêtre J-60 à J+120), file d'actions triée par urgence (état « fait » local, non persisté),
 * centre d'automatisation, génération express d'actes et assistants IA.
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
    portefeuille = useEcheancesPortefeuille(),
    trouverCopro = useTrouverCopro(),
    echeancesFenetre = filtrerEcheancesAAfficher(portefeuille.items, AUJOURDHUI_ISO).filter((item) => {
      if (!item.echeance.dateRetenue) return false
      const jours = ecartJours(AUJOURDHUI_ISO, item.echeance.dateRetenue)
      return jours >= -60 && jours <= 120
    }),
    nombreSurEvenement = portefeuille.items.filter((item) => !item.echeance.dateRetenue).length,
    taches: TacheCockpit[] = (role === 'Direction' ? DEMO_TACHES : DEMO_TACHES.filter((tache) => tache.role === role))
      .map((tache) => ({
        ...tache,
        d: joursAvantDateFr(tache.due),
      }))
      .sort((a, b) => (a.d ?? 999) - (b.d ?? 999)),
    nombreAMener = taches.filter((tache) => !faits.has(tache.id)).length,
    nombreEnRetard = taches.filter((tache) => !faits.has(tache.id) && tache.d != null && tache.d < 0).length,
    nombreAujourdhui = taches.filter((tache) => !faits.has(tache.id) && tache.d === 0).length,
    heuresEconomisees = (12.5 + faits.size * 0.6).toFixed(1),
    salutation = (MODE_ACTIF === 'demo' ? 9 : new Date().getHours()) < 13 ? 'Bonjour' : 'Bonsoir',
    titreAlerteRetard =
      nombreEnRetard +
      ' échéance' +
      (nombreEnRetard > 1 ? 's' : '') +
      ' légale' +
      (nombreEnRetard > 1 ? 's' : '') +
      ' dépassée' +
      (nombreEnRetard > 1 ? 's' : '')
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
      {nombreEnRetard > 0 && (
        <Alert kind="warn" icon="siren" title={titreAlerteRetard}>
          {
            "Une échéance non tenue engage la responsabilité du cabinet auprès du tribunal. Traitez les actions en rouge en priorité — l'acte correspondant se génère en un clic."
          }
        </Alert>
      )}
      <div className="section-eyebrow">
        <span>Radar des mandats — prochaine échéance de mission</span>
        <div className="line" />
      </div>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))',
          gap: 12,
          marginBottom: 8,
        }}
      >
        {DEMO_COPROPRIETES.map((copro) => {
          const jours = joursAvantDateFr(copro.echeance),
            pastille = pastilleUrgence(jours)
          return (
            <button
              onClick={() => ouvrirEcran('mandats')}
              style={{
                textAlign: 'left',
                cursor: 'pointer',
                background: 'var(--paper)',
                border: '1px solid var(--line)',
                borderRadius: 12,
                padding: 16,
              }}
              key={copro.id}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: 8,
                }}
              >
                <span
                  style={{
                    width: 30,
                    height: 30,
                    borderRadius: 8,
                    background: 'var(--cream)',
                    display: 'grid',
                    placeItems: 'center',
                    fontFamily: 'Cormorant Garamond,serif',
                    fontWeight: 600,
                  }}
                >
                  {copro.code}
                </span>
                <Pill kind={pastille.k} noDot>
                  {pastille.lbl}
                </Pill>
              </div>
              <div
                style={{
                  fontFamily: 'Cormorant Garamond, serif',
                  fontSize: 17,
                  fontWeight: 500,
                  lineHeight: 1.2,
                }}
              >
                {copro.nom}
              </div>
              <div
                style={{
                  fontSize: 11.5,
                  color: 'var(--navy-300)',
                  marginTop: 3,
                }}
              >
                {copro.fondement}
              </div>
              <div
                style={{
                  fontSize: 11.5,
                  color: 'var(--navy-500)',
                  marginTop: 6,
                }}
              >
                {'Fin de mission · '}
                {copro.echeance}
              </div>
            </button>
          )
        })}
      </div>
      <Panel
        title="Échéances légales · tous les mandats"
        sub={`Moteur de délais légaux · de J-60 à J+120 autour du ${dateIsoVersFr(AUJOURDHUI_ISO)} · ${nombreSurEvenement} échéance${nombreSurEvenement > 1 ? 's' : ''} à déclencher sur événement`}
        icon="clock"
        right={
          <Pill kind="navy" noDot>
            {echeancesFenetre.length}
          </Pill>
        }
        flush
      >
        {portefeuille.loading ? (
          <div
            style={{
              padding: '22px',
              textAlign: 'center',
              color: 'var(--navy-300)',
              fontSize: 13,
            }}
          >
            Chargement des mandats…
          </div>
        ) : (
          <ListeEcheancesLegales
            items={echeancesFenetre}
            reference={AUJOURDHUI_ISO}
            max={8}
            vide={portefeuille.erreur ? MESSAGES_ETAT_ECHEANCES.indisponible : 'Aucune échéance légale dans la fenêtre.'}
          />
        )}
      </Panel>
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
        <Panel
          title="Génération express d'actes"
          sub="Un clic = l'acte prêt, données du mandat fusionnées"
          icon="sparkle"
        >
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: 10,
            }}
          >
            {(Object.entries(MODELES_ACTES_EXPRESS) as [CleActeExpress, ModeleActeExpress][]).map(([cle, modele]) => (
              <button
                onClick={() => ouvrirActe(cle, modele.code)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  textAlign: 'left',
                  cursor: 'pointer',
                  background: '#fff',
                  border: '1px solid var(--line)',
                  borderRadius: 10,
                  padding: '12px 14px',
                }}
                key={cle}
              >
                <span
                  style={{
                    width: 34,
                    height: 34,
                    borderRadius: 9,
                    background: 'var(--cream)',
                    display: 'grid',
                    placeItems: 'center',
                    color: 'var(--navy-700)',
                    flexShrink: 0,
                  }}
                >
                  <Icon
                    name={modele.icon}
                    style={{
                      width: 17,
                      height: 17,
                    }}
                  />
                </span>
                <span
                  style={{
                    fontSize: 12.5,
                    fontWeight: 600,
                    lineHeight: 1.25,
                  }}
                >
                  {modele.label}
                </span>
              </button>
            ))}
          </div>
        </Panel>
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
