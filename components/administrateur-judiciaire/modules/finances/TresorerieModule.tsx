'use client'

import { useState, type ChangeEvent } from 'react'
import { EXEMPLE_RELEVE_BANCAIRE_CSV } from '@/components/administrateur-judiciaire/data/exemples-import'
import { naviguerVers } from '@/components/administrateur-judiciaire/shell/navigation'
import { Alert } from '@/components/administrateur-judiciaire/ui/Alert'
import { DataTable } from '@/components/administrateur-judiciaire/ui/DataTable'
import { Icon } from '@/components/administrateur-judiciaire/ui/Icon'
import { Kpis } from '@/components/administrateur-judiciaire/ui/Kpis'
import { PageHead } from '@/components/administrateur-judiciaire/ui/PageHead'
import { Panel } from '@/components/administrateur-judiciaire/ui/Panel'
import { Pill } from '@/components/administrateur-judiciaire/ui/Pill'
import { SelecteurCopropriete } from '@/components/administrateur-judiciaire/ui/SelecteurCopropriete'
import { useToast } from '@/components/administrateur-judiciaire/ui/toast'
import { useDonneesStore } from '@/lib/administrateur-judiciaire/db/donnees-store'
import { useDonneesLocales } from '@/lib/administrateur-judiciaire/db/hooks'
import type { Ecriture, Impaye } from '@/lib/administrateur-judiciaire/db/schema'
import { dateIsoVersFr, dateVersIso } from '@/lib/administrateur-judiciaire/domain/dates'
import { MESSAGES_ETAT_ECHEANCES } from '@/lib/administrateur-judiciaire/domain/echeances-mandat'
import { listerCoproprietairesCopropriete } from '@/lib/administrateur-judiciaire/domain/fiche-360'
import { formatEurosCentimes } from '@/lib/administrateur-judiciaire/domain/format'
import {
  dedoublonnerReleve,
  parserReleveBancaire,
  proposerImputations,
  type ConfianceImputation,
  type LigneReleve,
  type PropositionImputation,
  type ResultatReleve,
} from '@/lib/administrateur-judiciaire/domain/import/releve-bancaire'
import {
  analyserRecouvrement,
  ETAPES_RECOUVREMENT,
  type DefinitionEtapeRecouvrement,
  type EtapeRecouvrement,
} from '@/lib/administrateur-judiciaire/domain/recouvrement'
import { AUJOURDHUI_ISO } from '@/lib/administrateur-judiciaire/mode'
import { codeCoproSelectionne, useSelectionDossier } from '@/lib/administrateur-judiciaire/selection'

/** Pastille de confiance d'un rapprochement proposé (clés = champ confiance de proposerImputations). */
export const PILL_CONFIANCE_RAPPROCHEMENT: Record<ConfianceImputation, { kind: string; label: string }> = {
  forte: {
    kind: 'sage',
    label: 'Forte',
  },
  probable: {
    kind: 'amber',
    label: 'Probable',
  },
}

/** Copropriétaire proposé à l'imputation d'un encaissement. */
export interface CoproprietaireImputable {
  id: string
  nom: string
  solde: number
}

/** Relevé analysé : lecture du CSV, lignes retenues et doublons écartés, rapprochements proposés. */
export interface AnalyseReleve extends ResultatReleve {
  retenues: LigneReleve[]
  doublons: LigneReleve[]
  rapprochements: PropositionImputation<LigneReleve, CoproprietaireImputable>[]
}

/** Copropriétaire choisi pour chaque ligne retenue (index de ligne → id, « » = ne pas imputer). */
export type SelectionsImputation = Record<string, string>

/** Libellé d'une étape de recouvrement (toujours trouvée : l'étape vient de analyserRecouvrement). */
const libelleEtapeRecouvrement = (etape: EtapeRecouvrement): string =>
  (ETAPES_RECOUVREMENT.find((definition) => definition.etape === etape) as DefinitionEtapeRecouvrement).libelle

/** Montant signé d'une écriture du compte 512 : débit (encaissement) positif, crédit (décaissement) négatif. */
const montantSigne = (ecriture: Ecriture): number => (ecriture.sens === 'debit' ? ecriture.montant : -ecriture.montant)

