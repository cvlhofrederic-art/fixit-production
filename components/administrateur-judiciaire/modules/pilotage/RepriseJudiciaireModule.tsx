'use client'

import { useRef, useState, type ChangeEvent } from 'react'
import { EXEMPLE_LISTE_COPROPRIETAIRES_CSV } from '@/components/administrateur-judiciaire/data/exemples-import'
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
import { dateIsoVersFr } from '@/lib/administrateur-judiciaire/domain/dates'
import {
  calculerEcheancesCopropriete,
  MESSAGES_ETAT_ECHEANCES,
} from '@/lib/administrateur-judiciaire/domain/echeances-mandat'
import { listerCoproprietairesCopropriete } from '@/lib/administrateur-judiciaire/domain/fiche-360'
import { formatEuros } from '@/lib/administrateur-judiciaire/domain/format'
import {
  controlerListeCoproprietaires,
  parserListeCoproprietaires,
  type ControleListeCoproprietaires,
  type LigneListeCoproprietaires,
  type ResultatListeCoproprietaires,
} from '@/lib/administrateur-judiciaire/domain/import/liste-coproprietaires'
import {
  PIECES_REPRISE,
  piecesRepriseRecues,
  REGLE_MOTEUR_PAR_DELAI_PIECE,
  type PieceReprise,
} from '@/lib/administrateur-judiciaire/domain/reprise'
import { AUJOURDHUI_ISO } from '@/lib/administrateur-judiciaire/mode'
import { codeCoproSelectionne, useSelectionDossier } from '@/lib/administrateur-judiciaire/selection'

/** Liste de copropriétaires analysée : lecture du CSV et contrôles de cohérence (tantièmes, débiteurs, doublons). */
export interface AnalyseListeCoproprietaires extends ResultatListeCoproprietaires {
  controle: ControleListeCoproprietaires
}

/** Ligne de l'aperçu avant import, numérotée (i = rang dans la liste, clé React du tableau). */
export type LigneApercuListe = LigneListeCoproprietaires & {
  i: number
}

/** Délai affiché sous une pièce : « sans délai légal », délai d'apurement ou « sous <délai> ». */
const libelleDelaiPiece = (delai: string): string =>
  delai === 'pratique'
    ? 'sans délai légal'
    : delai === 'apurement'
      ? "deux mois après le délai d'un mois"
      : `sous ${delai}`

/**
 * Reprise judiciaire (données réelles de la base locale) : import de la liste des copropriétaires de l'ancien
 * logiciel avec contrôle des tantièmes et des soldes, et suivi des pièces à obtenir de l'ancien syndic avec les
 * délais de l'art. 18-2 calculés par le moteur.
 */
