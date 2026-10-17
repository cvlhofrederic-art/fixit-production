'use client'

// ── Mes demandes : signalements du copropriétaire et travaux de l'immeuble ───
//
// En premier le bouton « Signaler un problème », puis deux onglets : la liste de mes demandes
// (type, statut en mots, frise en quatre étapes, passage prévu) et les travaux dans l'immeuble
// (dépliants : description, dates, coût pour la copropriété, compte rendu, documents).
// `cible` ouvre le formulaire ('nouvelle'), l'onglet travaux ('travaux') ou le détail d'une
// demande (son identifiant). Préférence d'onglet : CLES_PREFERENCES.ongletDemandes.
// En démonstration (jeton null ou espace.source === 'demo'), les demandes et messages créés
// restent dans l'état React, sans appel réseau ; avec un jeton, ils sont affichés localement
// jusqu'au rechargement, puis dédoublonnés avec ce que renvoie le serveur.

import { useId, useState } from 'react'
import type { DemandeCopro, InterventionVue, MessageDemande, StatutIntervention } from '@/lib/coproprietaire/types'
import {
  dateLongue, libelleStatutDemande, libelleStatutTravaux, remplir, type LangueCopro, type TextesCopro,
} from '@/lib/coproprietaire/textes'
import { CLES_PREFERENCES, type PropsEcran } from '@/components/coproprietaire-dashboard/contrat'
import {
  Badge, Bouton, Carte, Deplie, EtatVide, Frise, Icone, type EtapeFrise,
} from '@/components/coproprietaire-dashboard/ui'
import DetailDemande, {
  CompteRenduBloc, DocumentsPrestataireBloc, coutCopropriete, tonStatutDemande,
} from './DetailDemande'
import FormulaireSignalement from './FormulaireSignalement'

type Onglet = 'mes' | 'travaux'
type Vue = { type: 'liste' } | { type: 'nouvelle' } | { type: 'detail'; id: string }

const ONGLETS: Onglet[] = ['mes', 'travaux']

/** Libellés propres à cet écran (absents de textes.ts), FR / PT. */
const LIBELLES_LOCAUX: Record<LangueCopro, {
  avancement: string
  maDemande: string
  prestataireADesigner: string
  retour: string
}> = {
  fr: {
    avancement: 'Avancement de la demande',
    maDemande: 'ma demande',
    prestataireADesigner: 'prestataire à désigner',
    retour: 'Retour à mes demandes',
  },
  pt: {
    avancement: 'Progresso do pedido',
    maDemande: 'o meu pedido',
    prestataireADesigner: 'prestador a designar',
    retour: 'Voltar aos meus pedidos',
  },
}

// ── Préférence d'onglet (localStorage, toujours sous try/catch) ──────────────

function lirePreferenceOnglet(): Onglet {
  try {
    return localStorage.getItem(CLES_PREFERENCES.ongletDemandes) === 'travaux' ? 'travaux' : 'mes'
  } catch {
    return 'mes'
  }
}

function ecrirePreferenceOnglet(onglet: Onglet): void {
  try {
    localStorage.setItem(CLES_PREFERENCES.ongletDemandes, onglet)
  } catch (e) {
    console.warn('[copro] préférence d’onglet non mémorisée', e)
  }
}

// ── Aides ────────────────────────────────────────────────────────────────────

function vueDepuisCible(cible: string | undefined): Vue {
  if (cible === 'nouvelle') return { type: 'nouvelle' }
  if (cible && cible !== 'travaux') return { type: 'detail', id: cible }
  return { type: 'liste' }
}

const RANG_ETAPE: Record<Exclude<StatutIntervention, 'annulee'>, number> = { en_attente: 0, acceptee: 1, en_cours: 2, terminee: 3 }

/** Frise en quatre étapes ; une demande terminée a toutes ses étapes faites. */
export function etapesFrise(statut: Exclude<StatutIntervention, 'annulee'>, t: TextesCopro): EtapeFrise[] {
  const noms = [t.demandes.etapes.recue, t.demandes.etapes.priseEnCharge, t.demandes.etapes.enCours, t.demandes.etapes.terminee]
  const courante = RANG_ETAPE[statut]
  return noms.map((nom, i) => ({
    nom,
    etat: statut === 'terminee' || i < courante ? 'faite' : i === courante ? 'courante' : 'a_venir',
  }))
}

function premiereLigne(texte: string): string {
  return texte.split('\n').map(l => l.trim()).find(l => l !== '') ?? ''
}

/** Même demande vue par le serveur et localement (identifiant, ou même type et description). */
function memeDemande(a: DemandeCopro, b: DemandeCopro): boolean {
  return a.id === b.id || (a.type === b.type && a.description === b.description)
}

