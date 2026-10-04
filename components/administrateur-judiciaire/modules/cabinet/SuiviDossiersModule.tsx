'use client'

import { useEffect, useRef, useState } from 'react'
import { DEMO_DOSSIERS_SUIVI, type DossierSuivi } from '@/components/administrateur-judiciaire/data/suivi-dossiers'
import {
  DossierSuiviModal,
  type DossierSuiviAvecStatut,
  type ResultatDossierSuivi,
} from '@/components/administrateur-judiciaire/modules/cabinet/composants/DossierSuiviModal'
import { Alert } from '@/components/administrateur-judiciaire/ui/Alert'
import { DataTable, type ColonneTableau } from '@/components/administrateur-judiciaire/ui/DataTable'
import { Icon } from '@/components/administrateur-judiciaire/ui/Icon'
import { Kpis } from '@/components/administrateur-judiciaire/ui/Kpis'
import { PageHead } from '@/components/administrateur-judiciaire/ui/PageHead'
import { Panel } from '@/components/administrateur-judiciaire/ui/Panel'
import { Pill } from '@/components/administrateur-judiciaire/ui/Pill'
import { ProgressBar } from '@/components/administrateur-judiciaire/ui/ProgressBar'
import { useToast } from '@/components/administrateur-judiciaire/ui/toast'
import { formatDureeHms, formatDureeMinutes } from '@/lib/administrateur-judiciaire/domain/format'
import {
  calculerStatutSuiviDossier,
  DATE_REFERENCE_SUIVI_DOSSIERS,
  parserDateEcheanceSuivi,
} from '@/lib/administrateur-judiciaire/domain/suivi-dossiers'

/** Clé localStorage du seuil d'alerte de retard de traitement (jours). */
export const CLE_STOCKAGE_SEUIL_SUIVI = 'vitfix.aj.pt.sla'

/** Seuil d'alerte par défaut (jours sans action). */
const SEUIL_PAR_DEFAUT = 7

/** Seuil enregistré, ou 7 jours (valeur absente, nulle ou non numérique, ou stockage indisponible). */
const lireSeuilStocke = (): number => {
  try {
    return Number(localStorage.getItem(CLE_STOCKAGE_SEUIL_SUIVI)) || SEUIL_PAR_DEFAUT
  } catch {
    // localStorage indisponible (navigation privée, stockage bloqué) : seuil par défaut.
    return SEUIL_PAR_DEFAUT
  }
}

/**
 * Texte de l'alerte d'un dossier non « à jour ». « 1 jours » (pluriel invariable) est conservé tel quel.
 */
export const texteAlerteSuiviDossier = (dossier: DossierSuiviAvecStatut): string => {
  const echeance = parserDateEcheanceSuivi(dossier.echeance),
    jours = echeance ? Math.round((echeance.getTime() - DATE_REFERENCE_SUIVI_DOSSIERS.getTime()) / 864e5) : null
  return dossier.stat.k === 'retard'
    ? jours != null && jours < 0
      ? 'Échéance dépassée de ' + -jours + ' jours'
      : 'Aucun traitement depuis ' + dossier.retard + ' jours'
    : 'Échéance dans ' + jours + ' jours'
}

/**
 * Suivi des dossiers : temps passé par dossier (chronomètre manuel, un seul dossier à la fois), alertes de retard
 * de traitement selon un seuil réglable, et ouverture du dossier (checklist, diligences, pièces). Démo, sans persistance.
 */
