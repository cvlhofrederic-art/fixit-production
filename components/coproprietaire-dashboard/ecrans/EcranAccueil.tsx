'use client'

// ── Accueil du portail copropriétaire ─────────────────────────────────────────
//
// Ce qui compte d'abord : bonjour, « ce que je dois » (propriétaire), signaler un problème,
// mes demandes en cours ; puis la prochaine assemblée (propriétaire), les travaux de
// l'immeuble et les dernières annonces. Tout vient de `espace` ; rien n'est écrit ici.
// `prochainAppel` est pur et réutilisé par l'écran Charges & paiements.

import type { ReactNode } from 'react'
import type { PropsEcran } from '@/components/coproprietaire-dashboard/contrat'
import { Badge, Bouton, Carte, EtatVide, Icone, Montant, type NomIcone, type TonBadge, type TonCarte } from '@/components/coproprietaire-dashboard/ui'
import { dateLimiteVote, voteOuvert } from '@/lib/coproprietaire/api'
import {
  dateHeure, dateLongue, euros, libelleStatutDemande, libelleStatutTravaux, remplir, type LangueCopro,
} from '@/lib/coproprietaire/textes'
import type {
  AnnonceCopro, AppelDeCharges, AssembleeCopro, DemandeCopro, InterventionVue, StatutIntervention,
} from '@/lib/coproprietaire/types'
import { sommeDueHorsAppels } from '@/lib/coproprietaire/filtrage'

// ── Textes propres à cet écran (absents de textes.ts) ─────────────────────────

const TEXTES_LOCAUX: Record<LangueCopro, { prestataireADesigner: string; toutVote: string; enRetardSansDate: string }> = {
  fr: {
    prestataireADesigner: 'prestataire à désigner',
    toutVote: 'Vous avez voté sur toutes les résolutions.',
    enRetardSansDate: 'En retard : {montant}',
  },
  pt: {
    prestataireADesigner: 'prestador a designar',
    toutVote: 'Já votou em todas as deliberações.',
    enRetardSansDate: 'Em atraso: {montant}',
  },
}

// ── Calculs purs ──────────────────────────────────────────────────────────────

/** Date d'échéance lue en local (AAAA-MM-JJ à midi, ou horodatage ISO complet) ; null si absente ou illisible. */
function dateEcheance(iso: string): Date | null {
  if (!iso) return null
  const d = new Date(/^\d{4}-\d{2}-\d{2}$/.test(iso) ? `${iso}T12:00:00` : iso)
  return Number.isNaN(d.getTime()) ? null : d
}

