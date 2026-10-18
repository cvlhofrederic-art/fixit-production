'use client'

// ── Écran « Charges & paiements » (propriétaire seulement) ────────────────────
//
// Dans l'ordre : ce que le copropriétaire doit (prochain appel non soldé), comment payer
// (IBAN et référence à copier), ses appels de charges en cartes, les factures du syndic
// (PDF demandé au clic, jamais d'URL servie dans la liste), les retards de paiement, puis un
// bloc « comprendre mes charges ». Tout vient de `espace` (lib/coproprietaire/types.ts).
// Jamais de montant négatif sans explication, jamais le mot « impayé » à l'écran.
//
// Le prochain appel est calculé ici (`prochainAppelCharges`), même règle que l'Accueil :
// non annulé, reste > 0, trié par échéance ; en retard si le statut est en_retard ou si
// l'échéance est passée. La date de référence est celle du dernier chargement (`miseAJourLe`).

import { useId, useState } from 'react'
import type { PropsEcran } from '@/components/coproprietaire-dashboard/contrat'
import { avecContexte } from '@/lib/coproprietaire/api'
import {
  Badge, Bouton, BoutonCopier, Carte, Deplie, Encadre, EtatVide, Ligne, Montant, type TonBadge,
} from '@/components/coproprietaire-dashboard/ui'
import {
  dateLongue, euros, libelleNatureImpaye, libelleStatutAppel, libelleStatutFacture, pourcentage, remplir,
  type LangueCopro, type TextesCopro,
} from '@/lib/coproprietaire/textes'
import { sommeDueHorsAppels, type SommeDueHorsAppels } from '@/lib/coproprietaire/filtrage'
import type {
  AppelDeCharges, EspaceCopro, FactureCopro, ImpayeCopro, StatutAppel, StatutFacture, StatutImpaye,
} from '@/lib/coproprietaire/types'

/** Identifiant de la carte « Ce que vous devez » (repère pour les tests et les ancres). */
export const ID_CARTE_CE_QUE_VOUS_DEVEZ = 'copro-ce-que-vous-devez'

// ── Libellés propres à cet écran, absents de textes.ts (FR / PT) ─────────────

interface TextesLocaux {
  periode: string
  echeance: string
  emiseLe: string
  echeanceLe: string
  retardSansDate: string
  pdfDemo: string
  rembourse: string
  enVotreFaveur: string
  reserveProprietaire: string
}

const TEXTES_LOCAUX: Record<LangueCopro, TextesLocaux> = {
  fr: {
    periode: 'Période',
    echeance: 'Échéance',
    emiseLe: 'émise le {date}',
    echeanceLe: 'à régler avant le {date}',
    retardSansDate: 'Retard de paiement : {montant}',
    pdfDemo: 'L’ouverture du PDF n’est pas disponible en démonstration.',
    rembourse: 'remboursé',
    enVotreFaveur: 'en votre faveur',
    reserveProprietaire: 'Les charges et les paiements concernent le propriétaire du logement.',
  },
  pt: {
    periode: 'Período',
    echeance: 'Vencimento',
    emiseLe: 'emitida em {date}',
    echeanceLe: 'a pagar até {date}',
    retardSansDate: 'Pagamento em atraso: {montant}',
    pdfDemo: 'A abertura do PDF não está disponível na demonstração.',
    rembourse: 'reembolsado',
    enVotreFaveur: 'a seu favor',
    reserveProprietaire: 'As quotas e os pagamentos dizem respeito ao proprietário da habitação.',
  },
}

const TON_STATUT_APPEL: Record<StatutAppel, TonBadge> = {
  a_payer: 'ambre', partiellement_paye: 'ambre', solde: 'vert', en_retard: 'rouge', annule: 'gris',
}
const TON_STATUT_FACTURE: Record<StatutFacture, TonBadge> = {
  a_regler: 'ambre', partiellement_regle: 'ambre', reglee: 'vert', contestee: 'bleu', annulee: 'gris',
}
const TON_STATUT_RETARD: Record<StatutImpaye, TonBadge> = {
  ouvert: 'ambre', en_recouvrement: 'rouge', solde: 'vert', passe_perte: 'gris',
}

const LOCALE_NOMBRE: Record<LangueCopro, string> = { fr: 'fr-FR', pt: 'pt-PT' }

// ── Prochain appel (même règle que l'Accueil) ────────────────────────────────

export interface ProchainAppel {
  appel: AppelDeCharges
  /** Statut en_retard, ou échéance strictement antérieure au jour de référence. */
  enRetard: boolean
}