export function SuiviDossiersModule() {
  const { push } = useToast()
  const [seuil, setSeuil] = useState<number>(lireSeuilStocke)
  const [dossiers, setDossiers] = useState<DossierSuivi[]>(DEMO_DOSSIERS_SUIVI)
  const [codeOuvert, setCodeOuvert] = useState<string | null>(null)
  const [codeChrono, setCodeChrono] = useState<string | null>(null)
  const refDebut = useRef<number | null>(null)
  const [maintenant, setMaintenant] = useState(Date.now())

  useEffect(() => {
    if (!codeChrono) return
    const minuteur = setInterval(() => setMaintenant(Date.now()), 1e3)
    return () => clearInterval(minuteur)
  }, [codeChrono])

  const minutesEcoulees = codeChrono && refDebut.current ? Math.floor((maintenant - refDebut.current) / 6e4) : 0,
    secondesEcoulees = codeChrono && refDebut.current ? Math.floor((maintenant - refDebut.current) / 1e3) : 0
  const basculerChrono = (code: string) => {
    if (codeChrono === code) {
      const minutes = Math.max(1, Math.round((Date.now() - (refDebut.current ?? 0)) / 6e4))
      setDossiers((liste) =>
        liste.map((dossier) =>
          dossier.code === code
            ? {
                ...dossier,
                mois: dossier.mois + minutes,
                derniere: '19/06',
                retard: 0,
              }
            : dossier,
        ),
      )
      setCodeChrono(null)
      push({
        kind: 'success',
        title: 'Simulation (session)',
        desc: formatDureeMinutes(minutes) + ' affichés pour la session en cours — pas encore enregistrés durablement.',
      })
    } else {
      if (codeChrono) {
        // Passage à un autre dossier : l'ancien est crédité sans toast.
        const minutes = Math.max(1, Math.round((Date.now() - (refDebut.current ?? 0)) / 6e4))
        setDossiers((liste) =>
          liste.map((dossier) =>
            dossier.code === codeChrono
              ? {
                  ...dossier,
                  mois: dossier.mois + minutes,
                }
              : dossier,
          ),
        )
      }
      refDebut.current = Date.now()
      setMaintenant(Date.now())
      setCodeChrono(code)
    }
  }
  const changerSeuil = (valeur: number) => {
    setSeuil(valeur)
    try {
      localStorage.setItem(CLE_STOCKAGE_SEUIL_SUIVI, String(valeur))
    } catch {
      // localStorage indisponible : le seuil reste valable pour la session en cours.
    }
  }
  const lignes: DossierSuiviAvecStatut[] = dossiers.map((dossier) => ({
    ...dossier,
    stat: calculerStatutSuiviDossier(dossier, seuil),
  }))
  const alertes = lignes.filter((ligne) => ligne.stat.k !== 'ok')
  const totalMinutes =
    dossiers.reduce((total, dossier) => total + dossier.mois, 0) + (codeChrono ? minutesEcoulees : 0)
  const enRetard = lignes.filter((ligne) => ligne.stat.k === 'retard').length
  const enregistrerDossier = (code: string, resultat: ResultatDossierSuivi) => {
    setDossiers((liste) =>
      liste.map((dossier) =>
        dossier.code === code
          ? {
              ...dossier,
              derniere: '19/06',
              retard: 0,
            }
          : dossier,
      ),
    )
    setCodeOuvert(null)
    push({
      kind: 'success',
      title: 'Simulation (session)',
      desc:
        resultat.done +
        '/' +
        resultat.total +
        " étapes affichées pour la session en cours — le dossier n'est pas encore enregistré durablement.",
    })
  }

  const colonnes: ColonneTableau<DossierSuiviAvecStatut>[] = [
    {
      h: 'Dossier',
      render: (ligne) => (
        <div>
          <b>{ligne.nom}</b>
          <div
            style={{
              fontSize: 12,
              color: 'var(--navy-300)',
            }}
          >
            {ligne.gest}
          </div>
        </div>
      ),
    },
    {
      h: 'Temps (mois)',
      render: (ligne) => {
        const chronoActif = codeChrono === ligne.code,
          minutes = ligne.mois + (chronoActif ? minutesEcoulees : 0)
        return (
          <div
            style={{
              minWidth: 140,
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                fontSize: 12.5,
                marginBottom: 4,
              }}
            >
              <span
                style={{
                  fontFamily: 'JetBrains Mono,monospace',
                  fontWeight: 600,
                  color: chronoActif ? 'var(--sage-600)' : 'inherit',
                }}
              >
                {chronoActif ? formatDureeHms(secondesEcoulees) : formatDureeMinutes(minutes)}
              </span>
              <span
                style={{
                  color: 'var(--navy-300)',
                }}
              >
                {'/ '}
                {formatDureeMinutes(ligne.budget)}
              </span>
            </div>
            <ProgressBar
              pct={Math.min(100, Math.round((minutes / ligne.budget) * 100))}
              kind={minutes > ligne.budget ? 'rust' : 'gold'}
            />
          </div>
        )
      },
    },
    {
      h: 'Dernière action',
      render: (ligne) => (
        <span
          style={{
            fontSize: 13,
          }}
        >
          {ligne.derniere}
        </span>
      ),
    },
    {
      h: 'Échéance',
      render: (ligne) => (
        <span
          style={{
            fontSize: 13,
          }}
        >
          {ligne.echeance}
        </span>
      ),
    },
    {
      h: 'Statut',
      render: (ligne) => (
        <Pill kind={ligne.stat.pill} noDot>
          {ligne.stat.label}
        </Pill>
      ),
    },
    {
      h: '',
      render: (ligne) => {
        const chronoActif = codeChrono === ligne.code
        return (
          <div
            style={{
              display: 'flex',
              gap: 6,
              justifyContent: 'flex-end',
            }}
          >
            <button
              className="btn sm"
              style={
                chronoActif
                  ? {
                      background: 'var(--rust-600)',
                      color: '#fff',
                      borderColor: 'var(--rust-600)',
                    }
                  : {
                      background: 'var(--gold-500)',
                      color: '#fff',
                      borderColor: 'var(--gold-500)',
                    }
              }
              onClick={() => basculerChrono(ligne.code)}
            >
              {chronoActif ? 'Arrêter' : 'Démarrer'}
            </button>
            <button className="btn ghost sm" onClick={() => setCodeOuvert(ligne.code)}>
              <Icon name="folder" width="15" height="15" />
              Ouvrir dossier
            </button>
          </div>
        )
      },
    },
  ]
  const dossierOuvert = codeOuvert ? lignes.find((ligne) => ligne.code === codeOuvert) : undefined

  return (
    <>
      <PageHead
        eyebrow="Cabinet & supervision"
        title="Suivi des dossiers"
        lede="Temps passé par dossier et alertes de retard de traitement."
      />
      {alertes.length > 0 && (
        <div
          style={{
            marginBottom: 16,
            display: 'grid',
            gap: 10,
          }}
        >
          {alertes.map((ligne) => (
            <Alert kind={ligne.stat.pill} icon="alert" title={ligne.nom + ' — ' + ligne.gest} key={ligne.code}>
              {texteAlerteSuiviDossier(ligne)}
              {'. Dernière action le '}
              {ligne.derniere}.
            </Alert>
          ))}
        </div>
      )}
      <Kpis
        items={[
          {
            icon: 'clock',
            num: formatDureeMinutes(totalMinutes),
            lbl: 'Temps dossiers (mois)',
          },
          {
            icon: 'alert',
            num: enRetard,
            lbl: 'Dossiers en retard',
            accent: enRetard ? 'rust' : 'sage',
          },
          {
            icon: 'chart',
            num: formatDureeMinutes(Math.round(totalMinutes / dossiers.length)),
            lbl: 'Temps moyen / dossier',
            accent: 'gold',
          },
          {
            icon: 'users',
            num: new Set(dossiers.map((dossier) => dossier.gest)).size,
            lbl: 'Gestionnaires actifs',
          },
        ]}
      />
      <Panel
        title="Alerte de retard de traitement"
        sub="Une alerte se déclenche au-delà de ce délai sans action sur un dossier"
        icon="bell"
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 16,
          }}
        >
          <input
            className="pt-range"
            type="range"
            min={3}
            max={30}
            step={1}
            value={seuil}
            onChange={(evenement) => changerSeuil(Number(evenement.target.value))}
            aria-label="Seuil d'alerte en jours"
          />
          <div
            style={{
              fontFamily: 'JetBrains Mono,monospace',
              fontSize: 16,
              fontWeight: 600,
              minWidth: 150,
              textAlign: 'right',
            }}
          >
            {seuil}
            {' jours sans action'}
          </div>
        </div>
      </Panel>
      <Panel
        title="Suivi du temps par dossier"
        sub="Chronomètre manuel — démarrez le suivi quand vous travaillez sur un dossier"
        icon="clock"
        flush
      >
        <DataTable rowKey="code" columns={colonnes} rows={lignes} />
      </Panel>
      {codeOuvert && dossierOuvert && (
        <DossierSuiviModal
          dossier={dossierOuvert}
          onClose={() => setCodeOuvert(null)}
          onSave={(resultat) => enregistrerDossier(codeOuvert, resultat)}
        />
      )}
    </>
  )
}
