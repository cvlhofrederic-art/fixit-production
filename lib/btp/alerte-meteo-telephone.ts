/**
 * Alerte météo sur le téléphone (appli Vitfix Pro, 26/11/2026). À chaque passage (ouverture de l'appli, retour au
 * premier plan), pour chaque chantier que le compte voit (un salarié de terrain : ses chantiers affectés en cours ; un
 * compte en accès complet aux chantiers, gérant ou secrétaire : tous), une notification locale est programmée à 18 h,
 * heure du téléphone, la veille de chaque journée en alerte des trois jours qui suivent. Trois jours, pas un : depuis
 * l'ouverture du vendredi, le dimanche soir est couvert pour le lundi (l'appli n'est souvent pas rouverte le week-end).
 * Après 18 h, l'alerte du lendemain qui n'a pas encore été montrée s'affiche tout de suite.
 *
 * Aucune notification « push » n'existe (ni Firebase, ni Apple) : le serveur ne peut rien déclencher sur le
 * téléphone, d'où l'e-mail de la veille au soir (app/api/cron/alerte-meteo).
 *
 * Une notification par chantier et par journée (clé alerte-meteo:<chantier>:<date>, même identifiant natif) : la
 * reprogrammer remplace la précédente. Elle est annulée si l'alerte de cette journée disparaît, si la case est décochée,
 * si le chantier n'est plus suivi ce jour-là (terminé, annulé…) ou s'il n'est plus dans la liste (salarié affecté
 * ailleurs). Une prévision illisible n'annule rien. L'appareil retient ce qui est programmé ou montré (clés `vitfix_`,
 * hors du miroir user_storage, qui ne copie que `fixit_`) ; les clés des journées passées sont retirées.
 */

import {
  alerteDuJour,
  chantierSuiviLe,
  dateDecalee,
  dateLocale,
  jourDeLaDate,
  joursDePrevisions,
  texteAlerteDuLendemain,
  type JourPrevu,
} from '@/lib/btp/alerte-meteo'
import { urlPrevisionsMeteo } from '@/lib/btp/meteo-url'

/** Heure locale de la notification de la veille. */
export const HEURE_ALERTE_VEILLE = 18

/**
 * Journées couvertes à chaque passage : demain et les deux suivantes. Au plus trois notifications en attente par
 * chantier (iOS n'en garde que 64 par appli, les plus proches).
 */
export const JOURNEES_COUVERTES = 3

export interface ChantierPourAlerte {
  id: string
  titre?: string
  statut?: string
  latitude?: number | null
  longitude?: number | null
  alerteMeteo?: boolean
  alerte_meteo?: boolean
  dateDebut?: string | null
  date_debut?: string | null
}

export interface OutilsNotification {
  programmer: (p: { cle: string; titre: string; corps: string; a?: Date; extra?: Record<string, unknown> }) => Promise<boolean>
  annuler: (cle: string) => Promise<void>
  /** La notification de cette clé attend-elle encore son heure ? (non partie : téléphone éteint, appli tuée…) */
  enAttente: (cle: string) => Promise<boolean>
}

export interface BilanAlertes {
  programmees: number
  affichees: number
  annulees: number
  ignorees: number
}

type Etat = 'programmee' | 'affichee'

const PREFIXE_MEMOIRE = 'vitfix_btp_alerte_meteo_'
const PREFIXE_CLE = 'alerte-meteo:'

/** Clé de la notification d'un chantier pour une journée (identifiant natif stable). */
export const cleNotificationAlerte = (chantierId: string, date: string) => `${PREFIXE_CLE}${chantierId}:${date}`

/** Lit, écrit ou retire dans la mémoire de l'appareil ; indisponible (navigation privée) : signalé, sans effet. */
function memoire<R>(action: (stockage: Storage) => R, parDefaut: R): R {
  try {
    return action(localStorage)
  } catch (err) {
    console.warn('[alerte-meteo] mémoire de l’appareil indisponible :', err instanceof Error ? err.message : err)
    return parDefaut
  }
}

const etatRetenu = (cle: string): Etat | null =>
  memoire(s => {
    const valeur = s.getItem(PREFIXE_MEMOIRE + cle)
    return valeur === 'programmee' || valeur === 'affichee' ? valeur : null
  }, null)
const retenir = (cle: string, etat: Etat) => memoire(s => s.setItem(PREFIXE_MEMOIRE + cle, etat), undefined)
const oublier = (cle: string) => memoire(s => s.removeItem(PREFIXE_MEMOIRE + cle), undefined)

/** Clés retenues sur l'appareil, relevées avant toute modification (retirer pendant le parcours en sauterait). */
function clesRetenues(): Array<{ cle: string; chantierId: string; date: string }> {
  return memoire(s => {
    const cles: Array<{ cle: string; chantierId: string; date: string }> = []
    for (let i = 0; i < s.length; i++) {
      const nom = s.key(i)
      if (!nom?.startsWith(PREFIXE_MEMOIRE + PREFIXE_CLE)) continue
      const cle = nom.slice(PREFIXE_MEMOIRE.length)
      const separateur = cle.lastIndexOf(':')
      cles.push({ cle, chantierId: cle.slice(PREFIXE_CLE.length, separateur), date: cle.slice(separateur + 1) })
    }
    return cles
  }, [])
}

/** 18 h, heure du téléphone, la veille de cette journée. */
function veilleDe(date: string): Date {
  const [annee, mois, jour] = dateDecalee(date, -1).split('-').map(Number)
  return new Date(annee, mois - 1, jour, HEURE_ALERTE_VEILLE, 0, 0, 0)
}

