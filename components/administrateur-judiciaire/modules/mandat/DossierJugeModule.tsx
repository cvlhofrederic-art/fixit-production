'use client'

import { useState } from 'react'
import { RedactionAutomatiqueJuge } from '@/components/administrateur-judiciaire/modules/mandat/composants/RedactionAutomatiqueJuge'
import { Alert } from '@/components/administrateur-judiciaire/ui/Alert'
import { Icon } from '@/components/administrateur-judiciaire/ui/Icon'
import { Kpis } from '@/components/administrateur-judiciaire/ui/Kpis'
import { PageHead } from '@/components/administrateur-judiciaire/ui/PageHead'
import { Panel } from '@/components/administrateur-judiciaire/ui/Panel'
import { Pill } from '@/components/administrateur-judiciaire/ui/Pill'
import { SelecteurCopropriete } from '@/components/administrateur-judiciaire/ui/SelecteurCopropriete'
import { useToast } from '@/components/administrateur-judiciaire/ui/toast'
import { useDonneesLocales } from '@/lib/administrateur-judiciaire/db/hooks'
import { useFiche360Copropriete } from '@/lib/administrateur-judiciaire/db/use-fiches-360'
import {
  composerAideMemoireAudience,
  composerRapportJuge,
} from '@/lib/administrateur-judiciaire/domain/actes/dossier-juge'
import { dateIsoVersFr } from '@/lib/administrateur-judiciaire/domain/dates'
import type { EcheanceCalculee } from '@/lib/administrateur-judiciaire/domain/delais-legaux'
import { badgeStatutEcheance } from '@/lib/administrateur-judiciaire/domain/echeances-affichage'
import { MESSAGES_ETAT_ECHEANCES } from '@/lib/administrateur-judiciaire/domain/echeances-mandat'
import { LIBELLES_REGIMES, regimeDepuisFondement } from '@/lib/administrateur-judiciaire/domain/fondements'
import { formatDateOuPoint } from '@/lib/administrateur-judiciaire/domain/format'
import { AUJOURDHUI_ISO } from '@/lib/administrateur-judiciaire/mode'
import { codeCoproSelectionne, useSelectionDossier } from '@/lib/administrateur-judiciaire/selection'

/** Document composé pour le juge : rapport au tribunal ou aide-mémoire d'audience. */
export type DocumentDossierJuge = 'rapport' | 'memo'

/** Échéance du moteur dont la date retenue est connue. */
type EcheanceDatee = EcheanceCalculee & { dateRetenue: string }

/**
 * Date d'une vue copropriété pour formatDateOuPoint : sans mandat, la vue porte une chaîne ISO (createdAt),
 * affichée « · » comme dans la maquette (seules les Date sont formatées).
 */
const dateOuNull = (valeur: Date | string): Date | null => (valeur instanceof Date ? valeur : null)

/**
 * Dossier du juge (données réelles) : rapport au juge et aide-mémoire d'audience composés depuis la fiche 360 de la
 * copropriété (« TL » à défaut de sélection), indicateurs du mandat, rédaction automatique des actes et sommaire du rapport.
 */
