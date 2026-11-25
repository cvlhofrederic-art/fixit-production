'use client'

import { useState } from 'react'
import { ConfirmerAppelModal, OuvrirExerciceModal } from '@/components/administrateur-judiciaire/modules/finances/appels/AppelsModals'
import {
  datePrelevementProposee,
  exigibilitesAAppeler,
  vueAvisAppel,
  vueDroitsLots,
  type DroitsLot,
  type PersonneEnPlace,
  type VueAvisAppel,
} from '@/components/administrateur-judiciaire/modules/finances/appels/appels-vue'
import { Alert } from '@/components/administrateur-judiciaire/ui/Alert'
import { Field } from '@/components/administrateur-judiciaire/ui/Field'
import { Icon } from '@/components/administrateur-judiciaire/ui/Icon'
import { Panel } from '@/components/administrateur-judiciaire/ui/Panel'
import { Pill } from '@/components/administrateur-judiciaire/ui/Pill'
import type { DonneesAppelsLues } from '@/lib/administrateur-judiciaire/db/appels-de-fonds'
import type { RegimeAdministrateurProvisoire } from '@/lib/administrateur-judiciaire/domain/avis-appel'
import type { CoproprieteVue } from '@/lib/administrateur-judiciaire/domain/coproprietes'
import { dateIsoVersFr } from '@/lib/administrateur-judiciaire/domain/dates'
import { regimeDepuisFondement } from '@/lib/administrateur-judiciaire/domain/fondements'
import { formatEurosCentimes } from '@/lib/administrateur-judiciaire/domain/format'
import { numeroCompteCoproprietaire } from '@/lib/administrateur-judiciaire/domain/identites-positions'
import { segmentComptableSyndicat } from '@/lib/administrateur-judiciaire/domain/journal-traitements'
import { libelleFicheEcartee, type FicheEcarteeDetaillee } from '@/lib/administrateur-judiciaire/domain/migration-d2'
import { AUJOURDHUI_ISO } from '@/lib/administrateur-judiciaire/mode'

/**
 * Panneau « Avis d'appel par copropriétaire » de l'écran « Appels de fonds » en données réelles, repris de la maquette du
 * 27/10/2026 (MaquetteAvisAppelPanel : même ordre, mêmes styles en ligne), sur les tables D2 du syndicat choisi :
 * choix de l'appel (échéances « Prévu » exigibles jusqu'à la date), droits sur les lots, avis par compte, écriture
 * « Appel de fonds » et prélèvements SEPA. Ajouts à la maquette (écarts) : reprise des anciennes fiches, anomalies et
 * blocages du domaine, contenu de l'avis (date limite, règlement, mentions), date du prélèvement, « Ouvrir l'exercice »
 * et « Écrire l'appel ». Tous les calculs : appels-vue.ts. Écritures : passées par l'écran (toasts).
 */

const STYLE_TITRE = { fontSize: 12, fontWeight: 700, color: 'var(--navy-300)', margin: '0 0 6px', textTransform: 'uppercase' } as const
const STYLE_DETAIL = { fontSize: 12, color: 'var(--navy-300)' } as const

const eur = (centimes: number): string => formatEurosCentimes(centimes / 100)
const pluriel = (n: number, mot: string): string => `${n} ${mot}${n > 1 ? 's' : ''}`

export interface EcrituresAvis {
  reprendreFiches: () => Promise<void>
  /** `exigibilite` : celle que l'exercice doit comprendre (refus sinon, db/appels-de-fonds.ts). */
  ouvrirExercice: (bornes: { ouverture: string; cloture: string; exigibilite: string }) => Promise<boolean>
  ecrireAppel: (jusquAu: string) => Promise<boolean>
}

/** Segment comptable du syndicat (D1) ; un code de plus de quatre caractères ne permet aucun numéro de compte. */
function segmentDe(code: string): { segment: string | null; erreur: string | null } {
  try {
    return { segment: segmentComptableSyndicat(code), erreur: null }
  } catch (erreur) {
    return { segment: null, erreur: erreur instanceof Error ? erreur.message : String(erreur) }
  }
}

const regimeAp = (fondement: string): RegimeAdministrateurProvisoire | null => {
  const regime = regimeDepuisFondement(fondement)
  return regime === 'ap291' || regime === 'ap47' ? regime : null
}

/** Une ligne par fiche écartée : « Lot <n°>, <nom> — <motif> ». */
function LignesEcartees({ ecartees }: Readonly<{ ecartees: readonly FicheEcarteeDetaillee[] }>) {
  return ecartees.map((e) => (
    <span key={e.coproprietaireId} style={{ display: 'block' }}>
      {libelleFicheEcartee(e)}
    </span>
  ))
}

