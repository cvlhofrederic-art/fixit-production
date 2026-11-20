'use client'

import type { EtatComptes } from '@/components/administrateur-judiciaire/modules/finances/tresorerie/ChoixCompteBancaire'
import { nomDuCompte } from '@/components/administrateur-judiciaire/modules/finances/tresorerie/CompteBancaireModal'
import { ComptesBancairesPanel } from '@/components/administrateur-judiciaire/modules/finances/tresorerie/ComptesBancairesPanel'
import { comptesLisibles, type CompteAffiche } from '@/components/administrateur-judiciaire/modules/finances/tresorerie/comptes-bancaires-vue'
import { enFileEcrituresTresorerie, imputerEnFile } from '@/components/administrateur-judiciaire/modules/finances/tresorerie/file-ecritures'
import { ImportRelevePanel } from '@/components/administrateur-judiciaire/modules/finances/tresorerie/ImportRelevePanel'
import { RapprochementPanel } from '@/components/administrateur-judiciaire/modules/finances/tresorerie/RapprochementPanel'
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
import { useDonneesLocales } from '@/lib/administrateur-judiciaire/db/hooks'
import type { Ecriture, Impaye } from '@/lib/administrateur-judiciaire/db/schema'
import { banqueDuCompte, estCompteBanque } from '@/lib/administrateur-judiciaire/db/sous-comptes-banque'
import { useComptesBancaires } from '@/lib/administrateur-judiciaire/db/use-comptes-bancaires'
import { dateIsoVersFr, dateVersIso } from '@/lib/administrateur-judiciaire/domain/dates'
import { MESSAGES_ETAT_ECHEANCES } from '@/lib/administrateur-judiciaire/domain/echeances-mandat'
import { listerCoproprietairesCopropriete } from '@/lib/administrateur-judiciaire/domain/fiche-360'
import { formatEurosCentimes } from '@/lib/administrateur-judiciaire/domain/format'
import {
  analyserRecouvrement,
  ETAPES_RECOUVREMENT,
  type DefinitionEtapeRecouvrement,
  type EtapeRecouvrement,
} from '@/lib/administrateur-judiciaire/domain/recouvrement'
import { AUJOURDHUI_ISO } from '@/lib/administrateur-judiciaire/mode'
import { useCodeCoproCourant, useSelectionDossier } from '@/lib/administrateur-judiciaire/selection'

/** Libellé d'une étape de recouvrement (toujours trouvée : l'étape vient de analyserRecouvrement). */
const libelleEtapeRecouvrement = (etape: EtapeRecouvrement): string =>
  (ETAPES_RECOUVREMENT.find((definition) => definition.etape === etape) as DefinitionEtapeRecouvrement).libelle

/** Montant signé d'une écriture de banque : débit (encaissement) positif, crédit (décaissement) négatif. */
const montantSigne = (ecriture: Ecriture): number => (ecriture.sens === 'debit' ? ecriture.montant : -ecriture.montant)

/**
 * Compte bancaire d'une ligne de relevé : nom du compte de son sous-compte 512, « Non rattaché » pour une ligne importée
 * avant le choix du compte (« 512 » seul).
 */
function compteDeLaLigne(ecriture: Ecriture, comptes: readonly CompteAffiche[]): string {
  const banqueId = banqueDuCompte(ecriture.compte)
  if (banqueId === null) return 'Non rattaché'
  const compte = comptes.find((candidat) => candidat.id === banqueId)
  return compte ? nomDuCompte(compte) : 'Compte inconnu'
}

/*
 * Étape de recouvrement : un clic pendant l'enregistrement de l'étape du même copropriétaire est ignoré (il créait un
 * second dossier d'impayé), et le second clic d'un double clic aussi (le bouton, déjà passé à l'étape suivante,
 * enregistrait l'exigibilité anticipée le jour même de la mise en demeure). Les étapes passent par la file des écritures
 * de l'écran (tresorerie/file-ecritures.ts), comme les imputations.
 */
/** Copropriétaires dont une étape de recouvrement est en cours d'enregistrement. */
const recouvrementsEnCours = new Set<string>()

/** État de lecture des comptes bancaires, pour l'import du relevé. */
const etatLectureComptes = (lus: { chargement: boolean; erreur: string | null }): EtatComptes => {
  if (lus.chargement) return 'chargement'
  return lus.erreur ? 'erreur' : 'lu'
}

/**
 * Banque et recouvrement (données réelles de la base locale) : comptes bancaires du mandat, arrêtés de rapprochement,
 * import d'un relevé sur le compte bancaire choisi (CSV, CFONB 120, camt.053 ; dédoublonnage, imputation des
 * encaissements aux copropriétaires), lettrage des lignes de banque et dossiers de recouvrement de l'art. 19-2. Les
 * comptes bancaires sont lus ici et partagés par les panneaux.
 */
export function TresorerieModule() {
  const { push } = useToast()
  const { choisirCopro, choisirPersonne } = useSelectionDossier()
  const codeCopro = useCodeCoproCourant('CV')
  const donnees = useDonneesLocales()

  const copro = donnees.copros.find((candidate) => candidate.code === codeCopro)
  const lus = useComptesBancaires(copro?.id ?? null, (message) =>
    push({ kind: 'warn', title: 'Comptes bancaires illisibles', desc: message }),
  )
  const personnes = copro ? listerCoproprietairesCopropriete(copro, donnees.lots, donnees.coproprietaires) : []
  const journal = copro ? donnees.journaux.find((candidat) => candidat.coproprieteId === copro.id) : null
  const ecrituresJournal = journal ? donnees.ecritures.filter((ecriture) => ecriture.journalId === journal.id) : []
  const lignesBanque = ecrituresJournal
    .filter((ecriture) => estCompteBanque(ecriture.compte))
    .sort((a, b) => b.date.getTime() - a.date.getTime())
  const comptes = comptesLisibles(lus.comptes, lignesBanque)
  const etatComptes = etatLectureComptes(lus)
  // Ids des écritures de banque déjà imputées, relevés à la fin du libellé des contreparties 450-* (« … relevé <id> »).
  const idsImputes = new Set(
    ecrituresJournal
      .filter((ecriture) => ecriture.compte.startsWith('450-'))
      .map((ecriture) => (ecriture.libelle.match(/relevé (\S+)$/) || [])[1]),
  )
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
          <SelecteurCopropriete value={codeCopro} onChange={choisirCopro} />
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
      <ComptesBancairesPanel copro={copro} lus={lus} ecrituresBanque={lignesBanque} />
      <RapprochementPanel comptes={comptes} etatComptes={etatComptes} ecrituresBanque={lignesBanque} />
      <ImportRelevePanel
        copro={copro}
        comptes={comptes}
        etatComptes={etatComptes}
        personnes={personnes}
        lignesBanque={lignesBanque}
      />
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
                h: 'Compte',
                render: (ecriture) => compteDeLaLigne(ecriture, comptes),
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
        sub="Étapes de l'art. 19-2 avec leurs délais · la mise en demeure se génère depuis le Tableau de bord (Génération express d'actes)"
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
                        // Promesse non attendue : avancer signale lui-même l'échec (toast « Mise à jour impossible »).
                        if (evenement.detail < 2) void avancer(personne.id, prochaine)
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