export function RepriseJudiciaireModule() {
  const { push } = useToast()
  const { code, choisirCopro } = useSelectionDossier()
  const [codeLocal, setCodeLocal] = useState(() => codeCoproSelectionne('VM'))
  const codeCopro = codeLocal || code
  const donnees = useDonneesLocales()
  const [texteListe, setTexteListe] = useState('')
  const [analyse, setAnalyse] = useState<AnalyseListeCoproprietaires | null>(null)
  // Correctifs de défauts hérités de la maquette (écritures concurrentes). Des références, et non des états : le rendu
  // ne change pas (bouton « Importer » toujours actif, sans attribut disabled, pièces toujours cliquables).
  // - Import en cours : un second clic sur « Importer N copropriétaires » pendant l'import est ignoré ; il relançait
  //   l'import de la même liste (lots et copropriétaires en double, ou second toast « 0 copropriétaire créé »).
  const importEnCoursRef = useRef(false)
  // - File des bascules de pièces : chaque clic est traité après la fin du précédent et relit donc l'état à jour.
  //   Deux clics rapprochés lisaient le même état et écrivaient deux documents « reçue » (deux clics pour la retirer).
  const fileBasculesPiecesRef = useRef<Promise<void>>(Promise.resolve())

  const copro = donnees.copros.find((candidate) => candidate.code === codeCopro)
  const personnes = copro ? listerCoproprietairesCopropriete(copro, donnees.lots, donnees.coproprietaires) : []
  const echeancesMandat = copro ? calculerEcheancesCopropriete(copro) : null
  /** Date limite (« JJ/MM/AAAA ») d'une règle du moteur, ou null si elle n'est pas calculée. */
  const dateLimiteRegle = (regleId: string): string | null => {
    const echeance = echeancesMandat && echeancesMandat.echeances.find((candidate) => candidate.regleId === regleId)
    return echeance && echeance.dateRetenue ? dateIsoVersFr(echeance.dateRetenue) : null
  }
  const piecesRecues = copro ? piecesRepriseRecues(donnees.documents, copro.id) : new Set<string>()
  const sommeQuotesParts = personnes.reduce((total, personne) => total + (personne.quotePart || 0), 0)
  const sommeSoldes = personnes.reduce((total, personne) => total + personne.solde, 0)
  // Écart, arrondi au centime, entre le total débiteur de la liste et les impayés déclarés au mandat.
  const ecartImpayes = copro
    ? Math.round(
        (-personnes
          .filter((personne) => personne.solde < 0)
          .reduce((total, personne) => total + personne.solde, 0) -
          copro.impayes) *
          100,
      ) / 100
    : 0

  const analyser = () => {
    const lecture = parserListeCoproprietaires(texteListe)
    setAnalyse({
      ...lecture,
      controle: controlerListeCoproprietaires(lecture.lignes),
    })
  }

  const choisirFichier = (evenement: ChangeEvent<HTMLInputElement>) => {
    const fichier = evenement.target.files && evenement.target.files[0]
    if (!fichier) return
    const lecteur = new FileReader()
    lecteur.onload = () => {
      setTexteListe(String(lecteur.result || ''))
      setAnalyse(null)
    }
    lecteur.readAsText(fichier, 'utf-8')
  }

  // Pas d'indicateur « import en cours » : le bouton reste actif pendant l'import (comme la maquette), mais un clic
  // pendant l'import en cours est ignoré (verrou importEnCoursRef).
  const importer = async () => {
    if (!copro || !analyse) return
    if (importEnCoursRef.current) return
    importEnCoursRef.current = true
    try {
      const resultat = await donnees.importerCoproprietaires(copro.id, analyse.lignes)
      push({
        kind: 'success',
        title: 'Liste importée',
        desc: `${resultat.crees} copropriétaire${resultat.crees > 1 ? 's' : ''} créé${resultat.crees > 1 ? 's' : ''}, ${resultat.misAJour} mis à jour.`,
      })
      setTexteListe('')
      setAnalyse(null)
    } catch (erreur) {
      push({
        kind: 'warn',
        title: 'Import impossible',
        desc: erreur instanceof Error ? erreur.message : String(erreur),
      })
    } finally {
      importEnCoursRef.current = false
    }
  }

  /** Bascule reçue / retirée d'une pièce, mise en file derrière les bascules précédentes (voir fileBasculesPiecesRef). */
  const basculerPiece = (piece: PieceReprise): Promise<void> | undefined => {
    if (!copro) return undefined
    const coproprieteId = copro.id
    const bascule = fileBasculesPiecesRef.current.then(async () => {
      try {
        await donnees.basculerPieceReprise(coproprieteId, piece.cle, piece.libelle, AUJOURDHUI_ISO)
      } catch (erreur) {
        push({
          kind: 'warn',
          title: 'Enregistrement impossible',
          desc: erreur instanceof Error ? erreur.message : String(erreur),
        })
      }
    })
    fileBasculesPiecesRef.current = bascule
    return bascule
  }

  return (
    <>
      <PageHead
        eyebrow="Pilotage judiciaire · chantier 2"
        title="Reprise judiciaire"
        lede="Importer la liste des copropriétaires de l'ancien logiciel, contrôler tantièmes et soldes, suivre les pièces à obtenir de l'ancien syndic avec les délais de l'art. 18-2."
        actions={
          <SelecteurCopropriete
            // Toujours une chaîne non vide : codeLocal part de codeCoproSelectionne('VM') et ne reçoit que des codes.
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
            icon: 'users',
            num: personnes.length,
            lbl: 'Copropriétaires enregistrés',
            sub: copro ? `${copro.lots} lots déclarés au mandat` : '·',
          },
          {
            icon: 'home',
            num: `${Math.round(sommeQuotesParts * 1e4)}/10000`,
            lbl: 'Tantièmes enregistrés',
            sub:
              Math.abs(sommeQuotesParts - 1) < 5e-4 || personnes.length === 0
                ? 'complet'
                : 'écart avec 10 000 : liste incomplète ou en double',
            accent: personnes.length && Math.abs(sommeQuotesParts - 1) >= 5e-4 ? 'amber' : 'sage',
          },
          {
            icon: 'coin',
            num: formatEuros(sommeSoldes),
            lbl: 'Somme des soldes',
            sub: copro
              ? Math.abs(ecartImpayes) < 1
                ? 'cohérente avec les impayés du mandat'
                : `écart de ${formatEuros(ecartImpayes)} avec les impayés déclarés au mandat`
              : '·',
            accent: copro && Math.abs(ecartImpayes) >= 1 ? 'amber' : 'sage',
          },
          {
            icon: 'clipboard',
            num: `${piecesRecues.size}/${PIECES_REPRISE.length}`,
            lbl: 'Pièces reçues',
            sub: 'ancien syndic',
            accent: piecesRecues.size === PIECES_REPRISE.length ? 'sage' : 'amber',
          },
        ]}
      />
      <Panel
        title="Importer la liste des copropriétaires"
        sub="CSV avec en-tête : nom, lot, tantièmes (fraction ou nombre sur 10 000), puis solde, téléphone, e-mail"
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
          <input
            type="file"
            accept=".csv,.txt,text/csv"
            aria-label="Fichier de copropriétaires"
            onChange={choisirFichier}
          />
          <button
            className="btn"
            onClick={() => {
              setTexteListe(EXEMPLE_LISTE_COPROPRIETAIRES_CSV)
              setAnalyse(null)
            }}
          >
            Exemple
          </button>
          <button className="btn gold" onClick={analyser} disabled={!texteListe.trim() || !copro}>
            <Icon name="search" />
            Analyser
          </button>
        </div>
        <textarea
          aria-label="Liste des copropriétaires"
          value={texteListe}
          onChange={(evenement) => {
            setTexteListe(evenement.target.value)
            setAnalyse(null)
          }}
          rows={5}
          style={{
            width: '100%',
            fontFamily: 'JetBrains Mono, monospace',
            fontSize: 12,
          }}
          placeholder={EXEMPLE_LISTE_COPROPRIETAIRES_CSV}
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
            {analyse.lignes.length > 0 && (
              <>
                <Alert
                  kind={
                    analyse.controle.ecartTantiemes === 0 && analyse.controle.doublons.length === 0 ? 'ok' : 'warn'
                  }
                  icon="check"
                  title="Contrôle de la liste"
                >
                  {analyse.controle.sommeTantiemes}
                  {' tantièmes sur '}
                  {analyse.controle.denominateur}
                  {analyse.controle.ecartTantiemes !== 0
                    ? ` (écart ${analyse.controle.ecartTantiemes > 0 ? '+' : ''}${analyse.controle.ecartTantiemes})`
                    : ''}
                  {' · '}
                  {analyse.controle.debiteurs}
                  {' débiteur'}
                  {analyse.controle.debiteurs > 1 ? 's' : ''}
                  {' pour '}
                  {formatEuros(-analyse.controle.totalDebiteur)}
                  {analyse.controle.doublons.length
                    ? ` · ${analyse.controle.doublons.length} doublon${analyse.controle.doublons.length > 1 ? 's' : ''} nom + lot`
                    : ''}
                  .
                </Alert>
                <DataTable<LigneApercuListe>
                  rowKey="i"
                  columns={[
                    {
                      h: 'Nom',
                      render: (ligne) => (
                        <b
                          style={{
                            fontWeight: 600,
                          }}
                        >
                          {ligne.nom}
                        </b>
                      ),
                    },
                    {
                      h: 'Lot',
                      render: (ligne) => ligne.lot,
                    },
                    {
                      h: 'Tantièmes',
                      render: (ligne) => (
                        <span className="mono">
                          {ligne.tantiemes.numerateur}/{ligne.tantiemes.denominateur}
                        </span>
                      ),
                    },
                    {
                      h: 'Solde',
                      render: (ligne) => (
                        <span
                          className="mono"
                          style={{
                            color: ligne.solde < 0 ? 'var(--rust-500)' : 'inherit',
                          }}
                        >
                          {formatEuros(ligne.solde)}
                        </span>
                      ),
                    },
                    {
                      h: 'Contact',
                      render: (ligne) => (
                        <span
                          style={{
                            fontSize: 12,
                            color: 'var(--navy-500)',
                          }}
                        >
                          {ligne.tel || '·'}
                          {' · '}
                          {ligne.mail || '·'}
                        </span>
                      ),
                    },
                  ]}
                  rows={analyse.lignes.map((ligne, index) => ({
                    ...ligne,
                    i: index,
                  }))}
                />
                <button
                  className="btn gold"
                  style={{
                    marginTop: 10,
                  }}
                  onClick={importer}
                >
                  <Icon name="check" />
                  {'Importer '}
                  {analyse.lignes.length}
                  {' copropriétaire'}
                  {analyse.lignes.length > 1 ? 's' : ''}
                </button>
              </>
            )}
          </div>
        )}
      </Panel>
      <Panel
        title={`Pièces à obtenir de l'ancien syndic (${piecesRecues.size}/${PIECES_REPRISE.length})`}
        sub="Cliquer pour marquer reçue ou retirée : chaque changement est enregistré, rien n'est effacé · délais de l'art. 18-2 calculés par le moteur"
        icon="clipboard"
        flush
      >
        {PIECES_REPRISE.map((piece) => {
          const recue = piecesRecues.has(piece.cle),
            regleMoteur = REGLE_MOTEUR_PAR_DELAI_PIECE[piece.delai],
            dateLimite = regleMoteur ? dateLimiteRegle(regleMoteur) : null
          return (
            <button
              type="button"
              onClick={() => basculerPiece(piece)}
              // borderBottom puis border: 'none' (qui l'annule) : ordre des clés conservé tel que dans la maquette.
              style={{
                display: 'flex',
                gap: 14,
                width: '100%',
                textAlign: 'left',
                padding: '12px 22px',
                borderBottom: '1px solid var(--line)',
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                alignItems: 'center',
              }}
              key={piece.cle}
            >
              <span
                style={{
                  width: 22,
                  height: 22,
                  borderRadius: 6,
                  border: '1.5px solid var(--line-strong, var(--line))',
                  background: recue ? 'var(--sage-500, #2e7d5b)' : 'transparent',
                  display: 'grid',
                  placeItems: 'center',
                  color: '#fff',
                  flexShrink: 0,
                }}
              >
                {recue ? (
                  <Icon
                    name="check"
                    style={{
                      width: 14,
                      height: 14,
                    }}
                  />
                ) : null}
              </span>
              <div
                style={{
                  flex: 1,
                }}
              >
                <div
                  style={{
                    fontSize: 13,
                    fontWeight: 600,
                    textDecoration: recue ? 'line-through' : 'none',
                    opacity: recue ? 0.7 : 1,
                  }}
                >
                  {piece.libelle}
                </div>
                <div
                  style={{
                    fontSize: 11,
                    color: 'var(--navy-300)',
                  }}
                >
                  {piece.base}
                  {' · '}
                  {libelleDelaiPiece(piece.delai)}
                  {dateLimite
                    ? ` · au plus tard le ${dateLimite}`
                    : regleMoteur
                      ? " · date de cessation des fonctions de l'ancien syndic à saisir"
                      : ''}
                </div>
              </div>
              <Pill kind={recue ? 'sage' : 'amber'} noDot>
                {recue ? 'Reçue' : 'Attendue'}
              </Pill>
            </button>
          )
        })}
      </Panel>
    </>
  )
}
