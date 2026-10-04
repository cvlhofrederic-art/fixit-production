import { DEMO_COPROPRIETAIRES } from '@/components/administrateur-judiciaire/data/coproprietaires'
import { DEMO_COPROPRIETES } from '@/components/administrateur-judiciaire/data/coproprietes'
import { DEMO_NOTIFICATIONS } from '@/components/administrateur-judiciaire/data/notifications'
import { DEMO_OBLIGATIONS } from '@/components/administrateur-judiciaire/data/obligations'
import { DEMO_PRESTATAIRES } from '@/components/administrateur-judiciaire/data/prestataires'
import { DEMO_TACHES } from '@/components/administrateur-judiciaire/data/taches'
import { genererId } from '@/lib/administrateur-judiciaire/db/ids'
import {
  repoCoproprietaires,
  repoCoproprietes,
  repoEcheances,
  repoLots,
  repoMandats,
  repoNotifications,
  repoPrestataires,
  repoTaches,
} from '@/lib/administrateur-judiciaire/db/repositories'
import { ajDb } from '@/lib/administrateur-judiciaire/db/schema'
import { dateFrVersDate } from '@/lib/administrateur-judiciaire/domain/dates'
import type { Tantiemes } from '@/lib/administrateur-judiciaire/domain/format'
import { DATE_DEMO_ISO, lireModeStocke } from '@/lib/administrateur-judiciaire/mode'

/** Remplissage de la base locale avec le jeu de démonstration, au premier lancement en mode démo. */

/** Auteur des écritures du seed. */
const ACTEUR_SEED_DEMO: string | null = null

/**
 * Instant de référence de la démonstration : 9 h, heure LOCALE, le jour de démonstration (chaîne sans fuseau).
 * Repli des dates de mandat et de tâche illisibles, base des anciennetés « il y a … » des notifications.
 */
export const INSTANT_REFERENCE_DEMO = new Date(`${DATE_DEMO_ISO}T09:00:00`)

/**
 * Date d'une notification de démonstration d'après son ancienneté (« il y a 8 min », « il y a 2 h », « il y a 3 j »,
 * « hier »). Tout autre texte renvoie l'instant de référence lui-même (même instance).
 */
export function dateDepuisAncienneteDemo(anciennete: string): Date {
  const minutes = anciennete.match(/il y a (\d+) min/)
  if (minutes) return new Date(INSTANT_REFERENCE_DEMO.getTime() - Number(minutes[1]) * 6e4)
  const heures = anciennete.match(/il y a (\d+) h/)
  if (heures) return new Date(INSTANT_REFERENCE_DEMO.getTime() - Number(heures[1]) * 36e5)
  const jours = anciennete.match(/il y a (\d+) j/)
  return jours
    ? new Date(INSTANT_REFERENCE_DEMO.getTime() - Number(jours[1]) * 864e5)
    : anciennete === 'hier'
      ? new Date(INSTANT_REFERENCE_DEMO.getTime() - 864e5)
      : INSTANT_REFERENCE_DEMO
}

/**
 * Tantièmes « numérateur/dénominateur » des lots de démonstration ; partie illisible ou absente → 0
 * (différent de parserTantiemes de l'import, qui a d'autres règles).
 */
export function decomposerTantiemesDemo(texte: string): Tantiemes {
  const [numerateur, denominateur] = texte.split('/').map(Number)
  return {
    numerateur: numerateur || 0,
    denominateur: denominateur || 0,
  }
}

/**
 * Insère le jeu de démonstration, séquentiellement, via les repositories (une entrée de journal par création).
 * Ne fait rien en mode réel (mode relu dans le stockage) ou si la base contient déjà des copropriétés.
 *
 * Correctif d'un défaut hérité de la maquette : le contrôle de la base vide et toutes les insertions forment une seule
 * transaction. Un seed interrompu (onglet fermé ou rechargé, erreur d'écriture) est entièrement annulé, donc refait au
 * lancement suivant ; auparavant, les premières insertions restaient et la démonstration demeurait partielle (le
 * contrôle « base déjà remplie » empêchait toute reprise). Un second onglet attend la fin de la transaction.
 * Mêmes données, mêmes identifiants et même journal d'activité qu'avant.
 */
async function peuplerBaseDemo(): Promise<void> {
  if (lireModeStocke() === 'reel') return
  await ajDb.transaction('rw', ajDb.tables, async () => {
    if ((await ajDb.coproprietes.count()) === 0) await insererJeuDemo()
  })
}