/**
 * Avant tout : les journées passées sont oubliées (déjà sonnées) ; une notification encore programmée pour un chantier
 * absent de la liste, ou qui n'est plus suivi ce jour-là (case décochée, terminé, annulé…), est annulée.
 */
async function nettoyer(
  chantiers: readonly ChantierPourAlerte[], aujourdhui: string, outils: OutilsNotification, bilan: BilanAlertes,
): Promise<void> {
  const parId = new Map(chantiers.map(c => [c.id, c]))
  for (const { cle, chantierId, date } of clesRetenues()) {
    if (date <= aujourdhui) { oublier(cle); continue }
    const chantier = parId.get(chantierId)
    if (chantier && chantierSuiviLe(chantier, date)) continue
    if (etatRetenu(cle) === 'programmee') {
      await outils.annuler(cle)
      bilan.annulees++
    }
    oublier(cle)
  }
}

/** Prévision à 7 jours du chantier ; position absente ou service injoignable : null (rien n'est alors annulé). */
async function lirePrevision(chantier: ChantierPourAlerte, lire: typeof fetch): Promise<JourPrevu[] | null> {
  const url = urlPrevisionsMeteo(chantier.latitude, chantier.longitude)
  if (!url) return null
  try {
    const reponse = await lire(url)
    return reponse.ok ? joursDePrevisions(await reponse.json()) : null
  } catch (err) {
    console.warn('[alerte-meteo] prévision illisible :', err instanceof Error ? err.message : err)
    return null
  }
}

interface Passage {
  isPt: boolean
  outils: OutilsNotification
  maintenant: Date
  bilan: BilanAlertes
}

/** Montre tout de suite l'alerte de demain, une seule fois ; une notification de 18 h restée en attente est remplacée. */
async function afficherSiPasEncore(
  p: Passage, cle: string, etat: Etat | null, notification: { titre: string; corps: string; extra: Record<string, unknown> },
): Promise<void> {
  if (etat === 'affichee') return
  if (etat === 'programmee') {
    // L'heure est passée : partie (rien à faire), ou restée en attente (téléphone éteint, appli tuée, alarme différée).
    if (!(await p.outils.enAttente(cle))) { retenir(cle, 'affichee'); return }
    await p.outils.annuler(cle)
  }
  if (await p.outils.programmer({ cle, ...notification })) {
    retenir(cle, 'affichee')
    p.bilan.affichees++
  }
}

/** Une journée d'un chantier suivi : programmée pour la veille à 18 h, affichée, ou annulée si l'alerte a disparu. */
async function traiterJournee(p: Passage, chantier: ChantierPourAlerte, jours: readonly JourPrevu[], date: string): Promise<void> {
  if (!jourDeLaDate(jours, date)) return // journée absente ou incomplète : on ne sait rien, on ne touche à rien
  const cle = cleNotificationAlerte(chantier.id, date)
  const etat = etatRetenu(cle)
  const alerte = alerteDuJour(jours, date)
  if (!alerte) {
    if (etat === 'programmee') {
      await p.outils.annuler(cle)
      oublier(cle)
      p.bilan.annulees++
    }
    return
  }
  const { titre, corps } = texteAlerteDuLendemain(chantier.titre ?? '', alerte.motifs, p.isPt, date)
  const notification = { titre, corps, extra: { chantierId: chantier.id, date } }
  const veille = veilleDe(date)
  if (p.maintenant >= veille) {
    await afficherSiPasEncore(p, cle, etat, notification)
    return
  }
  // Avant l'heure : programmée, ou reprogrammée avec la prévision du moment (même identifiant, elle remplace).
  if (await p.outils.programmer({ cle, ...notification, a: veille })) {
    retenir(cle, 'programmee')
    p.bilan.programmees++
  }
}

/**
 * Programme les alertes de la veille des chantiers suivis. Ne lève jamais : une prévision illisible ou un réseau
 * absent laisse le chantier de côté (revu au prochain passage). La liste doit avoir été lue : une liste en échec ne
 * doit pas être passée ici (elle annulerait toutes les alertes).
 */
export async function programmerAlertesMeteo(
  chantiers: readonly ChantierPourAlerte[],
  isPt: boolean,
  outils: OutilsNotification,
  maintenant: Date = new Date(),
  lire: typeof fetch = fetch,
): Promise<BilanAlertes> {
  const bilan: BilanAlertes = { programmees: 0, affichees: 0, annulees: 0, ignorees: 0 }
  const aujourdhui = dateLocale(maintenant)
  const dates = Array.from({ length: JOURNEES_COUVERTES }, (_, i) => dateDecalee(aujourdhui, i + 1))
  const passage: Passage = { isPt, outils, maintenant, bilan }
  try {
    await nettoyer(chantiers, aujourdhui, outils, bilan)
    for (const chantier of chantiers) {
      const suivies = dates.filter(date => chantierSuiviLe(chantier, date))
      if (suivies.length === 0) continue
      const jours = await lirePrevision(chantier, lire)
      if (!jours) { bilan.ignorees++; continue }
      for (const date of suivies) await traiterJournee(passage, chantier, jours, date)
    }
  } catch (err) {
    // Module natif introuvable ou refus inattendu : rien de plus ce passage-ci, le suivant reprendra.
    console.warn('[alerte-meteo] programmation interrompue :', err instanceof Error ? err.message : err)
  }
  return bilan
}