function avecMessagesLocaux(demande: DemandeCopro, locaux: MessageDemande[] | undefined): DemandeCopro {
  if (!locaux || locaux.length === 0) return demande
  const nouveaux = locaux.filter(m => !demande.messages.some(s => s.id === m.id || (s.deMoi && s.texte === m.texte)))
  return nouveaux.length === 0 ? demande : { ...demande, messages: [...demande.messages, ...nouveaux] }
}

// ── Cartes ───────────────────────────────────────────────────────────────────

function CarteDemande({ demande, t, langue, label, onOuvrir }: {
  demande: DemandeCopro; t: TextesCopro; langue: LangueCopro; label: string; onOuvrir: () => void
}) {
  const prestataire = demande.prestataire || demande.intervention?.prestataire || ''
  const datePrevue = demande.intervention?.datePrevue || ''
  return (
    <Carte
      titre={demande.type}
      sousTitre={remplir(t.demandes.envoyeeLe, { date: dateLongue(demande.creeLe, langue) })}
      actions={<Badge ton={tonStatutDemande(demande.statut)}>{libelleStatutDemande(demande.statut, prestataire, t)}</Badge>}
    >
      <p className="line-clamp-2 text-base text-[#1F2D3D]">{premiereLigne(demande.description)}</p>
      {demande.statut !== 'annulee' && (
        <div className="mt-4">
          <Frise etapes={etapesFrise(demande.statut, t)} label={label} />
        </div>
      )}
      {datePrevue && (
        <p className="mt-4 flex items-center gap-2 text-base font-bold text-[#0D1B2E]">
          <Icone nom="calendrier" taille={20} />
          <span>{remplir(t.demandes.passagePrevu, { date: dateLongue(datePrevue, langue) })}</span>
        </p>
      )}
      <div className="mt-4">
        <Bouton variante="secondaire" icone="chevron-droite" onClick={onOuvrir}>{t.commun.voirDetail}</Bouton>
      </div>
    </Carte>
  )
}