/** Insertions du jeu de démonstration (appelée dans la transaction de peuplerBaseDemo, sur une base sans copropriété). */
async function insererJeuDemo(): Promise<void> {
  const idsParNomCopro = new Map<string, string>()
  for (const copro of DEMO_COPROPRIETES) {
    await repoCoproprietes.create(
      {
        code: copro.code,
        nom: copro.nom,
        adresse: copro.adresse,
        nbLots: copro.lots,
        budget: copro.budget,
        depense: copro.depense,
        impayes: copro.impayes,
        fondsTravaux: copro.fondsTravaux,
      },
      {
        id: copro.id,
        actor: ACTEUR_SEED_DEMO,
      },
    )
    idsParNomCopro.set(copro.nom, copro.id)
    await repoMandats.create(
      {
        coproprieteId: copro.id,
        fondement: copro.fondement,
        motif: copro.motif,
        tribunal: copro.tribunal,
        rg: copro.rg,
        ordonnance: dateFrVersDate(copro.ordonnance) || INSTANT_REFERENCE_DEMO,
        dureeMois: copro.dureeMois,
        echeance: dateFrVersDate(copro.echeance) || INSTANT_REFERENCE_DEMO,
        statut: copro.statut,
        pill: copro.pill,
        notifOrdonnance: copro.notifOrdonnance,
      },
      {
        actor: ACTEUR_SEED_DEMO,
      },
    )
  }
  for (const coproprietaire of DEMO_COPROPRIETAIRES) {
    const coproprieteId = idsParNomCopro.get(coproprietaire.copro)
    if (!coproprieteId) continue
    const lot = await repoLots.create(
      {
        coproprieteId,
        numero: coproprietaire.lot,
        tantiemes: decomposerTantiemesDemo(coproprietaire.tantiemes),
      },
      {
        id: genererId(),
        actor: ACTEUR_SEED_DEMO,
      },
    )
    await repoCoproprietaires.create(
      {
        lotId: lot.id,
        nom: coproprietaire.nom,
        tel: coproprietaire.tel,
        mail: coproprietaire.mail,
        solde: coproprietaire.solde,
        statut: coproprietaire.statut,
      },
      {
        id: coproprietaire.id,
        actor: ACTEUR_SEED_DEMO,
      },
    )
  }
  for (const prestataire of DEMO_PRESTATAIRES)
    await repoPrestataires.create(
      {
        nom: prestataire.nom,
        metier: prestataire.metier,
        ville: prestataire.ville,
        siret: prestataire.siret,
        decennale: prestataire.decennale === 'Oui',
        note: Number(String(prestataire.note).replace(',', '.')),
        interventions: prestataire.interventions,
        statut: prestataire.statut,
        pill: prestataire.pill,
      },
      {
        id: prestataire.id,
        actor: ACTEUR_SEED_DEMO,
      },
    )
  for (const obligation of DEMO_OBLIGATIONS) {
    const coproprieteId = idsParNomCopro.get(obligation.copro) || null
    // Obligation retenue seulement si sa copropriété est retrouvée par son nom ; date null si elle n'est pas
    // « JJ/MM/AAAA » (« En continu »).
    if (coproprieteId)
      await repoEcheances.create(
        {
          coproprieteId,
          objet: obligation.objet,
          base: obligation.base,
          date: dateFrVersDate(obligation.date),
          statut: obligation.statut,
        },
        {
          id: obligation.id,
          actor: ACTEUR_SEED_DEMO,
        },
      )
  }
  for (const notification of DEMO_NOTIFICATIONS)
    await repoNotifications.create(
      {
        kind: notification.kind,
        titre: notification.title,
        description: notification.desc,
        date: dateDepuisAncienneteDemo(notification.time),
        lu: false,
        coproprieteId: null,
      },
      {
        id: notification.id,
        actor: ACTEUR_SEED_DEMO,
      },
    )
  for (const tache of DEMO_TACHES)
    await repoTaches.create(
      {
        libelle: tache.title,
        due: dateFrVersDate(tache.due) || INSTANT_REFERENCE_DEMO,
        assigneId: null,
      },
      {
        id: tache.id,
        actor: ACTEUR_SEED_DEMO,
      },
    )
}

/** Initialisation en cours (partagée par les appels concurrents). */
let initialisationEnCours: Promise<void> | null = null

/**
 * Remplit la base locale avec la démonstration si nécessaire. Deux appels concurrents (double effet du StrictMode de
 * développement) partagent la même exécution : sans cela, tous deux verraient une base vide et dupliqueraient les lots
 * (identifiants aléatoires). Un appel ultérieur refait la vérification, comme dans la maquette.
 */
export function initialiserBaseDemo(): Promise<void> {
  if (!initialisationEnCours)
    initialisationEnCours = peuplerBaseDemo().finally(() => {
      initialisationEnCours = null
    })
  return initialisationEnCours
}
