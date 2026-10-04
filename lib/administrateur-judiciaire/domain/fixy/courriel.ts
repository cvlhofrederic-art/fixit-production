import { dateIsoVersFr } from '@/lib/administrateur-judiciaire/domain/dates'
import type { Fiche360Copropriete } from '@/lib/administrateur-judiciaire/domain/fiche-360'
import type { ActionNaviguerFixy, AgentFixy } from '@/lib/administrateur-judiciaire/domain/fixy/agents'
import { MOTS_IGNORES_ENTITE } from '@/lib/administrateur-judiciaire/domain/fixy/intentions'
import { formatEurosCourrielFixy } from '@/lib/administrateur-judiciaire/domain/format'
import type { EntreeIndexRecherche, TypeEntreeIndex } from '@/lib/administrateur-judiciaire/domain/recherche'
import { normaliserTexteLibre } from '@/lib/administrateur-judiciaire/domain/texte'

/**
 * Analyse d'un courriel reçu : Fixy reconnaît l'expéditeur, la copropriété et le sujet, puis prépare la réponse
 * (jamais envoyée automatiquement), une note pour le gestionnaire et les écrans utiles.
 */

export type SujetCourriel = 'impaye' | 'intervention' | 'assemblee' | 'document' | 'notification' | 'autre'

/** Sujet du courriel : premier motif qui correspond au texte normalisé ; à défaut « autre ». */
export const MOTIFS_SUJET_COURRIEL: [RegExp, Exclude<SujetCourriel, 'autre'>][] = [
  [/impaye|solde|charges|paiement|reglement|virement|dette|echeancier|mise en demeure/, 'impaye'],
  [
    /fuite|panne|intervention|travaux|ascenseur|chauffage|degat|degat des eaux|infiltration|reparation/,
    'intervention',
  ],
  [/assemblee|convocation|ordre du jour|proces verbal|\bpv\b|vote|pouvoir/, 'assemblee'],
  [/reglement de copropriete|attestation|releve|etat date|document|copie|justificatif|carnet/, 'document'],
  [/notification|ordonnance|recours|referer/, 'notification'],
]

/**
 * Entrée de l'index citée dans un courriel (`texteNormalise`), parmi les types demandés. Score = part des mots
 * significatifs du libellé présents dans le texte, SANS le bonus du libellé complet de trouverEntiteDansDemande
 * (comportements distincts dans la maquette : ne pas fusionner) ; à égalité, la première entrée l'emporte.
 */
export function trouverEntiteDansCourriel(
  texteNormalise: string,
  index: EntreeIndexRecherche[],
  types: TypeEntreeIndex[],
): EntreeIndexRecherche | null {
  let meilleure: { entree: EntreeIndexRecherche; score: number } | null = null
  for (const entree of index) {
    if (!types.includes(entree.type)) continue
    const mots = normaliserTexteLibre(entree.label)
      .split(' ')
      .filter((mot) => mot.length >= 3 && !MOTS_IGNORES_ENTITE.includes(mot))
    if (!mots.length) continue
    const trouves = mots.filter((mot) => texteNormalise.includes(mot)).length
    if (!trouves) continue
    const score = trouves / mots.length
    if (!meilleure || score > meilleure.score)
      meilleure = {
        entree,
        score,
      }
  }
  return meilleure && meilleure.score >= 0.5 ? meilleure.entree : null
}

/** Fiche de copropriété lue par l'analyse (soldes des copropriétaires). */
export type FicheCoproCourriel = Pick<Fiche360Copropriete, 'personnes'>

export interface AnalyseCourriel {
  expediteur: EntreeIndexRecherche | null
  copro: EntreeIndexRecherche | null
  sujet: SujetCourriel
  /** « Expéditeur · copropriété · sujet : … ». */
  resume: string
  agent: AgentFixy
  /** Projet de réponse (paragraphes séparés par une ligne vide). */
  reponse: string
  /** Note pour le gestionnaire. */
  note: string
  actions: ActionNaviguerFixy[]
}

/**
 * Analyse un courriel. Si la copropriété n'est pas citée mais que l'expéditeur est reconnu, elle est déduite de son
 * dossier ; le solde est lu dans la fiche de la copropriété, à la date `referenceIso`.
 */
