'use client'

// ── Détail d'une demande du copropriétaire ───────────────────────────────────
//
// Statut en mots, prestataire désigné (jamais ses coordonnées : on passe par le syndic),
// passage prévu, description, localisation, fil d'échanges en bulles et envoi d'un message
// au syndic (POST /api/coproprietaire/signalement/message puis rafraîchissement). Si une
// mission est liée : compte rendu, coût pour la copropriété (propriétaire seulement) et
// documents du prestataire. En démonstration, le message est ajouté localement.
//
// Les blocs « compte rendu », « coût » et « documents » sont exportés pour l'onglet
// « Travaux dans l'immeuble » d'EcranDemandes.

import { useId, useState } from 'react'
import type {
  CompteRenduIntervention, DemandeCopro, DocumentPrestataireVue, EspaceCopro, InterventionVue,
  MessageDemande, StatutIntervention,
} from '@/lib/coproprietaire/types'
import {
  dateHeure, dateLongue, euros, libelleStatutDemande, remplir, type LangueCopro, type TextesCopro,
} from '@/lib/coproprietaire/textes'
import { envoyerMessageDemande } from '@/lib/coproprietaire/api'
import {
  Badge, Bouton, Carte, Champ, CLASSES_SAISIE, Encadre, Icone, Ligne, type TonBadge,
} from '@/components/coproprietaire-dashboard/ui'

/** Libellés propres à ce détail (absents de textes.ts), FR / PT. */
const LIBELLES_LOCAUX: Record<LangueCopro, {
  retour: string
  joindrePrestataire: string
  demo: string
  aucunMessage: string
  dateRapport: string
}> = {
  fr: {
    retour: 'Retour à mes demandes',
    joindrePrestataire: 'Pour joindre le prestataire, passez par votre syndic : ses coordonnées ne sont pas communiquées ici.',
    demo: 'Démonstration : votre message est affiché ici, mais rien n’est envoyé à votre syndic.',
    aucunMessage: 'Aucun échange pour le moment. Vous pouvez écrire à votre syndic ci-dessous.',
    dateRapport: 'Date du compte rendu',
  },
  pt: {
    retour: 'Voltar aos meus pedidos',
    joindrePrestataire: 'Para contactar o prestador, fale com o seu administrador: os contactos dele não são comunicados aqui.',
    demo: 'Demonstração: a sua mensagem é apresentada aqui, mas nada é enviado ao seu administrador.',
    aucunMessage: 'Nenhuma conversa de momento. Pode escrever ao seu administrador abaixo.',
    dateRapport: 'Data do relatório',
  },
}

// ── Aides partagées avec EcranDemandes ───────────────────────────────────────

const TONS_STATUT: Record<StatutIntervention, TonBadge> = {
  en_attente: 'bleu', acceptee: 'or', en_cours: 'ambre', terminee: 'vert', annulee: 'gris',
}

/** Couleur du badge de statut (demandes et travaux). */
export function tonStatutDemande(statut: StatutIntervention): TonBadge {
  return TONS_STATUT[statut]
}

/** « 420 € TTC (devis) · facturé 420 € » ; chaîne vide si aucun montant n'est connu. */
export function coutCopropriete(i: InterventionVue, t: TextesCopro, langue: LangueCopro): string {
  const parties: string[] = []
  if (i.montantDevis !== null) parties.push(`${euros(i.montantDevis, langue)} ${t.commun.ttc} (${t.demandes.devis})`)
  if (i.montantFacture !== null) parties.push(`${t.demandes.facture} ${euros(i.montantFacture, langue)}`)
  return parties.join(' · ')
}

/** Identifiant local (démonstration, ou route sans identifiant). */
export function idLocal(prefixe: string): string {
  const alea = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
  return `${prefixe}-${alea}`
}

/** Lignes du compte rendu (champs vides omis), à placer sous un titre fourni par l'appelant. */
export function CompteRenduBloc({ compteRendu, t, langue }: { compteRendu: CompteRenduIntervention; t: TextesCopro; langue: LangueCopro }) {
  const lignes: Array<[string, string]> = [
    [t.demandes.travailEffectue, compteRendu.travailEffectue],
    [t.demandes.materiaux, compteRendu.materiauxUtilises],
    [t.demandes.problemes, compteRendu.problemesConstates],
    [t.demandes.recommandations, compteRendu.recommandations],
    [t.demandes.duree, compteRendu.dureeIntervention],
    [LIBELLES_LOCAUX[langue].dateRapport, dateLongue(compteRendu.dateRapport, langue)],
  ]
  return (
    <dl>
      {lignes.filter(([, valeur]) => valeur.trim() !== '').map(([etiquette, valeur]) => (
        <Ligne key={etiquette} etiquette={etiquette}>
          <span className="whitespace-pre-line">{valeur}</span>
        </Ligne>
      ))}
    </dl>
  )
}

