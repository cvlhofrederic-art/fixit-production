'use client'

// ── Formulaire « Signaler un problème » ──────────────────────────────────────
//
// Quatre questions en langage courant : où (mon logement / parties communes + zone), quel type,
// description (10 caractères minimum, compteur), urgence. Bouton désactivé tant que le
// formulaire est incomplet. Envoi par lib/copro-signalement (construireSignalement puis
// envoyerSignalementCopro) ; erreurs persistantes au-dessus du bouton, formulaire intact ;
// confirmation persistante (numéro = 8 premiers caractères de l'identifiant). En démonstration
// (jeton null ou espace.source === 'demo') : aucun appel réseau, la demande est construite
// localement avec le statut « reçue ».

import { useId, useState } from 'react'
import type { DemandeCopro, EspaceCopro, PrioriteIntervention } from '@/lib/coproprietaire/types'
import {
  TYPES_PROBLEME, ZONES_COMMUNES, dateLongue, remplir, type LangueCopro, type TextesCopro,
} from '@/lib/coproprietaire/textes'
import {
  DESCRIPTION_MIN_SIGNALEMENT, construireSignalement, envoyerSignalementCopro, type CodeErreurSignalement,
} from '@/lib/copro-signalement'
import {
  Bouton, Carte, Champ, ChoixCartes, CLASSES_SAISIE, Encadre, type OptionChoix,
} from '@/components/coproprietaire-dashboard/ui'

export interface PropsFormulaireSignalement {
  espace: EspaceCopro
  t: TextesCopro
  langue: LangueCopro
  jeton: string | null
  /** Demande construite localement (identifiant réel renvoyé par la route, ou local en démonstration). */
  onEnvoye: (demande: DemandeCopro) => void
  onVoirDemande: (id: string) => void
  onAutre: () => void
}

type Lieu = 'logement' | 'communes'
type Urgence = 'non' | 'genant' | 'urgent'

/** Libellés propres au formulaire (absents de textes.ts), FR / PT. */
const LIBELLES_LOCAUX: Record<LangueCopro, { bat: string; autreZoneValeur: string; demo: string }> = {
  fr: {
    bat: 'bât.',
    autreZoneValeur: 'Autre',
    demo: 'Démonstration : cette demande est affichée dans votre espace, mais rien n’est envoyé à votre syndic.',
  },
  pt: {
    bat: 'bloco',
    autreZoneValeur: 'Outra',
    demo: 'Demonstração: este pedido é apresentado no seu espaço, mas nada é enviado ao seu administrador.',
  },
}

const MESSAGES_ERREUR: Record<CodeErreurSignalement, 'erreurInvalide' | 'erreurTropDeDemandes' | 'erreurServeur' | 'erreurReseau'> = {
  invalide: 'erreurInvalide',
  trop_de_demandes: 'erreurTropDeDemandes',
  serveur: 'erreurServeur',
  reseau: 'erreurReseau',
}

/** « 4e étage » / « 1er étage » / « 4.º piso » ; étage non numérique rendu tel quel. */
function libelleEtage(etage: string, langue: LangueCopro, t: TextesCopro): string {
  if (!/^\d+$/.test(etage)) return `${t.commun.etage} ${etage}`
  if (langue === 'pt') return `${etage}.º ${t.commun.etage}`
  return `${etage}${etage === '1' ? 'er' : 'e'} ${t.commun.etage}`
}

/** « bât. D, 4e étage, lot 12 » (ou le nom de l'immeuble si rien n'est connu). */
export function lieuDuLogement(espace: EspaceCopro, langue: LangueCopro, t: TextesCopro): string {
  const { profil } = espace
  const parties: string[] = []
  if (profil.batiment) parties.push(`${LIBELLES_LOCAUX[langue].bat} ${profil.batiment}`)
  if (profil.etage) parties.push(libelleEtage(profil.etage, langue, t))
  if (profil.numLot) parties.push(`${t.commun.lot} ${profil.numLot}`)
  return parties.length > 0 ? parties.join(', ') : profil.immeuble
}

function idLocal(prefixe: string): string {
  const alea = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
  return `${prefixe}-${alea}`
}

