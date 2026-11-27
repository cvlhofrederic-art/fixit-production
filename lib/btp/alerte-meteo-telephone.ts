/**
 * Alerte météo sur le téléphone (appli Vitfix Pro, 26/11/2026). À chaque passage (ouverture de l'appli, retour au
 * premier plan, chantier enregistré dans l'appli), pour chaque chantier que le compte voit (un salarié de terrain : ses
 * chantiers affectés en cours ; un compte en accès complet aux chantiers, gérant ou secrétaire : tous), une notification
 * locale est programmée à 18 h, heure du téléphone, la veille de chaque journée en alerte des trois jours qui suivent.
 * Trois jours, pas un : depuis l'ouverture du vendredi, le dimanche soir est couvert pour le lundi (l'appli n'est
 * souvent pas rouverte le week-end) ; le texte dit alors de quel jour date la prévision. Après 18 h, l'alerte du
 * lendemain qui n'a pas encore été montrée s'affiche tout de suite.
 *
 * Aucune notification « push » n'existe (ni Firebase, ni Apple) : le serveur ne peut rien déclencher sur le
 * téléphone, d'où l'e-mail de la veille au soir (lib/btp/alerte-meteo-serveur.ts).
 *
 * Une notification par chantier et par journée (clé alerte-meteo:<chantier>:<date>, même identifiant natif) : la
 * reprogrammer remplace la précédente. Elle est annulée si l'alerte de cette journée disparaît, si la case est décochée,
 * si le chantier n'est plus suivi ce jour-là (terminé, annulé…), s'il perd sa position GPS ou s'il n'est plus dans la
 * liste (salarié affecté ailleurs). Une prévision illisible n'annule rien ; une annulation en échec garde sa trace pour
 * être refaite. L'autorisation des notifications n'est demandée qu'une fois par passage. L'appareil retient ce qui est
 * programmé ou montré (clés `vitfix_`, hors du miroir user_storage, qui ne copie que `fixit_`) ; les clés des journées
 * passées sont retirées (leur notification annulée si elle n'était pas partie).
 */