/** Documents du prestataire : type en mots, référence, montant (si visible), date, description. */
export function DocumentsPrestataireBloc({ documents, t, langue, montantsVisibles }: {
  documents: DocumentPrestataireVue[]; t: TextesCopro; langue: LangueCopro; montantsVisibles: boolean
}) {
  return (
    <ul className="divide-y divide-[#E4DDD0]">
      {documents.map((d, i) => {
        const details = [
          montantsVisibles && d.montantTtc !== null ? `${euros(d.montantTtc, langue)} ${t.commun.ttc}` : '',
          dateLongue(d.date, langue),
        ].filter(Boolean)
        return (
          <li key={`${i}-${d.type}-${d.reference}-${d.date}`} className="flex items-start gap-3 py-3">
            <Icone nom="documents" taille={22} className="mt-0.5 text-[#4A5E78]" />
            <div className="min-w-0">
              <p className="text-base font-semibold text-[#0D1B2E]">
                {t.demandes.typesDocument[d.type]}{d.reference ? ` — ${d.reference}` : ''}
              </p>
              {details.length > 0 && <p className="text-sm text-[#4A5E78]">{details.join(' · ')}</p>}
              {d.description && <p className="text-base text-[#1F2D3D]">{d.description}</p>}
            </div>
          </li>
        )
      })}
    </ul>
  )
}

// ── Détail ───────────────────────────────────────────────────────────────────

export interface PropsDetailDemande {
  demande: DemandeCopro
  espace: EspaceCopro
  t: TextesCopro
  langue: LangueCopro
  jeton: string | null
  onRetour: () => void
  rafraichir: () => Promise<void>
  /** Message ajouté localement (démonstration, ou en attendant le rechargement). */
  onMessageAjoute: (idDemande: string, message: MessageDemande) => void
}

type EtatEnvoi = 'repos' | 'succes' | 'erreur' | 'demo'