/**
 * Bandeau de la reprise D2 (décision du 22/11/2026, point 10) : compte les seules fiches que la reprise créerait, nomme
 * celles qu'elle écarte avec leur motif (même Alert, une ligne par fiche) ; le bouton dit qu'il agit sur toutes les
 * copropriétés. Plus rien à reprendre : le bandeau « non reprise » et son bouton disparaissent ; les fiches écartées
 * restent nommées avec leur motif dans le même encadré, sans bouton (point 1 de la page de validation de la PR) ; aucune
 * fiche écartée : rien.
 */
function RepriseFiches({
  nombre,
  ecartees,
  onReprendre,
}: Readonly<{ nombre: number; ecartees: readonly FicheEcarteeDetaillee[]; onReprendre: () => void }>) {
  const se = ecartees.length > 1 ? 's' : ''
  if (nombre === 0) {
    if (ecartees.length === 0) return null
    return (
      <Alert kind="" icon="info" title={`${pluriel(ecartees.length, 'fiche')} écartée${se} par la reprise`}>
        <LignesEcartees ecartees={ecartees} />
      </Alert>
    )
  }
  const s = nombre > 1 ? 's' : ''
  return (
    <Alert kind="" icon="info" title={`${nombre} fiche${s} copropriétaire non reprise${s} en identités, comptes et positions (D2)`}>
      <span style={{ display: 'block' }}>
        La reprise crée une identité, un compte et une position par ancienne fiche, pour toutes les copropriétés ; une
        indivision ou une vente reste à régulariser.
      </span>
      {ecartees.length > 0 && (
        <>
          <span style={{ display: 'block' }}>{`${pluriel(ecartees.length, 'fiche')} écartée${se} par la reprise :`}</span>
          <LignesEcartees ecartees={ecartees} />
        </>
      )}
      <button type="button" className="btn ghost sm" style={{ marginTop: 6 }} onClick={onReprendre}>
        <Icon name="refresh" />
        Reprendre les fiches de toutes les copropriétés
      </button>
    </Alert>
  )
}

/** « Nom — qualité part · compte série » (part et compte omis s'ils manquent). */
const libellePersonne = (p: PersonneEnPlace): string =>
  [`${p.nom} — ${p.qualite}`, p.part, p.serie && `· compte ${p.serie}`].filter(Boolean).join(' ')

function DroitsLots({ droits, date }: Readonly<{ droits: readonly DroitsLot[]; date: string }>) {
  return (
    <>
      <h4 style={STYLE_TITRE}>{`Droits sur les lots au ${dateIsoVersFr(date)}`}</h4>
      {droits.length === 0 && (
        <p className="muted" style={{ fontSize: 13, margin: '0 0 14px' }}>
          Aucun lot enregistré pour cette copropriété.
        </p>
      )}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 12, marginBottom: 14, fontSize: 13 }}>
        {droits.map((lot) => (
          <div key={lot.lotId} style={{ border: '1px solid var(--line)', borderRadius: 8, padding: 10, minWidth: 0 }}>
            <b>{`Lot ${lot.numero}`}</b> {lot.anomalie === null ? <Pill kind="sage">Droits complets</Pill> : <Pill kind="rust">{lot.anomalie}</Pill>}
            {lot.venteCeJour && (
              <span style={{ display: 'block', margin: '4px 0' }}>
                <Pill kind="gold">Vente ce jour : appel au vendeur</Pill>
              </span>
            )}
            {lot.vendeurs.map((v) => (
              <div key={v.positionId} style={{ fontSize: 12.5 }}>
                {`Vendeur appelé : ${libellePersonne(v)}`}
              </div>
            ))}
            {lot.enPlace.map((p) => (
              <div key={p.positionId} style={{ fontSize: 12.5 }}>
                {libellePersonne(p)}
              </div>
            ))}
          </div>
        ))}
      </div>
    </>
  )
}

const COULEUR_GRAVITE = { bloquant: 'var(--rust-700)', avertissement: 'var(--amber-700)' } as const