export default function FormulaireSignalement({ espace, t, langue, jeton, onEnvoye, onVoirDemande, onAutre }: PropsFormulaireSignalement) {
  const local = LIBELLES_LOCAUX[langue]
  const demo = jeton === null || espace.source === 'demo'
  const idBase = useId()
  const idZone = `${idBase}-zone`
  const idType = `${idBase}-type`
  const idDescription = `${idBase}-description`

  const [lieu, setLieu] = useState<Lieu | ''>('')
  const [zone, setZone] = useState('')
  const [type, setType] = useState('')
  const [description, setDescription] = useState('')
  const [urgence, setUrgence] = useState<Urgence | ''>('')
  const [envoi, setEnvoi] = useState(false)
  const [erreur, setErreur] = useState<CodeErreurSignalement | null>(null)
  const [confirmation, setConfirmation] = useState<{ id: string; date: string } | null>(null)

  const longueur = description.trim().length
  const manque = DESCRIPTION_MIN_SIGNALEMENT - longueur
  const complet = lieu !== '' && (lieu === 'logement' || zone !== '') && type !== '' && manque <= 0 && urgence !== ''

  const optionsLieu: OptionChoix<Lieu>[] = [
    { valeur: 'logement', libelle: remplir(t.demandes.dansMonLogement, { lieu: lieuDuLogement(espace, langue, t) }) },
    { valeur: 'communes', libelle: t.demandes.dansPartiesCommunes },
  ]
  const optionsUrgence: OptionChoix<Urgence>[] = [
    { valeur: 'non', libelle: t.demandes.urgenceNon },
    { valeur: 'genant', libelle: t.demandes.urgenceGenant },
    { valeur: 'urgent', libelle: t.demandes.urgenceUrgent },
  ]

  const reinitialiser = () => {
    setLieu('')
    setZone('')
    setType('')
    setDescription('')
    setUrgence('')
    setErreur(null)
    setConfirmation(null)
  }

  const envoyer = async () => {
    if (!complet || envoi) return
    setErreur(null)
    const partieCommune = lieu === 'communes'
    const priorite: PrioriteIntervention = urgence === 'urgent' ? 'urgente' : 'normale'
    const { profil } = espace
    const corps = construireSignalement({
      profile: {
        prenom: profil.prenom, nom: profil.nom, email: profil.email, telephone: profil.telephone,
        immeuble: profil.immeuble, batiment: profil.batiment, etage: profil.etage, numLot: profil.numLot,
      },
      type,
      description,
      priorite,
      partieCommune,
      zone: partieCommune ? zone : '',
    })
    const maintenant = new Date().toISOString()
    const construire = (id: string): DemandeCopro => ({
      id,
      type: corps.typeIntervention,
      description: corps.description,
      priorite,
      statut: 'en_attente',
      partieCommune,
      zone: corps.zoneSignalee ?? '',
      batiment: profil.batiment,
      etage: profil.etage,
      numLot: profil.numLot,
      prestataire: '',
      creeLe: maintenant,
      misAJourLe: maintenant,
      origine: 'portail',
      messages: [],
      intervention: null,
    })

    if (demo) {
      const demande = construire(idLocal('demo-sig'))
      onEnvoye(demande)
      setConfirmation({ id: demande.id, date: maintenant })
      return
    }

    // Fiche affichée (compte à plusieurs lots) : la route rattache le signalement à ce lot, pas au premier.
    if (jeton && espace.source !== 'demo') corps.lot = profil.id
    setEnvoi(true)
    const resultat = await envoyerSignalementCopro(corps, jeton)
    setEnvoi(false)
    if (!resultat.ok) {
      setErreur(resultat.code)
      return
    }
    const demande = construire(resultat.id ?? idLocal('sig'))
    onEnvoye(demande)
    setConfirmation({ id: demande.id, date: maintenant })
  }

  if (confirmation) {
    return (
      <Carte ton="vert" titre={remplir(t.demandes.confirmationTitre, { date: dateLongue(confirmation.date, langue) })}>
        <div className="space-y-2">
          <p className="text-base font-semibold text-[#0D1B2E]">
            {remplir(t.demandes.confirmationNumero, { numero: confirmation.id.replace(/^(demo-)?sig-/, '').slice(0, 8).toUpperCase() })}
          </p>
          <p className="text-base text-[#1F2D3D]">{t.demandes.confirmationSuite}</p>
        </div>
        {demo && <Encadre ton="info" className="mt-4">{local.demo}</Encadre>}
        <div className="mt-5 flex flex-col gap-3 sm:flex-row">
          <Bouton variante="principal" onClick={() => onVoirDemande(confirmation.id)}>{t.demandes.voirMaDemande}</Bouton>
          <Bouton variante="secondaire" onClick={() => { reinitialiser(); onAutre() }}>{t.demandes.autreDemande}</Bouton>
        </div>
      </Carte>
    )
  }

  return (
    <Carte titre={t.demandes.nouvelleDemande}>
      <div className="space-y-6">
        <ChoixCartes nom={`${idBase}-lieu`} legende={t.demandes.ouProbleme} options={optionsLieu} valeur={lieu} onChange={v => { setLieu(v); if (v === 'logement') setZone('') }} />

        {lieu === 'communes' && (
          <Champ id={idZone} etiquette={t.demandes.zone}>
            <select id={idZone} value={zone} onChange={e => setZone(e.target.value)} className={CLASSES_SAISIE}>
              <option value="">{t.demandes.choisirZone}</option>
              {ZONES_COMMUNES[langue].map(z => <option key={z} value={z}>{z}</option>)}
              <option value={local.autreZoneValeur}>{t.demandes.autreZone}</option>
            </select>
          </Champ>
        )}

        <Champ id={idType} etiquette={t.demandes.typeProbleme}>
          <select id={idType} value={type} onChange={e => setType(e.target.value)} className={CLASSES_SAISIE}>
            <option value="">{t.demandes.choisirType}</option>
            {TYPES_PROBLEME[langue].map(tp => <option key={tp} value={tp}>{tp}</option>)}
          </select>
        </Champ>

        <Champ
          id={idDescription}
          etiquette={t.demandes.decrivez}
          aide={longueur > 0 && manque > 0 ? remplir(t.demandes.descriptionEncore, { n: manque }) : t.demandes.descriptionMinimum}
        >
          <textarea
            id={idDescription}
            rows={4}
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder={t.demandes.decrivezPlaceholder}
            aria-describedby={`${idDescription}-aide`}
            maxLength={5000}
            className={`${CLASSES_SAISIE} resize-y`}
          />
        </Champ>

        <ChoixCartes nom={`${idBase}-urgence`} legende={t.demandes.urgent} options={optionsUrgence} valeur={urgence} onChange={setUrgence} />

        {erreur && <Encadre ton="erreur">{t.demandes[MESSAGES_ERREUR[erreur]]}</Encadre>}

        <div className="space-y-2">
          <Bouton variante="principal" icone="envoyer" pleineLargeur disabled={!complet || envoi} onClick={() => { void envoyer() }}>
            {envoi ? t.demandes.envoiEnCours : t.demandes.envoyerAuSyndic}
          </Bouton>
          <p className="text-center text-sm text-[#4A5E78]">{t.demandes.transmisAuSyndic}</p>
        </div>
      </div>
    </Carte>
  )
}