export default function DetailDemande({ demande, espace, t, langue, jeton, onRetour, rafraichir, onMessageAjoute }: PropsDetailDemande) {
  const local = LIBELLES_LOCAUX[langue]
  const demo = jeton === null || espace.source === 'demo'
  const montantsVisibles = espace.profil.role !== 'locataire'
  const idChamp = useId()
  const [texte, setTexte] = useState('')
  const [envoi, setEnvoi] = useState(false)
  const [etat, setEtat] = useState<EtatEnvoi>('repos')

  const intervention = demande.intervention
  const prestataire = demande.prestataire || intervention?.prestataire || ''
  const datePrevue = intervention?.datePrevue || ''
  const localisation = demande.partieCommune
    ? `${t.demandes.partiesCommunes}${demande.zone ? ` — ${demande.zone}` : ''}`
    : t.demandes.monLogement
  const cout = intervention && montantsVisibles ? coutCopropriete(intervention, t, langue) : ''
  const nomSyndic = espace.syndic.nom ? `${t.demandes.syndic} · ${espace.syndic.nom}` : t.demandes.syndic

  const envoyer = async () => {
    const propre = texte.trim()
    if (!propre || envoi) return
    const auteur = `${espace.profil.prenom} ${espace.profil.nom}`.trim()
    if (demo || !jeton) {
      onMessageAjoute(demande.id, { id: idLocal('demo-msg'), auteur, role: 'coproprio', texte: propre, date: new Date().toISOString(), deMoi: true })
      setTexte('')
      setEtat('demo')
      return
    }
    setEnvoi(true)
    setEtat('repos')
    const resultat = await envoyerMessageDemande(jeton, demande.id, propre)
    setEnvoi(false)
    if (!resultat.ok) {
      setEtat('erreur')
      return
    }
    onMessageAjoute(demande.id, { id: resultat.id || idLocal('msg'), auteur, role: 'coproprio', texte: propre, date: resultat.date, deMoi: true })
    setTexte('')
    setEtat('succes')
    try {
      await rafraichir()
    } catch (e) {
      console.warn('[copro] rafraîchissement après message impossible', e)
    }
  }

  return (
    <div className="space-y-4">
      <Bouton variante="discret" icone="retour" onClick={onRetour}>{local.retour}</Bouton>

      <Carte
        titre={demande.type}
        sousTitre={remplir(t.demandes.envoyeeLe, { date: dateLongue(demande.creeLe, langue) })}
        actions={<Badge ton={tonStatutDemande(demande.statut)}>{libelleStatutDemande(demande.statut, prestataire, t)}</Badge>}
      >
        {prestataire && (
          <div className="mb-3">
            <p className="text-base font-semibold text-[#0D1B2E]">{remplir(t.demandes.prestataire, { nom: prestataire })}</p>
            <p className="text-sm text-[#4A5E78]">{local.joindrePrestataire}</p>
          </div>
        )}
        {datePrevue && (
          <p className="mb-3 flex items-center gap-2 text-base font-bold text-[#0D1B2E]">
            <Icone nom="calendrier" taille={20} />
            <span>{remplir(t.demandes.passagePrevu, { date: dateLongue(datePrevue, langue) })}</span>
          </p>
        )}
        <p className="whitespace-pre-line text-base text-[#1F2D3D]">{demande.description}</p>
        <p className="mt-3 flex items-center gap-2 text-base text-[#4A5E78]">
          <Icone nom="adresse" taille={20} />
          <span>{localisation}</span>
        </p>
        {demande.origine === 'public' && <p className="mt-3 text-sm text-[#4A5E78]">{t.demandes.deposeeSansCompte}</p>}
      </Carte>

      <Carte titre={t.demandes.fil}>
        {demande.messages.length === 0 ? (
          <p className="text-base text-[#4A5E78]">{local.aucunMessage}</p>
        ) : (
          <ol aria-label={t.demandes.fil} className="space-y-3">
            {demande.messages.map(m => (
              <li key={m.id} className={`flex ${m.deMoi ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] rounded-2xl px-4 py-3 ${m.deMoi ? 'bg-[#0D1B2E] text-white' : 'bg-[#F7F4EE] text-[#0D1B2E]'}`}>
                  <p className={`text-sm font-semibold ${m.deMoi ? 'text-[#E4DDD0]' : 'text-[#4A5E78]'}`}>{m.deMoi ? t.demandes.vous : nomSyndic}</p>
                  <p className="whitespace-pre-line text-base">{m.texte}</p>
                  <p className={`mt-1 text-sm ${m.deMoi ? 'text-[#E4DDD0]' : 'text-[#4A5E78]'}`}>{dateHeure(m.date, langue)}</p>
                </div>
              </li>
            ))}
          </ol>
        )}

        <div className="mt-5 space-y-3">
          <Champ id={idChamp} etiquette={t.demandes.ecrireAuSyndic}>
            <textarea
              id={idChamp}
              rows={3}
              value={texte}
              onChange={e => setTexte(e.target.value)}
              placeholder={t.demandes.messagePlaceholder}
              maxLength={5000}
              disabled={envoi}
              className={`${CLASSES_SAISIE} resize-y`}
            />
          </Champ>
          {etat === 'succes' && <Encadre ton="succes">{t.demandes.messageEnvoye}</Encadre>}
          {etat === 'erreur' && <Encadre ton="erreur">{t.demandes.messageErreur}</Encadre>}
          {etat === 'demo' && <Encadre ton="info">{local.demo}</Encadre>}
          <Bouton variante="principal" icone="envoyer" onClick={() => { void envoyer() }} disabled={texte.trim() === '' || envoi}>
            {envoi ? t.demandes.envoiEnCours : t.commun.envoyer}
          </Bouton>
        </div>
      </Carte>

      {intervention?.compteRendu && (
        <Carte titre={t.demandes.compteRendu}>
          <CompteRenduBloc compteRendu={intervention.compteRendu} t={t} langue={langue} />
        </Carte>
      )}

      {cout && (
        <Carte titre={t.demandes.coutCopropriete}>
          <p className="text-xl font-bold tabular-nums text-[#0D1B2E]">{cout}</p>
        </Carte>
      )}

      {intervention && intervention.documents.length > 0 && (
        <Carte titre={t.demandes.documentsPrestataire}>
          <DocumentsPrestataireBloc documents={intervention.documents} t={t} langue={langue} montantsVisibles={montantsVisibles} />
        </Carte>
      )}
    </div>
  )
}
