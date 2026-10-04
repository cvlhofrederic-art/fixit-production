'use client'

import { useState } from 'react'
import { AssistantMandatModal } from '@/components/administrateur-judiciaire/modules/mandat/composants/AssistantMandatModal'
import { naviguerVers } from '@/components/administrateur-judiciaire/shell/navigation'
import { Alert } from '@/components/administrateur-judiciaire/ui/Alert'
import { DetailModal, type ChampDetail } from '@/components/administrateur-judiciaire/ui/DetailModal'
import { Icon } from '@/components/administrateur-judiciaire/ui/Icon'
import { Kpis } from '@/components/administrateur-judiciaire/ui/Kpis'
import { PageHead } from '@/components/administrateur-judiciaire/ui/PageHead'
import { Panel } from '@/components/administrateur-judiciaire/ui/Panel'
import { Pill } from '@/components/administrateur-judiciaire/ui/Pill'
import { useToast } from '@/components/administrateur-judiciaire/ui/toast'
import { useCoproprietesAffichees, type CoproprieteAffichee } from '@/lib/administrateur-judiciaire/db/hooks'
import { joursAvantDateFr } from '@/lib/administrateur-judiciaire/domain/dates'
import { regimeDepuisFondement, type Regime } from '@/lib/administrateur-judiciaire/domain/fondements'

/**
 * Filtre des puces : toutes les missions, art. 46 (fondement contenant « 46 »), art. 29-1 (contenant « 29-1 »),
 * ou échéance proche / mission expirée / prorogation demandée.
 */
export type FiltreMissions = 'toutes' | 'a46' | 'a29' | 'proche'

/** Puce de filtre : identifiant, libellé et nombre de missions concernées. */
type PuceFiltre = [id: FiltreMissions, libelle: string, nombre: number]

/** Fiche « dossier » d'une mission, affichée dans la DetailModal. */
interface FicheMission {
  title: string
  icon: string
  footnote: string
  fields: ChampDetail[]
}

/** Fondement cité par la note de la fiche, selon le régime reconnu dans le libellé du fondement. */
const FONDEMENT_MISSION_PAR_REGIME: Record<Regime, string> = {
  sj: "l'article 46 du décret du 17 mars 1967 (carence de désignation)",
  ap47: "l'article 47 du décret du 17 mars 1967 (syndicat dépourvu de syndic)",
  ap291: 'les articles 29-1 et suivants de la loi du 10 juillet 1965 (copropriété en difficulté)',
}

/** Échéance dans les 90 jours à venir (jour même inclus). */
const estEcheanceProche = (copro: CoproprieteAffichee): boolean => {
  const jours = joursAvantDateFr(copro.echeance)
  return jours != null && jours >= 0 && jours <= 90
}

/** Échéance dépassée : la mission a pris fin sans prorogation. */
const estMissionExpiree = (copro: CoproprieteAffichee): boolean => {
  const jours = joursAvantDateFr(copro.echeance)
  return jours != null && jours < 0
}

/** Fiche détail d'une mission (le libellé de la notification dépend du régime : art. 62-5 si 29-1, sinon art. 59). */
const ficheMission = (copro: CoproprieteAffichee): FicheMission => {
  const regime = regimeDepuisFondement(copro.fondement)
  return {
    title: copro.nom,
    icon: 'scale',
    footnote: `Mission fondée sur ${(regime && FONDEMENT_MISSION_PAR_REGIME[regime]) || 'le fondement indiqué : ' + copro.fondement}. Le syndic exerce les fonctions des articles 18 à 18-2 de la loi de 1965.`,
    fields: [
      {
        k: 'Tribunal',
        v: copro.tribunal,
      },
      {
        k: 'Numéro RG',
        v: copro.rg,
      },
      {
        k: "Date de l'ordonnance",
        v: copro.ordonnance,
      },
      {
        k: 'Durée de la mission',
        v: `${copro.dureeMois} mois`,
      },
      {
        k: 'Échéance',
        v: copro.echeance,
      },
      {
        k: 'Fondement',
        v: copro.fondement,
      },
      {
        k: 'Lots',
        v: `${copro.lots} lots`,
      },
      {
        k: `Notification (art. ${regime === 'ap291' ? '62-5' : '59'} décret)`,
        v: copro.notifOrdonnance,
      },
      {
        k: 'Motif de la désignation',
        v: copro.motif,
        full: true,
      },
      {
        k: 'Adresse',
        v: copro.adresse,
        full: true,
      },
    ],
  }
}

/**
 * Ordonnances & missions : mandats judiciaires de la base locale (repli démo selon le mode), filtrables par
 * fondement ou par urgence, avec échéances, requête en prorogation (document figé), convocation de l'AG élective,
 * fiche dossier et assistant d'enregistrement d'une ordonnance.
 */