import {
  alerteDuJour,
  chantierSuiviLe,
  dateDecalee,
  dateLocale,
  jourDeLaDate,
  joursDePrevisions,
  positionPourAlerte,
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

/** Délai maximal d'une lecture des prévisions (comme le serveur) : un réseau suspendu ne bloque pas les chantiers suivants. */
export const DELAI_PREVISION_TELEPHONE_MS = 8000

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
  /** Vrai si l'annulation est faite (sinon la trace est gardée pour réessayer). */
  annuler: (cle: string) => Promise<boolean>
  /** La notification de cette clé attend-elle encore son heure ? (non partie : téléphone éteint, appli tuée…) */
  enAttente: (cle: string) => Promise<boolean>
  /** Demande l'autorisation des notifications ; appelée au plus une fois par passage, et seulement s'il faut programmer. */
  autorisation: () => Promise<boolean>
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

/**
 * Augmente à chaque déconnexion : un passage déclenché avant ne programme plus rien après (il pourrait finir après
 * l'annulation des notifications). Le composant la relève au moment où il déclenche un passage (generationAlertes).
 */
let generation = 0

/** Génération en cours, à relever au moment où un passage est déclenché (avant une relecture ou une mise en file). */
export const generationAlertes = (): number => generation

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

interface Passage {
  isPt: boolean
  outils: OutilsNotification
  /** Heure du moment : un passage qui franchit 18 h décide avec l'heure réelle, pas celle de son départ. */
  horloge: () => Date
  aujourdhui: string
  bilan: BilanAlertes
  generation: number
  /** Réponse à la demande d'autorisation, faite au plus une fois par passage. */
  autorisation?: Promise<boolean>
}

/**
 * Le passage vaut-il encore ? Pas de déconnexion depuis son déclenchement, et toujours le même jour (un passage
 * suspendu puis repris le lendemain annoncerait « demain » pour le jour même : le suivant recalcule ses dates).
 */
const passageValable = (p: Passage) => p.generation === generation && dateLocale(p.horloge()) === p.aujourdhui

/** Ce passage peut-il programmer ? Valable avant ET après la demande d'autorisation (dialogue resté ouvert). */
async function peutProgrammer(p: Passage): Promise<boolean> {
  if (!passageValable(p)) return false
  p.autorisation ??= p.outils.autorisation()
  return (await p.autorisation) && passageValable(p)
}

/** Programme ; si le passage a cessé de valoir pendant la programmation (déconnexion…), l'annule aussitôt. */
async function programmerTenu(
  p: Passage, params: { cle: string; titre: string; corps: string; a?: Date; extra?: Record<string, unknown> },
): Promise<boolean> {
  if (!(await p.outils.programmer(params))) return false
  if (passageValable(p)) return true
  await p.outils.annuler(params.cle)
  return false
}

/** Annule la notification encore programmée sous cette clé ; la trace n'est oubliée que si l'annulation est faite. */
async function annulerEtOublier(p: Passage, cle: string): Promise<void> {
  if (etatRetenu(cle) !== 'programmee') { oublier(cle); return }
  if (!(await p.outils.annuler(cle))) return
  oublier(cle)
  p.bilan.annulees++
}

/**
 * Avant tout : les journées passées sont retirées (une notification restée en attente, téléphone éteint, est annulée :
 * elle ressortirait au redémarrage, des jours plus tard) ; celle du jour reste jusqu'au lendemain. Une notification
 * encore programmée pour un chantier absent de la liste, qui n'est plus suivi ce jour-là ou qui n'a plus de position,
 * est annulée.
 */
async function nettoyer(chantiers: readonly ChantierPourAlerte[], p: Passage): Promise<void> {
  const parId = new Map(chantiers.map(c => [c.id, c]))
  for (const { cle, chantierId, date } of clesRetenues()) {
    if (date === p.aujourdhui) continue
    const chantier = date > p.aujourdhui ? parId.get(chantierId) : undefined
    if (chantier && chantierSuiviLe(chantier, date) && positionPourAlerte(chantier.latitude, chantier.longitude)) continue
    if (date < p.aujourdhui) {
      if (etatRetenu(cle) === 'programmee') await p.outils.annuler(cle)
      oublier(cle)
      continue
    }
    await annulerEtOublier(p, cle)
  }
}

/** Prévision à 7 jours du chantier ; position absente ou service injoignable : null (rien n'est alors annulé). */
async function lirePrevision(chantier: ChantierPourAlerte, lire: typeof fetch): Promise<JourPrevu[] | null> {
  const url = urlPrevisionsMeteo(chantier.latitude, chantier.longitude)
  if (!url) return null
  try {
    const signal = typeof AbortSignal.timeout === 'function' ? AbortSignal.timeout(DELAI_PREVISION_TELEPHONE_MS) : undefined
    const reponse = await lire(url, signal ? { signal } : undefined)
    return reponse.ok ? joursDePrevisions(await reponse.json()) : null
  } catch (err) {
    console.warn('[alerte-meteo] prévision illisible :', err instanceof Error ? err.message : err)
    return null
  }
}

/** Montre tout de suite l'alerte de demain, une seule fois ; une notification de 18 h restée en attente est remplacée. */
async function afficherSiPasEncore(
  p: Passage, cle: string, etat: Etat | null, notification: { titre: string; corps: string; extra: Record<string, unknown> },
): Promise<void> {
  if (etat === 'affichee') return
  if (etat === 'programmee') {
    // L'heure est passée : partie (rien à faire), ou restée en attente (téléphone éteint, appli tuée, alarme différée).
    if (!(await p.outils.enAttente(cle))) { retenir(cle, 'affichee'); return }
    if (!(await peutProgrammer(p))) return
    await p.outils.annuler(cle)
  } else if (!(await peutProgrammer(p))) {
    return
  }
  if (await programmerTenu(p, { cle, ...notification })) {
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
    if (etat === 'programmee') await annulerEtOublier(p, cle)
    return
  }
  const veille = veilleDe(date)
  // Prévision lue un autre jour que la veille (le vendredi pour le dimanche soir) : le texte le dit.
  const lueAvant = dateDecalee(date, -1) !== p.aujourdhui ? p.aujourdhui : undefined
  const { titre, corps } = texteAlerteDuLendemain(chantier.titre ?? '', alerte.motifs, p.isPt, date, lueAvant)
  const notification = { titre, corps, extra: { chantierId: chantier.id, date } }
  if (p.horloge().getTime() >= veille.getTime()) {
    await afficherSiPasEncore(p, cle, etat, notification)
    return
  }
  // Avant l'heure : programmée, ou reprogrammée avec la prévision du moment (même identifiant, elle remplace).
  if (!(await peutProgrammer(p))) return
  if (await programmerTenu(p, { cle, ...notification, a: veille })) {
    retenir(cle, 'programmee')
    p.bilan.programmees++
  }
}

/**
 * Déconnexion : les notifications encore programmées sur ce téléphone ne doivent plus sonner (un salarié qui se
 * déconnecte ne reçoit plus le titre des chantiers), et un passage en cours ne programme plus rien. La mémoire de
 * l'appareil n'est pas touchée : rien ne s'efface à la déconnexion ; la prochaine connexion relit et reprogramme (une
 * alerte annulée avant 18 h, puis le compte reconnecté après 18 h le même soir, n'est pas remontrée). Au plus
 * `delaiMaxMs` d'attente : la déconnexion n'est jamais retenue. Ne lève jamais.
 */
export async function annulerAlertesProgrammees(annuler: (cle: string) => Promise<unknown>, delaiMaxMs = 1500): Promise<void> {
  generation++
  const programmees = clesRetenues().filter(({ cle }) => etatRetenu(cle) === 'programmee')
  if (programmees.length === 0) return
  let minuterie: ReturnType<typeof setTimeout> | undefined
  const delai = new Promise<void>(resoudre => { minuterie = setTimeout(resoudre, delaiMaxMs) })
  const annulations = Promise.all(programmees.map(({ cle }) => annuler(cle))).then(() => undefined)
  try {
    await Promise.race([annulations, delai])
  } catch (err) {
    console.warn('[alerte-meteo] annulation à la déconnexion impossible :', err instanceof Error ? err.message : err)
  } finally {
    clearTimeout(minuterie)
  }
}

/**
 * Programme les alertes de la veille des chantiers suivis. Ne lève jamais : une prévision illisible ou un réseau
 * absent laisse le chantier de côté (revu au prochain passage). La liste doit avoir été lue : une liste en échec ne
 * doit pas être passée ici (elle annulerait toutes les alertes). `maintenant` : l'heure (fixe dans les tests) ou une
 * horloge ; par défaut l'heure réelle, relue à chaque décision. `generationDeDepart` : celle relevée quand le passage a
 * été déclenché (generationAlertes) ; par défaut celle du moment.
 */
export async function programmerAlertesMeteo(
  chantiers: readonly ChantierPourAlerte[],
  isPt: boolean,
  outils: OutilsNotification,
  maintenant: Date | (() => Date) = () => new Date(),
  lire: typeof fetch = fetch,
  generationDeDepart: number = generation,
): Promise<BilanAlertes> {
  const horloge = typeof maintenant === 'function' ? maintenant : () => maintenant
  const bilan: BilanAlertes = { programmees: 0, affichees: 0, annulees: 0, ignorees: 0 }
  const aujourdhui = dateLocale(horloge())
  const dates = Array.from({ length: JOURNEES_COUVERTES }, (_, i) => dateDecalee(aujourdhui, i + 1))
  const passage: Passage = { isPt, outils, horloge, aujourdhui, bilan, generation: generationDeDepart }
  try {
    await nettoyer(chantiers, passage)
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
