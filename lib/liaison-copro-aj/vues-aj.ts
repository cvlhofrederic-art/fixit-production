// ── Liaison portail ↔ Administrateur judiciaire : ce que l'AJ affiche des échanges ──────────────────────────────
//
// Fonctions pures, sans React : lignes de l'écran Doléances et notifications de la cloche, tirées des demandes,
// messages et votes déposés sur le portail copropriétaire (lib/liaison-copro-aj/stockage.ts).

import type { DemandeLiaison, EtatLiaison, StatutDemandeLiaison, VoteLiaison } from '@/lib/liaison-copro-aj/stockage'

/** Doléance au format de l'écran Doléances : [objet, copropriété, priorité, teinte, statut, description, « JJ/MM »]. */
export type LigneDoleance = [
  objet: string,
  copropriete: string,
  priorite: 'Urgente' | 'Haute' | 'Moyenne' | 'Basse',
  teintePriorite: 'rust' | 'amber' | '' | 'sage',
  statut: 'Ouverte' | 'En cours' | 'Résolue',
  description: string,
  dateSignalement: string,
]

const deuxChiffres = (n: number): string => String(n).padStart(2, '0')

/** « JJ/MM » d'un horodatage ISO (heure locale). */
const jourMois = (iso: string): string => {
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? '' : `${deuxChiffres(d.getDate())}/${deuxChiffres(d.getMonth() + 1)}`
}

/** « JJ/MM/AAAA à HH:MM » d'un horodatage ISO (heure locale), comme les notifications de l'AJ. */
export const dateHeure = (iso: string): string => {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return `${deuxChiffres(d.getDate())}/${deuxChiffres(d.getMonth() + 1)}/${d.getFullYear()} à ${deuxChiffres(d.getHours())}:${deuxChiffres(d.getMinutes())}`
}

export const STATUT_DOLEANCE: Record<StatutDemandeLiaison, LigneDoleance[4]> = {
  en_attente: 'Ouverte',
  acceptee: 'En cours',
  en_cours: 'En cours',
  terminee: 'Résolue',
  annulee: 'Résolue',
}

/** Libellé du statut vu par le copropriétaire (repris du portail). */
export const LIBELLE_STATUT_PORTAIL: Record<StatutDemandeLiaison, string> = {
  en_attente: 'Reçue',
  acceptee: 'Prise en charge',
  en_cours: 'En cours',
  terminee: 'Terminée',
  annulee: 'Annulée',
}

/** Objet court de la demande : type et lieu (« Plomberie — Lot 12 — Apt B3 », « Ascenseur — parties communes (Hall) »). */
export function objetDemande(d: DemandeLiaison): string {
  if (!d.partieCommune) return `${d.type} — ${d.lot}`
  return `${d.type} — parties communes${d.zone ? ` (${d.zone})` : ''}`
}

/** Doléance de l'écran Doléances tirée d'une demande du portail. */
export function doleanceDepuisDemande(d: DemandeLiaison): LigneDoleance {
  let priorite: LigneDoleance[2] = 'Moyenne'
  let teinte: LigneDoleance[3] = ''
  if (d.priorite === 'urgente') {
    priorite = 'Urgente'
    teinte = 'rust'
  } else if (d.priorite === 'planifiee') {
    priorite = 'Basse'
    teinte = 'sage'
  }
  return [objetDemande(d), d.nomCopro, priorite, teinte, STATUT_DOLEANCE[d.statut], d.description, jourMois(d.creeLe)]
}

/** Notification de la cloche de l'AJ (même forme que celles du centre de notifications). */
export interface NotificationLiaison {
  id: string
  kind: string
  icon: string
  title: string
  desc: string
  time: string
  /** Écran de l'AJ ouvert au clic. */
  route: string
  /** Horodatage ISO, pour le tri. */
  quand: string
  /** Déjà vue par l'AJ (enregistré dans la liaison : survit au rechargement). */
  lue: boolean
}

const LIBELLES_CHOIX: Record<VoteLiaison['choix'], string> = { pour: 'pour', contre: 'contre', abstention: 'abstention' }

/** Nombre de notifications de la liaison gardées dans la cloche (les plus récentes). */
export const MAX_NOTIFICATIONS_LIAISON = 20

/**
 * Notifications des échanges du portail : demande, dernier message d'un copropriétaire, vote par correspondance ; les
 * plus récentes d'abord. Identifiant « liaison:demande:<id>:<instant> » ou « liaison:vote:<ag>|<n°>|<personne>:<instant> » :
 * il change à chaque nouvel échange, une notification lue ne masque donc pas la suivante.
 */
export function notificationsLiaison(etat: EtatLiaison): NotificationLiaison[] {
  const demandes = etat.demandes.map((d): NotificationLiaison => {
    const dernier = d.messages.findLast((m) => m.auteur === 'coproprietaire')
    const quand = dernier ? dernier.date : d.creeLe
    return {
      id: `liaison:demande:${d.id}:${quand}`,
      kind: 'message',
      icon: 'chat',
      title: dernier ? `Message de ${d.nomCoproprietaire} (portail)` : `Nouvelle demande du portail : ${d.type}`,
      desc: `${d.nomCopro} · ${d.lot}${dernier ? ` · « ${dernier.texte.slice(0, 80)} »` : ''}`,
      time: dateHeure(quand),
      route: 'doleances',
      quand,
      lue: d.vueParAj,
    }
  })
  const votes = etat.votes.map((v): NotificationLiaison => ({
    id: `liaison:vote:${v.agId}|${v.resolutionNumero}|${v.coproprietaireId}:${v.date}`,
    kind: 'ag',
    icon: 'pencil',
    title: 'Vote par correspondance reçu du portail',
    desc: `${v.nomCoproprietaire} · résolution n° ${v.resolutionNumero} : ${LIBELLES_CHOIX[v.choix]}`,
    time: dateHeure(v.date),
    route: 'copros',
    quand: v.date,
    lue: v.vueParAj,
  }))
  return [...demandes, ...votes].sort((a, b) => b.quand.localeCompare(a.quand)).slice(0, MAX_NOTIFICATIONS_LIAISON)
}

/** Portail copropriétaire relié (vue super admin), ouvert sur ce copropriétaire de l'AJ. */
export const lienPortailCoproprietaire = (codeCopro: string, coproprietaireId: string): string =>
  `/coproprietaire/dashboard?aj=${encodeURIComponent(codeCopro)}&personne=${encodeURIComponent(coproprietaireId)}`