export function DossierJugeModule() {
  const { push } = useToast(),
    { code, choisirCopro } = useSelectionDossier(),
    [codeLocal, setCodeLocal] = useState(() => codeCoproSelectionne('TL')),
    codeCopro = codeLocal || code,
    { loading, erreur, fiche } = useFiche360Copropriete(codeCopro),
    { impayes } = useDonneesLocales(),
    regime = fiche ? regimeDepuisFondement(fiche.vue.fondement) : null,
    ouvrirDocument = (nature: DocumentDossierJuge) => {
      if (!fiche) return
      const qualite = regime === 'ap291' || regime === 'ap47' ? 'Administrateur provisoire' : 'Syndic judiciaire'
      push(
        nature === 'rapport'
          ? {
              kind: 'doc',
              icon: 'scale',
              title: 'Rapport au juge',
              eyebrow: `${qualite} · Cabinet Delaunay`,
              docTitle: `Rapport au ${fiche.vue.tribunal || 'tribunal judiciaire'}`,
              meta: `${fiche.vue.nom} · RG ${fiche.vue.rg || '·'} · établi le ${dateIsoVersFr(AUJOURDHUI_ISO)}`,
              lines: composerRapportJuge(fiche, AUJOURDHUI_ISO),
            }
          : {
              kind: 'doc',
              icon: 'clipboard',
              title: "Aide-mémoire d'audience",
              eyebrow: `${qualite} · Cabinet Delaunay`,
              docTitle: "Aide-mémoire d'audience",
              meta: `${fiche.vue.nom} · ${dateIsoVersFr(AUJOURDHUI_ISO)}`,
              lines: composerAideMemoireAudience(fiche, AUJOURDHUI_ISO),
            },
      )
    },
    echeancesEchues: EcheanceDatee[] = fiche
      ? fiche.echeances.echeances.filter(
          (echeance): echeance is EcheanceDatee =>
            !echeance.accomplie &&
            !!echeance.dateRetenue &&
            (echeance.nature === 'obligation' || echeance.nature === 'repere') &&
            badgeStatutEcheance(echeance, AUJOURDHUI_ISO).kind === 'rust',
        )
      : []
  return (
    <>
      <PageHead
        eyebrow="Mandat judiciaire · chantier 3"
        title="Dossier du juge"
        lede="Rapport au juge et aide-mémoire d'audience composés depuis les données réelles du mandat. Ce que la base ne sait pas est dit absent, jamais inventé."
        actions={
          <>
            <SelecteurCopropriete
              value={codeCopro ?? ''}
              onChange={(codeChoisi) => {
                setCodeLocal(codeChoisi)
                choisirCopro(codeChoisi)
              }}
            />
            <button className="btn" onClick={() => ouvrirDocument('memo')} disabled={!fiche}>
              <Icon name="clipboard" />
              {"Aide-mémoire d'audience"}
            </button>
            <button className="btn gold" onClick={() => ouvrirDocument('rapport')} disabled={!fiche}>
              <Icon name="scale" />
              Rapport au juge
            </button>
          </>
        }
      />
      {loading && <Alert kind="info" icon="clock" title={MESSAGES_ETAT_ECHEANCES.chargement} />}
      {!loading && !fiche && (
        <Alert
          kind="warn"
          icon="alert"
          title={erreur ? MESSAGES_ETAT_ECHEANCES.indisponible : MESSAGES_ETAT_ECHEANCES.introuvable}
        />
      )}
      {fiche && (
        <>
          <Kpis
            items={[
              {
                icon: 'scale',
                num: regime ? LIBELLES_REGIMES[regime].libelle.split(' ')[0] : '·',
                lbl: 'Régime',
                sub: fiche.vue.fondement,
              },
              {
                icon: 'check',
                num: fiche.echeances.echeances.filter((echeance) => echeance.accomplie).length,
                lbl: 'Diligences accomplies',
                sub: 'enregistrées',
                accent: 'sage',
              },
              {
                icon: 'alert',
                num: echeancesEchues.length,
                lbl: 'Échéances échues',
                sub: echeancesEchues.length
                  ? echeancesEchues.map((echeance) => dateIsoVersFr(echeance.dateRetenue)).join(', ')
                  : 'aucune',
                accent: echeancesEchues.length ? 'rust' : 'sage',
              },
              {
                icon: 'clock',
                num: formatDateOuPoint(dateOuNull(fiche.vue.echeance)),
                lbl: 'Fin de mission',
                sub: fiche.vue.dureeMois ? `${fiche.vue.dureeMois} mois` : '·',
                accent: 'amber',
              },
            ]}
          />
          <RedactionAutomatiqueJuge fiche={fiche} impayes={impayes} />
          <Panel title="Contenu du rapport" sub="Sections composées automatiquement · aperçu" icon="doc">
            <ol
              style={{
                margin: 0,
                paddingLeft: 18,
                fontSize: 13,
                lineHeight: 1.7,
              }}
            >
              <li>Mission : fondement, décision, durée, notification.</li>
              <li>Diligences accomplies : actes enregistrés comme accomplis, avec leur texte.</li>
              <li>
                {'Échéances en cours : dates légales et situation au '}
                {dateIsoVersFr(AUJOURDHUI_ISO)}.
              </li>
              <li>
                {
                  "Situation financière déclarée : budget, charges, impayés et seuil de l'art. 29-1 A, fonds de travaux, débiteurs."
                }
              </li>
              <li>{"Points d'attention : échéances échues, seuil d'impayés, délais du moteur à confirmer."}</li>
              <li>Chronologie des douze derniers événements datés.</li>
            </ol>
            <p
              style={{
                fontSize: 12,
                color: 'var(--navy-500)',
                margin: '10px 0 0',
              }}
            >
              {'Non couvert : comptes bancaires détaillés, procédures, sinistres, honoraires. '}
              <Pill kind="amber" noDot>
                Taxation au barème : point ouvert
              </Pill>
            </p>
          </Panel>
        </>
      )}
    </>
  )
}