export function analyserCourriel(
  texte: string,
  index: EntreeIndexRecherche[],
  ficheCopro: (code: string) => FicheCoproCourriel | null,
  referenceIso: string,
): AnalyseCourriel {
  const normalise = normaliserTexteLibre(texte),
    expediteur = trouverEntiteDansCourriel(normalise, index, ['personne'])
  let copro = trouverEntiteDansCourriel(normalise, index, ['copro'])
  const codeExpediteur = expediteur?.selection?.code
  if (!copro && codeExpediteur)
    copro = index.find((entree) => entree.type === 'copro' && entree.selection?.code === codeExpediteur) || null
  const sujet: SujetCourriel = MOTIFS_SUJET_COURRIEL.find(([motif]) => motif.test(normalise))?.[1] || 'autre',
    fiche = copro?.selection?.code ? ficheCopro(copro.selection.code) : null,
    coproprietaireId = expediteur?.selection?.coproprietaireId,
    personne = (coproprietaireId && fiche && fiche.personnes.find((p) => p.id === coproprietaireId)) || null,
    appellation = personne ? `Madame, Monsieur ${personne.nom}` : 'Madame, Monsieur',
    codeCopro = copro?.selection?.code || '',
    actions: ActionNaviguerFixy[] = []
  let agent: AgentFixy = 'Fixy',
    reponse = '',
    note = ''
  const resume = `${expediteur ? expediteur.label : 'Expéditeur non reconnu'} · ${copro ? copro.label : 'copropriété non reconnue'} · sujet : ${sujet}.`
  if (sujet === 'impaye') {
    agent = 'Léa'
    const solde = personne ? personne.solde : null,
      phraseSolde =
        solde != null
          ? ` Au ${dateIsoVersFr(referenceIso)}, votre compte de copropriétaire présente un solde de ${formatEurosCourrielFixy(solde)}${solde < 0 ? ', débiteur' : ''}.`
          : ' Nous vérifions votre compte et revenons vers vous avec le détail.',
      phraseDetail =
        solde != null && solde < 0
          ? " Le détail des provisions impayées par exercice vous sera adressé ; nous restons disponibles pour convenir d'un règlement."
          : ''
    // La formule d'appel (« Madame, Monsieur X ») est reprise telle quelle dans la formule de politesse.
    reponse = `${appellation},\n\nNous accusons réception de votre message.${phraseSolde}${phraseDetail}\n\nNous vous prions d'agréer, ${appellation}, l'expression de nos salutations distinguées.\n\nCabinet Delaunay`
    note = personne
      ? `Courriel de ${personne.nom} (${personne.lot}) sur son compte : solde ${formatEurosCourrielFixy(personne.solde)}. ${personne.solde < 0 ? 'Vérifier le dossier de recouvrement avant de répondre.' : 'Compte à jour.'}`
      : "Courriel sur un impayé, expéditeur non reconnu : identifier le copropriétaire avant de répondre."
    if (personne && personne.solde < 0)
      actions.push({
        id: `nav:personne360:${personne.id}`,
        label: 'Voir le dossier de recouvrement',
        effet: 'Ouvre la fiche de la personne.',
        type: 'naviguer',
        params: {
          route: 'personne360',
          coproprietaireId: personne.id,
          code: codeCopro,
        },
        ecrit: false,
      })
  } else if (sujet === 'intervention') {
    agent = 'Fixy'
    reponse = `${appellation},\n\nNous accusons réception de votre signalement${copro ? ` concernant ${copro.label}` : ''}. Un ordre de service est en cours d'établissement ; nous vous tiendrons informé de la date d'intervention.\n\nCabinet Delaunay`
    note = `Signalement technique${copro ? ` · ${copro.label}` : ''}${personne ? ` · ${personne.nom}, ${personne.lot}` : ''} : ouvrir un ordre de service et informer le conseil syndical si parties communes.`
    actions.push({
      id: 'nav:interventions',
      label: 'Ouvrir les interventions',
      effet: "Ouvre l'écran Interventions.",
      type: 'naviguer',
      params: {
        route: 'interventions',
        code: codeCopro,
      },
      ecrit: false,
    })
  } else if (sujet === 'assemblee') {
    agent = 'Alfredo'
    reponse = `${appellation},\n\nNous accusons réception de votre message relatif à l'assemblée générale. La convocation est adressée au moins vingt et un jours avant la réunion (décret du 17 mars 1967, art. 9) ; le vote par correspondance et les pouvoirs sont possibles dans les conditions rappelées dans la convocation.\n\nCabinet Delaunay`
    note = `Question d'assemblée${personne ? ` de ${personne.nom}` : ''} : vérifier le calendrier de convocation et les documents joints.`
    actions.push({
      id: 'nav:agElective',
      label: "Ouvrir l'AG élective",
      effet: "Ouvre l'écran de l'assemblée.",
      type: 'naviguer',
      params: {
        route: 'agElective',
        code: codeCopro,
      },
      ecrit: false,
    })
  } else if (sujet === 'document') {
    agent = 'Alfredo'
    reponse = `${appellation},\n\nNous accusons réception de votre demande de document. Elle est transmise au gestionnaire du dossier, qui vous l'adressera sous les meilleurs délais.\n\nCabinet Delaunay`
    note = `Demande de document${personne ? ` de ${personne.nom}` : ''} : vérifier la disponibilité dans les archives reprises.`
    actions.push({
      id: 'nav:reprise',
      label: 'Voir les pièces reprises',
      effet: "Ouvre l'écran Reprise judiciaire.",
      type: 'naviguer',
      params: {
        route: 'reprise',
        code: codeCopro,
      },
      ecrit: false,
    })
  } else if (sujet === 'notification') {
    agent = 'Max'
    reponse = `${appellation},\n\nNous accusons réception de votre message relatif à la notification de l'ordonnance. Les voies de recours et leur délai figurent dans la notification qui vous a été adressée ; nous restons à votre disposition.\n\nCabinet Delaunay`
    note =
      'Question sur la notification ou un recours : vérifier la date de notification et le délai de référé (art. 59 ou 62-5 du décret).'
    actions.push({
      id: 'nav:notifJud',
      label: 'Ouvrir le registre des notifications',
      effet: 'Ouvre le registre.',
      type: 'naviguer',
      params: {
        route: 'notifJud',
        code: codeCopro,
      },
      ecrit: false,
    })
  } else {
    reponse = `${appellation},\n\nNous accusons réception de votre message et revenons vers vous dans les meilleurs délais.\n\nCabinet Delaunay`
    note = `Courriel${personne ? ` de ${personne.nom}` : ''} à qualifier par le gestionnaire.`
  }
  return {
    expediteur,
    copro,
    sujet,
    resume,
    agent,
    reponse,
    note,
    actions,
  }
}