export function OrdonnancesMissionsModule() {
  const { push } = useToast()
  const [fiche, setFiche] = useState<FicheMission | null>(null)
  const [filtre, setFiltre] = useState<FiltreMissions>('toutes')
  const [assistantOuvert, setAssistantOuvert] = useState(false)
  const copros = useCoproprietesAffichees()

  const compterRegime = (regime: Regime) =>
    copros.filter((copro) => regimeDepuisFondement(copro.fondement) === regime).length
  const missionsExpirees = copros.filter(estMissionExpiree)
  const echeanceLaPlusProche: CoproprieteAffichee | undefined = copros
    .filter((copro) => {
      const jours = joursAvantDateFr(copro.echeance)
      return jours != null && jours >= 0
    })
    // Les échéances non datées ont été écartées par le filtre : les deux écarts sont des nombres.
    .sort((a, b) => (joursAvantDateFr(a.echeance) ?? 0) - (joursAvantDateFr(b.echeance) ?? 0))[0]
  const missionsFiltrees = copros.filter((copro) =>
    filtre === 'a46'
      ? copro.fondement.includes('46')
      : filtre === 'a29'
        ? copro.fondement.includes('29-1')
        : filtre === 'proche'
          ? estEcheanceProche(copro) || estMissionExpiree(copro) || copro.statut === 'Prorogation demandée'
          : true,
  )
  const puces: PuceFiltre[] = [
    ['toutes', 'Toutes', copros.length],
    ['a46', 'Art. 46 — carence', copros.filter((copro) => copro.fondement.includes('46')).length],
    ['a29', 'Art. 29-1 — difficulté', copros.filter((copro) => copro.fondement.includes('29-1')).length],
    [
      'proche',
      'Échéance / prorogation',
      copros.filter(
        (copro) => estEcheanceProche(copro) || estMissionExpiree(copro) || copro.statut === 'Prorogation demandée',
      ).length,
    ],
  ]

  return (
    <>
      <PageHead
        eyebrow="Mandat judiciaire"
        title="Ordonnances & missions"
        lede="Désignations prononcées par le Tribunal judiciaire — fondement, périmètre, durée et échéances de chaque mission."
        actions={
          <>
            <button
              className="btn"
              onClick={() =>
                push({
                  kind: 'doc',
                  icon: 'download',
                  title: 'Export de données',
                  eyebrow: 'Syndic judiciaire · Cabinet Delaunay',
                  docTitle: "Récapitulatif d'export",
                  meta: 'Généré le 19/06/2026 · format CSV / XLSX',
                  lines: [
                    "L'export contient l'ensemble des données du module sur la période sélectionnée.",
                    {
                      h: 'Contenu',
                    },
                    {
                      k: 'Lignes exportées',
                      v: '248',
                    },
                    {
                      k: 'Période',
                      v: '01/01/2026 — 19/06/2026',
                    },
                    {
                      k: 'Format',
                      v: 'CSV (UTF-8) et XLSX',
                    },
                    {
                      k: 'Colonnes',
                      v: '12',
                    },
                  ],
                })
              }
            >
              <Icon name="download" />
              Exporter
            </button>
            <button className="btn gold" onClick={() => setAssistantOuvert(true)}>
              <Icon name="plus" />
              Enregistrer une ordonnance
            </button>
          </>
        }
      />
      <Kpis
        items={[
          {
            icon: 'scale',
            num: compterRegime('sj') + compterRegime('ap47'),
            lbl: 'Mandats art. 46 et 47',
            sub: `${compterRegime('sj')} syndic judiciaire · ${compterRegime('ap47')} administrateur provisoire`,
            accent: 'sage',
          },
          {
            icon: 'shield',
            num: compterRegime('ap291'),
            lbl: `Mandat${compterRegime('ap291') > 1 ? 's' : ''} art. 29-1`,
            sub: 'Copropriété en difficulté',
            accent: 'amber',
          },
          {
            icon: 'clock',
            num: echeanceLaPlusProche ? `${joursAvantDateFr(echeanceLaPlusProche.echeance)} j` : '·',
            lbl: 'Échéance la plus proche',
            sub: echeanceLaPlusProche ? echeanceLaPlusProche.nom : 'aucune',
            accent: 'amber',
            trend:
              echeanceLaPlusProche && regimeDepuisFondement(echeanceLaPlusProche.fondement) === 'sj'
                ? {
                    kind: 'warn',
                    label: 'AG à convoquer',
                  }
                : undefined,
          },
          {
            icon: 'alert',
            num: missionsExpirees.length,
            lbl: `Mission${missionsExpirees.length > 1 ? 's' : ''} expirée${missionsExpirees.length > 1 ? 's' : ''}`,
            sub: missionsExpirees.length
              ? missionsExpirees.map((copro) => copro.nom.replace(/^Copropriété /, '')).join(', ')
              : 'aucune',
            accent: 'rust',
            trend: missionsExpirees.length
              ? {
                  kind: 'bad',
                  label: 'prorogation à demander',
                }
              : undefined,
          },
        ]}
      />
      {missionsExpirees.length > 0 ? (
        <Alert
          kind="warn"
          icon="scale"
          title={`Mission${missionsExpirees.length > 1 ? 's' : ''} expirée${missionsExpirees.length > 1 ? 's' : ''} : ${missionsExpirees.map((copro) => copro.nom).join(', ')}`}
        >
          {
            "La mission cesse à la date fixée par l'ordonnance sans prorogation (Cass. 3e civ., 14 janv. 2016) : déposer sans délai une requête en prorogation, accompagnée du rapport au juge."
          }
        </Alert>
      ) : copros.length === 0 ? (
        <Alert kind="info" icon="scale" title="Aucun mandat dans la base">
          {"Créer un mandat depuis Fixy (ordonnance déposée) ou l'écran Copropriétés."}
        </Alert>
      ) : null}
      <div
        style={{
          display: 'flex',
          gap: 8,
          marginBottom: 18,
          flexWrap: 'wrap',
        }}
      >
        {puces.map(([id, libelle, nombre]) => (
          <button className={`chip ${filtre === id ? 'active' : ''}`} onClick={() => setFiltre(id)} key={id}>
            {libelle}{' '}
            <span
              style={{
                opacity: 0.6,
              }}
            >
              {nombre}
            </span>
          </button>
        ))}
      </div>
      <Panel flush>
        {missionsFiltrees.map((copro) => {
          const jours = joursAvantDateFr(copro.echeance),
            expiree = jours != null && jours < 0,
            echeanceProche = jours != null && jours >= 0 && jours <= 90
          return (
            <div
              style={{
                padding: '18px 22px',
                borderBottom: '1px solid var(--line)',
              }}
              key={copro.id}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  flexWrap: 'wrap',
                  marginBottom: 8,
                }}
              >
                <Pill noDot>{copro.fondement}</Pill>
                <Pill kind={copro.pill} noDot>
                  {copro.statut}
                </Pill>
                <span
                  className="mono"
                  style={{
                    fontSize: 11,
                    color: 'var(--navy-300)',
                  }}
                >
                  {'RG '}
                  {copro.rg}
                </span>
                <div
                  style={{
                    flex: 1,
                  }}
                />
                {expiree && (
                  <button
                    className="btn sm"
                    style={{
                      background: 'var(--rust-500)',
                      color: '#fff',
                      border: 'none',
                    }}
                    onClick={() =>
                      push({
                        kind: 'doc',
                        icon: 'scale',
                        title: 'Requête en prorogation de mission',
                        eyebrow: 'Syndic judiciaire · Cabinet Delaunay',
                        docTitle: 'Requête en prorogation',
                        meta: 'Tribunal judiciaire · art. 29-1',
                        lines: [
                          "L'administrateur sollicite la prorogation de sa mission pour douze mois.",
                          {
                            h: 'Motifs',
                          },
                          {
                            li: 'Redressement en cours, dette ramenée à 34 800 €',
                          },
                          {
                            li: 'Travaux non achevés',
                          },
                        ],
                      })
                    }
                  >
                    Demander la prorogation
                  </button>
                )}
                {echeanceProche && !expiree && (
                  <button
                    className="btn sm"
                    style={{
                      background: 'var(--gold-500)',
                      color: '#1a1a1a',
                      border: 'none',
                    }}
                    onClick={() => {
                      naviguerVers('agElective')
                    }}
                  >
                    {"Convoquer l'AG"}
                  </button>
                )}
                <button className="btn sm ghost" onClick={() => setFiche(ficheMission(copro))}>
                  Ouvrir le dossier
                </button>
              </div>
              <div
                style={{
                  fontFamily: 'Cormorant Garamond, serif',
                  fontSize: 18,
                  fontWeight: 500,
                  marginBottom: 4,
                }}
              >
                {copro.nom}
              </div>
              <div
                style={{
                  fontSize: 12.5,
                  color: 'var(--navy-500)',
                }}
              >
                {copro.adresse}
                {' · '}
                {copro.lots}
                {' lots'}
              </div>
              <div
                style={{
                  display: 'flex',
                  gap: 12,
                  marginTop: 8,
                  fontSize: 11.5,
                  color: 'var(--navy-300)',
                  flexWrap: 'wrap',
                }}
              >
                <span>{copro.tribunal}</span>
                <span>
                  {'Ordonnance du '}
                  {copro.ordonnance}
                </span>
                <span>
                  {'Échéance '}
                  {copro.echeance}
                  {jours != null ? ` · ${expiree ? 'expirée' : jours + ' j restants'}` : ''}
                </span>
              </div>
            </div>
          )
        })}
      </Panel>
      <DetailModal
        open={!!fiche}
        onClose={() => setFiche(null)}
        title={fiche?.title}
        icon={fiche?.icon}
        fields={fiche?.fields || []}
        footnote={fiche?.footnote}
      />
      <AssistantMandatModal open={assistantOuvert} onClose={() => setAssistantOuvert(false)} />
    </>
  )
}