function ListeAvis({ vue, donnees, segment }: Readonly<{ vue: VueAvisAppel; donnees: DonneesAppelsLues; segment: string }>) {
  if (!vue.avis || vue.avis.parCompte.length === 0) return null
  const libelleEcheance = (id: string) => vue.echeances.find((e) => e.id === id)?.libelle ?? id
  const numeroLot = (id: string) => donnees.lots.find((l) => l.id === id)?.numero ?? id
  return (
    <>
      <h4 style={STYLE_TITRE}>Avis d’appel par compte</h4>
      {vue.avis.parCompte.map((a) => {
        const compte = donnees.comptes.find((c) => c.id === a.compteId)
        const contenu = vue.contenu?.parCompte.find((c) => c.compteId === a.compteId)
        const numero = contenu?.numeroCompte ?? (compte ? numeroCompteCoproprietaire(compte, segment) : a.compteId)
        const signalees = contenu?.anomalies.filter((x) => x.gravite !== 'information') ?? []
        return (
          <div key={a.compteId} style={{ borderBottom: '1px solid var(--line)', padding: '6px 0', fontSize: 13 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
              <span>
                <b>{compte?.libelle ?? a.compteId}</b> <span className="mono">{numero}</span>
              </span>
              <span>
                {`Appelé ${eur(a.totalAppeleCentimes)} · solde antérieur non repris · `}
                <b>{`à payer ${eur(a.totalAPayerCentimes)}`}</b>
              </span>
            </div>
            <div style={STYLE_DETAIL}>
              {a.lignes.map((l) => `${libelleEcheance(l.echeanceId)} · Lot ${numeroLot(l.lotId)} (clé ${l.cle}) ${eur(l.centimes)}`).join(' — ')}
            </div>
            {contenu && (
              <div style={STYLE_DETAIL}>
                {`À régler avant le ${dateIsoVersFr(contenu.aReglerAvantLe)} · Règlement : ${contenu.modeReglement ?? 'à renseigner'}`}
              </div>
            )}
            {signalees.map((x, index) => (
              <div key={`${index}-${x.code}`} style={{ fontSize: 12, color: COULEUR_GRAVITE[x.gravite as keyof typeof COULEUR_GRAVITE] }}>
                {`${x.gravite === 'bloquant' ? 'Bloque la diffusion de l’avis' : 'À vérifier'} : ${x.message}`}
              </div>
            ))}
          </div>
        )
      })}
      {vue.contenu && (
        <p style={{ ...STYLE_DETAIL, margin: '6px 0 0' }}>
          {`Mentions portées par l’avis : ${[...new Set(vue.contenu.parCompte.flatMap((c) => c.mentions.map((m) => m.fondement)))].join(' · ')}.`}
        </p>
      )}
    </>
  )
}

function EcritureAppel({
  vue,
  mandatPresent,
  onOuvrirExercice,
  onEcrire,
}: Readonly<{ vue: VueAvisAppel; mandatPresent: boolean; onOuvrirExercice: () => void; onEcrire: () => void }>) {
  const avertissements = vue.controleDate.filter((a) => a.gravite === 'avertissement')
  return (
    <div>
      <h4 style={STYLE_TITRE}>Écriture « Appel de fonds »</h4>
      {vue.ecriture?.mouvements.map((m) => (
        <div key={`${m.sens}-${m.compte}`} className="mono" style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
          <span>{m.compte}</span>
          <span>{`${m.sens === 'debit' ? 'D' : 'C'} ${eur(m.montantCentimes)}`}</span>
        </div>
      ))}
      {vue.ecriture && vue.dateComptable && vue.equilibre && (
        <p style={{ ...STYLE_DETAIL, margin: '6px 0 8px' }}>
          {`Date comptable : ${dateIsoVersFr(vue.dateComptable)} (exigibilité) · Débit = crédit : ${eur(vue.equilibre.debitCentimes)}`}
        </p>
      )}
      {!vue.ecriture && <p style={{ ...STYLE_DETAIL, margin: '0 0 8px' }}>Aucune écriture tant que l’avis porte une anomalie.</p>}
      {avertissements.map((a) => (
        <Alert key={`${a.code}-${a.echeanceId}`} kind="warn" icon="alert" title={a.message} />
      ))}
      {vue.blocage && <Alert kind="rust" icon="alert" title={vue.blocage} />}
      {!mandatPresent && <Alert kind="rust" icon="alert" title="Aucun mandat enregistré : chaque pièce garde le mandat qui l’a produite (D1)." />}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {vue.exerciceManquant && (
          <button type="button" className="btn ghost sm" onClick={onOuvrirExercice}>
            <Icon name="calendar" />
            Ouvrir l’exercice
          </button>
        )}
        <button type="button" className="btn gold sm" disabled={!!vue.blocage || !vue.ecriture || !mandatPresent} onClick={onEcrire}>
          <Icon name="check" />
          Écrire l’appel
        </button>
      </div>
    </div>
  )
}

function PrelevementsSepa({ vue, date, onDate }: Readonly<{ vue: VueAvisAppel; date: string; onDate: (date: string) => void }>) {
  const lignes = vue.prelevements?.lignes ?? []
  const lot = vue.prelevements?.lot
  return (
    <div>
      <h4 style={STYLE_TITRE}>Prélèvements SEPA</h4>
      <Field label="Date du prélèvement" name="appel-date-prelevement">
        <input type="date" value={date} onChange={(evenement) => onDate(evenement.target.value)} />
      </Field>
      {lot ? (
        <div style={{ fontSize: 12.5, marginBottom: 6 }}>{`${pluriel(lot.retenues.length, 'prélèvement')} retenu${lot.retenues.length > 1 ? 's' : ''} · ${eur(lot.totalCentimes)}`}</div>
      ) : (
        <p style={{ ...STYLE_DETAIL, margin: '0 0 6px' }}>Lot non établi tant que l’avis ne l’est pas.</p>
      )}
      {lignes.map((l) =>
        l.etat === 'exclu' ? (
          <Alert key={l.compteId} kind="warn" icon="alert" title={`${l.libelle} exclu : ${l.motif ?? ''}`} />
        ) : (
          <div key={l.compteId} style={{ fontSize: 12.5 }}>
            {l.etat === 'retenu'
              ? `${l.libelle} : ${eur(l.montantCentimes)}, retenu`
              : `${l.libelle} : ${eur(l.montantCentimes)}, en attente de la diffusion de l’avis (pré-notification)`}
          </div>
        ),
      )}
      {lot && lignes.length === 0 && (
        <p style={{ ...STYLE_DETAIL, margin: 0 }}>Aucun compte au prélèvement : mode de règlement et mandat SEPA des comptes à saisir (à brancher).</p>
      )}
      <p style={{ ...STYLE_DETAIL, margin: '8px 0 0', fontSize: 11.5 }}>
        Fichier pain.008 jamais transmis par VitFix : il sera produit après la diffusion de l’avis (à brancher), format à
        faire valider par la banque du syndicat.
      </p>
    </div>
  )
}

/** Formulaire ouvert : aucun, ouverture d'exercice, confirmation de l'appel. */
type Edition = null | { type: 'exercice'; exigibilite: string } | { type: 'appel' }

/**
 * Appel choisi (échéances « Prévu » exigibles jusqu'à la date ; à défaut, la première) et date du prélèvement, saisie par
 * appel ou proposée (exigibilité, au plus tôt 14 jours après l'émission).
 */
function useChoixAppel(echeances: DonneesAppelsLues['echeances']) {
  const options = exigibilitesAAppeler(echeances)
  const [choix, setChoix] = useState<string | null>(null)
  const [datesPrelevement, setDatesPrelevement] = useState<Record<string, string>>({})
  const jusquAu = choix !== null && options.includes(choix) ? choix : (options[0] ?? null)
  const datePrelevement = jusquAu ? (datesPrelevement[jusquAu] ?? datePrelevementProposee([jusquAu], AUJOURDHUI_ISO)) : ''
  const changerDate = (date: string) => {
    if (jusquAu) setDatesPrelevement((avant) => ({ ...avant, [jusquAu]: date }))
  }
  return { options, jusquAu, setChoix, datePrelevement, changerDate }
}

/** Vue de l'appel choisi, recalculée à chaque rendu comme celle des comptes bancaires (le compilateur React mémorise). */
function vueDeLAppel(copro: CoproprieteVue, donnees: DonneesAppelsLues, jusquAu: string, segment: string, datePrelevement: string): VueAvisAppel {
  return vueAvisAppel(donnees, {
    jusquAu,
    dateEmission: AUJOURDHUI_ISO,
    datePrelevement: datePrelevement || null,
    segmentSyndicat: segment,
    syndicat: { nom: `Syndicat des copropriétaires ${copro.nom}`, adresse: copro.adresse },
    ics: copro.fiche?.ics?.trim() || null,
    administrateurProvisoire: regimeAp(copro.fondement),
    // Réglage des sous-comptes du 450 (J67, R104) : aucune saisie encore, tout au 45000.
    sousComptes450: null,
  })
}

interface CorpsAvisProps {
  vue: VueAvisAppel
  donnees: DonneesAppelsLues
  segment: string
  mandatPresent: boolean
  datePrelevement: string
  onDate: (date: string) => void
  onEditer: (edition: Edition) => void
}

/** Avis de l'appel choisi : anomalies, avis par compte, écriture et prélèvements. */
function CorpsAvis({ vue, donnees, segment, mandatPresent, datePrelevement, onDate, onEditer }: Readonly<CorpsAvisProps>) {
  const signalees = vue.contenu?.anomalies.filter((a) => a.gravite !== 'information') ?? []
  const exercice = vue.exerciceManquant
  return (
    <>
      {vue.anomalies.map((message) => (
        <Alert key={message} kind="rust" icon="alert" title={message} />
      ))}
      {vue.erreur && (
        <Alert kind="rust" icon="alert" title="Avis non établi">
          {vue.erreur}
        </Alert>
      )}
      <ListeAvis vue={vue} donnees={donnees} segment={segment} />
      {signalees.map((a) => (
        <Alert key={a.code} kind={a.gravite === 'bloquant' ? 'rust' : 'warn'} icon="alert" title={a.message} />
      ))}
      <div className="card-grid cols-2" style={{ marginTop: 12, fontSize: 12.5 }}>
        <EcritureAppel
          vue={vue}
          mandatPresent={mandatPresent}
          onOuvrirExercice={() => onEditer(exercice ? { type: 'exercice', exigibilite: exercice } : null)}
          onEcrire={() => onEditer({ type: 'appel' })}
        />
        <PrelevementsSepa vue={vue} date={datePrelevement} onDate={onDate} />
      </div>
    </>
  )
}

interface ModalesAvisProps {
  edition: Edition
  vue: VueAvisAppel | null
  jusquAu: string | null
  ecritures: EcrituresAvis
  fermer: () => void
}

/** Modales du panneau : chaque écriture ferme la sienne quand elle réussit, la laisse ouverte sinon. */
function ModalesAvis({ edition, vue, jusquAu, ecritures, fermer }: Readonly<ModalesAvisProps>) {
  const puisFermer = (ferme: boolean): boolean => {
    if (ferme) fermer()
    return ferme
  }
  if (edition?.type === 'exercice')
    return (
      <OuvrirExerciceModal
        exigibilite={edition.exigibilite}
        onClose={fermer}
        onEnregistrer={async (bornes) => puisFermer(await ecritures.ouvrirExercice({ ...bornes, exigibilite: edition.exigibilite }))}
      />
    )
  if (edition?.type !== 'appel' || !vue?.dateComptable || !jusquAu) return null
  return (
    <ConfirmerAppelModal
      dateComptable={vue.dateComptable}
      nombreEcheances={vue.echeances.length}
      totalCentimes={vue.equilibre?.debitCentimes ?? 0}
      onClose={fermer}
      onConfirmer={async () => puisFermer(await ecritures.ecrireAppel(jusquAu))}
    />
  )
}

export function AvisAppelPanel({
  copro,
  donnees,
  ecritures,
}: Readonly<{ copro: CoproprieteVue; donnees: DonneesAppelsLues; ecritures: EcrituresAvis }>) {
  const { options, jusquAu, setChoix, datePrelevement, changerDate } = useChoixAppel(donnees.echeances)
  const [edition, setEdition] = useState<Edition>(null)
  const { segment, erreur: erreurSegment } = segmentDe(copro.code)
  const vue = jusquAu && segment ? vueDeLAppel(copro, donnees, jusquAu, segment, datePrelevement) : null
  const date = jusquAu ?? AUJOURDHUI_ISO

  return (
    <Panel
      title="Avis d’appel par copropriétaire"
      sub="Identités, positions et comptes (D2) du syndicat"
      icon="coin"
      right={
        options.length > 0 && (
          <select className="btn ghost sm" value={date} onChange={(evenement) => setChoix(evenement.target.value)} aria-label="Appel">
            {options.map((option) => (
              <option key={option} value={option}>{`Appel au ${dateIsoVersFr(option)}`}</option>
            ))}
          </select>
        )
      }
    >
      <RepriseFiches nombre={donnees.fichesAReprendre} ecartees={donnees.fichesEcartees} onReprendre={() => void ecritures.reprendreFiches()} />
      {erreurSegment && <Alert kind="rust" icon="alert" title={erreurSegment} />}
      <DroitsLots droits={vueDroitsLots(donnees, date)} date={date} />
      {vue && segment && (
        <CorpsAvis
          vue={vue}
          donnees={donnees}
          segment={segment}
          mandatPresent={!!copro.mandatId}
          datePrelevement={datePrelevement}
          onDate={changerDate}
          onEditer={setEdition}
        />
      )}
      {!jusquAu && (
        <p className="muted" style={{ fontSize: 13, margin: 0 }}>
          Aucune échéance à appeler. « Émettre un appel » crée une échéance du syndicat.
        </p>
      )}
      <ModalesAvis edition={edition} vue={vue} jusquAu={jusquAu} ecritures={ecritures} fermer={() => setEdition(null)} />
    </Panel>
  )
}