/*
 * Correctifs de défauts hérités de la maquette : écritures concurrentes de l'écran. Aucun changement de rendu (ni
 * attribut disabled, ni select contrôlé) ; seuls les cas de concurrence changent.
 * - Les imputations d'encaissement (manuelles ou de la boucle d'import) et les étapes de recouvrement lisent le solde
 *   ou le dossier dans l'état puis écrivent une valeur absolue : lancées ensemble, la dernière écrasait l'autre
 *   (encaissement absent du solde alors que sa contrepartie 450 existe). Elles passent désormais par une file unique,
 *   chacune démarrant à la fin de la précédente (sans écriture en cours, démarrage immédiat, comme avant).
 * - Une imputation dont l'encaissement a été imputé entre-temps (select changé deux fois de suite, ou ligne imputée à
 *   la main pendant que la boucle d'import allait l'imputer) n'écrit rien : plus de double contrepartie 450.
 * - Étape de recouvrement : un clic pendant l'enregistrement de l'étape du même copropriétaire est ignoré (il créait
 *   un second dossier d'impayé), et le second clic d'un double clic aussi (le bouton, déjà passé à l'étape suivante,
 *   enregistrait l'exigibilité anticipée le jour même de la mise en demeure).
 * La file et les verrous sont au niveau du module : la boucle d'import continue si l'écran est quitté puis rouvert.
 */
let derniereEcritureTresorerie: Promise<unknown> = Promise.resolve()

/** Exécute l'écriture à la suite des précédentes (qu'elles aient réussi ou échoué). */
function enFileEcrituresTresorerie<T>(executer: () => Promise<T>): Promise<T> {
  const execution = derniereEcritureTresorerie.then(executer)
  derniereEcritureTresorerie = execution.catch(() => {
    // L'échec est remonté à l'appelant par `execution` ; la file passe à l'écriture suivante.
  })
  return execution
}

/** Copropriétaires dont une étape de recouvrement est en cours d'enregistrement. */
const recouvrementsEnCours = new Set<string>()

/** Vrai si une contrepartie 450-* du journal cite déjà cette écriture 512 (« … relevé <id> »), dans l'état à jour. */
const encaissementDejaImpute = (ecritureId: string): boolean =>
  useDonneesStore
    .getState()
    .ecritures.some(
      (ecriture) =>
        ecriture.compte.startsWith('450-') && (ecriture.libelle.match(/relevé (\S+)$/) || [])[1] === ecritureId,
    )

/**
 * Banque et recouvrement (données réelles de la base locale) : import d'un relevé CSV avec dédoublonnage et
 * rapprochement des encaissements, lettrage des lignes 512 et dossiers de recouvrement de l'art. 19-2.
 */