/** Jour local AAAA-MM-JJ d'une date (comparaison au jour près, sans effet de fuseau). */
function jourIso(date: Date): string {
  const mois = String(date.getMonth() + 1).padStart(2, '0')
  const jour = String(date.getDate()).padStart(2, '0')
  return `${date.getFullYear()}-${mois}-${jour}`
}

/**
 * Prochain appel de charges à régler : non annulé, reste à payer > 0, le plus proche par
 * échéance (les appels sans échéance passent en dernier). `enRetard` si son statut est
 * en_retard ou si son échéance est passée au jour `aujourdhui`. Null quand rien n'est dû.
 */
export function prochainAppelCharges(appels: readonly AppelDeCharges[], aujourdhui: Date): ProchainAppel | null {
  const ouverts = appels.filter(a => a.statut !== 'annule' && a.resteAPayer > 0)
  if (ouverts.length === 0) return null
  const cle = (a: AppelDeCharges) => a.echeance.slice(0, 10) || '9999-12-31'
  const tries = [...ouverts].sort((a, b) => cle(a).localeCompare(cle(b)))
  const appel = tries[0]
  const echeance = appel.echeance.slice(0, 10)
  const echeancePassee = echeance !== '' && echeance < jourIso(aujourdhui)
  return { appel, enRetard: appel.statut === 'en_retard' || echeancePassee }
}

// ── Outils d'affichage ───────────────────────────────────────────────────────

/** Appels du plus récent au plus ancien (par échéance), ceux sans échéance en dernier. */
function trierAppels(appels: readonly AppelDeCharges[]): AppelDeCharges[] {
  const cle = (a: AppelDeCharges) => a.echeance.slice(0, 10)
  return [...appels].sort((a, b) => {
    const ka = cle(a)
    const kb = cle(b)
    if (ka === kb) return 0
    if (ka === '') return 1
    if (kb === '') return -1
    return ka < kb ? 1 : -1
  })
}

function nombre(valeur: number, langue: LangueCopro): string {
  return new Intl.NumberFormat(LOCALE_NOMBRE[langue]).format(valeur)
}

function arrondiCentimes(valeur: number): number {
  return Math.round(valeur * 100) / 100
}

/** Montant jamais négatif à l'écran : « 20 € en votre faveur » plutôt que « -20 € ». */
function montantExplique(valeur: number, langue: LangueCopro, explication: string): string {
  return valeur < 0 ? `${euros(-valeur, langue)} ${explication}` : euros(valeur, langue)
}

function majuscule(texte: string): string {
  return texte.charAt(0).toUpperCase() + texte.slice(1)
}

/** Date de la dernière relance connue parmi les retards de paiement (vide si aucune). */
function derniereRelance(retards: readonly ImpayeCopro[]): string {
  const dates = retards.map(r => r.derniereRelanceLe).filter(d => d !== '').sort((a, b) => a.localeCompare(b))
  return dates.length > 0 ? dates[dates.length - 1] : ''
}

/** Phrases du bloc « comprendre mes charges » (seulement celles dont la donnée existe). */
function phrasesComprendre(espace: EspaceCopro, t: TextesCopro, langue: LangueCopro): string[] {
  const { profil, immeuble, finances } = espace
  const phrases: string[] = []
  if (profil.quotePart > 0 && profil.tantiemes > 0) {
    const total = profil.totalTantiemes
    phrases.push(remplir(t.charges.tantiemesPhrase, {
      tantiemes: nombre(profil.tantiemes, langue), total: nombre(total, langue), pourcentage: pourcentage(profil.quotePart, langue),
    }))
  }
  if (immeuble.budgetAnnuel > 0) {
    phrases.push(remplir(t.charges.budgetPhrase, { budget: euros(immeuble.budgetAnnuel, langue), depenses: euros(immeuble.depensesAnnee, langue) }))
  }
  if (finances.solde !== 0) {
    phrases.push(remplir(finances.solde < 0 ? t.charges.soldeDu : t.charges.soldeCredit, { montant: euros(Math.abs(finances.solde), langue) }))
  }
  return phrases
}

// ── Sous-composants ──────────────────────────────────────────────────────────

/** Phrase dont le {montant} est mis en gros et en gras. */
function PhraseMontant({ modele, montant, valeurs }: { modele: string; montant: string; valeurs: Record<string, string> }) {
  const [avant, apres = ''] = modele.split('{montant}')
  return (
    <p className="text-lg leading-snug text-[#0D1B2E]">
      {remplir(avant, valeurs)}
      <Montant grand valeur={montant} />
      {remplir(apres, valeurs)}
    </p>
  )
}

