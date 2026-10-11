/**
 * Contexte envoyé aux agents IA (Fixy, Max, Léa, Tempo) de la succursale : un résumé compact de la base locale
 * (Dexie) tel que l'écran l'affiche, pour que les réponses de Claude parlent des mêmes copropriétés, mandats,
 * débiteurs et échéances que l'interface.
 *
 * Données personnelles : ni téléphone ni e-mail ne sortent du navigateur ; seuls le nom et le solde des
 * copropriétaires débiteurs sont transmis (le serveur masque en plus e-mails, téléphones, IBAN et adresses).
 * Fonction pure : la date de référence et le mode sont passés en paramètre.
 */
import type { CoproprieteVue } from '@/lib/administrateur-judiciaire/domain/coproprietes'
import { dateVersIso } from '@/lib/administrateur-judiciaire/domain/dates'
import type {
  Contrat,
  Coproprietaire,
  EcheanceSuivi,
  Impaye,
  Lot,
  NotificationLocale,
  Prestataire,
  Tache,
} from '@/lib/administrateur-judiciaire/db/schema'

/** Agent de la succursale qui reçoit la question (Alfredo : brouillons de réponse aux courriels). */
export type AgentAJ = 'fixy' | 'max' | 'lea' | 'tempo' | 'alfredo'

/** Domaine des réponses de l'écran de conversation → agent IA. */
export const AGENT_PAR_DOMAINE = {
  ops: 'fixy',
  juridique: 'max',
  compta: 'lea',
  echeances: 'tempo',
} as const satisfies Record<string, AgentAJ>

/** Nombre maximal d'éléments par liste : le contexte reste court (latence, coût) même sur une grosse base. */
const MAX_ELEMENTS = 25

export interface EntreeContexteAgent {
  aujourdhui: string
  mode: 'demo' | 'reel'
  coproprieteSelectionnee: string
  copros: readonly CoproprieteVue[]
  lots: readonly Lot[]
  coproprietaires: readonly Coproprietaire[]
  prestataires: readonly Prestataire[]
  echeances: readonly EcheanceSuivi[]
  taches: readonly Tache[]
  notifications: readonly NotificationLocale[]
  contrats: readonly Contrat[]
  impayes: readonly Impaye[]
  /** Données d'écran de démonstration hors base (ordres de service, automatisations), en mode démo seulement. */
  ecransDemo?: Record<string, unknown>
}

/**
 * Date AAAA-MM-JJ en composantes LOCALES, comme à l'écran (la base stocke les dates à minuit heure locale :
 * toISOString décalerait d'un jour à l'est d'UTC). Une chaîne (createdAt d'une copropriété sans mandat) donne null,
 * comme le champ vide affiché.
 */
const jour = (d: Date | string | null | undefined): string | null => dateVersIso(d)

const limiter = <T>(liste: readonly T[]): T[] => liste.slice(0, MAX_ELEMENTS)

export function construireContexteAgent(e: EntreeContexteAgent): Record<string, unknown> {
  const coproParId = new Map(e.copros.map((c) => [c.id, c.nom]))
  const coproDuLot = new Map(e.lots.map((l) => [l.id, coproParId.get(l.coproprieteId) ?? null]))
  const numeroDuLot = new Map(e.lots.map((l) => [l.id, l.numero]))
  const nomPrestataire = new Map(e.prestataires.map((p) => [p.id, p.nom]))
  const nomCoproprietaire = new Map(e.coproprietaires.map((c) => [c.id, c.nom]))

  return {
    dateDuJour: e.aujourdhui,
    mode: e.mode === 'demo' ? 'démonstration (données fictives)' : 'données réelles du cabinet',
    coproprieteSelectionnee: e.coproprieteSelectionnee || null,
    coproprietes: e.copros.map((c) => ({
      code: c.code,
      nom: c.nom,
      lots: c.lots,
      budgetAnnuel: c.budget,
      depensesExercice: c.depense,
      impayes: c.impayes,
      fondsTravaux: c.fondsTravaux,
      mandat: {
        fondement: c.fondement,
        motif: c.motif,
        tribunal: c.tribunal,
        rg: c.rg,
        ordonnance: jour(c.ordonnance),
        dureeMois: c.dureeMois,
        finDeMission: jour(c.echeance),
        statut: c.statut,
        notificationOrdonnance: c.notifOrdonnance,
      },
    })),
    coproprietairesDebiteurs: limiter(
      e.coproprietaires
        .filter((c) => c.solde < 0)
        .sort((a, b) => a.solde - b.solde)
        .map((c) => ({ nom: c.nom, lot: numeroDuLot.get(c.lotId) ?? null, copropriete: coproDuLot.get(c.lotId) ?? null, solde: c.solde, statut: c.statut })),
    ),
    nombreCoproprietaires: e.coproprietaires.length,
    dossiersImpayes: limiter(
      e.impayes.map((i) => ({ debiteur: nomCoproprietaire.get(i.coproprietaireId) ?? null, montant: i.montant, statut: i.statut })),
    ),
    echeances: limiter(
      [...e.echeances]
        .sort((a, b) => (jour(a.date) ?? '9999').localeCompare(jour(b.date) ?? '9999'))
        .map((x) => ({ copropriete: coproParId.get(x.coproprieteId) ?? null, objet: x.objet, base: x.base, date: jour(x.date), statut: x.statut })),
    ),
    taches: limiter(e.taches.map((t) => ({ libelle: t.libelle, echeance: jour(t.due) }))),
    notificationsRecentes: limiter(
      [...e.notifications]
        .sort((a, b) => (jour(b.date) ?? '').localeCompare(jour(a.date) ?? ''))
        .map((n) => ({ titre: n.titre, description: n.description, date: jour(n.date), lu: n.lu, copropriete: n.coproprieteId ? coproParId.get(n.coproprieteId) ?? null : null })),
    ),
    prestataires: limiter(
      e.prestataires.map((p) => ({ nom: p.nom, metier: p.metier, ville: p.ville, decennale: p.decennale, note: p.note, statut: p.statut })),
    ),
    contrats: limiter(
      e.contrats.map((c) => ({
        copropriete: coproParId.get(c.coproprieteId) ?? null,
        prestataire: nomPrestataire.get(c.prestataireId) ?? null,
        type: c.type ?? null,
        statut: c.statut ?? null,
        reconductionAu: c.reconductionAu ?? null,
      })),
    ),
    ...(e.mode === 'demo' && e.ecransDemo ? { ecransDemonstration: e.ecransDemo } : {}),
  }
}