/** Jour civil local « AAAA-MM-JJ », pour comparer des dates sans tenir compte de l'heure. */
function jourLocal(d: Date): string {
  const deux = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${deux(d.getMonth() + 1)}-${deux(d.getDate())}`
}

/**
 * Prochain appel de charges à régler : non annulé, reste à payer > 0, échéance la plus proche
 * d'abord (les appels sans échéance en dernier). `enRetard` si le syndic l'a marqué en retard
 * ou si l'échéance est antérieure au jour d'`aujourdhui` (le jour même n'est pas en retard).
 */
export function prochainAppel(appels: AppelDeCharges[], aujourdhui: Date): { appel: AppelDeCharges; enRetard: boolean } | null {
  const candidats = appels
    .filter(a => a.statut !== 'annule' && a.resteAPayer > 0)
    .map(a => ({ appel: a, date: dateEcheance(a.echeance) }))
    .sort((x, y) => {
      if (x.date === null && y.date === null) return 0
      if (x.date === null) return 1
      if (y.date === null) return -1
      return x.date.getTime() - y.date.getTime()
    })
  const premier = candidats[0]
  if (!premier) return null
  const echeancePassee = premier.date !== null && jourLocal(premier.date) < jourLocal(aujourdhui)
  return { appel: premier.appel, enRetard: premier.appel.statut === 'en_retard' || echeancePassee }
}

const STATUTS_EN_COURS: ReadonlySet<StatutIntervention> = new Set(['en_attente', 'acceptee', 'en_cours'])

/** Mes demandes encore ouvertes, les plus récentes d'abord. */
function demandesEnCours(demandes: DemandeCopro[]): DemandeCopro[] {
  return demandes
    .filter(d => STATUTS_EN_COURS.has(d.statut))
    .slice()
    .sort((a, b) => (b.creeLe || '').localeCompare(a.creeLe || ''))
}

/** Missions de l'immeuble en cours (prestataire désigné ou intervention commencée). */
function travauxEnCours(missions: InterventionVue[]): InterventionVue[] {
  return missions.filter(m => m.statut === 'acceptee' || m.statut === 'en_cours')
}

/** Assemblée convoquée la plus proche, ou null. */
function prochaineAssemblee(assemblees: AssembleeCopro[]): AssembleeCopro | null {
  const convoquees = assemblees
    .filter(a => a.statut === 'convoquee')
    .slice()
    .sort((a, b) => (a.date || '').localeCompare(b.date || ''))
  return convoquees[0] ?? null
}

/** Annonces épinglées d'abord, puis les plus récentes. */
function dernieresAnnonces(annonces: AnnonceCopro[], n: number): AnnonceCopro[] {
  return annonces
    .slice()
    .sort((a, b) => {
      if (a.epinglee !== b.epinglee) return a.epinglee ? -1 : 1
      return (b.date || '').localeCompare(a.date || '')
    })
    .slice(0, n)
}

const TON_STATUT_DEMANDE: Record<StatutIntervention, TonBadge> = {
  en_attente: 'bleu', acceptee: 'or', en_cours: 'ambre', terminee: 'vert', annulee: 'gris',
}

function majuscule(texte: string): string {
  return texte ? texte.charAt(0).toUpperCase() + texte.slice(1) : texte
}

// ── Carte « ce que je dois » ──────────────────────────────────────────────────

/** Phrase dont le {montant} est mis en gros et en gras, le reste en texte courant. */
function PhraseMontant({ modele, montant, valeurs }: { modele: string; montant: string; valeurs: Record<string, string> }) {
  const [avant, apres = ''] = modele.split('{montant}')
  return (
    <p className="text-base leading-relaxed text-[#0D1B2E]">
      {remplir(avant, valeurs)}
      <Montant valeur={montant} grand />
      {remplir(apres, valeurs)}
    </p>
  )
}

function CarteFinances({ espace, t, langue, aujourdhui, allerA }: Pick<PropsEcran, 'espace' | 't' | 'langue' | 'allerA'> & { aujourdhui: Date }) {
  const appels = espace.finances.appels
  const prochain = prochainAppel(appels, aujourdhui)
  const aDesAppels = appels.some(a => a.statut !== 'annule')
  // Sans appel à payer : factures à régler, retards ouverts ou solde débiteur (jamais « aucun appel » à qui doit).
  const du = prochain ? null : sommeDueHorsAppels(espace.finances, aujourdhui)

  let ton: TonCarte
  let icone: NomIcone
  let contenu: ReactNode
  if (prochain) {
    const { appel, enRetard } = prochain
    const montant = euros(appel.resteAPayer, langue)
    const date = dateLongue(appel.echeance, langue)
    if (enRetard) {
      ton = 'rouge'
      icone = 'alerte'
      contenu = date
        ? <PhraseMontant modele={t.accueil.enRetard} montant={montant} valeurs={{ date }} />
        : <PhraseMontant modele={TEXTES_LOCAUX[langue].enRetardSansDate} montant={montant} valeurs={{}} />
    } else {
      ton = 'or'
      icone = 'euro'
      contenu = date
        ? <PhraseMontant modele={t.accueil.aRegler} montant={montant} valeurs={{ date }} />
        : <PhraseMontant modele={t.charges.aRegler} montant={montant} valeurs={{}} />
    }
  } else if (du) {
    const montant = euros(du.montant, langue)
    const date = dateLongue(du.date, langue)
    if (du.enRetard) {
      ton = 'rouge'
      icone = 'alerte'
      contenu = date
        ? <PhraseMontant modele={t.accueil.enRetard} montant={montant} valeurs={{ date }} />
        : <PhraseMontant modele={TEXTES_LOCAUX[langue].enRetardSansDate} montant={montant} valeurs={{}} />
    } else {
      ton = 'or'
      icone = 'euro'
      contenu = du.source === 'solde'
        ? <PhraseMontant modele={t.charges.soldeDu} montant={montant} valeurs={{}} />
        : date
          ? <PhraseMontant modele={t.accueil.aRegler} montant={montant} valeurs={{ date }} />
          : <PhraseMontant modele={t.charges.aRegler} montant={montant} valeurs={{}} />
    }
  } else if (aDesAppels) {
    ton = 'vert'
    icone = 'check'
    contenu = <p className="text-xl font-bold text-[#0D1B2E]">{t.accueil.aJour}</p>
  } else {
    ton = 'gris'
    icone = 'info'
    contenu = <p className="text-base text-[#4A5E78]">{t.accueil.aucunAppel}</p>
  }

  return (
    <Carte ton={ton} titre={t.charges.ceQueVousDevez}>
      <div className="flex items-start gap-3">
        <Icone nom={icone} taille={26} className="mt-1 text-[#0D1B2E]" />
        <div className="min-w-0 flex-1">{contenu}</div>
      </div>
      {(aDesAppels || du) && (
        <div className="mt-4">
          <Bouton variante="secondaire" icone="charges" onClick={() => allerA('charges')}>{t.accueil.voirCommentPayer}</Bouton>
        </div>
      )}
    </Carte>
  )
}

// ── Prochaine assemblée ───────────────────────────────────────────────────────

function CarteAssemblee({ ag, t, langue, aujourdhui, allerA }: Pick<PropsEcran, 't' | 'langue' | 'allerA'> & { ag: AssembleeCopro; aujourdhui: Date }) {
  const total = ag.resolutions.length
  const enAttente = ag.resolutions.filter(r => r.monVote === null).length
  const ouvert = voteOuvert(ag.date, aujourdhui)
  const limite = dateLimiteVote(ag.date)
  const dateLimite = limite ? dateLongue(limite.toISOString(), langue) : ''

  return (
    <Carte ton="or" titre={t.accueil.prochaineAssemblee} sousTitre={ag.titre}>
      <div className="flex items-start gap-3">
        <Icone nom="calendrier" taille={24} className="mt-0.5 text-[#0D1B2E]" />
        <div className="min-w-0 flex-1">
          <p className="text-base font-bold text-[#0D1B2E]">{dateHeure(ag.date, langue)}</p>
          {ag.lieu && <p className="mt-1 text-base text-[#4A5E78]">{ag.lieu}</p>}
        </div>
      </div>
      {total > 0 && (
        <p className="mt-4 text-base text-[#0D1B2E]">
          {enAttente > 0 ? remplir(t.accueil.resolutionsAttendent, { n: enAttente, total }) : TEXTES_LOCAUX[langue].toutVote}
        </p>
      )}
      {!ouvert && dateLimite && <p className="mt-2 text-sm text-[#4A5E78]">{remplir(t.assemblees.voteClos, { date: dateLimite })}</p>}
      <div className="mt-4">
        {ouvert && total > 0
          ? <Bouton variante="or" icone="assemblees" onClick={() => allerA('assemblees')}>{t.accueil.voter}</Bouton>
          : <Bouton variante="secondaire" icone="chevron-droite" onClick={() => allerA('assemblees')}>{t.commun.voirDetail}</Bouton>}
      </div>
    </Carte>
  )
}

// ── Écran ─────────────────────────────────────────────────────────────────────

/** Accueil ; `aujourdhui` permet de figer la date du jour (tests), sinon c'est maintenant. */
export default function EcranAccueil(props: PropsEcran & { aujourdhui?: Date }) {
  const { espace, t, langue, allerA } = props
  const aujourdhui = props.aujourdhui ?? new Date()
  const { profil } = espace
  const locataire = profil.role === 'locataire'

  const ouAppartenance = [
    profil.immeuble,
    profil.batiment ? `${t.commun.batiment} ${profil.batiment}` : '',
    profil.numLot ? `${t.commun.lot} ${profil.numLot}` : '',
  ].filter(Boolean).join(' · ')

  const demandes = demandesEnCours(espace.interventions.mesDemandes)
  const travaux = travauxEnCours(espace.interventions.immeuble)
  const ag = locataire ? null : prochaineAssemblee(espace.assemblees)
  const annonces = dernieresAnnonces(espace.annonces, 2)

  return (
    <div className="space-y-5">
      <div>
        <p className="text-2xl font-bold text-[#0D1B2E] md:text-3xl">{t.commun.bonjour} {profil.prenom || profil.nom}</p>
        {ouAppartenance && <p className="mt-1 text-base text-[#4A5E78]">{ouAppartenance}</p>}
      </div>

      {!locataire && <CarteFinances espace={espace} t={t} langue={langue} aujourdhui={aujourdhui} allerA={allerA} />}

      <Bouton variante="principal" pleineLargeur icone="demandes" onClick={() => allerA('demandes', 'nouvelle')}>
        {t.commun.signalerProbleme}
      </Bouton>

      <Carte titre={`${t.accueil.demandesEnCours} (${demandes.length})`}>
        {demandes.length === 0 ? (
          <EtatVide texte={t.accueil.aucuneDemande} icone="demandes" />
        ) : (
          <ul className="space-y-3">
            {demandes.slice(0, 2).map(d => (
              <li key={d.id}>
                <button
                  type="button"
                  onClick={() => allerA('demandes', d.id)}
                  className="w-full min-h-[44px] rounded-xl border border-[#E4DDD0] bg-white px-4 py-3 text-left transition-colors hover:bg-[#F7F4EE] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#C9A84C]"
                >
                  <span className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-base font-bold text-[#0D1B2E]">{d.type}</span>
                    <Badge ton={TON_STATUT_DEMANDE[d.statut]}>{libelleStatutDemande(d.statut, d.prestataire, t)}</Badge>
                  </span>
                  {d.creeLe && (
                    <span className="mt-1 block text-sm text-[#4A5E78]">{majuscule(remplir(t.demandes.envoyeeLe, { date: dateLongue(d.creeLe, langue) }))}</span>
                  )}
                  <span className="mt-2 inline-flex items-center gap-1 text-base font-semibold text-[#0D1B2E] underline underline-offset-4">
                    {t.commun.voirDetail}
                    <Icone nom="chevron-droite" taille={18} />
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
        {espace.interventions.mesDemandes.length > 0 && (
          <div className="mt-4">
            <Bouton variante="secondaire" pleineLargeur icone="chevron-droite" onClick={() => allerA('demandes')}>{t.accueil.voirToutesDemandes}</Bouton>
          </div>
        )}
      </Carte>

      {ag && <CarteAssemblee ag={ag} t={t} langue={langue} aujourdhui={aujourdhui} allerA={allerA} />}

      <Carte titre={`${t.accueil.travauxEnCours} (${travaux.length})`}>
        {travaux.length === 0 ? (
          <EtatVide texte={t.accueil.aucunTravaux} icone="outil" />
        ) : (
          <>
            <ul className="divide-y divide-[#E4DDD0]">
              {travaux.slice(0, 3).map(m => {
                const lieu = m.zone || (m.batiment ? `${t.commun.batiment} ${m.batiment}` : '')
                return (
                  <li key={m.id} className="py-3 first:pt-0 last:pb-0">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-base font-bold text-[#0D1B2E]">{m.type}{lieu ? ` — ${lieu}` : ''}</p>
                      <Badge ton={m.statut === 'en_cours' ? 'ambre' : 'or'}>{libelleStatutTravaux(m.statut, t)}</Badge>
                    </div>
                    <p className="mt-1 text-sm text-[#4A5E78]">{m.prestataire || TEXTES_LOCAUX[langue].prestataireADesigner}</p>
                  </li>
                )
              })}
            </ul>
            <div className="mt-4">
              <Bouton variante="secondaire" pleineLargeur icone="chevron-droite" onClick={() => allerA('demandes', 'travaux')}>{t.commun.voirTout}</Bouton>
            </div>
          </>
        )}
      </Carte>

      <Carte titre={t.accueil.dernieresAnnonces}>
        {annonces.length === 0 ? (
          <EtatVide texte={t.accueil.aucuneAnnonce} icone="annonces" />
        ) : (
          <>
            <ul className="divide-y divide-[#E4DDD0]">
              {annonces.map(a => (
                <li key={a.id} className="py-3 first:pt-0 last:pb-0">
                  <div className="flex flex-wrap items-center gap-2">
                    {a.priorite === 'urgente' && <Badge ton="rouge">{t.annonces.urgent}</Badge>}
                    {a.priorite === 'importante' && <Badge ton="ambre">{t.annonces.important}</Badge>}
                    <p className="text-base font-bold text-[#0D1B2E]">{a.titre}</p>
                  </div>
                  {a.date && <p className="mt-1 text-sm text-[#4A5E78]">{dateLongue(a.date, langue)}</p>}
                </li>
              ))}
            </ul>
            <div className="mt-4">
              <Bouton variante="secondaire" pleineLargeur icone="chevron-droite" onClick={() => allerA('annonces')}>{t.commun.voirTout}</Bouton>
            </div>
          </>
        )}
      </Carte>
    </div>
  )
}