function CarteCeQueVousDevez({ prochain, du, retards, t, langue, tl }: {
  prochain: ProchainAppel | null
  /** Somme due hors appels (factures, retards, solde), consultée seulement sans appel à payer. */
  du: SommeDueHorsAppels | null
  retards: readonly ImpayeCopro[]
  t: TextesCopro
  langue: LangueCopro
  tl: TextesLocaux
}) {
  const titre = t.charges.ceQueVousDevez
  const resume = prochain
    ? { montant: prochain.appel.resteAPayer, date: prochain.appel.echeance, enRetard: prochain.enRetard, solde: false }
    : du ? { montant: du.montant, date: du.date, enRetard: du.enRetard, solde: du.source === 'solde' } : null
  if (!resume) {
    return (
      <Carte id={ID_CARTE_CE_QUE_VOUS_DEVEZ} ton="vert" titre={titre}>
        <p className="text-xl font-bold text-[#1E6B3A]">{t.charges.aJour}</p>
      </Carte>
    )
  }
  const { enRetard } = resume
  const montant = euros(resume.montant, langue)
  const date = dateLongue(resume.date, langue)
  if (enRetard) {
    const relance = derniereRelance(retards)
    return (
      <Carte id={ID_CARTE_CE_QUE_VOUS_DEVEZ} ton="rouge" titre={titre}>
        <PhraseMontant modele={date ? t.charges.retard : tl.retardSansDate} montant={montant} valeurs={{ date }} />
        {relance && (
          <p className="mt-2 text-sm text-[#6E1C13]">{majuscule(remplir(t.charges.relanceEnvoyee, { date: dateLongue(relance, langue) }))}</p>
        )}
      </Carte>
    )
  }
  return (
    <Carte id={ID_CARTE_CE_QUE_VOUS_DEVEZ} ton="or" titre={titre}>
      <PhraseMontant modele={resume.solde ? t.charges.soldeDu : date ? t.charges.aReglerAvant : t.charges.aRegler} montant={montant} valeurs={{ date }} />
    </Carte>
  )
}

function CommentPayer({ appel, t }: { appel: AppelDeCharges; t: TextesCopro }) {
  return (
    <Carte titre={t.charges.commentPayer}>
      <p className="text-base font-semibold text-[#0D1B2E]">{t.charges.parVirement}</p>
      {(appel.iban || appel.referencePaiement) && (
        <dl className="mt-2">
          {appel.iban && (
            <Ligne etiquette={t.charges.iban}>
              <span className="flex flex-wrap items-center gap-3">
                <span className="font-mono tabular-nums break-all">{appel.iban}</span>
                <BoutonCopier texte={appel.iban} libelle={t.charges.copierIban} libelleCopie={t.commun.copie} />
              </span>
            </Ligne>
          )}
          {appel.referencePaiement && (
            <Ligne etiquette={t.charges.reference}>
              <span className="flex flex-wrap items-center gap-3">
                <span className="font-mono break-all">{appel.referencePaiement}</span>
                <BoutonCopier texte={appel.referencePaiement} libelle={t.commun.copier} libelleCopie={t.commun.copie} />
              </span>
            </Ligne>
          )}
        </dl>
      )}
      {!appel.iban && <Encadre ton="info" className="mt-3">{t.charges.ibanInconnu}</Encadre>}
      <p className="mt-3 text-sm text-[#4A5E78]">{t.charges.pasDePaiementEnLigne}</p>
    </Carte>
  )
}