export function TresorerieModule() {
  const { push } = useToast()
  const { code, choisirCopro, choisirPersonne } = useSelectionDossier()
  const [codeLocal, setCodeLocal] = useState(() => codeCoproSelectionne('CV'))
  const codeCopro = codeLocal || code
  const donnees = useDonneesLocales()
  const [texteReleve, setTexteReleve] = useState('')
  const [analyse, setAnalyse] = useState<AnalyseReleve | null>(null)
  const [selections, setSelections] = useState<SelectionsImputation>({})
  const [importEnCours, setImportEnCours] = useState(false)

  const copro = donnees.copros.find((candidate) => candidate.code === codeCopro)
  const personnes = copro ? listerCoproprietairesCopropriete(copro, donnees.lots, donnees.coproprietaires) : []
  const journal = copro ? donnees.journaux.find((candidat) => candidat.coproprieteId === copro.id) : null
  const ecrituresJournal = journal ? donnees.ecritures.filter((ecriture) => ecriture.journalId === journal.id) : []
  const lignesBanque = ecrituresJournal
    .filter((ecriture) => ecriture.compte === '512')
    .sort((a, b) => b.date.getTime() - a.date.getTime())
  // Ids des écritures 512 déjà imputées, relevés à la fin du libellé des contreparties 450-* (« … relevé <id> »).
  const idsImputes = new Set(
    ecrituresJournal
      .filter((ecriture) => ecriture.compte.startsWith('450-'))
      .map((ecriture) => (ecriture.libelle.match(/relevé (\S+)$/) || [])[1]),
  )
  const lignesExistantes: LigneReleve[] = lignesBanque.map((ecriture) => ({
    date: dateVersIso(ecriture.date) || '',
    libelle: ecriture.libelle,
    montant: montantSigne(ecriture),
  }))
  const debiteurs = personnes.filter((personne) => personne.solde < 0).sort((a, b) => a.solde - b.solde)
  const dossiersOuverts = new Map(
    donnees.impayes
      .filter((impaye) => !impaye.statut.startsWith('solde'))
      .map((impaye) => [impaye.coproprietaireId, impaye] as const),
  )
  const totalEncaissements = lignesBanque
    .filter((ecriture) => ecriture.sens === 'debit')
    .reduce((total, ecriture) => total + ecriture.montant, 0)
  const totalDecaissements = lignesBanque
    .filter((ecriture) => ecriture.sens === 'credit')
    .reduce((total, ecriture) => total + ecriture.montant, 0)

  const analyser = () => {
    const lecture = parserReleveBancaire(texteReleve),
      { retenues, doublons } = dedoublonnerReleve(lecture.lignes, lignesExistantes),
      rapprochements = proposerImputations(
        retenues,
        personnes.map((personne) => ({
          id: personne.id,
          nom: personne.nom,
          solde: personne.solde,
        })),
      )
    setAnalyse({
      ...lecture,
      retenues,
      doublons,
      rapprochements,
    })
    setSelections(
      Object.fromEntries(
        rapprochements.map((rapprochement, index): [number, string] => [
          index,
          rapprochement.candidat ? rapprochement.candidat.id : '',
        ]),
      ),
    )
  }

  const choisirFichier = (evenement: ChangeEvent<HTMLInputElement>) => {
    const fichier = evenement.target.files && evenement.target.files[0]
    if (!fichier) return
    const lecteur = new FileReader()
    lecteur.onload = () => {
      setTexteReleve(String(lecteur.result || ''))
      setAnalyse(null)
    }
    lecteur.readAsText(fichier, 'utf-8')
  }

  /**
   * Impute l'encaissement à son tour dans la file des écritures de l'écran. Renvoie false, sans rien écrire, si
   * l'encaissement a été imputé entre-temps.
   */
  const imputerEnFile = (ecritureId: string, coproprietaireId: string): Promise<boolean> =>
    enFileEcrituresTresorerie(async () => {
      if (encaissementDejaImpute(ecritureId)) return false
      await donnees.imputerEncaissement(ecritureId, coproprietaireId, AUJOURDHUI_ISO)
      return true
    })

  const importer = async () => {
    if (!copro || !analyse) return
    setImportEnCours(true)
    try {
      const ecrituresCreees = await donnees.importerReleve(copro.id, analyse.retenues)
      let imputes = 0
      for (let index = 0; index < ecrituresCreees.length; index++) {
        const coproprietaireId = selections[index]
        if (coproprietaireId && ecrituresCreees[index].sens === 'debit') {
          // Ligne déjà imputée à la main pendant la boucle : ni seconde imputation, ni décompte.
          if (await imputerEnFile(ecrituresCreees[index].id, coproprietaireId)) imputes++
        }
      }
      push({
        kind: 'success',
        title: 'Relevé importé',
        desc: `${ecrituresCreees.length} ligne${ecrituresCreees.length > 1 ? 's' : ''} enregistrée${ecrituresCreees.length > 1 ? 's' : ''}, ${imputes} encaissement${imputes > 1 ? 's' : ''} imputé${imputes > 1 ? 's' : ''}${analyse.doublons.length ? `, ${analyse.doublons.length} doublon${analyse.doublons.length > 1 ? 's' : ''} écarté${analyse.doublons.length > 1 ? 's' : ''}` : ''}.`,
      })
      setTexteReleve('')
      setAnalyse(null)
      setSelections({})
    } catch (erreur) {
      push({
        kind: 'warn',
        title: 'Import impossible',
        desc: erreur instanceof Error ? erreur.message : String(erreur),
      })
    } finally {
      setImportEnCours(false)
    }
  }

  const imputer = async (ecritureId: string, coproprietaireId: string) => {
    if (coproprietaireId)
      try {
        // Encaissement imputé entre-temps (changement précédent du même select, boucle d'import) : rien à signaler.
        if (!(await imputerEnFile(ecritureId, coproprietaireId))) return
        push({
          kind: 'success',
          title: 'Encaissement imputé',
          desc: 'Solde du copropriétaire mis à jour.',
        })
      } catch (erreur) {
        push({
          kind: 'warn',
          title: 'Imputation impossible',
          desc: erreur instanceof Error ? erreur.message : String(erreur),
        })
      }
  }

  const avancer = async (coproprietaireId: string, etape: EtapeRecouvrement) => {
    // Étape du même copropriétaire en cours d'enregistrement : clic ignoré.
    if (recouvrementsEnCours.has(coproprietaireId)) return
    recouvrementsEnCours.add(coproprietaireId)
    try {
      await enFileEcrituresTresorerie(() => donnees.avancerRecouvrement(coproprietaireId, etape, AUJOURDHUI_ISO))
      push({
        kind: 'success',
        title: 'Dossier de recouvrement',
        desc: `Étape « ${libelleEtapeRecouvrement(etape)} » enregistrée au ${dateIsoVersFr(AUJOURDHUI_ISO)}.`,
      })
    } catch (erreur) {
      push({
        kind: 'warn',
        title: 'Mise à jour impossible',
        desc: erreur instanceof Error ? erreur.message : String(erreur),
      })
    } finally {
      recouvrementsEnCours.delete(coproprietaireId)
    }
  }

  const ouvrirFichePersonne = (coproprietaireId: string) => {
    choisirPersonne(coproprietaireId)
    naviguerVers('personne360')
  }

  return (
    <>
      <PageHead
        eyebrow="Comptabilité & finances · chantier 1"
        title="Banque et recouvrement"
        lede="Import du relevé, rapprochement des encaissements avec les copropriétaires, dossiers de recouvrement de l'art. 19-2. Données persistées dans la base locale."
        actions={
          <SelecteurCopropriete
            // Toujours une chaîne non vide : codeLocal part de codeCoproSelectionne('CV') et ne reçoit que des codes.
            value={codeCopro as string}
            onChange={(codeChoisi) => {
              setCodeLocal(codeChoisi)
              choisirCopro(codeChoisi)
              setAnalyse(null)
            }}
          />
        }
      />
      {donnees.erreur && (
        <Alert kind="warn" icon="alert" title="Base locale indisponible">
          {MESSAGES_ETAT_ECHEANCES.indisponible}
        </Alert>
      )}
      <Kpis
        items={[
          {
            icon: 'bank',
            num: lignesBanque.length,
            lbl: 'Lignes de relevé enregistrées',
            sub: journal ? 'journal ouvert' : 'aucun relevé importé',
          },
          {
            icon: 'coin',
            num: formatEurosCentimes(totalEncaissements),
            lbl: 'Encaissements',
            sub: `${formatEurosCentimes(totalDecaissements)} de décaissements`,
            accent: 'sage',
          },
          {
            icon: 'users',
            num: debiteurs.length,
            lbl: 'Copropriétaires débiteurs',
            sub: debiteurs.length
              ? `${formatEurosCentimes(-debiteurs.reduce((total, personne) => total + personne.solde, 0))} dus`
              : 'aucun',
            accent: debiteurs.length ? 'rust' : 'sage',
          },
          {
            icon: 'scale',
            num: debiteurs.filter((personne) => dossiersOuverts.has(personne.id)).length,
            lbl: 'Dossiers de recouvrement ouverts',
            sub: 'art. 19-2',
            accent: 'amber',
          },
        ]}
      />
      <Panel
        title="Importer un relevé"
        sub="CSV exporté de la banque : date, libellé, montant (ou débit et crédit). Coller le texte ou choisir un fichier."
        icon="upload"
      >
        <div
          style={{
            display: 'flex',
            gap: 10,
            flexWrap: 'wrap',
            alignItems: 'center',
            marginBottom: 10,
          }}
        >
          <input type="file" accept=".csv,.txt,text/csv" aria-label="Fichier de relevé" onChange={choisirFichier} />
          <button
            className="btn"
            onClick={() => {
              setTexteReleve(EXEMPLE_RELEVE_BANCAIRE_CSV)
              setAnalyse(null)
            }}
          >
            Exemple
          </button>
          <button className="btn gold" onClick={analyser} disabled={!texteReleve.trim() || !copro}>
            <Icon name="search" />
            Analyser
          </button>
        </div>
        <textarea
          aria-label="Relevé bancaire"
          value={texteReleve}
          onChange={(evenement) => {
            setTexteReleve(evenement.target.value)
            setAnalyse(null)
          }}
          rows={5}
          style={{
            width: '100%',
            fontFamily: 'JetBrains Mono, monospace',
            fontSize: 12,
          }}
          placeholder={EXEMPLE_RELEVE_BANCAIRE_CSV}
        />
        {analyse && (
          <div
            style={{
              marginTop: 12,
            }}
          >
            {analyse.erreurs.length > 0 && (
              <Alert
                kind="warn"
                icon="alert"
                title={`${analyse.erreurs.length} ligne${analyse.erreurs.length > 1 ? 's' : ''} non lue${analyse.erreurs.length > 1 ? 's' : ''}`}
              >
                {analyse.erreurs.slice(0, 5).join(' · ')}
              </Alert>
            )}
            {analyse.doublons.length > 0 && (
              <Alert
                kind="info"
                icon="history"
                title={`${analyse.doublons.length} doublon${analyse.doublons.length > 1 ? 's' : ''} déjà importé${analyse.doublons.length > 1 ? 's' : ''}, écarté${analyse.doublons.length > 1 ? 's' : ''}`}
              >
                {analyse.doublons.map((ligne) => `${dateIsoVersFr(ligne.date)} ${ligne.libelle}`).join(' · ')}
              </Alert>
            )}
            {analyse.retenues.length > 0 && (
              <DataTable
                rowKey="i"
                columns={[
                  {
                    h: 'Date',
                    render: (rapprochement) => <span className="mono">{dateIsoVersFr(rapprochement.ligne.date)}</span>,
                  },
                  {
                    h: 'Libellé',
                    render: (rapprochement) => rapprochement.ligne.libelle,
                  },
                  {
                    h: 'Montant',
                    render: (rapprochement) => (
                      <span
                        className="mono"
                        style={{
                          color: rapprochement.ligne.montant < 0 ? 'var(--rust-500)' : 'var(--sage-600, inherit)',
                        }}
                      >
                        {formatEurosCentimes(rapprochement.ligne.montant)}
                      </span>
                    ),
                  },
                  {
                    h: 'Copropriétaire',
                    render: (rapprochement) =>
                      rapprochement.ligne.montant > 0 ? (
                        <select
                          aria-label={`Copropriétaire ligne ${rapprochement.i + 1}`}
                          value={selections[rapprochement.i] || ''}
                          onChange={(evenement) =>
                            setSelections((precedentes) => ({
                              ...precedentes,
                              [rapprochement.i]: evenement.target.value,
                            }))
                          }
                        >
                          <option value="">Ne pas imputer</option>
                          {personnes.map((personne) => (
                            <option value={personne.id} key={personne.id}>
                              {personne.nom}
                              {' · '}
                              {personne.lot}
                              {' · '}
                              {formatEurosCentimes(personne.solde)}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <span
                          style={{
                            color: 'var(--navy-300)',
                            fontSize: 12,
                          }}
                        >
                          débit
                        </span>
                      ),
                  },
                  {
                    h: 'Rapprochement',
                    render: (rapprochement) =>
                      rapprochement.confiance ? (
                        <>
                          <Pill kind={PILL_CONFIANCE_RAPPROCHEMENT[rapprochement.confiance].kind} noDot>
                            {PILL_CONFIANCE_RAPPROCHEMENT[rapprochement.confiance].label}
                          </Pill>{' '}
                          <span
                            style={{
                              fontSize: 11,
                              color: 'var(--navy-300)',
                            }}
                          >
                            {rapprochement.motif}
                          </span>
                        </>
                      ) : (
                        <span
                          style={{
                            fontSize: 11,
                            color: 'var(--navy-300)',
                          }}
                        >
                          {rapprochement.motif}
                        </span>
                      ),
                  },
                ]}
                rows={analyse.rapprochements.map((rapprochement, index) => ({
                  ...rapprochement,
                  i: index,
                }))}
              />
            )}
            <div
              style={{
                marginTop: 10,
                display: 'flex',
                gap: 10,
                alignItems: 'center',
              }}
            >
              <button className="btn gold" onClick={importer} disabled={importEnCours || analyse.retenues.length === 0}>
                <Icon name="check" />
                {'Importer '}
                {analyse.retenues.length}
                {' ligne'}
                {analyse.retenues.length > 1 ? 's' : ''}
              </button>
              <span
                style={{
                  fontSize: 12,
                  color: 'var(--navy-500)',
                }}
              >
                Les encaissements rapprochés mettent le solde du copropriétaire à jour et écrivent la contrepartie 450.
              </span>
            </div>
          </div>
        )}
      </Panel>
      <Panel
        title={`Lignes de relevé (${lignesBanque.length})`}
        sub="Journal en partie double : encaissement D 512 / C 450 du copropriétaire ; décaissement C 512 / D 471 compte d'attente, à ventiler sur un compte de charge avec le plan comptable (étape 1) ; un encaissement non imputé peut l'être ici"
        icon="bank"
        flush
      >
        {lignesBanque.length === 0 ? (
          <div
            style={{
              padding: '18px 22px',
              color: 'var(--navy-300)',
              fontSize: 13,
            }}
          >
            Aucune ligne importée pour cette copropriété.
          </div>
        ) : (
          <DataTable
            rowKey="id"
            columns={[
              {
                h: 'Date',
                // Date Dexie valide : dateVersIso ne renvoie pas null (dateIsoVersFr lèverait, comme la maquette).
                render: (ecriture) => <span className="mono">{dateIsoVersFr(dateVersIso(ecriture.date) as string)}</span>,
              },
              {
                h: 'Libellé',
                render: (ecriture) => ecriture.libelle,
              },
              {
                h: 'Montant',
                render: (ecriture) => (
                  <span
                    className="mono"
                    style={{
                      color: ecriture.sens === 'credit' ? 'var(--rust-500)' : 'inherit',
                    }}
                  >
                    {formatEurosCentimes(montantSigne(ecriture))}
                  </span>
                ),
              },
              {
                h: 'Sens',
                render: (ecriture) => (
                  <span
                    style={{
                      fontSize: 11,
                      color: 'var(--navy-300)',
                    }}
                  >
                    {ecriture.sens === 'debit' ? 'D 512' : 'C 512'}
                  </span>
                ),
              },
              {
                h: 'Lettrage',
                render: (ecriture) =>
                  ecriture.sens === 'credit' ? (
                    <Pill kind="navy" noDot>
                      Décaissement · D 471 à ventiler
                    </Pill>
                  ) : idsImputes.has(ecriture.id) ? (
                    <Pill kind="sage" noDot>
                      Imputé · C 450
                    </Pill>
                  ) : (
                    <select
                      aria-label={`Imputer ${ecriture.libelle}`}
                      defaultValue=""
                      onChange={(evenement) => imputer(ecriture.id, evenement.target.value)}
                    >
                      <option value="">Imputer à…</option>
                      {personnes.map((personne) => (
                        <option value={personne.id} key={personne.id}>
                          {personne.nom}
                          {' · '}
                          {personne.lot}
                        </option>
                      ))}
                    </select>
                  ),
              },
            ]}
            rows={lignesBanque}
          />
        )}
      </Panel>
      <Panel
        title={`Recouvrement (${debiteurs.length} débiteur${debiteurs.length > 1 ? 's' : ''})`}
        sub="Étapes de l'art. 19-2 avec leurs délais · la mise en demeure se génère depuis le cockpit"
        icon="scale"
        flush
      >
        {debiteurs.length === 0 ? (
          <div
            style={{
              padding: '18px 22px',
              color: 'var(--navy-300)',
              fontSize: 13,
            }}
          >
            Aucun copropriétaire débiteur.
          </div>
        ) : (
          debiteurs.map((personne) => {
            const dossier: Impaye | undefined = dossiersOuverts.get(personne.id),
              // createdAt est une chaîne ISO : dateVersIso renvoie null (voir le rapport de portage).
              etat = analyserRecouvrement(
                dossier ? dossier.statut : null,
                AUJOURDHUI_ISO,
                dossier ? dateVersIso(dossier.createdAt) : null,
              ),
              prochaine = etat.prochaine
            return (
              <div
                style={{
                  display: 'flex',
                  gap: 14,
                  padding: '13px 22px',
                  borderBottom: '1px solid var(--line)',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                }}
                key={personne.id}
              >
                <div
                  style={{
                    flex: 1,
                    minWidth: 220,
                  }}
                >
                  <button
                    className="btn"
                    style={{
                      padding: 0,
                      border: 'none',
                      background: 'transparent',
                      fontWeight: 600,
                      fontSize: 13,
                      cursor: 'pointer',
                    }}
                    onClick={() => ouvrirFichePersonne(personne.id)}
                  >
                    {personne.nom}
                  </button>
                  <div
                    style={{
                      fontSize: 11,
                      color: 'var(--navy-300)',
                    }}
                  >
                    {personne.lot}
                    {' · '}
                    {personne.tantiemes}
                    {' · '}
                    <span
                      style={{
                        color: 'var(--rust-500)',
                      }}
                    >
                      {formatEurosCentimes(personne.solde)}
                    </span>
                  </div>
                </div>
                <div
                  style={{
                    minWidth: 260,
                    fontSize: 12,
                  }}
                >
                  <Pill kind={dossier ? 'amber' : 'navy'} noDot>
                    {dossier ? etat.libelle : 'Aucun dossier'}
                  </Pill>
                  {dossier && (
                    <span
                      style={{
                        marginLeft: 8,
                        color: 'var(--navy-500)',
                      }}
                    >
                      {etat.base}
                      {etat.depuis ? ` · depuis le ${dateIsoVersFr(etat.depuis)}` : ''}
                    </span>
                  )}
                  {etat.exigibiliteLe && (
                    <div
                      style={{
                        // joursAvantExigibilite est un nombre dès que exigibiliteLe est renseignée.
                        color: (etat.joursAvantExigibilite as number) <= 0 ? 'var(--rust-500)' : 'var(--navy-500)',
                        marginTop: 2,
                      }}
                    >
                      {'Exigibilité anticipée '}
                      {(etat.joursAvantExigibilite as number) <= 0
                        ? `acquise depuis le ${dateIsoVersFr(etat.exigibiliteLe)}`
                        : `le ${dateIsoVersFr(etat.exigibiliteLe)} (J-${etat.joursAvantExigibilite})`}
                    </div>
                  )}
                  {etat.prescriptionLe && (
                    <div
                      style={{
                        color: 'var(--navy-300)',
                        marginTop: 2,
                      }}
                    >
                      {'Prescription quinquennale : '}
                      {dateIsoVersFr(etat.prescriptionLe)}
                    </div>
                  )}
                </div>
                <div>
                  {prochaine && (
                    <button
                      className="btn"
                      onClick={(evenement) => {
                        // Second clic d'un double clic (detail 2 ou plus) ignoré ; clic simple (1) ou clavier (0) inchangés.
                        if (evenement.detail < 2) avancer(personne.id, prochaine)
                      }}
                    >
                      <Icon name="arrow" />
                      {libelleEtapeRecouvrement(prochaine)}
                    </button>
                  )}
                </div>
              </div>
            )
          })
        )}
      </Panel>
    </>
  )
}