function CarteTravaux({ intervention: i, t, langue, montantsVisibles, local }: {
  intervention: InterventionVue; t: TextesCopro; langue: LangueCopro; montantsVisibles: boolean
  local: (typeof LIBELLES_LOCAUX)['fr']
}) {
  const lieu = i.zone || (i.batiment ? `${t.commun.batiment} ${i.batiment}` : '')
  const cout = montantsVisibles ? coutCopropriete(i, t, langue) : ''
  return (
    <Carte
      titre={lieu ? `${i.type} — ${lieu}` : i.type}
      actions={i.estLaMienne ? <Badge ton="or">{local.maDemande}</Badge> : undefined}
    >
      <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-base text-[#1F2D3D]">
        <Badge ton={tonStatutDemande(i.statut)}>{libelleStatutTravaux(i.statut, t)}</Badge>
        <span>{remplir(t.charges.depuisLe, { date: dateLongue(i.dateCreation, langue) })}</span>
      </p>
      <p className="mt-2 text-base text-[#1F2D3D]">
        {i.prestataire ? remplir(t.demandes.prestataire, { nom: i.prestataire }) : local.prestataireADesigner}
      </p>
      <Deplie titre={t.commun.voirDetail} titreOuvert={t.commun.masquerDetail} className="mt-4">
        <div className="space-y-4">
          <p className="whitespace-pre-line text-base text-[#1F2D3D]">{i.description}</p>
          {i.datePrevue && (
            <p className="text-base font-bold text-[#0D1B2E]">{remplir(t.demandes.passagePrevu, { date: dateLongue(i.datePrevue, langue) })}</p>
          )}
          {cout && (
            <p className="text-base text-[#1F2D3D]">
              <span className="font-semibold">{t.demandes.coutCopropriete}</span> : {cout}
            </p>
          )}
          {i.compteRendu && (
            <div>
              <h3 className="mb-1 text-base font-bold text-[#0D1B2E]">{t.demandes.compteRendu}</h3>
              <CompteRenduBloc compteRendu={i.compteRendu} t={t} langue={langue} />
            </div>
          )}
          {i.documents.length > 0 && (
            <div>
              <h3 className="mb-1 text-base font-bold text-[#0D1B2E]">{t.demandes.documentsPrestataire}</h3>
              <DocumentsPrestataireBloc documents={i.documents} t={t} langue={langue} montantsVisibles={montantsVisibles} />
            </div>
          )}
        </div>
      </Deplie>
    </Carte>
  )
}

// ── Écran ────────────────────────────────────────────────────────────────────

export default function EcranDemandes(props: PropsEcran) {
  const { espace, t, langue, jeton, cible, rafraichir } = props
  const local = LIBELLES_LOCAUX[langue]
  const demo = jeton === null || espace.source === 'demo'
  const montantsVisibles = espace.profil.role !== 'locataire'
  const idBase = useId()

  const [onglet, setOnglet] = useState<Onglet>(() => (cible === 'travaux' ? 'travaux' : lirePreferenceOnglet()))
  const [vue, setVue] = useState<Vue>(() => vueDepuisCible(cible))
  const [cibleTraitee, setCibleTraitee] = useState(cible)
  const [demandesLocales, setDemandesLocales] = useState<DemandeCopro[]>([])
  const [messagesLocaux, setMessagesLocaux] = useState<Record<string, MessageDemande[]>>({})

  // Nouvelle cible reçue du shell (ex. « Signaler un problème » dans l'en-tête) : on l'applique.
  if (cible !== cibleTraitee) {
    setCibleTraitee(cible)
    setVue(vueDepuisCible(cible))
    if (cible === 'travaux') setOnglet('travaux')
  }

  const serveur = espace.interventions.mesDemandes
  const locales = demandesLocales.filter(l => !serveur.some(s => memeDemande(s, l)))
  const demandes = [...locales, ...serveur].map(d => avecMessagesLocaux(d, messagesLocaux[d.id]))
  const travaux = espace.interventions.immeuble.filter(i => i.statut !== 'annulee')
  const demandeOuverte = vue.type === 'detail' ? demandes.find(d => d.id === vue.id) : undefined

  const ouvrirFormulaire = () => setVue({ type: 'nouvelle' })
  const retourListe = () => setVue({ type: 'liste' })
  const choisirOnglet = (o: Onglet) => {
    setOnglet(o)
    ecrirePreferenceOnglet(o)
  }
  const ajouterDemande = (demande: DemandeCopro) => setDemandesLocales(prev => [demande, ...prev])
  const ajouterMessage = (idDemande: string, message: MessageDemande) =>
    setMessagesLocaux(prev => ({ ...prev, [idDemande]: [...(prev[idDemande] ?? []), message] }))
  const voirDemande = async (id: string) => {
    if (!demo) {
      try {
        await rafraichir()
      } catch (e) {
        console.warn('[copro] rafraîchissement après signalement impossible', e)
      }
    }
    setVue({ type: 'detail', id })
  }

  if (vue.type === 'nouvelle') {
    return (
      <div className="space-y-4">
        <Bouton variante="discret" icone="retour" onClick={retourListe}>{local.retour}</Bouton>
        <FormulaireSignalement
          espace={espace}
          t={t}
          langue={langue}
          jeton={jeton}
          onEnvoye={ajouterDemande}
          onVoirDemande={id => { void voirDemande(id) }}
          onAutre={ouvrirFormulaire}
        />
      </div>
    )
  }

  if (demandeOuverte) {
    return (
      <DetailDemande
        demande={demandeOuverte}
        espace={espace}
        t={t}
        langue={langue}
        jeton={jeton}
        onRetour={retourListe}
        rafraichir={rafraichir}
        onMessageAjoute={ajouterMessage}
      />
    )
  }

  const boutonSignaler = (
    <Bouton variante="principal" icone="demandes" pleineLargeur onClick={ouvrirFormulaire}>{t.demandes.nouvelleDemande}</Bouton>
  )

  return (
    <div className="space-y-4">
      {boutonSignaler}

      <div role="tablist" aria-label={t.menu.demandes} className="flex gap-1 rounded-xl border border-[#E4DDD0] bg-white p-1">
        {ONGLETS.map(o => (
          <button
            key={o}
            type="button"
            role="tab"
            id={`${idBase}-onglet-${o}`}
            aria-selected={onglet === o}
            aria-controls={`${idBase}-panneau-${o}`}
            onClick={() => choisirOnglet(o)}
            className={`min-h-[44px] flex-1 rounded-lg px-3 text-base font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#C9A84C] ${
              onglet === o ? 'bg-[#0D1B2E] text-white' : 'text-[#0D1B2E] hover:bg-[#F7F4EE]'
            }`}
          >
            {o === 'mes' ? t.demandes.ongletMesDemandes : t.demandes.ongletTravaux}
          </button>
        ))}
      </div>

      {onglet === 'mes' ? (
        <div role="tabpanel" id={`${idBase}-panneau-mes`} aria-labelledby={`${idBase}-onglet-mes`}>
          {demandes.length === 0 ? (
            <EtatVide icone="demandes" texte={t.demandes.aucuneDemande} action={<Bouton variante="principal" onClick={ouvrirFormulaire}>{t.commun.signalerProbleme}</Bouton>} />
          ) : (
            <ul className="space-y-4">
              {demandes.map(d => (
                <li key={d.id}>
                  <CarteDemande demande={d} t={t} langue={langue} label={local.avancement} onOuvrir={() => setVue({ type: 'detail', id: d.id })} />
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : (
        <div role="tabpanel" id={`${idBase}-panneau-travaux`} aria-labelledby={`${idBase}-onglet-travaux`}>
          {travaux.length === 0 ? (
            <EtatVide icone="outil" texte={t.demandes.aucunTravaux} />
          ) : (
            <ul className="space-y-4">
              {travaux.map(i => (
                <li key={i.id}>
                  <CarteTravaux intervention={i} t={t} langue={langue} montantsVisibles={montantsVisibles} local={local} />
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