function CarteAppel({ appel, t, langue, tl }: { appel: AppelDeCharges; t: TextesCopro; langue: LangueCopro; tl: TextesLocaux }) {
  const periodeComplete = appel.periodeDebut !== '' && appel.periodeFin !== ''
  const debut = dateLongue(appel.periodeDebut, langue)
  const fin = dateLongue(appel.periodeFin, langue)
  const titre = periodeComplete ? remplir(t.charges.chargesDu, { debut, fin }) : (appel.exercice || t.menu.charges)
  const reste = montantExplique(appel.resteAPayer, langue, tl.enVotreFaveur)
  return (
    <Carte>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-base font-bold leading-snug text-[#0D1B2E]">{titre}</h3>
          {periodeComplete && appel.exercice && <p className="mt-0.5 text-sm text-[#4A5E78]">{appel.exercice}</p>}
        </div>
        <Badge ton={TON_STATUT_APPEL[appel.statut]}>{libelleStatutAppel(appel.statut, reste, t)}</Badge>
      </div>
      <p className="mt-3 text-base text-[#1F2D3D]">
        <Montant valeur={euros(appel.montantTotal, langue)} />
        {' · '}{t.charges.regle} : {euros(appel.montantPaye, langue)}
        {' · '}{t.charges.reste} : {reste}
      </p>
      <Deplie titre={t.commun.voirDetail} titreOuvert={t.commun.masquerDetail} className="mt-3">
        <dl>
          {periodeComplete && <Ligne etiquette={tl.periode}>{debut} – {fin}</Ligne>}
          {appel.echeance && <Ligne etiquette={tl.echeance}>{dateLongue(appel.echeance, langue)}</Ligne>}
          {appel.referencePaiement && <Ligne etiquette={t.charges.reference}>{appel.referencePaiement}</Ligne>}
          {appel.iban && <Ligne etiquette={t.charges.iban}>{appel.iban}</Ligne>}
        </dl>
      </Deplie>
    </Carte>
  )
}

type EtatOuverture = 'en_cours' | 'erreur' | 'demo'

function CarteFacture({ facture, etat, onOuvrir, t, langue, tl }: {
  facture: FactureCopro
  etat: EtatOuverture | undefined
  onOuvrir: (id: string) => void
  t: TextesCopro
  langue: LangueCopro
  tl: TextesLocaux
}) {
  const tva = facture.tvaTaux > 0 ? arrondiCentimes(facture.montantTtc - facture.montantHt) : 0
  const enCours = etat === 'en_cours'
  const aRegler = facture.statut === 'a_regler' || facture.statut === 'partiellement_regle'
  const mentions: string[] = []
  if (facture.numero) mentions.push(facture.numero)
  if (facture.emiseLe) mentions.push(remplir(tl.emiseLe, { date: dateLongue(facture.emiseLe, langue) }))
  if (aRegler && facture.echeance) mentions.push(remplir(tl.echeanceLe, { date: dateLongue(facture.echeance, langue) }))
  return (
    <Carte>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <Montant grand valeur={montantExplique(facture.montantTtc, langue, tl.rembourse)} />
          {tva > 0 && <p className="text-sm text-[#4A5E78]">{remplir(t.charges.dontTva, { montant: euros(tva, langue) })}</p>}
        </div>
        <Badge ton={TON_STATUT_FACTURE[facture.statut]}>{libelleStatutFacture(facture.statut, t)}</Badge>
      </div>
      {facture.description && <p className="mt-2 text-base text-[#1F2D3D]">{facture.description}</p>}
      {mentions.length > 0 && (
        <p className="mt-1 text-sm text-[#4A5E78]">
          {mentions.map((m, i) => (
            <span key={m}>{i > 0 && ' · '}<span>{m}</span></span>
          ))}
        </p>
      )}
      {facture.pdfDisponible && (
        <div className="mt-3">
          <Bouton variante="secondaire" icone="ouvrir" onClick={() => onOuvrir(facture.id)} disabled={enCours}>
            {enCours ? t.documents.ouvertureEnCours : t.charges.ouvrirPdf}
          </Bouton>
        </div>
      )}
      {etat === 'demo' && <Encadre ton="info" className="mt-3">{tl.pdfDemo}</Encadre>}
      {etat === 'erreur' && <Encadre ton="erreur" className="mt-3">{t.documents.erreurOuverture}</Encadre>}
    </Carte>
  )
}

function CarteRetard({ retard, t, langue }: { retard: ImpayeCopro; t: TextesCopro; langue: LangueCopro }) {
  const details: string[] = []
  if (retard.depuis) details.push(remplir(t.charges.depuisLe, { date: dateLongue(retard.depuis, langue) }))
  if (retard.nbRelances > 0) details.push(remplir(t.charges.relances, { n: retard.nbRelances }))
  if (retard.derniereRelanceLe) details.push(remplir(t.charges.relanceEnvoyee, { date: dateLongue(retard.derniereRelanceLe, langue) }))
  return (
    <Carte>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-base font-bold text-[#0D1B2E]">{libelleNatureImpaye(retard.nature, t)}</p>
          <Montant valeur={euros(retard.montant, langue)} />
        </div>
        <Badge ton={TON_STATUT_RETARD[retard.statut]}>{t.charges.statutsImpaye[retard.statut]}</Badge>
      </div>
      {details.length > 0 && <p className="mt-2 text-sm text-[#4A5E78]">{majuscule(details.join(' · '))}</p>}
    </Carte>
  )
}

// ── Écran ────────────────────────────────────────────────────────────────────

export default function EcranCharges({ espace, t, langue, jeton, allerA, miseAJourLe }: PropsEcran) {
  const tl = TEXTES_LOCAUX[langue]
  const idAppels = useId()
  const idFactures = useId()
  const idRetards = useId()
  const [ouvertures, setOuvertures] = useState<Record<string, EtatOuverture>>({})

  if (espace.profil.role === 'locataire') {
    return <EtatVide texte={tl.reserveProprietaire} icone="cadenas" />
  }

  const { finances } = espace
  const appels = trierAppels(finances.appels.filter(a => a.statut !== 'annule'))
  const prochain = prochainAppelCharges(finances.appels, miseAJourLe)
  // Sans appel à payer : factures à régler, retards ouverts ou solde débiteur (jamais « aucun appel » à qui doit).
  const du = prochain ? null : sommeDueHorsAppels(finances, miseAJourLe)
  // Moyens de paiement : ceux de l'appel à payer, sinon ceux du dernier appel qui en porte.
  const appelPaiement = prochain?.appel ?? appels.find(a => a.iban !== '' || a.referencePaiement !== '') ?? null
  const phrases = phrasesComprendre(espace, t, langue)

  const ouvrirPdf = async (id: string) => {
    if (!jeton || espace.source === 'demo') {
      setOuvertures(o => ({ ...o, [id]: 'demo' }))
      return
    }
    setOuvertures(o => ({ ...o, [id]: 'en_cours' }))
    try {
      const res = await fetch(avecContexte(`/api/coproprietaire/factures/${encodeURIComponent(id)}/pdf`), {
        headers: { Authorization: `Bearer ${jeton}` }, cache: 'no-store',
      })
      const corps: unknown = res.ok ? await res.json().catch(() => null) : null
      const url = corps !== null && typeof corps === 'object' ? (corps as { url?: unknown }).url : undefined
      if (!res.ok || typeof url !== 'string' || !/^https?:\/\//i.test(url)) throw new Error(`réponse ${res.status}`)
      window.open(url, '_blank', 'noopener')
      setOuvertures(o => {
        const { [id]: _terminee, ...reste } = o
        return reste
      })
    } catch (e) {
      console.warn('[copro] ouverture du PDF de facture impossible', e)
      setOuvertures(o => ({ ...o, [id]: 'erreur' }))
    }
  }

  return (
    <div className="space-y-6">
      {appels.length === 0 && !du ? (
        <EtatVide
          texte={t.charges.aucunAppel}
          icone="charges"
          action={<Bouton variante="principal" icone="question" onClick={() => allerA('question')}>{t.menu.question}</Bouton>}
        />
      ) : (
        <>
          <CarteCeQueVousDevez prochain={prochain} du={du} retards={finances.impayes} t={t} langue={langue} tl={tl} />
          {(prochain || du) && (appelPaiement
            ? <CommentPayer appel={appelPaiement} t={t} />
            : (
              <Carte titre={t.charges.commentPayer}>
                <p className="text-base text-[#4A5E78]">{t.charges.ibanInconnu}</p>
              </Carte>
            ))}
          {appels.length > 0 && (
            <section aria-labelledby={idAppels}>
              <h2 id={idAppels} className="mb-3 text-lg font-bold text-[#0D1B2E]">{t.charges.vosAppels}</h2>
              <div className="space-y-3">
                {appels.map(a => <CarteAppel key={a.id} appel={a} t={t} langue={langue} tl={tl} />)}
              </div>
            </section>
          )}
        </>
      )}

      <section aria-labelledby={idFactures}>
        <h2 id={idFactures} className="mb-3 text-lg font-bold text-[#0D1B2E]">{t.charges.factures}</h2>
        {finances.factures.length === 0 ? (
          <p className="text-base text-[#4A5E78]">{t.charges.aucuneFacture}</p>
        ) : (
          <div className="space-y-3">
            {finances.factures.map(f => (
              <CarteFacture key={f.id} facture={f} etat={ouvertures[f.id]} onOuvrir={id => { void ouvrirPdf(id) }} t={t} langue={langue} tl={tl} />
            ))}
          </div>
        )}
      </section>

      {finances.impayes.length > 0 && (
        <section aria-labelledby={idRetards}>
          <h2 id={idRetards} className="mb-3 text-lg font-bold text-[#0D1B2E]">{t.charges.retardsDePaiement}</h2>
          <div className="space-y-3">
            {finances.impayes.map(r => <CarteRetard key={r.id} retard={r} t={t} langue={langue} />)}
          </div>
        </section>
      )}

      {phrases.length > 0 && (
        <Deplie titre={t.charges.comprendre}>
          <ul className="space-y-2 text-base text-[#1F2D3D]">
            {phrases.map(p => <li key={p}>{p}</li>)}
          </ul>
        </Deplie>
      )}
    </div>
  )
}
